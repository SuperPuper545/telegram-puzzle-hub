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
    coins INTEGER DEFAULT 0,
    daily_streak INTEGER DEFAULT 0,
    last_daily_claim DATETIME DEFAULT NULL,
    referrer_id INTEGER DEFAULT NULL,
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

  CREATE TABLE IF NOT EXISTS referrals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inviter_id INTEGER NOT NULL,
    invited_id INTEGER UNIQUE NOT NULL,
    bonus_points INTEGER DEFAULT 500,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inviter_id) REFERENCES users (id),
    FOREIGN KEY (invited_id) REFERENCES users (id)
  );

  CREATE INDEX IF NOT EXISTS idx_scores_game_score ON scores (game_id, score DESC);
  CREATE INDEX IF NOT EXISTS idx_scores_user_game ON scores (user_id, game_id);
  CREATE INDEX IF NOT EXISTS idx_referrals_inviter ON referrals (inviter_id);
`);

// Safe migrations for existing SQLite database
function addColumnIfNotExists(tableName, columnName, definition) {
  try {
    const columns = db.pragma(`table_info(${tableName})`);
    if (!columns.some(col => col.name === columnName)) {
      db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
    }
  } catch (err) {
    console.warn(`Migration notice for ${tableName}.${columnName}:`, err.message);
  }
}

addColumnIfNotExists('users', 'coins', 'INTEGER DEFAULT 0');
addColumnIfNotExists('users', 'daily_streak', 'INTEGER DEFAULT 0');
addColumnIfNotExists('users', 'last_daily_claim', 'DATETIME DEFAULT NULL');
addColumnIfNotExists('users', 'referrer_id', 'INTEGER DEFAULT NULL');


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

export function getUserById(userId) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
}

export function getUserByTelegramId(telegramId) {
  return db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(String(telegramId));
}

export const DAILY_REWARDS = [100, 200, 350, 500, 750, 1000, 2500];

export function getDailyRewardStatus(userId) {
  const user = db.prepare('SELECT id, coins, daily_streak, last_daily_claim FROM users WHERE id = ?').get(userId);
  if (!user) return null;

  const now = new Date();
  const todayUtc = now.toISOString().slice(0, 10);
  const yesterdayUtc = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  let canClaim = false;
  let currentStreak = user.daily_streak || 0;
  let nextRewardIndex = 0; // 0..6
  let lastClaimUtc = null;

  if (!user.last_daily_claim) {
    canClaim = true;
    nextRewardIndex = 0; // Day 1
  } else {
    lastClaimUtc = new Date(user.last_daily_claim).toISOString().slice(0, 10);
    if (lastClaimUtc === todayUtc) {
      canClaim = false;
      nextRewardIndex = currentStreak >= 7 ? 0 : currentStreak;
    } else if (lastClaimUtc === yesterdayUtc) {
      canClaim = true;
      nextRewardIndex = currentStreak >= 7 ? 0 : currentStreak;
    } else {
      // Missed at least 1 day -> streak reset
      canClaim = true;
      currentStreak = 0;
      nextRewardIndex = 0;
    }
  }

  return {
    coins: user.coins || 0,
    dailyStreak: currentStreak,
    canClaim,
    nextReward: DAILY_REWARDS[nextRewardIndex],
    nextRewardDay: nextRewardIndex + 1,
    rewards: DAILY_REWARDS,
    lastDailyClaim: user.last_daily_claim,
  };
}

export function claimDailyReward(userId) {
  const status = getDailyRewardStatus(userId);
  if (!status || !status.canClaim) {
    return { success: false, error: 'Награда уже получена сегодня или пользователь не найден' };
  }

  const newStreak = status.nextRewardDay; // 1..7
  const rewardAmount = DAILY_REWARDS[newStreak - 1];

  const stmt = db.prepare(`
    UPDATE users 
    SET coins = COALESCE(coins, 0) + ?,
        daily_streak = ?,
        last_daily_claim = CURRENT_TIMESTAMP
    WHERE id = ?
    RETURNING id, coins, daily_streak, last_daily_claim
  `);

  const updated = stmt.get(rewardAmount, newStreak, userId);

  return {
    success: true,
    reward: rewardAmount,
    dailyStreak: updated.daily_streak,
    coins: updated.coins,
    rewards: DAILY_REWARDS,
  };
}

export function processReferral(invitedUserId, referrerTelegramId) {
  if (!invitedUserId || !referrerTelegramId) {
    return { success: false, reason: 'missing_params' };
  }

  const cleanRefTgId = String(referrerTelegramId).replace(/^ref_/, '').trim();
  if (!cleanRefTgId) {
    return { success: false, reason: 'invalid_referrer_id' };
  }

  const invitedUser = db.prepare('SELECT id, telegram_id, referrer_id, coins FROM users WHERE id = ?').get(invitedUserId);
  if (!invitedUser) {
    return { success: false, reason: 'invited_not_found' };
  }

  let inviter = db.prepare('SELECT id, telegram_id, first_name, username, coins FROM users WHERE telegram_id = ?').get(cleanRefTgId);
  if (!inviter) {
    inviter = db.prepare('SELECT id, telegram_id, first_name, username, coins FROM users WHERE id = ?').get(cleanRefTgId);
  }

  if (!inviter) {
    return { success: false, reason: 'inviter_not_found' };
  }

  if (inviter.id === invitedUser.id || inviter.telegram_id === invitedUser.telegram_id) {
    return { success: false, reason: 'self_referral' };
  }

  if (invitedUser.referrer_id) {
    return { success: false, reason: 'already_referred' };
  }

  const BONUS = 500;

  const runTx = db.transaction(() => {
    db.prepare(`
      INSERT INTO referrals (inviter_id, invited_id, bonus_points)
      VALUES (?, ?, ?)
    `).run(inviter.id, invitedUser.id, BONUS);

    db.prepare(`
      UPDATE users 
      SET referrer_id = ?, coins = COALESCE(coins, 0) + ?
      WHERE id = ?
    `).run(inviter.id, BONUS, invitedUser.id);

    db.prepare(`
      UPDATE users
      SET coins = COALESCE(coins, 0) + ?
      WHERE id = ?
    `).run(BONUS, inviter.id);
  });

  try {
    runTx();
    return {
      success: true,
      bonus: BONUS,
      inviter: {
        id: inviter.id,
        telegramId: inviter.telegram_id,
        firstName: inviter.first_name,
        username: inviter.username,
      },
    };
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      return { success: false, reason: 'already_referred' };
    }
    throw err;
  }
}

export function getReferralsInfo(userId) {
  const user = db.prepare('SELECT id, telegram_id, coins FROM users WHERE id = ?').get(userId);
  if (!user) return null;

  const stats = db.prepare(`
    SELECT COUNT(*) as count, COALESCE(SUM(bonus_points), 0) as total_earned
    FROM referrals
    WHERE inviter_id = ?
  `).get(userId);

  const list = db.prepare(`
    SELECT 
      r.id,
      r.bonus_points,
      r.created_at,
      u.telegram_id,
      u.first_name,
      u.last_name,
      u.username,
      u.photo_url
    FROM referrals r
    JOIN users u ON r.invited_id = u.id
    WHERE r.inviter_id = ?
    ORDER BY r.created_at DESC
    LIMIT 50
  `).all(userId);

  return {
    telegramId: user.telegram_id,
    invitedCount: stats ? stats.count : 0,
    totalEarned: stats ? stats.total_earned : 0,
    referrals: list.map(item => ({
      id: item.id,
      telegramId: item.telegram_id,
      firstName: item.first_name || 'Игрок',
      lastName: item.last_name || '',
      username: item.username,
      photoUrl: item.photo_url,
      bonusPoints: item.bonus_points,
      createdAt: item.created_at,
    })),
  };
}

export default db;

