# 🎮 Telegram Mini App: Puzzle Hub

Быстрый, легковесный и плавный игровой хаб для Telegram Mini Apps с каталогом казуальных головоломок, глобальным лидербордом и профилем игрока.

---

## 🕹️ Доступные игры:
1. **Blockudoku (Блокудоку 9x9)** — классическая головоломка: размещение фигур на поле, очистка строк, колонок и квадратов 3x3, комбо-множители, серии ходов (Streak), проверка Game Over и экран триумфа с конфетти. Оптимизировано под мобильные экраны с приподнятым смещением пальца (Finger Offset ~70px) и виброоткликом (Haptic Feedback).
2. **Match-3 (Три в ряд)** — *в разработке*.
3. **2048 Classic** — *в разработке*.

---

## ⚡ Оптимизация под ультра-бюджетный VPS (1 vCPU / 1 GB RAM / 3 GB Disk):
* **Бэкенд:** Node.js + Express + SQLite (`better-sqlite3` в режиме WAL). Потребление оперативной памяти всего **~50 MB RAM**!
* **Безопасность:** Валидация подписи `initData` алгоритмом HMAC-SHA256 через `BOT_TOKEN`. Секреты хранятся только в `backend/.env` и никогда не попадают в репозиторий.
* **Фронтенд:** Чистая сборка Vite + React 19 + TypeScript + Tailwind CSS. Размер всего бандла: **< 85 KB (gzip)**. Загрузка за 0.2 секунды.

---

## 🚀 Запуск на локальном компьютере:

### 1. Запуск бэкенда:
```bash
cd backend
npm install
npm run dev
# Сервер запустится на http://localhost:3001
```

### 2. Запуск фронтенда для разработки:
```bash
cd frontend
npm install
npm run dev
# Приложение откроется на http://localhost:5173
```
*Для локального тестирования в обычном браузере вне Telegram автоматически работает Dev Mock Player.*

### 3. Сборка фронтенда:
```bash
cd frontend
npm run build
# Соберет статику в frontend/dist
```

---

## 🌐 Деплой на целевой VPS сервер:

1. **Клонирование проекта на VPS:**
   ```bash
   git clone https://github.com/SuperPuper545/telegram-puzzle-hub.git /var/www/telegram-puzzle-hub
   cd /var/www/telegram-puzzle-hub
   ```

2. **Настройка окружения:**
   ```bash
   cp backend/.env.example backend/.env
   nano backend/.env # Укажите BOT_TOKEN
   ```

3. **Сборка и запуск через PM2:**
   ```bash
   # Установка зависимостей и сборка
   npm --prefix backend install --production
   npm --prefix frontend install && npm --prefix frontend run build

   # Запуск через PM2 с жестким лимитом памяти 150M
   pm2 start ecosystem.config.cjs
   pm2 save
   pm2 startup
   ```

4. **Настройка Nginx:**
   Скопируйте `nginx.conf` в `/etc/nginx/sites-available/tma-hub` и активируйте:
   ```bash
   sudo ln -s /etc/nginx/sites-available/tma-hub /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   ```
