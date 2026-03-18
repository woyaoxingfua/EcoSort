/**
 * 讯飞实时语音转写大模型版 —— 语音转文字服务
 * 文档: https://www.xfyun.cn/doc/spark/asr_llm/rtasr_llm.html
 *
 * 流程：
 *   1. 前端上传 MP3 音频文件
 *   2. 后端用 ffmpeg 转为 PCM (16kHz, 16bit, mono)
 *   3. 通过 WebSocket 流式发送 PCM 到讯飞
 *   4. 收集所有识别结果，拼接为完整文本返回
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const WebSocket = require('ws');

// ffmpeg 路径（来自 @ffmpeg-installer/ffmpeg）
let ffmpegPath;
try {
  ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
} catch (e) {
  ffmpegPath = 'ffmpeg'; // fallback to system ffmpeg
}

const XFYUN_CONFIG = {
  appId: process.env.XFYUN_APP_ID || '',
  apiKey: process.env.XFYUN_API_KEY || '',
  apiSecret: process.env.XFYUN_API_SECRET || '',
  wsUrl: 'wss://office-api-ast-dx.iflyaisol.com/ast/communicate/v1'
};

// ---------- 工具函数 ----------

/** 去除中英文标点符号（语音识别结果用于搜索，标点无意义） */
function stripPunctuation(text) {
  if (!text) return '';
  return text.replace(/[，。！？、；：""''（）【】《》\s,.!?;:'"()\[\]{}<>\-—…·~`@#$%^&*_+=|\\\/]+/g, '').trim();
}

/** 生成当前时间的 ISO 8601 字符串（带时区偏移） */
function getUtcString() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const tzOffset = -now.getTimezoneOffset(); // 分钟
  const tzSign = tzOffset >= 0 ? '+' : '-';
  const tzH = pad(Math.floor(Math.abs(tzOffset) / 60));
  const tzM = pad(Math.abs(tzOffset) % 60);
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}` +
    `${tzSign}${tzH}${tzM}`;
}

/**
 * 根据讯飞文档生成签名
 * 1. 将参数按 key 升序排列
 * 2. URL-encode 后拼成 key=value& 形式（去掉末尾 &）
 * 3. 用 APISecret 做 HmacSHA1，再 Base64 编码
 */
function generateSignature(params, apiSecret) {
  const baseString = Object.keys(params)
    .sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join('&');

  return crypto
    .createHmac('sha1', apiSecret)
    .update(baseString)
    .digest('base64');
}

/** 构造讯飞 WebSocket 鉴权 URL */
function buildWsUrl() {
  const { appId, apiKey, apiSecret, wsUrl } = XFYUN_CONFIG;
  const params = {
    appId,
    accessKeyId: apiKey,
    utc: getUtcString(),
    lang: 'autodialect',
    audio_encode: 'pcm_s16le',
    samplerate: '16000'
  };

  params.signature = generateSignature(params, apiSecret);

  const qs = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  return `${wsUrl}?${qs}`;
}

// ---------- 音频转换 ----------

/**
 * 将任意音频文件转为 PCM (16kHz, 16bit, mono, little-endian)
 * 返回 PCM Buffer
 */
function convertToPcm(inputPath) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const ffmpeg = spawn(ffmpegPath, [
      '-i', inputPath,
      '-f', 's16le',
      '-acodec', 'pcm_s16le',
      '-ar', '16000',
      '-ac', '1',
      'pipe:1'
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    ffmpeg.stdout.on('data', (chunk) => chunks.push(chunk));

    let stderrData = '';
    ffmpeg.stderr.on('data', (d) => { stderrData += d.toString(); });

    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        console.error('ffmpeg 转码失败:', stderrData.slice(-500));
        return reject(new Error(`ffmpeg exited with code ${code}`));
      }
      resolve(Buffer.concat(chunks));
    });

    ffmpeg.on('error', (err) => {
      reject(new Error(`ffmpeg 启动失败: ${err.message}`));
    });
  });
}

// ---------- 讯飞 WebSocket 转写 ----------

/**
 * 从讯飞响应中提取文本
 *
 * 实际响应格式（与文档有差异）:
 *   started:  { msg_type: "action", data: { action: "started", sessionId: "..." } }
 *   result:   { msg_type: "result", data: { seg_id, cn: { st: { rt, type, bg, ed } }, ls } }
 *   error:    { msg_type: "error", data: ... }  或  { action: "error", code, data }
 */
function extractText(message) {
  try {
    const obj = JSON.parse(message);

    const msgType = obj.msg_type || obj.action || '';

    // 错误
    if (msgType === 'error' || obj.action === 'error') {
      const code = obj.code || obj.data?.code || '';
      const errMsg = typeof obj.data === 'string' ? obj.data : (obj.data?.message || obj.data?.desc || message);
      return { error: true, code, message: errMsg };
    }

    // 会话启动
    if (msgType === 'action' && obj.data?.action === 'started') {
      return { started: true, sid: obj.data?.sessionId || obj.sid || '' };
    }
    if (obj.action === 'started') {
      return { started: true, sid: obj.sid || '' };
    }

    // 识别结果
    if (msgType === 'result' || obj.action === 'result') {
      const dataObj = obj.data || {};
      const st = dataObj.cn?.st;
      if (!st) return {};

      const isFinal = String(st.type) === '0';
      const segId = dataObj.seg_id;
      const isLast = dataObj.ls === true;

      let text = '';
      const rtArr = st.rt || [];
      for (const rt of rtArr) {
        const wsArr = rt.ws || [];
        for (const ws of wsArr) {
          const cwArr = ws.cw || [];
          for (const cw of cwArr) {
            text += cw.w || '';
          }
        }
      }

      return { text, isFinal, segId, isLast };
    }

    return {};
  } catch (e) {
    return {};
  }
}

/**
 * 核心转写函数
 * @param {string} audioFilePath - 音频文件路径 (mp3/aac/wav 等)
 * @param {object} [options]
 * @param {number} [options.timeout=30000] - 总超时毫秒
 * @returns {Promise<{ success: boolean, text?: string, error?: string }>}
 */
async function transcribeAudio(audioFilePath, options = {}) {
  const { appId, apiKey, apiSecret } = XFYUN_CONFIG;
  if (!appId || !apiKey || !apiSecret) {
    return { success: false, error: '讯飞语音配置缺失，请检查 .env 中 XFYUN_APP_ID / XFYUN_API_KEY / XFYUN_API_SECRET' };
  }

  // 1. 转码为 PCM
  let pcmBuffer;
  try {
    pcmBuffer = await convertToPcm(audioFilePath);
  } catch (err) {
    console.error('音频转码失败:', err.message);
    return { success: false, error: `音频转码失败: ${err.message}` };
  }

  if (!pcmBuffer || pcmBuffer.length === 0) {
    return { success: false, error: '音频转码后为空，请检查音频文件' };
  }

  console.log(`[STT] PCM 大小: ${pcmBuffer.length} bytes (${(pcmBuffer.length / 32000).toFixed(1)}s)`);

  // 2. 建立 WebSocket 连接并转写
  const timeout = options.timeout || 30000;

  return new Promise((resolve) => {
    let resolved = false;
    const finish = (result) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      try { ws.close(); } catch (_) {}
      resolve(result);
    };

    // 超时保护
    const timer = setTimeout(() => {
      finish({ success: false, error: '语音识别超时' });
    }, timeout);

    // 收集结果：用 Map<segId, text> 保存每个 segment 的最终文本
    const segments = new Map();
    let wsOpened = false;

    const wsUrl = buildWsUrl();
    const ws = new WebSocket(wsUrl);

    ws.on('open', () => {
      wsOpened = true;
      console.log('[STT] WebSocket 连接成功，开始发送音频...');
      streamPcm(ws, pcmBuffer).then(() => {
        // 音频发完，发送结束标识
        try {
          ws.send(JSON.stringify({ end: true }));
          console.log('[STT] 音频发送完毕，等待识别结果...');
        } catch (_) {}
      });
    });

    ws.on('message', (data) => {
      const msg = data.toString();
      const parsed = extractText(msg);

      if (parsed.error) {
        console.error('[STT] 讯飞返回错误:', parsed.code, parsed.message);
        finish({ success: false, error: `讯飞识别错误(${parsed.code}): ${parsed.message}` });
        return;
      }

      if (parsed.started) {
        console.log('[STT] 会话已启动, sid:', parsed.sid);
        return;
      }

      if (parsed.text !== undefined && parsed.isFinal) {
        segments.set(parsed.segId, (segments.get(parsed.segId) || '') + parsed.text);
      }

      // 最后一帧
      if (parsed.isLast) {
        const rawText = Array.from(segments.entries())
          .sort(([a], [b]) => a - b)
          .map(([, t]) => t)
          .join('')
          .trim();

        const cleanText = stripPunctuation(rawText);
        console.log('[STT] 识别完成:', rawText || '(无语音内容)', cleanText ? `-> "${cleanText}"` : '');
        finish({ success: true, text: cleanText });
      }
    });

    ws.on('error', (err) => {
      console.error('[STT] WebSocket 错误:', err.message);
      finish({ success: false, error: `WebSocket连接失败: ${err.message}` });
    });

    ws.on('close', (code, reason) => {
      console.log(`[STT] WebSocket 关闭, code=${code}, reason=${reason || ''}`);
      if (!resolved) {
        // 连接关闭但没收到 isLast，把已有结果返回
        const rawText = Array.from(segments.entries())
          .sort(([a], [b]) => a - b)
          .map(([, t]) => t)
          .join('')
          .trim();
        const cleanText = stripPunctuation(rawText);

        if (cleanText) {
          finish({ success: true, text: cleanText });
        } else if (code === 1000) {
          // 正常关闭但无识别结果 → 无语音内容
          finish({ success: true, text: '' });
        } else {
          finish({ success: false, error: `WebSocket 意外关闭 (code=${code})` });
        }
      }
    });
  });
}

/**
 * 按讯飞要求的节奏发送 PCM 数据
 * 每次 1280 bytes，间隔 40ms
 */
function streamPcm(ws, pcmBuffer) {
  return new Promise((resolve) => {
    const CHUNK_SIZE = 1280;
    let offset = 0;

    const sendNext = () => {
      if (offset >= pcmBuffer.length || ws.readyState !== WebSocket.OPEN) {
        resolve();
        return;
      }

      const end = Math.min(offset + CHUNK_SIZE, pcmBuffer.length);
      const chunk = pcmBuffer.slice(offset, end);
      try {
        ws.send(chunk);
      } catch (_) {
        resolve();
        return;
      }
      offset = end;

      setTimeout(sendNext, 40);
    };

    sendNext();
  });
}

module.exports = {
  transcribeAudio,
  XFYUN_CONFIG
};
