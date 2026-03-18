const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const { uploadToS3IfEnabled } = require('../utils/s3');

const router = express.Router();

const uploadRoot = path.join(__dirname, '..', 'uploads', 'avatars');
fs.mkdirSync(uploadRoot, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadRoot);
  },
  filename: (req, file, cb) => {
    const extRaw = path.extname(file.originalname || '').toLowerCase();
    const ext = ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(extRaw) ? extRaw : '.jpg';
    const name = `${Date.now()}_${Math.random().toString(16).slice(2, 10)}${ext}`;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('INVALID_FILE_TYPE'));
    }
    cb(null, true);
  }
});

router.post('/avatar', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '未找到上传文件' });
    }

    const localPath = `/uploads/avatars/${req.file.filename}`;
    const localPreviewUrl = `${req.protocol}://${req.get('host')}${localPath}`;
    const s3Url = await uploadToS3IfEnabled(req.file.path, req.file.filename, req.file.mimetype);
    const url = s3Url || localPath;
    const previewUrl = s3Url || localPreviewUrl;

    // 如果已上传到S3，删除本地文件
    if (s3Url) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {
        console.warn('清理本地临时文件失败:', err.message);
      }
    }

    res.json({ success: true, data: { url, previewUrl } });
  } catch (error) {
    console.error('头像上传失败:', error);
    res.status(500).json({ error: '头像上传失败' });
  }
});

module.exports = router;
