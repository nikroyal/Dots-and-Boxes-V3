import { useState, useEffect, useRef } from 'react';
import { sfx } from '../lib/sound';

export default function TicTacToeSimple() {
  const [board, setBoard] = useState(Array(9).fill(null));
  const [xIsNext, setXIsNext] = useState(true);
  const [gameState, setGameState] = useState('playing'); // 'playing' | 'won' | 'draw'
  const [winner, setWinner] = useState(null);
  const [winningLine, setWinningLine] = useState([]);

  const [copied, setCopied] = useState(false);
  const shareTimeoutRef = useRef(null);

  const calculateWinner = (squares) => {
    const lines = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6],
    ];
    for (let i = 0; i < lines.length; i++) {
      const [a, b, c] = lines[i];
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
        return { winner: squares[a], line: lines[i] };
      }
    }
    return null;
  };

  const handleClick = (i) => {
    if (gameState !== 'playing' || board[i]) {
      return;
    }

    sfx.piece();
    const newBoard = board.slice();
    newBoard[i] = xIsNext ? 'X' : 'O';
    setBoard(newBoard);
    setXIsNext(!xIsNext);

    const winInfo = calculateWinner(newBoard);
    if (winInfo) {
      sfx.win();
      setGameState('won');
      setWinner(winInfo.winner);
      setWinningLine(winInfo.line);
    } else if (!newBoard.includes(null)) {
      sfx.notify();
      setGameState('draw');
    }
  };

  const resetGame = () => {
    sfx.click();
    setBoard(Array(9).fill(null));
    setXIsNext(true);
    setGameState('playing');
    setWinner(null);
    setWinningLine([]);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((gameState === 'won' || gameState === 'draw') && e.key === 'Enter') {
        if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A' || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        e.preventDefault();
        resetGame();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  useEffect(() => {
    return () => {
      if (shareTimeoutRef.current) clearTimeout(shareTimeoutRef.current);
    };
  }, []);

  const handleShare = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const text = `I just played a match of Tic-Tac-Toe Simple! ❌⭕`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        sfx.notify();
        setCopied(true);
        if (shareTimeoutRef.current) clearTimeout(shareTimeoutRef.current);
        shareTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
      }).catch(err => console.warn("Clipboard copy failed", err));
    } else {
      console.warn("Clipboard API not supported");
    }
  };

  return (
    <div className="fade-in max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh] px-4">
      <section className="text-center mb-8">
        <h1 className="font-display text-5xl font-medium tracking-tight mb-2">Tic-Tac-Toe Simple</h1>
        <p className="font-mono text-sm tracking-widest uppercase opacity-60 mb-2">
          Local 2-Player Match
        </p>
      </section>

      <div className="w-full max-w-sm border hairline card bg-[var(--paper-tint)] p-6 sm:p-10 flex flex-col items-center relative">
        <div className="mb-6 font-display text-2xl h-8 flex items-center justify-center text-center w-full">
          {gameState === 'playing' ? (
            <span>Next player: <span className={`font-bold ${xIsNext ? 'text-[var(--crimson)]' : 'text-[var(--ochre)]'}`}>{xIsNext ? 'X' : 'O'}</span></span>
          ) : gameState === 'won' ? (
            <span className="text-[var(--forest)] pulse-soft font-bold">Winner: {winner}</span>
          ) : (
             <span className="opacity-80">Draw!</span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 w-full aspect-square mb-8">
          {board.map((square, i) => {
            const isWinningSquare = winningLine.includes(i);
            return (
              <button
                key={i}
                className={`relative border hairline flex items-center justify-center text-4xl sm:text-5xl md:text-6xl font-display focus-ring transition-colors ${
                  !square && gameState === 'playing' ? 'hover:bg-[var(--bg-hover)]' : ''
                } ${isWinningSquare ? 'bg-[var(--bg-hover)] shadow-inner' : 'bg-[var(--bg-soft)]'}`}
                onClick={() => handleClick(i)}
                disabled={gameState !== 'playing' || square !== null}
                aria-label={`Square ${i}, ${square ? square : 'Empty'}`}
              >
                <span className={`${square === 'X' ? 'text-[var(--crimson)]' : square === 'O' ? 'text-[var(--ochre)]' : ''} ${isWinningSquare ? 'pulse-soft' : 'fade-in'}`}>
                  {square}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col w-full gap-3 mt-auto fade-up">
           {(gameState === 'won' || gameState === 'draw') ? (
             <>
               <button onClick={resetGame} className="btn-primary w-full py-3">
                 Play Again (Enter)
               </button>
               <button onClick={handleShare} className="btn-secondary w-full py-3">
                 {copied ? 'Copied!' : 'Share Result'}
               </button>
             </>
           ) : (
             <button onClick={resetGame} className="btn-ghost w-full py-2">
                 Reset Game
             </button>
           )}
        </div>
      </div>
    </div>
  );
}
