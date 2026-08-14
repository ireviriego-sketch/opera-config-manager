const chainsRepository = require('../repositories/chains.repository');
const hotelsRepository = require('../repositories/hotels.repository');
const accentureHospitalityService = require('./accentureHospitality.service');
const { validateChainPayload, validateHotelPayload } = require('../utils/chains.validators');

function forbidden(message) {
  const error = new Error(message || 'No tienes permiso para esta operación.');
  error.statusCode = 403;
  return error;
}

async function listChains(userId) {
  return chainsRepository.findAllForUser(userId);
}

async function getChain(chainId, userId) {
  return chainsRepository.findByIdForUser(chainId, userId);
}

async function createChain() {
  throw forbidden('No se permite crear cadenas desde este rol. La asignación de cadenas debe realizarla un administrador funcional del sistema.');
}

async function updateChain(chainId, body, userId, userName) {
  const payload = validateChainPayload(body);
  return chainsRepository.updateChainForUser(chainId, userId, { ...payload, updatedBy: userName || null });
}

async function deleteChain(chainId, userId, userName) {
  return chainsRepository.deleteChainForUser(chainId, userId, userName || null);
}

async function listHotels(chainId, userId) {
  return hotelsRepository.findByChainIdForUser(chainId, userId);
}

async function createHotel(chainId, body, userId, userName) {
  const payload = validateHotelPayload(body);
  return hotelsRepository.createHotelForUser(chainId, userId, { ...payload, createdBy: userName || null });
}

async function updateHotel(chainId, hotelId, body, userId, userName) {
  const payload = validateHotelPayload(body);
  return hotelsRepository.updateHotelForUser(chainId, hotelId, userId, { ...payload, updatedBy: userName || null });
}

async function deleteHotel(chainId, hotelId, userId, userName) {
  return hotelsRepository.deleteHotelForUser(chainId, hotelId, userId, userName || null);
}

async function importHotelsFromAccentureHospitality(chainId, body, userId, userName) {
  const localChain = await getChain(chainId, userId);
  if (!localChain) {
    const error = new Error('Chain not found or not authorized');
    error.statusCode = 404;
    throw error;
  }

  let sourceChainId = body && body.accChainId ? Number(body.accChainId) : null;
  if (!sourceChainId) {
    const sourceChain = await accentureHospitalityService.findChainByName(localChain.chainName);
    if (!sourceChain) {
      const error = new Error(`No matching chain found in Accenture Hospitality for ${localChain.chainName}`);
      error.statusCode = 404;
      throw error;
    }
    sourceChainId = Number(sourceChain.CHAIN_ID || sourceChain.chainId);
  }

  const sourceHotels = await accentureHospitalityService.listHotelsByChain(sourceChainId);
  const warnings = [];
  const hotelsToImport = [];
  for (const sourceHotel of sourceHotels) {
    const sourceHotelId = sourceHotel.HOTEL_ID || sourceHotel.hotelId;
    const sourceHotelName = sourceHotel.HOTELNAME || sourceHotel.hotelName;
    if (!sourceHotelId || !sourceHotelName) {
      warnings.push('Skipped source hotel without HOTEL_ID or HOTELNAME');
      continue;
    }
    hotelsToImport.push({ hotelCode: `ACC-${sourceHotelId}`, hotelName: String(sourceHotelName).trim(), status: 'ACTIVE' });
  }

  const summary = await chainsRepository.upsertImportedHotels(localChain.chainId, hotelsToImport, userName || null);
  const hotels = await listHotels(localChain.chainId, userId);
  return { sourceChainId, imported: summary.imported, updated: summary.updated, skipped: warnings.length, warnings, hotels };
}

module.exports = {
  listChains,
  getChain,
  createChain,
  updateChain,
  deleteChain,
  listHotels,
  createHotel,
  updateHotel,
  deleteHotel,
  importHotelsFromAccentureHospitality
};
