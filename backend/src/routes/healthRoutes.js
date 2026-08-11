const express = require('express');
const { execute } = require('../db/query');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const result = await execute('SELECT USER AS db_user FROM DUAL');
    res.json({ status: 'OK', dbUser: result.rows[0].DB_USER });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
