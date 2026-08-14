const adminRepository = require('../repositories/admin.repository');

async function getUsers(req, res, next) {
  try {
    const users = await adminRepository.findUsers();
    res.json(users);
  } catch (error) {
    next(error);
  }
}

async function getLovs(req, res, next) {
  try {
    const lovs = await adminRepository.findLovs();
    res.json(lovs);
  } catch (error) {
    next(error);
  }
}

async function getLovValues(req, res, next) {
  try {
    const values = await adminRepository.findLovValues(req.params.lovCode);
    res.json(values);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getUsers,
  getLovs,
  getLovValues
};
