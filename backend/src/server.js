import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { authMiddleware, validateTelegramInitData } from './auth.js';
import { 
  getUserBestScores, 
  recordScore, 
  getLeaderboard, 
  getUserRank, 
  upsertUser 
} from './db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// 2. User profile & records
app.get('/api/me', authMiddleware, (req, res) => {
  const bestScores = getUserBestScores(req.user.id);
  
  // Format as a map { [gameId]: best_score }
  const scoresMap = {};
  let totalPlayed = 0;
  for (const item of bestScores) {
    scoresMap[item.game_id] = item.best_score;
    totalPlayed += item.games_played;
  }

  res.json({
    user: req.user,
    scores: scoresMap,
    totalGamesPlayed: totalPlayed,
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
      highScore: row.high_score,
      achievedAt: row.achieved_at,
    })),
    userRank,
  });
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
});
