const oracledb = require('oracledb');
const { execute } = require('../db/query');

const LEVELS = [
  { value: 0, code: 'MINIMAL', label: '0 - Mínimo: arranque/parada y errores críticos' },
  { value: 1, code: 'SECURITY', label: '1 - Seguridad: login/logout, reset, sesión' },
  { value: 2, code: 'BUSINESS', label: '2 - Negocio: operaciones funcionales relevantes' },
  { value: 3, code: 'TECHNICAL', label: '3 - Técnico: requests, validaciones y servicios' },
  { value: 4, code: 'DEBUG', label: '4 - Debug: entrada/salida de módulos y repositorios' },
  { value: 5, code: 'TRACE', label: '5 - Trace: detalle completo de desarrollo' }
];

function levelName(levelNumber) {
  const level = LEVELS.find(item => item.value === Number(levelNumber));
  return level ? level.code : 'UNKNOWN';
}

function safeJson(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); } catch (error) { return JSON.stringify({ serializationError: true, message: error.message }); }
}

function parseJson(value) {
  if (!value) return null;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return value; }
}

function normalizeDate(value, endOfDay = false) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value} ${endOfDay ? '23:59:59' : '00:00:00'}`;
  return String(value).replace('T', ' ').substring(0, 19);
}

function mapLog(row) {
  return {
    logId: row.LOG_ID,
    eventTime: row.EVENT_TIME,
    levelNumber: row.LEVEL_NUMBER,
    levelName: row.LEVEL_NAME,
    source: row.SOURCE,
    eventCode: row.EVENT_CODE,
    message: row.MESSAGE,
    details: parseJson(row.DETAILS),
    username: row.USERNAME,
    requestId: row.REQUEST_ID,
    ipAddress: row.IP_ADDRESS,
    userAgent: row.USER_AGENT,
    createdAt: row.CREATED_AT
  };
}

async function getLogLevel() {
  const result = await execute(
    `SELECT CONFIG_VALUE
       FROM OPERA_CFG_APP_LOG_CONFIG
      WHERE CONFIG_KEY = 'LOG_LEVEL'`
  );
  const value = result.rows[0]?.CONFIG_VALUE;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.min(5, numeric)) : 1;
}

async function setLogLevel(levelNumber, updatedBy) {
  const safeLevel = Math.max(0, Math.min(5, Number(levelNumber)));
  await execute(
    `MERGE INTO OPERA_CFG_APP_LOG_CONFIG cfg
      USING (SELECT 'LOG_LEVEL' AS config_key, :configValue AS config_value FROM dual) src
      ON (cfg.CONFIG_KEY = src.config_key)
      WHEN MATCHED THEN UPDATE SET
        CONFIG_VALUE = src.config_value,
        UPDATED_AT = SYSTIMESTAMP,
        UPDATED_BY = :updatedBy
      WHEN NOT MATCHED THEN INSERT (CONFIG_KEY, CONFIG_VALUE, UPDATED_BY)
        VALUES (src.config_key, src.config_value, :updatedBy)`,
    { configValue: String(safeLevel), updatedBy: updatedBy || 'system' },
    { autoCommit: true }
  );
  return safeLevel;
}

async function insertLog(entry) {
  const levelNumber = Math.max(0, Math.min(5, Number(entry.levelNumber ?? 2)));
  const result = await execute(
    `INSERT INTO OPERA_CFG_APP_LOGS (
       LEVEL_NUMBER,
       LEVEL_NAME,
       SOURCE,
       EVENT_CODE,
       MESSAGE,
       DETAILS,
       USERNAME,
       REQUEST_ID,
       IP_ADDRESS,
       USER_AGENT
     ) VALUES (
       :levelNumber,
       :levelName,
       :source,
       :eventCode,
       :message,
       :details,
       :username,
       :requestId,
       :ipAddress,
       :userAgent
     ) RETURNING LOG_ID INTO :logId`,
    {
      levelNumber,
      levelName: entry.levelName || levelName(levelNumber),
      source: entry.source || null,
      eventCode: entry.eventCode || null,
      message: entry.message || null,
      details: safeJson(entry.details),
      username: entry.username || null,
      requestId: entry.requestId || null,
      ipAddress: entry.ipAddress || null,
      userAgent: entry.userAgent || null,
      logId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
    },
    { autoCommit: true }
  );
  return result.outBinds.logId[0];
}

function addWhere(where, binds, condition, bindName, value) {
  if (value !== undefined && value !== null && String(value).trim() !== '') {
    where.push(condition);
    binds[bindName] = value;
  }
}

async function findLogs(filters = {}) {
  const where = ['1 = 1'];
  const binds = {
    offsetRows: Number(filters.offset || 0),
    limitRows: Math.min(Number(filters.limit || 200), 1000)
  };

  addWhere(where, binds, 'EVENT_TIME >= TO_TIMESTAMP(:fromDate, \'YYYY-MM-DD HH24:MI:SS\')', 'fromDate', normalizeDate(filters.fromDate));
  addWhere(where, binds, 'EVENT_TIME <= TO_TIMESTAMP(:toDate, \'YYYY-MM-DD HH24:MI:SS\')', 'toDate', normalizeDate(filters.toDate, true));
  addWhere(where, binds, 'LEVEL_NUMBER = :levelNumber', 'levelNumber', filters.levelNumber);
  addWhere(where, binds, 'UPPER(SOURCE) LIKE UPPER(:source)', 'source', filters.source ? `%${filters.source}%` : null);
  addWhere(where, binds, 'UPPER(EVENT_CODE) LIKE UPPER(:eventCode)', 'eventCode', filters.eventCode ? `%${filters.eventCode}%` : null);
  addWhere(where, binds, 'UPPER(USERNAME) LIKE UPPER(:username)', 'username', filters.username ? `%${filters.username}%` : null);

  if (filters.q && String(filters.q).trim()) {
    where.push(`(
      UPPER(SOURCE) LIKE UPPER(:q)
      OR UPPER(EVENT_CODE) LIKE UPPER(:q)
      OR UPPER(MESSAGE) LIKE UPPER(:q)
      OR UPPER(USERNAME) LIKE UPPER(:q)
    )`);
    binds.q = `%${filters.q}%`;
  }

  const result = await execute(
    `SELECT
       LOG_ID,
       TO_CHAR(EVENT_TIME, 'YYYY-MM-DD HH24:MI:SS') AS EVENT_TIME,
       LEVEL_NUMBER,
       LEVEL_NAME,
       SOURCE,
       EVENT_CODE,
       MESSAGE,
       DBMS_LOB.SUBSTR(DETAILS, 4000, 1) AS DETAILS,
       USERNAME,
       REQUEST_ID,
       IP_ADDRESS,
       USER_AGENT,
       TO_CHAR(CREATED_AT, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_AT
     FROM OPERA_CFG_APP_LOGS
     WHERE ${where.join(' AND ')}
     ORDER BY EVENT_TIME DESC, LOG_ID DESC
     OFFSET :offsetRows ROWS FETCH NEXT :limitRows ROWS ONLY`,
    binds
  );
  return result.rows.map(mapLog);
}

module.exports = { LEVELS, levelName, getLogLevel, setLogLevel, insertLog, findLogs };
