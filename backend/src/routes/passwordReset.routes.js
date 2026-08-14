const express = require('express');
const controller = require('../controllers/passwordReset.controller');

const router = express.Router();

router.get('/validate/:token', controller.validateToken);
router.post('/confirm', controller.confirmPassword);

module.exports = router;
