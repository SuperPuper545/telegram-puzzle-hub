export type DuelGameType = 'chess' | 'durak' | 'battleship';

export interface Card {
  rank: '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
  suit: 's' | 'h' | 'd' | 'c';
}

export interface TableSlot {
  attack: Card;
  defense: Card | null;
}

export interface ShipCell {
  r: number;
  c: number;
}

export interface Ship {
  id: number;
  size: number;
  cells: ShipCell[];
  horizontal: boolean;
  sunk?: boolean;
}

export interface ShotCell {
  r: number;
  c: number;
  hit: boolean;
}

export interface DuelOpponent {
  userId: number;
  firstName: string;
  username: string | null;
}

export interface GameOverPayload {
  game: string;
  reason: string;
  winnerUserId: number | null;
  winnerColor?: string;
  isDraw?: boolean;
  payout: number;
  commission: number;
}
