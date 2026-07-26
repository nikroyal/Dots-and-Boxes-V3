import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { updateArcadeBest } from '../lib/actions';
import { sfx } from '../lib/sound';

const WORDS = [
  'REACT', 'FIREBASE', 'AXIOM', 'GAME', 'CODE', 'BUILD', 'PLAY', 'FUN', 'LOGIC', 'BOARD'
];

const GRID_SIZE = 10;

function generateGrid(words) {
  const grid = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(''));
  const wordPositions = {};

  // Directions: 0: horizontal, 1: vertical
  for (const word of words) {
    let placed = false;
    let attempts = 0;
    while (!placed && attempts < 100) {
      attempts++;
      const dir = Math.random() < 0.5 ? 0 : 1;
      const row = Math.floor(Math.random() * GRID_SIZE);
      const col = Math.floor(Math.random() * GRID_SIZE);

      if (dir === 0 && col + word.length <= GRID_SIZE) {
        let canPlace = true;
        for (let i = 0; i < word.length; i++) {
          if (grid[row][col + i] !== '' && grid[row][col + i] !== word[i]) {
            canPlace = false;
            break;
          }
        }
        if (canPlace) {
          for (let i = 0; i < word.length; i++) {
            grid[row][col + i] = word[i];
          }
          wordPositions[word] = { row, col, dir, length: word.length, found: false };
          placed = true;
        }
      } else if (dir === 1 && row + word.length <= GRID_SIZE) {
        let canPlace = true;
        for (let i = 0; i < word.length; i++) {
          if (grid[row + i][col] !== '' && grid[row + i][col] !== word[i]) {
            canPlace = false;
            break;
          }
        }
        if (canPlace) {
          for (let i = 0; i < word.length; i++) {
            grid[row + i][col] = word[i];
          }
          wordPositions[word] = { row, col, dir, length: word.length, found: false };
          placed = true;
        }
      }
    }
    // If not placed after 100 attempts, just ignore for simplicity in this arcade game.
  }

  // Fill remaining with random letters
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (grid[r][c] === '') {
        grid[r][c] = letters[Math.floor(Math.random() * letters.length)];
      }
    }
  }

  return { grid, wordPositions };
}

export default function WordSearch() {
  const { profile } = useAuth();
  const [gameState, setGameState] = useState('waiting'); // 'waiting', 'playing', 'result'
  const [grid, setGrid] = useState([]);
  const [wordPositions, setWordPositions] = useState({});
  const [selectionStart, setSelectionStart] = useState(null);
  const [selectionEnd, setSelectionEnd] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [time, setTime] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);

  const [bestTime, setBestTime] = useState(() => {
    try {
      const saved = localStorage.getItem('axiom-wordsearch-best');
      return saved ? parseFloat(saved) : Infinity;
    } catch {
      return Infinity;
    }
  });

  const startGame = useCallback(() => {
    sfx.click();
    const gameWords = [];
    const availableWords = [...WORDS];
    for (let i = 0; i < 4; i++) {
        if (availableWords.length === 0) break;
        const idx = Math.floor(Math.random() * availableWords.length);
        gameWords.push(availableWords.splice(idx, 1)[0]);
    }

    const { grid: newGrid, wordPositions: newWordPositions } = generateGrid(gameWords);
    setGrid(newGrid);
    setWordPositions(newWordPositions);
    setSelectionStart(null);
    setSelectionEnd(null);
    setIsSelecting(false);
    setGameState('playing');
    setTime(0);
    setStartTime(performance.now());
  }, []);

  const endGame = useCallback((finalTime) => {
    if (timerRef.current) cancelAnimationFrame(timerRef.current);
    sfx.win();
    setGameState('result');
    setTime(finalTime);

    if (finalTime < bestTime) {
      setBestTime(finalTime);
      try {
        localStorage.setItem('axiom-wordsearch-best', finalTime.toString());
      } catch {}
      recordActivity(profile, ACTIVITY_TYPES.ARCADE_BEST, { game: 'Word Search', score: (finalTime / 1000).toFixed(3) + 's' });
      updateArcadeBest(profile, 'word-search', 'Word Search', finalTime, (finalTime / 1000).toFixed(3) + 's');
    }
  }, [bestTime, profile]);


  useEffect(() => {
    if (gameState === 'playing' && startTime) {
      const updateTimer = () => {
        setTime(performance.now() - startTime);
        timerRef.current = requestAnimationFrame(updateTimer);
      };
      timerRef.current = requestAnimationFrame(updateTimer);
      return () => cancelAnimationFrame(timerRef.current);
    }
  }, [gameState, startTime]);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key === 'Enter') {
        if (e.target.tagName === 'BUTTON') return;
        if (gameState === 'waiting' || gameState === 'result') {
          e.preventDefault();
          startGame();
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [gameState, startGame]);

  const handlePointerDown = (row, col) => {
    if (gameState !== 'playing') return;
    setIsSelecting(true);
    setSelectionStart({ row, col });
    setSelectionEnd({ row, col });
  };

  const handlePointerEnter = (row, col) => {
    if (!isSelecting || gameState !== 'playing') return;
    // Only allow straight lines
    if (selectionStart.row === row || selectionStart.col === col) {
       setSelectionEnd({ row, col });
    }
  };

  const checkWord = useCallback((start, end) => {
    if (!start || !end) return;

    let selectedWord = '';
    let isReversed = false;
    let selectedPositions = [];

    if (start.row === end.row) {
      // Horizontal
      const minCol = Math.min(start.col, end.col);
      const maxCol = Math.max(start.col, end.col);
      for (let c = minCol; c <= maxCol; c++) {
        selectedWord += grid[start.row][c];
        selectedPositions.push({ row: start.row, col: c });
      }
      if (start.col > end.col) isReversed = true;
    } else if (start.col === end.col) {
      // Vertical
      const minRow = Math.min(start.row, end.row);
      const maxRow = Math.max(start.row, end.row);
      for (let r = minRow; r <= maxRow; r++) {
        selectedWord += grid[r][start.col];
        selectedPositions.push({ row: r, col: start.col });
      }
      if (start.row > end.row) isReversed = true;
    }

    if (isReversed) {
        selectedWord = selectedWord.split('').reverse().join('');
        selectedPositions.reverse();
    }

    let foundAny = false;
    let newPositions = { ...wordPositions };

    Object.entries(newPositions).forEach(([word, info]) => {
      if (!info.found) {
        if (selectedWord === word) {
           // Verify positions match exactly
           let match = true;
           if (info.dir === 0) { // Horizontal
               if (info.row !== start.row || Math.min(start.col, end.col) !== info.col || Math.max(start.col, end.col) !== info.col + info.length - 1) match = false;
           } else { // Vertical
               if (info.col !== start.col || Math.min(start.row, end.row) !== info.row || Math.max(start.row, end.row) !== info.row + info.length - 1) match = false;
           }

           if (match) {
             newPositions[word].found = true;
             foundAny = true;
             sfx.piece();
           } else {
               // Could be selecting the word in reverse? The word on board is just 'WORD'
               if (isReversed) {
                   // if we selected it reversed, does the position match?
                   if (info.dir === 0) {
                        if (info.row === start.row && Math.max(start.col, end.col) === info.col + info.length - 1 && Math.min(start.col, end.col) === info.col) {
                            newPositions[word].found = true;
                            foundAny = true;
                            sfx.piece();
                        }
                   } else {
                        if (info.col === start.col && Math.max(start.row, end.row) === info.row + info.length - 1 && Math.min(start.row, end.row) === info.row) {
                            newPositions[word].found = true;
                            foundAny = true;
                            sfx.piece();
                        }
                   }
               }
           }
        } else if (selectedWord === word.split('').reverse().join('')) {
            // Found it backwards
            let match = true;
             if (info.dir === 0) { // Horizontal
                 if (info.row !== start.row || Math.min(start.col, end.col) !== info.col || Math.max(start.col, end.col) !== info.col + info.length - 1) match = false;
             } else { // Vertical
                 if (info.col !== start.col || Math.min(start.row, end.row) !== info.row || Math.max(start.row, end.row) !== info.row + info.length - 1) match = false;
             }
             if (match) {
                 newPositions[word].found = true;
                 foundAny = true;
                 sfx.piece();
             }
        }
      }
    });

    if (foundAny) {
      setWordPositions(newPositions);
      const allFound = Object.values(newPositions).every(w => w.found);
      if (allFound) {
        const finalTime = performance.now() - startTime;
        endGame(finalTime);
      }
    } else {
        // Just invalid selection
    }
  }, [grid, wordPositions, startTime, endGame]);

  const handlePointerUp = () => {
    if (!isSelecting || gameState !== 'playing') return;
    setIsSelecting(false);
    checkWord(selectionStart, selectionEnd);
    setSelectionStart(null);
    setSelectionEnd(null);
  };

  useEffect(() => {
    const handleGlobalPointerUp = () => {
        if (isSelecting) {
            handlePointerUp();
        }
    };
    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => window.removeEventListener('pointerup', handleGlobalPointerUp);
  }, [isSelecting, handlePointerUp]);

  const handleShare = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const text = `I completed Axiom Word Search in ${(time / 1000).toFixed(3)}s! 🔍`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        sfx.notify();
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(err => console.warn("Clipboard copy failed", err));
    }
  };

  const getCellClasses = (r, c) => {
    let classes = "w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center font-display text-xl sm:text-2xl cursor-pointer select-none transition-colors border-none";

    let isFound = false;
    Object.values(wordPositions).forEach(info => {
      if (info.found) {
        if (info.dir === 0 && info.row === r && c >= info.col && c < info.col + info.length) isFound = true;
        if (info.dir === 1 && info.col === c && r >= info.row && r < info.row + info.length) isFound = true;
      }
    });

    let isSelected = false;
    if (isSelecting && selectionStart && selectionEnd) {
       if (selectionStart.row === selectionEnd.row) { // horizontal
            if (r === selectionStart.row && c >= Math.min(selectionStart.col, selectionEnd.col) && c <= Math.max(selectionStart.col, selectionEnd.col)) {
                isSelected = true;
            }
       } else if (selectionStart.col === selectionEnd.col) { // vertical
            if (c === selectionStart.col && r >= Math.min(selectionStart.row, selectionEnd.row) && r <= Math.max(selectionStart.row, selectionEnd.row)) {
                isSelected = true;
            }
       }
    }

    if (isFound) {
      classes += " bg-[var(--forest)] text-white";
    } else if (isSelected) {
      classes += " bg-[var(--ochre)] text-white";
    } else {
      classes += " hover:bg-[var(--bg-hover)]";
    }

    return classes;
  };

  return (
    <div className="fade-in max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[60vh] px-4 py-8">
      <section className="text-center mb-8">
        <h1 className="font-display text-5xl font-medium tracking-tight mb-2">Word Search</h1>
        <p className="font-mono text-sm tracking-widest uppercase opacity-60 mb-2 flex items-center justify-center gap-4">
          Time: <span className="score-display text-[var(--ink)] font-bold w-24 text-right">{(time / 1000).toFixed(3)}s</span>
        </p>
        {bestTime !== Infinity && (
          <p className="font-mono text-xs tracking-widest uppercase opacity-80 mt-2 text-[var(--forest)]">
            Best Time: {(bestTime / 1000).toFixed(3)}s
          </p>
        )}
      </section>

      <div className="w-full max-w-2xl border hairline card bg-[var(--paper-tint)] flex flex-col items-center relative overflow-hidden p-6 sm:p-10 min-h-[400px]">
        {gameState === 'waiting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--paper-tint)] z-10">
            <p className="mb-6 font-display text-xl opacity-80 text-center px-4 max-w-sm">
              Find all the hidden words as fast as you can. Drag to select.
            </p>
            <button onClick={startGame} className="btn-primary mb-2">
              Start <span className="hidden sm:inline opacity-50 font-mono text-xs ml-2">(Enter)</span>
            </button>
            <p className="font-mono text-xs opacity-60">Press Enter</p>
          </div>
        )}

        {gameState === 'result' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--paper-tint)]/90 z-10 backdrop-blur-sm">
             <div className="font-display text-3xl mb-1 opacity-90 text-[var(--forest)]">{(time / 1000).toFixed(3)}s</div>
             <div className="flex gap-4 mt-6 mb-2">
               <button onClick={startGame} className="btn-primary">
                  Play Again <span className="hidden sm:inline opacity-50 font-mono text-xs ml-2">(Enter)</span>
               </button>
               <button onClick={handleShare} className="btn-ghost">
                 {copied ? 'Copied!' : 'Share Result'}
               </button>
             </div>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-8 items-start">
            <div
                className="grid gap-1 touch-none p-2 bg-[var(--bg-soft)] rounded select-none"
                style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))` }}
                onPointerLeave={() => {
                    // if we leave the grid while selecting, maybe stop selecting?
                }}
            >
                {grid.map((row, r) => (
                    row.map((cell, c) => (
                        <div
                            key={`${r}-${c}`}
                            className={getCellClasses(r, c)}
                            onPointerDown={(e) => { e.preventDefault(); handlePointerDown(r, c); }}
                            onPointerEnter={(e) => { e.preventDefault(); handlePointerEnter(r, c); }}
                        >
                            {cell}
                        </div>
                    ))
                ))}
            </div>

            <div className="flex flex-col gap-2">
                <h3 className="font-mono text-xs uppercase tracking-widest opacity-50 mb-2">Words</h3>
                {Object.keys(wordPositions).map(word => (
                    <div key={word} className={`font-display text-xl ${wordPositions[word].found ? 'line-through opacity-40 text-[var(--forest)]' : ''}`}>
                        {word}
                    </div>
                ))}
            </div>
        </div>
      </div>
    </div>
  );
}
