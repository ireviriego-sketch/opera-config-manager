const express = require('express');
const controller = require('../controllers/adminSecurity.controller');

const router = express.Router();

router.get('/users', controller.listUsers);
router.get('/users/:userId', controller.getUser);
router.put('/users/:userId/roles', controller.updateUserRoles);
router.put('/users/:userId/permissions/chains', controller.replaceChainPermissions);
router.put('/users/:userId/permissions/hotels', controller.replaceHotelPermissions);

router.get('/roles', controller.listRoles);
router.get('/chains', controller.listChains);
router.get('/hotels', controller.listHotels);

module.exports = router;
