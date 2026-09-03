import { useState, useCallback, useEffect, useMemo } from 'react';
import type { BoardMatrix, Direction } from './types';
import {
  createInitialBoard,
  executeMove,
  spawnRandomTile,
  canMove,
  has2048Tile,
} from './logic2048';
import { sound } from '../../utils/sound';
import { haptics } from '../../telegram/telegram';

const STORAGE_KEY = 'tma_2048_saved_state';

interface SavedState {
  board: BoardMatrix;
  score: number;
  hasWon: boolean;
}

export function useGame2048(initialBestScore: number = 0) {
  // Load saved state
  const saved = useMemo<SavedState | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.board && typeof parsed.score === 'number') {
          return parsed;
        }
      }
    } catch (_) {}
    return null;
  }, []);

  const [board, setBoard] = useState<BoardMatrix>(() => saved?.board || createInitialBoard());
  const [score, setScore] = useState<number>(() => saved?.score || 0);
  const [bestScore, setBestScore] = useState<number>(initialBestScore);
  const [history, setHistory] = useState<{ board: BoardMatrix; score: number }[]>([]);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [hasWon, setHasWon] = useState<boolean>(() => saved?.hasWon || false);
  const [lastScorePopup, setLastScorePopup] = useState<{ text: string; id: number } | null>(null);

  // Sync best score
  useEffect(() => {
    if (initialBestScore > bestScore) {
      setBestScore(initialBestScore);
    }
  }, [initialBestScore, bestScore]);

  // Persist state
  useEffect(() => {
    if (!isGameOver) {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ board, score, hasWon })
        );
      } catch (_) {}
    }
  }, [board, score, hasWon, isGameOver]);

function countActiveTiles(b: number[][]): number {
  let count = 0;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (b[r][c] > 0) count++;
    }
  }
  return count;
}

  // Restart
  const restartGame = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
    setBoard(createInitialBoard());
    setScore(0);
    setHistory([]);
    setIsGameOver(false);
    setHasWon(false);
    setLastScorePopup(null);
  }, []);

  // Undo (step back 1 move, can also rescue from Game Over)
  const undo = useCallback(() => {
    if (history.length === 0) return false;
    const prev = history[history.length - 1];

    let restoredBoard = prev.board;
    while (countActiveTiles(restoredBoard) < 2) {
      restoredBoard = spawnRandomTile(restoredBoard);
    }

    setBoard(restoredBoard);
    setScore(prev.score);
    setHistory((h) => h.slice(0, -1));
    setIsGameOver(false);
    sound.playUiTap();
    haptics.medium();
    return true;
  }, [history]);

  // Move handler
  const move = useCallback(
    (dir: Direction) => {
      if (isGameOver) return;

      const res = executeMove(board, dir);
      if (!res.moved) return; // Nothing moved

      // Play sound
      if (res.scoreGained > 0) {
        sound.playMerge(res.maxMergedValue);
        haptics.medium();
        setLastScorePopup({ text: `+${res.scoreGained}`, id: Date.now() });
      } else {
        sound.playSlide();
        haptics.light();
      }

      // Save history for Undo (up to 4 steps)
      setHistory((prev) => [...prev.slice(-3), { board, score }]);

      // Spawn new tile
      const boardWithSpawn = spawnRandomTile(res.board);
      const newScore = score + res.scoreGained;

      setBoard(boardWithSpawn);
      setScore(newScore);

      if (newScore > bestScore) {
        setBestScore(newScore);
      }

      // Check 2048 Win condition
      if (!hasWon && has2048Tile(boardWithSpawn)) {
        setHasWon(true);
        sound.playRecord();
        haptics.success();
      }

      // Check Game Over
      if (!canMove(boardWithSpawn)) {
        setIsGameOver(true);
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch (_) {}
      }
    },
    [board, score, bestScore, hasWon, isGameOver]
  );

  // In-Game Booster: Remove small tiles (2 and 4, or up to 2 lowest tiles) giving real breathing room without ever emptying the board
  const removeLowTile = useCallback(() => {
    const activeTiles: { r: number; c: number; val: number }[] = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (board[r][c] > 0) {
          activeTiles.push({ r, c, val: board[r][c] });
        }
      }
    }

    // Never remove if board already has 2 or fewer tiles
    if (activeTiles.length <= 2) return false;

    // Sort ascending by tile value
    activeTiles.sort((a, b) => a.val - b.val);

    const targetCoords = new Set<string>();

    // Target all 2s and 4s while ensuring at least 2 tiles remain
    for (const tile of activeTiles) {
      if ((tile.val === 2 || tile.val === 4) && activeTiles.length - targetCoords.size > 2) {
        targetCoords.add(`${tile.r},${tile.c}`);
      }
    }

    // If less than 2 low tiles were found, take up to 2 lowest tiles to give real room to play
    if (targetCoords.size < 2) {
      for (const tile of activeTiles) {
        if (activeTiles.length - targetCoords.size <= 2) break;
        targetCoords.add(`${tile.r},${tile.c}`);
        if (targetCoords.size >= 2) break;
      }
    }

    if (targetCoords.size === 0) return false;

    let nextBoard = board.map((row, r) =>
      row.map((cell, c) => (targetCoords.has(`${r},${c}`) ? 0 : cell))
    );

    // Guarantee at least 2 tiles remain on the board
    while (countActiveTiles(nextBoard) < 2) {
      nextBoard = spawnRandomTile(nextBoard);
    }

    setBoard(nextBoard);
    setIsGameOver(false);
    return true;
  }, [board]);

  return {
    board,
    score,
    bestScore,
    canUndo: history.length > 0,
    isGameOver,
    hasWon,
    lastScorePopup,
    move,
    undo,
    restartGame,
    removeLowTile,
  };
}
