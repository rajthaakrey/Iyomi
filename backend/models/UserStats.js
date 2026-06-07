// ── models/UserStats.js ──
// Stores user progression data: XP, level, petals, streak, artifacts, achievements, society rank

const mongoose = require('mongoose');

const collectedArtifactSchema = new mongoose.Schema({
  name:      { type: String, required: true },
  rarity:    { type: String, enum: ['Common', 'Rare', 'Epic', 'Legendary', 'Mythic'], default: 'Common' },
  petals:    { type: Number, default: 1 },
  collectedAt: { type: Date, default: Date.now }
}, { _id: false });

const achievementSchema = new mongoose.Schema({
  id:         { type: String, required: true },
  name:       { type: String, required: true },
  unlockedAt: { type: Date, default: Date.now }
}, { _id: false });

const userStatsSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // XP & leveling
  totalXp:   { type: Number, default: 0 },

  // Sakura petals (currency)
  petals:    { type: Number, default: 0 },

  // Daily streak
  streak:        { type: Number, default: 0 },
  lastChatDate:  { type: String, default: '' },  // "YYYY-MM-DD" format

  // First visit flag
  firstVisit:    { type: Boolean, default: true },

  // Collected artifacts
  artifacts:     [collectedArtifactSchema],

  // Achievements
  achievements:  [achievementSchema],

  // Secret Society
  societyTier:   { type: String, default: null },
  societyRank:   { type: String, default: null },

  // Puzzle trail progress
  puzzleStep:      { type: Number, default: 0 },
  puzzleCompleted: { type: Boolean, default: false },

  // Pin/archive (conversation management)
  pinnedConvIds:   [{ type: String }],
  archivedConvIds: [{ type: String }]

}, { timestamps: true });

// virtual: calculate level from totalXp
userStatsSchema.methods.getLevel = function() {
  let level = 0;
  let remaining = this.totalXp;
  while (remaining >= (100 + level * 50)) {
    remaining -= (100 + level * 50);
    level++;
  }
  return level;
};

// virtual: get title for current level
userStatsSchema.methods.getTitle = function() {
  const TITLES = [
    'Blossom Wanderer', 'Petal Seeker', 'Sakura Dreamer', 'Cherry Guardian',
    'Bloom Companion', 'Lantern Bearer', 'Shrine Keeper', 'Grove Watcher',
    'Petal Warden', 'Memory Weaver', 'Soul Guardian', 'Eternal Bloom',
    'Sakura Sentinel', 'Spirit Keeper', 'Moon Guardian', 'Blossom Sovereign',
    'Veil Walker', 'Shrine Eternal', 'Petal Sovereign', 'Divine Bloom',
    'Sakura Legend', 'Eternal Keeper', 'Spirit Sovereign', 'Moon Eternal',
    'True Guardian'
  ];
  const level = this.getLevel();
  const idx = Math.min(Math.floor(level / 10), TITLES.length - 1);
  return TITLES[idx];
};

// virtual: check and update daily streak
userStatsSchema.methods.updateStreak = function() {
  const today = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  if (this.lastChatDate === today) {
    // already chatted today — no change
    return;
  } else if (this.lastChatDate === yesterday) {
    // consecutive day — increment streak
    this.streak += 1;
  } else {
    // streak broken — reset to 1
    this.streak = 1;
  }
  this.lastChatDate = today;
};

module.exports = mongoose.model('UserStats', userStatsSchema);