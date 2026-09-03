import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDuelWebSocket, type DuelGameType } from './useDuelWebSocket';
import { ChessGame } from './chess/ChessGame';
import { DurakGame } from './durak/DurakGame';
import { BattleshipGame } from './battleship/BattleshipGame';
import { getTelegramWebApp, haptics } from '../../telegram/telegram';
import { useGameBridge } from '../../context/GameContext';
import { setupBackButton, removeBackButton } from '../../telegram/telegram';

type LobbyPhase = 'select_game' | 'select_bet' | 'select_timer' | 'select_durak_mode' | 'searching' | 'invite_link' | 'in_game';

interface GameInfo { id: DuelGameType; title: string; icon: string; description: string }
const GAMES: GameInfo[] = [
  { id: 'chess', title: 'РЁР°С…РјР°С‚С‹', icon: 'в™џпёЏ', description: 'РљР»Р°СЃСЃРёС‡РµСЃРєРёРµ С€Р°С…РјР°С‚С‹ 1v1 СЃ С‚Р°Р№РјРµСЂРѕРј' },
  { id: 'durak', title: 'Р”СѓСЂР°Рє', icon: 'рџѓЏ', description: 'РџРѕРґРєРёРґРЅРѕР№/РџРµСЂРµРІРѕРґРЅРѕР№ РґСѓСЂР°Рє РЅР° 36 РєР°СЂС‚' },
  { id: 'battleship', title: 'РњРѕСЂСЃРєРѕР№ Р‘РѕР№', icon: 'рџљў', description: 'Р Р°СЃСЃС‚Р°РІСЊ С„Р»РѕС‚ Рё С‚РѕРїРё РєРѕСЂР°Р±Р»Рё РІСЂР°РіР°' },
];

const BETS = [0, 50, 100, 250, 500];
const TIMER_MODES = [
  { id: '1min', label: 'вЏ± 1 РјРёРЅСѓС‚Р°', sub: 'Р­РєСЃРїСЂРµСЃСЃ' },
  { id: '3+2', label: 'вљЎ 3+2 РјРёРЅСѓС‚С‹', sub: 'Р‘Р»РёС†' },
  { id: '15min', label: 'рџ•ђ 15 РјРёРЅСѓС‚', sub: 'РљР»Р°СЃСЃРёРєР°' },
];
const DURAK_MODES = [
  { id: 'perevodnoy', label: 'рџ”„ РџРµСЂРµРІРѕРґРЅРѕР№', sub: 'РњРѕР¶РЅРѕ РїРµСЂРµРІРѕРґРёС‚СЊ РєР°СЂС‚Сѓ' },
  { id: 'podkidnoy', label: 'вљ”пёЏ РџРѕРґРєРёРґРЅРѕР№', sub: 'РўРѕР»СЊРєРѕ Р·Р°С‰РёС‰Р°С‚СЊСЃСЏ' },
];

export const DuelLobby: React.FC = () => {
  const { user, refreshProfile, coins } = useGameBridge();
  const { send, on, connected } = useDuelWebSocket();

  const [phase, setPhase] = useState<LobbyPhase>('select_game');
  const [selectedGame, setSelectedGame] = useState<DuelGameType | null>(null);
  const [selectedBet, setSelectedBet] = useState<number>(0);
  const [timerMode, setTimerMode] = useState('3+2');
  const [durakMode, setDurakMode] = useState('perevodnoy');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [searchSeconds, setSearchSeconds] = useState(0);
  const [opponentDisconnectCountdown, setOpponentDisconnectCountdown] = useState<number | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const disconnectTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // в”Ђв”Ђв”Ђ Game state в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
  const [gameStartData, setGameStartData] = useState<Parameters<Parameters<typeof on>[1]>[0] | null>(null);
  const [chessOpponentMove, setChessOpponentMove] = useState<Parameters<Parameters<typeof on<'chess_move'>>[1]>[0] | null>(null);
  const [chessTick, setChessTick] = useState<Parameters<Parameters<typeof on<'chess_tick'>>[1]>[0] | null>(null);
  const [chessDrawOffered, setChessDrawOffered] = useState(false);
  const [durakState, setDurakState] = useState<Parameters<Parameters<typeof on<'durak_state'>>[1]>[0] | null>(null);
  const [battlePhase, setBattlePhase] = useState<'placement' | 'battle' | 'finished'>('placement');
  const [battleCurrentAttacker, setBattleCurrentAttacker] = useState<number | null>(null);
  const [myShots, setMyShots] = useState<Array<{r:number;c:number;hit:boolean}>>([]);
  const [opponentShots, setOpponentShots] = useState<Array<{r:number;c:number;hit:boolean}>>([]);
  const [myBoard, setMyBoard] = useState<number[][]>();
  const [sunkEnemyCells, setSunkEnemyCells] = useState<Array<{r:number;c:number}>>([]);
  const [gameOverData, setGameOverData] = useState<Parameters<Parameters<typeof on<'game_over'>>[1]>[0] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // в”Ђв”Ђв”Ђ Auto-join from deep link в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
  useEffect(() => {
    if (!connected) return;
    try {
      const pendingRoom = localStorage.getItem('hub_pending_duel_room');
      if (pendingRoom) {
        localStorage.removeItem('hub_pending_duel_room');
        setRoomId(pendingRoom);
        send({ type: 'join_room', roomId: pendingRoom });
        haptics.medium();
      }
    } catch { /* ignore */ }
  }, [connected, send]);

  // в”Ђв”Ђв”Ђ WS event handlers в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
  useEffect(() => {
    const offs = [
      on('queued', () => { /* already in searching phase */ }),
      on('queue_left', () => {}),
      on('room_created', (d) => { setRoomId(d.roomId); setDeepLink(d.deepLink); setPhase('invite_link'); }),
      on('game_start', (d) => {
        setGameStartData(d as never);
        setPhase('in_game');
        setChessOpponentMove(null); setChessTick(null); setChessDrawOffered(false);
        setDurakState(null); setGameOverData(null); setMyShots([]); setOpponentShots([]); setSunkEnemyCells([]);
        setBattlePhase('placement'); setBattleCurrentAttacker(null);
        if (searchTimerRef.current) clearInterval(searchTimerRef.current);
      }),
      on('chess_move', (d) => setChessOpponentMove(d)),
      on('chess_tick', (d) => setChessTick(d)),
      on('chess_draw_offered', () => setChessDrawOffered(true)),
      on('chess_draw_declined', () => setChessDrawOffered(false)),
      on('durak_state', (d) => setDurakState(d as never)),
      on('battleship_placed', () => {}),
      on('battleship_battle_start', (d) => { setBattlePhase('battle'); setBattleCurrentAttacker(d.currentAttackerId); }),
      on('battleship_shot_result', (d) => {
        setMyShots(d.myShots);
        setBattleCurrentAttacker(d.nextAttackerId);
        if (d.sunk) setSunkEnemyCells(prev => [...prev, ...(d.sunk ?? [])]);
      }),
      on('battleship_opponent_shot', (d) => {
        setOpponentShots(prev => [...prev, { r: d.r, c: d.c, hit: d.hit }]);
        setBattleCurrentAttacker(d.nextAttackerId);
      }),
      on('game_over', (d) => {
        setGameOverData(d as never);
        setBattlePhase('finished');
        refreshProfile();
      }),
      on('opponent_disconnected', (d) => {
        setOpponentDisconnectCountdown(d.reconnectSeconds);
        if (disconnectTimerRef.current) clearInterval(disconnectTimerRef.current);
        disconnectTimerRef.current = setInterval(() => {
          setOpponentDisconnectCountdown(prev => {
            if (prev === null || prev <= 1) { clearInterval(disconnectTimerRef.current!); return null; }
            return prev - 1;
          });
        }, 1000);
      }),
      on('opponent_reconnected', () => { setOpponentDisconnectCountdown(null); if (disconnectTimerRef.current) clearInterval(disconnectTimerRef.current); }),
      on('error', (d) => { setErrorMsg(d.message); setTimeout(() => setErrorMsg(null), 4000); }),
    ];
    return () => offs.forEach(off => off());
  }, [on, refreshProfile]);

  // в”Ђв”Ђв”Ђ Search timer в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
  useEffect(() => {
    if (phase === 'searching') {
      setSearchSeconds(0);
      searchTimerRef.current = setInterval(() => setSearchSeconds(s => s + 1), 1000);
    } else {
      if (searchTimerRef.current) clearInterval(searchTimerRef.current);
    }
    return () => { if (searchTimerRef.current) clearInterval(searchTimerRef.current); };
  }, [phase]);

  // в”Ђв”Ђв”Ђ Back button в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
  useEffect(() => {
    if (phase === 'in_game' && !gameOverData) {
      setupBackButton(() => {}); // disable back during game
    } else if (phase !== 'select_game') {
      setupBackButton(() => {
        send({ type: 'leave_queue' });
        setPhase('select_game');
      });
    } else {
      removeBackButton();
    }
    return () => { if (phase !== 'in_game') removeBackButton(); };
  }, [phase, gameOverData, send]);

  // в”Ђв”Ђв”Ђ Quick match в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
  const startQuickMatch = useCallback(() => {
    if (!selectedGame) return;
    send({ type: 'join_queue', gameType: selectedGame, betAmount: selectedBet, timerMode, durakMode });
    setPhase('searching');
    haptics.medium();
  }, [selectedGame, selectedBet, timerMode, durakMode, send]);

  // в”Ђв”Ђв”Ђ Create invite room в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
  const createInviteRoom = useCallback(() => {
    if (!selectedGame) return;
    send({ type: 'create_room', gameType: selectedGame, betAmount: selectedBet, timerMode, durakMode });
    haptics.medium();
  }, [selectedGame, selectedBet, timerMode, durakMode, send]);

  const shareLink = () => {
    if (!deepLink) return;
    const tg = getTelegramWebApp();
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(deepLink)}&text=${encodeURIComponent('рџЋ® РџСЂРёРіР»Р°С€Р°СЋ С‚РµР±СЏ РЅР° РґСѓСЌР»СЊ РІ TapTap Puzzle Hub!')}`);
    } else {
      navigator.clipboard?.writeText(deepLink);
    }
  };

  // в”Ђв”Ђв”Ђ Game actions в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
  const sendChessMove = useCallback((from: string, to: string, promo: string | undefined, fen: string, status: string) => {
    send({ type: 'chess_move', roomId, from, to, promotion: promo, fen, status });
  }, [send, roomId]);

  const backToLobby = () => {
    setPhase('select_game');
    setGameStartData(null);
    setGameOverData(null);
    setRoomId(null);
    setDeepLink(null);
    removeBackButton();
  };

  // в”Ђв”Ђв”Ђ RENDER в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
  const gs = gameStartData as unknown as {
    roomId: string; gameType: DuelGameType; betAmount: number; role: string; myUserId: number;
    opponent: { firstName: string; username: string | null; userId: number };
    myColor?: 'white' | 'black'; fen?: string; timerMode?: string; whiteTimeMs?: number; blackTimeMs?: number;
    hand?: Array<{rank:string;suit:string}>; trump?: string; deckCount?: number;
    attackerId?: number; defenderId?: number; mode?: string; phase?: string;
  } | null;

  if (phase === 'in_game' && gs) {
    const afterGame = gameOverData ? (
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-tg-secondaryBg border-t border-[var(--tg-theme-section-separator-color)]">
        <button onClick={backToLobby} className="w-full py-3 rounded-xl tg-btn-primary font-bold text-sm active:scale-95 transition-transform">
          Р’ Р»РѕР±Р±Рё
        </button>
      </div>
    ) : null;

    if (gs.gameType === 'chess') return (
      <div className="relative h-full flex flex-col">
        {opponentDisconnectCountdown !== null && (
          <div className="absolute top-0 left-0 right-0 z-30 bg-amber-500/90 text-black text-xs font-bold text-center py-1">
            вљЎ РЎРѕРїРµСЂРЅРёРє РѕС‚РєР»СЋС‡РёР»СЃСЏ. РџРµСЂРµРїРѕРґРєР»СЋС‡РµРЅРёРµ: {opponentDisconnectCountdown}СЃ
          </div>
        )}
        <ChessGame
          roomId={gs.roomId} myColor={gs.myColor as 'white' | 'black' ?? 'white'}
          initialFen={gs.fen ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'}
          timerMode={gs.timerMode ?? '3+2'} initialWhiteMs={gs.whiteTimeMs ?? 180000} initialBlackMs={gs.blackTimeMs ?? 180000}
          myUserId={gs.myUserId} opponent={gs.opponent} betAmount={gs.betAmount}
          onMove={sendChessMove}
          onSurrender={() => send({ type: 'chess_surrender', roomId })}
          onOfferDraw={() => send({ type: 'chess_offer_draw', roomId })}
          onRespondDraw={(a) => { send({ type: 'chess_respond_draw', roomId, accepted: a }); setChessDrawOffered(false); }}
          opponentMove={chessOpponentMove} tickData={chessTick}
          drawOffered={chessDrawOffered} gameOverData={gameOverData as never}
        />
        {afterGame}
      </div>
    );

    if (gs.gameType === 'durak') return (
      <div className="relative h-full flex flex-col">
        {opponentDisconnectCountdown !== null && (
          <div className="absolute top-0 left-0 right-0 z-30 bg-amber-500/90 text-black text-xs font-bold text-center py-1">
            вљЎ РЎРѕРїРµСЂРЅРёРє РѕС‚РєР»СЋС‡РёР»СЃСЏ. РџРµСЂРµРїРѕРґРєР»СЋС‡РµРЅРёРµ: {opponentDisconnectCountdown}СЃ
          </div>
        )}
        <DurakGame
          roomId={gs.roomId} myUserId={gs.myUserId} opponent={gs.opponent} betAmount={gs.betAmount}
          gameState={(durakState ? {
            hand: durakState.hand ?? [],
            opponentCardCount: durakState.opponentCardCount ?? 0,
            table: durakState.table ?? [],
            phase: durakState.phase ?? 'attack',
            deckCount: durakState.deckCount ?? 0,
            trump: durakState.trump as 's'|'h'|'d'|'c' ?? 's',
            attackerId: durakState.attackerId ?? 0,
            defenderId: durakState.defenderId ?? 0,
            discardCount: durakState.discardCount ?? 0,
          } : gs.hand ? {
            hand: gs.hand as Array<{rank:string;suit:string}>,
            opponentCardCount: 6,
            table: [],
            phase: 'attack',
            deckCount: gs.deckCount ?? 24,
            trump: gs.trump as 's'|'h'|'d'|'c' ?? 's',
            attackerId: gs.attackerId ?? 0,
            defenderId: gs.defenderId ?? 0,
            discardCount: 0,
          } : null) as any}
          onAttack={(card) => send({ type: 'durak_attack', roomId, card })}
          onDefend={(a, d) => send({ type: 'durak_defend', roomId, attackCard: a, defenseCard: d })}
          onPass={(card) => send({ type: 'durak_pass', roomId, card })}
          onTake={() => send({ type: 'durak_take', roomId })}
          onDoneAttacking={() => send({ type: 'durak_done_attacking', roomId })}
          onSurrender={() => send({ type: 'durak_surrender', roomId })}
          gameOverData={gameOverData as never}
        />
        {afterGame}
      </div>
    );

    if (gs.gameType === 'battleship') return (
      <div className="relative h-full flex flex-col">
        {opponentDisconnectCountdown !== null && (
          <div className="absolute top-0 left-0 right-0 z-30 bg-amber-500/90 text-black text-xs font-bold text-center py-1">
            вљЎ РЎРѕРїРµСЂРЅРёРє РѕС‚РєР»СЋС‡РёР»СЃСЏ. РџРµСЂРµРїРѕРґРєР»СЋС‡РµРЅРёРµ: {opponentDisconnectCountdown}СЃ
          </div>
        )}
        <BattleshipGame
          roomId={gs.roomId} myUserId={gs.myUserId} opponent={gs.opponent} betAmount={gs.betAmount}
          phase={battlePhase} currentAttackerId={battleCurrentAttacker}
          myShots={myShots} opponentShots={opponentShots} myBoard={myBoard} sunkEnemyCells={sunkEnemyCells}
          onPlace={(ships) => {
            const board = Array(10).fill(null).map(() => Array(10).fill(0));
            for (const s of ships) for (const cell of s.cells) board[cell.r][cell.c] = 1;
            setMyBoard(board);
            send({ type: 'battleship_place', roomId, ships });
          }}
          onShoot={(r, c) => send({ type: 'battleship_shoot', roomId, r, c })}
          onSurrender={() => send({ type: 'battleship_surrender', roomId })}
          gameOverData={gameOverData as never}
        />
        {afterGame}
      </div>
    );
  }

  // в”Ђв”Ђв”Ђ LOBBY UI в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
  return (
    <div className="p-4 space-y-4 pb-8">
      {/* Error toast */}
      {errorMsg && (
        <div className="fixed top-14 left-4 right-4 z-50 bg-rose-500/90 text-white text-xs font-bold text-center py-2 px-3 rounded-xl shadow-lg">
          вќЊ {errorMsg}
        </div>
      )}

      {/* Header */}
      <div className="text-center space-y-1">
        <div className="text-3xl">вљ”пёЏ</div>
        <h2 className="text-lg font-black text-tg-text">РЎРµС‚РµРІС‹Рµ Р”СѓСЌР»Рё</h2>
        <p className="text-xs text-tg-hint">Р’С‹Р±РµСЂРё РёРіСЂСѓ Рё СЃС‚Р°РІРєСѓ вЂ” СЃСЂР°Р¶Р°Р№СЃСЏ РїСЂРѕС‚РёРІ СЂРµР°Р»СЊРЅРѕРіРѕ РёРіСЂРѕРєР°</p>
        {!connected && <p className="text-xs text-amber-400">вљЎ РџРѕРґРєР»СЋС‡РµРЅРёРµ Рє СЃРµСЂРІРµСЂСѓ...</p>}
      </div>

      {/* Phase: select game */}
      {(phase === 'select_game' || phase === 'select_bet' || phase === 'select_timer' || phase === 'select_durak_mode') && (
        <>
          <div className="space-y-2">
            <p className="text-xs font-bold text-tg-hint uppercase tracking-wider">Р’С‹Р±РµСЂРё РёРіСЂСѓ</p>
            {GAMES.map(g => (
              <button key={g.id} onClick={() => { setSelectedGame(g.id); setPhase('select_bet'); haptics.light(); }}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-all active:scale-95 text-left ${selectedGame === g.id ? 'border-indigo-400/50 bg-indigo-500/10' : 'border-[var(--tg-theme-section-separator-color)] bg-tg-secondaryBg'}`}>
                <span className="text-2xl w-10 h-10 flex items-center justify-center bg-tg-bg rounded-xl">{g.icon}</span>
                <div>
                  <p className="font-bold text-sm text-tg-text">{g.title}</p>
                  <p className="text-xs text-tg-hint">{g.description}</p>
                </div>
                {selectedGame === g.id && <span className="ml-auto text-indigo-400 text-lg">вњ“</span>}
              </button>
            ))}
          </div>

          {phase !== 'select_game' && (
            <>
              <div className="space-y-2">
                <p className="text-xs font-bold text-tg-hint uppercase tracking-wider">РЎС‚Р°РІРєР°</p>
                <div className="flex gap-2 flex-wrap">
                  {BETS.map(b => (
                    <button key={b} onClick={() => { setSelectedBet(b); haptics.light(); }}
                      className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 ${selectedBet === b ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-tg-secondaryBg text-tg-hint border border-[var(--tg-theme-section-separator-color)]'}`}>
                      {b === 0 ? 'рџ¤ќ Р‘РµСЃРїР»Р°С‚РЅРѕ' : `${b} рџЄ™`}
                    </button>
                  ))}
                </div>
                {selectedBet > 0 && user && coins < selectedBet && (
                  <p className="text-xs text-rose-400">вќЊ РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ РјРѕРЅРµС‚ (Сѓ РІР°СЃ: {coins} рџЄ™)</p>
                )}
              </div>

              {selectedGame === 'chess' && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-tg-hint uppercase tracking-wider">РљРѕРЅС‚СЂРѕР»СЊ РІСЂРµРјРµРЅРё</p>
                  <div className="space-y-1">
                    {TIMER_MODES.map(t => (
                      <button key={t.id} onClick={() => { setTimerMode(t.id); haptics.light(); }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all active:scale-95 ${timerMode === t.id ? 'bg-indigo-500/15 border border-indigo-400/40 text-indigo-400' : 'bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] text-tg-text'}`}>
                        <span className="font-semibold">{t.label}</span>
                        <span className="text-xs text-tg-hint">{t.sub}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedGame === 'durak' && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-tg-hint uppercase tracking-wider">Р РµР¶РёРј РґСѓСЂР°РєР°</p>
                  <div className="space-y-1">
                    {DURAK_MODES.map(m => (
                      <button key={m.id} onClick={() => { setDurakMode(m.id); haptics.light(); }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all active:scale-95 ${durakMode === m.id ? 'bg-indigo-500/15 border border-indigo-400/40 text-indigo-400' : 'bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] text-tg-text'}`}>
                        <span className="font-semibold">{m.label}</span>
                        <span className="text-xs text-tg-hint">{m.sub}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={startQuickMatch} disabled={!connected || (selectedBet > 0 && (coins < selectedBet))}
                  className="flex-1 py-3 rounded-xl tg-btn-primary font-bold text-sm disabled:opacity-40 active:scale-95 transition-transform">
                  вљЎ Р‘С‹СЃС‚СЂС‹Р№ РјР°С‚С‡
                </button>
                <button onClick={createInviteRoom} disabled={!connected || (selectedBet > 0 && (coins < selectedBet))}
                  className="flex-1 py-3 rounded-xl bg-indigo-500/15 border border-indigo-400/30 text-indigo-400 font-bold text-sm disabled:opacity-40 active:scale-95 transition-transform">
                  рџ”— Invite
                </button>
              </div>
            </>
          )}
        </>
      )}

      {/* Phase: searching */}
      {phase === 'searching' && (
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="text-4xl animate-spin">вљ™пёЏ</div>
          <div className="text-center">
            <h3 className="font-bold text-tg-text">РС‰РµРј СЃРѕРїРµСЂРЅРёРєР°...</h3>
            <p className="text-xs text-tg-hint mt-1">{searchSeconds}СЃ | {GAMES.find(g => g.id === selectedGame)?.icon} {selectedBet > 0 ? `${selectedBet} рџЄ™` : 'Р‘РµСЃРїР»Р°С‚РЅРѕ'}</p>
          </div>
          <button onClick={() => { send({ type: 'leave_queue', gameType: selectedGame, betAmount: selectedBet }); setPhase('select_bet'); haptics.light(); }}
            className="px-6 py-2 rounded-xl bg-rose-500/15 text-rose-400 font-bold text-sm active:scale-95 transition-transform">
            РћС‚РјРµРЅР°
          </button>
        </div>
      )}

      {/* Phase: invite link */}
      {phase === 'invite_link' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-tg-secondaryBg border border-indigo-500/20 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{GAMES.find(g => g.id === selectedGame)?.icon}</span>
              <div>
                <p className="font-bold text-tg-text text-sm">РљРѕРјРЅР°С‚Р° СЃРѕР·РґР°РЅР°</p>
                <p className="text-xs text-tg-hint">РџРѕРґРµР»РёСЃСЊ СЃСЃС‹Р»РєРѕР№ СЃ РґСЂСѓРіРѕРј</p>
              </div>
            </div>
            <div className="bg-tg-bg rounded-xl p-3 break-all text-xs text-indigo-400 font-mono">{deepLink}</div>
            <button onClick={shareLink} className="w-full py-3 rounded-xl tg-btn-primary font-bold text-sm active:scale-95 transition-transform">
              рџ“¤ РџРѕРґРµР»РёС‚СЊСЃСЏ РІ Telegram
            </button>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="text-2xl animate-pulse">вЏі</div>
            <p className="text-xs text-tg-hint">РћР¶РёРґР°РµРј, РєРѕРіРґР° РґСЂСѓРі РїСЂРёСЃРѕРµРґРёРЅРёС‚СЃСЏ...</p>
          </div>
          <button onClick={() => { setPhase('select_bet'); setDeepLink(null); setRoomId(null); haptics.light(); }}
            className="w-full py-2 rounded-xl bg-tg-secondaryBg text-tg-hint font-bold text-sm active:scale-95 transition-transform border border-[var(--tg-theme-section-separator-color)]">
            в†ђ РќР°Р·Р°Рґ
          </button>
        </div>
      )}
    </div>
  );
};