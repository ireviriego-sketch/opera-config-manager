const express = require('express');
const navigationController = require('../controllers/navigationController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();
router.get('/', requireAuth, navigationController.list);
module.exports = router;
