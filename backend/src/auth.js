import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { upsertUser } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const BOT_TOKEN = process.env.BOT_TOKEN || '';

export function validateTelegramInitData(initData) {
  if (!initData || !BOT_TOKEN) {
    return null;
  }

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;

    params.delete('hash');

    // Sort alphabetically
    const keys = Array.from(params.keys()).sort();
    const dataCheckArr = keys.map((key) => `${key}=${params.get(key)}`);
    const dataCheckString = dataCheckArr.join('\n');

    // HMAC calculation
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(BOT_TOKEN)
      .digest();

    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    // Constant-time comparison
    const hashBuffer = Buffer.from(hash, 'hex');
    const calculatedBuffer = Buffer.from(calculatedHash, 'hex');

    if (hashBuffer.length !== calculatedBuffer.length) {
      return null;
    }

    if (!crypto.timingSafeEqual(hashBuffer, calculatedBuffer)) {
      return null;
    }

    // Parse user object
    const userStr = params.get('user');
    if (!userStr) return null;

    const user = JSON.parse(userStr);

    // Check auth_date (e.g. 24 hours max in production)
    const authDate = parseInt(params.get('auth_date') || '0', 10);
    const now = Math.floor(Date.now() / 1000);
    if (process.env.NODE_ENV === 'production' && now - authDate > 86400) {
      return null;
    }

    return user;
  } catch (err) {
    console.error('Validation error:', err);
    return null;
  }
}

// Middleware for Express
export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';
  let initData = '';

  if (authHeader.startsWith('tma ')) {
    initData = authHeader.slice(4).trim();
  } else if (req.headers['x-telegram-init-data']) {
    initData = req.headers['x-telegram-init-data'];
  }

  let tgUser = validateTelegramInitData(initData);

  // Fallback for development / mock mode
  if (!tgUser && process.env.NODE_ENV !== 'production') {
    const mockId = req.headers['x-mock-user-id'] || '10001';
    const mockName = req.headers['x-mock-username'] || 'Player One';
    tgUser = {
      id: mockId,
      first_name: mockName,
      username: 'player_one',
      photo_url: null,
    };
  }

  if (!tgUser) {
    return res.status(401).json({ error: 'Unauthorized: Invalid Telegram credentials' });
  }

  // Upsert user into database
  try {
    const userRecord = upsertUser(tgUser);
    req.user = userRecord;
    next();
  } catch (err) {
    console.error('Failed to upsert user:', err);
    res.status(500).json({ error: 'Database error during authentication' });
  }
}
