const lovsRepository = require('../repositories/lovs.repository');
const { auditSafely } = require('../utils/auditHelper');
const appLogger = require('../utils/appLogger');
const { currentUser } = require('../utils/requestUser');

async function logBusiness(req, eventCode, message, details) {
  try { await appLogger.business('LOVS', eventCode, message, details, req); } catch (error) { console.error('App log failed:', error.message); }
}

function validateLov(body, currentLovId = null) {
  const lovCode = String(body.lovCode || body.LOV_CODE || '').trim().toUpperCase();
  const lovName = String(body.lovName || body.LOV_NAME || '').trim();
  const parentLovId = body.parentLovId || body.PARENT_LOV_ID || null;
  if (!lovCode || !lovName) {
    const error = new Error('LOV_CODE_AND_NAME_REQUIRED');
    error.statusCode = 400;
    throw error;
  }
  if (parentLovId && currentLovId && Number(parentLovId) === Number(currentLovId)) {
    const error = new Error('LOV_CANNOT_DEPEND_ON_ITSELF');
    error.statusCode = 400;
    throw error;
  }
  return { lovCode, lovName, description: body.description || body.DESCRIPTION || null, status: body.status || body.STATUS || 'ACTIVE', parentLovId: parentLovId ? Number(parentLovId) : null };
}

function validateValue(body) {
  const valueCode = String(body.valueCode || body.VALUE_CODE || '').trim().toUpperCase();
  const valueLabel = String(body.valueLabel || body.VALUE_LABEL || '').trim();
  const parentLovValueId = body.parentLovValueId || body.PARENT_LOV_VALUE_ID || null;
  if (!valueCode || !valueLabel) {
    const error = new Error('VALUE_CODE_AND_LABEL_REQUIRED');
    error.statusCode = 400;
    throw error;
  }
  return { valueCode, valueLabel, sortOrder: Number(body.sortOrder || body.SORT_ORDER || 10), status: body.status || body.STATUS || 'ACTIVE', parentLovValueId: parentLovValueId ? Number(parentLovValueId) : null };
}

async function listLovs(req, res, next) {
  try {
    const items = await lovsRepository.findLovs({ includeInactive: req.query.includeInactive !== 'false', q: req.query.q });
    res.json({ items });
  } catch (error) { next(error); }
}

async function createLov(req, res, next) {
  try {
    const payload = validateLov(req.body || {});
    const item = await lovsRepository.createLov(payload);
    await auditSafely(req, { username: currentUser(req), action: 'CREATE_LOV', actionCode: 'CREATE_LOV', resultStatus: 'SUCCESS', entityType: 'LOV', entityId: item.lovId, entityName: item.lovCode, summary: `LOV creada: ${item.lovCode}`, oldValues: null, newValues: item });
    await logBusiness(req, 'LOV_CREATED', `LOV creada: ${item.lovCode}`, { item });
    res.status(201).json({ item });
  } catch (error) { next(error); }
}

async function updateLov(req, res, next) {
  try {
    const before = await lovsRepository.findLovById(req.params.lovId);
    if (!before) return res.status(404).json({ error: 'LOV_NOT_FOUND' });
    const payload = validateLov(req.body || {}, req.params.lovId);
    const item = await lovsRepository.updateLov(req.params.lovId, payload);
    await auditSafely(req, { username: currentUser(req), action: 'UPDATE_LOV', actionCode: 'UPDATE_LOV', resultStatus: 'SUCCESS', entityType: 'LOV', entityId: item.lovId, entityName: item.lovCode, summary: `LOV actualizada: ${item.lovCode}`, oldValues: before, newValues: item });
    await logBusiness(req, 'LOV_UPDATED', `LOV actualizada: ${item.lovCode}`, { before, item });
    res.json({ item });
  } catch (error) { next(error); }
}

async function deleteLov(req, res, next) {
  try {
    const before = await lovsRepository.findLovById(req.params.lovId);
    if (!before) return res.status(404).json({ error: 'LOV_NOT_FOUND' });
    const deleted = await lovsRepository.deactivateLov(req.params.lovId);
    await auditSafely(req, { username: currentUser(req), action: 'DELETE_LOV', actionCode: 'DELETE_LOV', resultStatus: 'SUCCESS', entityType: 'LOV', entityId: req.params.lovId, entityName: before.lovCode, summary: `LOV desactivada: ${before.lovCode}`, oldValues: before, newValues: { ...before, status: 'INACTIVE' } });
    await logBusiness(req, 'LOV_DEACTIVATED', `LOV desactivada: ${before.lovCode}`, { before });
    res.json({ ok: true, deleted });
  } catch (error) { next(error); }
}

async function listValues(req, res, next) {
  try {
    const items = await lovsRepository.findValuesByLovId(req.params.lovId, { includeInactive: req.query.includeInactive !== 'false', parentLovValueId: req.query.parentLovValueId });
    res.json({ items });
  } catch (error) { next(error); }
}

async function listValuesByCode(req, res, next) {
  try {
    const lov = await lovsRepository.findLovByCode(req.params.lovCode);
    if (!lov) return res.status(404).json({ error: 'LOV_NOT_FOUND' });

    let parentLovValueId = req.query.parentLovValueId || null;
    if (!parentLovValueId && req.query.parentValueCode && lov.parentLovId) {
      parentLovValueId = await lovsRepository.findValueByCode(lov.parentLovId, req.query.parentValueCode);
    }

    const items = await lovsRepository.findValuesByLovId(lov.lovId, { includeInactive: req.query.includeInactive === 'true', parentLovValueId });
    res.json({ lov, items });
  } catch (error) { next(error); }
}

async function createValue(req, res, next) {
  try {
    const lov = await lovsRepository.findLovById(req.params.lovId);
    if (!lov) return res.status(404).json({ error: 'LOV_NOT_FOUND' });
    const payload = validateValue(req.body || {});
    const item = await lovsRepository.createValue(req.params.lovId, payload);
    await auditSafely(req, { username: currentUser(req), action: 'CREATE_LOV_VALUE', actionCode: 'CREATE_LOV_VALUE', resultStatus: 'SUCCESS', entityType: 'LOV_VALUE', entityId: item.lovValueId, entityName: `${lov.lovCode}.${item.valueCode}`, summary: `Valor LOV creado: ${lov.lovCode}.${item.valueCode}`, oldValues: null, newValues: item, details: { lov } });
    await logBusiness(req, 'LOV_VALUE_CREATED', `Valor LOV creado: ${lov.lovCode}.${item.valueCode}`, { lov, item });
    res.status(201).json({ item });
  } catch (error) { next(error); }
}

async function updateValue(req, res, next) {
  try {
    const lov = await lovsRepository.findLovById(req.params.lovId);
    if (!lov) return res.status(404).json({ error: 'LOV_NOT_FOUND' });
    const before = await lovsRepository.findValueById(req.params.lovValueId);
    if (!before) return res.status(404).json({ error: 'LOV_VALUE_NOT_FOUND' });
    const payload = validateValue(req.body || {});
    const item = await lovsRepository.updateValue(req.params.lovId, req.params.lovValueId, payload);
    await auditSafely(req, { username: currentUser(req), action: 'UPDATE_LOV_VALUE', actionCode: 'UPDATE_LOV_VALUE', resultStatus: 'SUCCESS', entityType: 'LOV_VALUE', entityId: item.lovValueId, entityName: `${lov.lovCode}.${item.valueCode}`, summary: `Valor LOV actualizado: ${lov.lovCode}.${item.valueCode}`, oldValues: before, newValues: item, details: { lov } });
    await logBusiness(req, 'LOV_VALUE_UPDATED', `Valor LOV actualizado: ${lov.lovCode}.${item.valueCode}`, { lov, before, item });
    res.json({ item });
  } catch (error) { next(error); }
}

async function deleteValue(req, res, next) {
  try {
    const lov = await lovsRepository.findLovById(req.params.lovId);
    if (!lov) return res.status(404).json({ error: 'LOV_NOT_FOUND' });
    const before = await lovsRepository.findValueById(req.params.lovValueId);
    if (!before) return res.status(404).json({ error: 'LOV_VALUE_NOT_FOUND' });
    const deleted = await lovsRepository.deactivateValue(req.params.lovId, req.params.lovValueId);
    await auditSafely(req, { username: currentUser(req), action: 'DELETE_LOV_VALUE', actionCode: 'DELETE_LOV_VALUE', resultStatus: 'SUCCESS', entityType: 'LOV_VALUE', entityId: req.params.lovValueId, entityName: `${lov.lovCode}.${before.valueCode}`, summary: `Valor LOV desactivado: ${lov.lovCode}.${before.valueCode}`, oldValues: before, newValues: { ...before, status: 'INACTIVE' }, details: { lov } });
    await logBusiness(req, 'LOV_VALUE_DEACTIVATED', `Valor LOV desactivado: ${lov.lovCode}.${before.valueCode}`, { lov, before });
    res.json({ ok: true, deleted });
  } catch (error) { next(error); }
}

module.exports = { listLovs, createLov, updateLov, deleteLov, listValues, listValuesByCode, createValue, updateValue, deleteValue };
