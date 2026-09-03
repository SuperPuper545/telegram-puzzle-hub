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
  { id: 'gem_classic', category: 'gem_skin', name: 'Ограненные самоцветы', description: 'Классические драгоценные камни', price: 0, previewColor: '#ec4899' },
  { id: 'gem_orbs', category: 'gem_skin', name: 'Магические сферы', description: 'Плазменные светящиеся шары', price: 500, previewColor: '#8b5cf6' },
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
export function createDuelRoom(roomId, gameType, betAmount, hostUserId) {
  db.prepare(`
    INSERT OR IGNORE INTO duel_rooms (id, game_type, bet_amount, host_user_id, status)
    VALUES (?, ?, ?, ?, 'waiting')
  `).run(roomId, gameType, betAmount, hostUserId);
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
