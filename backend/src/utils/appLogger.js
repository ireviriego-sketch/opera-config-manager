const appLogsRepository = require('../repositories/appLogs.repository');

let cachedLevel = 1;
let cacheExpiresAt = 0;
let consoleFilterInstalled = false;
let refreshTimer = null;
const CACHE_MS = 15000;

const originalConsole = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: console.debug ? console.debug.bind(console) : console.log.bind(console),
  trace: console.trace ? console.trace.bind(console) : console.log.bind(console)
};

async function getCurrentLevel(force = false) {
  const now = Date.now();
  if (!force && cachedLevel !== null && now < cacheExpiresAt) return cachedLevel;
  try {
    cachedLevel = await appLogsRepository.getLogLevel();
    cacheExpiresAt = now + CACHE_MS;
  } catch (error) {
    originalConsole.warn('[LOGS] Could not read LOG_LEVEL. Using cached/default level.', error.message);
    if (cachedLevel === null || cachedLevel === undefined) cachedLevel = 1;
  }
  return cachedLevel;
}

function getCachedLevel() {
  return Number.isFinite(Number(cachedLevel)) ? Number(cachedLevel) : 1;
}

function shouldPrintConsole(method) {
  const level = getCachedLevel();

  if (method === 'error') return true;
  if (method === 'warn') return level >= 1;
  if (method === 'info') return level >= 2;
  if (method === 'log') return level >= 4;
  if (method === 'debug') return level >= 4;
  if (method === 'trace') return level >= 5;
  return level >= 4;
}

function installConsoleFilter() {
  if (consoleFilterInstalled) return;
  consoleFilterInstalled = true;

  console.error = (...args) => {
    if (shouldPrintConsole('error')) originalConsole.error(...args);
  };

  console.warn = (...args) => {
    if (shouldPrintConsole('warn')) originalConsole.warn(...args);
  };

  console.info = (...args) => {
    if (shouldPrintConsole('info')) originalConsole.info(...args);
  };

  console.log = (...args) => {
    if (shouldPrintConsole('log')) originalConsole.log(...args);
  };

  console.debug = (...args) => {
    if (shouldPrintConsole('debug')) originalConsole.debug(...args);
  };

  console.trace = (...args) => {
    if (shouldPrintConsole('trace')) originalConsole.trace(...args);
  };
}

async function startConsoleControl() {
  await getCurrentLevel(true);
  installConsoleFilter();

  if (!refreshTimer) {
    refreshTimer = setInterval(() => {
      getCurrentLevel(true).catch(error => {
        originalConsole.warn('[LOGS] Failed to refresh LOG_LEVEL.', error.message);
      });
    }, CACHE_MS);

    if (typeof refreshTimer.unref === 'function') refreshTimer.unref();
  }
}

function stopConsoleControl() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

function requestMetadata(req) {
  if (!req) return {};
  return {
    username: req.user?.username || req.user?.USERNAME || req.user?.email || req.headers?.['x-user'] || req.headers?.['x-username'] || null,
    requestId: req.headers?.['x-request-id'] || null,
    ipAddress: req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || null,
    userAgent: req.headers?.['user-agent'] || null
  };
}

function consoleMethod(levelNumber) {
  if (levelNumber <= 0) return 'error';
  if (levelNumber === 1) return 'warn';
  if (levelNumber === 2) return 'info';
  return 'log';
}

function writeOriginalConsole(levelNumber, payload) {
  const method = consoleMethod(levelNumber);
  const prefix = `[${appLogsRepository.levelName(levelNumber)}] ${payload.source || 'APP'} ${payload.eventCode || ''}`.trim();
  originalConsole[method](prefix, payload.message || '', payload.details || '');
}

async function log(entry = {}, req = null) {
  const levelNumber = Math.max(0, Math.min(5, Number(entry.levelNumber ?? 2)));
  const currentLevel = await getCurrentLevel();

  if (levelNumber > currentLevel) return null;

  const metadata = requestMetadata(req);
  const payload = {
    ...metadata,
    ...entry,
    levelNumber
  };

  writeOriginalConsole(levelNumber, payload);
  return appLogsRepository.insertLog(payload);
}

async function minimal(source, eventCode, message, details, req) {
  return log({ levelNumber: 0, source, eventCode, message, details }, req);
}

async function security(source, eventCode, message, details, req) {
  return log({ levelNumber: 1, source, eventCode, message, details }, req);
}

async function business(source, eventCode, message, details, req) {
  return log({ levelNumber: 2, source, eventCode, message, details }, req);
}

async function technical(source, eventCode, message, details, req) {
  return log({ levelNumber: 3, source, eventCode, message, details }, req);
}

async function debug(source, eventCode, message, details, req) {
  return log({ levelNumber: 4, source, eventCode, message, details }, req);
}

async function trace(source, eventCode, message, details, req) {
  return log({ levelNumber: 5, source, eventCode, message, details }, req);
}

function invalidateLevelCache() {
  cachedLevel = null;
  cacheExpiresAt = 0;
}

function shouldSkipMorgan() {
  return getCachedLevel() < 3;
}

function original() {
  return originalConsole;
}

module.exports = {
  log,
  minimal,
  security,
  business,
  technical,
  debug,
  trace,
  getCurrentLevel,
  getCachedLevel,
  invalidateLevelCache,
  startConsoleControl,
  stopConsoleControl,
  installConsoleFilter,
  shouldSkipMorgan,
  original,
  levels: appLogsRepository.LEVELS
};
