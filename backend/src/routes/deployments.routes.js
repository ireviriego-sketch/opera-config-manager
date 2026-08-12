const express = require('express');
const deploymentsController = require('../controllers/deployments.controller');

const router = express.Router();

function asyncHandler(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

router.get('/sources/template-versions', asyncHandler(deploymentsController.listTemplateVersions));
router.get('/', asyncHandler(deploymentsController.listDeployments));
router.get('/:deploymentId', asyncHandler(deploymentsController.getDeployment));
router.get('/:deploymentId/content', asyncHandler(deploymentsController.getContent));
router.get('/:deploymentId/export-json', asyncHandler(deploymentsController.getContent));
router.put('/:deploymentId', asyncHandler(deploymentsController.updateDeployment));
router.post('/:deploymentId/copy', asyncHandler(deploymentsController.copyDeployment));
router.post('/chains/:chainId', asyncHandler(deploymentsController.createDeployment));

module.exports = router;
