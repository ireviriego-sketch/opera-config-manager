const ALLOWED_STATUS = new Set(['ACTIVE', 'INACTIVE']);

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function cleanCode(value, fieldName) {
  const output = String(value || '').trim().toUpperCase();
  if (!output) throw badRequest(`${fieldName} is required`);
  if (output.length > 50) throw badRequest(`${fieldName} cannot exceed 50 characters`);
  return output;
}

function cleanName(value, fieldName) {
  const output = String(value || '').trim();
  if (!output) throw badRequest(`${fieldName} is required`);
  if (output.length > 200) throw badRequest(`${fieldName} cannot exceed 200 characters`);
  return output;
}

function cleanStatus(value) {
  const output = String(value || 'ACTIVE').trim().toUpperCase();
  if (!ALLOWED_STATUS.has(output)) throw badRequest('STATUS must be ACTIVE or INACTIVE');
  return output;
}

function validateChainPayload(body) {
  return {
    chainCode: cleanCode(body.chainCode, 'CHAIN_CODE'),
    chainName: cleanName(body.chainName, 'CHAIN_NAME'),
    status: cleanStatus(body.status)
  };
}

function validateHotelPayload(body) {
  return {
    hotelCode: cleanCode(body.hotelCode, 'HOTEL_CODE'),
    hotelName: cleanName(body.hotelName, 'HOTEL_NAME'),
    status: cleanStatus(body.status)
  };
}

module.exports = { validateChainPayload, validateHotelPayload };
