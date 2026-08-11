const express = require('express');
const templateController = require('../controllers/templateController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();
router.get('/', requireAuth, templateController.list);
router.post('/', requireAuth, templateController.create);
module.exports = router;
