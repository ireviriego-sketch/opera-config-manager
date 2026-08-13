const express = require('express');
const templateVersionController = require('../controllers/templateVersionController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', requireAuth, templateVersionController.listByTemplate);
router.post('/', requireAuth, templateVersionController.create);

module.exports = router;
