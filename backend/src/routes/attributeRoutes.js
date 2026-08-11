const express = require('express');
const attributeController = require('../controllers/attributeController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', requireAuth, attributeController.listByEntity);
router.post('/', requireAuth, attributeController.create);
router.get('/data-types', requireAuth, attributeController.listDataTypes);

module.exports = router;
