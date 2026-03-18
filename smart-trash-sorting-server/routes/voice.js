const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { transcribeAudio } = require('../services/speechToText');

const router = express.Router();

// 音频上传临时目录
const audioTmpDir = path.join(__dirname, '..', 'uploads', 'audio_tmp');
fs.mkdirSync(audioTmpDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, audioTmpDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.mp3';
    const name = `stt_${Date.now()}_${Math.random().toString(16).slice(2, 8)}${ext}`;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = /^audio\//;
    // 微信小程序上传时 mimetype 可能不准确，放宽限制
    if (file.mimetype && allowed.test(file.mimetype)) {
      return cb(null, true);
    }
    // 按扩展名兜底
    const ext = path.extname(file.originalname || '').toLowerCase();
    const audioExts = ['.mp3', '.aac', '.wav', '.pcm', '.m4a', '.ogg', '.silk'];
    if (audioExts.includes(ext)) {
      return cb(null, true);
    }
    // 微信上传的文件可能没有正确的mimetype，也放行
    cb(null, true);
  }
});

/** 清理临时文件 */
function cleanupFile(filePath) {
  if (!filePath) return;
  try {
    fs.unlinkSync(filePath);
  } catch (e) {
    // ignore
  }
}

/**
 * POST /api/voice/recognize
 * 接收音频文件，调用讯飞 STT 转写，返回文字
 *
 * 请求: multipart/form-data, field name = "audio"
 * 响应: { success, data: { text }, error? }
 */
router.post('/recognize', upload.single('audio'), async (req, res) => {
  const filePath = req.file ? req.file.path : null;

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '未收到音频文件' });
    }

    console.log(`[Voice] 收到音频: ${req.file.originalname}, 大小: ${req.file.size} bytes`);

    const result = await transcribeAudio(filePath, { timeout: 30000 });

    // 清理临时文件
    cleanupFile(filePath);

    if (result.success) {
      res.json({
        success: true,
        data: { text: result.text || '' }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || '语音识别失败'
      });
    }
  } catch (error) {
    cleanupFile(filePath);
    console.error('[Voice] 语音识别异常:', error);
    res.status(500).json({ success: false, error: '语音识别服务异常' });
  }
});

module.exports = router;
