const express = require('express');
const router  = express.Router();
const {
  getAll, getOne, updateTitle, deleteOne, deleteAll
} = require('../controllers/conversationController');

router.get('/',      getAll);
router.get('/:id',   getOne);
router.patch('/:id', updateTitle);
router.delete('/:id', deleteOne);
router.delete('/',    deleteAll);

module.exports = router;
