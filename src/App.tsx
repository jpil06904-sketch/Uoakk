import React, { useState, useEffect, useCallback } from 'react';
import { Chess } from 'chess.js';
import Board from './components/Board';
import { getBestMove } from './services/geminiService';
import { SavedGame, Difficulty } from './types';
import { 
  Save, RotateCcw, Play, Settings, 
  Cpu, Upload, FileDown, FileUp
} from 'lucide-react';

const App: React.FC = () => {
  // Game State
  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState(game.fen());
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [playerColor, setPlayerColor] = useState<'w' | 'b'>('w');
  const [orientation, setOrientation] = useState<'w' | 'b'>('w');
  
  // UI State
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [lastMove, setLastMove] = useState<{from: string, to: string} | null>(null);
  const [gameMessage, setGameMessage] = useState<string>('Welcome to Shaz (Shatranj)');
  const [aiThought, setAiThought] = useState<string>('');
  const [showMenu, setShowMenu] = useState(true);
  
  // --- Game Logic ---

  const makeMove = useCallback((move: { from: string; to: string; promotion?: string }) => {
    try {
      const result = game.move(move);
      if (result) {
        setFen(game.fen());
        setLastMove({ from: move.from, to: move.to });
        setSelectedSquare(null);
        checkGameState();
        return true;
      }
    } catch (e) {
      // Invalid move
      return false;
    }
    return false;
  }, [game]);

  const checkGameState = () => {
    if (game.isCheckmate()) {
      setGameMessage(`Checkmate! ${game.turn() === 'w' ? 'Black' : 'White'} wins.`);
    } else if (game.isDraw()) {
      setGameMessage("Game Draw!");
    } else if (game.inCheck()) {
      setGameMessage("Check!");
    } else {
      setGameMessage(game.turn() === playerColor ? "Your Turn" : "Gemini is thinking...");
    }
  };

  const handleUserMove = (from: string, to: string) => {
    if (game.turn() !== playerColor || isAiThinking || game.isGameOver()) return;

    // Check for promotion
    const piece = game.get(from as any);
    let promotion: string | undefined = undefined;
    if (piece?.type === 'p' && ((piece.color === 'w' && to[1] === '8') || (piece.color === 'b' && to[1] === '1'))) {
      promotion = 'q'; // Auto promote to queen for simplicity in this demo
    }

    const success = makeMove({ from, to, promotion });
    if (success) {
      // Trigger AI
      setTimeout(() => makeAiMove(), 500);
    }
  };

  const makeAiMove = async () => {
    if (game.isGameOver()) return;

    setIsAiThinking(true);
    setGameMessage("Gemini is analyzing position...");

    try {
      // Get all possible moves to help the AI validatio
      const possibleMoves = game.moves({ verbose: false }); // Get SAN moves
      const currentFen = game.fen();

      const { bestMove, thoughtProcess } = await getBestMove(currentFen, difficulty, possibleMoves);
      
      setAiThought(thoughtProcess);

      // Apply move
      // Gemini might return UCI (e2e4) or SAN (Nf3). chess.js move() handles both usually, but let's be safe.
      try {
        game.move(bestMove); // Try direct
      } catch {
        // Fallback for UCI string if SAN failed
        const from = bestMove.substring(0, 2);
        const to = bestMove.substring(2, 4);
        const promotion = bestMove.length > 4 ? bestMove.substring(4, 5) : undefined;
        game.move({ from, to, promotion });
      }

      setFen(game.fen());
      const history = game.history({ verbose: true });
      const last = history[history.length - 1];
      setLastMove({ from: last.from, to: last.to });
      checkGameState();

    } catch (e) {
      console.error(e);
      setGameMessage("AI failed to move. Try playing for it.");
    } finally {
      setIsAiThinking(false);
    }
  };

  // --- Save / Load / Download System ---

  const saveGameToBrowser = () => {
    const saveData: SavedGame = {
      fen: game.fen(),
      history: game.history(),
      date: new Date().toLocaleString(),
      difficulty
    };
    localStorage.setItem('shaz_saved_game', JSON.stringify(saveData));
    alert("Game Saved to Browser Storage!");
  };

  const loadGameFromBrowser = () => {
    const saved = localStorage.getItem('shaz_saved_game');
    if (saved) {
      const parsed: SavedGame = JSON.parse(saved);
      const newGame = new Chess(parsed.fen);
      setGame(newGame);
      setFen(parsed.fen);
      setDifficulty(parsed.difficulty);
      setGameMessage("Game Loaded. Resume play.");
      setShowMenu(false);
      setLastMove(null);
    } else {
      alert("No saved game found in browser.");
    }
  };

  const downloadPGN = () => {
    const pgn = game.pgn();
    if (!pgn && game.history().length === 0) {
        alert("No moves to download.");
        return;
    }
    const blob = new Blob([pgn], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shaz_game_${new Date().toISOString().slice(0, 10)}.pgn`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const resetGame = () => {
    const newGame = new Chess();
    setGame(newGame);
    setFen(newGame.fen());
    setLastMove(null);
    setGameMessage("New Game Started");
    setAiThought("");
    setShowMenu(false);
    if (playerColor === 'b') {
        setTimeout(makeAiMove, 500);
    }
  };

  const undoMove = () => {
    game.undo(); // Undo AI
    game.undo(); // Undo Player
    setFen(game.fen());
    setLastMove(null); // Lose history highlight
    checkGameState();
  };

  // --- Effects ---
  useEffect(() => {
    if (game.isGameOver()) {
        checkGameState();
    }
  }, [fen]);

  // --- Render Helpers ---

  if (showMenu) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-4 relative overflow-hidden">
        {/* Background Accents */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[100px]"></div>

        <div className="z-10 max-w-md w-full bg-slate-800/50 backdrop-blur-xl border border-slate-700 p-8 rounded-2xl shadow-2xl space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-5xl font-extrabold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              SHAZ
            </h1>
            <p className="text-slate-400 tracking-widest uppercase text-xs">AI Powered Shatranj</p>
          </div>

          <div className="space-y-4">
             <div className="space-y-2">
               <label className="text-sm font-medium text-slate-300">Difficulty</label>
               <div className="grid grid-cols-3 gap-2">
                 {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
                   <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`py-2 text-sm rounded-lg border transition-all ${difficulty === d ? 'bg-blue-600 border-blue-500 text-white' : 'border-slate-600 text-slate-400 hover:bg-slate-700'}`}
                   >
                     {d.charAt(0).toUpperCase() + d.slice(1)}
                   </button>
                 ))}
               </div>
             </div>

             <div className="space-y-2">
               <label className="text-sm font-medium text-slate-300">Play As</label>
               <div className="grid grid-cols-2 gap-2">
                 <button onClick={() => { setPlayerColor('w'); setOrientation('w'); }} className={`py-2 text-sm rounded-lg border ${playerColor === 'w' ? 'bg-slate-200 text-slate-900 border-white' : 'border-slate-600 text-slate-400'}`}>White</button>
                 <button onClick={() => { setPlayerColor('b'); setOrientation('b'); }} className={`py-2 text-sm rounded-lg border ${playerColor === 'b' ? 'bg-slate-900 text-slate-200 border-slate-500' : 'border-slate-600 text-slate-400'}`}>Black</button>
               </div>
             </div>
          </div>

          <div className="space-y-3 pt-4">
            <button 
              onClick={resetGame}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg transform transition active:scale-95 flex items-center justify-center gap-2"
            >
              <Play size={20} /> Start New Game
            </button>
            
            <button 
              onClick={loadGameFromBrowser}
              className="w-full py-3 bg-slate-700/50 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl border border-slate-600 transition flex items-center justify-center gap-2"
            >
              <Upload size={20} /> Load Saved Game
            </button>
          </div>

          <div className="text-center text-xs text-slate-500 pt-4">
            Powered by Gemini 2.5 Flash / Pro
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col md:flex-row items-center justify-center p-4 gap-6 relative overflow-hidden">
       {/* Background Accents */}
       <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-slate-950 -z-10"></div>

       {/* Left Panel: Info & Chat */}
       <div className="w-full max-w-md space-y-4 order-2 md:order-1">
          {/* Status Card */}
          <div className="bg-slate-800/60 backdrop-blur-md border border-slate-700 rounded-xl p-6 shadow-xl">
             <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Cpu size={20} className={isAiThinking ? "animate-pulse text-blue-400" : "text-slate-400"} />
                  {isAiThinking ? "Gemini Thinking..." : "Shaz Engine"}
                </h2>
                <span className={`px-2 py-1 rounded text-xs font-bold ${game.turn() === playerColor ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'}`}>
                  {game.turn() === 'w' ? 'White' : 'Black'} to Move
                </span>
             </div>
             
             <div className="bg-slate-900/50 rounded-lg p-4 min-h-[80px] border border-slate-700/50">
               <p className="text-slate-300 font-medium">{gameMessage}</p>
               {aiThought && (
                 <p className="text-slate-500 text-sm mt-2 italic border-l-2 border-blue-500 pl-2">
                   "{aiThought}"
                 </p>
               )}
             </div>
          </div>

          {/* Captured Pieces (Simplified) */}
          <div className="flex justify-between px-2 text-sm text-slate-400">
             <span>Playing as {playerColor === 'w' ? 'White' : 'Black'}</span>
             <span>{difficulty.toUpperCase()}</span>
          </div>
       </div>

       {/* Center: Board */}
       <div className="order-1 md:order-2 flex flex-col items-center gap-4">
          <div className="relative group">
            <Board 
              game={game} 
              onMove={handleUserMove} 
              orientation={orientation}
              highlightSquares={lastMove ? [lastMove.from, lastMove.to] : []}
              lastMove={lastMove}
              selectedSquare={selectedSquare}
              setSelectedSquare={setSelectedSquare}
            />
            {/* Thinking Overlay */}
            {isAiThinking && (
              <div className="absolute inset-0 z-10 bg-slate-900/10 backdrop-blur-[1px] rounded-lg flex items-center justify-center pointer-events-none">
                 <div className="w-full h-1 bg-blue-500/50 absolute top-0 animate-progress"></div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex gap-2 w-full max-w-[600px] justify-center">
            <button 
              onClick={undoMove} 
              disabled={isAiThinking || game.history().length === 0}
              className="p-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition disabled:opacity-50"
              title="Undo Move"
            >
              <RotateCcw size={20} />
            </button>
            <button 
              onClick={saveGameToBrowser}
              className="p-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-blue-400 transition disabled:opacity-50"
              title="Save to Browser"
            >
              <Save size={20} />
            </button>
            <button 
              onClick={downloadPGN}
              className="p-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-green-400 transition disabled:opacity-50"
              title="Download PGN File"
            >
              <FileDown size={20} />
            </button>
            <button 
              onClick={() => {
                 setOrientation(o => o === 'w' ? 'b' : 'w');
              }}
              className="p-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition"
              title="Flip Board"
            >
              <FileUp size={20} className="rotate-90" />
            </button>
            <button 
              onClick={() => setShowMenu(true)}
              className="p-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition ml-auto"
              title="Menu"
            >
              <Settings size={20} />
            </button>
          </div>
       </div>
    </div>
  );
};

export default App;