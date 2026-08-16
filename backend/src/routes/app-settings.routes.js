const express = require('express');
const controller = require('../controllers/app-settings.controller');

const router = express.Router();

router.get('/footer', controller.getFooter);
router.put('/footer', controller.saveFooter);

module.exports = router;
