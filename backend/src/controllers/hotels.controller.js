const hotelsRepository = require('../repositories/hotels.repository');

function currentUserId(req) {
  return req.authzUserId || req.user?.userId || req.user?.USER_ID || null;
}

async function listHotels(req, res) {
  const rows = await hotelsRepository.findAllForUser(currentUserId(req));
  res.json({ ok: true, rows });
}

module.exports = {
  listHotels
};
