const repository = require('../repositories/app-settings.repository');

async function getFooter(req, res, next) {
  try {
    const footer = await repository.getFooterConfig();
    res.json({ ok: true, footer });
  } catch (error) {
    next(error);
  }
}

async function saveFooter(req, res, next) {
  try {
    const footer = await repository.saveFooterConfig(req.body || {});
    res.json({ ok: true, footer });
  } catch (error) {
    next(error);
  }
}

module.exports = { getFooter, saveFooter };
