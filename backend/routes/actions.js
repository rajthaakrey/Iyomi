const express    = require('express');
const router     = express.Router();
const { action } = require('../controllers/actionController');

router.post('/', action);

module.exports = router;
