import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { authMiddleware, validateTelegramInitData } from './auth.js';
import {
  getUserBestScores, recordScore, getLeaderboard, getUserRank, upsertUser,
  getUserById, getDailyRewardStatus, claimDailyReward, processReferral,
  getReferralsInfo, spendCoins, getShopCatalog, buyShopItem, equipShopItem,
  freezeCoins, settleDuel, getDuelHistory, createDuelRoom, getDuelStats,
  getGroupById, getGroupByTelegramChatId, getGroupByUsername, createGroup,
  joinGroup, getUserGroup, getGroupLeaderboard, updateGroupColor,
  getWorldMapCells, getWorldMapDiff, executeMapAction, activateScoreBooster,
  STARS_PRODUCTS, processStarsPayment, runCycleCalculation,
} from './db.js';
import { startBotPolling, fetchTelegramChat, createStarsInvoiceLink } from './bot.js';

const app = express();
const PORT = process.env.PORT || 3001;
app.use(cors());
app.use(express.json());
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => { console.log(`[${req.method}] ${req.url}`); next(); });
}

// ─── WORLD MAP CACHE & WS BROADCAST ──────────────────────────────────────────
const allConnectedSockets = new Set();
let worldMapCache = null;
let worldMapCacheTime = 0;

function getCachedWorldMap() {
  const now = Date.now();
  if (!worldMapCache || now - worldMapCacheTime > 10000) {
    worldMapCache = getWorldMapCells();
    worldMapCacheTime = now;
  }
  return worldMapCache;
}

function broadcastMapUpdate(cells) {
  worldMapCache = null; // Invalidate cache
  const msg = JSON.stringify({ type: 'map_update', cells });
  for (const client of allConnectedSockets) {
    if (client.readyState === WebSocket.OPEN) {
      try { client.send(msg); } catch (_) {}
    }
  }
}

// ─── REST ─────────────────────────────────────────────────────────────────────
const rooms = new Map();
const matchmakingQueues = {};

app.get('/api/health', (req, res) => {
  const mem = process.memoryUsage();
  res.json({ status:'ok', timestamp:new Date().toISOString(), uptimeSeconds:Math.round(process.uptime()), ramUsageMB:Math.round(mem.rss/1024/1024*10)/10, activeRooms:rooms.size });
});
app.get('/api/me', authMiddleware, (req, res) => {
  const u = getUserById(req.user.id) || req.user;
  const scores = getUserBestScores(req.user.id);
  const daily = getDailyRewardStatus(req.user.id);
  const userGroupInfo = getUserGroup(req.user.id);
  const sm = {}; let total = 0;
  for (const item of scores) { sm[item.game_id] = item.best_score; total += item.games_played; }
  res.json({
    user: {
      ...req.user,
      coins: u.coins || 0,
      dailyStreak: u.daily_streak || 0,
      referrerId: u.referrer_id || null,
      groupId: u.group_id || null,
      groupJoinedAt: u.group_joined_at || null,
      scoreBoosterUntil: u.score_booster_until ? ((u.score_booster_until.endsWith('Z') || u.score_booster_until.includes('+')) ? u.score_booster_until : (u.score_booster_until.replace(' ', 'T') + 'Z')) : null,
      equippedBlockSkin: u.equipped_block_skin || 'block_classic',
      equippedGemSkin: u.equipped_gem_skin || 'gem_classic',
      equippedTileSkin: u.equipped_tile_skin || 'tile_classic',
      equippedBirdSkin: u.equipped_bird_skin || 'bird_classic',
      equippedStackSkin: u.equipped_stack_skin || 'stack_classic',
      equippedKnifeSkin: u.equipped_knife_skin || 'knife_classic'
    },
    scores: sm,
    totalGamesPlayed: total,
    dailyReward: daily,
    group: userGroupInfo
  });
});
app.post('/api/scores', authMiddleware, (req, res) => {
  const { gameId, score, duration } = req.body;
  if (!gameId || typeof score !== 'number') return res.status(400).json({ error:'required' });
  if (score < 0 || score > 10000000) return res.status(400).json({ error:'invalid' });
  const r = recordScore(req.user.id, gameId, score, duration||0);
  const rank = getUserRank(gameId, req.user.id);
  res.json({ ...r, rank: rank?.rank ?? null });
});
app.get('/api/leaderboard/:gameId', (req, res) => {
  const { gameId } = req.params;
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit,10)||50));
  const board = getLeaderboard(gameId, limit);
  let userRank = null;
  const ah = req.headers.authorization || '';
  if (ah.startsWith('tma ')) { const tg = validateTelegramInitData(ah.slice(4).trim()); if (tg) { const ur = upsertUser(tg); userRank = getUserRank(gameId, ur.id); } }
  res.json({ gameId, leaderboard:board.map((row,i)=>({rank:i+1,userId:row.user_id,telegramId:row.telegram_id,username:row.username,firstName:row.first_name,lastName:row.last_name,photoUrl:row.photo_url,equippedTitle:row.equipped_title||'title_novice',highScore:row.high_score,achievedAt:row.achieved_at})), userRank });
});
app.get('/api/referrals', authMiddleware, (req, res) => { const d = getReferralsInfo(req.user.id); if (!d) return res.status(404).json({error:'not found'}); res.json({...d,botUsername:process.env.BOT_USERNAME||'taptaphub_bot'}); });
app.post('/api/referrals/claim', authMiddleware, (req, res) => { const {startParam}=req.body; if(!startParam) return res.status(400).json({error:'required'}); const r=processReferral(req.user.id,startParam); if(!r.success) return res.status(400).json(r); const u=getUserById(req.user.id); res.json({...r,newCoins:u?.coins??0}); });
app.get('/api/daily-reward/status', authMiddleware, (req, res) => { const s=getDailyRewardStatus(req.user.id); if(!s) return res.status(404).json({error:'not found'}); res.json(s); });
app.post('/api/daily-reward/claim', authMiddleware, (req, res) => { const r=claimDailyReward(req.user.id); if(!r.success) return res.status(400).json(r); res.json(r); });
app.post('/api/coins/spend', authMiddleware, (req, res) => { const {amount,reason}=req.body; const r=spendCoins(req.user.id,amount,reason); if(!r.success) return res.status(400).json(r); res.json(r); });
app.get('/api/shop/items', authMiddleware, (req, res) => { const c=getShopCatalog(req.user.id); if(!c) return res.status(404).json({error:'not found'}); res.json(c); });
app.post('/api/shop/buy', authMiddleware, (req, res) => { const {itemId}=req.body; if(!itemId) return res.status(400).json({error:'required'}); const r=buyShopItem(req.user.id,itemId); if(!r.success) return res.status(400).json(r); res.json(r); });
app.post('/api/shop/equip', authMiddleware, (req, res) => { const {itemId}=req.body; if(!itemId) return res.status(400).json({error:'required'}); const r=equipShopItem(req.user.id,itemId); if(!r.success) return res.status(400).json(r); res.json(r); });
app.get('/api/duel/history', authMiddleware, (req, res) => { res.json({ history:getDuelHistory(req.user.id,20), stats:getDuelStats(req.user.id) }); });

// ─── GROUPS API ─────────────────────────────────────────────────────────────
app.post('/api/groups/join', authMiddleware, async (req, res) => {
  try {
    const { telegramChatId } = req.body;
    if (!telegramChatId) {
      return res.status(400).json({ error: 'Укажите @username или ссылку на группу' });
    }

    let input = String(telegramChatId).trim();
    if (input.includes('t.me/')) {
      const match = input.match(/t\.me\/(\+?[a-zA-Z0-9_]+)/);
      if (match) input = match[1];
    }
    const cleanUsername = input.replace(/^@/, '');

    let group = getGroupByTelegramChatId(input) || getGroupByUsername(cleanUsername);

    if (!group) {
      const chatInfo = await fetchTelegramChat(input);
      if (!chatInfo) {
        return res.status(404).json({ error: 'Чат не найден в Telegram или бот не имеет к нему доступа' });
      }

      group = getGroupByTelegramChatId(chatInfo.id) || createGroup({
        telegramChatId: chatInfo.id,
        name: chatInfo.title,
        username: chatInfo.username,
        photoUrl: chatInfo.photo_url,
        creatorUserId: req.user.id,
      });
    }

    const joinResult = joinGroup(req.user.id, group.id);
    if (!joinResult.success) {
      return res.status(400).json(joinResult);
    }

    const fullGroupInfo = getUserGroup(req.user.id);
    res.json({ success: true, group: fullGroupInfo });
  } catch (err) {
    console.error('Group join error:', err);
    res.status(500).json({ error: 'Ошибка при вступлении в группу' });
  }
});

app.get('/api/groups/my', authMiddleware, (req, res) => {
  const group = getUserGroup(req.user.id);
  res.json({ group });
});

app.get('/api/groups/leaderboard', (req, res) => {
  const lb = getGroupLeaderboard();
  res.json(lb);
});

app.get('/api/groups/:id', (req, res) => {
  const group = getGroupById(req.params.id);
  if (!group) return res.status(404).json({ error: 'Группа не найдена' });
  res.json({ group });
});

app.post('/api/groups/color', authMiddleware, (req, res) => {
  const { color } = req.body;
  const user = getUserById(req.user.id);
  if (!user || !user.group_id) return res.status(400).json({ error: 'Вы не состоите в группе' });
  const grp = getGroupById(user.group_id);
  if (grp.commander_user_id !== req.user.id) {
    return res.status(403).json({ error: 'Только Командор может менять цвет' });
  }
  const r = updateGroupColor(user.group_id, color);
  if (!r.success) return res.status(400).json(r);
  res.json(r);
});

// ─── WORLD MAP API ──────────────────────────────────────────────────────────
app.get('/api/world-map', (req, res) => {
  const cells = getCachedWorldMap();
  res.json({ width: 80, height: 60, cells });
});

app.get('/api/world-map/diff', (req, res) => {
  const since = req.query.since || new Date(0).toISOString();
  const diff = getWorldMapDiff(since);
  res.json({ diff });
});

app.post('/api/world-map/action', authMiddleware, (req, res) => {
  const { action, x, y, size, isEmergency, monumentName } = req.body;
  if (!action || x === undefined || y === undefined) {
    return res.status(400).json({ error: 'action, x, y обязательны' });
  }

  const result = executeMapAction({
    userId: req.user.id,
    action,
    x: parseInt(x, 10),
    y: parseInt(y, 10),
    size: size ? parseInt(size, 10) : 3,
    isEmergency: !!isEmergency,
    monumentName,
  });

  if (!result.success) {
    return res.status(400).json(result);
  }

  if (result.updatedCells && result.updatedCells.length > 0) {
    broadcastMapUpdate(result.updatedCells);
  }

  res.json(result);
});

// ─── SCORE BOOSTER API ──────────────────────────────────────────────────────
app.post('/api/booster/activate', authMiddleware, (req, res) => {
  const result = activateScoreBooster(req.user.id);
  if (!result.success) return res.status(400).json(result);
  res.json(result);
});

// ─── TELEGRAM STARS API ─────────────────────────────────────────────────────
app.get('/api/stars/products', (req, res) => {
  res.json({ products: STARS_PRODUCTS });
});

app.post('/api/stars/create-invoice', authMiddleware, async (req, res) => {
  const { productId, extra } = req.body;
  const product = STARS_PRODUCTS[productId];
  if (!product) return res.status(400).json({ error: 'Неизвестный продукт' });

  try {
    const invoiceLink = await createStarsInvoiceLink({
      title: product.name,
      description: `Покупка «${product.name}» в TapTap Hub`,
      payload: {
        userId: req.user.id,
        productId,
        extra: extra || {},
      },
      starsAmount: product.stars,
    });

    if (!invoiceLink) {
      return res.status(500).json({ error: 'Не удалось создать ссылку на оплату Stars' });
    }

    res.json({ success: true, invoiceLink, product });
  } catch (err) {
    console.error('Invoice create error:', err);
    res.status(500).json({ error: 'Ошибка создания инвойса Stars' });
  }
});

app.post('/api/stars/webhook', authMiddleware, (req, res) => {
  const { productId, extra } = req.body;
  const product = STARS_PRODUCTS[productId];
  if (!product) return res.status(400).json({ error: 'Неизвестный продукт' });

  const result = processStarsPayment({
    userId: req.user.id,
    productId,
    starsAmount: product.stars,
    chargeId: `sim_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    payload: extra || {},
  });

  res.json(result);
});


const frontendDist = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => { if (req.url.startsWith('/api')) return next(); res.sendFile(path.join(frontendDist, 'index.html')); });
}
app.use((err, req, res, next) => { console.error('Error:', err); res.status(500).json({ error:'Internal error' }); });

// ─── HTTP + WS SERVER ─────────────────────────────────────────────────────────
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

function generateRoomId() { return Math.random().toString(36).slice(2,10).toUpperCase(); }
function sendWs(ws, data) { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data)); }
function broadcast(room, data, excl) { if(room.host?.userId!==excl) sendWs(room.host?.ws,data); if(room.guest?.userId!==excl) sendWs(room.guest?.ws,data); }
function opp(room, uid) { return room.host?.userId===uid ? room.guest : room.guest?.userId===uid ? room.host : null; }
function isHostUser(room, uid) { return room.host?.userId===uid; }
function cleanup(roomId) { const r=rooms.get(roomId); if(!r)return; if(r.hostReconnectTimer)clearTimeout(r.hostReconnectTimer); if(r.guestReconnectTimer)clearTimeout(r.guestReconnectTimer); if(r._chessInterval)clearInterval(r._chessInterval); rooms.delete(roomId); }

// ─── GAME INITS ───────────────────────────────────────────────────────────────
function initChess(timerMode='3+2') {
  const t={'1min':[60000,0],'3+2':[180000,2000],'15min':[900000,0]};
  const [ms,inc]=t[timerMode]||t['3+2'];
  return {fen:'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',moves:[],currentTurn:'white',status:'active',timerMode,whiteTimeMs:ms,blackTimeMs:ms,increment:inc,lastMoveAt:Date.now(),lastTickAt:Date.now()};
}
function initDurak(mode='perevodnoy') {
  const ranks=['6','7','8','9','10','J','Q','K','A'],suits=['s','h','d','c'],deck=[];
  for(const s of suits)for(const r of ranks)deck.push({rank:r,suit:s});
  for(let i=deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}
  const trump=deck[0].suit,hand1=deck.splice(deck.length-6,6),hand2=deck.splice(deck.length-6,6);
  return {deck,trump,hand1,hand2,table:[],discardPile:[],attackerId:null,defenderId:null,phase:'attack',mode,passCount:0,isFirstRound:true};
}
function initBattleship() {
  return {phase:'placement',board1:Array(10).fill(null).map(()=>Array(10).fill(0)),board2:Array(10).fill(null).map(()=>Array(10).fill(0)),ships1:[],ships2:[],ready1:false,ready2:false,currentAttackerId:null,shots1:[],shots2:[]};
}

// ─── CHESS TIMER ──────────────────────────────────────────────────────────────
function startChessTimer(room) {
  if(room._chessInterval)clearInterval(room._chessInterval);
  room._chessInterval=setInterval(()=>{
    const gs=room.gameState; if(!gs||gs.status!=='active'){clearInterval(room._chessInterval);return;}
    const now=Date.now(),el=now-(gs.lastTickAt||gs.lastMoveAt); gs.lastTickAt=now;
    if(gs.currentTurn==='white'){gs.whiteTimeMs=Math.max(0,gs.whiteTimeMs-el);if(gs.whiteTimeMs<=0){finishChess(room,'timeout','black');return;}}
    else{gs.blackTimeMs=Math.max(0,gs.blackTimeMs-el);if(gs.blackTimeMs<=0){finishChess(room,'timeout','white');return;}}
    broadcast(room,{type:'chess_tick',whiteTimeMs:gs.whiteTimeMs,blackTimeMs:gs.blackTimeMs});
  },1000);
}

// ─── FINISH GAMES ─────────────────────────────────────────────────────────────
function finishChess(room,reason,winnerColor) {
  const gs=room.gameState; if(gs?._settled)return; if(gs)gs._settled=true;
  if(room._chessInterval)clearInterval(room._chessInterval);
  const draw=!winnerColor||reason==='draw'||reason==='stalemate';
  const wid=draw?null:(room.host.chessColor===winnerColor?room.host.userId:room.guest.userId);
  const s=settleDuel(room.id,room.host.userId,room.guest.userId,wid,room.betAmount,draw);
  broadcast(room,{type:'game_over',game:'chess',reason,winnerColor,winnerUserId:wid,isDraw:draw,payout:s.payout,commission:s.commission});
  room.status='finished'; setTimeout(()=>cleanup(room.id),30000);
}
function finishDurak(room,winnerId,reason) {
  const gs=room.gameState; if(gs?._settled)return; if(gs)gs._settled=true;
  const s=settleDuel(room.id,room.host.userId,room.guest.userId,winnerId,room.betAmount,!winnerId);
  broadcast(room,{type:'game_over',game:'durak',reason,winnerUserId:winnerId,payout:s.payout,commission:s.commission});
  room.status='finished'; setTimeout(()=>cleanup(room.id),30000);
}
function finishBattle(room,winnerId,reason) {
  const gs=room.gameState; if(gs?._settled)return; if(gs)gs._settled=true;
  if(room._bsTimeout)clearTimeout(room._bsTimeout);
  const s=settleDuel(room.id,room.host.userId,room.guest.userId,winnerId,room.betAmount,false);
  broadcast(room,{type:'game_over',game:'battleship',reason,winnerUserId:winnerId,payout:s.payout,commission:s.commission});
  room.status='finished'; setTimeout(()=>cleanup(room.id),30000);
}

// ─── START ROOM ───────────────────────────────────────────────────────────────
function startRoom(gameType,betAmount,hostEnt,guestEnt,existId,timerMode,durakMode) {
  const roomId=existId||generateRoomId();
  let gs; if(gameType==='chess')gs=initChess(timerMode||'3+2'); else if(gameType==='durak')gs=initDurak(durakMode||'perevodnoy'); else if(gameType==='battleship')gs=initBattleship(); else return;
  const hUser=getUserById(hostEnt.userId),gUser=getUserById(guestEnt.userId);
  let room=rooms.get(roomId);
  if(!room){
    createDuelRoom(roomId,gameType,betAmount,hostEnt.userId);
    room={id:roomId,gameType,betAmount,host:{userId:hostEnt.userId,firstName:hostEnt.firstName||'Host',username:hostEnt.username||null,ws:hostEnt.ws,connected:true},guest:{userId:guestEnt.userId,firstName:guestEnt.firstName||'Guest',username:guestEnt.username||null,ws:guestEnt.ws,connected:true},status:'active',gameState:gs,hostReconnectTimer:null,guestReconnectTimer:null};
    rooms.set(roomId,room);
  } else { room.guest={userId:guestEnt.userId,firstName:guestEnt.firstName||'Guest',username:guestEnt.username||null,ws:guestEnt.ws,connected:true}; room.status='active'; room.gameState=gs; }
  if(gameType==='chess'){const hw=Math.random()<0.5;room.host.chessColor=hw?'white':'black';room.guest.chessColor=hw?'black':'white';}
  if(gameType==='durak'){
    const trump=gs.trump;
    const findLowest=(hand)=>{
      const trs=hand.filter(c=>c.suit===trump);
      if(trs.length>0)return {hasTrump:true,minRank:Math.min(...trs.map(c=>RV.indexOf(c.rank)))};
      return {hasTrump:false,minRank:Math.min(...hand.map(c=>RV.indexOf(c.rank)))};
    };
    const l1=findLowest(gs.hand1),l2=findLowest(gs.hand2);
    let p1Starts=true;
    if(l1.hasTrump&&!l2.hasTrump)p1Starts=true;
    else if(!l1.hasTrump&&l2.hasTrump)p1Starts=false;
    else p1Starts=l1.minRank<=l2.minRank;

    if(p1Starts){
      gs.attackerId=room.host.userId;
      gs.defenderId=room.guest.userId;
    }else{
      gs.attackerId=room.guest.userId;
      gs.defenderId=room.host.userId;
    }
  }
  if(gameType==='battleship'){
    gs.currentAttackerId=room.host.userId;
    if(guestEnt.isBot){const rf=generateRandomFleet();gs.ships2=rf.ships;gs.board2=rf.board;gs.ready2=true;}
  }
  const base={type:'game_start',roomId,gameType,betAmount};
  const chessExtra=(color,oppColor)=>gameType==='chess'?{myColor:color,opponentColor:oppColor,fen:gs.fen,timerMode:gs.timerMode,whiteTimeMs:gs.whiteTimeMs,blackTimeMs:gs.blackTimeMs}:{};
  const durakExtra=(hand)=>gameType==='durak'?{hand,trump:gs.trump,deckCount:gs.deck.length,attackerId:gs.attackerId,defenderId:gs.defenderId,mode:gs.mode}:{};
  const bsExtra=gameType==='battleship'?{phase:'placement'}:{};
  sendWs(room.host.ws,{...base,role:'host',myUserId:room.host.userId,opponent:{firstName:room.guest.firstName,username:room.guest.username,userId:room.guest.userId},...chessExtra(room.host.chessColor,room.guest.chessColor),...durakExtra(gs.hand1),...bsExtra});
  if(room.guest.ws)sendWs(room.guest.ws,{...base,role:'guest',myUserId:room.guest.userId,opponent:{firstName:room.host.firstName,username:room.host.username,userId:room.host.userId},...chessExtra(room.guest.chessColor,room.host.chessColor),...durakExtra(gs.hand2),...bsExtra});
  if(gameType==='chess')startChessTimer(room);
  if(gameType==='durak'){bcastDurak(room);if(room.guest.isBot)triggerBotTurn(room);}
  console.log(`[Room] ${roomId} | ${gameType} | ${betAmount}c | ${room.host.firstName} vs ${room.guest.firstName}${guestEnt.isBot?' [BOT]':''}`);
}

// ─── MATCHMAKING ──────────────────────────────────────────────────────────────
function onJoinQueue(ws,user,d) {
  const {gameType,betAmount=0,timerMode,durakMode}=d,key=`${gameType}:${betAmount}`;
  if(!matchmakingQueues[key])matchmakingQueues[key]=[];
  matchmakingQueues[key]=matchmakingQueues[key].filter(e=>e.ws!==ws&&e.ws.readyState===WebSocket.OPEN);
  const waitingIdx=matchmakingQueues[key].findIndex(e=>e.ws!==ws);
  if(waitingIdx!==-1){
    const w=matchmakingQueues[key].splice(waitingIdx,1)[0];
    let guestUser=user;
    if(w.userId===user.id){
      guestUser={id:user.id+900000,firstName:`${user.firstName} (2)`,username:user.username};
    }
    if(betAmount>0){
      const f1=freezeCoins(w.userId,betAmount);
      if(!f1.success){
        sendWs(w.ws,{type:'error',message:'Недостаточно монет'});
        matchmakingQueues[key].push({userId:user.id,ws,user,timerMode,durakMode});
        sendWs(ws,{type:'queued',gameType,betAmount});
        return;
      }
    }
    startRoom(
      gameType,
      betAmount,
      {userId:w.userId,firstName:w.user.firstName,username:w.user.username,ws:w.ws},
      {userId:guestUser.id,firstName:guestUser.firstName,username:guestUser.username,ws},
      null,
      timerMode||w.timerMode,
      durakMode||w.durakMode
    );
  } else {
    matchmakingQueues[key].push({userId:user.id,ws,user,timerMode,durakMode});
    sendWs(ws,{type:'queued',gameType,betAmount});
  }
}
function onLeaveQueue(ws,user,d) {
  for(const k of Object.keys(matchmakingQueues))matchmakingQueues[k]=matchmakingQueues[k].filter(e=>e.ws!==ws);
  sendWs(ws,{type:'queue_left'});
}
function onCreateRoom(ws,user,d) {
  const {gameType,betAmount=0,timerMode,durakMode}=d;
  if(betAmount>0){const f=freezeCoins(user.id,betAmount);if(!f.success)return sendWs(ws,{type:'error',message:f.error||'Недостаточно монет'});}
  const roomId=generateRoomId();
  createDuelRoom(roomId,gameType,betAmount,user.id);
  const u=getUserById(user.id);
  rooms.set(roomId,{id:roomId,gameType,betAmount,timerMode,durakMode,host:{userId:user.id,firstName:user.firstName,username:user.username,ws,connected:true},guest:null,status:'waiting',gameState:null,hostReconnectTimer:null,guestReconnectTimer:null});
  const bot=process.env.BOT_USERNAME||'taptaphub_bot';
  sendWs(ws,{type:'room_created',roomId,gameType,betAmount,deepLink:`https://t.me/${bot}?start=duel_${roomId}`,directLink:`https://t.me/${bot}/app?startapp=duel_${roomId}`});
}
function onJoinRoom(ws,user,d) {
  const room=rooms.get(d.roomId);
  if(!room)return sendWs(ws,{type:'error',message:'Комната не найдена'});
  if(room.host.userId===user.id){
    if(room.host.ws===ws){
      return sendWs(ws,{type:'room_rejoined',roomId:room.id,role:'host',status:room.status});
    }
    // Connected from another socket (e.g. PC & phone test) -> allow as second testing player!
    const testGuestId=user.id+500000;
    upsertUser({id:testGuestId,first_name:`${user.firstName} (2)`,username:user.username});
    startRoom(room.gameType,room.betAmount,{userId:room.host.userId,firstName:room.host.firstName,username:room.host.username,ws:room.host.ws},{userId:testGuestId,firstName:`${user.firstName} (2)`,username:user.username,ws},room.id,room.timerMode,room.durakMode);
    return;
  }
  if(room.status!=='waiting')return sendWs(ws,{type:'error',message:'Комната заполнена'});
  if(room.betAmount>0){const f=freezeCoins(user.id,room.betAmount);if(!f.success)return sendWs(ws,{type:'error',message:f.error||'Недостаточно монет'});}
  startRoom(room.gameType,room.betAmount,{userId:room.host.userId,firstName:room.host.firstName,username:room.host.username,ws:room.host.ws},{userId:user.id,firstName:user.firstName,username:user.username,ws},room.id,room.timerMode,room.durakMode);
}

// ─── CHESS ────────────────────────────────────────────────────────────────────
function onChessMove(ws,user,d) {
  const room=rooms.get(d.roomId); if(!room||room.status!=='active'||room.gameType!=='chess')return;
  const gs=room.gameState;
  const myColor=isHostUser(room,user.id)?room.host.chessColor:room.guest.chessColor;
  if(gs.currentTurn!==myColor)return sendWs(ws,{type:'error',message:'Не ваш ход'});
  const {from,to,promotion,fen,status}=d,now=Date.now();
  if(gs.timerMode==='3+2'){
    if(gs.currentTurn==='white')gs.whiteTimeMs=Math.min(gs.whiteTimeMs+gs.increment,999*60000);
    else gs.blackTimeMs=Math.min(gs.blackTimeMs+gs.increment,999*60000);
  }
  gs.lastMoveAt=now;gs.lastTickAt=now;gs.fen=fen;
  gs.currentTurn=gs.currentTurn==='white'?'black':'white';
  gs.moves.push({from,to,promotion});
  sendWs(opp(room,user.id)?.ws,{type:'chess_move',from,to,promotion,fen,currentTurn:gs.currentTurn,whiteTimeMs:gs.whiteTimeMs,blackTimeMs:gs.blackTimeMs,status:status||'active'});
  if(status==='checkmate')finishChess(room,'checkmate',myColor);
  else if(status==='stalemate')finishChess(room,'stalemate',null);
  else if(status==='draw')finishChess(room,'draw',null);
}
function onChessDrawOffer(ws,user,d){const room=rooms.get(d.roomId);if(!room||room.status!=='active')return;sendWs(opp(room,user.id)?.ws,{type:'chess_draw_offered',fromUserId:user.id});}
function onChessDrawRespond(ws,user,d){const room=rooms.get(d.roomId);if(!room||room.status!=='active')return;if(d.accepted)finishChess(room,'draw',null);else sendWs(opp(room,user.id)?.ws,{type:'chess_draw_declined'});}

// ─── DURAK HELPERS ────────────────────────────────────────────────────────────
const RV=['6','7','8','9','10','J','Q','K','A'];
function getH(room,uid){return room.host.userId===uid?room.gameState.hand1:room.gameState.hand2;}
function setH(room,uid,h){if(room.host.userId===uid)room.gameState.hand1=h;else room.gameState.hand2=h;}
function drawDurak(room,attackerId,defenderId){
  const gs=room.gameState,ord=[attackerId,defenderId];
  for(const uid of ord){
    const h=getH(room,uid);
    while(h.length<6&&gs.deck.length>0)h.push(gs.deck.pop());
    setH(room,uid,h);
  }
}
function bcastDurak(room){
  const gs=room.gameState;
  sendWs(room.host.ws,{type:'durak_state',hand:gs.hand1,opponentCardCount:gs.hand2.length,table:gs.table,phase:gs.phase,deckCount:gs.deck.length,trump:gs.trump,attackerId:gs.attackerId,defenderId:gs.defenderId,discardCount:gs.discardPile.length,isFirstRound:gs.isFirstRound});
  sendWs(room.guest.ws,{type:'durak_state',hand:gs.hand2,opponentCardCount:gs.hand1.length,table:gs.table,phase:gs.phase,deckCount:gs.deck.length,trump:gs.trump,attackerId:gs.attackerId,defenderId:gs.defenderId,discardCount:gs.discardPile.length,isFirstRound:gs.isFirstRound});
}
function chkDurakWin(room){
  const gs=room.gameState;if(gs.deck.length>0)return;
  const h1=gs.hand1.length===0,h2=gs.hand2.length===0;
  if(h1&&h2)finishDurak(room,null,'draw');
  else if(h1)finishDurak(room,room.host.userId,'hand_empty');
  else if(h2)finishDurak(room,room.guest.userId,'hand_empty');
}

function onDurakAttack(ws,user,d){
  const room=rooms.get(d.roomId);if(!room||room.status!=='active'||room.gameType!=='durak')return;
  const gs=room.gameState;if(gs.attackerId!==user.id)return sendWs(ws,{type:'error',message:'Не ваш ход'});
  if(gs.phase!=='attack'&&gs.phase!=='additional'&&gs.phase!=='taking')return;
  const cardsToPlay=Array.isArray(d.cards)?d.cards:(d.card?[d.card]:[]);
  if(cardsToPlay.length===0)return;

  const maxTable=gs.isFirstRound?5:6;
  if(gs.table.length+cardsToPlay.length>maxTable)return sendWs(ws,{type:'error',message:`Максимум ${maxTable} карт на столе ${gs.isFirstRound?'(первый отбой)':''}`});

  const defHand=getH(room,gs.defenderId);
  if(gs.phase!=='taking'){
    const unbeatCount=gs.table.filter(s=>!s.defense).length;
    if(unbeatCount+cardsToPlay.length>defHand.length)return sendWs(ws,{type:'error',message:'У защитника меньше карт'});
  }

  if(gs.phase==='attack'){
    const firstRank=cardsToPlay[0].rank;
    if(!cardsToPlay.every(c=>c.rank===firstRank))return sendWs(ws,{type:'error',message:'Заходить можно только картами одного ранга'});
  }else if((gs.phase==='additional'||gs.phase==='taking')&&gs.table.length>0){
    const tr=new Set(gs.table.flatMap(t=>[t.attack.rank,t.defense?.rank].filter(Boolean)));
    if(!cardsToPlay.every(c=>tr.has(c.rank)))return sendWs(ws,{type:'error',message:'Можно подкидывать только карты того ранга, что уже есть на столе'});
  }

  const hand=getH(room,user.id);
  for(const card of cardsToPlay){
    const idx=hand.findIndex(c=>c.rank===card.rank&&c.suit===card.suit);
    if(idx===-1)return sendWs(ws,{type:'error',message:'Карты нет в руке'});
    hand.splice(idx,1);
    gs.table.push({attack:card,defense:null});
  }
  setH(room,user.id,hand);

  if(gs.phase!=='taking'){
    gs.phase='defense';
  }
  bcastDurak(room);
  chkDurakWin(room);
  if(room.guest?.isBot)triggerBotTurn(room);
}

function onDurakDefend(ws,user,d){
  const room=rooms.get(d.roomId);if(!room||room.status!=='active'||room.gameType!=='durak')return;
  const gs=room.gameState;if(gs.defenderId!==user.id)return sendWs(ws,{type:'error',message:'Не ваш ход'});
  if(gs.phase!=='defense')return;
  const {attackCard,defenseCard}=d,hand=getH(room,user.id),idx=hand.findIndex(c=>c.rank===defenseCard.rank&&c.suit===defenseCard.suit);
  if(idx===-1)return sendWs(ws,{type:'error',message:'Карты нет в руке'});
  const slot=gs.table.find(s=>s.attack.rank===attackCard.rank&&s.attack.suit===attackCard.suit&&!s.defense);
  if(!slot)return sendWs(ws,{type:'error',message:'Карта уже покрыта или не найдена'});
  const td=defenseCard.suit===gs.trump,ta=attackCard.suit===gs.trump;
  const beats=(defenseCard.suit===attackCard.suit&&RV.indexOf(defenseCard.rank)>RV.indexOf(attackCard.rank))||(td&&!ta);
  if(!beats)return sendWs(ws,{type:'error',message:'Нельзя покрыть этой картой'});

  hand.splice(idx,1);setH(room,user.id,hand);slot.defense=defenseCard;
  if(gs.table.every(s=>s.defense))gs.phase='additional';
  bcastDurak(room);
  chkDurakWin(room);
  if(room.guest?.isBot)triggerBotTurn(room);
}

function onDurakPass(ws,user,d){
  const room=rooms.get(d.roomId);if(!room||room.status!=='active'||room.gameType!=='durak')return;
  const gs=room.gameState;
  if(gs.mode!=='perevodnoy')return sendWs(ws,{type:'error',message:'Включен классический подкидной режим'});
  if(gs.defenderId!==user.id)return sendWs(ws,{type:'error',message:'Переводить может только защищающийся'});
  if(gs.table.length===0)return sendWs(ws,{type:'error',message:'Стол пуст'});
  // Rule: Cannot pass if ANY card on the table has already been defended!
  if(!gs.table.every(s=>!s.defense))return sendWs(ws,{type:'error',message:'Нельзя переводить после начала отбивания'});

  const cardsToPass=Array.isArray(d.cards)?d.cards:(d.card?[d.card]:[]);
  if(cardsToPass.length===0)return;

  const baseRank=gs.table[0].attack.rank;
  if(!gs.table.every(s=>s.attack.rank===baseRank)){
    return sendWs(ws,{type:'error',message:'На столе карты разных достоинств, перевод невозможен'});
  }
  if(!cardsToPass.every(c=>c.rank===baseRank)){
    return sendWs(ws,{type:'error',message:'Переводить можно только картами того же ранга'});
  }

  const targetHand=getH(room,gs.attackerId);
  if(gs.table.length+cardsToPass.length>targetHand.length){
    return sendWs(ws,{type:'error',message:'У соперника недостаточно карт для перевода'});
  }
  const maxTable=gs.isFirstRound?5:6;
  if(gs.table.length+cardsToPass.length>maxTable){
    return sendWs(ws,{type:'error',message:`Максимум ${maxTable} карт на столе`});
  }

  const hand=getH(room,user.id);
  for(const card of cardsToPass){
    const idx=hand.findIndex(c=>c.rank===card.rank&&c.suit===card.suit);
    if(idx===-1)return sendWs(ws,{type:'error',message:'Карты нет в руке'});
    hand.splice(idx,1);
    gs.table.push({attack:card,defense:null});
  }
  setH(room,user.id,hand);

  // Switch roles: old defender becomes attacker, old attacker becomes defender!
  [gs.attackerId,gs.defenderId]=[gs.defenderId,gs.attackerId];
  gs.phase='defense';
  gs.passCount++;
  bcastDurak(room);
  chkDurakWin(room);
  if(room.guest?.isBot)triggerBotTurn(room);
}

function onDurakTake(ws,user,d){
  const room=rooms.get(d.roomId);if(!room||room.status!=='active'||room.gameType!=='durak')return;
  const gs=room.gameState;if(gs.defenderId!==user.id)return sendWs(ws,{type:'error',message:'Не ваш ход'});
  if(gs.table.length===0)return sendWs(ws,{type:'error',message:'Стол пуст'});

  // Check if attacker has cards to toss in pursuit
  const attackerHand=getH(room,gs.attackerId);
  const tableRanks=new Set(gs.table.flatMap(t=>[t.attack.rank,t.defense?.rank].filter(Boolean)));
  const maxTable=gs.isFirstRound?5:6;
  const canTossMore=gs.table.length<maxTable&&attackerHand.some(c=>tableRanks.has(c.rank));

  if(canTossMore){
    gs.phase='taking';
    bcastDurak(room);
    if(room.guest?.isBot)triggerBotTurn(room);
  }else{
    resolveDurakTake(room);
  }
}

function resolveDurakTake(room){
  const gs=room.gameState;
  const curAttacker=gs.attackerId,curDefender=gs.defenderId;
  const hand=getH(room,curDefender);
  for(const s of gs.table){
    hand.push(s.attack);
    if(s.defense)hand.push(s.defense);
  }
  setH(room,curDefender,hand);
  gs.table=[];
  gs.passCount=0;
  gs.isFirstRound=false;

  // Canonical order: attacker draws first, then defender!
  drawDurak(room,curAttacker,curDefender);

  // Attacker attacks again!
  gs.phase='attack';
  chkDurakWin(room);
  if(room.status!=='finished'){
    bcastDurak(room);
    if(room.guest?.isBot)triggerBotTurn(room);
  }
}

function onDurakDoneAttacking(ws,user,d){
  const room=rooms.get(d.roomId);if(!room||room.status!=='active'||room.gameType!=='durak')return;
  const gs=room.gameState;if(gs.attackerId!==user.id)return;

  if(gs.phase==='taking'){
    resolveDurakTake(room);
    return;
  }

  if(gs.phase==='additional'){
    // Бито!
    for(const s of gs.table){
      gs.discardPile.push(s.attack);
      if(s.defense)gs.discardPile.push(s.defense);
    }
    gs.table=[];
    gs.passCount=0;
    gs.isFirstRound=false;

    const curAttacker=gs.attackerId,curDefender=gs.defenderId;
    drawDurak(room,curAttacker,curDefender);

    // Defender becomes new attacker!
    gs.attackerId=curDefender;
    gs.defenderId=curAttacker;
    gs.phase='attack';
    chkDurakWin(room);
    if(room.status!=='finished'){
      bcastDurak(room);
      if(room.guest?.isBot)triggerBotTurn(room);
    }
  }
}

// ─── BATTLESHIP ───────────────────────────────────────────────────────────────
function validShips(ships){if(!Array.isArray(ships)||ships.length!==10)return false;const req={4:1,3:2,2:3,1:4},cnt={};for(const s of ships)cnt[s.size]=(cnt[s.size]||0)+1;return Object.entries(req).every(([sz,c])=>(cnt[sz]||0)===c);}
function generateRandomFleet() {
  const req=[4,3,3,2,2,2,1,1,1,1],grid=Array(10).fill(null).map(()=>Array(10).fill(0)),ships=[];let id=0;
  for(const size of req){
    let placed=false;
    for(let att=0;att<300&&!placed;att++){
      const hor=Math.random()<0.5,r=Math.floor(Math.random()*(hor?10:10-size+1)),c=Math.floor(Math.random()*(hor?10-size+1:10)),cells=[];let ok=true;
      for(let i=0;i<size;i++){
        const cr=hor?r:r+i,cc=hor?c+i:c;
        for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
          const nr=cr+dr,nc=cc+dc;
          if(nr>=0&&nr<10&&nc>=0&&nc<10&&grid[nr][nc]===1){ok=false;break;}
        }
        if(!ok)break;cells.push({r:cr,c:cc});
      }
      if(ok){for(const cl of cells)grid[cl.r][cl.c]=1;ships.push({id:id++,size,cells,horizontal:hor});placed=true;}
    }
  }
  return {ships,board:grid};
}
function onBattlePlace(ws,user,d){
  const room=rooms.get(d.roomId);if(!room||room.status!=='active'||room.gameType!=='battleship')return;
  const gs=room.gameState;if(gs.phase!=='placement')return;
  let {ships}=d;
  if(!validShips(ships)){const rf=generateRandomFleet();ships=rf.ships;}
  const isH=isHostUser(room,user.id),board=Array(10).fill(null).map(()=>Array(10).fill(0));
  for(const ship of ships)for(const cell of ship.cells)board[cell.r][cell.c]=1;
  if(isH){gs.ships1=ships;gs.board1=board;gs.ready1=true;}else{gs.ships2=ships;gs.board2=board;gs.ready2=true;}
  sendWs(ws,{type:'battleship_placed'});
  if(gs.ready1&&gs.ready2){
    if(room._bsTimeout)clearTimeout(room._bsTimeout);
    gs.phase='battle';
    broadcast(room,{type:'battleship_battle_start',currentAttackerId:gs.currentAttackerId});
    if(room.guest?.isBot&&gs.currentAttackerId===room.guest.userId)triggerBotTurn(room);
  } else if(!room._bsTimeout) {
    // If opponent hasn't confirmed yet, give 4 seconds and auto-start!
    room._bsTimeout=setTimeout(()=>{
      if(room.status==='active'&&gs.phase==='placement'){
        if(!gs.ready1){const f=generateRandomFleet();gs.ships1=f.ships;gs.board1=f.board;gs.ready1=true;}
        if(!gs.ready2){const f=generateRandomFleet();gs.ships2=f.ships;gs.board2=f.board;gs.ready2=true;}
        gs.phase='battle';
        broadcast(room,{type:'battleship_battle_start',currentAttackerId:gs.currentAttackerId});
      }
    },4000);
  }
}
function onBattleShoot(ws,user,d){
  const room=rooms.get(d.roomId);if(!room||room.status!=='active'||room.gameType!=='battleship')return;
  const gs=room.gameState;if(gs.phase!=='battle')return;
  if(gs.currentAttackerId!==user.id)return sendWs(ws,{type:'error',message:'Не ваш ход'});
  const {r,c}=d,isH=isHostUser(room,user.id);
  const tBoard=isH?gs.board2:gs.board1,tShots=isH?gs.shots1:gs.shots2,tShips=isH?gs.ships2:gs.ships1;
  if(tShots.find(s=>s.r===r&&s.c===c))return sendWs(ws,{type:'error',message:'Уже стреляли'});
  const hit=tBoard[r][c]===1;tShots.push({r,c,hit});
  let sunk=null,autoMisses=[];
  if(hit){
    for(const ship of tShips){
      if(!ship.sunk&&ship.cells.every(cell=>tShots.find(s=>s.r===cell.r&&s.c===cell.c&&s.hit))){
        ship.sunk=true;
        sunk=ship;
        // Auto-open surrounding perimeter cells as misses
        for(const cell of ship.cells){
          for(let dr=-1;dr<=1;dr++){
            for(let dc=-1;dc<=1;dc++){
              const nr=cell.r+dr,nc=cell.c+dc;
              if(nr>=0&&nr<10&&nc>=0&&nc<10){
                if(!tShots.find(s=>s.r===nr&&s.c===nc)){
                  const miss={r:nr,c:nc,hit:false};
                  tShots.push(miss);
                  autoMisses.push(miss);
                }
              }
            }
          }
        }
      }
    }
  }
  const allSunk=tShips.every(s=>s.sunk);
  const op=opp(room,user.id),nextId=hit&&!allSunk?user.id:op?.userId;
  sendWs(ws,{type:'battleship_shot_result',r,c,hit,sunk:sunk?.cells||null,autoMisses,myShots:tShots,nextAttackerId:nextId});
  sendWs(op?.ws,{type:'battleship_opponent_shot',r,c,hit,sunk:sunk?.cells||null,autoMisses,allShots:tShots,nextAttackerId:nextId});
  if(allSunk)finishBattle(room,user.id,'all_sunk');
  else{
    gs.currentAttackerId=nextId;
    if(op?.isBot&&nextId===op.userId)triggerBotTurn(room);
  }
}

// ─── BOT LOGIC ────────────────────────────────────────────────────────────────
function triggerBotTurn(room){
  if(!room||room.status!=='active')return;
  const bot=room.guest?.isBot?room.guest:(room.host?.isBot?room.host:null);
  if(!bot)return;
  const human=bot===room.guest?room.host:room.guest,gs=room.gameState;
  if(!gs)return;
  if(room.gameType==='battleship'&&gs.phase==='battle'){
    if(gs.currentAttackerId===bot.userId){
      setTimeout(()=>{
        if(room.status!=='active'||gs.currentAttackerId!==bot.userId)return;
        const bShots=bot===room.host?gs.shots1:gs.shots2,hBoard=bot===room.host?gs.board2:gs.board1,hShips=bot===room.host?gs.ships2:gs.ships1;
        const shotSet=new Set(bShots.map(s=>`${s.r},${s.c}`)),avail=[];
        for(let r=0;r<10;r++)for(let c=0;c<10;c++)if(!shotSet.has(`${r},${c}`))avail.push({r,c});
        if(avail.length===0)return;
        const {r,c}=avail[Math.floor(Math.random()*avail.length)];
        const hit=hBoard[r][c]===1;bShots.push({r,c,hit});
        let sunk=null;
        if(hit)for(const ship of hShips){if(!ship.sunk&&ship.cells.every(cell=>bShots.find(s=>s.r===cell.r&&s.c===cell.c&&s.hit))){ship.sunk=true;sunk=ship;}}
        const allSunk=hShips.every(s=>s.sunk);
        const nextId=hit&&!allSunk?bot.userId:human.userId;
        gs.currentAttackerId=nextId;
        sendWs(human.ws,{type:'battleship_opponent_shot',r,c,hit,sunk:sunk?.cells||null,nextAttackerId:nextId});
        if(allSunk)finishBattle(room,bot.userId,'all_sunk');
        else if(nextId===bot.userId)triggerBotTurn(room);
      },1200);
    }
  }else if(room.gameType==='durak'){
    setTimeout(()=>{
      if(room.status!=='active')return;
      const bHand=getH(room,bot.userId);
      if(gs.defenderId===bot.userId&&gs.phase==='defense'){
        const slot=gs.table.find(s=>!s.defense);
        if(slot){
          const ta=slot.attack.suit===gs.trump;
          const beatIdx=bHand.findIndex(c=>(c.suit===slot.attack.suit&&RV.indexOf(c.rank)>RV.indexOf(slot.attack.rank))||(c.suit===gs.trump&&!ta));
          if(beatIdx!==-1){
            const defCard=bHand.splice(beatIdx,1)[0];
            setH(room,bot.userId,bHand);
            slot.defense=defCard;
            if(gs.table.every(s=>s.defense))gs.phase='additional';
            bcastDurak(room);
            chkDurakWin(room);
          }else{
            const cardsToTake=gs.table.flatMap(s=>[s.attack,s.defense].filter(Boolean));
            bHand.push(...cardsToTake);
            setH(room,bot.userId,bHand);
            gs.table=[];
            gs.phase='attack';
            drawDurak(room);
            bcastDurak(room);
            chkDurakWin(room);
          }
        }
      }else if(gs.attackerId===bot.userId&&(gs.phase==='attack'||gs.phase==='additional')){
        if(bHand.length>0&&gs.table.length<6){
          let cardIdx=0;
          if(gs.phase==='additional'&&gs.table.length>0){
            const tr=new Set(gs.table.flatMap(t=>[t.attack.rank,t.defense?.rank].filter(Boolean)));
            cardIdx=bHand.findIndex(c=>tr.has(c.rank));
          }
          if(cardIdx!==-1){
            const card=bHand.splice(cardIdx,1)[0];
            setH(room,bot.userId,bHand);
            gs.table.push({attack:card,defense:null});
            gs.phase='defense';
            bcastDurak(room);
            chkDurakWin(room);
          }else if(gs.phase==='additional'){
            gs.discardPile.push(...gs.table.flatMap(s=>[s.attack,s.defense].filter(Boolean)));
            gs.table=[];
            [gs.attackerId,gs.defenderId]=[gs.defenderId,gs.attackerId];
            gs.phase='attack';
            drawDurak(room);
            bcastDurak(room);
            chkDurakWin(room);
          }
        }
      }
    },1000);
  }
}

// ─── SURRENDER / DISCONNECT ───────────────────────────────────────────────────
function onSurrender(ws,user,d,game){
  const room=rooms.get(d.roomId);if(!room||room.status!=='active')return;
  const op=opp(room,user.id);if(!op)return;
  if(game==='chess')finishChess(room,'surrender',op.chessColor);
  else if(game==='durak')finishDurak(room,op.userId,'surrender');
  else if(game==='battleship')finishBattle(room,op.userId,'surrender');
}
function onDisconnect(ws,user){
  for(const [rid,room] of rooms){
    const isH=room.host?.ws===ws,isG=room.guest?.ws===ws;
    if(!isH&&!isG)continue;
    if(room.status==='waiting'&&isH){cleanup(rid);continue;}
    if(room.status==='active'){
      const slot=isH?room.host:room.guest;slot.connected=false;slot.ws=null;
      const op=opp(room,user.id);sendWs(op?.ws,{type:'opponent_disconnected',reconnectSeconds:45});
      const tk=isH?'hostReconnectTimer':'guestReconnectTimer';if(room[tk])clearTimeout(room[tk]);
      room[tk]=setTimeout(()=>{
        if(room.status!=='active')return;
        const conn=isH?room.guest:room.host;if(!conn){cleanup(rid);return;}
        if(room.gameType==='chess')finishChess(room,'disconnect',conn.chessColor);
        else if(room.gameType==='durak')finishDurak(room,conn.userId,'disconnect');
        else if(room.gameType==='battleship')finishBattle(room,conn.userId,'disconnect');
      },45000);
    }
  }
  for(const k of Object.keys(matchmakingQueues))matchmakingQueues[k]=matchmakingQueues[k].filter(e=>e.ws!==ws);
}
function onReconnect(ws,user){
  for(const [,room] of rooms){
    const isH=room.host?.userId===user.id,isG=room.guest?.userId===user.id;
    if(!isH&&!isG||room.status!=='active')continue;
    const slot=isH?room.host:room.guest;slot.connected=true;slot.ws=ws;
    const tk=isH?'hostReconnectTimer':'guestReconnectTimer';if(room[tk]){clearTimeout(room[tk]);room[tk]=null;}
    sendWs(opp(room,user.id)?.ws,{type:'opponent_reconnected'});
    const gs=room.gameState;
    sendWs(ws,{type:'reconnected',roomId:room.id,gameType:room.gameType,betAmount:room.betAmount,role:isH?'host':'guest',myUserId:user.id,...(room.gameType==='chess'?{fen:gs.fen,myColor:slot.chessColor,currentTurn:gs.currentTurn,whiteTimeMs:gs.whiteTimeMs,blackTimeMs:gs.blackTimeMs,timerMode:gs.timerMode}:{}),...(room.gameType==='durak'?{hand:isH?gs.hand1:gs.hand2,table:gs.table,phase:gs.phase,deckCount:gs.deck.length,trump:gs.trump,attackerId:gs.attackerId}:{}),...(room.gameType==='battleship'?{phase:gs.phase,myShots:isH?gs.shots1:gs.shots2,currentAttackerId:gs.currentAttackerId}:{})});
    return;
  }
}

// ─── DISPATCH ─────────────────────────────────────────────────────────────────
function dispatch(ws,user,msg){
  try{
    const d=JSON.parse(msg);
    switch(d.type){
      case 'join_queue':return onJoinQueue(ws,user,d);
      case 'leave_queue':return onLeaveQueue(ws,user,d);
      case 'create_room':return onCreateRoom(ws,user,d);
      case 'join_room':return onJoinRoom(ws,user,d);
      case 'chess_move':return onChessMove(ws,user,d);
      case 'chess_offer_draw':return onChessDrawOffer(ws,user,d);
      case 'chess_respond_draw':return onChessDrawRespond(ws,user,d);
      case 'chess_surrender':return onSurrender(ws,user,d,'chess');
      case 'durak_attack':return onDurakAttack(ws,user,d);
      case 'durak_defend':return onDurakDefend(ws,user,d);
      case 'durak_pass':return onDurakPass(ws,user,d);
      case 'durak_take':return onDurakTake(ws,user,d);
      case 'durak_done_attacking':return onDurakDoneAttacking(ws,user,d);
      case 'durak_surrender':return onSurrender(ws,user,d,'durak');
      case 'battleship_place':return onBattlePlace(ws,user,d);
      case 'battleship_shoot':return onBattleShoot(ws,user,d);
      case 'battleship_surrender':return onSurrender(ws,user,d,'battleship');
      case 'ping':sendWs(ws,{type:'pong',ts:Date.now()});break;
      default:sendWs(ws,{type:'error',message:`Unknown: ${d.type}`});
    }
  }catch(e){console.error('WS err:',e);sendWs(ws,{type:'error',message:'Bad format'});}
}

// ─── WS UPGRADE ───────────────────────────────────────────────────────────────
server.on('upgrade',(request,socket,head)=>{
  const url=new URL(request.url,'http://localhost');
  console.log('[UPGRADE RAW URL]', request.url);
  if(!url.pathname.startsWith('/api/ws')){socket.destroy();return;}
  wss.handleUpgrade(request,socket,head,(ws)=>{
    const initData=url.searchParams.get('initData')||'';
    const tgU=validateTelegramInitData(initData);
    let user;
    if(tgU){
      user=upsertUser(tgU);
      user.firstName=tgU.first_name||'Игрок';
      user.username=tgU.username||null;
    } else {
      const devId=url.searchParams.get('devUserId');
      const devName=url.searchParams.get('devUserName')||'Игрок';
      if(devId){
        const uid=parseInt(devId,10);
        user=getUserById(uid)||upsertUser({id:uid,first_name:devName,username:devName});
        user.firstName=user.first_name||devName;
        user.username=user.username||devName;
      } else {
        const randId=Math.floor(10000+Math.random()*90000);
        user=upsertUser({id:randId,first_name:`Игрок_${randId}`,username:`player_${randId}`});
        user.firstName=user.first_name;
      }
    }
    console.log(`[WS] + ${user.firstName}(${user.id})`);
    allConnectedSockets.add(ws);
    onReconnect(ws,user);
    ws.on('message',(msg)=>dispatch(ws,user,msg));
    ws.on('close',()=>{
      allConnectedSockets.delete(ws);
      console.log(`[WS] - ${user.firstName}(${user.id})`);
      onDisconnect(ws,user);
    });
    ws.on('error',(e)=>{
      allConnectedSockets.delete(ws);
      console.error(`[WS] err ${user.id}:`,e.message);
    });
  });
});

server.listen(PORT,()=>{
  console.log(`🚀 Backend on http://localhost:${PORT}`);
  console.log(`🔌 WS ready at ws://localhost:${PORT}/api/ws`);
  startBotPolling().catch(e=>console.error('Bot error:',e));
});