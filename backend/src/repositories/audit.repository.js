const oracledb = require('oracledb');
const { execute } = require('../db/query');

const KNOWN_COLUMNS = [
  'AUDIT_ID',
  'EVENT_TIME',
  'USER_ID',
  'USERNAME',
  'CREATED_BY',
  'ACTION_CODE',
  'ACTION',
  'RESULT_STATUS',
  'ENTITY_TYPE',
  'OBJECT_TYPE',
  'ENTITY_ID',
  'OBJECT_ID',
  'ENTITY_NAME',
  'OBJECT_NAME',
  'SUMMARY',
  'DESCRIPTION',
  'OLD_VALUES',
  'NEW_VALUES',
  'CHANGE_DIFF',
  'DETAILS',
  'IP_ADDRESS',
  'CLIENT_IP',
  'USER_AGENT'
];

let cachedColumns = null;

async function getColumns() {
  if (cachedColumns) return cachedColumns;

  const result = await execute(`
    SELECT COLUMN_NAME
      FROM USER_TAB_COLUMNS
     WHERE TABLE_NAME = 'OPERA_CFG_AUDIT_LOG'
  `);

  cachedColumns = new Set((result.rows || []).map((row) => row.COLUMN_NAME));
  return cachedColumns;
}

function has(columns, columnName) {
  return columns.has(columnName);
}

function firstAvailable(columns, candidates) {
  return candidates.find((columnName) => has(columns, columnName)) || null;
}

function safeJson(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch (error) {
    return JSON.stringify({ serializationError: true, message: error.message });
  }
}

function parseJson(value) {
  if (!value) return null;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

function addInsertField(columns, insertColumns, bindNames, binds, columnName, bindName, value) {
  if (!has(columns, columnName)) return;
  insertColumns.push(columnName);
  bindNames.push(`:${bindName}`);
  binds[bindName] = value;
}

function selectedColumn(columns, columnName, aliasName) {
  if (!has(columns, columnName)) return null;

  if (['OLD_VALUES', 'NEW_VALUES', 'CHANGE_DIFF', 'DETAILS'].includes(columnName)) {
    return `DBMS_LOB.SUBSTR(${columnName}, 4000, 1) AS ${aliasName}`;
  }

  if (columnName === 'EVENT_TIME') {
    return `TO_CHAR(EVENT_TIME, 'YYYY-MM-DD HH24:MI:SS') AS ${aliasName}`;
  }

  return `${columnName} AS ${aliasName}`;
}

function buildSelect(columns) {
  const pieces = [];

  for (const columnName of KNOWN_COLUMNS) {
    const piece = selectedColumn(columns, columnName, columnName);
    if (piece) pieces.push(piece);
  }

  if (!pieces.length) {
    throw new Error('OPERA_CFG_AUDIT_LOG has no compatible columns for audit listing.');
  }

  return pieces.join(',\n       ');
}

function mapAuditRow(row) {
  return {
    auditId: firstDefined(row.AUDIT_ID),
    eventTime: firstDefined(row.EVENT_TIME),
    userId: row.USER_ID || null,
    username: firstDefined(row.USERNAME, row.CREATED_BY),
    action: firstDefined(row.ACTION_CODE, row.ACTION),
    actionCode: firstDefined(row.ACTION_CODE, row.ACTION),
    resultStatus: firstDefined(row.RESULT_STATUS),
    entityType: firstDefined(row.ENTITY_TYPE, row.OBJECT_TYPE),
    entityId: firstDefined(row.ENTITY_ID, row.OBJECT_ID),
    entityName: firstDefined(row.ENTITY_NAME, row.OBJECT_NAME),
    summary: firstDefined(row.SUMMARY, row.DESCRIPTION),
    oldValues: parseJson(row.OLD_VALUES),
    newValues: parseJson(row.NEW_VALUES),
    changeDiff: parseJson(row.CHANGE_DIFF),
    details: parseJson(row.DETAILS),
    ipAddress: firstDefined(row.IP_ADDRESS, row.CLIENT_IP),
    userAgent: row.USER_AGENT || null
  };
}

function addWhere(where, binds, condition, bindName, value) {
  if (value !== undefined && value !== null && String(value).trim() !== '') {
    where.push(condition);
    binds[bindName] = value;
  }
}

function normalizeDate(value, endOfDay = false) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value} ${endOfDay ? '23:59:59' : '00:00:00'}`;
  }
  return String(value).replace('T', ' ').substring(0, 19);
}

async function insertAuditLog(entry = {}) {
  const columns = await getColumns();
  const insertColumns = [];
  const bindNames = [];
  const binds = {};

  const actionCode = entry.actionCode || entry.action || 'OTHER';
  const entityType = entry.entityType || entry.objectType || 'UNKNOWN';
  const entityId = entry.entityId !== undefined && entry.entityId !== null ? String(entry.entityId) : null;
  const resultStatus = entry.resultStatus || 'SUCCESS';
  const oldValues = safeJson(entry.oldValues);
  const newValues = safeJson(entry.newValues);
  const changeDiff = safeJson(entry.changeDiff);
  const details = safeJson(entry.details || {
    summary: entry.summary || null,
    oldValues: entry.oldValues || null,
    newValues: entry.newValues || null,
    changeDiff: entry.changeDiff || null
  });

  addInsertField(columns, insertColumns, bindNames, binds, 'USER_ID', 'userId', entry.userId || null);
  addInsertField(columns, insertColumns, bindNames, binds, 'USERNAME', 'username', entry.username || null);
  addInsertField(columns, insertColumns, bindNames, binds, 'CREATED_BY', 'createdBy', entry.username || 'system');

  addInsertField(columns, insertColumns, bindNames, binds, 'ACTION_CODE', 'actionCode', actionCode);
  addInsertField(columns, insertColumns, bindNames, binds, 'ACTION', 'action', actionCode);
  addInsertField(columns, insertColumns, bindNames, binds, 'RESULT_STATUS', 'resultStatus', resultStatus);

  addInsertField(columns, insertColumns, bindNames, binds, 'ENTITY_TYPE', 'entityType', entityType);
  addInsertField(columns, insertColumns, bindNames, binds, 'OBJECT_TYPE', 'objectType', entityType);
  addInsertField(columns, insertColumns, bindNames, binds, 'ENTITY_ID', 'entityId', entityId);
  addInsertField(columns, insertColumns, bindNames, binds, 'OBJECT_ID', 'objectId', entityId);
  addInsertField(columns, insertColumns, bindNames, binds, 'ENTITY_NAME', 'entityName', entry.entityName || null);
  addInsertField(columns, insertColumns, bindNames, binds, 'OBJECT_NAME', 'objectName', entry.entityName || null);

  addInsertField(columns, insertColumns, bindNames, binds, 'SUMMARY', 'summary', entry.summary || null);
  addInsertField(columns, insertColumns, bindNames, binds, 'DESCRIPTION', 'description', entry.summary || null);
  addInsertField(columns, insertColumns, bindNames, binds, 'OLD_VALUES', 'oldValues', oldValues);
  addInsertField(columns, insertColumns, bindNames, binds, 'NEW_VALUES', 'newValues', newValues);
  addInsertField(columns, insertColumns, bindNames, binds, 'CHANGE_DIFF', 'changeDiff', changeDiff);
  addInsertField(columns, insertColumns, bindNames, binds, 'DETAILS', 'details', details);

  addInsertField(columns, insertColumns, bindNames, binds, 'IP_ADDRESS', 'ipAddress', entry.ipAddress || null);
  addInsertField(columns, insertColumns, bindNames, binds, 'CLIENT_IP', 'clientIp', entry.ipAddress || null);
  addInsertField(columns, insertColumns, bindNames, binds, 'USER_AGENT', 'userAgent', entry.userAgent || null);

  if (!insertColumns.length) {
    throw new Error('OPERA_CFG_AUDIT_LOG has no compatible columns for audit insert.');
  }

  let sql = `INSERT INTO OPERA_CFG_AUDIT_LOG (${insertColumns.join(', ')}) VALUES (${bindNames.join(', ')})`;

  if (has(columns, 'AUDIT_ID')) {
    sql += ' RETURNING AUDIT_ID INTO :auditId';
    binds.auditId = { dir: oracledb.BIND_OUT, type: oracledb.NUMBER };
  }

  const result = await execute(sql, binds, { autoCommit: true });
  return has(columns, 'AUDIT_ID') ? result.outBinds.auditId[0] : null;
}

async function findAuditLogs(filters = {}) {
  const columns = await getColumns();
  const selectClause = buildSelect(columns);
  const where = ['1 = 1'];
  const binds = {
    offsetRows: Number(filters.offset || 0),
    limitRows: Math.min(Number(filters.limit || 200), 500)
  };

  const usernameColumn = firstAvailable(columns, ['USERNAME', 'CREATED_BY']);
  const actionColumn = firstAvailable(columns, ['ACTION_CODE', 'ACTION']);
  const entityTypeColumn = firstAvailable(columns, ['ENTITY_TYPE', 'OBJECT_TYPE']);
  const entityIdColumn = firstAvailable(columns, ['ENTITY_ID', 'OBJECT_ID']);
  const entityNameColumn = firstAvailable(columns, ['ENTITY_NAME', 'OBJECT_NAME']);
  const summaryColumn = firstAvailable(columns, ['SUMMARY', 'DESCRIPTION']);

  if (has(columns, 'EVENT_TIME')) {
    addWhere(where, binds, `EVENT_TIME >= TO_TIMESTAMP(:fromDate, 'YYYY-MM-DD HH24:MI:SS')`, 'fromDate', normalizeDate(filters.fromDate));
    addWhere(where, binds, `EVENT_TIME <= TO_TIMESTAMP(:toDate, 'YYYY-MM-DD HH24:MI:SS')`, 'toDate', normalizeDate(filters.toDate, true));
  }

  if (usernameColumn) addWhere(where, binds, `UPPER(${usernameColumn}) LIKE UPPER(:username)`, 'username', filters.username ? `%${filters.username}%` : null);
  if (entityTypeColumn) addWhere(where, binds, `${entityTypeColumn} = :entityType`, 'entityType', filters.entityType);
  if (actionColumn) addWhere(where, binds, `${actionColumn} = :action`, 'action', filters.action);
  if (entityIdColumn) addWhere(where, binds, `${entityIdColumn} = :entityId`, 'entityId', filters.entityId);
  if (has(columns, 'RESULT_STATUS')) addWhere(where, binds, 'RESULT_STATUS = :resultStatus', 'resultStatus', filters.resultStatus);

  if (filters.q && String(filters.q).trim()) {
    const qClauses = [];
    if (usernameColumn) qClauses.push(`UPPER(${usernameColumn}) LIKE UPPER(:q)`);
    if (entityTypeColumn) qClauses.push(`UPPER(${entityTypeColumn}) LIKE UPPER(:q)`);
    if (entityNameColumn) qClauses.push(`UPPER(${entityNameColumn}) LIKE UPPER(:q)`);
    if (summaryColumn) qClauses.push(`UPPER(${summaryColumn}) LIKE UPPER(:q)`);
    if (actionColumn) qClauses.push(`UPPER(${actionColumn}) LIKE UPPER(:q)`);
    if (qClauses.length) {
      where.push(`(${qClauses.join(' OR ')})`);
      binds.q = `%${filters.q}%`;
    }
  }

  const orderColumn = has(columns, 'EVENT_TIME') ? 'EVENT_TIME' : 'AUDIT_ID';
  const result = await execute(`
    SELECT ${selectClause}
      FROM OPERA_CFG_AUDIT_LOG
     WHERE ${where.join(' AND ')}
     ORDER BY ${orderColumn} DESC, AUDIT_ID DESC
     OFFSET :offsetRows ROWS FETCH NEXT :limitRows ROWS ONLY
  `, binds);

  return (result.rows || []).map(mapAuditRow);
}

async function findAuditLogById(auditId) {
  const columns = await getColumns();
  const selectClause = buildSelect(columns);
  const result = await execute(`
    SELECT ${selectClause}
      FROM OPERA_CFG_AUDIT_LOG
     WHERE AUDIT_ID = :auditId
  `, { auditId: Number(auditId) });

  return result.rows && result.rows[0] ? mapAuditRow(result.rows[0]) : null;
}

module.exports = {
  insertAuditLog,
  findAuditLogs,
  findAuditLogById
};
