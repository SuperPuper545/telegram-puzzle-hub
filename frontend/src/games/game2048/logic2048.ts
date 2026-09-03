import type { BoardMatrix, Direction, MoveResult } from './types';

export const BOARD_SIZE = 4;

export function createEmptyBoard(): BoardMatrix {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
}

// Spawn a 2 (90%) or 4 (10%) in a random empty cell
export function spawnRandomTile(board: BoardMatrix): BoardMatrix {
  const emptyCells: { r: number; c: number }[] = [];

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === 0) {
        emptyCells.push({ r, c });
      }
    }
  }

  if (emptyCells.length === 0) return board;

  const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  const value = Math.random() < 0.9 ? 2 : 4;

  const newBoard = board.map((row) => [...row]);
  newBoard[randomCell.r][randomCell.c] = value;
  return newBoard;
}

export function createInitialBoard(): BoardMatrix {
  let b = createEmptyBoard();
  b = spawnRandomTile(b);
  b = spawnRandomTile(b);
  return b;
}

// Slide and merge a single 1D row to the left
function slideAndMergeRow(row: number[]): { newRow: number[]; score: number; maxMerged: number } {
  // 1. Filter out zeros
  const nonZero = row.filter((v) => v !== 0);
  const newRow: number[] = [];
  let score = 0;
  let maxMerged = 0;

  let i = 0;
  while (i < nonZero.length) {
    if (i < nonZero.length - 1 && nonZero[i] === nonZero[i + 1]) {
      const mergedVal = nonZero[i] * 2;
      newRow.push(mergedVal);
      score += mergedVal;
      if (mergedVal > maxMerged) maxMerged = mergedVal;
      i += 2; // Skip next
    } else {
      newRow.push(nonZero[i]);
      i += 1;
    }
  }

  // Pad back with zeros
  while (newRow.length < BOARD_SIZE) {
    newRow.push(0);
  }

  return { newRow, score, maxMerged };
}

// Matrix helper rotations
function rotateClockwise(m: BoardMatrix): BoardMatrix {
  const res: BoardMatrix = createEmptyBoard();
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      res[c][BOARD_SIZE - 1 - r] = m[r][c];
    }
  }
  return res;
}

function rotateCounterClockwise(m: BoardMatrix): BoardMatrix {
  const res: BoardMatrix = createEmptyBoard();
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      res[BOARD_SIZE - 1 - c][r] = m[r][c];
    }
  }
  return res;
}

function flipHorizontal(m: BoardMatrix): BoardMatrix {
  return m.map((row) => [...row].reverse());
}

// Execute move in any of the 4 directions
export function executeMove(board: BoardMatrix, dir: Direction): MoveResult {
  let workingBoard: BoardMatrix;

  // Orient matrix so we always slide to the left
  if (dir === 'left') {
    workingBoard = board.map((r) => [...r]);
  } else if (dir === 'right') {
    workingBoard = flipHorizontal(board);
  } else if (dir === 'up') {
    workingBoard = rotateCounterClockwise(board);
  } else {
    // down
    workingBoard = rotateClockwise(board);
  }

  // Slide rows
  let totalScore = 0;
  let maxMergedValue = 0;
  const slidBoard: BoardMatrix = [];

  for (let r = 0; r < BOARD_SIZE; r++) {
    const { newRow, score, maxMerged } = slideAndMergeRow(workingBoard[r]);
    slidBoard.push(newRow);
    totalScore += score;
    if (maxMerged > maxMergedValue) maxMergedValue = maxMerged;
  }

  // Restore original orientation
  let finalBoard: BoardMatrix;
  if (dir === 'left') {
    finalBoard = slidBoard;
  } else if (dir === 'right') {
    finalBoard = flipHorizontal(slidBoard);
  } else if (dir === 'up') {
    finalBoard = rotateClockwise(slidBoard);
  } else {
    // down
    finalBoard = rotateCounterClockwise(slidBoard);
  }

  // Check if anything moved
  let moved = false;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (finalBoard[r][c] !== board[r][c]) {
        moved = true;
        break;
      }
    }
    if (moved) break;
  }

  return {
    board: finalBoard,
    scoreGained: totalScore,
    moved,
    maxMergedValue,
  };
}

// Check if any move is possible
export function canMove(board: BoardMatrix): boolean {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === 0) return true;
      if (c < BOARD_SIZE - 1 && board[r][c] === board[r][c + 1]) return true;
      if (r < BOARD_SIZE - 1 && board[r][c] === board[r + 1][c]) return true;
    }
  }
  return false;
}

export function has2048Tile(board: BoardMatrix): boolean {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] >= 2048) return true;
    }
  }
  return false;
}
