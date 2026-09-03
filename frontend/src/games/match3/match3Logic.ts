import type { GemCell, SpecialType } from './types';
import { GEM_TYPES_COUNT } from './gemData';

export const MATCH3_SIZE = 7;

let nextGemId = 1;

export function createRandomGem(type?: number, special: SpecialType = 'none'): GemCell {
  return {
    id: `gem-${nextGemId++}`,
    type: type !== undefined ? type : Math.floor(Math.random() * GEM_TYPES_COUNT),
    special,
  };
}

// Generate initial 8x8 board without any existing 3-in-a-row
export function createInitialBoard(): GemCell[][] {
  const board: GemCell[][] = [];

  for (let r = 0; r < MATCH3_SIZE; r++) {
    board[r] = [];
    for (let c = 0; c < MATCH3_SIZE; c++) {
      let type: number;
      do {
        type = Math.floor(Math.random() * GEM_TYPES_COUNT);
      } while (
        (c >= 2 && board[r][c - 1]?.type === type && board[r][c - 2]?.type === type) ||
        (r >= 2 && board[r - 1][c]?.type === type && board[r - 2][c]?.type === type)
      );

      board[r][c] = createRandomGem(type);
    }
  }

  if (!hasValidMoves(board)) {
    return createInitialBoard();
  }

  return board;
}

export interface MatchScanResult {
  matchedKeys: Set<string>;
  specialsCreated: { row: number; col: number; special: SpecialType; gemType: number }[];
  matchedCount: number;
}

export function scanMatches(board: GemCell[][]): MatchScanResult {
  const matchedKeys = new Set<string>();
  const specialsCreated: { row: number; col: number; special: SpecialType; gemType: number }[] = [];

  // Horizontal matches
  for (let r = 0; r < MATCH3_SIZE; r++) {
    let matchLen = 1;
    for (let c = 0; c < MATCH3_SIZE; c++) {
      const isLast = c === MATCH3_SIZE - 1;
      const current = board[r][c];
      const next = !isLast ? board[r][c + 1] : null;

      if (!isLast && current && next && current.type === next.type) {
        matchLen++;
      } else {
        if (matchLen >= 3 && current) {
          const startCol = c - matchLen + 1;
          for (let i = 0; i < matchLen; i++) {
            matchedKeys.add(`${r},${startCol + i}`);
          }

          if (matchLen === 4) {
            specialsCreated.push({
              row: r,
              col: startCol + 1,
              special: 'line_h',
              gemType: current.type,
            });
          } else if (matchLen >= 5) {
            specialsCreated.push({
              row: r,
              col: startCol + 2,
              special: 'hypercube',
              gemType: current.type,
            });
          }
        }
        matchLen = 1;
      }
    }
  }

  // Vertical matches
  for (let c = 0; c < MATCH3_SIZE; c++) {
    let matchLen = 1;
    for (let r = 0; r < MATCH3_SIZE; r++) {
      const isLast = r === MATCH3_SIZE - 1;
      const current = board[r][c];
      const next = !isLast ? board[r + 1][c] : null;

      if (!isLast && current && next && current.type === next.type) {
        matchLen++;
      } else {
        if (matchLen >= 3 && current) {
          const startRow = r - matchLen + 1;
          for (let i = 0; i < matchLen; i++) {
            matchedKeys.add(`${startRow + i},${c}`);
          }

          if (matchLen === 4) {
            specialsCreated.push({
              row: startRow + 1,
              col: c,
              special: 'line_v',
              gemType: current.type,
            });
          } else if (matchLen >= 5) {
            specialsCreated.push({
              row: startRow + 2,
              col: c,
              special: 'hypercube',
              gemType: current.type,
            });
          }
        }
        matchLen = 1;
      }
    }
  }

  // Trigger specials that got matched
  const expandedKeys = new Set<string>(matchedKeys);
  matchedKeys.forEach((key) => {
    const [r, c] = key.split(',').map(Number);
    const gem = board[r]?.[c];
    if (!gem) return;

    if (gem.special === 'line_h') {
      for (let col = 0; col < MATCH3_SIZE; col++) expandedKeys.add(`${r},${col}`);
    } else if (gem.special === 'line_v') {
      for (let row = 0; row < MATCH3_SIZE; row++) expandedKeys.add(`${row},${c}`);
    } else if (gem.special === 'hypercube') {
      for (let row = 0; row < MATCH3_SIZE; row++) {
        for (let col = 0; col < MATCH3_SIZE; col++) {
          if (board[row][col]?.type === gem.type) {
            expandedKeys.add(`${row},${col}`);
          }
        }
      }
    }
  });

  return {
    matchedKeys: expandedKeys,
    specialsCreated,
    matchedCount: expandedKeys.size,
  };
}

export function applyGravityAndRefill(
  board: GemCell[][],
  matchedKeys: Set<string>,
  specialsCreated: { row: number; col: number; special: SpecialType; gemType: number }[]
): GemCell[][] {
  const newBoard: (GemCell | null)[][] = board.map((row) => [...row]);

  // Clear matched cells
  matchedKeys.forEach((key) => {
    const [r, c] = key.split(',').map(Number);
    newBoard[r][c] = null;
  });

  // Spawn special gems
  specialsCreated.forEach(({ row, col, special, gemType }) => {
    newBoard[row][col] = createRandomGem(gemType, special);
  });

  // Collapse downward
  for (let c = 0; c < MATCH3_SIZE; c++) {
    let emptyRow = MATCH3_SIZE - 1;
    for (let r = MATCH3_SIZE - 1; r >= 0; r--) {
      if (newBoard[r][c] !== null) {
        if (r !== emptyRow) {
          newBoard[emptyRow][c] = newBoard[r][c];
          newBoard[r][c] = null;
        }
        emptyRow--;
      }
    }

    for (let r = emptyRow; r >= 0; r--) {
      newBoard[r][c] = createRandomGem();
    }
  }

  return newBoard as GemCell[][];
}

export function hasValidMoves(board: GemCell[][]): boolean {
  for (let r = 0; r < MATCH3_SIZE; r++) {
    for (let c = 0; c < MATCH3_SIZE; c++) {
      if (c < MATCH3_SIZE - 1) {
        swap(board, r, c, r, c + 1);
        const matches = scanMatches(board);
        swap(board, r, c, r, c + 1);
        if (matches.matchedCount > 0) return true;
      }
      if (r < MATCH3_SIZE - 1) {
        swap(board, r, c, r + 1, c);
        const matches = scanMatches(board);
        swap(board, r, c, r + 1, c);
        if (matches.matchedCount > 0) return true;
      }
    }
  }
  return false;
}

function swap(board: GemCell[][], r1: number, c1: number, r2: number, c2: number) {
  const temp = board[r1][c1];
  board[r1][c1] = board[r2][c2];
  board[r2][c2] = temp;
}
