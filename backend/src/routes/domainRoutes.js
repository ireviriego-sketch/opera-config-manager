const express = require('express');
const domainController = require('../controllers/domainController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', requireAuth, domainController.listByVersion);
router.post('/', requireAuth, domainController.create);

module.exports = router;
