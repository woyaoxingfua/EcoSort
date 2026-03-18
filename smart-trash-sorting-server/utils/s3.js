const fs = require('fs');

const isEnabled = () => {
  return String(process.env.S3_ENABLED || '').toLowerCase() === 'true';
};

async function uploadToS3IfEnabled(filePath, fileName, mimeType) {
  if (!isEnabled()) return null;

  const endpoint = process.env.S3_ENDPOINT;
  const accessKey = process.env.S3_ACCESS_KEY;
  const secretKey = process.env.S3_SECRET_KEY;
  const bucket = process.env.S3_BUCKET;
  const publicUrl = process.env.S3_PUBLIC_URL;
  const region = process.env.S3_REGION || 'auto';

  if (!endpoint || !accessKey || !secretKey || !bucket) {
    throw new Error('S3_NOT_CONFIGURED');
  }

  let AWS;
  try {
    AWS = require('aws-sdk');
  } catch (err) {
    throw new Error('S3_SDK_NOT_INSTALLED');
  }

  const s3 = new AWS.S3({
    endpoint,
    accessKeyId: accessKey,
    secretAccessKey: secretKey,
    s3ForcePathStyle: true,
    signatureVersion: 'v4',
    region
  });

  const key = `avatars/${fileName}`;
  const body = fs.createReadStream(filePath);

  await s3.upload({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: mimeType,
    ACL: 'public-read'
  }).promise();

  const base = publicUrl || `${endpoint.replace(/\/$/, '')}/${bucket}`;
  return `${base.replace(/\/$/, '')}/${key}`;
}

module.exports = { uploadToS3IfEnabled };
