const express = require('express');
const chainsController = require('../controllers/chains.controller');

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

router.get('/', asyncHandler(chainsController.listChains));
router.get('/:chainId', asyncHandler(chainsController.getChain));
router.post('/', asyncHandler(chainsController.createChain));
router.put('/:chainId', asyncHandler(chainsController.updateChain));

router.get('/:chainId/hotels', asyncHandler(chainsController.listHotels));
router.post('/:chainId/hotels', asyncHandler(chainsController.createHotel));
router.put('/:chainId/hotels/:hotelId', asyncHandler(chainsController.updateHotel));

router.post('/:chainId/import-hotels-from-acc-hospitality', asyncHandler(chainsController.importHotels));

module.exports = router;
