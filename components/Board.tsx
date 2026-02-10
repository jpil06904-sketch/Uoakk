import React, { useMemo } from 'react';
import { PIECE_SVGS } from '../constants';
import { Chess } from 'https://esm.sh/chess.js@1.0.0-beta.8';
import { PieceColor } from '../types';

interface BoardProps {
  game: Chess;
  onMove: (from: string, to: string) => void;
  orientation: PieceColor;
  highlightSquares?: string[];
  lastMove?: { from: string; to: string } | null;
  selectedSquare: string | null;
  setSelectedSquare: (square: string | null) => void;
}

const Board: React.FC<BoardProps> = ({ 
  game, 
  onMove, 
  orientation, 
  lastMove,
  selectedSquare,
  setSelectedSquare
}) => {
  
  const board = game.board(); // 8x8 array of { type, color } | null
  
  // Flatten board for rendering but keep track of coordinates
  // chess.js board[0][0] is a8.
  
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

  const handleSquareClick = (square: string) => {
    // If a square is already selected
    if (selectedSquare) {
      // Try to move
      try {
        // Simple check if it's a move attempt
        // We let the parent handle the actual move logic validation via chess.js
        if (selectedSquare === square) {
             setSelectedSquare(null);
             return;
        }
        
        onMove(selectedSquare, square);
        setSelectedSquare(null);
      } catch (e) {
        // Invalid move, select the new square if it has a piece of our color
        const piece = game.get(square as any);
        if (piece && piece.color === game.turn()) {
            setSelectedSquare(square);
        } else {
            setSelectedSquare(null);
        }
      }
    } else {
      // Select piece
      const piece = game.get(square as any);
      if (piece && piece.color === game.turn()) {
        setSelectedSquare(square);
      }
    }
  };

  const isLightSquare = (fileIndex: number, rankIndex: number) => {
    return (fileIndex + rankIndex) % 2 === 0;
  };

  // Valid moves from selected square for highlighting
  const possibleMoves = useMemo(() => {
    if (!selectedSquare) return [];
    return game.moves({ square: selectedSquare as any, verbose: true }).map((m: any) => m.to);
  }, [selectedSquare, game.fen()]);

  // Adjust board rendering based on orientation
  // If we are black, we need to reverse the rendering order visually
  const renderedRanks = orientation === 'w' ? ranks : [...ranks].reverse();
  const renderedFiles = orientation === 'w' ? files : [...files].reverse();

  return (
    <div className="grid grid-cols-8 gap-0 border-4 border-slate-700 rounded-lg overflow-hidden shadow-2xl w-full max-w-[600px] aspect-square select-none">
      {renderedRanks.map((rank, rIdx) => 
        renderedFiles.map((file, fIdx) => {
          const square = `${file}${rank}`;
          // Correct mapping from visual coordinates to board array
          // Board array is always rank 8 to 1 (0 to 7)
          const actualRankIndex = ranks.indexOf(rank);
          const actualFileIndex = files.indexOf(file);
          
          const piece = board[actualRankIndex][actualFileIndex];
          const isLight = isLightSquare(actualFileIndex, actualRankIndex);
          const isSelected = selectedSquare === square;
          const isLastMoveFrom = lastMove?.from === square;
          const isLastMoveTo = lastMove?.to === square;
          const isPossibleMove = possibleMoves.includes(square);
          
          // Check for check
          const isKingInCheck = piece?.type === 'k' && piece?.color === game.turn() && game.inCheck();

          let bgClass = isLight ? 'bg-[#ebecd0]' : 'bg-[#779556]';
          
          if (isSelected) bgClass = 'bg-[#f6f669]'; // Yellow for selected
          else if (isLastMoveFrom || isLastMoveTo) bgClass = 'bg-[#bacb46]'; // Highlight last move
          else if (isKingInCheck) bgClass = 'bg-red-500 radial-gradient'; // Red for check
          
          return (
            <div
              key={square}
              onClick={() => handleSquareClick(square)}
              className={`relative flex items-center justify-center cursor-pointer ${bgClass} transition-colors duration-100`}
            >
              {/* Coordinate Labels */}
              {(orientation === 'w' ? rIdx === 7 : rIdx === 0) && (
                 <span className={`absolute bottom-0.5 right-1 text-[10px] font-bold ${isLight ? 'text-[#779556]' : 'text-[#ebecd0]'}`}>
                   {file}
                 </span>
              )}
              {(orientation === 'w' ? fIdx === 0 : fIdx === 7) && (
                 <span className={`absolute top-0.5 left-1 text-[10px] font-bold ${isLight ? 'text-[#779556]' : 'text-[#ebecd0]'}`}>
                   {rank}
                 </span>
              )}

              {/* Move Indicator Dot */}
              {isPossibleMove && !piece && (
                 <div className="absolute w-3 h-3 bg-black/20 rounded-full"></div>
              )}
              {isPossibleMove && piece && (
                 <div className="absolute w-full h-full border-4 border-black/10 rounded-full"></div>
              )}

              {/* Piece */}
              {piece && (
                <div className="w-[85%] h-[85%] pointer-events-none drop-shadow-lg transform hover:scale-105 transition-transform">
                  {PIECE_SVGS[`${piece.color}${piece.type.toUpperCase()}`]}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};

export default Board;
