const express = require('express');
const templateController = require('../controllers/templateController');
const { requireAuth } = require('../middleware/authMiddleware');
const router = express.Router();

router.get('/', templateController.list);
router.post('/', templateController.create);
module.exports = router;
