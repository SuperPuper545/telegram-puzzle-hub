import React, { useState, useEffect } from 'react';
import { haptics, setupBackButton, removeBackButton } from '../../../telegram/telegram';
import { sound } from '../../../utils/sound';
import confetti from 'canvas-confetti';
import { ArrowLeft, Flag, Trophy, Frown, Sparkles, Crosshair, Anchor, Compass } from 'lucide-react';
import type { Ship, ShipCell, ShotCell, GameOverPayload, DuelOpponent } from '../types';

interface Props {
  roomId: string;
  myUserId: number;
  opponent: DuelOpponent;
  betAmount: number;
  phase: 'placement' | 'battle' | 'finished';
  currentAttackerId?: number | null;
  myShots?: ShotCell[];
  opponentShots?: ShotCell[];
  myBoard?: number[][];
  onPlace: (ships: Ship[]) => void;
  onShoot: (r: number, c: number) => void;
  onSurrender: () => void;
  gameOverData?: GameOverPayload | null;
  sunkEnemyCells?: ShipCell[];
  onExit: () => void;
}

const SHIP_RULES = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1];

function createEmptyGrid(): number[][] {
  return Array(10)
    .fill(null)
    .map(() => Array(10).fill(0));
}

function canPlace(grid: number[][], ship: Ship): boolean {
  for (const { r, c } of ship.cells) {
    if (r < 0 || r > 9 || c < 0 || c > 9) return false;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < 10 && nc >= 0 && nc < 10 && grid[nr][nc] === 1) {
          return false;
        }
      }
    }
  }
  return true;
}

function placeShipOnGrid(grid: number[][], ship: Ship): number[][] {
  const g = grid.map((row) => [...row]);
  for (const { r, c } of ship.cells) g[r][c] = 1;
  return g;
}

function autoPlaceShips(): Ship[] {
  const grid = createEmptyGrid();
  const ships: Ship[] = [];
  let id = 0;

  for (const size of SHIP_RULES) {
    let placed = false;
    for (let attempt = 0; attempt < 300 && !placed; attempt++) {
      const horizontal = Math.random() < 0.5;
      const r = Math.floor(Math.random() * (horizontal ? 10 : 10 - size + 1));
      const c = Math.floor(Math.random() * (horizontal ? 10 - size + 1 : 10));
      const cells = Array.from({ length: size }, (_, i) =>
        horizontal ? { r, c: c + i } : { r: r + i, c }
      );
      const ship: Ship = { id: id++, size, cells, horizontal };
      if (canPlace(grid, ship)) {
        ships.push(ship);
        for (const cell of cells) grid[cell.r][cell.c] = 1;
        placed = true;
      }
    }
  }
  return ships;
}

export const BattleshipGame: React.FC<Props> = ({
  myUserId,
  opponent,
  betAmount,
  phase,
  currentAttackerId,
  myShots = [],
  opponentShots = [],
  myBoard,
  onPlace,
  onShoot,
  onSurrender,
  gameOverData,
  sunkEnemyCells = [],
  onExit,
}) => {
  const [placedShips, setPlacedShips] = useState<Ship[]>([]);
  const [placedGrid, setPlacedGrid] = useState<number[][]>(createEmptyGrid());
  const [currentShipIdx, setCurrentShipIdx] = useState(0);
  const [horizontal, setHorizontal] = useState(true);
  const [ready, setReady] = useState(false);
  const [showSurrender, setShowSurrender] = useState(false);
  const [waitOpponentSeconds, setWaitOpponentSeconds] = useState(0);

  const isMyTurn = currentAttackerId === myUserId;

  // Telegram BackButton integration
  useEffect(() => {
    setupBackButton(() => {
      setShowSurrender(true);
    });
    return () => removeBackButton();
  }, []);

  // Pre-place valid fleet automatically on mount so player doesn't have to place 10 ships manually
  useEffect(() => {
    const ships = autoPlaceShips();
    const g = createEmptyGrid();
    for (const s of ships) for (const c of s.cells) g[c.r][c.c] = 1;
    setPlacedShips(ships);
    setPlacedGrid(g);
    setCurrentShipIdx(SHIP_RULES.length);
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (phase === 'placement' && ready) {
      interval = setInterval(() => {
        setWaitOpponentSeconds((s) => s + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [phase, ready]);

  useEffect(() => {
    if (gameOverData) {
      const won = gameOverData.winnerUserId === myUserId;
      if (won) {
        sound.playRecord();
        confetti({
          particleCount: 80,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#06b6d4', '#3b82f6', '#10b981', '#f59e0b'],
        });
      } else {
        sound.playGameOver();
      }
    }
  }, [gameOverData, myUserId]);

  const handleRandomize = () => {
    sound.playUiTap();
    haptics.medium();
    const ships = autoPlaceShips();
    const g = createEmptyGrid();
    for (const s of ships) for (const c of s.cells) g[c.r][c.c] = 1;
    setPlacedShips(ships);
    setPlacedGrid(g);
    setCurrentShipIdx(SHIP_RULES.length);
  };

  const handleCellPlace = (r: number, c: number) => {
    if (currentShipIdx >= SHIP_RULES.length) return;
    const size = SHIP_RULES[currentShipIdx];
    const cells = Array.from({ length: size }, (_, i) =>
      horizontal ? { r, c: c + i } : { r: r + i, c }
    );
    const ship: Ship = { id: currentShipIdx, size, cells, horizontal };
    if (!canPlace(placedGrid, ship)) {
      sound.playHit();
      haptics.error();
      return;
    }
    sound.playPickup();
    haptics.light();
    setPlacedGrid(placeShipOnGrid(placedGrid, ship));
    setPlacedShips((prev) => [...prev, ship]);
    setCurrentShipIdx((prev) => prev + 1);
  };

  const handleConfirmFleet = () => {
    if (placedShips.length < SHIP_RULES.length) return;
    sound.playRecord();
    haptics.success();
    setReady(true);
    onPlace(placedShips);
  };

  const handleFire = (r: number, c: number) => {
    if (!isMyTurn || phase !== 'battle') return;
    sound.playBombExplosion();
    haptics.medium();
    onShoot(r, c);
  };

  // ─── Placement Phase UI ───────────────────────────────────────────────
  if (phase === 'placement' && !ready) {
    return (
      <div className="flex flex-col h-full bg-tg-bg select-none touch-none p-3 overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--tg-theme-section-separator-color)]">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSurrender(true)}
              className="p-2 rounded-xl bg-tg-bg border border-[var(--tg-theme-section-separator-color)] text-tg-hint hover:text-rose-400 active:scale-90 transition-all cursor-pointer"
              title="Покинуть матч"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h3 className="font-extrabold text-sm text-tg-text flex items-center gap-1.5">
                <Anchor className="w-4 h-4 text-cyan-400" /> Расстановка флота
              </h3>
              <p className="text-[11px] text-tg-hint mt-0.5">
                {placedShips.length < SHIP_RULES.length
                  ? `Корабль ${placedShips.length + 1}/${SHIP_RULES.length} (${SHIP_RULES[currentShipIdx]} палуб)`
                  : 'Все 10 кораблей готовы к бою!'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                sound.playUiTap();
                setHorizontal((h) => !h);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] text-xs font-bold text-tg-text active:scale-95 transition-all cursor-pointer"
            >
              {horizontal ? '↔️ Гор.' : '↕️ Верт.'}
            </button>

            <button
              onClick={handleRandomize}
              className="px-3 py-1.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-xs font-bold text-indigo-400 active:scale-95 transition-all cursor-pointer flex items-center gap-1"
            >
              🎲 Перемешать
            </button>
          </div>
        </div>

        {/* 10x10 Placement Grid */}
        <div className="flex-1 flex items-center justify-center py-3">
          <div
            className="w-full max-w-[320px] aspect-square gap-0.5 p-1 rounded-2xl bg-cyan-950/20 border border-cyan-500/30 shadow-xl"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(10, minmax(0, 1fr))' }}
          >
            {Array(10)
              .fill(null)
              .map((_, r) =>
                Array(10)
                  .fill(null)
                  .map((_, c) => {
                    const isShip = placedGrid[r][c] === 1;
                    return (
                      <div
                        key={`${r}-${c}`}
                        onClick={() => handleCellPlace(r, c)}
                        className={`aspect-square rounded-[3px] border border-cyan-500/20 flex items-center justify-center text-xs transition-all cursor-pointer ${
                          isShip
                            ? 'bg-gradient-to-br from-cyan-500 to-blue-600 shadow-sm'
                            : 'bg-tg-secondaryBg/80 hover:bg-cyan-500/20 active:scale-90'
                        }`}
                      />
                    );
                  })
              )}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="pt-2">
          <button
            onClick={handleConfirmFleet}
            disabled={placedShips.length < SHIP_RULES.length}
            className="w-full py-3.5 rounded-2xl tg-btn-primary font-black text-sm shadow-xl active:scale-95 transition-all disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
          >
            <span>В БОЙ! Начать сражение</span>
            <span>⚓</span>
          </button>
        </div>

        {/* Surrender Confirmation Modal */}
        {showSurrender && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] rounded-3xl p-5 shadow-2xl max-w-xs w-full text-center space-y-3 animate-scale-up">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <Flag className="w-6 h-6" />
              </div>
              <h4 className="font-extrabold text-base text-tg-text">Покинуть бой?</h4>
              <p className="text-xs text-tg-hint leading-relaxed">
                Вы уверены? Победа и банк будут присуждены сопернику.
              </p>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowSurrender(false)}
                  className="flex-1 py-2.5 rounded-xl bg-tg-bg border border-[var(--tg-theme-section-separator-color)] text-tg-hint text-xs font-bold active:scale-95 transition-all cursor-pointer"
                >
                  Остаться
                </button>
                <button
                  onClick={() => {
                    setShowSurrender(false);
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
      </div>
    );
  }

  // ─── Waiting Opponent Ready UI ───────────────────────────────────────
  if (phase === 'placement' && ready) {
    return (
      <div className="flex flex-col h-full bg-tg-bg select-none touch-none p-4 justify-between">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--tg-theme-section-separator-color)]">
          <button
            onClick={() => setShowSurrender(true)}
            className="p-2 rounded-xl bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] text-tg-hint hover:text-rose-400 active:scale-90 transition-all cursor-pointer"
            title="Покинуть матч"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold text-tg-hint">Ожидание готовности</span>
          <div className="w-8" />
        </div>

        {/* Waiting Body */}
        <div className="flex flex-col items-center justify-center gap-4 text-center p-6 text-tg-hint">
          <div className="w-16 h-16 rounded-3xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-3xl shadow-inner text-cyan-400 animate-pulse">
            <Compass className="w-8 h-8 animate-spin" />
          </div>
          <div>
            <h4 className="font-extrabold text-base text-tg-text">Ваш флот развернут!</h4>
            <p className="text-xs text-tg-hint mt-1">Ожидаем, пока {opponent.firstName} расставит корабли...</p>
            <p className="text-xs font-mono font-bold text-cyan-400 mt-2">Время ожидания: {waitOpponentSeconds} сек</p>
          </div>
        </div>

        {/* Exit Button in Waiting */}
        <button
          onClick={() => setShowSurrender(true)}
          className="w-full py-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 font-bold text-xs active:scale-95 transition-all cursor-pointer"
        >
          Сдаться и выйти в хаб
        </button>

        {/* Surrender Confirmation Modal */}
        {showSurrender && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] rounded-3xl p-5 shadow-2xl max-w-xs w-full text-center space-y-3 animate-scale-up">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <Flag className="w-6 h-6" />
              </div>
              <h4 className="font-extrabold text-base text-tg-text">Покинуть бой?</h4>
              <p className="text-xs text-tg-hint leading-relaxed">
                Вы уверены? Победа и банк будут присуждены сопернику.
              </p>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowSurrender(false)}
                  className="flex-1 py-2.5 rounded-xl bg-tg-bg border border-[var(--tg-theme-section-separator-color)] text-tg-hint text-xs font-bold active:scale-95 transition-all cursor-pointer"
                >
                  Остаться
                </button>
                <button
                  onClick={() => {
                    setShowSurrender(false);
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
      </div>
    );
  }

  // ─── Battle Phase UI ──────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-tg-bg select-none touch-none overflow-hidden">
      {/* Top Bar: Back Button + Opponent Info + Turn Status + Surrender */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-tg-secondaryBg border-b border-[var(--tg-theme-section-separator-color)] shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              sound.playUiTap();
              haptics.selection();
              setShowSurrender(true);
            }}
            className="p-2 rounded-xl bg-tg-bg border border-[var(--tg-theme-section-separator-color)] text-tg-hint hover:text-rose-400 active:scale-90 transition-all cursor-pointer"
            title="Покинуть матч"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center font-bold text-xs text-cyan-400">
            {opponent.firstName[0]}
          </div>
          <div>
            <div className="text-xs font-bold text-tg-text truncate max-w-[90px]">
              {opponent.firstName}
            </div>
            <div className="text-[10px] text-tg-hint">Флот врага</div>
          </div>
        </div>

        {/* Bank badge in center */}
        {betAmount > 0 && (
          <div className="flex items-center gap-1 text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <span>🪙</span>
            <span>Банк: {Math.floor(betAmount * 1.8)}</span>
          </div>
        )}

        {/* Turn Status Badge */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold border shadow-sm ${
            isMyTurn
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 animate-pulse'
              : 'bg-tg-bg border-[var(--tg-theme-section-separator-color)] text-tg-hint'
          }`}
        >
          <Crosshair className="w-3.5 h-3.5" />
          <span>{isMyTurn ? 'Ваш залп!' : 'Залп врага'}</span>
        </div>
      </div>

      {/* Battle Boards Area */}
      <div className="flex-1 flex flex-col justify-around p-3 min-h-0">
        {/* Enemy Grid (Target Field) */}
        <div>
          <div className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Crosshair className="w-3 h-3" /> Поле врага (Стрелять сюда)
          </div>

          <div
            className="w-full max-w-[280px] mx-auto aspect-square gap-0.5 p-1 rounded-xl bg-cyan-950/30 border border-cyan-500/40 shadow-md"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(10, minmax(0, 1fr))' }}
          >
            {Array(10)
              .fill(null)
              .map((_, r) =>
                Array(10)
                  .fill(null)
                  .map((_, c) => {
                    const shot = myShots.find((s) => s.r === r && s.c === c);
                    const sunk = sunkEnemyCells.some((s) => s.r === r && s.c === c);
                    return (
                      <div
                        key={`opp-${r}-${c}`}
                        onClick={() => !shot && handleFire(r, c)}
                        className={`aspect-square rounded-[2px] border border-cyan-500/20 flex items-center justify-center text-xs transition-all ${
                          sunk
                            ? 'bg-red-600 text-white font-bold'
                            : shot?.hit
                            ? 'bg-rose-500 text-white font-bold'
                            : shot
                            ? 'bg-blue-400/30 text-cyan-300'
                            : isMyTurn
                            ? 'bg-tg-secondaryBg hover:bg-cyan-500/30 active:scale-85 cursor-pointer'
                            : 'bg-tg-secondaryBg'
                        }`}
                      >
                        {sunk ? '💥' : shot?.hit ? '🔥' : shot ? '💧' : null}
                      </div>
                    );
                  })
              )}
          </div>
        </div>

        {/* Own Grid (Defense Field) */}
        <div>
          <div className="text-[11px] font-bold text-tg-hint uppercase tracking-wider mb-1 flex items-center gap-1">
            <Anchor className="w-3 h-3 text-indigo-400" /> Ваша эскадра
          </div>

          <div
            className="w-full max-w-[210px] mx-auto aspect-square gap-0.5 p-1 rounded-xl bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] shadow-sm"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(10, minmax(0, 1fr))' }}
          >
            {Array(10)
              .fill(null)
              .map((_, r) =>
                Array(10)
                  .fill(null)
                  .map((_, c) => {
                    const hasShip = myBoard ? myBoard[r][c] === 1 : false;
                    const shot = opponentShots.find((s) => s.r === r && s.c === c);
                    return (
                      <div
                        key={`my-${r}-${c}`}
                        className={`aspect-square rounded-[2px] border border-[var(--tg-theme-section-separator-color)] flex items-center justify-center text-[10px] ${
                          shot?.hit
                            ? 'bg-rose-500 text-white'
                            : shot
                            ? 'bg-blue-400/30 text-cyan-300'
                            : hasShip
                            ? 'bg-indigo-500/60'
                            : 'bg-tg-bg'
                        }`}
                      >
                        {shot?.hit ? '🔥' : shot ? '💧' : null}
                      </div>
                    );
                  })
              )}
          </div>
        </div>
      </div>

      {/* Surrender Confirmation Modal */}
      {showSurrender && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] rounded-3xl p-5 shadow-2xl max-w-xs w-full text-center space-y-3 animate-scale-up">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Flag className="w-6 h-6" />
            </div>
            <h4 className="font-extrabold text-base text-tg-text">Покинуть бой?</h4>
            <p className="text-xs text-tg-hint leading-relaxed">
              Вы уверены? Победа и банк будут присуждены сопернику.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowSurrender(false)}
                className="flex-1 py-2.5 rounded-xl bg-tg-bg border border-[var(--tg-theme-section-separator-color)] text-tg-hint text-xs font-bold active:scale-95 transition-all cursor-pointer"
              >
                Остаться
              </button>
              <button
                onClick={() => {
                  setShowSurrender(false);
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
                  {gameOverData.reason === 'all_sunk'
                    ? 'Весь вражеский флот потоплен!'
                    : 'Соперник капитулировал'}
                </p>
                {betAmount > 0 && (
                  <div className="py-2 px-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-extrabold text-lg flex items-center justify-center gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    +{gameOverData.payout} 🪙
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="w-16 h-16 mx-auto rounded-3xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-3xl shadow-inner text-rose-400">
                  <Frown className="w-9 h-9" />
                </div>
                <h3 className="font-black text-xl text-tg-text">Флот потоплен!</h3>
                <p className="text-xs text-tg-hint">Все ваши корабли уничтожены</p>
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
