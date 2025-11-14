const express = require('express');
const router = express.Router();
const tokenController = require('../controllers/tokenController');

router.get('/getValues', tokenController.extractTokenValues);

module.exports = router;