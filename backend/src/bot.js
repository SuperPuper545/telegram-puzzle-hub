import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { getLeaderboard, getUserBestScores, upsertUser } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const API_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;
const WEBAPP_URL = process.env.WEBAPP_URL || '';

async function tgCall(method, data) {
  if (!BOT_TOKEN) return null;
  try {
    const res = await fetch(`${API_URL}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.ok) {
      console.error(`Telegram API error on ${method}:`, JSON.stringify(json));
    }
    return json;
  } catch (err) {
    console.error(`Network error on ${method}:`, err);
    return null;
  }
}

function getPlayButton() {
  if (WEBAPP_URL && WEBAPP_URL.startsWith('https://')) {
    return [{ text: '🎮 Играть в TapTap Hub', web_app: { url: WEBAPP_URL } }];
  }
  // Telegram strictly forbids http:// or localhost in inline button url
  return [{ text: '🎮 Играть (Blockudoku)', callback_data: 'cb_play' }];
}

function getMainKeyboard() {
  return {
    inline_keyboard: [
      getPlayButton(),
      [
        { text: '🏆 Лидерборд', callback_data: 'cb_leaderboard' },
        { text: '👤 Мой профиль', callback_data: 'cb_profile' },
      ],
      [
        { text: '🕹️ Список игр', callback_data: 'cb_games' },
        { text: 'ℹ️ Правила', callback_data: 'cb_help' },
      ],
    ],
  };
}

async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();
  const tgUser = msg.from;

  let dbUser = null;
  if (tgUser) {
    try {
      dbUser = upsertUser({
        id: tgUser.id,
        username: tgUser.username,
        first_name: tgUser.first_name,
        last_name: tgUser.last_name,
      });
    } catch (e) {
      console.warn('DB upsert error from bot:', e);
    }
  }

  if (text.startsWith('/start')) {
    const welcome = `👋 <b>Привет, ${tgUser?.first_name || 'Игрок'}!</b>\n\n` +
      `Добро пожаловать в <b>TapTap Hub</b> — каталог быстрых и увлекательных головоломок в Telegram Mini App!\n\n` +
      `🧩 <b>Blockudoku (9x9)</b> уже доступна: собирай линии и квадраты 3x3, ставь рекорды и соревнуйся за 1 место в ТОПе!\n\n` +
      `Нажми кнопку ниже, чтобы начать игру:`;

    await tgCall('sendMessage', {
      chat_id: chatId,
      text: welcome,
      parse_mode: 'HTML',
      reply_markup: getMainKeyboard(),
    });
    return;
  }

  if (text.startsWith('/play')) {
    await sendPlayInfo(chatId);
    return;
  }

  if (text.startsWith('/leaderboard')) {
    await sendLeaderboardMessage(chatId);
    return;
  }

  if (text.startsWith('/profile')) {
    await sendProfileMessage(chatId, dbUser || tgUser);
    return;
  }

  if (text.startsWith('/help')) {
    await sendHelpMessage(chatId);
    return;
  }
}

async function sendPlayInfo(chatId, messageId = null) {
  let text = '';
  if (WEBAPP_URL && WEBAPP_URL.startsWith('https://')) {
    text = `🎮 <b>TapTap Hub: Blockudoku 9x9</b>\n\nНажмите кнопку ниже, чтобы запустить игру прямо внутри Telegram!`;
  } else {
    text = `🎮 <b>TapTap Hub: Blockudoku 9x9</b>\n\n` +
      `Проект сейчас запущен на вашем компьютере!\n\n` +
      `🌐 <b>Открыть в браузере:</b>\n` +
      `👉 <a href="http://localhost:5173">http://localhost:5173</a>\n\n` +
      `📱 <b>Для игры прямо внутри мобильного Telegram:</b>\n` +
      `Укажите публичный HTTPS адрес (например, через tunnel или на VPS) в <code>backend/.env</code> (параметр <code>WEBAPP_URL</code>).`;
  }

  const keyboard = {
    inline_keyboard: [
      getPlayButton(),
      [
        { text: '🏆 Лидерборд', callback_data: 'cb_leaderboard' },
        { text: '◀️ Меню', callback_data: 'cb_menu' },
      ],
    ],
  };

  if (messageId) {
    await tgCall('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'HTML',
      reply_markup: keyboard,
      disable_web_page_preview: true,
    });
  } else {
    await tgCall('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: keyboard,
      disable_web_page_preview: true,
    });
  }
}

async function sendLeaderboardMessage(chatId, messageId = null) {
  const topPlayers = getLeaderboard('blockudoku', 10);

  let text = `🏆 <b>Таблица лидеров Blockudoku:</b>\n\n`;

  if (topPlayers.length === 0) {
    text += `<i>Пока никто не установил рекорд. Будь первым!</i>`;
  } else {
    topPlayers.forEach((player, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      const name = player.first_name || (player.username ? `@${player.username}` : 'Игрок');
      text += `${medal} <b>${name}</b> — <code>${player.high_score.toLocaleString()}</code> очков\n`;
    });
  }

  const keyboard = {
    inline_keyboard: [
      getPlayButton(),
      [
        { text: '🔄 Обновить', callback_data: 'cb_leaderboard' },
        { text: '👤 Мой рекорд', callback_data: 'cb_profile' },
      ],
      [{ text: '◀️ Главное меню', callback_data: 'cb_menu' }],
    ],
  };

  if (messageId) {
    await tgCall('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  } else {
    await tgCall('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  }
}

async function sendProfileMessage(chatId, user, messageId = null) {
  if (!user) return;
  const bestScores = getUserBestScores(user.id);
  const blockudokuScore = bestScores.find(s => s.game_id === 'blockudoku')?.best_score || 0;
  const totalGames = bestScores.reduce((acc, s) => acc + (s.games_played || 0), 0);

  const text = `👤 <b>Профиль игрока:</b> ${user.first_name}\n\n` +
    `🧩 <b>Blockudoku:</b> <code>${blockudokuScore.toLocaleString()}</code> очков\n` +
    `🕹️ <b>Всего сыграно:</b> <code>${totalGames}</code> игр\n` +
    `💎 <b>Match-3:</b> <i>Скоро</i>\n` +
    `⚡ <b>2048:</b> <i>Скоро</i>\n\n` +
    `Тренируйся каждый день и поднимайся в таблице лидеров!`;

  const keyboard = {
    inline_keyboard: [
      getPlayButton(),
      [
        { text: '🏆 Лидерборд', callback_data: 'cb_leaderboard' },
        { text: '◀️ Меню', callback_data: 'cb_menu' },
      ],
    ],
  };

  if (messageId) {
    await tgCall('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  } else {
    await tgCall('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  }
}

async function sendHelpMessage(chatId, messageId = null) {
  const text = `ℹ️ <b>Правила игр TapTap Hub:</b>\n\n` +
    `🧩 <b>Blockudoku (9x9):</b>\n` +
    `• Перетаскивай случайные фигуры из лотка на поле.\n` +
    `• Заполняй полные строки, столбцы или квадраты 3x3 для очистки.\n` +
    `• Очищай несколько линий сразу для получения <b>КОМБО-множителей</b>!\n` +
    `• Серии результативных ходов дают дополнительный бонус Streak 🔥.\n` +
    `• Игра заканчивается, когда ни одну из 3 фигур нельзя разместить.\n\n` +
    `Готов начать?`;

  const keyboard = {
    inline_keyboard: [
      getPlayButton(),
      [{ text: '◀️ Назад в меню', callback_data: 'cb_menu' }],
    ],
  };

  if (messageId) {
    await tgCall('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  } else {
    await tgCall('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  }
}

async function handleCallback(query) {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const data = query.data;
  const tgUser = query.from;

  let dbUser = null;
  if (tgUser) {
    try {
      dbUser = upsertUser({
        id: tgUser.id,
        username: tgUser.username,
        first_name: tgUser.first_name,
        last_name: tgUser.last_name,
      });
    } catch (_) {}
  }

  await tgCall('answerCallbackQuery', { callback_query_id: query.id });

  if (data === 'cb_play') {
    await sendPlayInfo(chatId, messageId);
  } else if (data === 'cb_leaderboard') {
    await sendLeaderboardMessage(chatId, messageId);
  } else if (data === 'cb_profile') {
    await sendProfileMessage(chatId, dbUser || tgUser, messageId);
  } else if (data === 'cb_help') {
    await sendHelpMessage(chatId, messageId);
  } else if (data === 'cb_games') {
    const text = `🕹️ <b>Каталог игр:</b>\n\n` +
      `1. <b>Blockudoku (9x9)</b> — Доступна прямо сейчас! 🔥\n` +
      `2. <b>Match-3 (Три в ряд)</b> — В разработке 💎\n` +
      `3. <b>2048 Classic</b> — В разработке ⚡\n`;

    await tgCall('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          getPlayButton(),
          [{ text: '◀️ Главное меню', callback_data: 'cb_menu' }],
        ],
      },
    });
  } else if (data === 'cb_menu') {
    const welcome = `👋 <b>Главное меню TapTap Hub</b>\n\nВыбирай действие:`;
    await tgCall('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: welcome,
      parse_mode: 'HTML',
      reply_markup: getMainKeyboard(),
    });
  }
}

let isPolling = false;
let lastUpdateId = 0;

export async function startBotPolling() {
  if (!BOT_TOKEN) {
    console.log('Bot: BOT_TOKEN not configured, skipping bot polling.');
    return;
  }

  if (isPolling) return;
  isPolling = true;

  console.log('🤖 Telegram Bot polling started for @taptaphub_bot...');

  while (isPolling) {
    try {
      const res = await fetch(`${API_URL}/getUpdates?offset=${lastUpdateId + 1}&timeout=20`);
      if (!res.ok) {
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }

      const data = await res.json();
      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          lastUpdateId = Math.max(lastUpdateId, update.update_id);
          if (update.message) {
            await handleMessage(update.message);
          } else if (update.callback_query) {
            await handleCallback(update.callback_query);
          }
        }
      }
    } catch (err) {
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

export function stopBotPolling() {
  isPolling = false;
}
