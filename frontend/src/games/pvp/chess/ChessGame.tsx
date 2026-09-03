import React, { useEffect, useState, useCallback } from 'react';
import {
  parseFen,
  getLegalMoves,
  makeMove,
  boardToFen,
  sqToRC,
  rcToSq,
  type GameState,
  type GameStatus,
  type Move,
  type PieceType,
  type PieceColor,
} from './chessEngine';
import { haptics, setupBackButton, removeBackButton } from '../../../telegram/telegram';
import { sound } from '../../../utils/sound';
import confetti from 'canvas-confetti';
import { ArrowLeft, Flag, Handshake, Trophy, Frown, Sparkles } from 'lucide-react';
import type { GameOverPayload, DuelOpponent } from '../types';

interface Props {
  roomId: string;
  myColor: 'white' | 'black';
  initialFen: string;
  initialWhiteMs: number;
  initialBlackMs: number;
  myUserId: number;
  opponent: DuelOpponent;
  onMove: (from: string, to: string, promotion: string | undefined, fen: string, status: string) => void;
  onSurrender: () => void;
  onOfferDraw: () => void;
  onRespondDraw: (accepted: boolean) => void;
  opponentMove?: {
    from: string;
    to: string;
    promotion?: string;
    fen: string;
    currentTurn: string;
    whiteTimeMs: number;
    blackTimeMs: number;
    status: string;
  } | null;
  tickData?: { whiteTimeMs: number; blackTimeMs: number } | null;
  drawOffered?: boolean;
  gameOverData?: GameOverPayload | null;
  betAmount: number;
  onExit: () => void;
}

const PIECE_SYMBOLS: Record<string, string> = {
  wK: '♔',
  wQ: '♕',
  wR: '♖',
  wB: '♗',
  wN: '♘',
  wP: '♙',
  wp: '♙',
  bK: '♚',
  bQ: '♛',
  bR: '♜',
  bB: '♝',
  bN: '♞',
  bP: '♟',
  bp: '♟',
};

function formatTime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export const ChessGame: React.FC<Props> = ({
  myColor,
  initialFen,
  initialWhiteMs,
  initialBlackMs,
  myUserId,
  opponent,
  onMove,
  onSurrender,
  onOfferDraw,
  onRespondDraw,
  opponentMove,
  tickData,
  drawOffered,
  gameOverData,
  betAmount,
  onExit,
}) => {
  const [gameState, setGameState] = useState<GameState>(() => parseFen(initialFen));
  const [status, setStatus] = useState<GameStatus>('active');
  const [selected, setSelected] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<Move[]>([]);
  const [promotionPending, setPromotionPending] = useState<{ from: string; to: string } | null>(null);
  const [whiteMs, setWhiteMs] = useState(initialWhiteMs);
  const [blackMs, setBlackMs] = useState(initialBlackMs);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [showSurrenderConfirm, setShowSurrenderConfirm] = useState(false);

  const myEngineColor: PieceColor = myColor === 'white' ? 'w' : 'b';
  const isMyTurn = gameState.turn === myEngineColor;
  const flipped = myColor === 'black';

  // Telegram BackButton integration
  useEffect(() => {
    setupBackButton(() => {
      setShowSurrenderConfirm(true);
    });
    return () => removeBackButton();
  }, []);

  useEffect(() => {
    if (!opponentMove) return;
    const newState = parseFen(opponentMove.fen);
    setGameState(newState);
    setLastMove({ from: opponentMove.from, to: opponentMove.to });
    setSelected(null);
    setLegalMoves([]);
    sound.playPickup();
    if (opponentMove.whiteTimeMs !== undefined) setWhiteMs(opponentMove.whiteTimeMs);
    if (opponentMove.blackTimeMs !== undefined) setBlackMs(opponentMove.blackTimeMs);
  }, [opponentMove]);

  useEffect(() => {
    if (!tickData) return;
    setWhiteMs(tickData.whiteTimeMs);
    setBlackMs(tickData.blackTimeMs);
  }, [tickData]);

  // Game over sounds & confetti
  useEffect(() => {
    if (gameOverData) {
      const won = gameOverData.winnerUserId === myUserId;
      const draw = gameOverData.isDraw || gameOverData.reason === 'draw' || gameOverData.reason === 'stalemate';
      if (won) {
        sound.playRecord();
        confetti({
          particleCount: 80,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#6366f1', '#f59e0b', '#10b981', '#ec4899'],
        });
      } else if (draw) {
        sound.playUiTap();
      } else {
        sound.playGameOver();
      }
    }
  }, [gameOverData, myUserId]);

  const handleSquareTap = useCallback(
    (sq: string) => {
      if (status !== 'active' && status !== 'check') return;
      if (!isMyTurn || gameOverData) return;

      const [r, c] = sqToRC(sq);
      const piece = gameState.board[r][c];

      if (selected === sq) {
        setSelected(null);
        setLegalMoves([]);
        return;
      }

      if (selected) {
        const move = legalMoves.find((m) => m.to === sq);
        if (move) {
          if (move.promotion) {
            setPromotionPending({ from: selected, to: sq });
            return;
          }
          applyPlayerMove(selected, sq, undefined);
          return;
        }
      }

      if (piece && piece.color === myEngineColor) {
        setSelected(sq);
        setLegalMoves(getLegalMoves(gameState, sq));
        sound.playPickup();
        haptics.light();
      } else {
        setSelected(null);
        setLegalMoves([]);
      }
    },
    [selected, legalMoves, gameState, isMyTurn, status, gameOverData, myEngineColor]
  );

  const applyPlayerMove = useCallback(
    (from: string, to: string, promotion: PieceType | undefined) => {
      const { state: newState, status: newStatus } = makeMove(gameState, from, to, promotion);
      setGameState(newState);
      setStatus(newStatus);
      setSelected(null);
      setLegalMoves([]);
      setPromotionPending(null);
      setLastMove({ from, to });
      sound.playPickup();
      haptics.medium();
      const fen = boardToFen(newState);
      const wsStatus = newStatus === 'active' || newStatus === 'check' ? 'active' : newStatus;
      onMove(from, to, promotion, fen, wsStatus);
    },
    [gameState, onMove]
  );

  const ranks = flipped ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  const files = flipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];

  const isLight = (r: number, c: number) => (r + c) % 2 === 0;
  const isSelected = (sq: string) => selected === sq;
  const isLegal = (sq: string) => legalMoves.some((m) => m.to === sq);
  const isLast = (sq: string) => lastMove?.from === sq || lastMove?.to === sq;

  const myTime = myColor === 'white' ? whiteMs : blackMs;
  const oppTime = myColor === 'white' ? blackMs : whiteMs;
  const isMyTimeLow = myTime < 15000 && myTime > 0;

  return (
    <div className="flex flex-col h-full bg-tg-bg select-none touch-none overflow-hidden">
      {/* Top Bar: Back/Surrender button + Opponent Info + Bank + Opponent Timer */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-tg-secondaryBg border-b border-[var(--tg-theme-section-separator-color)] shadow-sm">
        <div className="flex items-center gap-2">
          {/* Dedicated Exit / Surrender Back Button */}
          <button
            onClick={() => {
              sound.playUiTap();
              haptics.selection();
              setShowSurrenderConfirm(true);
            }}
            className="p-2 rounded-xl bg-tg-bg border border-[var(--tg-theme-section-separator-color)] text-tg-hint hover:text-rose-400 active:scale-90 transition-all cursor-pointer"
            title="Покинуть матч"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center font-bold text-sm text-indigo-400">
              {opponent.firstName[0]}
            </div>
            {!isMyTurn && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-tg-secondaryBg animate-pulse" />
            )}
          </div>
          <div>
            <div className="text-xs font-bold text-tg-text truncate max-w-[100px]">
              {opponent.firstName}
            </div>
            <div className="text-[10px] text-tg-hint font-medium">
              {myColor === 'white' ? 'Черные фигуры' : 'Белые фигуры'}
            </div>
          </div>
        </div>

        {/* Bank badge in center */}
        {betAmount > 0 && (
          <div className="flex items-center gap-1 text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <span>🪙</span>
            <span>Банк: {Math.floor(betAmount * 1.8)}</span>
          </div>
        )}

        {/* Opponent Timer */}
        <div
          className={`font-mono text-base font-extrabold px-3 py-1 rounded-xl border transition-all ${
            !isMyTurn
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
              : 'bg-tg-bg border-[var(--tg-theme-section-separator-color)] text-tg-hint'
          }`}
        >
          {formatTime(oppTime)}
        </div>
      </div>

      {/* Draw Offer Notification */}
      {drawOffered && (
        <div className="flex items-center justify-between gap-3 px-4 py-2 bg-amber-500/15 border-b border-amber-500/30 animate-fade-in">
          <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
            <Handshake className="w-4 h-4" /> Соперник предлагает ничью
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onRespondDraw(true)}
              className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/40 active:scale-95 transition-transform cursor-pointer"
            >
              Принять
            </button>
            <button
              onClick={() => onRespondDraw(false)}
              className="px-3 py-1 rounded-lg bg-rose-500/20 text-rose-400 text-xs font-bold border border-rose-500/40 active:scale-95 transition-transform cursor-pointer"
            >
              Отклонить
            </button>
          </div>
        </div>
      )}

      {/* Chess Board Container */}
      <div className="flex-1 flex items-center justify-center p-3">
        <div className="w-full max-w-[360px] aspect-square rounded-2xl overflow-hidden shadow-2xl border-2 border-amber-950/40 bg-amber-900/10 relative">
          <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
            {ranks.map((rank) =>
              files.map((file) => {
                const sq = rcToSq(rank, file);
                const piece = gameState.board[rank][file];
                const light = isLight(rank, file);
                const sel = isSelected(sq);
                const legal = isLegal(sq);
                const last = isLast(sq);
                const inCheckSq =
                  piece?.type === 'K' &&
                  piece.color === gameState.turn &&
                  (status === 'check' || status === 'checkmate');

                return (
                  <div
                    key={sq}
                    onClick={() => handleSquareTap(sq)}
                    className="relative flex items-center justify-center cursor-pointer select-none transition-colors"
                    style={{
                      backgroundColor: inCheckSq
                        ? 'rgba(239, 68, 68, 0.75)'
                        : sel
                        ? 'rgba(99, 102, 241, 0.65)'
                        : last
                        ? light
                          ? '#fef08a'
                          : '#ca8a04'
                        : light
                        ? '#f3e8d2'
                        : '#b88b4a',
                    }}
                  >
                    {/* Legal move marker */}
                    {legal && (
                      <div
                        className={`absolute rounded-full ${
                          piece
                            ? 'inset-0 border-[3px] border-indigo-600/80 rounded-none z-20'
                            : 'w-3.5 h-3.5 bg-indigo-600/70 z-20 shadow-sm'
                        }`}
                      />
                    )}

                    {/* Chess Piece Symbol */}
                    {piece && (
                      <span
                        className="relative z-10 font-bold leading-none select-none transition-transform"
                        style={{
                          fontSize: 'clamp(26px, 8vw, 38px)',
                          color: piece.color === 'w' ? '#ffffff' : '#1f2937',
                          textShadow:
                            piece.color === 'w'
                              ? '0 1px 2px rgba(0,0,0,0.8), 0 0 3px rgba(0,0,0,0.6)'
                              : '0 1px 1px rgba(255,255,255,0.4)',
                          transform: sel ? 'scale(1.12)' : 'none',
                        }}
                      >
                        {PIECE_SYMBOLS[piece.color + piece.type]}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Promotion Modal Picker */}
      {promotionPending && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] rounded-3xl p-5 shadow-2xl space-y-3 text-center">
            <h4 className="font-extrabold text-sm text-tg-text">Выберите фигуру</h4>
            <div className="flex gap-2 justify-center">
              {(['Q', 'R', 'B', 'N'] as PieceType[]).map((pt) => (
                <button
                  key={pt}
                  onClick={() => applyPlayerMove(promotionPending.from, promotionPending.to, pt)}
                  className="w-14 h-14 rounded-2xl bg-tg-bg border border-[var(--tg-theme-section-separator-color)] flex items-center justify-center text-3xl hover:border-indigo-400 active:scale-90 transition-all cursor-pointer shadow-md"
                >
                  {PIECE_SYMBOLS[myEngineColor + pt]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Bar: Player Info + Timer + Quick Actions */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-tg-secondaryBg border-t border-[var(--tg-theme-section-separator-color)] shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center font-bold text-xs text-emerald-400">
              Я
            </div>
            {isMyTurn && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-tg-secondaryBg animate-pulse" />
            )}
          </div>
          <div>
            <div className="text-xs font-bold text-tg-text">Ваш ход</div>
            <div className="text-[10px] text-tg-hint font-medium">
              {myColor === 'white' ? 'Белые фигуры' : 'Черные фигуры'}
            </div>
          </div>
        </div>

        {/* Player Timer */}
        <div
          className={`font-mono text-base font-extrabold px-3 py-1 rounded-xl border transition-all ${
            isMyTurn
              ? isMyTimeLow
                ? 'bg-rose-500/20 border-rose-500 text-rose-400 animate-pulse'
                : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
              : 'bg-tg-bg border-[var(--tg-theme-section-separator-color)] text-tg-hint'
          }`}
        >
          {formatTime(myTime)}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              sound.playUiTap();
              haptics.selection();
              onOfferDraw();
            }}
            title="Предложить ничью"
            className="p-2 rounded-xl bg-tg-bg border border-[var(--tg-theme-section-separator-color)] text-amber-400 hover:border-amber-400/50 active:scale-90 transition-all cursor-pointer"
          >
            <Handshake className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              sound.playUiTap();
              haptics.selection();
              setShowSurrenderConfirm(true);
            }}
            title="Сдаться и выйти"
            className="p-2 rounded-xl bg-tg-bg border border-[var(--tg-theme-section-separator-color)] text-rose-400 hover:border-rose-400/50 active:scale-90 transition-all cursor-pointer"
          >
            <Flag className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Surrender Confirmation Modal */}
      {showSurrenderConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] rounded-3xl p-5 shadow-2xl max-w-xs w-full text-center space-y-3 animate-scale-up">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Flag className="w-6 h-6" />
            </div>
            <h4 className="font-extrabold text-base text-tg-text">Покинуть матч?</h4>
            <p className="text-xs text-tg-hint leading-relaxed">
              Вам будет засчитано поражение, а выигрыш перейдет сопернику. Вы уверены?
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowSurrenderConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-tg-bg border border-[var(--tg-theme-section-separator-color)] text-tg-hint text-xs font-bold active:scale-95 transition-all cursor-pointer"
              >
                Остаться
              </button>
              <button
                onClick={() => {
                  setShowSurrenderConfirm(false);
                  onSurrender();
                  onExit();
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400 text-xs font-bold active:scale-95 transition-all cursor-pointer"
              >
                Сдаться и выйти
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game Over Modal */}
      {gameOverData && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] rounded-3xl p-6 shadow-2xl max-w-xs w-full text-center space-y-4 animate-scale-up">
            {gameOverData.winnerUserId === myUserId ? (
              <div className="space-y-2">
                <div className="w-16 h-16 mx-auto rounded-3xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-3xl shadow-inner text-amber-400">
                  <Trophy className="w-9 h-9 animate-bounce" />
                </div>
                <h3 className="font-black text-xl text-tg-text">ПОБЕДА!</h3>
                <p className="text-xs text-tg-hint">
                  {gameOverData.reason === 'checkmate'
                    ? 'Мат королю соперника!'
                    : gameOverData.reason === 'surrender'
                    ? 'Соперник сдался'
                    : gameOverData.reason === 'timeout'
                    ? 'У соперника вышло время'
                    : 'Партия выиграна!'}
                </p>
                {betAmount > 0 && (
                  <div className="py-2 px-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-extrabold text-lg flex items-center justify-center gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    +{gameOverData.payout} 🪙
                  </div>
                )}
              </div>
            ) : gameOverData.isDraw || gameOverData.reason === 'draw' || gameOverData.reason === 'stalemate' ? (
              <div className="space-y-2">
                <div className="w-16 h-16 mx-auto rounded-3xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-3xl shadow-inner text-indigo-400">
                  <Handshake className="w-9 h-9" />
                </div>
                <h3 className="font-black text-xl text-tg-text">НИЧЬЯ</h3>
                <p className="text-xs text-tg-hint">
                  {gameOverData.reason === 'stalemate' ? 'Пат на доске' : 'Согласие сторон'}
                </p>
                {betAmount > 0 && (
                  <div className="text-xs text-tg-hint">Ставки полностью возвращены</div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="w-16 h-16 mx-auto rounded-3xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-3xl shadow-inner text-rose-400">
                  <Frown className="w-9 h-9" />
                </div>
                <h3 className="font-black text-xl text-tg-text">Поражение</h3>
                <p className="text-xs text-tg-hint">
                  {gameOverData.reason === 'checkmate'
                    ? 'Вам объявлен мат'
                    : gameOverData.reason === 'timeout'
                    ? 'Время вышло'
                    : 'Партия проиграна'}
                </p>
                {betAmount > 0 && (
                  <div className="text-xs font-bold text-rose-400">-{betAmount} 🪙</div>
                )}
              </div>
            )}

            <button
              onClick={() => {
                sound.playUiTap();
                onExit();
              }}
              className="w-full py-3 rounded-xl tg-btn-primary font-bold text-xs shadow-md active:scale-95 transition-all cursor-pointer"
            >
              Вернуться в хаб
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
