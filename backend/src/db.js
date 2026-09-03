import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../../hub.sqlite');

const db = new Database(dbPath);

// Enable WAL mode for high performance and low memory footprint
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id TEXT UNIQUE NOT NULL,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    photo_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_active DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    game_id TEXT NOT NULL,
    score INTEGER NOT NULL,
    duration_seconds INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  );

  CREATE INDEX IF NOT EXISTS idx_scores_game_score ON scores (game_id, score DESC);
  CREATE INDEX IF NOT EXISTS idx_scores_user_game ON scores (user_id, game_id);
`);

export function upsertUser(tgUser) {
  const telegramId = String(tgUser.id);
  const username = tgUser.username || null;
  const firstName = tgUser.first_name || '';
  const lastName = tgUser.last_name || '';
  const photoUrl = tgUser.photo_url || null;

  const stmt = db.prepare(`
    INSERT INTO users (telegram_id, username, first_name, last_name, photo_url, last_active)
    VALUES (@telegramId, @username, @firstName, @lastName, @photoUrl, CURRENT_TIMESTAMP)
    ON CONFLICT(telegram_id) DO UPDATE SET
      username = excluded.username,
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      photo_url = coalesce(excluded.photo_url, users.photo_url),
      last_active = CURRENT_TIMESTAMP
    RETURNING *;
  `);

  return stmt.get({
    telegramId,
    username,
    firstName,
    lastName,
    photoUrl,
  });
}

export function getUserBestScores(userId) {
  const stmt = db.prepare(`
    SELECT game_id, MAX(score) as best_score, COUNT(*) as games_played
    FROM scores
    WHERE user_id = ?
    GROUP BY game_id
  `);
  return stmt.all(userId);
}

export function recordScore(userId, gameId, score, duration = 0) {
  const safeScore = Math.max(0, parseInt(score, 10) || 0);
  const safeDuration = Math.max(0, parseInt(duration, 10) || 0);

  const prevBestStmt = db.prepare(`
    SELECT MAX(score) as best_score FROM scores WHERE user_id = ? AND game_id = ?
  `);
  const prev = prevBestStmt.get(userId, gameId);
  const prevBest = prev ? (prev.best_score || 0) : 0;
  const isNewRecord = safeScore > prevBest;

  const insertStmt = db.prepare(`
    INSERT INTO scores (user_id, game_id, score, duration_seconds)
    VALUES (?, ?, ?, ?)
  `);
  insertStmt.run(userId, gameId, safeScore, safeDuration);

  return {
    score: safeScore,
    isNewRecord,
    bestScore: Math.max(prevBest, safeScore)
  };
}

export function getLeaderboard(gameId, limit = 50) {
  const stmt = db.prepare(`
    SELECT 
      u.id as user_id,
      u.telegram_id,
      u.username,
      u.first_name,
      u.last_name,
      u.photo_url,
      MAX(s.score) as high_score,
      MAX(s.created_at) as achieved_at
    FROM scores s
    JOIN users u ON s.user_id = u.id
    WHERE s.game_id = ?
    GROUP BY u.id
    ORDER BY high_score DESC, achieved_at ASC
    LIMIT ?
  `);
  return stmt.all(gameId, limit);
}

export function getUserRank(gameId, userId) {
  const userBestStmt = db.prepare(`
    SELECT MAX(score) as score FROM scores WHERE user_id = ? AND game_id = ?
  `);
  const userBest = userBestStmt.get(userId, gameId);
  if (!userBest || userBest.score === null) {
    return null;
  }

  const rankStmt = db.prepare(`
    SELECT COUNT(DISTINCT user_id) + 1 as rank
    FROM (
      SELECT user_id, MAX(score) as best
      FROM scores
      WHERE game_id = ?
      GROUP BY user_id
    )
    WHERE best > ?
  `);
  const rank = rankStmt.get(gameId, userBest.score);
  return {
    rank: rank ? rank.rank : 1,
    score: userBest.score
  };
}

export default db;
