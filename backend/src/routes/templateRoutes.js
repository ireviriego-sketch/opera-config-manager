const express = require('express');
const templateController = require('../controllers/templateController');

const router = express.Router();

router.get('/', templateController.list);
router.post('/', templateController.create);
router.put('/:templateId', templateController.update);

module.exports = router;
