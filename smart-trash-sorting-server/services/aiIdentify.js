const axios = require('axios');
const { query } = require('../config/database');

const parsePositiveInt = (rawValue, fallback) => {
  const parsed = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseModelList = (rawValue = '') => {
  if (typeof rawValue !== 'string') return [];
  return rawValue
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const uniqueStrings = (values = []) => {
  const normalized = values
    .map((item) => String(item || '').trim())
    .filter(Boolean);
  return [...new Set(normalized)];
};

const DEFAULT_VISION_MODELS = [
  'Qwen/Qwen2.5-VL-7B-Instruct',
  'Qwen/Qwen2-VL-7B-Instruct'
];

const AI_CONFIG = {
  apiUrl: process.env.SILICONFLOW_API_URL || 'https://api.siliconflow.cn/v1',
  apiKey: process.env.SILICONFLOW_API_KEY || '',
  model: process.env.SILICONFLOW_MODEL || '',
  fallbackModels: parseModelList(process.env.SILICONFLOW_FALLBACK_MODELS || '')
};

const AI_TIMEOUT = parsePositiveInt(process.env.SILICONFLOW_TIMEOUT_MS || '90000', 90000);
const AI_RETRY_TIMEOUT = parsePositiveInt(process.env.SILICONFLOW_RETRY_TIMEOUT_MS || '120000', 120000);

const getModelCandidates = () => {
  const configuredModels = parseModelList(AI_CONFIG.model);
  if (configuredModels.length === 0) {
    return uniqueStrings([...DEFAULT_VISION_MODELS, ...AI_CONFIG.fallbackModels]);
  }
  return uniqueStrings([...configuredModels, ...AI_CONFIG.fallbackModels, ...DEFAULT_VISION_MODELS]);
};

const buildError = (code, error, details = null) => ({
  success: false,
  code,
  error,
  details
});

const normalizeJsonLikeString = (value = '') => {
  if (typeof value !== 'string') return '';
  let text = value.trim();
  if (!text) return '';

  text = text.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  if (!text.includes('"') && text.includes("'")) {
    text = text.replace(/'([^']*)'/g, '"$1"');
  }
  text = text.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
  return text;
};

const extractTrashNameFromText = (rawText = '', trashList = []) => {
  if (!rawText || !Array.isArray(trashList) || trashList.length == 0) return '';
  const text = String(rawText);
  const sorted = [...trashList].sort((a, b) => b.length - a.length);
  for (const name of sorted) {
    if (name && text.includes(name)) return name;
  }
  return '';
};



const shouldRetryWithoutJsonMode = (error) => {
  const data = error?.response?.data || {};
  const message = String(data.message || data.error || error?.message || '').toLowerCase();
  return message.includes('response_format') || message.includes('json') || message.includes('format') || message.includes('unsupported');
};

const isTimeoutError = (error, apiMessage = '') => {
  const code = String(error?.code || '').toLowerCase();
  const message = String(apiMessage || error?.message || '').toLowerCase();
  return code == 'econnaborted' || code == 'etimedout' || message.includes('timeout');
};

const isRetryableStatus = (status) => {
  const value = Number.parseInt(status, 10);
  return [408, 409, 425, 429, 500, 502, 503, 504].includes(value);
};

const isRetryableMessage = (message = '') => {
  const text = String(message || '').toLowerCase();
  return text.includes('rate limit')
    || text.includes('too many requests')
    || text.includes('temporarily unavailable')
    || text.includes('overloaded')
    || text.includes('busy')
    || text.includes('timeout')
    || text.includes('unsupported')
    || text.includes('not support')
    || text.includes('vision model')
    || text.includes('image_url');
};

const shouldTryNextModel = (status, apiMessage, timeoutHit) => {
  if (timeoutHit) return true;
  if (isRetryableStatus(status)) return true;
  return isRetryableMessage(apiMessage);
};

const buildAiPayload = (model, systemPrompt, userPrompt, imageUrl, useJsonMode) => {
  const payload = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: userPrompt },
          { type: 'image_url', image_url: { url: imageUrl } }
        ]
      }
    ],
    temperature: 0.2,
    max_tokens: 200
  };

  if (useJsonMode) {
    payload.response_format = { type: 'json_object' };
  }
  return payload;
};

const requestAiChatCompletion = ({ model, systemPrompt, userPrompt, imageUrl, useJsonMode, timeout }) => {
  const payload = buildAiPayload(model, systemPrompt, userPrompt, imageUrl, useJsonMode);
  return axios.post(
    `${AI_CONFIG.apiUrl}/chat/completions`,
    payload,
    {
      timeout,
      headers: {
        Authorization: `Bearer ${AI_CONFIG.apiKey}`,
        'Content-Type': 'application/json'
      }
    }
  );
};

const normalizeParsedResult = (parsed) => {
  if (!parsed || typeof parsed != 'object') return null;
  if (parsed.trashName) return parsed;
  if (parsed.trash_name) return { ...parsed, trashName: parsed.trash_name };
  if (parsed.name) return { ...parsed, trashName: parsed.name };
  if (parsed.item) return { ...parsed, trashName: parsed.item };
  if (parsed.result && parsed.result.trashName) return { ...parsed.result };
  if (parsed.data && parsed.data.trashName) return { ...parsed.data };
  return parsed;
};


const safeDecode = (value = '') => {
  try {
    return decodeURIComponent(value);
  } catch (error) {
    return value;
  }
};

const isPrivateIpv4 = (host = '') => {
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(host)) return false;
  const parts = host.split('.').map((value) => Number(value));
  if (parts.some((value) => Number.isNaN(value))) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
};

const isPrivateHostname = (host = '') => {
  if (!host) return false;
  const value = host.toLowerCase();
  if (value === 'localhost') return true;
  if (value.endsWith('.local') || value.endsWith('.lan') || value.endsWith('.home')) return true;
  if (isPrivateIpv4(value)) return true;
  if (value === '::1') return true;
  if (value.startsWith('fe80:')) return true;
  if (value.startsWith('fc') || value.startsWith('fd')) return true;
  return false;
};

const isLikelyLocalOnlyImage = (imageUrl = '') => {
  const value = String(imageUrl || '').trim();
  if (!value) return true;
  if (/^data:image\//i.test(value)) return false;
  if (/^wxfile:\/\//i.test(value)) return true;
  if (/^file:\/\//i.test(value)) return true;
  if (/^[a-zA-Z]:\\/.test(value)) return true;
  if (/^\/(?!\/)/.test(value)) return true;
  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      if (/^\/__tmp__\//i.test(parsed.pathname || '')) return true;
      if (isPrivateHostname(parsed.hostname)) return true;
    } catch (error) {
      return true;
    }
  }
  return false;
};

const describeImage = (imageUrl = '') => {
  const value = String(imageUrl || '').trim();
  if (!value) return { kind: 'empty' };
  if (/^data:image\//i.test(value)) {
    const commaIndex = value.indexOf(',');
    const mimeMatch = value.match(/^data:(image\/[a-z0-9.+-]+);base64,/i);
    const base64 = commaIndex >= 0 ? value.slice(commaIndex + 1) : '';
    const bytes = Math.floor(base64.length * 0.75);
    return {
      kind: 'data',
      mime: mimeMatch ? mimeMatch[1] : 'image/*',
      bytes
    };
  }
  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      return {
        kind: 'url',
        host: parsed.hostname,
        path: (parsed.pathname || '').slice(0, 120)
      };
    } catch (error) {
      return { kind: 'url', host: 'invalid' };
    }
  }
  return { kind: 'unknown', value: value.slice(0, 120) };
};

const parseModelJson = (rawText = '', trashList = []) => {
  if (typeof rawText !== 'string' || !rawText.trim()) return null;

  const fencedMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fencedMatch ? fencedMatch[1] : rawText;
  const jsonMatch = candidate.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    const guessed = extractTrashNameFromText(candidate, trashList);
    return guessed ? { trashName: guessed } : null;
  }

  const rawJson = jsonMatch[0];
  try {
    const parsed = JSON.parse(rawJson);
    return normalizeParsedResult(parsed);
  } catch (error) {
    const normalized = normalizeJsonLikeString(rawJson);
    if (normalized) {
      try {
        const parsed = JSON.parse(normalized);
        return normalizeParsedResult(parsed);
      } catch (err) {
        // ignore
      }
    }
  }

  const guessed = extractTrashNameFromText(candidate, trashList);
  return guessed ? { trashName: guessed } : null;
};

async function loadTrashNameList() {
  const rows = await query('SELECT name FROM trash_categories ORDER BY id');
  return rows
    .map((item) => String(item.name || '').trim())
    .filter(Boolean);
}

async function identifyWithAI(imageUrl, validTrashNames = []) {
  const normalizedImageUrl = String(imageUrl || '').trim();
  if (!normalizedImageUrl) {
    return buildError('EMPTY_IMAGE_URL', '图片URL不能为空');
  }

  if (!AI_CONFIG.apiKey) {
    return buildError('AI_KEY_MISSING', 'AI服务未配置密钥');
  }

  if (isLikelyLocalOnlyImage(normalizedImageUrl)) {
    return buildError('LOCAL_IMAGE_URL', '本地临时图片地址无法被云端AI访问');
  }

  const imageMeta = describeImage(normalizedImageUrl);

  const trashList = Array.isArray(validTrashNames) && validTrashNames.length > 0
    ? validTrashNames
    : await loadTrashNameList();

  if (trashList.length === 0) {
    return buildError('TRASH_LIST_EMPTY', '垃圾分类数据为空');
  }

  const systemPrompt = `你是垃圾分类识别助手。\n请仅从以下垃圾名称中选择最匹配的一项返回：\n${trashList
    .map((name) => `- ${name}`)
    .join('\n')}\n\n严格只输出 JSON，不要包含多余文字或 Markdown。\n格式：{\"trashName\":\"名称或null\",\"confidence\":0-100,\"tips\":\"一句简短投放提示\"}\n示例：{\"trashName\":\"塑料瓶\",\"confidence\":92,\"tips\":\"倒空压扁后投放\"}`;

  const userPrompt = '识别图片中的垃圾并返回JSON。';

  const modelCandidates = getModelCandidates();
  if (modelCandidates.length == 0) {
    return buildError('AI_MODEL_MISSING', 'AI服务未配置可用视觉模型');
  }

  let response;
  let lastFailure = null;

  for (let index = 0; index < modelCandidates.length; index += 1) {
    const model = modelCandidates[index];
    const timeout = index == 0 ? AI_TIMEOUT : Math.max(AI_TIMEOUT, AI_RETRY_TIMEOUT);

    try {
      response = await requestAiChatCompletion({
        model,
        systemPrompt,
        userPrompt,
        imageUrl: normalizedImageUrl,
        useJsonMode: true,
        timeout
      });
      lastFailure = null;
      break;
    } catch (error) {
      let finalError = error;
      if (shouldRetryWithoutJsonMode(error)) {
        try {
          response = await requestAiChatCompletion({
            model,
            systemPrompt,
            userPrompt,
            imageUrl: normalizedImageUrl,
            useJsonMode: false,
            timeout
          });
          lastFailure = null;
          break;
        } catch (retryError) {
          finalError = retryError;
        }
      }

      const status = finalError?.response?.status || null;
      const data = finalError?.response?.data || null;
      const apiMessage = (data && (data.message || data.error)) || finalError.message || 'AI请求失败';
      const timeoutHit = isTimeoutError(finalError, apiMessage);

      lastFailure = {
        model,
        status,
        data,
        apiMessage,
        timeoutHit
      };

      if (index < modelCandidates.length - 1 && shouldTryNextModel(status, apiMessage, timeoutHit)) {
        console.warn(`AI模型调用失败，切换重试: ${model}`, {
          code: finalError?.code || null,
          status,
          message: apiMessage
        });
        continue;
      }

      if (timeoutHit) {
        return buildError('AI_TIMEOUT', 'AI请求超时，请稍后重试', {
          status,
          data,
          model,
          timeoutMs: timeout,
          image: imageMeta
        });
      }
      return buildError('AI_REQUEST_FAILED', `AI请求失败: ${apiMessage}`, { status, data, model });
    }
  }

  if (!response) {
    if (lastFailure && lastFailure.timeoutHit) {
      return buildError('AI_TIMEOUT', 'AI请求超时，请稍后重试', {
        status: lastFailure.status,
        data: lastFailure.data,
        model: lastFailure.model,
        timeoutMs: AI_RETRY_TIMEOUT,
        image: imageMeta
      });
    }
    return buildError(
      'AI_REQUEST_FAILED',
      lastFailure ? `AI请求失败: ${lastFailure.apiMessage}` : 'AI请求失败',
      lastFailure
        ? {
            status: lastFailure.status,
            data: lastFailure.data,
            model: lastFailure.model
          }
        : null
    );
  }

  const rawContent = response?.data?.choices?.[0]?.message?.content || '';
  const parsed = parseModelJson(rawContent, trashList);
  if (!parsed || !parsed.trashName) {
    return buildError('AI_PARSE_FAILED', 'AI返回内容无法解析或无匹配项', { raw: rawContent.slice(0, 500) });
  }

  const confidenceRaw = Number(parsed.confidence);
  const confidence = Number.isFinite(confidenceRaw)
    ? Math.max(0, Math.min(100, Math.round(confidenceRaw)))
    : 85;

  let rows = await query('SELECT * FROM trash_categories WHERE name = ? LIMIT 1', [parsed.trashName]);

  if (rows.length === 0) {
    rows = await query(
      'SELECT * FROM trash_categories WHERE name LIKE ? OR examples LIKE ? OR description LIKE ? LIMIT 1',
      [`%${parsed.trashName}%`, `%${parsed.trashName}%`, `%${parsed.trashName}%`]
    );
  }

  if (rows.length === 0) {
    return buildError('AI_NO_MATCH', 'AI识别结果未命中本地分类库');
  }

  return {
    success: true,
    data: {
      ...rows[0],
      confidence,
      aiTips: String(parsed.tips || '').trim()
    }
  };
}

async function fallbackIdentify(imageUrl, imageName) {
  const keyword = extractKeywordFromImage(imageName, imageUrl);

  let results = [];
  if (keyword) {
    results = await query(
      `
      SELECT * FROM trash_categories
      WHERE name LIKE ? OR examples LIKE ? OR description LIKE ?
      ORDER BY search_count DESC, id DESC
      LIMIT 3
      `,
      [`%${keyword}%`, `%${keyword}%`, `%${keyword}%`]
    );
  }

  if (results.length === 0) {
    results = await query(
      `
      SELECT * FROM trash_categories
      ORDER BY search_count DESC, id DESC
      LIMIT 3
      `
    );
  }

  if (results.length === 0) {
    throw new Error('数据库暂无垃圾分类数据');
  }

  return {
    success: true,
    data: results[0],
    alternatives: results.slice(1),
    matchMode: keyword ? 'keyword_fallback' : 'top_rank_fallback'
  };
}

function extractKeywordFromImage(imageName = '', imageUrl = '') {
  const source = `${safeDecode(imageName)} ${safeDecode(imageUrl)}`.toLowerCase();
  if (!source.trim()) return '';

  const ignoreSet = new Set([
    'tmp', 'image', 'images', 'jpeg', 'jpg', 'png', 'gif', 'webp',
    'http', 'https', 'localhost', 'upload', 'uploads', 'wxfile',
    'android', 'iphone', 'camera', 'photo'
  ]);

  const tokens = source
    .split(/[\\/._\-?&=#\s]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => part.length >= 2 && part.length <= 32)
    .filter((part) => /[\u4e00-\u9fa5a-z0-9]/i.test(part))
    .filter((part) => !ignoreSet.has(part));

  return tokens[0] || '';
}

module.exports = {
  identifyWithAI,
  fallbackIdentify,
  extractKeywordFromImage
};



