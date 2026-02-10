export type PieceColor = 'w' | 'b';
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

export interface Piece {
  type: PieceType;
  color: PieceColor;
}

export interface BoardSquare {
  square: string;
  type: PieceType;
  color: PieceColor;
}

export interface GameState {
  fen: string;
  history: string[];
  isGameOver: boolean;
  turn: PieceColor;
  winner: PieceColor | 'draw' | null;
  check: boolean;
  checkmate: boolean;
  draw: boolean;
}

export interface Move {
  from: string;
  to: string;
  promotion?: string;
}

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface SavedGame {
  fen: string;
  history: string[];
  date: string;
  difficulty: Difficulty;
}
