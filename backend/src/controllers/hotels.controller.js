const hotelsService = require('../services/hotels.service');

async function listHotels(req, res) {
  const rows = await hotelsService.listHotels(req.query || {});
  res.json({ ok: true, rows });
}

module.exports = { listHotels };
