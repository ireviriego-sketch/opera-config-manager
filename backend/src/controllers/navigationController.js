const navigationRepository = require('../repositories/navigationRepository');

async function list(req, res, next) {
  try {
    const items = await navigationRepository.findActiveNavigation();
    res.json({ items });
  } catch (error) {
    next(error);
  }
}

module.exports = { list };
