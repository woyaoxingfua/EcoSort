const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Shanghai';

const toPositiveInt = (value, defaultValue = null) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultValue;
  }
  return parsed;
};

const toNonNegativeInt = (value, defaultValue = 0) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return defaultValue;
  }
  return parsed;
};

const toFloat = (value, defaultValue = null) => {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return defaultValue;
  }
  return parsed;
};

const getLocalDateString = (date = new Date(), timeZone = APP_TIMEZONE) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);

  const values = parts.reduce((acc, item) => {
    if (item.type !== 'literal') {
      acc[item.type] = item.value;
    }
    return acc;
  }, {});

  return `${values.year}-${values.month}-${values.day}`;
};

const parseJsonField = (value, fallbackValue) => {
  if (value === null || value === undefined || value === '') {
    return fallbackValue;
  }
  if (typeof value === 'object') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallbackValue;
  }
};

module.exports = {
  APP_TIMEZONE,
  toPositiveInt,
  toNonNegativeInt,
  toFloat,
  getLocalDateString,
  parseJsonField
};
