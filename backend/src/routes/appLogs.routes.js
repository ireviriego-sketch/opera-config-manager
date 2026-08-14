const express = require('express');
const controller = require('../controllers/appLogs.controller');

const router = express.Router();

router.get('/', controller.listLogs);
router.get('/config', controller.getConfig);
router.put('/config', controller.updateConfig);
router.post('/test', controller.createTestLog);

module.exports = router;
