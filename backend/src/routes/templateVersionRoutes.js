const express = require('express');
const templateVersionController = require('../controllers/templateVersionController');

const router = express.Router();

router.get('/', templateVersionController.listByTemplate);
router.post('/', templateVersionController.create);
router.put('/:versionId', templateVersionController.update);
router.post('/:versionId/activate', templateVersionController.activate);

module.exports = router;
