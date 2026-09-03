export type SpecialType = 'none' | 'line_h' | 'line_v' | 'hypercube';

export interface GemCell {
  id: string;
  type: number; // 0..4
  special: SpecialType;
  isClearing?: boolean;
}

export interface Position {
  row: number;
  col: number;
}

export interface MatchResult {
  matchedCells: Position[];
  scoreGained: number;
  clearedCount: number;
  specialsCreated: { pos: Position; special: SpecialType; gemType: number }[];
}

export interface GemDefinition {
  name: string;
  color: string;
  gradient: string;
  glow: string;
  border: string;
  icon: string;
}
