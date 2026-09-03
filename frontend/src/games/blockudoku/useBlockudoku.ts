import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { GridCell, Shape } from './types';
import { generateTrayShapes } from './shapes';

export const GRID_SIZE = 9;
const STORAGE_KEY = 'tma_blockudoku_saved_state';

export function rotateMatrix90(matrix: number[][]): number[][] {
  const rows = matrix.length;
  const cols = matrix[0].length;
  const rotated: number[][] = Array.from({ length: cols }, () => Array(rows).fill(0));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      rotated[c][rows - 1 - r] = matrix[r][c];
    }
  }
  return rotated;
}

export function createEmptyGrid(): GridCell[][] {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
}

export function canPlacePiece(
  grid: GridCell[][],
  matrix: number[][],
  startRow: number,
  startCol: number
): boolean {
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      if (matrix[r][c] === 1) {
        const targetRow = startRow + r;
        const targetCol = startCol + c;

        // Check boundaries
        if (targetRow < 0 || targetRow >= GRID_SIZE || targetCol < 0 || targetCol >= GRID_SIZE) {
          return false;
        }

        // Check collision
        if (grid[targetRow][targetCol] !== 0) {
          return false;
        }
      }
    }
  }
  return true;
}

export function canPieceFit(grid: GridCell[][], piece: Shape | null): boolean {
  if (!piece) return false;
  for (let r = 0; r <= GRID_SIZE - piece.matrix.length; r++) {
    for (let c = 0; c <= GRID_SIZE - piece.matrix[0].length; c++) {
      if (canPlacePiece(grid, piece.matrix, r, c)) {
        return true;
      }
    }
  }
  return false;
}

export function canAnyPieceFit(grid: GridCell[][], pieces: (Shape | null)[]): boolean {
  const activePieces = pieces.filter((p): p is Shape => p !== null);
  if (activePieces.length === 0) return true;
  return activePieces.some((p) => canPieceFit(grid, p));
}

export function getPredictedClears(
  grid: GridCell[][],
  pieceMatrix: number[][],
  startRow: number,
  startCol: number
): { row: number; col: number }[] {
  if (!canPlacePiece(grid, pieceMatrix, startRow, startCol)) return [];

  // Clone grid and simulate placing
  const simGrid = grid.map((r) => [...r]);
  for (let r = 0; r < pieceMatrix.length; r++) {
    for (let c = 0; c < pieceMatrix[r].length; c++) {
      if (pieceMatrix[r][c] === 1) {
        simGrid[startRow + r][startCol + c] = 1;
      }
    }
  }

  const cellsToClear = new Set<string>();

  // Check rows
  for (let r = 0; r < GRID_SIZE; r++) {
    if (simGrid[r].every((val) => val > 0)) {
      for (let c = 0; c < GRID_SIZE; c++) cellsToClear.add(`${r},${c}`);
    }
  }

  // Check columns
  for (let c = 0; c < GRID_SIZE; c++) {
    let full = true;
    for (let r = 0; r < GRID_SIZE; r++) {
      if (simGrid[r][c] === 0) {
        full = false;
        break;
      }
    }
    if (full) {
      for (let r = 0; r < GRID_SIZE; r++) cellsToClear.add(`${r},${c}`);
    }
  }

  // Check 3x3 boxes
  for (let boxIdx = 0; boxIdx < 9; boxIdx++) {
    const boxRow = Math.floor(boxIdx / 3) * 3;
    const boxCol = (boxIdx % 3) * 3;
    let full = true;

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (simGrid[boxRow + r][boxCol + c] === 0) {
          full = false;
          break;
        }
      }
      if (!full) break;
    }

    if (full) {
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          cellsToClear.add(`${boxRow + r},${boxCol + c}`);
        }
      }
    }
  }

  return Array.from(cellsToClear).map((key) => {
    const [r, c] = key.split(',').map(Number);
    return { row: r, col: c };
  });
}

export interface PlaceResult {
  success: boolean;
  scoreGained: number;
  clearedLines: number;
  clearedCellsCount: number;
  combo: number;
  isGameOver: boolean;
}

export function useBlockudoku(initialBestScore: number = 0) {
  // Load saved state if exists
  const saved = useMemo(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.grid && parsed?.trayPieces && typeof parsed.score === 'number') {
          return parsed;
        }
      }
    } catch (_) {}
    return null;
  }, []);

  const [grid, setGrid] = useState<GridCell[][]>(() => saved?.grid || createEmptyGrid());
  const [trayPieces, setTrayPieces] = useState<(Shape | null)[]>(
    () => saved?.trayPieces || generateTrayShapes()
  );
  const [score, setScore] = useState<number>(() => saved?.score || 0);
  const [bestScore, setBestScore] = useState<number>(initialBestScore);
  const [streak, setStreak] = useState<number>(() => saved?.streak || 0);
  const [combo, setCombo] = useState<number>(() => saved?.combo || 0);

  const [isStuck, setIsStuck] = useState<boolean>(false);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [clearingCells, setClearingCells] = useState<{ row: number; col: number }[]>([]);
  const [lastScorePopup, setLastScorePopup] = useState<{ text: string; id: number } | null>(null);
  const [comboBanner, setComboBanner] = useState<{ text: string; id: number } | null>(null);
  const gameOverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (gameOverTimerRef.current) {
        clearTimeout(gameOverTimerRef.current);
      }
    };
  }, []);

  // Sync best score
  useEffect(() => {
    if (initialBestScore > bestScore) {
      setBestScore(initialBestScore);
    }
  }, [initialBestScore, bestScore]);

  // Persist game state to localStorage
  useEffect(() => {
    if (!isGameOver && !isStuck) {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ grid, trayPieces, score, streak, combo })
        );
      } catch (_) {}
    }
  }, [grid, trayPieces, score, streak, combo, isGameOver, isStuck]);

  // Calculate per-piece placeability for tray slots [0, 1, 2]
  const trayPlaceable = useMemo(() => {
    return trayPieces.map((p) => canPieceFit(grid, p));
  }, [grid, trayPieces]);

  // Restart game
  const restartGame = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
    const newGrid = createEmptyGrid();
    const newPieces = generateTrayShapes();
    setGrid(newGrid);
    setTrayPieces(newPieces);
    setScore(0);
    setStreak(0);
    setCombo(0);
    setIsStuck(false);
    setIsGameOver(false);
    setClearingCells([]);
    setLastScorePopup(null);
    setComboBanner(null);
  }, []);

  const placePiece = useCallback(
    (pieceIndex: number, startRow: number, startCol: number): PlaceResult => {
      const piece = trayPieces[pieceIndex];
      if (!piece) {
        return { success: false, scoreGained: 0, clearedLines: 0, clearedCellsCount: 0, combo: 0, isGameOver: false };
      }

      if (!canPlacePiece(grid, piece.matrix, startRow, startCol)) {
        return { success: false, scoreGained: 0, clearedLines: 0, clearedCellsCount: 0, combo: 0, isGameOver: false };
      }

      // 1. Create updated grid with placed piece
      const newGrid = grid.map((row) => [...row]);
      let placedBlocksCount = 0;

      for (let r = 0; r < piece.matrix.length; r++) {
        for (let c = 0; c < piece.matrix[r].length; c++) {
          if (piece.matrix[r][c] === 1) {
            newGrid[startRow + r][startCol + c] = 1;
            placedBlocksCount++;
          }
        }
      }

      // 2. Identify full rows, columns, and 3x3 boxes
      const fullRows: number[] = [];
      const fullCols: number[] = [];
      const fullBoxes: number[] = [];

      // Check rows
      for (let r = 0; r < GRID_SIZE; r++) {
        if (newGrid[r].every((val) => val > 0)) fullRows.push(r);
      }

      // Check columns
      for (let c = 0; c < GRID_SIZE; c++) {
        let full = true;
        for (let r = 0; r < GRID_SIZE; r++) {
          if (newGrid[r][c] === 0) {
            full = false;
            break;
          }
        }
        if (full) fullCols.push(c);
      }

      // Check 3x3 boxes
      for (let boxIdx = 0; boxIdx < 9; boxIdx++) {
        const boxRow = Math.floor(boxIdx / 3) * 3;
        const boxCol = (boxIdx % 3) * 3;
        let full = true;

        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) {
            if (newGrid[boxRow + r][boxCol + c] === 0) {
              full = false;
              break;
            }
          }
          if (!full) break;
        }

        if (full) fullBoxes.push(boxIdx);
      }

      // 3. Clear identified lines & boxes
      const cellsToClear = new Set<string>();

      fullRows.forEach((r) => {
        for (let c = 0; c < GRID_SIZE; c++) cellsToClear.add(`${r},${c}`);
      });

      fullCols.forEach((c) => {
        for (let r = 0; r < GRID_SIZE; r++) cellsToClear.add(`${r},${c}`);
      });

      fullBoxes.forEach((boxIdx) => {
        const boxRow = Math.floor(boxIdx / 3) * 3;
        const boxCol = (boxIdx % 3) * 3;
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) {
            cellsToClear.add(`${boxRow + r},${boxCol + c}`);
          }
        }
      });

      // Clear the cells on board
      cellsToClear.forEach((key) => {
        const [r, c] = key.split(',').map(Number);
        newGrid[r][c] = 0;
      });

      // 4. Calculate score
      const totalClears = fullRows.length + fullCols.length + fullBoxes.length;
      let scoreGained = placedBlocksCount; // 1 point per block placed

      let currentStreak = streak;
      let currentCombo = 0;

      if (totalClears > 0) {
        currentStreak += 1;
        currentCombo = totalClears;

        const baseClearScore = totalClears * 18;
        const comboBonus = totalClears > 1 ? totalClears * (totalClears + 1) * 10 : 0;
        const streakBonus = currentStreak > 1 ? currentStreak * 15 : 0;

        scoreGained += baseClearScore + comboBonus + streakBonus;

        // Visual animation for clearing cells
        const clearedArr = Array.from(cellsToClear).map((key) => {
          const [r, c] = key.split(',').map(Number);
          return { row: r, col: c };
        });
        setClearingCells(clearedArr);
        setTimeout(() => setClearingCells([]), 350);

        // Score popup
        setLastScorePopup({ text: `+${scoreGained}`, id: Date.now() });

        // Non-intrusive combo banner in status line
        if (totalClears > 1) {
          setComboBanner({ text: `Комбо x${totalClears}! (+${scoreGained})`, id: Date.now() });
        } else if (currentStreak > 1) {
          setComboBanner({ text: `Серия x${currentStreak}! (+${scoreGained})`, id: Date.now() });
        }
      } else {
        currentStreak = 0;
        currentCombo = 0;
      }

      setStreak(currentStreak);
      setCombo(currentCombo);

      const newTotalScore = score + scoreGained;
      setScore(newTotalScore);
      if (newTotalScore > bestScore) {
        setBestScore(newTotalScore);
      }

      // 5. Update tray pieces
      const updatedTray = [...trayPieces];
      updatedTray[pieceIndex] = null;

      // Refill if tray is completely empty
      const isTrayEmpty = updatedTray.every((p) => p === null);
      const nextTray = isTrayEmpty ? generateTrayShapes() : updatedTray;
      setTrayPieces(nextTray);
      setGrid(newGrid);

      // 6. Check if any remaining piece can fit anywhere
      const canFit = canAnyPieceFit(newGrid, nextTray);
      if (!canFit) {
        setIsStuck(true);
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch (_) {}
        if (gameOverTimerRef.current) clearTimeout(gameOverTimerRef.current);
        // 3.5s window to use boosters and rescue the game!
        gameOverTimerRef.current = setTimeout(() => {
          setIsGameOver(true);
        }, 3500);
      }

      return {
        success: true,
        scoreGained,
        clearedLines: totalClears,
        clearedCellsCount: cellsToClear.size,
        combo: currentCombo,
        isGameOver: !canFit,
      };
    },
    [grid, trayPieces, score, bestScore, streak]
  );

  // In-Game Booster 1: Reroll Tray (50 coins)
  const rerollTray = useCallback(() => {
    const newShapes = generateTrayShapes();
    setTrayPieces(newShapes);
    const canFit = canAnyPieceFit(grid, newShapes);
    if (canFit) {
      if (gameOverTimerRef.current) {
        clearTimeout(gameOverTimerRef.current);
        gameOverTimerRef.current = null;
      }
      setIsStuck(false);
      setIsGameOver(false);
    }
    return true;
  }, [grid]);

  // In-Game Booster 2: Rotate Piece (75 coins)
  const rotateTrayPiece = useCallback((index: number) => {
    const piece = trayPieces[index];
    if (!piece) return false;
    const rotatedMatrix = rotateMatrix90(piece.matrix);
    const updatedPiece: Shape = {
      ...piece,
      matrix: rotatedMatrix,
    };
    const nextTray = [...trayPieces];
    nextTray[index] = updatedPiece;
    setTrayPieces(nextTray);

    const canFit = canAnyPieceFit(grid, nextTray);
    if (canFit) {
      if (gameOverTimerRef.current) {
        clearTimeout(gameOverTimerRef.current);
        gameOverTimerRef.current = null;
      }
      setIsStuck(false);
      setIsGameOver(false);
    }
    return true;
  }, [trayPieces, grid]);

  // In-Game Booster 3: Hammer - Clear Single Cell (150 coins)
  const hammerClearCell = useCallback((row: number, col: number) => {
    if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return false;
    if (grid[row][col] === 0) return false;

    const nextGrid = grid.map((r, rIdx) =>
      rIdx === row ? r.map((c, cIdx) => (cIdx === col ? (0 as GridCell) : c)) : [...r]
    );
    setGrid(nextGrid);
    setClearingCells([{ row, col }]);
    setTimeout(() => setClearingCells([]), 350);

    const canFit = canAnyPieceFit(nextGrid, trayPieces);
    if (canFit) {
      if (gameOverTimerRef.current) {
        clearTimeout(gameOverTimerRef.current);
        gameOverTimerRef.current = null;
      }
      setIsStuck(false);
      setIsGameOver(false);
    }
    return true;
  }, [grid, trayPieces]);

  return {
    grid,
    trayPieces,
    trayPlaceable,
    score,
    bestScore,
    streak,
    combo,
    isStuck,
    isGameOver,
    clearingCells,
    lastScorePopup,
    comboBanner,
    placePiece,
    restartGame,
    rerollTray,
    rotateTrayPiece,
    hammerClearCell,
  };
}
