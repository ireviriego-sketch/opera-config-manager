const hotelsRepository = require('../repositories/hotels.repository');
const { currentUserId } = require('../utils/requestUser');


async function listHotels(req, res) {
  const rows = await hotelsRepository.findAllForUser(currentUserId(req));
  res.json({ ok: true, rows });
}

module.exports = {
  listHotels
};
