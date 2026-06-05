const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  role:      { type: String, enum: ['user', 'assistant', 'system'], required: true },
  content:   { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const ConversationSchema = new mongoose.Schema({
  userId:    { type: String, required: true, index: true },
  title:     { type: String, default: 'New Chat' },
  model:     { type: String, default: 'llama-3.3-70b-versatile' },
  messages:  [MessageSchema],
}, { timestamps: true });

// index for fast user history queries
ConversationSchema.index({ userId: 1, updatedAt: -1 });

module.exports = mongoose.model('Conversation', ConversationSchema);
