export type Direction = 'up' | 'down' | 'left' | 'right';

export type BoardMatrix = number[][]; // 4x4 matrix

export interface MoveResult {
  board: BoardMatrix;
  scoreGained: number;
  moved: boolean;
  maxMergedValue: number;
}
