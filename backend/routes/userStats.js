// ── routes/userStats.js ──
// All progression API endpoints: stats, XP, artifacts, achievements, society, community counts

const express = require('express');
const router  = express.Router();
const UserStats = require('../models/UserStats');

// ── helper: find or create user stats document ──
async function findOrCreate(userId) {
  let stats = await UserStats.findOne({ userId });
  if (!stats) {
    stats = new UserStats({ userId });
    await stats.save();
  }
  return stats;
}

/* ══════════════════════════════
   GET /api/user-stats?userId=
   Returns current user progression data
══════════════════════════════ */
router.get('/user-stats', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const stats = await findOrCreate(userId);
    const level = stats.getLevel();
    const title = stats.getTitle();

    res.json({
      level,
      title,
      totalXp:    stats.totalXp,
      petals:     stats.petals,
      streak:     stats.streak,
      firstVisit: stats.firstVisit,
      artifacts:  stats.artifacts.length,
      achievements: stats.achievements.length,
      societyTier: stats.societyTier,
      societyRank: stats.societyRank
    });
  } catch (err) {
    console.error('[user-stats] GET error:', err.message);
    res.status(500).json({ error: 'Failed to fetch user stats' });
  }
});

/* ══════════════════════════════
   POST /api/user-stats/xp
   Awards XP after a completed conversation
   Body: { userId, xp }
   Returns updated stats
══════════════════════════════ */
router.post('/user-stats/xp', async (req, res) => {
  try {
    const { userId, xp } = req.body;
    if (!userId || typeof xp !== 'number') {
      return res.status(400).json({ error: 'userId and xp (number) required' });
    }

    const stats = await findOrCreate(userId);
    const oldLevel = stats.getLevel();

    stats.totalXp += xp;
    stats.updateStreak();

    // mark first visit as done
    if (stats.firstVisit) stats.firstVisit = false;

    await stats.save();

    const newLevel = stats.getLevel();
    const title    = stats.getTitle();

    // milestone petal bonus at levels 25, 50, 75, 100, etc.
    if (newLevel > oldLevel) {
      const milestones = [25, 50, 75, 100, 125, 150, 175, 200, 250, 300, 400, 500];
      for (const m of milestones) {
        if (oldLevel < m && newLevel >= m) {
          const bonus = Math.floor(m / 5); // 5 petals at 25, 10 at 50, 20 at 100, etc.
          stats.petals += bonus;
          await stats.save();
          break;
        }
      }
    }

    res.json({
      totalXp: stats.totalXp,
      level:   newLevel,
      title,
      petals:  stats.petals,
      streak:  stats.streak
    });
  } catch (err) {
    console.error('[user-stats] POST /xp error:', err.message);
    res.status(500).json({ error: 'Failed to award XP' });
  }
});

/* ══════════════════════════════
   POST /api/user-stats/collect
   Collects an artifact (Easter egg, city, seasonal, etc.)
   Body: { userId, artifact, rarity, petals }
══════════════════════════════ */
router.post('/user-stats/collect', async (req, res) => {
  try {
    const { userId, artifact, rarity, petals } = req.body;
    if (!userId || !artifact) {
      return res.status(400).json({ error: 'userId and artifact required' });
    }

    const stats = await findOrCreate(userId);

    // add artifact to collection
    stats.artifacts.push({
      name:   artifact,
      rarity: rarity || 'Common',
      petals: petals || 1
    });

    // add petals
    stats.petals += (petals || 1);

    await stats.save();

    res.json({
      petals:         stats.petals,
      totalArtifacts: stats.artifacts.length,
      collected:      artifact
    });
  } catch (err) {
    console.error('[user-stats] POST /collect error:', err.message);
    res.status(500).json({ error: 'Failed to collect artifact' });
  }
});

/* ══════════════════════════════
   POST /api/user-stats/achievement
   Records a new achievement
   Body: { userId, achievementId, name }
══════════════════════════════ */
router.post('/user-stats/achievement', async (req, res) => {
  try {
    const { userId, achievementId, name } = req.body;
    if (!userId || !achievementId) {
      return res.status(400).json({ error: 'userId and achievementId required' });
    }

    const stats = await findOrCreate(userId);

    // prevent duplicate
    const exists = stats.achievements.some(a => a.id === achievementId);
    if (exists) return res.json({ status: 'already_unlocked' });

    stats.achievements.push({ id: achievementId, name: name || achievementId });
    await stats.save();

    res.json({ status: 'unlocked', achievement: name });
  } catch (err) {
    console.error('[user-stats] POST /achievement error:', err.message);
    res.status(500).json({ error: 'Failed to record achievement' });
  }
});

/* ══════════════════════════════
   POST /api/user-stats/society
   Updates secret society tier/rank
   Body: { userId, tier, rank }
══════════════════════════════ */
router.post('/user-stats/society', async (req, res) => {
  try {
    const { userId, tier, rank } = req.body;
    if (!userId || !tier) {
      return res.status(400).json({ error: 'userId and tier required' });
    }

    const stats = await findOrCreate(userId);
    stats.societyTier = tier;
    stats.societyRank = rank || null;
    await stats.save();

    res.json({ status: 'updated', tier, rank });
  } catch (err) {
    console.error('[user-stats] POST /society error:', err.message);
    res.status(500).json({ error: 'Failed to update society tier' });
  }
});

/* ══════════════════════════════
   GET /api/artifacts/count?name=
   Returns how many users own a specific artifact (community counter)
══════════════════════════════ */
router.get('/artifacts/count', async (req, res) => {
  try {
    const { name } = req.query;
    if (!name) return res.status(400).json({ error: 'artifact name required' });

    const count = await UserStats.countDocuments({
      'artifacts.name': name
    });

    res.json({ name, count });
  } catch (err) {
    console.error('[artifacts] GET /count error:', err.message);
    res.status(500).json({ error: 'Failed to fetch artifact count' });
  }
});

/* ══════════════════════════════
   PATCH /api/conversations/:id/pin
   Updates pin state for a conversation
   Body: { pinned: true/false }
══════════════════════════════ */
router.patch('/conversations/:id/pin', async (req, res) => {
  try {
    const { id } = req.params;
    const { pinned } = req.body;
    const userId = req.body.userId || req.query.userId;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const stats = await findOrCreate(userId);

    if (pinned && !stats.pinnedConvIds.includes(id)) {
      stats.pinnedConvIds.push(id);
    } else if (!pinned) {
      stats.pinnedConvIds = stats.pinnedConvIds.filter(c => c !== id);
    }

    await stats.save();
    res.json({ status: 'updated', pinned: stats.pinnedConvIds });
  } catch (err) {
    console.error('[pin] PATCH error:', err.message);
    res.status(500).json({ error: 'Failed to update pin state' });
  }
});

/* ══════════════════════════════
   PATCH /api/conversations/:id/archive
   Updates archive state for a conversation
   Body: { archived: true/false }
══════════════════════════════ */
router.patch('/conversations/:id/archive', async (req, res) => {
  try {
    const { id } = req.params;
    const { archived } = req.body;
    const userId = req.body.userId || req.query.userId;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const stats = await findOrCreate(userId);

    if (archived && !stats.archivedConvIds.includes(id)) {
      stats.archivedConvIds.push(id);
    } else if (!archived) {
      stats.archivedConvIds = stats.archivedConvIds.filter(c => c !== id);
    }

    await stats.save();
    res.json({ status: 'updated', archived: stats.archivedConvIds });
  } catch (err) {
    console.error('[archive] PATCH error:', err.message);
    res.status(500).json({ error: 'Failed to update archive state' });
  }
});

module.exports = router;