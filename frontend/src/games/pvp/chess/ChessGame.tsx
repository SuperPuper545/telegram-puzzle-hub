import React, { useEffect, useState, useCallback } from 'react';
import { parseFen, getLegalMoves, makeMove, boardToFen, sqToRC, rcToSq, type GameState, type GameStatus, type Move, type PieceType, type PieceColor } from './chessEngine';
import { haptics } from '../../../telegram/telegram';

interface Props {
  roomId: string;
  myColor: 'white' | 'black';
  initialFen: string;
  timerMode?: string;
  initialWhiteMs: number;
  initialBlackMs: number;
  myUserId: number;
  opponent: { firstName: string; username: string | null; userId: number };
  onMove: (from: string, to: string, promotion: string | undefined, fen: string, status: string) => void;
  onSurrender: () => void;
  onOfferDraw: () => void;
  onRespondDraw: (accepted: boolean) => void;
  // incoming events from WS
  opponentMove?: { from: string; to: string; promotion?: string; fen: string; currentTurn: string; whiteTimeMs: number; blackTimeMs: number; status: string } | null;
  tickData?: { whiteTimeMs: number; blackTimeMs: number } | null;
  drawOffered?: boolean;
  gameOverData?: { reason: string; winnerColor?: string; winnerUserId?: number | null; isDraw?: boolean; payout: number; commission: number } | null;
  betAmount: number;
}

const PIECE_UNICODE: Record<string, string> = {
  wK:'♔',wQ:'♕',wR:'♖',wB:'♗',wN:'♘',wp:'♙',
  bK:'♚',bQ:'♛',bR:'♜',bB:'♝',bN:'♞',bp:'♟',
};

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export const ChessGame: React.FC<Props> = ({
  myColor, initialFen, initialWhiteMs, initialBlackMs,
  myUserId, opponent, onMove, onSurrender, onOfferDraw, onRespondDraw,
  opponentMove, tickData, drawOffered, gameOverData, betAmount,
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

  // Apply incoming opponent move
  useEffect(() => {
    if (!opponentMove) return;
    const newState = parseFen(opponentMove.fen);
    setGameState(newState);
    setLastMove({ from: opponentMove.from, to: opponentMove.to });
    setSelected(null);
    setLegalMoves([]);
    if (opponentMove.whiteTimeMs !== undefined) setWhiteMs(opponentMove.whiteTimeMs);
    if (opponentMove.blackTimeMs !== undefined) setBlackMs(opponentMove.blackTimeMs);
  }, [opponentMove]);

  // Apply timer ticks
  useEffect(() => {
    if (!tickData) return;
    setWhiteMs(tickData.whiteTimeMs);
    setBlackMs(tickData.blackTimeMs);
  }, [tickData]);

  const handleSquareTap = useCallback((sq: string) => {
    if (status !== 'active' && status !== 'check') return;
    if (!isMyTurn) return;
    if (gameOverData) return;

    const [r, c] = sqToRC(sq);
    const piece = gameState.board[r][c];

    if (selected === sq) { setSelected(null); setLegalMoves([]); return; }

    if (selected) {
      const move = legalMoves.find(m => m.to === sq);
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
      haptics.light();
    } else {
      setSelected(null);
      setLegalMoves([]);
    }
  }, [selected, legalMoves, gameState, isMyTurn, status, gameOverData, myEngineColor]);

  const applyPlayerMove = useCallback((from: string, to: string, promotion: PieceType | undefined) => {
    const { state: newState, status: newStatus } = makeMove(gameState, from, to, promotion);
    setGameState(newState);
    setStatus(newStatus);
    setSelected(null);
    setLegalMoves([]);
    setPromotionPending(null);
    setLastMove({ from, to });
    haptics.medium();
    const fen = boardToFen(newState);
    const wsStatus = newStatus === 'active' || newStatus === 'check' ? 'active' : newStatus;
    onMove(from, to, promotion, fen, wsStatus);
  }, [gameState, onMove]);

  const ranks = flipped ? [0,1,2,3,4,5,6,7] : [7,6,5,4,3,2,1,0];
  const files = flipped ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];

  const isLight = (r: number, c: number) => (r + c) % 2 === 0;
  const isSelected = (sq: string) => selected === sq;
  const isLegal = (sq: string) => legalMoves.some(m => m.to === sq);
  const isLastMove = (sq: string) => lastMove?.from === sq || lastMove?.to === sq;

  const myTime = myColor === 'white' ? whiteMs : blackMs;
  const oppTime = myColor === 'white' ? blackMs : whiteMs;
  const isMyTimeLow = myTime < 15000;

  if (gameOverData) {
    const won = gameOverData.winnerUserId === myUserId;
    const draw = gameOverData.isDraw || gameOverData.reason === 'draw' || gameOverData.reason === 'stalemate';
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-6 touch-none select-none game-viewport-lock">
        <div className="text-6xl">{draw ? '🤝' : won ? '🏆' : '😔'}</div>
        <h2 className="text-2xl font-black text-tg-text">{draw ? 'Ничья!' : won ? 'Победа!' : 'Поражение'}</h2>
        <p className="text-sm text-tg-hint capitalize">{gameOverData.reason === 'checkmate' ? 'Мат' : gameOverData.reason === 'surrender' ? 'Соперник сдался' : gameOverData.reason === 'timeout' ? 'Время вышло' : gameOverData.reason === 'disconnect' ? 'Соперник отключился' : gameOverData.reason}</p>
        {betAmount > 0 && !draw && won && <div className="text-amber-400 font-bold text-lg">+{gameOverData.payout} 🪙</div>}
        {betAmount > 0 && !draw && !won && <div className="text-rose-400 font-bold text-lg">-{betAmount} 🪙</div>}
        {draw && betAmount > 0 && <div className="text-tg-hint text-sm">Ставки возвращены</div>}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-tg-bg select-none touch-none game-viewport-lock" style={{ touchAction: 'none' }}>
      {/* Opponent info + timer */}
      <div className="flex items-center justify-between px-3 py-2 bg-tg-secondaryBg border-b border-[var(--tg-theme-section-separator-color)]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-indigo-500/30 flex items-center justify-center text-sm font-bold text-indigo-400">
            {opponent.firstName[0]}
          </div>
          <span className="text-sm font-semibold text-tg-text">{opponent.firstName}</span>
          {!isMyTurn && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
        </div>
        <div className={`font-mono text-lg font-bold px-3 py-1 rounded-lg ${!isMyTurn ? 'bg-emerald-500/20 text-emerald-400' : 'bg-tg-bg text-tg-hint'}`}>
          {formatTime(oppTime)}
        </div>
      </div>

      {/* Draw offer banner */}
      {drawOffered && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 bg-amber-500/10 border-b border-amber-500/20">
          <span className="text-xs text-amber-400 font-semibold">Соперник предлагает ничью</span>
          <div className="flex gap-2">
            <button onClick={() => onRespondDraw(true)} className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-bold">✓ Принять</button>
            <button onClick={() => onRespondDraw(false)} className="px-3 py-1 rounded-lg bg-rose-500/20 text-rose-400 text-xs font-bold">✗ Отклонить</button>
          </div>
        </div>
      )}

      {/* Chess board */}
      <div className="flex-1 flex items-center justify-center p-2">
        <div className="relative" style={{ width: 'min(100vw, 100%)', aspectRatio: '1/1' }}>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(8, 1fr)', width: '100%', height: '100%' }}>
            {ranks.map(rank => files.map(file => {
              const sq = rcToSq(rank, file);
              const piece = gameState.board[rank][file];
              const light = isLight(rank, file);
              const sel = isSelected(sq);
              const legal = isLegal(sq);
              const last = isLastMove(sq);
              const inCheckSq = piece?.type === 'K' && piece.color === gameState.turn && (status === 'check' || status === 'checkmate');
              return (
                <div
                  key={sq}
                  onClick={() => handleSquareTap(sq)}
                  className="relative flex items-center justify-center cursor-pointer"
                  style={{
                    background: inCheckSq ? 'rgba(239,68,68,0.6)' : sel ? 'rgba(99,102,241,0.5)' : last ? (light ? 'rgba(250,204,21,0.4)' : 'rgba(250,204,21,0.25)') : light ? 'rgba(240,217,181,0.9)' : 'rgba(181,136,99,0.9)',
                    aspectRatio: '1/1',
                  }}
                >
                  {legal && (
                    <div className={`absolute rounded-full ${piece ? 'inset-0 border-4 border-indigo-400/70 rounded-none' : 'w-1/3 h-1/3 bg-indigo-400/60'}`} />
                  )}
                  {piece && (
                    <span className="select-none z-10 font-chess leading-none" style={{ fontSize: 'clamp(18px, 6vw, 44px)', color: piece.color === 'w' ? '#fff' : '#1a1a1a', textShadow: piece.color === 'w' ? '0 1px 2px #000,0 0 4px #000' : '0 1px 2px rgba(255,255,255,0.4)', userSelect: 'none' }}>
                      {PIECE_UNICODE[piece.color + piece.type]}
                    </span>
                  )}
                </div>
              );
            }))}
          </div>
        </div>
      </div>

      {/* Promotion picker */}
      {promotionPending && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-tg-secondaryBg rounded-2xl p-4 flex gap-4">
            {(['Q','R','B','N'] as PieceType[]).map(pt => (
              <button key={pt} onClick={() => applyPlayerMove(promotionPending.from, promotionPending.to, pt)}
                className="w-14 h-14 rounded-xl bg-tg-bg flex items-center justify-center text-3xl hover:bg-indigo-500/20 active:scale-95 transition-all">
                {PIECE_UNICODE[myEngineColor + pt]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* My info + timer + controls */}
      <div className="flex items-center justify-between px-3 py-2 bg-tg-secondaryBg border-t border-[var(--tg-theme-section-separator-color)]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-emerald-500/30 flex items-center justify-center text-sm font-bold text-emerald-400">Я</div>
          {isMyTurn && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
        </div>
        <div className={`font-mono text-lg font-bold px-3 py-1 rounded-lg ${isMyTurn ? 'bg-emerald-500/20 text-emerald-400' : 'bg-tg-bg text-tg-hint'} ${isMyTimeLow && isMyTurn ? 'animate-pulse' : ''}`}>
          {formatTime(myTime)}
        </div>
        <div className="flex gap-2">
          <button onClick={onOfferDraw} className="px-2 py-1 rounded-lg bg-amber-500/15 text-amber-400 text-xs font-bold active:scale-95 transition-transform">🤝</button>
          <button onClick={() => setShowSurrenderConfirm(true)} className="px-2 py-1 rounded-lg bg-rose-500/15 text-rose-400 text-xs font-bold active:scale-95 transition-transform">🏳️</button>
        </div>
      </div>

      {/* Surrender confirm */}
      {showSurrenderConfirm && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-tg-secondaryBg rounded-2xl p-5 mx-4 space-y-3">
            <h3 className="font-bold text-tg-text text-center">Сдаться?</h3>
            <p className="text-xs text-tg-hint text-center">Соперник получит победу{betAmount > 0 ? ` и ${Math.floor(betAmount * 1.8)} 🪙` : ''}</p>
            <div className="flex gap-3">
              <button onClick={() => setShowSurrenderConfirm(false)} className="flex-1 py-2 rounded-xl bg-tg-bg text-tg-hint text-sm font-bold">Отмена</button>
              <button onClick={() => { setShowSurrenderConfirm(false); onSurrender(); }} className="flex-1 py-2 rounded-xl bg-rose-500/20 text-rose-400 text-sm font-bold">Сдаться</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};