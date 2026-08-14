const express = require('express');
const controller = require('../controllers/audit.controller');

const router = express.Router();

router.get('/', controller.listAuditLogs);
router.get('/:auditId', controller.getAuditLog);

module.exports = router;
