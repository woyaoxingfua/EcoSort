const extractUploadPath = (rawValue) => {
  if (typeof rawValue !== 'string') return '';

  const normalized = rawValue
    .split('?')[0]
    .split('#')[0]
    .replace(/\\/g, '/');

  if (normalized.startsWith('/api/uploads/')) {
    return normalized.replace(/^\/api/, '');
  }
  if (normalized.startsWith('/uploads/')) {
    return normalized;
  }

  const markerIndex = normalized.indexOf('/uploads/');
  if (markerIndex >= 0) {
    return normalized.slice(markerIndex);
  }

  if (normalized.startsWith('uploads/')) {
    return `/${normalized}`;
  }

  return '';
};

const normalizeAvatarForStorage = (rawUrl) => {
  if (typeof rawUrl !== 'string') return '';

  const trimmed = rawUrl.trim();
  if (!trimmed || /^wxfile:\/\//i.test(trimmed)) {
    return '';
  }

  const localUploadPath = extractUploadPath(trimmed);
  if (localUploadPath) {
    return localUploadPath;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      const parsedUploadPath = extractUploadPath(parsed.pathname || '');
      return parsedUploadPath || trimmed;
    } catch (error) {
      return trimmed;
    }
  }

  return trimmed;
};

const resolveAvatarForResponse = (req, rawUrl) => {
  const normalized = normalizeAvatarForStorage(rawUrl);
  if (!normalized) return '';

  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  if (normalized.startsWith('/uploads/')) {
    const host = req?.get?.('host');
    if (!host) {
      return normalized;
    }
    const protocol = req?.protocol || 'http';
    return `${protocol}://${host}${normalized}`;
  }

  return normalized;
};

module.exports = {
  normalizeAvatarForStorage,
  resolveAvatarForResponse
};
