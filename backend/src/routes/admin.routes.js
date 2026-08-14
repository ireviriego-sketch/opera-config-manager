const express = require('express');
const adminController = require('../controllers/admin.controller');

const router = express.Router();

router.get('/users', adminController.getUsers);
router.get('/lovs', adminController.getLovs);
router.get('/lovs/:lovCode/values', adminController.getLovValues);

module.exports = router;
