require('dotenv').config();
const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('./middleware/cors');

const app = express();
app.use(cors);
app.use(express.json());

app.use('/api/chat',          require('./routes/chat'));
app.use('/api/conversations', require('./routes/conversations'));
app.use('/api/voice',         require('./routes/voice'));
app.use('/api/actions',       require('./routes/actions'));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    db:     mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    key:    process.env.GROQ_API_KEY ? 'set' : 'MISSING'
  });
});

const PORT = process.env.PORT || 3000;

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => {
      console.log(`\nIyomi backend → http://localhost:${PORT}`);
      console.log(`GROQ_API_KEY:  ${process.env.GROQ_API_KEY ? '✓ set' : '✗ MISSING'}`);
      console.log(`Health:        http://localhost:${PORT}/health\n`);
    });
  })
  .catch(err => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });