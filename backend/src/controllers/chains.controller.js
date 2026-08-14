const chainsService = require('../services/chains.service');
const chainsRepository = require('../repositories/chains.repository');
const hotelsRepository = require('../repositories/hotels.repository');
const auditService = require('../services/audit.service');

function currentUser(req) {
  return req.user?.email || req.user?.name || req.headers['x-user'] || req.headers['x-username'] || null;
}

function currentUserId(req) {
  return req.authzUserId || req.user?.userId || req.user?.USER_ID || null;
}

function chainSummary(action, chain) {
  const name = chain?.chainName || chain?.CHAIN_NAME || chain?.chainCode || chain?.CHAIN_CODE || chain?.chainId || chain?.CHAIN_ID || 'cadena';
  if (action === 'CREATE') return `Cadena creada: ${name}`;
  if (action === 'UPDATE') return `Cadena actualizada: ${name}`;
  if (action === 'DELETE') return `Cadena eliminada: ${name}`;
  return `Cambio en cadena: ${name}`;
}

function hotelSummary(action, hotel) {
  const name = hotel?.hotelName || hotel?.HOTEL_NAME || hotel?.hotelCode || hotel?.HOTEL_CODE || hotel?.hotelId || hotel?.HOTEL_ID || 'hotel';
  if (action === 'CREATE') return `Hotel creado: ${name}`;
  if (action === 'UPDATE') return `Hotel actualizado: ${name}`;
  if (action === 'DELETE') return `Hotel eliminado: ${name}`;
  return `Cambio en hotel: ${name}`;
}

async function listChains(req, res) {
  const rows = await chainsService.listChains(currentUserId(req));
  res.json({ ok: true, rows });
}

async function getChain(req, res) {
  const chain = await chainsService.getChain(req.params.chainId, currentUserId(req));
  if (!chain) return res.status(404).json({ ok: false, error: 'Chain not found or not authorized' });
  res.json({ ok: true, chain });
}

async function createChain(req, res) {
  const chain = await chainsService.createChain(req.body, currentUserId(req), currentUser(req));

  await auditService.logFromRequest(req, {
    action: 'CREATE',
    actionCode: 'CREATE',
    resultStatus: 'SUCCESS',
    entityType: 'CHAIN',
    entityId: chain.chainId,
    entityName: chain.chainName,
    summary: chainSummary('CREATE', chain),
    oldValues: null,
    newValues: chain
  });

  res.status(201).json({ ok: true, chain });
}

async function updateChain(req, res) {
  const before = await chainsRepository.findById(req.params.chainId);
  const chain = await chainsService.updateChain(req.params.chainId, req.body, currentUserId(req), currentUser(req));
  if (!chain) return res.status(404).json({ ok: false, error: 'Chain not found or not authorized' });

  await auditService.logFromRequest(req, {
    action: 'UPDATE',
    actionCode: 'UPDATE',
    resultStatus: 'SUCCESS',
    entityType: 'CHAIN',
    entityId: chain.chainId,
    entityName: chain.chainName,
    summary: chainSummary('UPDATE', chain),
    oldValues: before,
    newValues: chain
  });

  res.json({ ok: true, chain });
}

async function listHotels(req, res) {
  const rows = await chainsService.listHotels(req.params.chainId, currentUserId(req));
  res.json({ ok: true, rows });
}

async function createHotel(req, res) {
  const hotel = await chainsService.createHotel(req.params.chainId, req.body, currentUserId(req), currentUser(req));

  await auditService.logFromRequest(req, {
    action: 'CREATE',
    actionCode: 'CREATE',
    resultStatus: 'SUCCESS',
    entityType: 'HOTEL',
    entityId: hotel.hotelId,
    entityName: hotel.hotelName,
    summary: hotelSummary('CREATE', hotel),
    oldValues: null,
    newValues: hotel
  });

  res.status(201).json({ ok: true, hotel });
}

async function updateHotel(req, res) {
  const before = await hotelsRepository.findById(req.params.hotelId);
  const hotel = await chainsService.updateHotel(req.params.chainId, req.params.hotelId, req.body, currentUserId(req), currentUser(req));
  if (!hotel) return res.status(404).json({ ok: false, error: 'Hotel not found or not authorized' });

  await auditService.logFromRequest(req, {
    action: 'UPDATE',
    actionCode: 'UPDATE',
    resultStatus: 'SUCCESS',
    entityType: 'HOTEL',
    entityId: hotel.hotelId,
    entityName: hotel.hotelName,
    summary: hotelSummary('UPDATE', hotel),
    oldValues: before,
    newValues: hotel
  });

  res.json({ ok: true, hotel });
}

async function importHotels(req, res) {
  const result = await chainsService.importHotelsFromAccentureHospitality(req.params.chainId, req.body, currentUserId(req), currentUser(req));

  await auditService.logFromRequest(req, {
    action: 'IMPORT',
    actionCode: 'IMPORT',
    resultStatus: 'SUCCESS',
    entityType: 'CHAIN',
    entityId: req.params.chainId,
    entityName: `CHAIN ${req.params.chainId}`,
    summary: `Hoteles importados para cadena ${req.params.chainId}`,
    oldValues: null,
    newValues: result
  });

  res.json({ ok: true, ...result });
}

module.exports = {
  listChains,
  getChain,
  createChain,
  updateChain,
  listHotels,
  createHotel,
  updateHotel,
  importHotels
};
