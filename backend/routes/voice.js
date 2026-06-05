const express   = require('express');
const router    = express.Router();
const { voice } = require('../controllers/voiceController');

router.post('/', voice);

module.exports = router;
