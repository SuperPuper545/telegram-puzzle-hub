import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
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

  CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    item_id TEXT NOT NULL,
    category TEXT NOT NULL,
    price INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id),
    UNIQUE(user_id, item_id)
  );

  CREATE INDEX IF NOT EXISTS idx_scores_game_score ON scores (game_id, score DESC);
  CREATE INDEX IF NOT EXISTS idx_scores_user_game ON scores (user_id, game_id);
  CREATE INDEX IF NOT EXISTS idx_referrals_inviter ON referrals (inviter_id);
  CREATE INDEX IF NOT EXISTS idx_purchases_user ON purchases (user_id);

  CREATE TABLE IF NOT EXISTS duel_rooms (
    id TEXT PRIMARY KEY,
    game_type TEXT NOT NULL,
    bet_amount INTEGER DEFAULT 0,
    host_user_id INTEGER NOT NULL,
    guest_user_id INTEGER,
    status TEXT DEFAULT 'waiting',
    winner_user_id INTEGER,
    is_draw INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    finished_at DATETIME,
    FOREIGN KEY (host_user_id) REFERENCES users (id)
  );

  CREATE TABLE IF NOT EXISTS duel_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id TEXT NOT NULL,
    player1_id INTEGER NOT NULL,
    player2_id INTEGER NOT NULL,
    game_type TEXT NOT NULL,
    bet_amount INTEGER DEFAULT 0,
    winner_id INTEGER,
    is_draw INTEGER DEFAULT 0,
    commission INTEGER DEFAULT 0,
    player1_payout INTEGER DEFAULT 0,
    player2_payout INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_duel_rooms_status ON duel_rooms (status);
  CREATE INDEX IF NOT EXISTS idx_duel_history_p1 ON duel_history (player1_id);
  CREATE INDEX IF NOT EXISTS idx_duel_history_p2 ON duel_history (player2_id);

  CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_chat_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    username TEXT,
    photo_url TEXT,
    color TEXT DEFAULT '#6366f1',
    treasury_tokens INTEGER DEFAULT 0,
    tokens_expire_at DATETIME DEFAULT NULL,
    commander_user_id INTEGER DEFAULT NULL,
    score_boost_until DATETIME DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (commander_user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS world_map (
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    group_id INTEGER DEFAULT NULL,
    level INTEGER DEFAULT 0,
    is_monument INTEGER DEFAULT 0,
    monument_id INTEGER DEFAULT NULL,
    captured_at DATETIME DEFAULT NULL,
    shield_until DATETIME DEFAULT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (x, y),
    FOREIGN KEY (group_id) REFERENCES groups(id)
  );

  CREATE TABLE IF NOT EXISTS monuments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    name TEXT,
    origin_x INTEGER NOT NULL,
    origin_y INTEGER NOT NULL,
    size INTEGER DEFAULT 3,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES groups(id)
  );

  CREATE TABLE IF NOT EXISTS cycle_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cycle_number INTEGER NOT NULL,
    group_id INTEGER NOT NULL,
    rank INTEGER NOT NULL,
    total_score INTEGER DEFAULT 0,
    tokens_awarded INTEGER DEFAULT 0,
    cycle_end_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS map_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    x INTEGER,
    y INTEGER,
    tokens_spent INTEGER DEFAULT 0,
    coins_spent INTEGER DEFAULT 0,
    stars_spent INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS stars_purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    product_id TEXT NOT NULL,
    stars_amount INTEGER NOT NULL,
    payload TEXT,
    telegram_payment_charge_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS cycle_metadata (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    current_cycle_number INTEGER DEFAULT 1,
    cycle_start_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  INSERT OR IGNORE INTO cycle_metadata (id, current_cycle_number, cycle_start_at) VALUES (1, 1, CURRENT_TIMESTAMP);
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
addColumnIfNotExists('users', 'equipped_block_skin', "TEXT DEFAULT 'block_classic'");
addColumnIfNotExists('users', 'equipped_gem_skin', "TEXT DEFAULT 'gem_classic'");
addColumnIfNotExists('users', 'equipped_tile_skin', "TEXT DEFAULT 'tile_classic'");
addColumnIfNotExists('users', 'equipped_bird_skin', "TEXT DEFAULT 'bird_classic'");
addColumnIfNotExists('users', 'equipped_stack_skin', "TEXT DEFAULT 'stack_classic'");
addColumnIfNotExists('users', 'equipped_knife_skin', "TEXT DEFAULT 'knife_classic'");
addColumnIfNotExists('users', 'group_id', 'INTEGER DEFAULT NULL');
addColumnIfNotExists('users', 'group_joined_at', 'DATETIME DEFAULT NULL');
addColumnIfNotExists('users', 'score_booster_until', 'DATETIME DEFAULT NULL');
addColumnIfNotExists('groups', 'score_boost_until', 'DATETIME DEFAULT NULL');
addColumnIfNotExists('world_map', 'shield_until', 'DATETIME DEFAULT NULL');
addColumnIfNotExists('world_map', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
addColumnIfNotExists('world_map', 'is_land', 'INTEGER DEFAULT 0');
addColumnIfNotExists('world_map', 'region_name', 'TEXT DEFAULT NULL');
addColumnIfNotExists('duel_rooms', 'is_ranked', 'INTEGER DEFAULT 0');

// Seed world_map (80 x 60 = 4800 cells) if empty
try {
  const mapCountRow = db.prepare('SELECT COUNT(*) as count FROM world_map').get();
  if (!mapCountRow || mapCountRow.count === 0) {
    const insertCell = db.prepare('INSERT INTO world_map (x, y, group_id, level, is_monument, monument_id, updated_at) VALUES (?, ?, NULL, 0, 0, NULL, CURRENT_TIMESTAMP)');
    const seedTx = db.transaction(() => {
      for (let x = 0; x < 80; x++) {
        for (let y = 0; y < 60; y++) {
          insertCell.run(x, y);
        }
      }
    });
    seedTx();
    console.log('✅ World map initialized (4800 cells)');
  }
  
  // Check and apply real world landmask
  const landmaskFile = path.resolve(__dirname, './world_landmask.json');
  if (fs.existsSync(landmaskFile)) {
    const checkLandCount = db.prepare('SELECT COUNT(*) as count FROM world_map WHERE is_land = 1').get();
    const checkNamedCount = db.prepare("SELECT COUNT(*) as count FROM world_map WHERE region_name IS NOT NULL AND region_name != ''").get();
    if (!checkLandCount || checkLandCount.count === 0 || !checkNamedCount || checkNamedCount.count < 1000) {
      console.log('🌍 Applying Real Earth Landmask to world_map (80x60)...');
      const landData = JSON.parse(fs.readFileSync(landmaskFile, 'utf8'));
      const updateStmt = db.prepare('UPDATE world_map SET is_land = ?, region_name = ? WHERE x = ? AND y = ?');
      const updateTx = db.transaction(() => {
        for (let y = 0; y < 60; y++) {
          for (let x = 0; x < 80; x++) {
            const isLand = (landData.grid && landData.grid[y] && landData.grid[y][x]) ? 1 : 0;
            const regionName = (landData.ru_names && landData.ru_names[y] && landData.ru_names[y][x]) || (landData.names && landData.names[y] && landData.names[y][x]) || null;
            updateStmt.run(isLand, regionName, x, y);
          }
        }
      });
      updateTx();
      console.log('✅ Real Earth Landmask applied with Russian regions');
    }
  }
} catch (err) {
  console.warn('World map init notice:', err.message);
}



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

export function parseDbTime(val) {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  const s = String(val).trim();
  const iso = (s.endsWith('Z') || s.includes('+')) ? s : (s.replace(' ', 'T') + 'Z');
  const t = new Date(iso).getTime();
  return isNaN(t) ? 0 : t;
}

export function recordScore(userId, gameId, score, duration = 0) {
  let safeScore = Math.max(0, parseInt(score, 10) || 0);
  const safeDuration = Math.max(0, parseInt(duration, 10) || 0);

  // Apply Score Booster x2 if active (strictly on server)
  const user = db.prepare('SELECT score_booster_until, group_id FROM users WHERE id = ?').get(userId);
  let isBoosterActive = false;
  if (user && user.score_booster_until) {
    if (parseDbTime(user.score_booster_until) > Date.now()) {
      safeScore = Math.round(safeScore * 2);
      isBoosterActive = true;
    }
  }

  // Apply Group Boost x1.5 if active (from Stars)
  if (user && user.group_id) {
    const grp = db.prepare('SELECT score_boost_until FROM groups WHERE id = ?').get(user.group_id);
    if (grp && grp.score_boost_until && parseDbTime(grp.score_boost_until) > Date.now()) {
      safeScore = Math.round(safeScore * 1.5);
    }
  }

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
    bestScore: Math.max(prevBest, safeScore),
    isBoosterActive,
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
      u.equipped_title,
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

export const SHOP_ITEMS = [
  // Blockudoku Skins
  { id: 'block_classic', category: 'block_skin', name: 'Классический Синий', description: 'Строгие лаконичные блоки чистого синего цвета', price: 0, previewColor: '#2563eb' },
  { id: 'block_colorful', category: 'block_skin', name: 'Красочный Микс', description: 'Сочные разноцветные блоки для каждой фигуры', price: 400, previewColor: '#10b981' },
  { id: 'block_gradient', category: 'block_skin', name: 'Мягкий Градиент', description: 'Аккуратный переливающийся градиент без лишних свечений', price: 800, previewColor: '#6366f1' },
  { id: 'block_neon', category: 'block_skin', name: 'Розовый Неон', description: 'Деликатный розоватый неон с мягким неслепящим ореолом', price: 1200, previewColor: '#f43f5e' },

  // Match-3 Gem Skins
  { id: 'gem_classic', category: 'gem_skin', name: 'Стандарт', description: 'Чистые лаконичные кристаллы', price: 0, previewColor: '#ec4899' },
  { id: 'gem_orbs', category: 'gem_skin', name: 'Кнопачки', description: 'Стильные тактильные кнопочки', price: 500, previewColor: '#8b5cf6' },
  { id: 'gem_candy', category: 'gem_skin', name: 'Сладкие конфеты', description: 'Яркие леденцы и мармеладки', price: 1000, previewColor: '#f43f5e' },

  // 2048 Tile Skins
  { id: 'tile_classic', category: 'tile_skin', name: 'Классик 2048', description: 'Теплые классические оранжевые плитки', price: 0, previewColor: '#edc22e', icon: '🔢' },
  { id: 'tile_neon', category: 'tile_skin', name: 'Неоновый Драйв', description: 'Яркие киберпанк градиенты и свечение', price: 500, previewColor: '#06b6d4', icon: '⚡' },
  { id: 'tile_retro', category: 'tile_skin', name: 'Ретро Аркада', description: 'Стиль 8-битной игровой консоли', price: 1000, previewColor: '#8b5cf6', icon: '🕹️' },
  { id: 'tile_gold', category: 'tile_skin', name: 'Золотой Люкс', description: 'Роскошные золотые слитки с блеском', price: 1500, previewColor: '#f59e0b', icon: '👑' },

  // Flappy Hub Bird Skins
  { id: 'bird_classic', category: 'bird_skin', name: 'Классическая ласточка', description: 'Стандартная птичка Хаба', price: 0, previewColor: '#f59e0b', icon: '🕊️' },
  { id: 'bird_phoenix', category: 'bird_skin', name: 'Золотой Феникс', description: 'Пылающее огненное оперение', price: 300, previewColor: '#ea580c', icon: '🦅' },
  { id: 'bird_drone', category: 'bird_skin', name: 'Кибер-Дрон', description: 'Неоновый технологичный дрон', price: 600, previewColor: '#06b6d4', icon: '🛸' },
  { id: 'bird_cosmic', category: 'bird_skin', name: 'Космическая Сова', description: 'Звездное галактическое сияние', price: 1000, previewColor: '#8b5cf6', icon: '🦉' },

  // Tower Stack Skins
  { id: 'stack_classic', category: 'stack_skin', name: 'Неоновый Спектр', description: 'Плавная динамическая смена спектра', price: 0, previewColor: '#38bdf8', icon: '🌈' },
  { id: 'stack_amethyst', category: 'stack_skin', name: 'Аметист и Роза', description: 'Кристаллические сиренево-розовые блоки', price: 400, previewColor: '#c084fc', icon: '💎' },
  { id: 'stack_emerald', category: 'stack_skin', name: 'Изумрудный Нефрит', description: 'Благородные зеленые нефритовые плиты', price: 700, previewColor: '#10b981', icon: '🟢' },
  { id: 'stack_gold', category: 'stack_skin', name: 'Золотой Пентхаус', description: 'Премиальные золотые блоки с блеском', price: 1200, previewColor: '#f59e0b', icon: '👑' },

  // Knife Master Skins
  { id: 'knife_classic', category: 'knife_skin', name: 'Стальной кортик', description: 'Классический закаленный клинок', price: 0, previewColor: '#e2e8f0', icon: '🗡️' },
  { id: 'knife_flame', category: 'knife_skin', name: 'Пламенный Кукри', description: 'Раскаленное докрасна лезвие', price: 400, previewColor: '#ef4444', icon: '🔥' },
  { id: 'knife_kunai', category: 'knife_skin', name: 'Неоновый Кунай', description: 'Лазерный клинок кибер-ниндзя', price: 700, previewColor: '#06b6d4', icon: '⚡' },
  { id: 'knife_dragon', category: 'knife_skin', name: 'Клык Дракона', description: 'Древнее мифическое драконье лезвие', price: 1200, previewColor: '#eab308', icon: '🐉' },
];

export function spendCoins(userId, amount, reason = 'booster') {
  const safeAmount = Math.max(0, parseInt(amount, 10) || 0);
  if (safeAmount <= 0) {
    return { success: false, error: 'Invalid amount' };
  }

  const user = db.prepare('SELECT id, coins FROM users WHERE id = ?').get(userId);
  if (!user) {
    return { success: false, error: 'User not found' };
  }

  if ((user.coins || 0) < safeAmount) {
    return { 
      success: false, 
      error: 'Недостаточно монет', 
      coinsNeeded: safeAmount, 
      coinsHave: user.coins || 0 
    };
  }

  const updated = db.prepare(`
    UPDATE users 
    SET coins = coins - ? 
    WHERE id = ? AND coins >= ?
    RETURNING id, coins
  `).get(safeAmount, userId, safeAmount);

  if (!updated) {
    return { success: false, error: 'Недостаточно монет' };
  }

  return {
    success: true,
    spent: safeAmount,
    reason,
    remainingCoins: updated.coins,
  };
}

export function awardCoins(userId, amount, reason = 'bonus') {
  const safeAmount = Math.max(0, parseInt(amount, 10) || 0);
  if (safeAmount <= 0) {
    return { success: false, error: 'Invalid amount' };
  }
  const updated = db.prepare(`
    UPDATE users 
    SET coins = coins + ? 
    WHERE id = ?
    RETURNING id, coins
  `).get(safeAmount, userId);

  return {
    success: true,
    awarded: safeAmount,
    reason,
    coins: updated?.coins ?? 0,
  };
}

export function getShopCatalog(userId) {
  const user = db.prepare(`
    SELECT id, coins, equipped_block_skin, equipped_gem_skin, equipped_tile_skin,
           equipped_bird_skin, equipped_stack_skin, equipped_knife_skin, equipped_title 
    FROM users 
    WHERE id = ?
  `).get(userId);
  if (!user) return null;

  const purchases = db.prepare('SELECT item_id FROM purchases WHERE user_id = ?').all(userId);
  const purchasedSet = new Set(purchases.map(p => p.item_id));

  const equippedBlock = user.equipped_block_skin || 'block_classic';
  const equippedGem = user.equipped_gem_skin || 'gem_classic';
  const equippedTile = user.equipped_tile_skin || 'tile_classic';
  const equippedBird = user.equipped_bird_skin || 'bird_classic';
  const equippedStack = user.equipped_stack_skin || 'stack_classic';
  const equippedKnife = user.equipped_knife_skin || 'knife_classic';
  const equippedTitle = user.equipped_title || 'title_novice';

  const items = SHOP_ITEMS.map(item => {
    const isFree = item.price === 0;
    const isPurchased = isFree || purchasedSet.has(item.id);
    const isEquipped = 
      item.id === equippedBlock || 
      item.id === equippedGem || 
      item.id === equippedTile ||
      item.id === equippedBird ||
      item.id === equippedStack ||
      item.id === equippedKnife ||
      item.id === equippedTitle;

    return {
      ...item,
      isPurchased,
      isEquipped,
    };
  });

  return {
    coins: user.coins || 0,
    equipped: {
      blockSkin: equippedBlock,
      gemSkin: equippedGem,
      tileSkin: equippedTile,
      birdSkin: equippedBird,
      stackSkin: equippedStack,
      knifeSkin: equippedKnife,
      title: equippedTitle,
    },
    items,
  };
}

export function buyShopItem(userId, itemId) {
  const item = SHOP_ITEMS.find(i => i.id === itemId);
  if (!item) {
    return { success: false, error: 'Предмет не найден' };
  }

  const user = db.prepare(`
    SELECT id, coins 
    FROM users 
    WHERE id = ?
  `).get(userId);
  if (!user) {
    return { success: false, error: 'Пользователь не найден' };
  }

  if (item.price > 0) {
    const existing = db.prepare('SELECT id FROM purchases WHERE user_id = ? AND item_id = ?').get(userId, itemId);
    if (existing) {
      return { success: false, error: 'Предмет уже куплен' };
    }

    if ((user.coins || 0) < item.price) {
      return { 
        success: false, 
        error: 'Недостаточно монет для покупки', 
        price: item.price, 
        coinsHave: user.coins || 0 
      };
    }
  }

  let colName = 'equipped_block_skin';
  if (item.category === 'gem_skin') colName = 'equipped_gem_skin';
  if (item.category === 'tile_skin') colName = 'equipped_tile_skin';
  if (item.category === 'bird_skin') colName = 'equipped_bird_skin';
  if (item.category === 'stack_skin') colName = 'equipped_stack_skin';
  if (item.category === 'knife_skin') colName = 'equipped_knife_skin';

  const tx = db.transaction(() => {
    if (item.price > 0) {
      db.prepare('UPDATE users SET coins = coins - ? WHERE id = ?').run(item.price, userId);
      db.prepare('INSERT INTO purchases (user_id, item_id, category, price) VALUES (?, ?, ?, ?)').run(userId, itemId, item.category, item.price);
    }
    db.prepare(`UPDATE users SET ${colName} = ? WHERE id = ?`).run(itemId, userId);
  });

  tx();

  const updatedUser = db.prepare(`
    SELECT coins, equipped_block_skin, equipped_gem_skin, equipped_tile_skin,
           equipped_bird_skin, equipped_stack_skin, equipped_knife_skin 
    FROM users 
    WHERE id = ?
  `).get(userId);

  return {
    success: true,
    item,
    remainingCoins: updatedUser.coins,
    equipped: {
      blockSkin: updatedUser.equipped_block_skin,
      gemSkin: updatedUser.equipped_gem_skin,
      tileSkin: updatedUser.equipped_tile_skin,
      birdSkin: updatedUser.equipped_bird_skin,
      stackSkin: updatedUser.equipped_stack_skin,
      knifeSkin: updatedUser.equipped_knife_skin,
    },
  };
}

export function equipShopItem(userId, itemId) {
  const item = SHOP_ITEMS.find(i => i.id === itemId);
  if (!item) {
    return { success: false, error: 'Предмет не найден' };
  }

  if (item.price > 0) {
    const purchase = db.prepare('SELECT id FROM purchases WHERE user_id = ? AND item_id = ?').get(userId, itemId);
    if (!purchase) {
      return { success: false, error: 'Сначала необходимо приобрести этот предмет' };
    }
  }

  let colName = 'equipped_block_skin';
  if (item.category === 'gem_skin') colName = 'equipped_gem_skin';
  if (item.category === 'tile_skin') colName = 'equipped_tile_skin';
  if (item.category === 'bird_skin') colName = 'equipped_bird_skin';
  if (item.category === 'stack_skin') colName = 'equipped_stack_skin';
  if (item.category === 'knife_skin') colName = 'equipped_knife_skin';

  db.prepare(`UPDATE users SET ${colName} = ? WHERE id = ?`).run(itemId, userId);

  const updatedUser = db.prepare(`
    SELECT equipped_block_skin, equipped_gem_skin, equipped_tile_skin,
           equipped_bird_skin, equipped_stack_skin, equipped_knife_skin 
    FROM users 
    WHERE id = ?
  `).get(userId);

  return {
    success: true,
    equipped: {
      blockSkin: updatedUser.equipped_block_skin,
      gemSkin: updatedUser.equipped_gem_skin,
      tileSkin: updatedUser.equipped_tile_skin,
      birdSkin: updatedUser.equipped_bird_skin,
      stackSkin: updatedUser.equipped_stack_skin,
      knifeSkin: updatedUser.equipped_knife_skin,
    },
  };
}

export default db;

// ─── DUEL FUNCTIONS ──────────────────────────────────────────────────────────

/**
 * Freeze (deduct) bet coins from a user at duel start.
 * Returns { success, remainingCoins } or { success: false, error }
 */
export function freezeCoins(userId, amount) {
  if (!amount || amount <= 0) return { success: true, remainingCoins: null };

  const user = db.prepare('SELECT id, coins FROM users WHERE id = ?').get(userId);
  if (!user) return { success: false, error: 'User not found' };
  if ((user.coins || 0) < amount) {
    return { success: false, error: 'Недостаточно монет', coinsHave: user.coins || 0 };
  }

  const updated = db.prepare(`
    UPDATE users SET coins = coins - ? WHERE id = ? AND coins >= ?
    RETURNING id, coins
  `).get(amount, userId, amount);

  if (!updated) return { success: false, error: 'Недостаточно монет' };
  return { success: true, remainingCoins: updated.coins };
}

/**
 * Settle a finished duel: award winner 90% of pot, burn 10% commission.
 * On draw: refund both players fully (no commission).
 * On 0-bet friendly match: no money movement.
 */
export function settleDuel(roomId, player1Id, player2Id, winnerId, betAmount, isDraw = false) {
  if (!betAmount || betAmount <= 0) {
    // Friendly match — just record history
    db.prepare(`
      INSERT OR IGNORE INTO duel_history
        (room_id, player1_id, player2_id, game_type, bet_amount, winner_id, is_draw, commission, player1_payout, player2_payout)
      SELECT id, ?, ?, game_type, 0, ?, ?, 0, 0, 0 FROM duel_rooms WHERE id = ?
    `).run(player1Id, player2Id, isDraw ? null : winnerId, isDraw ? 1 : 0, roomId);

    db.prepare(`UPDATE duel_rooms SET status='finished', winner_user_id=?, is_draw=?, finished_at=CURRENT_TIMESTAMP WHERE id=?`)
      .run(isDraw ? null : winnerId, isDraw ? 1 : 0, roomId);

    return { success: true, payout: 0, commission: 0 };
  }

  const pot = betAmount * 2;

  if (isDraw) {
    // Refund both players
    const tx = db.transaction(() => {
      db.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').run(betAmount, player1Id);
      db.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').run(betAmount, player2Id);
      db.prepare(`
        INSERT OR IGNORE INTO duel_history
          (room_id, player1_id, player2_id, game_type, bet_amount, winner_id, is_draw, commission, player1_payout, player2_payout)
        SELECT id, ?, ?, game_type, ?, null, 1, 0, ?, ? FROM duel_rooms WHERE id = ?
      `).run(player1Id, player2Id, betAmount, betAmount, betAmount, roomId);
      db.prepare(`UPDATE duel_rooms SET status='finished', is_draw=1, finished_at=CURRENT_TIMESTAMP WHERE id=?`)
        .run(roomId);
    });
    tx();
    return { success: true, payout: betAmount, commission: 0, isDraw: true };
  }

  // Winner takes 90%
  const commission = Math.floor(pot * 0.10);
  const payout = pot - commission;
  const loserId = winnerId === player1Id ? player2Id : player1Id;
  const winnerPayout = payout;
  const loserPayout = 0;

  const tx = db.transaction(() => {
    db.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').run(winnerPayout, winnerId);
    db.prepare(`
      INSERT OR IGNORE INTO duel_history
        (room_id, player1_id, player2_id, game_type, bet_amount, winner_id, is_draw, commission, player1_payout, player2_payout)
      SELECT id, ?, ?, game_type, ?, ?, 0, ?, ?, ? FROM duel_rooms WHERE id = ?
    `).run(player1Id, player2Id, betAmount, winnerId, commission,
           winnerId === player1Id ? winnerPayout : loserPayout,
           winnerId === player2Id ? winnerPayout : loserPayout,
           roomId);
    db.prepare(`UPDATE duel_rooms SET status='finished', winner_user_id=?, finished_at=CURRENT_TIMESTAMP WHERE id=?`)
      .run(winnerId, roomId);

    // Ranked Duel check (300 coins bet or is_ranked = 1): winner gains 150 points in group rating
    try {
      const roomRow = db.prepare('SELECT is_ranked, bet_amount FROM duel_rooms WHERE id = ?').get(roomId);
      if (roomRow && (roomRow.is_ranked === 1 || roomRow.bet_amount === 300)) {
        recordScore(winnerId, 'pvp_ranked', 150, 0);
      }
    } catch (e) {
      console.warn('Ranked duel score note:', e.message);
    }
  });
  tx();

  return { success: true, payout: winnerPayout, commission, loserId };
}

/**
 * Get duel history for a user (last N matches)
 */
export function getDuelHistory(userId, limit = 20) {
  return db.prepare(`
    SELECT
      dh.id, dh.room_id, dh.game_type, dh.bet_amount,
      dh.winner_id, dh.is_draw, dh.commission,
      dh.player1_payout, dh.player2_payout, dh.created_at,
      u1.first_name as p1_name, u1.username as p1_username, u1.telegram_id as p1_tg_id,
      u2.first_name as p2_name, u2.username as p2_username, u2.telegram_id as p2_tg_id
    FROM duel_history dh
    JOIN users u1 ON dh.player1_id = u1.id
    JOIN users u2 ON dh.player2_id = u2.id
    WHERE dh.player1_id = ? OR dh.player2_id = ?
    ORDER BY dh.created_at DESC
    LIMIT ?
  `).all(userId, userId, limit);
}

/**
 * Create a duel room record in the database
 */
export function createDuelRoom(roomId, gameType, betAmount, hostUserId, isRanked = 0) {
  const rankedFlag = isRanked || (betAmount === 300 ? 1 : 0);
  db.prepare(`
    INSERT OR IGNORE INTO duel_rooms (id, game_type, bet_amount, host_user_id, status, is_ranked)
    VALUES (?, ?, ?, ?, 'waiting', ?)
  `).run(roomId, gameType, betAmount, hostUserId, rankedFlag);
}

/**
 * Get user duel stats summary
 */
export function getDuelStats(userId) {
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN winner_id = ? THEN 1 ELSE 0 END) as wins,
      SUM(CASE WHEN is_draw = 1 THEN 1 ELSE 0 END) as draws,
      SUM(CASE WHEN winner_id IS NOT NULL AND winner_id != ? AND is_draw = 0 THEN 1 ELSE 0 END) as losses
    FROM duel_history
    WHERE player1_id = ? OR player2_id = ?
  `).get(userId, userId, userId, userId);
  return stats || { total: 0, wins: 0, draws: 0, losses: 0 };
}

// ─── GROUP WARS & LIVING WORLD MAP ──────────────────────────────────────────

const GROUP_COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6',
  '#8b5cf6', '#14b8a6', '#f97316', '#06b6d4', '#e11d48'
];

export function getGroupById(groupId) {
  const group = db.prepare(`
    SELECT 
      g.*,
      COUNT(DISTINCT u.id) as member_count,
      u_cmd.first_name as commander_name,
      u_cmd.username as commander_username,
      u_cmd.telegram_id as commander_telegram_id
    FROM groups g
    LEFT JOIN users u ON u.group_id = g.id
    LEFT JOIN users u_cmd ON g.commander_user_id = u_cmd.id
    WHERE g.id = ?
    GROUP BY g.id
  `).get(groupId);
  return group || null;
}

export function getGroupByTelegramChatId(chatId) {
  return db.prepare('SELECT * FROM groups WHERE telegram_chat_id = ?').get(String(chatId));
}

export function getGroupByUsername(username) {
  if (!username) return null;
  const clean = username.replace(/^@/, '').trim().toLowerCase();
  return db.prepare('SELECT * FROM groups WHERE LOWER(username) = ?').get(clean);
}

export function createGroup({ telegramChatId, name, username = null, photoUrl = null, color = null, creatorUserId = null }) {
  const randomColor = GROUP_COLORS[Math.floor(Math.random() * GROUP_COLORS.length)];
  const groupColor = color || randomColor;
  const cleanUsername = username ? username.replace(/^@/, '').trim() : null;

  const stmt = db.prepare(`
    INSERT INTO groups (telegram_chat_id, name, username, photo_url, color, commander_user_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(String(telegramChatId), name, cleanUsername, photoUrl, groupColor, creatorUserId);
  const newGroupId = info.lastInsertRowid;

  if (creatorUserId) {
    db.prepare('UPDATE users SET group_id = ?, group_joined_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(newGroupId, creatorUserId);
  }

  return getGroupById(newGroupId);
}

export function joinGroup(userId, groupId) {
  const user = getUserById(userId);
  if (!user) return { success: false, error: 'Пользователь не найден' };

  const targetGroup = getGroupById(groupId);
  if (!targetGroup) return { success: false, error: 'Группа не найдена' };

  if (user.group_id === groupId) {
    return { success: true, message: 'Вы уже состоите в этой группе', group: targetGroup };
  }

  // Cooldown: switch allowed only once every 7 days
  if (user.group_id && user.group_joined_at) {
    const daysSince = (Date.now() - new Date(user.group_joined_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < 7) {
      const daysLeft = Math.ceil(7 - daysSince);
      return { success: false, error: `Сменить группу можно только через ${daysLeft} дн.` };
    }
  }

  db.prepare(`
    UPDATE users 
    SET group_id = ?, group_joined_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `).run(groupId, userId);

  // If group has no commander yet, assign this user
  if (!targetGroup.commander_user_id) {
    db.prepare('UPDATE groups SET commander_user_id = ? WHERE id = ?').run(userId, groupId);
  }

  return { success: true, group: getGroupById(groupId) };
}

export function getUserGroup(userId) {
  const user = getUserById(userId);
  if (!user || !user.group_id) return null;

  const group = getGroupById(user.group_id);
  if (!group) return null;

  // Calculate current cycle scores
  const cycleMeta = getCycleMetadata();
  const cycleStart = cycleMeta.cycle_start_at;

  const userCycleScoreRow = db.prepare(`
    SELECT COALESCE(SUM(score), 0) as score
    FROM scores
    WHERE user_id = ? AND created_at >= ?
  `).get(userId, cycleStart);

  const groupCycleScoreRow = db.prepare(`
    SELECT COALESCE(SUM(s.score), 0) as score
    FROM scores s
    JOIN users u ON s.user_id = u.id
    WHERE u.group_id = ? AND s.created_at >= ?
  `).get(group.id, cycleStart);

  // Members list (top 10 by contribution in this cycle)
  const members = db.prepare(`
    SELECT 
      u.id, u.telegram_id, u.first_name, u.username, u.photo_url,
      COALESCE(SUM(s.score), 0) as cycle_score,
      u.id = ? as is_commander
    FROM users u
    LEFT JOIN scores s ON s.user_id = u.id AND s.created_at >= ?
    WHERE u.group_id = ?
    GROUP BY u.id
    ORDER BY cycle_score DESC
    LIMIT 20
  `).all(group.commander_user_id || 0, cycleStart, group.id);

  const isCommander = group.commander_user_id === userId;

  return {
    group: {
      id: group.id,
      name: group.name,
      username: group.username,
      photoUrl: group.photo_url,
      color: group.color,
      treasuryTokens: group.treasury_tokens || 0,
      tokensExpireAt: group.tokens_expire_at,
      scoreBoostUntil: group.score_boost_until,
      memberCount: group.member_count,
      commanderUserId: group.commander_user_id,
      commanderName: group.commander_name,
      commanderUsername: group.commander_username,
      createdAt: group.created_at,
    },
    isCommander,
    userCycleScore: userCycleScoreRow ? userCycleScoreRow.score : 0,
    groupCycleScore: groupCycleScoreRow ? groupCycleScoreRow.score : 0,
    members,
  };
}

export function getCycleMetadata() {
  let row = db.prepare('SELECT * FROM cycle_metadata WHERE id = 1').get();
  if (!row) {
    db.prepare('INSERT OR IGNORE INTO cycle_metadata (id, current_cycle_number, cycle_start_at) VALUES (1, 1, CURRENT_TIMESTAMP)').run();
    row = db.prepare('SELECT * FROM cycle_metadata WHERE id = 1').get();
  }
  return row;
}

export function getGroupLeaderboard() {
  const meta = getCycleMetadata();
  const cycleStart = meta.cycle_start_at;

  const rows = db.prepare(`
    SELECT 
      g.id,
      g.name,
      g.username,
      g.photo_url as photoUrl,
      g.color,
      g.treasury_tokens as treasuryTokens,
      g.commander_user_id as commanderUserId,
      u_cmd.first_name as commanderName,
      COUNT(DISTINCT u.id) as memberCount,
      COALESCE(SUM(s.score), 0) as cycleScore
    FROM groups g
    LEFT JOIN users u ON u.group_id = g.id
    LEFT JOIN users u_cmd ON g.commander_user_id = u_cmd.id
    LEFT JOIN scores s ON s.user_id = u.id AND s.created_at >= ?
    GROUP BY g.id
    ORDER BY cycleScore DESC, memberCount DESC
  `).all(cycleStart);

  let rank = 1;
  const leaderboard = rows.map((g) => {
    const isEligible = g.memberCount >= 3;
    const currentRank = isEligible ? rank++ : null;
    return {
      ...g,
      rank: currentRank,
      isEligible,
    };
  });

  const cycleStartMs = new Date(cycleStart).getTime();
  const cycleEndMs = cycleStartMs + (72 * 60 * 60 * 1000);

  return {
    cycleNumber: meta.current_cycle_number,
    cycleStartAt: cycleStart,
    cycleEndAt: new Date(cycleEndMs).toISOString(),
    remainingSeconds: Math.max(0, Math.floor((cycleEndMs - Date.now()) / 1000)),
    leaderboard,
  };
}

export function updateGroupColor(groupId, color) {
  if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
    return { success: false, error: 'Неверный HEX формат цвета' };
  }
  db.prepare('UPDATE groups SET color = ? WHERE id = ?').run(color, groupId);
  return { success: true, color };
}

// ─── WORLD MAP ──────────────────────────────────────────────────────────────

export function getWorldMapCells() {
  return db.prepare(`
    SELECT 
      m.x, m.y, m.group_id, m.level, m.is_monument, m.monument_id,
      m.captured_at, m.shield_until, m.updated_at,
      m.is_land, m.region_name,
      g.name as group_name, g.color as group_color, g.photo_url as group_photo
    FROM world_map m
    LEFT JOIN groups g ON m.group_id = g.id
    ORDER BY m.y ASC, m.x ASC
  `).all();
}

export function getWorldMapDiff(sinceIso) {
  return db.prepare(`
    SELECT 
      m.x, m.y, m.group_id, m.level, m.is_monument, m.monument_id,
      m.captured_at, m.shield_until, m.updated_at,
      m.is_land, m.region_name,
      g.name as group_name, g.color as group_color, g.photo_url as group_photo
    FROM world_map m
    LEFT JOIN groups g ON m.group_id = g.id
    WHERE m.updated_at >= ?
  `).all(sinceIso);
}

export function executeMapAction({ userId, action, x, y, size = 3, isEmergency = false, monumentName = null }) {
  const user = getUserById(userId);
  if (!user || !user.group_id) {
    return { success: false, error: 'Вы должны состоять в группе для действий на карте' };
  }

  const group = getGroupById(user.group_id);
  if (!group) return { success: false, error: 'Группа не найдена' };

  const isCommander = group.commander_user_id === userId;
  if (!isCommander && !isEmergency) {
    return { success: false, error: 'Только Командор группы может отдавать приказы за токены' };
  }

  if (x < 0 || x >= 80 || y < 0 || y >= 60) {
    return { success: false, error: 'Координаты вне границ карты (80x60)' };
  }

  const currentCell = db.prepare(`
    SELECT m.*, g.color as group_color, g.name as group_name 
    FROM world_map m
    LEFT JOIN groups g ON m.group_id = g.id
    WHERE m.x = ? AND m.y = ?
  `).get(x, y);

  if (!currentCell) return { success: false, error: 'Клетка не найдена' };

  if (currentCell.is_land === 0) {
    return { success: false, error: 'Океан нейтрален и не подлежит захвату. Выберите территорию на суше!' };
  }

  // Shield check: cell cannot be captured or sabotaged if active shield exists
  if (currentCell.shield_until && new Date(currentCell.shield_until).getTime() > Date.now()) {
    if (currentCell.group_id !== group.id) {
      return { success: false, error: 'Клетка защищена щитом Звёзд!' };
    }
  }

  // 1. Emergency Capture (3000 coins, anyone in group)
  if (isEmergency) {
    if (user.coins < 3000) {
      return { success: false, error: 'Недостаточно монет для экстренного захвата (нужно 3 000 🪙)' };
    }
    if (currentCell.is_monument && currentCell.group_id !== group.id) {
      return { success: false, error: 'Монумент нельзя захватить одиночным действием' };
    }

    const tx = db.transaction(() => {
      db.prepare('UPDATE users SET coins = coins - 3000 WHERE id = ?').run(userId);
      db.prepare(`
        UPDATE world_map 
        SET group_id = ?, level = 1, is_monument = 0, monument_id = NULL,
            captured_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
        WHERE x = ? AND y = ?
      `).run(group.id, x, y);

      db.prepare(`
        INSERT INTO map_actions (group_id, user_id, action, x, y, tokens_spent, coins_spent)
        VALUES (?, ?, 'emergency_capture', ?, ?, 0, 3000)
      `).run(group.id, userId, x, y);
    });
    tx();

    const updated = db.prepare(`
      SELECT m.*, g.name as group_name, g.color as group_color 
      FROM world_map m 
      LEFT JOIN groups g ON m.group_id = g.id 
      WHERE m.x = ? AND m.y = ?
    `).get(x, y);

    return {
      success: true,
      action: 'emergency_capture',
      updatedCells: [updated],
      remainingTokens: group.treasury_tokens,
      remainingCoins: user.coins - 3000,
    };
  }

  // Commander token-based actions:
  const treasury = group.treasury_tokens || 0;

  switch (action) {
    case 'capture': {
      // If cell belongs to enemy and fortified (level 2), requires 2 tokens (or sabotage first)
      const cost = (currentCell.group_id && currentCell.group_id !== group.id && currentCell.level >= 2) ? 2 : 1;
      if (treasury < cost) {
        return { success: false, error: `Недостаточно токенов (требуется ${cost} токенов)` };
      }
      if (currentCell.group_id === group.id) {
        return { success: false, error: 'Клетка уже принадлежит вашей группе' };
      }
      if (currentCell.is_monument && currentCell.group_id !== group.id) {
        return { success: false, error: 'Монумент нельзя захватить по отдельным клеткам (нужен полный захват за 9 токенов)' };
      }

      const tx = db.transaction(() => {
        db.prepare('UPDATE groups SET treasury_tokens = treasury_tokens - ? WHERE id = ?').run(cost, group.id);
        db.prepare(`
          UPDATE world_map 
          SET group_id = ?, level = 1, is_monument = 0, monument_id = NULL,
              captured_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
          WHERE x = ? AND y = ?
        `).run(group.id, x, y);

        db.prepare(`
          INSERT INTO map_actions (group_id, user_id, action, x, y, tokens_spent)
          VALUES (?, ?, 'capture', ?, ?, ?)
        `).run(group.id, userId, x, y, cost);
      });
      tx();

      const updated = db.prepare(`
        SELECT m.*, g.name as group_name, g.color as group_color 
        FROM world_map m 
        LEFT JOIN groups g ON m.group_id = g.id 
        WHERE m.x = ? AND m.y = ?
      `).get(x, y);

      return {
        success: true,
        action: 'capture',
        updatedCells: [updated],
        remainingTokens: treasury - cost,
      };
    }

    case 'fortify': {
      if (treasury < 2) {
        return { success: false, error: 'Для укрепления требуется 2 токена' };
      }
      if (currentCell.group_id !== group.id) {
        return { success: false, error: 'Укреплять можно только клетки своей группы' };
      }
      if (currentCell.level >= 2) {
        return { success: false, error: 'Клетка уже максимально укреплена (Level 2)' };
      }

      const tx = db.transaction(() => {
        db.prepare('UPDATE groups SET treasury_tokens = treasury_tokens - 2 WHERE id = ?').run(group.id);
        db.prepare(`
          UPDATE world_map 
          SET level = 2, updated_at = CURRENT_TIMESTAMP 
          WHERE x = ? AND y = ?
        `).run(x, y);

        db.prepare(`
          INSERT INTO map_actions (group_id, user_id, action, x, y, tokens_spent)
          VALUES (?, ?, 'fortify', ?, ?, 2)
        `).run(group.id, userId, x, y);
      });
      tx();

      const updated = db.prepare(`
        SELECT m.*, g.name as group_name, g.color as group_color 
        FROM world_map m 
        LEFT JOIN groups g ON m.group_id = g.id 
        WHERE m.x = ? AND m.y = ?
      `).get(x, y);

      return {
        success: true,
        action: 'fortify',
        updatedCells: [updated],
        remainingTokens: treasury - 2,
      };
    }

    case 'sabotage': {
      if (treasury < 1) {
        return { success: false, error: 'Для диверсии требуется 1 токен' };
      }
      if (!currentCell.group_id || currentCell.group_id === group.id) {
        return { success: false, error: 'Диверсия применяется только к вражеским клеткам' };
      }
      if (currentCell.level < 2) {
        return { success: false, error: 'Диверсия снимает только укрепление (Level 2 → Level 1)' };
      }

      const tx = db.transaction(() => {
        db.prepare('UPDATE groups SET treasury_tokens = treasury_tokens - 1 WHERE id = ?').run(group.id);
        db.prepare(`
          UPDATE world_map 
          SET level = 1, updated_at = CURRENT_TIMESTAMP 
          WHERE x = ? AND y = ?
        `).run(x, y);

        db.prepare(`
          INSERT INTO map_actions (group_id, user_id, action, x, y, tokens_spent)
          VALUES (?, ?, 'sabotage', ?, ?, 1)
        `).run(group.id, userId, x, y);
      });
      tx();

      const updated = db.prepare(`
        SELECT m.*, g.name as group_name, g.color as group_color 
        FROM world_map m 
        LEFT JOIN groups g ON m.group_id = g.id 
        WHERE m.x = ? AND m.y = ?
      `).get(x, y);

      return {
        success: true,
        action: 'sabotage',
        updatedCells: [updated],
        remainingTokens: treasury - 1,
      };
    }

    case 'monument': {
      const monSize = size === 5 ? 5 : 3;
      const cost = monSize === 5 ? 0 : 5; // Size 5 is Stars, size 3 is 5 tokens

      if (monSize === 3 && treasury < 5) {
        return { success: false, error: 'Для монумента 3x3 требуется 5 токенов' };
      }
      if (x + monSize > 80 || y + monSize > 60) {
        return { success: false, error: 'Монумент выходит за границы карты' };
      }

      const monCells = db.prepare(`
        SELECT x, y, is_land FROM world_map 
        WHERE x >= ? AND x < ? AND y >= ? AND y < ?
      `).all(x, x + monSize, y, y + monSize);
      if (monCells.some(c => c.is_land === 0)) {
        return { success: false, error: 'Монумент можно возводить только на суше (все клетки должны быть сушей)' };
      }

      let updatedCells = [];
      const tx = db.transaction(() => {
        if (cost > 0) {
          db.prepare('UPDATE groups SET treasury_tokens = treasury_tokens - ? WHERE id = ?').run(cost, group.id);
        }

        const monRes = db.prepare(`
          INSERT INTO monuments (group_id, name, origin_x, origin_y, size)
          VALUES (?, ?, ?, ?, ?)
        `).run(group.id, monumentName || `${group.name} Monument`, x, y, monSize);
        const monumentId = monRes.lastInsertRowid;

        const updateCellStmt = db.prepare(`
          UPDATE world_map 
          SET group_id = ?, level = 2, is_monument = 1, monument_id = ?,
              captured_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
          WHERE x = ? AND y = ?
        `);

        for (let dx = 0; dx < monSize; dx++) {
          for (let dy = 0; dy < monSize; dy++) {
            updateCellStmt.run(group.id, monumentId, x + dx, y + dy);
          }
        }

        db.prepare(`
          INSERT INTO map_actions (group_id, user_id, action, x, y, tokens_spent)
          VALUES (?, ?, 'monument', ?, ?, ?)
        `).run(group.id, userId, x, y, cost);
      });
      tx();

      updatedCells = db.prepare(`
        SELECT m.*, g.name as group_name, g.color as group_color 
        FROM world_map m 
        LEFT JOIN groups g ON m.group_id = g.id 
        WHERE m.x >= ? AND m.x < ? AND m.y >= ? AND m.y < ?
      `).all(x, x + monSize, y, y + monSize);

      return {
        success: true,
        action: 'monument',
        monumentId: updatedCells[0]?.monument_id,
        updatedCells,
        remainingTokens: treasury - cost,
      };
    }

    case 'capture_monument': {
      if (treasury < 9) {
        return { success: false, error: 'Для захвата целого монумента требуется 9 токенов' };
      }
      if (!currentCell.is_monument || !currentCell.monument_id) {
        return { success: false, error: 'Цель не является монументом' };
      }
      if (currentCell.group_id === group.id) {
        return { success: false, error: 'Этот монумент уже принадлежит вашей группе' };
      }

      const mon = db.prepare('SELECT * FROM monuments WHERE id = ?').get(currentCell.monument_id);
      if (!mon) return { success: false, error: 'Монумент не найден' };

      const tx = db.transaction(() => {
        db.prepare('UPDATE groups SET treasury_tokens = treasury_tokens - 9 WHERE id = ?').run(group.id);
        db.prepare('UPDATE monuments SET group_id = ? WHERE id = ?').run(group.id, mon.id);
        db.prepare(`
          UPDATE world_map 
          SET group_id = ?, level = 1, updated_at = CURRENT_TIMESTAMP 
          WHERE monument_id = ?
        `).run(group.id, mon.id);

        db.prepare(`
          INSERT INTO map_actions (group_id, user_id, action, x, y, tokens_spent)
          VALUES (?, ?, 'capture_monument', ?, ?, 9)
        `).run(group.id, userId, x, y);
      });
      tx();

      const updatedCells = db.prepare(`
        SELECT m.*, g.name as group_name, g.color as group_color 
        FROM world_map m 
        LEFT JOIN groups g ON m.group_id = g.id 
        WHERE m.monument_id = ?
      `).all(mon.id);

      return {
        success: true,
        action: 'capture_monument',
        updatedCells,
        remainingTokens: treasury - 9,
      };
    }

    default:
      return { success: false, error: `Неизвестное действие: ${action}` };
  }
}

// ─── 72-HOUR CYCLE CALCULATION (CRON) ───────────────────────────────────────

export function runCycleCalculation() {
  const meta = getCycleMetadata();
  const currentCycleNumber = meta.current_cycle_number;
  const cycleStart = meta.cycle_start_at;

  console.log(`[Cycle] Calculating results for cycle #${currentCycleNumber} started at ${cycleStart}...`);

  // 1. Calculate total scores per group since cycleStart for groups with >= 3 members
  const groupsRanked = db.prepare(`
    SELECT 
      g.id,
      g.name,
      g.commander_user_id,
      COUNT(DISTINCT u.id) as member_count,
      COALESCE(SUM(s.score), 0) as total_score
    FROM groups g
    JOIN users u ON u.group_id = g.id
    LEFT JOIN scores s ON s.user_id = u.id AND s.created_at >= ?
    GROUP BY g.id
    HAVING member_count >= 3
    ORDER BY total_score DESC
  `).all(cycleStart);

  const awards = [];

  const tx = db.transaction(() => {
    // 2. Burn expired tokens (> 7 days)
    db.prepare(`
      UPDATE groups 
      SET treasury_tokens = 0, tokens_expire_at = NULL 
      WHERE tokens_expire_at IS NOT NULL AND tokens_expire_at < CURRENT_TIMESTAMP
    `).run();

    // 3. Award tokens according to ranking table
    for (let i = 0; i < groupsRanked.length; i++) {
      const g = groupsRanked[i];
      const rank = i + 1;
      let tokens = 0;
      if (rank === 1) tokens = 12;
      else if (rank === 2) tokens = 8;
      else if (rank === 3) tokens = 5;
      else if (rank >= 4 && rank <= 10) tokens = 2;
      else if (rank >= 11 && rank <= 50) tokens = 1;

      // Credit tokens to treasury & set tokens_expire_at = now + 7 days
      if (tokens > 0) {
        db.prepare(`
          UPDATE groups 
          SET treasury_tokens = treasury_tokens + ?,
              tokens_expire_at = datetime('now', '+7 days')
          WHERE id = ?
        `).run(tokens, g.id);
      }

      // Elect Commander: player with highest score in this group in the cycle
      const topContributor = db.prepare(`
        SELECT s.user_id, SUM(s.score) as user_score
        FROM scores s
        JOIN users u ON s.user_id = u.id
        WHERE u.group_id = ? AND s.created_at >= ?
        GROUP BY s.user_id
        ORDER BY user_score DESC
        LIMIT 1
      `).get(g.id, cycleStart);

      let newCommanderId = topContributor ? topContributor.user_id : g.commander_user_id;
      if (newCommanderId) {
        db.prepare('UPDATE groups SET commander_user_id = ? WHERE id = ?').run(newCommanderId, g.id);
      }

      // Record in cycle_results
      db.prepare(`
        INSERT INTO cycle_results (cycle_number, group_id, rank, total_score, tokens_awarded)
        VALUES (?, ?, ?, ?, ?)
      `).run(currentCycleNumber, g.id, rank, g.total_score, tokens);

      const commanderUser = newCommanderId ? getUserById(newCommanderId) : null;

      awards.push({
        groupId: g.id,
        groupName: g.name,
        rank,
        totalScore: g.total_score,
        tokensAwarded: tokens,
        commanderUserId: newCommanderId,
        commanderTelegramId: commanderUser?.telegram_id,
        commanderName: commanderUser?.first_name,
      });
    }

    // Advance cycle metadata
    db.prepare(`
      UPDATE cycle_metadata 
      SET current_cycle_number = current_cycle_number + 1,
          cycle_start_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run();
  });
  tx();

  console.log(`[Cycle] Cycle #${currentCycleNumber} concluded. ${awards.length} groups awarded.`);
  return {
    cycleNumber: currentCycleNumber,
    awards,
  };
}

// ─── SCORE BOOSTER ──────────────────────────────────────────────────────────

export function activateScoreBooster(userId) {
  const user = getUserById(userId);
  if (!user) return { success: false, error: 'Пользователь не найден' };

  if (user.coins < 500) {
    return { success: false, error: 'Недостаточно монет для Score Booster (нужно 500 🪙)' };
  }

  // Check if booster is already active
  if (user.score_booster_until && parseDbTime(user.score_booster_until) > Date.now()) {
    return { 
      success: false, 
      error: 'Score Booster уже активен!',
      scoreBoosterUntil: new Date(parseDbTime(user.score_booster_until)).toISOString(),
    };
  }

  const boosterUntilIso = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const tx = db.transaction(() => {
    db.prepare("UPDATE users SET coins = coins - 500, score_booster_until = ? WHERE id = ?").run(boosterUntilIso, userId);
  });
  tx();

  const updated = getUserById(userId);
  return {
    success: true,
    scoreBoosterUntil: boosterUntilIso,
    remainingCoins: updated.coins,
  };
}

// ─── TELEGRAM STARS INTEGRATION ─────────────────────────────────────────────

export const STARS_PRODUCTS = {
  coins_s: { name: 'Пакет монет S', stars: 25, type: 'coins', amount: 2500 },
  coins_m: { name: 'Пакет монет M', stars: 75, type: 'coins', amount: 10000 },
  coins_l: { name: 'Пакет монет L', stars: 200, type: 'coins', amount: 30000 },
  group_boost: { name: 'Групповой буст (x1.5 на 24ч)', stars: 100, type: 'group_boost' },
  monument_5x5: { name: 'Монумент 5x5', stars: 150, type: 'monument_5x5' },
  group_color: { name: 'Уникальный цвет группы', stars: 50, type: 'group_color' },
  extra_tokens: { name: 'Экстра токен (+3 токена)', stars: 80, type: 'extra_tokens' },
  cell_shield: { name: 'Щит клетки (7 дней)', stars: 30, type: 'cell_shield' },
};

export function processStarsPayment({ userId, productId, starsAmount, chargeId, payload = {} }) {
  if (!userId || !productId) return { success: false, error: 'Параметры обязательны' };

  // Check if already processed (idempotency)
  if (chargeId) {
    const existing = db.prepare('SELECT id FROM stars_purchases WHERE telegram_payment_charge_id = ?').get(chargeId);
    if (existing) {
      return { success: true, alreadyProcessed: true };
    }
  }

  const user = getUserById(userId);
  if (!user) return { success: false, error: 'Пользователь не найден' };

  const tx = db.transaction(() => {
    // Record purchase
    db.prepare(`
      INSERT INTO stars_purchases (user_id, product_id, stars_amount, payload, telegram_payment_charge_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, productId, starsAmount || 0, JSON.stringify(payload), chargeId || null);

    // Apply product effect
    if (productId === 'coins_s') {
      db.prepare('UPDATE users SET coins = coins + 2500 WHERE id = ?').run(userId);
    } else if (productId === 'coins_m') {
      db.prepare('UPDATE users SET coins = coins + 10000 WHERE id = ?').run(userId);
    } else if (productId === 'coins_l') {
      db.prepare('UPDATE users SET coins = coins + 30000 WHERE id = ?').run(userId);
    } else if (productId === 'group_boost' && user.group_id) {
      db.prepare(`UPDATE groups SET score_boost_until = datetime('now', '+24 hours') WHERE id = ?`).run(user.group_id);
    } else if (productId === 'extra_tokens' && user.group_id) {
      db.prepare(`
        UPDATE groups 
        SET treasury_tokens = treasury_tokens + 3,
            tokens_expire_at = datetime('now', '+7 days')
        WHERE id = ?
      `).run(user.group_id);
    } else if (productId === 'group_color' && user.group_id && payload?.color) {
      db.prepare('UPDATE groups SET color = ? WHERE id = ?').run(payload.color, user.group_id);
    } else if (productId === 'cell_shield' && payload?.x !== undefined && payload?.y !== undefined) {
      db.prepare(`
        UPDATE world_map 
        SET shield_until = datetime('now', '+7 days'), updated_at = CURRENT_TIMESTAMP 
        WHERE x = ? AND y = ?
      `).run(payload.x, payload.y);
    } else if (productId === 'monument_5x5' && user.group_id && payload?.x !== undefined && payload?.y !== undefined) {
      executeMapAction({
        userId,
        action: 'monument',
        x: payload.x,
        y: payload.y,
        size: 5,
        isEmergency: false,
      });
    }
  });
  tx();

  const updatedUser = getUserById(userId);
  return {
    success: true,
    userCoins: updatedUser?.coins,
  };
}

