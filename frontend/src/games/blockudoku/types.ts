export type GridCell = number; // 0 = empty, >0 = color index

export interface Shape {
  id: string;
  name: string;
  matrix: number[][]; // 2D array of 0 and 1
  colorClass: string;
  glowClass: string;
  accentColor: string;
}

export interface DragState {
  piece: Shape;
  pieceIndex: number;
  x: number;
  y: number;
  targetRow: number | null;
  targetCol: number | null;
  canDrop: boolean;
}

export interface ClearedArea {
  rows: number[];
  cols: number[];
  boxes: number[]; // index 0..8
}
