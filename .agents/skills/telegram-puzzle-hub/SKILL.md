---
name: telegram-puzzle-hub
description: Comprehensive architecture guide and runbook for Telegram Puzzle Hub & Clan Wars ecosystem. Covers Clan Competition (Telegram groups as clans, treasury tokens, commanders), Global World Map (80x60 Canvas grid, Real Earth landmask, cell capture/fortify/sabotage/monument, WebSocket live sync), Seasons & Cycles engine, Real-time PvP Duels with coin betting, Telegram Stars monetization, Puzzle Games (Blockudoku, Match-3, 2048 with touch finger offset & haptics), and better-sqlite3 WAL optimization.
---

# ⚔️ Telegram Puzzle Hub: Clan Wars & Mini-App Ecosystem

This skill is the authoritative architectural specification and engineering guide for **Telegram Puzzle Hub**. The project is not just a game catalog — it is a **clan meta-game** connecting Telegram chat communities into a global territorial conquest powered by puzzle score farming and real-time PvP duels.

---

## 1. Core Systems Overview

```
               ┌────────────────────────────────────────────────────────┐
               │              TELEGRAM BOT & CHAT GROUPS                │
               │   (Deep links, Clan registration, Telegram Stars)      │
               └─────────────────────────┬──────────────────────────────┘
                                         │
                   ┌─────────────────────┴──────────────────────┐
                   │                                            │
        ┌──────────▼──────────┐                      ┌──────────▼──────────┐
        │   PUZZLE GAMES      │                      │    PvP DUELS        │
        │ • Blockudoku 9x9    │                      │ • Realtime WSS      │
        │ • Match-3 (Gems)    │                      │ • Coin betting      │
        │ • 2048 (Tiles)      │                      │ • Matchmaking queue │
        │ • Arcade (Bird/etc) │                      │ • 10% commission    │
        └──────────┬──────────┘                      └──────────┬──────────┘
                   │                                            │
                   │ (Player Scores & Coins)                    │ (Coins won/lost)
                   ▼                                            ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                            CLAN METAGAME ENGINE                              │
│ • Groups (Telegram Chat = Clan with Commander, Color, Treasury Tokens)       │
│ • World Map (80x60 Real Earth Landmask, 4,800 cells, Live WebSocket sync)    │
│ • Map Actions: Capture, Fortify, Sabotage, 3x3 Monuments, Emergency Shields  │
│ • Seasons & Cycles: Timed resets, Cycle score rankings, Expiring Treasury     │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │
                    ┌──────────────────┴──────────────────┐
                    │  DATABASE (better-sqlite3 WAL)      │
                    │  RAM footprint budget: ~50 MB       │
                    └─────────────────────────────────────┘
```

---

## 2. Clan Competition & Group Meta

- **Telegram Groups as Clans (`groups` table):**
  - Any Telegram group can register as a clan via bot invitation or deep-link `/start group_<chatId>`.
  - Attributes: `name`, `color`, `commander_user_id`, `treasury_tokens`, `tokens_expire_at`, `score_boost_until`.
- **Treasury Tokens:**
  - Clan currency earned through cycle rankings and achievements.
  - **Decay/Expiry:** Tokens expire at cycle ends (`tokens_expire_at`), forcing clans to invest them into the map rather than hoarding.
- **Clan Commander Role:**
  - Appointed leader of the Telegram group (`commander_user_id`).
  - Has exclusive permissions for strategic map actions (placing monuments, activating emergency shields).
- **Contribution Loop:**
  - Individual players farm game scores $\to$ adds to group's `cycleScore`.
  - Booster items (`activateScoreBooster`) grant multipliers to clan score generation.

---

## 3. Global World Map & Tactical Conquest

- **Grid Dimensions & Landmask:**
  - $80 \times 60 = 4,800$ cells total (`world_map` table).
  - Seeded with **Real Earth Landmask** (`world_landmask.json`): oceans vs continents, with localized Russian/English region names.
- **HTML5 Canvas Architecture (`WorldMapTab.tsx`):**
  - Rendered using an optimized 2D canvas with viewport transform matrix (zoom, pan, touch drag).
  - Does NOT render thousands of DOM nodes — strictly canvas-drawn coordinates for 60 FPS mobile performance.
- **Cell Attributes & States:**
  - `group_id`: Owner clan (cell colored with group's brand color).
  - `level`: Fortification level (costs tokens/coins to upgrade, increases resistance).
  - `shield_until`: Temporary invulnerability timer after capture or defense.
  - `is_monument` & `monument_id`: Special $3 \times 3$ high-value map objectives.
- **Map Actions (`executeMapAction`):**
  1. `capture`: Take unoccupied or unshielded enemy land.
  2. `fortify`: Upgrade cell defense level.
  3. `sabotage`: Weaken enemy territory defenses.
  4. `monument`: Construct or conquer a 3x3 monument structure.
  5. `emergency`: Apply emergency shield or boost.
- **Real-Time WebSocket Synchronization:**
  - Backend maintains connected sockets (`allConnectedSockets`).
  - When any territory is altered, changes are broadcast instantly via `map_update` messages to all viewing clients.
  - In-memory cache `getCachedWorldMap()` invalidates on writes and refreshes every 10 seconds.

---

## 4. Seasons & Cycles Engine (`runCycleCalculation`)

- **Cycle Lifecycle (`cycle_metadata` & `cycle_results`):**
  - Cycles run on predetermined countdowns (`remainingSeconds`).
  - End of cycle:
    1. Tally all clan territory holdings + farmed puzzle scores.
    2. Rank clans in leaderboard (`cycle_results`).
    3. Award fresh treasury tokens to winning clans.
    4. Expire previous cycle's unspent tokens.
    5. Decrement or reset temporary shields.
    6. Advance `current_cycle_number`.

---

## 5. Real-Time PvP Duels (`duel_rooms` & `duel_history`)

- **Matchmaking & Wagering:**
  - Players wager in-game coins (`bet_amount`).
  - Host creates a room or joins matchmaking queue.
  - Coins are frozen (`freezeCoins`) upon room creation/joining to prevent race conditions.
- **Settlement (`settleDuel`):**
  - Winner takes pot minus system commission (10% house sink).
  - In case of a draw (`is_draw`), bets are refunded.
  - All outcomes recorded in `duel_history` for stats and leaderboards.

---

## 6. Economy, Shop & Telegram Stars

- **Currencies:**
  - **Coins:** Earned in games, daily streak bonuses (+100..+1000), referral bonuses (+500 per friend), and PvP duels.
  - **Telegram Stars:** Hard currency for premium boosters and special items.
- **Telegram Stars Purchases (`stars_purchases`):**
  - Invoices generated via `createStarsInvoiceLink` through Bot API.
  - Processed upon `successful_payment` or pre-checkout query.
- **Skins System (`purchases` & equipped slots):**
  - Equipped skin slots on user profile:
    `equipped_block_skin`, `equipped_gem_skin`, `equipped_tile_skin`,
    `equipped_bird_skin`, `equipped_stack_skin`, `equipped_knife_skin`.
  - Validated on purchase: unique item ID per user.

---

## 7. Puzzle Games & Mobile TMA Ergonomics

- **Touch Offset (Finger Offset ~70px):**
  - When dragging pieces in Blockudoku/Match-3, offset the rendered piece by $-70\text{px}$ on the Y-axis so the player's thumb never obstructs the board.
- **Tactile Haptic Feedback:**
  - `impactOccurred('medium')` on piece placement and tile drops.
  - `impactOccurred('heavy')` + `notificationOccurred('success')` on line clears and combo streaks.
  - `notificationOccurred('error')` on illegal drops or Game Over.
- **Prevent Telegram WebApp Swipe Glitches:**
  - Interactive boards must use `touch-action: none`.
  - Call `window.Telegram?.WebApp?.disableVerticalSwipes?.()` to avoid the TMA sheet collapsing during intense swiping.

---

## 8. Backend Constraints & Low-Spec VPS Rules

- **Hardware Target:** 1 vCPU / 1 GB RAM / 3 GB Disk.
- **Process Footprint:** Node.js server must stay $\le \mathbf{50\text{ MB RAM}}$.
- **better-sqlite3 Rules:**
  - Always `PRAGMA journal_mode = WAL;`.
  - Always `PRAGMA synchronous = NORMAL;`.
  - Wrap multi-step queries (like world map batch updates) in `db.transaction(() => { ... })()`.
  - Use prepared statements (`db.prepare(...)`) — never interpolate SQL strings.
- **Security:**
  - Validate all requests with `authMiddleware` via Telegram HMAC-SHA256 signature against `BOT_TOKEN`.
