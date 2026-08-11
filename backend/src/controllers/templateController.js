const templateRepository = require('../repositories/templateRepository');

async function list(req, res, next) {
  try {
    const templates = await templateRepository.findAll();
    res.json({ templates });
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    const { code, name, description } = req.body || {};
    if (!code || !name) {
      return res.status(400).json({ error: 'CODE_AND_NAME_REQUIRED' });
    }
    const templateId = await templateRepository.createTemplate({
      code,
      name,
      description: description || null,
      createdBy: req.user?.username || 'system'
    });
    res.status(201).json({ templateId });
  } catch (error) {
    next(error);
  }
}

module.exports = { list, create };
