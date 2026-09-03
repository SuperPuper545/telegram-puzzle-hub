import React, { useState } from 'react';
import { haptics } from '../../../telegram/telegram';

interface Ship { id: number; size: number; cells: { r: number; c: number }[]; horizontal: boolean; sunk?: boolean }
interface ShotCell { r: number; c: number; hit: boolean }

interface Props {
  roomId: string; myUserId: number;
  opponent: { firstName: string; username: string | null; userId: number };
  betAmount: number;
  phase: 'placement' | 'battle' | 'finished';
  currentAttackerId?: number | null;
  myShots?: ShotCell[];
  opponentShots?: ShotCell[];
  myBoard?: number[][];
  onPlace: (ships: Ship[]) => void;
  onShoot: (r: number, c: number) => void;
  onSurrender: () => void;
  gameOverData?: { reason: string; winnerUserId: number | null; payout: number; commission: number } | null;
  sunkEnemyCells?: { r: number; c: number }[];
}

const SHIP_SIZES = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1];

function createEmptyGrid(): number[][] { return Array(10).fill(null).map(() => Array(10).fill(0)); }

function canPlace(grid: number[][], ship: Ship): boolean {
  for (const { r, c } of ship.cells) {
    if (r < 0 || r > 9 || c < 0 || c > 9) return false;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < 10 && nc >= 0 && nc < 10 && grid[nr][nc] === 1) return false;
    }
  }
  return true;
}

function placeShipOnGrid(grid: number[][], ship: Ship): number[][] {
  const g = grid.map(row => [...row]);
  for (const { r, c } of ship.cells) g[r][c] = 1;
  return g;
}

function autoPlace(): Ship[] {
  const grid = createEmptyGrid();
  const ships: Ship[] = [];
  let id = 0;
  for (const size of SHIP_SIZES) {
    let placed = false;
    for (let attempt = 0; attempt < 200 && !placed; attempt++) {
      const horizontal = Math.random() < 0.5;
      const r = Math.floor(Math.random() * (horizontal ? 10 : 10 - size + 1));
      const c = Math.floor(Math.random() * (horizontal ? 10 - size + 1 : 10));
      const cells = Array.from({ length: size }, (_, i) => horizontal ? { r, c: c + i } : { r: r + i, c });
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

function Grid({ size = 10, grid, shots, sunkCells, onClick, interactive, showShips, myBoard }: {
  size?: number; grid?: Ship[]; shots?: ShotCell[]; sunkCells?: { r: number; c: number }[];
  onClick?: (r: number, c: number) => void; interactive?: boolean; showShips?: boolean; myBoard?: number[][];
}) {
  return (
    <div className="grid" style={{ gridTemplateColumns: `repeat(${size}, 1fr)`, gap: 1 }}>
      {Array(size).fill(null).map((_, r) => Array(size).fill(null).map((_, c) => {
        const shot = shots?.find(s => s.r === r && s.c === c);
        const sunk = sunkCells?.some(s => s.r === r && s.c === c);
        const hasShip = myBoard ? myBoard[r][c] === 1 : grid?.some(s => s.cells.some(cell => cell.r === r && cell.c === c));
        const bg = sunk ? 'bg-red-600' : shot?.hit ? 'bg-red-400/80' : shot ? 'bg-blue-400/40' : (showShips && hasShip) ? 'bg-indigo-400/60' : 'bg-tg-secondaryBg';
        return (
          <div key={`${r}-${c}`} onClick={() => interactive && !shot && onClick?.(r, c)}
            className={`aspect-square rounded-sm border border-[var(--tg-theme-section-separator-color)] flex items-center justify-center text-xs ${bg} ${interactive && !shot ? 'active:scale-90 cursor-pointer' : ''}`}
            style={{ width: '100%' }}>
            {sunk ? '💥' : shot?.hit ? '🔥' : shot ? '💧' : null}
          </div>
        );
      }))}
    </div>
  );
}

export const BattleshipGame: React.FC<Props> = ({
  myUserId, opponent, betAmount, phase, currentAttackerId,
  myShots = [], opponentShots = [], myBoard,
  onPlace, onShoot, onSurrender, gameOverData, sunkEnemyCells = [],
}) => {
  const [placedShips, setPlacedShips] = useState<Ship[]>([]);
  const [placedGrid, setPlacedGrid] = useState(createEmptyGrid());
  const [placingShipIdx, setPlacingShipIdx] = useState(0);
  const [horizontal, setHorizontal] = useState(true);
  const [showSurrender, setShowSurrender] = useState(false);
  const [ready, setReady] = useState(false);

  const isMyTurn = currentAttackerId === myUserId;

  const handleAutoPlace = () => {
    const ships = autoPlace();
    const g = createEmptyGrid();
    for (const s of ships) for (const cell of s.cells) g[cell.r][cell.c] = 1;
    setPlacedShips(ships); setPlacedGrid(g); haptics.medium();
  };

  const handlePlaceClick = (r: number, c: number) => {
    const size = SHIP_SIZES[placingShipIdx];
    const cells = Array.from({ length: size }, (_, i) => horizontal ? { r, c: c + i } : { r: r + i, c });
    const ship: Ship = { id: placingShipIdx, size, cells, horizontal };
    if (!canPlace(placedGrid, ship)) { haptics.error(); return; }
    const newGrid = placeShipOnGrid(placedGrid, ship);
    const newShips = [...placedShips, ship];
    setPlacedGrid(newGrid); setPlacedShips(newShips); setPlacingShipIdx(prev => prev + 1);
    haptics.light();
  };

  const handleReady = () => {
    if (placedShips.length < SHIP_SIZES.length) return;
    setReady(true); onPlace(placedShips); haptics.success();
  };

  const handleShoot = (r: number, c: number) => {
    if (!isMyTurn) return;
    onShoot(r, c); haptics.medium();
  };

  if (gameOverData) {
    const won = gameOverData.winnerUserId === myUserId;
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-6 touch-none select-none">
        <div className="text-6xl">{won ? '🏆' : '😔'}</div>
        <h2 className="text-2xl font-black text-tg-text">{won ? 'Победа!' : 'Поражение'}</h2>
        <p className="text-xs text-tg-hint">{gameOverData.reason === 'all_sunk' ? 'Все корабли потоплены!' : gameOverData.reason === 'surrender' ? 'Соперник сдался' : gameOverData.reason}</p>
        {betAmount > 0 && won && <div className="text-amber-400 font-bold text-lg">+{gameOverData.payout} 🪙</div>}
        {betAmount > 0 && !won && <div className="text-rose-400 font-bold text-lg">-{betAmount} 🪙</div>}
      </div>
    );
  }

  if (phase === 'placement' && !ready) {
    return (
      <div className="flex flex-col h-full bg-tg-bg p-3 gap-3 touch-none select-none game-viewport-lock" style={{ touchAction: 'none' }}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-tg-text">Расстановка кораблей</h3>
          <div className="flex gap-2">
            <button onClick={() => setHorizontal(h => !h)} className={`px-2 py-1 rounded-lg text-xs font-bold ${horizontal ? 'bg-indigo-500/20 text-indigo-400' : 'bg-tg-secondaryBg text-tg-hint'}`}>
              {horizontal ? '↔️ Гориз.' : '↕️ Верт.'}
            </button>
            <button onClick={handleAutoPlace} className="px-2 py-1 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-400">
              🎲 Авто
            </button>
          </div>
        </div>
        <div className="text-xs text-tg-hint">
          {placedShips.length < SHIP_SIZES.length ? `Размещаю корабль ${placedShips.length + 1}/${SHIP_SIZES.length} (размер: ${SHIP_SIZES[placingShipIdx]})` : '✅ Все корабли расставлены!'}
        </div>
        <div style={{ maxWidth: 320, margin: '0 auto', width: '100%' }}>
          <Grid grid={placedShips} showShips onClick={handlePlaceClick} interactive={placedShips.length < SHIP_SIZES.length} />
        </div>
        <button onClick={handleReady} disabled={placedShips.length < SHIP_SIZES.length}
          className="w-full py-3 rounded-xl tg-btn-primary font-bold text-sm disabled:opacity-40 active:scale-95 transition-transform">
          ✅ Готов к бою!
        </button>
      </div>
    );
  }

  if (phase === 'placement' && ready) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-tg-hint">
        <div className="text-4xl animate-pulse">⚓</div>
        <p className="text-sm">Ожидаем готовности соперника...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-tg-bg p-3 gap-3 touch-none select-none game-viewport-lock" style={{ touchAction: 'none' }}>
      {/* Turn indicator */}
      <div className={`text-center py-1 rounded-lg text-xs font-bold ${isMyTurn ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
        {isMyTurn ? '🎯 Ваш ход! Нажмите на клетку соперника' : `⏳ Ход ${opponent.firstName}...`}
      </div>

      {/* Enemy board (shoot here) */}
      <div>
        <p className="text-xs text-tg-hint mb-1">🎯 Поле соперника — {opponent.firstName}</p>
        <div style={{ maxWidth: 300, margin: '0 auto', width: '100%' }}>
          <Grid shots={myShots} sunkCells={sunkEnemyCells} onClick={handleShoot} interactive={isMyTurn} />
        </div>
      </div>

      {/* My board (show own ships + enemy shots) */}
      <div>
        <p className="text-xs text-tg-hint mb-1">🚢 Ваше поле</p>
        <div style={{ maxWidth: 300, margin: '0 auto', width: '100%' }}>
          <Grid myBoard={myBoard} shots={opponentShots} showShips />
        </div>
      </div>

      <button onClick={() => setShowSurrender(true)} className="py-2 rounded-xl bg-rose-500/10 text-rose-400 text-xs font-bold active:scale-95 transition-transform">
        🏳️ Сдаться
      </button>

      {showSurrender && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-tg-secondaryBg rounded-2xl p-5 mx-4 space-y-3">
            <h3 className="font-bold text-tg-text text-center">Сдаться?</h3>
            <div className="flex gap-3">
              <button onClick={() => setShowSurrender(false)} className="flex-1 py-2 rounded-xl bg-tg-bg text-tg-hint text-sm font-bold">Отмена</button>
              <button onClick={() => { setShowSurrender(false); onSurrender(); }} className="flex-1 py-2 rounded-xl bg-rose-500/20 text-rose-400 text-sm font-bold">Сдаться</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};