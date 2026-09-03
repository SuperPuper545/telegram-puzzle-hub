import { useState, useCallback, useEffect, useMemo } from 'react';
import type { GemCell, Position } from './types';
import {
  createInitialBoard,
  scanMatches,
  applyGravityAndRefill,
  hasValidMoves,
  MATCH3_SIZE,
} from './match3Logic';
import { sound } from '../../utils/sound';
import { haptics } from '../../telegram/telegram';

const STORAGE_KEY = 'tma_match3_saved_state';
const INITIAL_MOVES = 25;

export function useMatch3(initialBestScore: number = 0) {
  const saved = useMemo(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          parsed?.board &&
          Array.isArray(parsed.board) &&
          parsed.board.length === MATCH3_SIZE &&
          Array.isArray(parsed.board[0]) &&
          parsed.board[0].length === MATCH3_SIZE &&
          typeof parsed.score === 'number' &&
          typeof parsed.movesLeft === 'number'
        ) {
          return parsed;
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch (_) {}
    return null;
  }, []);

  const [board, setBoard] = useState<GemCell[][]>(() => saved?.board || createInitialBoard());
  const [score, setScore] = useState<number>(() => saved?.score || 0);
  const [bestScore, setBestScore] = useState<number>(initialBestScore);
  const [movesLeft, setMovesLeft] = useState<number>(() => saved?.movesLeft ?? INITIAL_MOVES);
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [selectedGem, setSelectedGem] = useState<Position | null>(null);
  const [clearingKeys, setClearingKeys] = useState<Set<string>>(new Set());
  const [lastScorePopup, setLastScorePopup] = useState<{ text: string; id: number } | null>(null);

  // Sync best score
  useEffect(() => {
    if (initialBestScore > bestScore) {
      setBestScore(initialBestScore);
    }
  }, [initialBestScore, bestScore]);

  // Persist state
  useEffect(() => {
    if (!isGameOver && movesLeft > 0) {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ board, score, movesLeft })
        );
      } catch (_) {}
    }
  }, [board, score, movesLeft, isGameOver]);

  // Restart game
  const restartGame = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
    setBoard(createInitialBoard());
    setScore(0);
    setMovesLeft(INITIAL_MOVES);
    setIsBusy(false);
    setIsGameOver(false);
    setSelectedGem(null);
    setClearingKeys(new Set());
    setLastScorePopup(null);
  }, []);

  // Early cash out / finish game
  const finishGameEarly = useCallback(() => {
    if (isGameOver || isBusy) return;
    setIsGameOver(true);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
  }, [isGameOver, isBusy]);

  // Cascade resolution loop
  const processCascades = useCallback(
    async (currentBoard: GemCell[][], currentScore: number, remainingMoves: number) => {
      let activeBoard = currentBoard;
      let totalGained = 0;
      let combo = 1;
      let currentMoves = remainingMoves;

      while (true) {
        const scan = scanMatches(activeBoard);
        if (scan.matchedCount === 0) break;

        setClearingKeys(scan.matchedKeys);
        if (combo > 1) {
          sound.playGemMatch(combo);
          haptics.medium();
        } else {
          sound.playGemMatch(1);
          haptics.light();
        }

        const points = scan.matchedCount * 30 * combo;
        totalGained += points;

        if (scan.matchedCount >= 4) {
          currentMoves += 1;
        }

        setLastScorePopup({
          text: combo > 1 ? `Каскад x${combo}! +${points}` : `+${points}`,
          id: Date.now(),
        });

        await new Promise((res) => setTimeout(res, 260));

        activeBoard = applyGravityAndRefill(activeBoard, scan.matchedKeys, scan.specialsCreated);
        setBoard(activeBoard);
        setClearingKeys(new Set());

        await new Promise((res) => setTimeout(res, 220));

        combo++;
      }

      if (!hasValidMoves(activeBoard)) {
        activeBoard = createInitialBoard();
        setBoard(activeBoard);
      }

      const newScore = currentScore + totalGained;
      setScore(newScore);
      setMovesLeft(currentMoves);
      if (newScore > bestScore) {
        setBestScore(newScore);
      }

      if (currentMoves <= 0) {
        setIsGameOver(true);
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch (_) {}
      }

      setIsBusy(false);
    },
    [bestScore]
  );

  // Attempt swap
  const trySwap = useCallback(
    async (p1: Position, p2: Position) => {
      if (isBusy || isGameOver) return;

      const dist = Math.abs(p1.row - p2.row) + Math.abs(p1.col - p2.col);
      if (dist !== 1) {
        setSelectedGem(p2);
        return;
      }

      setIsBusy(true);
      setSelectedGem(null);
      sound.playGemSwap();

      const swappedBoard = board.map((r) => [...r]);
      const temp = swappedBoard[p1.row][p1.col];
      swappedBoard[p1.row][p1.col] = swappedBoard[p2.row][p2.col];
      swappedBoard[p2.row][p2.col] = temp;

      setBoard(swappedBoard);

      const initialMatches = scanMatches(swappedBoard);

      if (initialMatches.matchedCount === 0) {
        haptics.warning();
        await new Promise((res) => setTimeout(res, 220));
        setBoard(board);
        setIsBusy(false);
        return;
      }

      const nextMoves = movesLeft - 1;
      setMovesLeft(nextMoves);
      await processCascades(swappedBoard, score, nextMoves);
    },
    [board, isBusy, isGameOver, movesLeft, score, processCascades]
  );

  // In-Game Booster: Add +5 extra moves (100 coins)
  const addExtraMoves = useCallback((count: number = 5) => {
    setMovesLeft((prev) => prev + count);
    setIsGameOver(false);
  }, []);

  // In-Game Booster: Color Bomb (150 coins)
  const triggerColorBomb = useCallback(async () => {
    if (isBusy || isGameOver) return false;
    setIsBusy(true);

    const counts: Record<number, number> = {};
    for (let r = 0; r < MATCH3_SIZE; r++) {
      for (let c = 0; c < MATCH3_SIZE; c++) {
        const t = board[r]?.[c]?.type;
        if (t !== undefined) {
          counts[t] = (counts[t] || 0) + 1;
        }
      }
    }
    let targetType = 0;
    let maxC = 0;
    Object.entries(counts).forEach(([t, count]) => {
      if (count > maxC) {
        maxC = count;
        targetType = Number(t);
      }
    });

    const clearing = new Set<string>();
    for (let r = 0; r < MATCH3_SIZE; r++) {
      for (let c = 0; c < MATCH3_SIZE; c++) {
        if (board[r]?.[c]?.type === targetType) {
          clearing.add(`${r},${c}`);
        }
      }
    }

    setClearingKeys(clearing);
    sound.playClear(4);
    haptics.heavy();
    await new Promise((res) => setTimeout(res, 300));

    const nextBoard = applyGravityAndRefill(board, clearing, []);
    setBoard(nextBoard);
    setClearingKeys(new Set());

    const gained = clearing.size * 35;
    const newScore = score + gained;
    setScore(newScore);
    if (newScore > bestScore) setBestScore(newScore);
    setLastScorePopup({ text: `+${gained} (Бомба!)`, id: Date.now() });

    await processCascades(nextBoard, newScore, movesLeft);
    return true;
  }, [board, isBusy, isGameOver, score, bestScore, movesLeft, processCascades]);

  return {
    board,
    score,
    bestScore,
    movesLeft,
    isBusy,
    isGameOver,
    selectedGem,
    clearingKeys,
    lastScorePopup,
    setSelectedGem,
    trySwap,
    finishGameEarly,
    restartGame,
    addExtraMoves,
    triggerColorBomb,
  };
}
