const express    = require('express');
const router     = express.Router();
const { chatGroq } = require('../controllers/groqController');
const { startConversation } = require('../controllers/chatController');

// all chat goes through Groq + Tavily
router.post('/',      chatGroq);
router.post('/start', startConversation);

module.exports = router;