import React, { useMemo } from 'react';
import { PIECE_SVGS } from '../constants';
import { Chess } from 'chess.js';
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
  
  const board = game.board(); 
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

  const handleSquareClick = (square: string) => {
    if (selectedSquare) {
      try {
        if (selectedSquare === square) {
             setSelectedSquare(null);
             return;
        }
        onMove(selectedSquare, square);
        setSelectedSquare(null);
      } catch (e) {
        const piece = game.get(square as any);
        if (piece && piece.color === game.turn()) {
            setSelectedSquare(square);
        } else {
            setSelectedSquare(null);
        }
      }
    } else {
      const piece = game.get(square as any);
      if (piece && piece.color === game.turn()) {
        setSelectedSquare(square);
      }
    }
  };

  const isLightSquare = (fileIndex: number, rankIndex: number) => {
    return (fileIndex + rankIndex) % 2 === 0;
  };

  const possibleMoves = useMemo(() => {
    if (!selectedSquare) return [];
    return game.moves({ square: selectedSquare as any, verbose: true }).map((m: any) => m.to);
  }, [selectedSquare, game.fen()]);

  const renderedRanks = orientation === 'w' ? ranks : [...ranks].reverse();
  const renderedFiles = orientation === 'w' ? files : [...files].reverse();

  return (
    <div className="grid grid-cols-8 gap-0 border-4 border-slate-700 rounded-lg overflow-hidden shadow-2xl w-full max-w-[600px] aspect-square select-none">
      {renderedRanks.map((rank, rIdx) => 
        renderedFiles.map((file, fIdx) => {
          const square = `${file}${rank}`;
          const actualRankIndex = ranks.indexOf(rank);
          const actualFileIndex = files.indexOf(file);
          
          const piece = board[actualRankIndex][actualFileIndex];
          const isLight = isLightSquare(actualFileIndex, actualRankIndex);
          const isSelected = selectedSquare === square;
          const isLastMoveFrom = lastMove?.from === square;
          const isLastMoveTo = lastMove?.to === square;
          const isPossibleMove = possibleMoves.includes(square);
          
          const isKingInCheck = piece?.type === 'k' && piece?.color === game.turn() && game.inCheck();

          let bgClass = isLight ? 'bg-[#ebecd0]' : 'bg-[#779556]';
          
          if (isSelected) bgClass = 'bg-[#f6f669]'; 
          else if (isLastMoveFrom || isLastMoveTo) bgClass = 'bg-[#bacb46]'; 
          else if (isKingInCheck) bgClass = 'bg-red-500 radial-gradient';
          
          return (
            <div
              key={square}
              onClick={() => handleSquareClick(square)}
              className={`relative flex items-center justify-center cursor-pointer ${bgClass} transition-colors duration-100`}
            >
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

              {isPossibleMove && !piece && (
                 <div className="absolute w-3 h-3 bg-black/20 rounded-full"></div>
              )}
              {isPossibleMove && piece && (
                 <div className="absolute w-full h-full border-4 border-black/10 rounded-full"></div>
              )}

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