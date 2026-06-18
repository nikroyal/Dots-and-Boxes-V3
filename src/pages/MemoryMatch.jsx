import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../lib/AuthContext';
import { recordActivity, ACTIVITY_TYPES } from '../lib/activity';
import { Star, Zap, Play, Target, Trophy, Send, Users, Shield } from 'lucide-react';
import { sfx } from '../lib/sound';
import Confetti from '../components/Confetti';

const ICONS = [Star, Zap, Play, Target, Trophy, Send, Users, Shield];

export default function MemoryMatch() {
  const { profile } = useAuth();
  const [cards, setCards] = useState([]);
  const [flipped, setFlipped] = useState([]);
  const [matched, setMatched] = useState([]);
  const [moves, setMoves] = useState(0);
  const [bestMoves, setBestMoves] = useState(() => {
    const saved = localStorage.getItem('memory-match-best');
    return saved ? parseInt(saved, 10) : null;
  });
  const [isGameWon, setIsGameWon] = useState(false);

  // Initialize game
  useEffect(() => {
    initializeGame();
  }, []);

  useEffect(() => {
    if (isGameWon) {
      setBestMoves((currentBest) => {
        if (currentBest === null || moves < currentBest) {
          return moves;
        }
        return currentBest;
      });
      // Side effects belong in the effect body, not the state updater function.
      if (bestMoves === null || moves < bestMoves) {
        recordActivity(profile, ACTIVITY_TYPES.ARCADE_BEST, { game: 'Memory Match', score: moves + ' moves' });
        localStorage.setItem('memory-match-best', moves.toString());
      }
    }
  }, [isGameWon, moves, bestMoves, profile]);

  const initializeGame = () => {
    // Generate a secure random sort
    const shuffledIcons = [...ICONS, ...ICONS]
      .map(value => ({ value, sort: crypto.randomUUID() }))
      .sort((a, b) => a.sort.localeCompare(b.sort))
      .map(({ value }, index) => ({ id: index, Icon: value, isFlipped: false, isMatched: false }));

    setCards(shuffledIcons);
    setFlipped([]);
    setMatched([]);
    setMoves(0);
    setIsGameWon(false);
  };

  const handleCardClick = (id) => {
    if (flipped.length === 2) return; // Prevent clicking more than 2 cards
    if (flipped.includes(id)) return; // Prevent double clicking same card
    if (matched.includes(id)) return; // Prevent clicking matched cards

    sfx.click();

    const newFlipped = [...flipped, id];
    setFlipped(newFlipped);

    if (newFlipped.length === 2) {
      setMoves((m) => m + 1);
      const [firstId, secondId] = newFlipped;
      const firstCard = cards.find((c) => c.id === firstId);
      const secondCard = cards.find((c) => c.id === secondId);

      if (firstCard.Icon === secondCard.Icon) {
        // Match found
        sfx.notify();
        setMatched((m) => [...m, firstId, secondId]);
        setFlipped([]);

        // Check win condition
        if (matched.length + 2 === cards.length) {
          setTimeout(() => {
            setIsGameWon(true);
            sfx.win();
          }, 300);
        }
      } else {
        // No match
        setTimeout(() => {
          setFlipped([]);
        }, 1000);
      }
    }
  };

  return (
    <div className="fade-in space-y-10 max-w-2xl mx-auto">
      {isGameWon && <Confetti />}
      <section className="text-center">
        <h1 className="font-display text-5xl font-medium tracking-tight mb-2">Memory Match</h1>
        <p className="font-mono text-sm tracking-widest uppercase opacity-60 mb-2">
          Moves: {moves} {bestMoves !== null && <span className="ml-4">Best: {bestMoves}</span>}
        </p>
        {isGameWon && (
          <p className="font-display text-2xl text-[var(--forest)] pulse-soft">You Win!</p>
        )}
      </section>

      <section className="grid grid-cols-4 gap-4 p-4 card" style={{ background: 'var(--paper-tint)' }}>
        {cards.map((card) => {
          const isFlipped = flipped.includes(card.id);
          const isMatched = matched.includes(card.id);
          const Icon = card.Icon;
          const showFace = isFlipped || isMatched;

          return (
            <button
              key={card.id}
              onClick={() => handleCardClick(card.id)}
              className={`border hairline aspect-square flex items-center justify-center cursor-pointer transition-all duration-300 ${
                showFace ? 'bg-white shadow-sm' : 'bg-[var(--bg-soft)] hover:bg-[var(--bg-hover)]'
              } ${isMatched ? 'opacity-50' : ''}`}
              disabled={isMatched || isFlipped || flipped.length === 2}
              aria-label={showFace ? 'Card face visible' : 'Face down card'}
            >
              {showFace ? (
                <Icon size={32} className={isMatched ? 'opacity-50' : ''} style={{ color: 'var(--ink)' }} />
              ) : (
                <div className="font-display text-3xl opacity-20">?</div>
              )}
            </button>
          );
        })}
      </section>

      <div className="text-center">
        <button onClick={() => { sfx.click(); initializeGame(); }} className="btn-primary">
          Restart Game
        </button>
      </div>
    </div>
  );
}
