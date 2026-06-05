const Conversation = require('../models/Conversation');

/* GET /api/conversations?userId=xxx
   Returns all conversations for a user (title + id + updatedAt, no messages) */
exports.getAll = async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  try {
    const convs = await Conversation.find({ userId })
      .sort({ updatedAt: -1 })
      .select('_id title model updatedAt createdAt')
      .lean();
    res.json(convs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* GET /api/conversations/:id
   Returns full conversation with messages */
exports.getOne = async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.id).lean();
    if (!conv) return res.status(404).json({ error: 'Not found' });
    res.json(conv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* PATCH /api/conversations/:id
   Update title */
exports.updateTitle = async (req, res) => {
  const { title } = req.body;
  try {
    const conv = await Conversation.findByIdAndUpdate(
      req.params.id,
      { title },
      { new: true }
    ).select('_id title');
    res.json(conv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* DELETE /api/conversations/:id */
exports.deleteOne = async (req, res) => {
  try {
    await Conversation.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* DELETE /api/conversations?userId=xxx
   Delete ALL conversations for a user */
exports.deleteAll = async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  try {
    await Conversation.deleteMany({ userId });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
