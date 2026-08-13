const express = require('express');
const controller = require('../controllers/deploymentContent.controller');

const router = express.Router();

function asyncHandler(handler) {
  return async (req, res, next) => {
    try { await handler(req, res, next); } catch (error) { next(error); }
  };
}

router.get('/:deploymentId/structure', asyncHandler(controller.getStructure));
router.get('/:deploymentId/entities/:entityId/attributes', asyncHandler(controller.getEntityAttributes));
router.get('/:deploymentId/entities/:entityId/records', asyncHandler(controller.listRecords));
router.post('/:deploymentId/entities/:entityId/records', asyncHandler(controller.createRecord));
router.put('/:deploymentId/records/:recordId', asyncHandler(controller.updateRecord));
router.delete('/:deploymentId/records/:recordId', asyncHandler(controller.deleteRecord));

module.exports = router;

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
router.post('/:deploymentId/domains/:domainId/import', upload.single('file'), asyncHandler(controller.importDomainExcel));
