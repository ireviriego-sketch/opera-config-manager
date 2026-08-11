const express = require('express');
const relationshipController = require('../controllers/relationshipController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', requireAuth, relationshipController.listByVersion);
router.post('/', requireAuth, relationshipController.create);
router.delete('/:id', requireAuth, relationshipController.remove);

module.exports = router;
