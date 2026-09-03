// Pure TypeScript chess engine — no external deps
// Board: 0=empty, pieces coded as strings like 'wK','bQ','wp','bR' etc.

export type PieceColor = 'w' | 'b';
export type PieceType = 'K' | 'Q' | 'R' | 'B' | 'N' | 'p';
export type Square = string; // e.g. 'e4'
export interface Piece { color: PieceColor; type: PieceType }
export interface Move { from: Square; to: Square; promotion?: PieceType; isCapture?: boolean; isCastle?: boolean; isEnPassant?: boolean }

export type Board = (Piece | null)[][];

export interface GameState {
  board: Board;
  turn: PieceColor;
  castling: { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean };
  enPassant: Square | null;
  halfMove: number;
  fullMove: number;
}

const FILES = 'abcdefgh';

export function sqToRC(sq: Square): [number, number] {
  const f = FILES.indexOf(sq[0]), r = parseInt(sq[1]) - 1;
  return [7 - r, f];
}
export function rcToSq(r: number, c: number): Square {
  return FILES[c] + (8 - r);
}

export function parseFen(fen: string): GameState {
  const [pos, turn, castling, ep, hm, fm] = fen.split(' ');
  const board: Board = Array(8).fill(null).map(() => Array(8).fill(null));
  const rows = pos.split('/');
  for (let r = 0; r < 8; r++) {
    let c = 0;
    for (const ch of rows[r]) {
      if (/\d/.test(ch)) { c += parseInt(ch); }
      else {
        const color: PieceColor = ch === ch.toUpperCase() ? 'w' : 'b';
        const type = ch.toUpperCase() as PieceType;
        board[r][c] = { color, type };
        c++;
      }
    }
  }
  return {
    board,
    turn: turn as PieceColor,
    castling: { wK: castling.includes('K'), wQ: castling.includes('Q'), bK: castling.includes('k'), bQ: castling.includes('q') },
    enPassant: ep === '-' ? null : ep,
    halfMove: parseInt(hm) || 0,
    fullMove: parseInt(fm) || 1,
  };
}

export function boardToFen(state: GameState): string {
  let pos = '';
  for (let r = 0; r < 8; r++) {
    let empty = 0;
    for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p) { empty++; }
      else {
        if (empty) { pos += empty; empty = 0; }
        pos += p.color === 'w' ? p.type : p.type.toLowerCase();
      }
    }
    if (empty) pos += empty;
    if (r < 7) pos += '/';
  }
  const cast = [state.castling.wK ? 'K' : '', state.castling.wQ ? 'Q' : '', state.castling.bK ? 'k' : '', state.castling.bQ ? 'q' : ''].join('') || '-';
  return `${pos} ${state.turn} ${cast} ${state.enPassant || '-'} ${state.halfMove} ${state.fullMove}`;
}

function inBounds(r: number, c: number) { return r >= 0 && r < 8 && c >= 0 && c < 8; }

function pseudoMoves(state: GameState, r: number, c: number): Array<[number, number]> {
  const p = state.board[r][c];
  if (!p) return [];
  const moves: Array<[number, number]> = [];
  const { color, type } = p;
  const dirs: Record<string, [number,number][]> = {
    R: [[0,1],[0,-1],[1,0],[-1,0]],
    B: [[1,1],[1,-1],[-1,1],[-1,-1]],
    Q: [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]],
    K: [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]],
    N: [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]],
  };
  if (type === 'p') {
    const dir = color === 'w' ? -1 : 1;
    const startRow = color === 'w' ? 6 : 1;
    // Forward
    if (inBounds(r + dir, c) && !state.board[r + dir][c]) {
      moves.push([r + dir, c]);
      if (r === startRow && !state.board[r + 2 * dir][c]) moves.push([r + 2 * dir, c]);
    }
    // Captures
    for (const dc of [-1, 1]) {
      const nr = r + dir, nc = c + dc;
      if (!inBounds(nr, nc)) continue;
      const target = state.board[nr][nc];
      if (target && target.color !== color) moves.push([nr, nc]);
      // En passant
      if (state.enPassant) {
        const [epr, epc] = sqToRC(state.enPassant);
        if (nr === epr && nc === epc) moves.push([nr, nc]);
      }
    }
  } else if (type === 'N') {
    for (const [dr, dc] of dirs.N) {
      const nr = r + dr, nc = c + dc;
      if (!inBounds(nr, nc)) continue;
      if (!state.board[nr][nc] || state.board[nr][nc]!.color !== color) moves.push([nr, nc]);
    }
  } else if (type === 'K') {
    for (const [dr, dc] of dirs.K) {
      const nr = r + dr, nc = c + dc;
      if (!inBounds(nr, nc)) continue;
      if (!state.board[nr][nc] || state.board[nr][nc]!.color !== color) moves.push([nr, nc]);
    }
    // Castling
    const row = color === 'w' ? 7 : 0;
    if (r === row && c === 4) {
      if ((color === 'w' ? state.castling.wK : state.castling.bK) && !state.board[row][5] && !state.board[row][6]) moves.push([row, 6]);
      if ((color === 'w' ? state.castling.wQ : state.castling.bQ) && !state.board[row][3] && !state.board[row][2] && !state.board[row][1]) moves.push([row, 2]);
    }
  } else {
    const slideTypes = type === 'Q' ? dirs.Q : type === 'R' ? dirs.R : dirs.B;
    for (const [dr, dc] of slideTypes) {
      let nr = r + dr, nc = c + dc;
      while (inBounds(nr, nc)) {
        const target = state.board[nr][nc];
        if (!target) { moves.push([nr, nc]); }
        else { if (target.color !== color) moves.push([nr, nc]); break; }
        nr += dr; nc += dc;
      }
    }
  }
  return moves;
}

function findKing(board: Board, color: PieceColor): [number, number] {
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = board[r][c]; if (p?.color === color && p.type === 'K') return [r, c];
  }
  return [-1, -1];
}

function isAttacked(state: GameState, r: number, c: number, by: PieceColor): boolean {
  for (let pr = 0; pr < 8; pr++) for (let pc = 0; pc < 8; pc++) {
    const p = state.board[pr][pc]; if (!p || p.color !== by) continue;
    const ms = pseudoMoves(state, pr, pc);
    if (ms.some(([mr, mc]) => mr === r && mc === c)) return true;
  }
  return false;
}

function applyMove(state: GameState, from: Square, to: Square, promotion?: PieceType): GameState {
  const [fr, fc] = sqToRC(from), [tr, tc] = sqToRC(to);
  const newBoard: Board = state.board.map(row => [...row]);
  const piece = newBoard[fr][fc]!;
  const newCastling = { ...state.castling };
  let newEp: Square | null = null;
  let newHm = state.halfMove + 1;

  // En passant capture
  if (piece.type === 'p' && state.enPassant === to) {
    const [epr] = sqToRC(to);
    const epCaptureRow = piece.color === 'w' ? epr + 1 : epr - 1;
    newBoard[epCaptureRow][tc] = null;
  }

  // Castle: move rook too
  if (piece.type === 'K') {
    newCastling[piece.color === 'w' ? 'wK' : 'bK'] = false;
    newCastling[piece.color === 'w' ? 'wQ' : 'bQ'] = false;
    if (Math.abs(tc - fc) === 2) {
      if (tc === 6) { newBoard[fr][5] = newBoard[fr][7]; newBoard[fr][7] = null; }
      if (tc === 2) { newBoard[fr][3] = newBoard[fr][0]; newBoard[fr][0] = null; }
    }
  }

  if (piece.type === 'R') {
    if (fr === 7 && fc === 0) newCastling.wQ = false;
    if (fr === 7 && fc === 7) newCastling.wK = false;
    if (fr === 0 && fc === 0) newCastling.bQ = false;
    if (fr === 0 && fc === 7) newCastling.bK = false;
  }

  if (newBoard[tr][tc]) newHm = 0;
  if (piece.type === 'p') {
    newHm = 0;
    if (Math.abs(tr - fr) === 2) newEp = rcToSq(fr + (piece.color === 'w' ? -1 : 1), fc);
  }

  newBoard[tr][tc] = promotion ? { color: piece.color, type: promotion } : piece;
  newBoard[fr][fc] = null;

  return {
    board: newBoard,
    turn: state.turn === 'w' ? 'b' : 'w',
    castling: newCastling,
    enPassant: newEp,
    halfMove: newHm,
    fullMove: state.turn === 'b' ? state.fullMove + 1 : state.fullMove,
  };
}

export function isInCheck(state: GameState, color: PieceColor): boolean {
  const [kr, kc] = findKing(state.board, color);
  if (kr === -1) return false;
  return isAttacked(state, kr, kc, color === 'w' ? 'b' : 'w');
}

export function getLegalMoves(state: GameState, fromSq: Square): Move[] {
  const [fr, fc] = sqToRC(fromSq);
  const piece = state.board[fr][fc];
  if (!piece || piece.color !== state.turn) return [];
  const pseudo = pseudoMoves(state, fr, fc);
  const legal: Move[] = [];
  for (const [tr, tc] of pseudo) {
    const toSq = rcToSq(tr, tc);
    const promotions: (PieceType | undefined)[] = piece.type === 'p' && (tr === 0 || tr === 7) ? ['Q','R','B','N'] : [undefined];
    for (const promo of promotions) {
      const next = applyMove(state, fromSq, toSq, promo);
      if (!isInCheck(next, piece.color)) {
        legal.push({
          from: fromSq, to: toSq, promotion: promo,
          isCapture: !!state.board[tr][tc] || (piece.type === 'p' && state.enPassant === toSq),
          isCastle: piece.type === 'K' && Math.abs(tc - fc) === 2,
          isEnPassant: piece.type === 'p' && state.enPassant === toSq,
        });
      }
    }
  }
  return legal;
}

export function getAllLegalMoves(state: GameState): Move[] {
  const moves: Move[] = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = state.board[r][c];
    if (p?.color === state.turn) moves.push(...getLegalMoves(state, rcToSq(r, c)));
  }
  return moves;
}

export type GameStatus = 'active' | 'check' | 'checkmate' | 'stalemate' | 'draw';

export function getGameStatus(state: GameState): GameStatus {
  const allMoves = getAllLegalMoves(state);
  const inCheck = isInCheck(state, state.turn);
  if (allMoves.length === 0) return inCheck ? 'checkmate' : 'stalemate';
  if (state.halfMove >= 100) return 'draw';
  if (inCheck) return 'check';
  return 'active';
}

export function makeMove(state: GameState, from: Square, to: Square, promotion?: PieceType): { state: GameState; status: GameStatus } {
  const newState = applyMove(state, from, to, promotion);
  const status = getGameStatus(newState);
  return { state: newState, status };
}