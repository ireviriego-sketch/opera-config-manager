const express = require('express');
const hotelsController = require('../controllers/hotels.controller');

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

router.get('/', asyncHandler(hotelsController.listHotels));

module.exports = router;
