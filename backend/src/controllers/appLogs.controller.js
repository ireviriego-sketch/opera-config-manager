const appLogsRepository = require('../repositories/appLogs.repository');
const appLogger = require('../utils/appLogger');
const { currentUser } = require('../utils/requestUser');


async function listLogs(req, res, next) {
  try {
    const items = await appLogsRepository.findLogs({
      q: req.query.q,
      levelNumber: req.query.levelNumber,
      source: req.query.source,
      eventCode: req.query.eventCode,
      username: req.query.username,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      limit: req.query.limit,
      offset: req.query.offset
    });
    res.json({ items });
  } catch (error) {
    next(error);
  }
}

async function getConfig(req, res, next) {
  try {
    const level = await appLogsRepository.getLogLevel();
    res.json({ level, levels: appLogsRepository.LEVELS });
  } catch (error) {
    next(error);
  }
}

async function updateConfig(req, res, next) {
  try {
    const level = await appLogsRepository.setLogLevel(req.body.level, currentUser(req));
    appLogger.invalidateLevelCache();
    await appLogger.security('LOGS', 'LOG_LEVEL_UPDATED', `Nivel de logs actualizado a ${level}`, { level }, req);
    res.json({ ok: true, level, levels: appLogsRepository.LEVELS });
  } catch (error) {
    next(error);
  }
}

async function createTestLog(req, res, next) {
  try {
    const levelNumber = Number(req.body.levelNumber ?? 2);
    const logId = await appLogger.log({
      levelNumber,
      source: req.body.source || 'LOGS_UI',
      eventCode: req.body.eventCode || 'TEST_LOG',
      message: req.body.message || `Mensaje de prueba nivel ${levelNumber}`,
      details: req.body.details || { createdFrom: 'admin-logs.html' }
    }, req);
    res.status(201).json({ ok: true, logId });
  } catch (error) {
    next(error);
  }
}

module.exports = { listLogs, getConfig, updateConfig, createTestLog };
