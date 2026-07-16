import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../lib/AuthContext';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { updateArcadeBest } from '../lib/actions';
import { sfx } from '../lib/sound';

const PADS = [
  { id: 0, color: 'var(--crimson)', sound: sfx.click },
  { id: 1, color: 'var(--forest)', sound: sfx.notify },
  { id: 2, color: 'var(--ochre)', sound: sfx.piece },
  { id: 3, color: 'var(--ink)', sound: sfx.message },
];

export default function SequenceMemory() {
  const { profile } = useAuth();

  // States
  const [gameState, setGameState] = useState('waiting'); // 'waiting' | 'playing' | 'gameover'
  const [sequence, setSequence] = useState([]);
  const [playerSequence, setPlayerSequence] = useState([]);
  const [activePad, setActivePad] = useState(null);
  const [level, setLevel] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isPlayingSequence, setIsPlayingSequence] = useState(false);

  const [bestLevel, setBestLevel] = useState(() => {
    try {
      const saved = localStorage.getItem('axiom-sequence-best');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  const timeoutsRef = useRef([]);
  const clickTimeoutRef = useRef(null);


  const handlePadClickRef = useRef(null);
  useEffect(() => {
    handlePadClickRef.current = handlePadClick;
  });

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.repeat) return;
      if (gameState === 'waiting' || gameState === 'gameover') {
        if (e.key === 'Enter') {
          e.preventDefault();
          startGame();
        }
      } else if (gameState === 'playing' && !isPlayingSequence) {
        if (['1', '2', '3', '4'].includes(e.key)) {
          e.preventDefault();
          if (handlePadClickRef.current) {
            handlePadClickRef.current(parseInt(e.key, 10) - 1);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, isPlayingSequence]);

  const clearAllTimeouts = () => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }
  };

  useEffect(() => {
    return () => clearAllTimeouts();
  }, []);

  const playSequence = (seq) => {
    setIsPlayingSequence(true);
    clearAllTimeouts();
    setActivePad(null);

    let delay = 500;
    const showDuration = 400;
    const pauseDuration = 200;

    seq.forEach((padId, index) => {
      const showTimeout = setTimeout(() => {
        setActivePad(padId);
        PADS[padId].sound();
      }, delay);
      timeoutsRef.current.push(showTimeout);

      delay += showDuration;

      const hideTimeout = setTimeout(() => {
        setActivePad(null);
      }, delay);
      timeoutsRef.current.push(hideTimeout);

      delay += pauseDuration;
    });

    const endTimeout = setTimeout(() => {
      setIsPlayingSequence(false);
    }, delay);
    timeoutsRef.current.push(endTimeout);
  };

  const nextLevel = (currentSeq) => {
    const nextPad = Math.floor(Math.random() * 4);
    const newSeq = [...currentSeq, nextPad];
    setSequence(newSeq);
    setPlayerSequence([]);
    setLevel(newSeq.length);
    playSequence(newSeq);
  };

  const startGame = () => {
    sfx.click();
    setGameState('playing');
    setLevel(0);
    setSequence([]);
    setPlayerSequence([]);

    const startTimeout = setTimeout(() => {
      nextLevel([]);
    }, 500);
    timeoutsRef.current.push(startTimeout);
  };

  const handlePadClick = (padId) => {
    if (gameState !== 'playing' || isPlayingSequence) return;

    PADS[padId].sound();
    setActivePad(padId);

    // Quick visual feedback
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }
    clickTimeoutRef.current = setTimeout(() => {
      setActivePad(null);
    }, 200);

    const newPlayerSeq = [...playerSequence, padId];
    const currentIndex = newPlayerSeq.length - 1;

    if (newPlayerSeq[currentIndex] !== sequence[currentIndex]) {
      // Wrong pad
      handleGameOver();
      return;
    }

    setPlayerSequence(newPlayerSeq);

    if (newPlayerSeq.length === sequence.length) {
      // Completed level successfully
      setIsPlayingSequence(true); // lock input
      const nextLevelTimeout = setTimeout(() => {
        nextLevel(sequence);
      }, 1000);
      timeoutsRef.current.push(nextLevelTimeout);
    }
  };

  const handleGameOver = () => {
    clearAllTimeouts();
    setActivePad(null);
    sfx.loss();
    setGameState('gameover');

    const currentLevel = level - 1; // You failed the current one, so your score is level - 1
    const finalScore = Math.max(0, currentLevel);

    if (finalScore > bestLevel) {
      setBestLevel(finalScore);
      try {
        localStorage.setItem('axiom-sequence-best', finalScore.toString());
      } catch {}
      recordActivity(profile, ACTIVITY_TYPES.ARCADE_BEST, { game: 'Sequence Memory', score: finalScore });
      updateArcadeBest(profile, 'sequence-memory', 'Sequence Memory', finalScore, finalScore.toString());
    }
  };

  const getRatingMessage = (s) => {
    if (s >= 15) return "🧠 Mastermind";
    if (s >= 10) return "🧠 Genius";
    if (s >= 5) return "🧠 Good Memory";
    return "🧠 Needs Practice";
  };

  const handleShare = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const finalScore = Math.max(0, level - 1);
    const rating = getRatingMessage(finalScore);
    const text = `I reached level ${finalScore} in Axiom Sequence Memory! ${rating}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        sfx.notify();
        setCopied(true);
        const shareTimeout = setTimeout(() => setCopied(false), 2000);
        timeoutsRef.current.push(shareTimeout);
      }).catch(err => console.warn("Clipboard copy failed", err));
    } else {
      console.warn("Clipboard API not supported");
    }
  };

  return (
    <div className="fade-in max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh]">
      <section className="text-center mb-8">
        <h1 className="font-display text-5xl font-medium tracking-tight mb-2">Sequence Memory</h1>
        <p className="font-mono text-sm tracking-widest uppercase opacity-60 mb-2">
          Level: {Math.max(1, level)}
        </p>
        {bestLevel > 0 && (
          <p className="font-mono text-xs tracking-widest uppercase opacity-80 mt-2 text-[var(--ochre)]">
            Best: Level {bestLevel}
          </p>
        )}
      </section>

      <div className="relative border hairline card bg-[var(--paper-tint)] p-6 sm:p-8 w-full max-w-md aspect-square flex items-center justify-center">
        {gameState === 'waiting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/5 z-10 backdrop-blur-[1px]">
            <button onClick={startGame} className="btn-primary">
              Start Game <span className="hidden sm:inline opacity-50 font-mono text-xs ml-2">(Enter)</span>
            </button>
          </div>
        )}

        {gameState === 'gameover' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/10 z-10 backdrop-blur-[2px]">
            <p className="font-display text-3xl mb-2 text-[var(--crimson)]">Game Over</p>
            <p className="font-mono text-lg mb-1">Reached Level {Math.max(0, level - 1)}</p>
            <p className="font-display text-xl mb-6 text-[var(--ink)] opacity-90">{getRatingMessage(Math.max(0, level - 1))}</p>
            <div className="flex gap-4">
              <button onClick={startGame} className="btn-primary">
                Play Again <span className="hidden sm:inline opacity-50 font-mono text-xs ml-2">(Enter)</span>
              </button>
              <button onClick={handleShare} className="btn-ghost">
                {copied ? 'Copied!' : 'Share Result'}
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 w-full h-full">
          {PADS.map((pad) => (
            <button
              key={pad.id}
              onPointerDown={(e) => {
                e.stopPropagation();
                handlePadClick(pad.id);
              }}
              disabled={gameState !== 'playing' || isPlayingSequence}
              className={`relative w-full h-full rounded-2xl transition-all duration-150 flex items-center justify-center ${activePad === pad.id ? 'opacity-100 scale-95 shadow-inner' : 'opacity-40 hover:opacity-60'} border border-black/10`}
              style={{ backgroundColor: pad.color }}
              aria-label={`Memory pad ${pad.id + 1}`}
            >
              <div className="hidden sm:block absolute top-2 left-3 font-mono text-xs opacity-50 pointer-events-none text-white/50">{pad.id + 1}</div>
            </button>
          ))}
        </div>
      </div>

      <p className="mt-8 font-mono text-xs opacity-50 hidden sm:block text-center max-w-xs">
        Repeat the sequence. It gets longer every round!
      </p>
    </div>
  );
}
