import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { updateArcadeBest } from '../lib/actions';
import { sfx } from '../lib/sound';

const PADS = [
  { id: 0, colorClass: 'bg-[var(--crimson)]', activeClass: 'bg-red-400 scale-105 shadow-md' },
  { id: 1, colorClass: 'bg-[var(--forest)]', activeClass: 'bg-green-400 scale-105 shadow-md' },
  { id: 2, colorClass: 'bg-[var(--ochre)]', activeClass: 'bg-yellow-400 scale-105 shadow-md' },
  { id: 3, colorClass: 'bg-[var(--ink)]', activeClass: 'bg-gray-400 scale-105 shadow-md' }
];

export default function SequenceMemory() {
  const { profile } = useAuth();

  // states: 'waiting' | 'playing' | 'gameover' | 'showing_sequence'
  const [gameState, setGameState] = useState('waiting');
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(() => {
    try {
      const saved = localStorage.getItem('axiom-sequence-best');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  const [sequence, setSequence] = useState([]);
  const [playerStep, setPlayerStep] = useState(0);
  const [activePad, setActivePad] = useState(null);

  const sequenceRef = useRef(sequence);
  useEffect(() => { sequenceRef.current = sequence; }, [sequence]);

  const scoreRef = useRef(score);
  useEffect(() => { scoreRef.current = score; }, [score]);

  const padTimeouts = useRef([]);

  useEffect(() => {
    return () => {
      padTimeouts.current.forEach(clearTimeout);
    };
  }, []);

  const playToneForPad = (padId) => {
    // Simple tone selection based on pad id
    const freqs = [329.63, 261.63, 220.00, 164.81]; // E4, C4, A3, E3
    const freqsOld = [440, 554, 659, 880];
    if (padId === 0) sfx.click(); // red
    else if (padId === 1) sfx.piece(); // green
    else if (padId === 2) sfx.claim(); // yellow
    else sfx.notify(); // blue
  };

  const playSequence = useCallback((seq) => {
    setGameState('showing_sequence');
    setActivePad(null);
    padTimeouts.current.forEach(clearTimeout);
    padTimeouts.current = [];

    // Short delay before starting the sequence
    const startDelay = 800;

    seq.forEach((padId, index) => {
      // Light up pad
      const t1 = setTimeout(() => {
        setActivePad(padId);
        playToneForPad(padId);
      }, startDelay + index * 800);

      // Turn off pad
      const t2 = setTimeout(() => {
        setActivePad(null);
      }, startDelay + index * 800 + 400);

      padTimeouts.current.push(t1, t2);
    });

    // Sequence done, back to player
    const t3 = setTimeout(() => {
      setGameState('playing');
      setPlayerStep(0);
    }, startDelay + seq.length * 800 + 100);
    padTimeouts.current.push(t3);
  }, []);

  const nextLevel = useCallback((currentSeq) => {
    const nextPad = Math.floor(Math.random() * 4);
    const newSeq = [...currentSeq, nextPad];
    setSequence(newSeq);
    setScore(newSeq.length - 1);
    playSequence(newSeq);
  }, [playSequence]);

  const startGame = () => {
    sfx.win(); // generic start sound
    setScore(0);
    setPlayerStep(0);
    nextLevel([]);
  };

  const endGame = useCallback(() => {
    padTimeouts.current.forEach(clearTimeout);
    sfx.loss();
    setGameState('gameover');

    const finalScore = scoreRef.current;
    if (finalScore > bestScore) {
      setBestScore(finalScore);
      try {
        localStorage.setItem('axiom-sequence-best', finalScore.toString());
      } catch {}
      recordActivity(profile, ACTIVITY_TYPES.ARCADE_BEST, { game: 'Sequence Memory', score: finalScore });
      // We pass a negative score internally to trick updateArcadeBest if needed, OR we can just pass the score.
      // Wait, updateArcadeBest uses gameId = 'sequence-memory', which by default is "higher is better"
      // since it is not 'reaction-timer' or 'memory-match'.
      updateArcadeBest(profile, 'sequence-memory', 'Sequence Memory', finalScore, finalScore.toString());
    }
  }, [bestScore, profile]);

  const handlePadClick = (padId) => {
    if (gameState !== 'playing') return;

    setActivePad(padId);
    playToneForPad(padId);

    // clear active pad shortly after
    const t = setTimeout(() => {
      setActivePad(curr => curr === padId ? null : curr);
    }, 200);
    padTimeouts.current.push(t);

    const currentSeq = sequenceRef.current;

    if (currentSeq[playerStep] !== padId) {
      // Wrong pad
      endGame();
      return;
    }

    // Correct pad
    const nextStep = playerStep + 1;
    setPlayerStep(nextStep);

    if (nextStep === currentSeq.length) {
      // Finished sequence correctly
      setGameState('waiting'); // prevent clicks
      setTimeout(() => {
        nextLevel(currentSeq);
      }, 800);
    }
  };

  return (
    <div className="fade-in max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh]">
      <section className="text-center mb-8">
        <h1 className="font-display text-5xl font-medium tracking-tight mb-2">Sequence Memory</h1>
        <p className="font-mono text-sm tracking-widest uppercase opacity-60 mb-2">
          Score: {score}
        </p>
        {bestScore > 0 && (
          <p className="font-mono text-xs tracking-widest uppercase opacity-80 mt-2 text-[var(--ochre)]">
            Best Score: {bestScore}
          </p>
        )}
      </section>

      <div className="relative border hairline card bg-[var(--paper-tint)] p-4 sm:p-6 w-full max-w-md aspect-square">
        {gameState === 'waiting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/5 z-10 backdrop-blur-[1px]">
            <button onClick={startGame} className="btn-primary">
              Start Game
            </button>
          </div>
        )}

        {gameState === 'gameover' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/10 z-10 backdrop-blur-[2px]">
            <p className="font-display text-3xl mb-2 text-[var(--crimson)]">Game Over!</p>
            <p className="font-mono text-lg mb-6">Final Score: {score}</p>
            <button onClick={startGame} className="btn-primary">
              Play Again
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 h-full w-full">
          {PADS.map((pad) => {
            const isActive = activePad === pad.id;
            return (
              <button
                key={pad.id}
                onClick={() => handlePadClick(pad.id)}
                className={`w-full h-full rounded-2xl transition-all duration-150 ${
                  isActive ? pad.activeClass : pad.colorClass + ' opacity-80 cursor-pointer hover:opacity-100'
                }`}
                aria-label={`Pad ${pad.id}`}
                disabled={gameState !== 'playing'}
              />
            );
          })}
        </div>
      </div>

      <p className="mt-8 font-mono text-xs opacity-50 hidden sm:block text-center max-w-xs">
        Memorize the sequence of colored pads and repeat it back. The sequence gets longer each round!
      </p>
    </div>
  );
}
