import { useState, useCallback, useEffect } from 'react';
import type { GridCell, Shape } from './types';
import { generateTrayShapes } from './shapes';

export const GRID_SIZE = 9;

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

export function canAnyPieceFit(grid: GridCell[][], pieces: (Shape | null)[]): boolean {
  const activePieces = pieces.filter((p): p is Shape => p !== null);
  if (activePieces.length === 0) return true;

  for (const piece of activePieces) {
    for (let r = 0; r <= GRID_SIZE - piece.matrix.length; r++) {
      for (let c = 0; c <= GRID_SIZE - piece.matrix[0].length; c++) {
        if (canPlacePiece(grid, piece.matrix, r, c)) {
          return true; // At least one piece fits!
        }
      }
    }
  }
  return false; // No piece can fit anywhere
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
  const [grid, setGrid] = useState<GridCell[][]>(() => createEmptyGrid());
  const [trayPieces, setTrayPieces] = useState<(Shape | null)[]>(() => generateTrayShapes());
  const [score, setScore] = useState<number>(0);
  const [bestScore, setBestScore] = useState<number>(initialBestScore);
  const [streak, setStreak] = useState<number>(0);
  const [combo, setCombo] = useState<number>(0);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [clearingCells, setClearingCells] = useState<{ row: number; col: number }[]>([]);
  const [lastScorePopup, setLastScorePopup] = useState<{ text: string; id: number } | null>(null);

  // Update best score if external record is higher
  useEffect(() => {
    if (initialBestScore > bestScore) {
      setBestScore(initialBestScore);
    }
  }, [initialBestScore, bestScore]);

  const restartGame = useCallback(() => {
    const newGrid = createEmptyGrid();
    const newPieces = generateTrayShapes();
    setGrid(newGrid);
    setTrayPieces(newPieces);
    setScore(0);
    setStreak(0);
    setCombo(0);
    setIsGameOver(false);
    setClearingCells([]);
    setLastScorePopup(null);
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
        if (newGrid[r].every((val) => val > 0)) {
          fullRows.push(r);
        }
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

      // Check 3x3 boxes (9 total)
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

        // Base clear score: 18 points per line/box cleared
        const baseClearScore = totalClears * 18;
        // Combo multiplier: clears * (clears + 1) * 8
        const comboBonus = totalClears > 1 ? totalClears * (totalClears + 1) * 10 : 0;
        // Streak bonus
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
        let popupText = `+${scoreGained}`;
        if (totalClears > 1) {
          popupText = `КОМБО x${totalClears}! +${scoreGained}`;
        } else if (currentStreak > 1) {
          popupText = `СЕРИЯ x${currentStreak}! +${scoreGained}`;
        }
        setLastScorePopup({ text: popupText, id: Date.now() });
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

      // Refill if tray is empty
      const isTrayEmpty = updatedTray.every((p) => p === null);
      const nextTray = isTrayEmpty ? generateTrayShapes() : updatedTray;
      setTrayPieces(nextTray);
      setGrid(newGrid);

      // 6. Check Game Over
      const canFit = canAnyPieceFit(newGrid, nextTray);
      const over = !canFit;
      if (over) {
        setIsGameOver(true);
      }

      return {
        success: true,
        scoreGained,
        clearedLines: totalClears,
        clearedCellsCount: cellsToClear.size,
        combo: currentCombo,
        isGameOver: over,
      };
    },
    [grid, trayPieces, score, bestScore, streak]
  );

  return {
    grid,
    trayPieces,
    score,
    bestScore,
    streak,
    combo,
    isGameOver,
    clearingCells,
    lastScorePopup,
    placePiece,
    restartGame,
  };
}
