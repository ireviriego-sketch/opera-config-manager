const express = require('express');
const attributeController = require('../controllers/attributeController');
const { requireAuth } = require('../middleware/authMiddleware');
const router = express.Router();
router.get('/data-types', requireAuth, attributeController.listDataTypes);
router.get('/', requireAuth, attributeController.listByEntity);
router.post('/', requireAuth, attributeController.create);
router.put('/:id', requireAuth, attributeController.update);
module.exports = router;
