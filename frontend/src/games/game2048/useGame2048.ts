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

  // Undo (step back 1 move)
  const undo = useCallback(() => {
    if (history.length === 0 || isGameOver) return false;
    const prev = history[history.length - 1];
    setBoard(prev.board);
    setScore(prev.score);
    setHistory((h) => h.slice(0, -1));
    sound.playUiTap();
    haptics.medium();
    return true;
  }, [history, isGameOver]);

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

      // Save history for Undo (max 3 steps)
      setHistory((prev) => [...prev.slice(-2), { board, score }]);

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

  return {
    board,
    score,
    bestScore,
    canUndo: history.length > 0 && !isGameOver,
    isGameOver,
    hasWon,
    lastScorePopup,
    move,
    undo,
    restartGame,
  };
}
