const express = require('express');
const entityController = require('../controllers/entityController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', requireAuth, entityController.listByDomain);
router.post('/', requireAuth, entityController.create);

module.exports = router;
