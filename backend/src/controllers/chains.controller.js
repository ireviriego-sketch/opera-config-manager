const chainsService = require('../services/chains.service');

function currentUser(req) {
  return req.user?.email || req.user?.name || req.headers['x-user'] || null;
}

async function listChains(_req, res) {
  const rows = await chainsService.listChains();
  res.json({ ok: true, rows });
}

async function getChain(req, res) {
  const chain = await chainsService.getChain(req.params.chainId);
  if (!chain) return res.status(404).json({ ok: false, error: 'Chain not found' });
  res.json({ ok: true, chain });
}

async function createChain(req, res) {
  const chain = await chainsService.createChain(req.body, currentUser(req));
  res.status(201).json({ ok: true, chain });
}

async function updateChain(req, res) {
  const chain = await chainsService.updateChain(req.params.chainId, req.body, currentUser(req));
  if (!chain) return res.status(404).json({ ok: false, error: 'Chain not found' });
  res.json({ ok: true, chain });
}

async function listHotels(req, res) {
  const rows = await chainsService.listHotels(req.params.chainId);
  res.json({ ok: true, rows });
}

async function createHotel(req, res) {
  const hotel = await chainsService.createHotel(req.params.chainId, req.body, currentUser(req));
  res.status(201).json({ ok: true, hotel });
}

async function updateHotel(req, res) {
  const hotel = await chainsService.updateHotel(req.params.chainId, req.params.hotelId, req.body, currentUser(req));
  if (!hotel) return res.status(404).json({ ok: false, error: 'Hotel not found' });
  res.json({ ok: true, hotel });
}

async function importHotels(req, res) {
  const result = await chainsService.importHotelsFromAccentureHospitality(req.params.chainId, req.body, currentUser(req));
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
