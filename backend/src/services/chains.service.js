const chainsRepository = require('../repositories/chains.repository');
const hotelsRepository = require('../repositories/hotels.repository');
const accentureHospitalityService = require('./accentureHospitality.service');
const { validateChainPayload, validateHotelPayload } = require('../utils/chains.validators');

async function listChains() {
  return chainsRepository.findAll();
}

async function getChain(chainId) {
  return chainsRepository.findById(chainId);
}

async function createChain(body, userName) {
  const payload = validateChainPayload(body);
  return chainsRepository.createChain({ ...payload, createdBy: userName || null });
}

async function updateChain(chainId, body, userName) {
  const payload = validateChainPayload(body);
  return chainsRepository.updateChain(chainId, { ...payload, updatedBy: userName || null });
}

async function listHotels(chainId) {
  return hotelsRepository.findByChainId(chainId);
}

async function createHotel(chainId, body, userName) {
  const payload = validateHotelPayload(body);
  return hotelsRepository.createHotel(chainId, { ...payload, createdBy: userName || null });
}

async function updateHotel(chainId, hotelId, body, userName) {
  const payload = validateHotelPayload(body);
  return hotelsRepository.updateHotel(chainId, hotelId, { ...payload, updatedBy: userName || null });
}

async function importHotelsFromAccentureHospitality(chainId, body, userName) {
  const localChain = await getChain(chainId);
  if (!localChain) {
    const error = new Error('Chain not found');
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

    hotelsToImport.push({
      hotelCode: `ACC-${sourceHotelId}`,
      hotelName: String(sourceHotelName).trim(),
      status: 'ACTIVE'
    });
  }

  const summary = await chainsRepository.upsertImportedHotels(localChain.chainId, hotelsToImport, userName || null);
  const hotels = await listHotels(localChain.chainId);

  return {
    sourceChainId,
    imported: summary.imported,
    updated: summary.updated,
    skipped: warnings.length,
    warnings,
    hotels
  };
}

module.exports = {
  listChains,
  getChain,
  createChain,
  updateChain,
  listHotels,
  createHotel,
  updateHotel,
  importHotelsFromAccentureHospitality
};
