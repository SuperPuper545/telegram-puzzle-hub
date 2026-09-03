import React, { useState, useEffect, useRef } from 'react';
import { useDuelWebSocket } from './useDuelWebSocket';
import { ChessGame } from './chess/ChessGame';
import { DurakGame } from './durak/DurakGame';
import { BattleshipGame } from './battleship/BattleshipGame';
import { DuelSetupModal } from './DuelSetupModal';
import { useGameBridge } from '../../context/GameContext';
import { haptics, removeBackButton } from '../../telegram/telegram';
import { sound } from '../../utils/sound';
import { Swords, Loader2 } from 'lucide-react';
import type { DuelGameType, GameOverPayload, DuelOpponent } from './types';

interface Props {
  selectedPvpGame: DuelGameType | null;
  onCloseSetupModal: () => void;
  onOpenSetupModal?: (game: DuelGameType) => void;
}

export const DuelLobby: React.FC<Props> = ({
  selectedPvpGame,
  onCloseSetupModal,
}) => {
  const { coins, refreshProfile } = useGameBridge();
  const { send, on, connected } = useDuelWebSocket();

  const [isInGame, setIsInGame] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState<string | null>(null);
  const [inviteDeepLink, setInviteDeepLink] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [opponentDisconnectCountdown, setOpponentDisconnectCountdown] = useState<number | null>(null);
  const disconnectTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Active game states
  const [gameStartData, setGameStartData] = useState<{
    roomId: string;
    gameType: DuelGameType;
    betAmount: number;
    role: string;
    myUserId: number;
    opponent: DuelOpponent;
    myColor?: 'white' | 'black';
    fen?: string;
    timerMode?: string;
    whiteTimeMs?: number;
    blackTimeMs?: number;
  } | null>(null);

  const [chessMoveData, setChessMoveData] = useState<Parameters<Parameters<typeof on<'chess_move'>>[1]>[0] | null>(null);
  const [chessTickData, setChessTickData] = useState<{ whiteTimeMs: number; blackTimeMs: number } | null>(null);
  const [chessDrawOffered, setChessDrawOffered] = useState(false);

  const [durakState, setDurakState] = useState<Parameters<Parameters<typeof on<'durak_state'>>[1]>[0] | null>(null);

  const [battlePhase, setBattlePhase] = useState<'placement' | 'battle' | 'finished'>('placement');
  const [battleAttackerId, setBattleAttackerId] = useState<number | null>(null);
  const [myShots, setMyShots] = useState<Array<{ r: number; c: number; hit: boolean }>>([]);
  const [oppShots, setOppShots] = useState<Array<{ r: number; c: number; hit: boolean }>>([]);
  const [myBoard, setMyBoard] = useState<number[][]>();
  const [sunkEnemyCells, setSunkEnemyCells] = useState<Array<{ r: number; c: number }>>([]);

  const [gameOverData, setGameOverData] = useState<GameOverPayload | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  // ─── Auto-join from deep link ─────────────────────────────────────────────
  useEffect(() => {
    if (!connected) return;
    try {
      const pendingRoom = localStorage.getItem('hub_pending_duel_room');
      if (pendingRoom) {
        localStorage.removeItem('hub_pending_duel_room');
        setRoomId(pendingRoom);
        setIsJoiningRoom(pendingRoom);
        send({ type: 'join_room', roomId: pendingRoom });
        haptics.medium();
      }
    } catch {
      /* ignore */
    }
  }, [connected, send]);

  // ─── WS Events Subscription ───────────────────────────────────────────────
  useEffect(() => {
    const unsub = [
      on('queued', () => {
        setIsSearching(true);
      }),
      on('queue_left', () => {
        setIsSearching(false);
      }),
      on('room_created', (d) => {
        setRoomId(d.roomId);
        setInviteDeepLink(d.deepLink);
      }),
      on('game_start', (d) => {
        setIsSearching(false);
        setIsJoiningRoom(null);
        setInviteDeepLink(null);
        setRoomId(d.roomId);
        setGameStartData({
          roomId: d.roomId,
          gameType: d.gameType,
          betAmount: d.betAmount,
          role: d.role,
          myUserId: d.myUserId,
          opponent: d.opponent,
          myColor: d.myColor,
          fen: d.fen,
          timerMode: d.timerMode,
          whiteTimeMs: d.whiteTimeMs,
          blackTimeMs: d.blackTimeMs,
        });
        setIsInGame(true);
        setGameOverData(null);
        setChessMoveData(null);
        setChessTickData(null);
        if (d.gameType === 'durak') {
          setDurakState({
            hand: (d as any).hand || [],
            opponentCardCount: 6,
            table: [],
            phase: 'attack',
            deckCount: (d as any).deckCount || 24,
            trump: (d as any).trump || 's',
            attackerId: (d as any).attackerId,
            defenderId: (d as any).defenderId,
            discardCount: 0,
          });
        } else {
          setDurakState(null);
        }
        setOppShots([]);
        setSunkEnemyCells([]);
        setBattlePhase('placement');
        setBattleAttackerId(null);
        onCloseSetupModal();
        sound.playRecord();
        haptics.success();
      }),
      on('chess_move', (d) => setChessMoveData(d)),
      on('chess_tick', (d) => setChessTickData(d)),
      on('chess_draw_offered', () => setChessDrawOffered(true)),
      on('chess_draw_declined', () => setChessDrawOffered(false)),
      on('durak_state', (d) => setDurakState(d)),
      on('battleship_placed', () => {}),
      on('battleship_battle_start', (d) => {
        setBattlePhase('battle');
        setBattleAttackerId(d.currentAttackerId);
      }),
      on('battleship_shot_result', (d) => {
        setMyShots(d.myShots);
        setBattleAttackerId(d.nextAttackerId);
        if (d.sunk) setSunkEnemyCells((prev) => [...prev, ...(d.sunk || [])]);
      }),
      on('battleship_opponent_shot', (d) => {
        setOppShots((prev) => [...prev, { r: d.r, c: d.c, hit: d.hit }]);
        setBattleAttackerId(d.nextAttackerId);
      }),
      on('game_over', (d) => {
        setGameOverData(d);
        setBattlePhase('finished');
        refreshProfile();
      }),
      on('opponent_disconnected', (d) => {
        setOpponentDisconnectCountdown(d.reconnectSeconds);
        if (disconnectTimerRef.current) clearInterval(disconnectTimerRef.current);
        disconnectTimerRef.current = setInterval(() => {
          setOpponentDisconnectCountdown((prev) => {
            if (prev === null || prev <= 1) {
              clearInterval(disconnectTimerRef.current!);
              return null;
            }
            return prev - 1;
          });
        }, 1000);
      }),
      on('opponent_reconnected', () => {
        setOpponentDisconnectCountdown(null);
        if (disconnectTimerRef.current) clearInterval(disconnectTimerRef.current);
      }),
      on('error', (d) => {
        setIsJoiningRoom(null);
        setIsSearching(false);
        setErrorToast(d.message);
        haptics.error();
        setTimeout(() => setErrorToast(null), 4000);
      }),
    ];

    return () => unsub.forEach((fn) => fn());
  }, [on, onCloseSetupModal, refreshProfile]);

  const handleStartQueue = (game: DuelGameType, bet: number, timer: string, durak: string) => {
    send({ type: 'join_queue', gameType: game, betAmount: bet, timerMode: timer, durakMode: durak });
  };

  const handleCancelQueue = () => {
    send({ type: 'leave_queue' });
    setIsSearching(false);
  };

  const handleCreateInvite = (game: DuelGameType, bet: number, timer: string, durak: string) => {
    send({ type: 'create_room', gameType: game, betAmount: bet, timerMode: timer, durakMode: durak });
  };

  const handleExitGame = () => {
    setIsInGame(false);
    setGameStartData(null);
    setGameOverData(null);
    setRoomId(null);
    setInviteDeepLink(null);
    setIsJoiningRoom(null);
    setIsSearching(false);
    removeBackButton();
    refreshProfile();
  };

  // Toggle duel-active class on body so navigation and headers hide
  useEffect(() => {
    if (isInGame) {
      document.body.classList.add('duel-active');
    } else {
      document.body.classList.remove('duel-active');
    }
    return () => {
      document.body.classList.remove('duel-active');
    };
  }, [isInGame]);

  // ─── Render Active Game Screen ────────────────────────────────────────────
  if (isInGame && gameStartData) {
    return (
      <div className="fixed inset-0 z-[100] bg-tg-bg flex flex-col overflow-hidden max-w-md mx-auto md:border-x md:border-[var(--tg-theme-section-separator-color)] md:shadow-2xl">
        {/* Opponent Disconnect Countdown Bar */}
        {opponentDisconnectCountdown !== null && (
          <div className="bg-amber-500 text-black text-xs font-black text-center py-1.5 px-3 z-50 animate-pulse">
            ⚡ Соперник отключился! Ожидание возврата: {opponentDisconnectCountdown} сек
          </div>
        )}

        {gameStartData.gameType === 'chess' && (
          <ChessGame
            roomId={gameStartData.roomId}
            myColor={gameStartData.myColor || 'white'}
            initialFen={gameStartData.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'}
            initialWhiteMs={gameStartData.whiteTimeMs || 180000}
            initialBlackMs={gameStartData.blackTimeMs || 180000}
            myUserId={gameStartData.myUserId}
            opponent={gameStartData.opponent}
            betAmount={gameStartData.betAmount}
            onMove={(from, to, promo, fen, status) => {
              send({ type: 'chess_move', roomId, from, to, promotion: promo, fen, status });
            }}
            onSurrender={() => send({ type: 'chess_surrender', roomId })}
            onOfferDraw={() => send({ type: 'chess_offer_draw', roomId })}
            onRespondDraw={(accepted) => {
              send({ type: 'chess_respond_draw', roomId, accepted });
              setChessDrawOffered(false);
            }}
            opponentMove={chessMoveData}
            tickData={chessTickData}
            drawOffered={chessDrawOffered}
            gameOverData={gameOverData}
            onExit={handleExitGame}
          />
        )}

        {gameStartData.gameType === 'durak' && (
          <DurakGame
            roomId={gameStartData.roomId}
            myUserId={gameStartData.myUserId}
            opponent={gameStartData.opponent}
            betAmount={gameStartData.betAmount}
            gameState={durakState}
            onAttack={(card) => send({ type: 'durak_attack', roomId, card })}
            onDefend={(a, d) => send({ type: 'durak_defend', roomId, attackCard: a, defenseCard: d })}
            onPass={(card) => send({ type: 'durak_pass', roomId, card })}
            onTake={() => send({ type: 'durak_take', roomId })}
            onDoneAttacking={() => send({ type: 'durak_done_attacking', roomId })}
            onSurrender={() => send({ type: 'durak_surrender', roomId })}
            gameOverData={gameOverData}
            onExit={handleExitGame}
          />
        )}

        {gameStartData.gameType === 'battleship' && (
          <BattleshipGame
            roomId={gameStartData.roomId}
            myUserId={gameStartData.myUserId}
            opponent={gameStartData.opponent}
            betAmount={gameStartData.betAmount}
            phase={battlePhase}
            currentAttackerId={battleAttackerId}
            myShots={myShots}
            opponentShots={oppShots}
            myBoard={myBoard}
            sunkEnemyCells={sunkEnemyCells}
            onPlace={(ships) => {
              const board = Array(10)
                .fill(null)
                .map(() => Array(10).fill(0));
              for (const s of ships) for (const c of s.cells) board[c.r][c.c] = 1;
              setMyBoard(board);
              send({ type: 'battleship_place', roomId, ships });
            }}
            onShoot={(r, c) => send({ type: 'battleship_shoot', roomId, r, c })}
            onSurrender={() => send({ type: 'battleship_surrender', roomId })}
            gameOverData={gameOverData}
            onExit={handleExitGame}
          />
        )}
      </div>
    );
  }

  // ─── Setup Modal & Deep Link Joining View ─────────────────────────────────
  return (
    <>
      {/* Floating Error Toast */}
      {errorToast && (
        <div className="fixed top-16 left-4 right-4 z-50 bg-rose-500/95 text-white text-xs font-extrabold text-center py-2.5 px-4 rounded-2xl shadow-xl animate-fade-in">
          ⚠️ {errorToast}
        </div>
      )}

      {/* Joining Room Deep Link Overlay */}
      {isJoiningRoom && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] rounded-3xl p-6 shadow-2xl max-w-xs w-full text-center space-y-4 animate-scale-up">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Swords className="w-7 h-7 animate-bounce" />
            </div>
            <div>
              <h4 className="font-extrabold text-base text-tg-text">Присоединение к дуэли!</h4>
              <p className="text-xs text-tg-hint mt-1">Подключаемся к приватной комнате друга...</p>
              <div className="flex items-center justify-center gap-1.5 text-xs text-indigo-400 font-mono font-bold mt-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> #{isJoiningRoom}
              </div>
            </div>
            <button
              onClick={() => setIsJoiningRoom(null)}
              className="w-full py-2.5 rounded-xl bg-tg-bg border border-[var(--tg-theme-section-separator-color)] text-tg-hint text-xs font-bold active:scale-95 transition-all cursor-pointer"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Duel Setup Modal */}
      <DuelSetupModal
        isOpen={selectedPvpGame !== null || isSearching || inviteDeepLink !== null}
        onClose={() => {
          onCloseSetupModal();
          setInviteDeepLink(null);
        }}
        gameType={selectedPvpGame}
        coins={coins}
        onStartQueue={handleStartQueue}
        onCancelQueue={handleCancelQueue}
        onCreateInviteRoom={handleCreateInvite}
        isSearching={isSearching}
        inviteDeepLink={inviteDeepLink}
        serverConnected={connected}
      />
    </>
  );
};
