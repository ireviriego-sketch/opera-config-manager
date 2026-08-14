const express = require('express');
const controller = require('../controllers/lovs.controller');

const router = express.Router();

router.get('/', controller.listLovs);
router.post('/', controller.createLov);
router.put('/:lovId', controller.updateLov);
router.delete('/:lovId', controller.deleteLov);
router.get('/code/:lovCode/values', controller.listValuesByCode);
router.get('/:lovId/values', controller.listValues);
router.post('/:lovId/values', controller.createValue);
router.put('/:lovId/values/:lovValueId', controller.updateValue);
router.delete('/:lovId/values/:lovValueId', controller.deleteValue);

module.exports = router;
