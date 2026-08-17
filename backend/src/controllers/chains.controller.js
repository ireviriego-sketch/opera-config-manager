const chainsService = require('../services/chains.service');
const chainsRepository = require('../repositories/chains.repository');
const hotelsRepository = require('../repositories/hotels.repository');
const { auditSafely } = require('../utils/auditHelper');
const { currentUser, currentUserId } = require('../utils/requestUser');
function chainName(chain) {
  return chain?.chainName || chain?.CHAIN_NAME || chain?.chainCode || chain?.CHAIN_CODE || String(chain?.chainId || chain?.CHAIN_ID || 'cadena');
}

function hotelName(hotel) {
  return hotel?.hotelName || hotel?.HOTEL_NAME || hotel?.hotelCode || hotel?.HOTEL_CODE || String(hotel?.hotelId || hotel?.HOTEL_ID || 'hotel');
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
  await auditSafely(req, { username: currentUser(req), action: 'CREATE_CHAIN', actionCode: 'CREATE_CHAIN', resultStatus: 'SUCCESS', entityType: 'CHAIN', entityId: chain.chainId, entityName: chainName(chain), summary: `Cadena creada: ${chainName(chain)}`, oldValues: null, newValues: chain });
  res.status(201).json({ ok: true, chain });
}

async function updateChain(req, res) {
  const before = await chainsRepository.findById(req.params.chainId);
  const chain = await chainsService.updateChain(req.params.chainId, req.body, currentUserId(req), currentUser(req));
  if (!chain) return res.status(404).json({ ok: false, error: 'Chain not found or not authorized' });
  await auditSafely(req, { username: currentUser(req), action: 'UPDATE_CHAIN', actionCode: 'UPDATE_CHAIN', resultStatus: 'SUCCESS', entityType: 'CHAIN', entityId: chain.chainId || req.params.chainId, entityName: chainName(chain), summary: `Cadena actualizada: ${chainName(chain)}`, oldValues: before, newValues: chain });
  res.json({ ok: true, chain });
}

async function deleteChain(req, res) {
  const before = await chainsRepository.findById(req.params.chainId);
  if (!before) return res.status(404).json({ ok: false, error: 'Chain not found' });
  const deleted = await chainsService.deleteChain(req.params.chainId, currentUserId(req), currentUser(req));
  if (!deleted) return res.status(404).json({ ok: false, error: 'Chain not found or not authorized' });
  await auditSafely(req, { username: currentUser(req), action: 'DELETE_CHAIN', actionCode: 'DELETE_CHAIN', resultStatus: 'SUCCESS', entityType: 'CHAIN', entityId: req.params.chainId, entityName: chainName(before), summary: `Cadena eliminada: ${chainName(before)}`, oldValues: before, newValues: { deleted: true, chainId: Number(req.params.chainId) } });
  res.json({ ok: true, deleted: true });
}

async function listHotels(req, res) {
  const rows = await chainsService.listHotels(req.params.chainId, currentUserId(req));
  res.json({ ok: true, rows });
}

async function createHotel(req, res) {
  const hotel = await chainsService.createHotel(req.params.chainId, req.body, currentUserId(req), currentUser(req));
  await auditSafely(req, { username: currentUser(req), action: 'CREATE_HOTEL', actionCode: 'CREATE_HOTEL', resultStatus: 'SUCCESS', entityType: 'HOTEL', entityId: hotel.hotelId, entityName: hotelName(hotel), summary: `Hotel creado: ${hotelName(hotel)}`, oldValues: null, newValues: hotel, details: { chainId: Number(req.params.chainId) } });
  res.status(201).json({ ok: true, hotel });
}

async function updateHotel(req, res) {
  const before = await hotelsRepository.findById(req.params.hotelId);
  const hotel = await chainsService.updateHotel(req.params.chainId, req.params.hotelId, req.body, currentUserId(req), currentUser(req));
  if (!hotel) return res.status(404).json({ ok: false, error: 'Hotel not found or not authorized' });
  await auditSafely(req, { username: currentUser(req), action: 'UPDATE_HOTEL', actionCode: 'UPDATE_HOTEL', resultStatus: 'SUCCESS', entityType: 'HOTEL', entityId: hotel.hotelId || req.params.hotelId, entityName: hotelName(hotel), summary: `Hotel actualizado: ${hotelName(hotel)}`, oldValues: before, newValues: hotel, details: { chainId: Number(req.params.chainId) } });
  res.json({ ok: true, hotel });
}

async function deleteHotel(req, res) {
  const before = await hotelsRepository.findById(req.params.hotelId);
  if (!before) return res.status(404).json({ ok: false, error: 'Hotel not found' });
  const deleted = await chainsService.deleteHotel(req.params.chainId, req.params.hotelId, currentUserId(req), currentUser(req));
  if (!deleted) return res.status(404).json({ ok: false, error: 'Hotel not found or not authorized' });
  await auditSafely(req, { username: currentUser(req), action: 'DELETE_HOTEL', actionCode: 'DELETE_HOTEL', resultStatus: 'SUCCESS', entityType: 'HOTEL', entityId: req.params.hotelId, entityName: hotelName(before), summary: `Hotel eliminado: ${hotelName(before)}`, oldValues: before, newValues: { deleted: true, hotelId: Number(req.params.hotelId) }, details: { chainId: Number(req.params.chainId) } });
  res.json({ ok: true, deleted: true });
}

async function importHotels(req, res) {
  const beforeHotels = await chainsService.listHotels(req.params.chainId, currentUserId(req));
  const result = await chainsService.importHotelsFromAccentureHospitality(req.params.chainId, req.body, currentUserId(req), currentUser(req));
  const afterHotels = await chainsService.listHotels(req.params.chainId, currentUserId(req));
  await auditSafely(req, { username: currentUser(req), action: 'IMPORT_HOTELS', actionCode: 'IMPORT_HOTELS', resultStatus: 'SUCCESS', entityType: 'CHAIN', entityId: req.params.chainId, entityName: `CHAIN ${req.params.chainId}`, summary: `Hoteles importados para cadena ${req.params.chainId}`, oldValues: { hotels: beforeHotels }, newValues: { result, hotels: afterHotels }, details: { chainId: Number(req.params.chainId) } });
  res.json({ ok: true, ...result });
}

module.exports = { listChains, getChain, createChain, updateChain, deleteChain, listHotels, createHotel, updateHotel, deleteHotel, importHotels };
