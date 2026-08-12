const hotelsRepository = require('../repositories/hotels.repository');

async function listHotels(filters = {}) {
  return hotelsRepository.findAll(filters);
}

module.exports = { listHotels };
