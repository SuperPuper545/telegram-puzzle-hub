import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { authMiddleware, validateTelegramInitData } from './auth.js';
import { 
  getUserBestScores, 
  recordScore, 
  getLeaderboard, 
  getUserRank, 
  upsertUser,
  getUserById,
  getDailyRewardStatus,
  claimDailyReward,
  processReferral,
  getReferralsInfo,
  spendCoins,
  getShopCatalog,
  buyShopItem,
  equipShopItem
} from './db.js';
import { startBotPolling } from './bot.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Lightweight middleware
app.use(cors());
app.use(express.json());

// Request logger in development
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`[${req.method}] ${req.url}`);
    next();
  });
}

// 1. Health check for VPS / PM2
app.get('/api/health', (req, res) => {
  const mem = process.memoryUsage();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    ramUsageMB: Math.round(mem.rss / (1024 * 1024) * 10) / 10,
  });
});

// 2. User profile & records (enriched with coins and streak)
app.get('/api/me', authMiddleware, (req, res) => {
  const userRecord = getUserById(req.user.id) || req.user;
  const bestScores = getUserBestScores(req.user.id);
  const dailyStatus = getDailyRewardStatus(req.user.id);
  
  // Format as a map { [gameId]: best_score }
  const scoresMap = {};
  let totalPlayed = 0;
  for (const item of bestScores) {
    scoresMap[item.game_id] = item.best_score;
    totalPlayed += item.games_played;
  }

  res.json({
    user: {
      ...req.user,
      coins: userRecord.coins || 0,
      dailyStreak: userRecord.daily_streak || 0,
      referrerId: userRecord.referrer_id || null,
      equippedBlockSkin: userRecord.equipped_block_skin || 'block_classic',
      equippedGemSkin: userRecord.equipped_gem_skin || 'gem_classic',
      equippedTitle: userRecord.equipped_title || 'title_novice',
    },
    scores: scoresMap,
    totalGamesPlayed: totalPlayed,
    dailyReward: dailyStatus,
  });
});

// 3. Submit score
app.post('/api/scores', authMiddleware, (req, res) => {
  const { gameId, score, duration } = req.body;

  if (!gameId || typeof score !== 'number') {
    return res.status(400).json({ error: 'gameId and score (number) are required' });
  }

  // Basic anti-cheat sanity checks
  if (score < 0 || score > 10000000) {
    return res.status(400).json({ error: 'Invalid score value' });
  }

  const result = recordScore(req.user.id, gameId, score, duration || 0);
  const userRank = getUserRank(gameId, req.user.id);

  res.json({
    ...result,
    rank: userRank ? userRank.rank : null,
  });
});

// 4. Global leaderboard
app.get('/api/leaderboard/:gameId', (req, res) => {
  const { gameId } = req.params;
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
  
  const leaderboard = getLeaderboard(gameId, limit);

  // If user provided auth header, calculate their rank as well
  let userRank = null;
  const authHeader = req.headers.authorization || '';
  let initData = '';
  if (authHeader.startsWith('tma ')) {
    initData = authHeader.slice(4).trim();
  }
  const tgUser = validateTelegramInitData(initData);
  if (tgUser) {
    const userRecord = upsertUser(tgUser);
    userRank = getUserRank(gameId, userRecord.id);
  }

  res.json({
    gameId,
    leaderboard: leaderboard.map((row, index) => ({
      rank: index + 1,
      userId: row.user_id,
      telegramId: row.telegram_id,
      username: row.username,
      firstName: row.first_name,
      lastName: row.last_name,
      photoUrl: row.photo_url,
      equippedTitle: row.equipped_title || 'title_novice',
      highScore: row.high_score,
      achievedAt: row.achieved_at,
    })),
    userRank,
  });
});

// 5. Referrals list & summary
app.get('/api/referrals', authMiddleware, (req, res) => {
  const referralsData = getReferralsInfo(req.user.id);
  if (!referralsData) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({
    ...referralsData,
    botUsername: process.env.BOT_USERNAME || 'taptaphub_bot',
  });
});

// 6. Claim referral via start_param from TMA
app.post('/api/referrals/claim', authMiddleware, (req, res) => {
  const { startParam } = req.body;
  if (!startParam) {
    return res.status(400).json({ error: 'startParam is required' });
  }

  const result = processReferral(req.user.id, startParam);
  if (!result.success) {
    return res.status(400).json(result);
  }

  const userRecord = getUserById(req.user.id);
  res.json({
    ...result,
    newCoins: userRecord ? userRecord.coins : 0,
  });
});

// 7. Daily reward calendar status
app.get('/api/daily-reward/status', authMiddleware, (req, res) => {
  const status = getDailyRewardStatus(req.user.id);
  if (!status) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(status);
});

// 8. Claim daily reward
app.post('/api/daily-reward/claim', authMiddleware, (req, res) => {
  const result = claimDailyReward(req.user.id);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

// 9. Spend coins (in-game boosters)
app.post('/api/coins/spend', authMiddleware, (req, res) => {
  const { amount, reason } = req.body;
  const result = spendCoins(req.user.id, amount, reason);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

// 10. Shop items catalog
app.get('/api/shop/items', authMiddleware, (req, res) => {
  const catalog = getShopCatalog(req.user.id);
  if (!catalog) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(catalog);
});

// 11. Buy item in shop
app.post('/api/shop/buy', authMiddleware, (req, res) => {
  const { itemId } = req.body;
  if (!itemId) {
    return res.status(400).json({ error: 'itemId is required' });
  }
  const result = buyShopItem(req.user.id, itemId);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

// 12. Equip item in shop
app.post('/api/shop/equip', authMiddleware, (req, res) => {
  const { itemId } = req.body;
  if (!itemId) {
    return res.status(400).json({ error: 'itemId is required' });
  }
  const result = equipShopItem(req.user.id, itemId);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

// 5. Serve frontend dist in production (if available)
const frontendDist = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.url.startsWith('/api')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 Telegram Puzzle Hub backend running on http://localhost:${PORT}`);
  console.log(`⚡ Memory: ${(process.memoryUsage().rss / 1024 / 1024).toFixed(1)} MB`);
  
  // Start Telegram Bot polling
  startBotPolling().catch(err => {
    console.error('Failed to start Telegram Bot polling:', err);
  });
});
