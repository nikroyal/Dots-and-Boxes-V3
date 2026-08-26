import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createEmptyGame, applyMove } from '../lib/tictactoeLogic';
import { sfx } from '../lib/sound';
import { X, Trophy } from 'lucide-react';
import Confetti from '../components/Confetti';
import { useConfirm } from '../components/ConfirmDialog';

export default function LocalTicTacToe() {
  const navigate = useNavigate();
  const [setup, setSetup] = useState(true);
  const [p1Name, setP1Name] = useState('Player 1');
  const [p2Name, setP2Name] = useState('Player 2');
  const [p1Wins, setP1Wins] = useState(0);
  const [p2Wins, setP2Wins] = useState(0);

  const [game, setGame] = useState(null);
  const { confirm, dialog: confirmDialogEl } = useConfirm();

  const handleStart = (e) => {
    e.preventDefault();
    setGame(createEmptyGame(3, 3, ['p1', 'p2']));
    setP1Wins(0);
    setP2Wins(0);
    setSetup(false);
  };

  const handleMove = (r, c) => {
    if (!game || game.finished) return;
    const playerIds = ['p1', 'p2'];
    const pid = playerIds[game.currentPlayerIdx];

    const { newGame, claimed, error } = applyMove(game, r, c, pid, playerIds);
    if (error) return;

    if (claimed > 0) sfx.claim();
    else sfx.line();

    setGame(newGame);

    if (newGame.finished) {
      if (newGame.winnerIdx === 0) setP1Wins(w => w + 1);
      else if (newGame.winnerIdx === 1) setP2Wins(w => w + 1);
    }
  };

  const quit = async () => {
    if (!game.finished && await confirm({ title: 'End this match?', body: 'Progress will be lost.', confirmLabel: 'Quit' })) {
      setSetup(true);
      setGame(null);
      setP1Wins(0);
      setP2Wins(0);
    } else if (game.finished) {
      setSetup(true);
      setGame(null);
      setP1Wins(0);
      setP2Wins(0);
    }
  };

  if (setup) {
    return (
      <div className="fade-in max-w-sm mx-auto space-y-8 py-8">
        <div className="text-center">
          <h1 className="font-display text-4xl mb-2">Tic-Tac-Toe</h1>
          <p className="font-mono text-xs opacity-60 uppercase tracking-widest">Local Multiplayer</p>
        </div>
        <form onSubmit={handleStart} className="card space-y-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="p1-name" className="font-mono text-[0.65rem] tracking-widest uppercase opacity-60 mb-1 block">Player 1 Name (X)</label>
              <input id="p1-name" value={p1Name} onChange={e => setP1Name(e.target.value)} className="w-full bg-black/5 dark:bg-white/5 border hairline px-3 py-2 font-display outline-none focus-ring" required maxLength={15} />
            </div>
            <div>
              <label htmlFor="p2-name" className="font-mono text-[0.65rem] tracking-widest uppercase opacity-60 mb-1 block">Player 2 Name (O)</label>
              <input id="p2-name" value={p2Name} onChange={e => setP2Name(e.target.value)} className="w-full bg-black/5 dark:bg-white/5 border hairline px-3 py-2 font-display outline-none focus-ring" required maxLength={15} />
            </div>
          </div>
          <button type="submit" className="btn-primary w-full justify-center">Start Match</button>
        </form>
      </div>
    );
  }

  const finished = game.finished;
  const isDraw = finished && game.winnerIdx === -1;
  const winnerName = isDraw ? 'Draw' : (game.winnerIdx === 0 ? p1Name : p2Name);
  const p1Turn = game.currentPlayerIdx === 0;

  return (
    <div className="fade-in max-w-4xl mx-auto space-y-6">
      {confirmDialogEl}
      {finished && !isDraw && <Confetti />}

      <div className="flex items-center justify-between border-b hairline pb-4">
        <div className="flex items-center gap-4">
          <button onClick={quit} className="btn-ghost" aria-label="Quit match">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        {!finished && (
          <div className="font-mono text-[0.65rem] tracking-widest uppercase px-3 py-1 rounded" style={{
            background: p1Turn ? 'var(--crimson)' : 'var(--ochre)',
            color: 'white'
          }}>
            {p1Turn ? p1Name : p2Name}'s Turn
          </div>
        )}
      </div>

      <div className="flex justify-between items-center max-w-sm mx-auto px-4 mt-4 mb-2">
         <div className={`text-center ${p1Turn && !finished ? 'scale-110' : 'opacity-60'} transition-transform duration-300`}>
           <div className="font-display text-lg" style={{ color: 'var(--crimson)' }}>{p1Name}</div>
           <div className="font-mono text-sm">{p1Wins} Wins</div>
         </div>
         <div className={`text-center ${!p1Turn && !finished ? 'scale-110' : 'opacity-60'} transition-transform duration-300`}>
           <div className="font-display text-lg" style={{ color: 'var(--ochre)' }}>{p2Name}</div>
           <div className="font-mono text-sm">{p2Wins} Wins</div>
         </div>
      </div>


      <div className="flex justify-center py-8 relative">
        <div className="relative inline-block">
          <div className="grid gap-2 bg-[var(--hairline-strong)] p-2" style={{ gridTemplateColumns: `repeat(${game.cols}, minmax(0, 1fr))` }}>
            {Array(game.rows).fill(null).map((_, r) =>
              Array(game.cols).fill(null).map((_, c) => {
                const pid = game.board[r][c];
                return (
                  <div key={`cell-${r}-${c}`}
                       className="w-20 h-20 sm:w-32 sm:h-32 bg-[var(--paper)] flex items-center justify-center text-6xl font-display cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
                       onClick={() => !finished && handleMove(r, c)}>
                    {pid === 'p1' && <span className="fade-in" style={{ color: 'var(--crimson)' }}>X</span>}
                    {pid === 'p2' && <span className="fade-in" style={{ color: 'var(--ochre)' }}>O</span>}
                  </div>
                );
              })
            )}
          </div>
          {finished && game.winLine && (() => {
            const first = game.winLine[0];
            const last = Array.isArray(game.winLine) && game.winLine.length > 0 ? game.winLine[game.winLine.length - 1] : undefined;
            const x1 = (first.c + 0.5) / game.cols;
            const y1 = (first.r + 0.5) / game.rows;
            const x2 = (last.c + 0.5) / game.cols;
            const y2 = (last.r + 0.5) / game.rows;

            const dx = x2 - x1;
            const dy = y2 - y1;
            const len = Math.sqrt(dx*dx + dy*dy);
            let extX = 0, extY = 0;
            if (len > 0) {
              extX = (dx / len) * (0.25 / game.cols);
              extY = (dy / len) * (0.25 / game.rows);
            }

            return (
              <svg className="absolute inset-0 pointer-events-none z-10 w-full h-full" style={{ overflow: 'visible' }}>
                <line
                  x1={`${(x1 - extX) * 100}%`} y1={`${(y1 - extY) * 100}%`}
                  x2={`${(x2 + extX) * 100}%`} y2={`${(y2 + extY) * 100}%`}
                  stroke={game.winnerIdx === 0 ? 'var(--crimson)' : 'var(--ochre)'}
                  strokeWidth="8" strokeLinecap="round"
                  className="line-drawn"
                  style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.2))' }}
                />
              </svg>
            );
          })()}
        </div>
      </div>


      {finished && (
        <div className="card text-center max-w-sm mx-auto space-y-6 fade-up">
          <div>
            <Trophy size={32} className="mx-auto mb-3" style={{ color: 'var(--ochre)' }} />
            <h2 className="font-display text-3xl mb-1">{isDraw ? 'Draw!' : `${winnerName} Wins!`}</h2>
            <p className="font-mono text-[0.65rem] tracking-widest uppercase opacity-60">Match Over</p>
          </div>
          <div className="flex gap-3 justify-center">
             <button onClick={() => setGame(createEmptyGame(3, 3, ['p1', 'p2']))} className="btn-primary">
               Rematch
             </button>
             <button onClick={() => setSetup(true)} className="btn-ghost">
               Setup
             </button>
          </div>
        </div>
      )}
    </div>
  );
}
