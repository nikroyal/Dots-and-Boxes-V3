import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createEmptyGame, applyMove } from '../lib/chessLogic';
import { sfx } from '../lib/sound';
import { X, Trophy, RefreshCcw } from 'lucide-react';
import Confetti from '../components/Confetti';
import { useConfirm } from '../components/ConfirmDialog';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';

export default function LocalChess() {
  const navigate = useNavigate();
  const [setup, setSetup] = useState(true);
  const [p1Name, setP1Name] = useState('Player 1 (White)');
  const [p2Name, setP2Name] = useState('Player 2 (Black)');
  const [flipBoard, setFlipBoard] = useState(true);

  const [game, setGame] = useState(null);
  const { confirm, dialog } = useConfirm();

  const handleStart = (e) => {
    e.preventDefault();
    setGame(createEmptyGame(['p1', 'p2']));
    setSetup(false);
  };

  const onDrop = (sourceSquare, targetSquare, piece) => {
    if (!game || game.finished) return false;
    const playerIds = ['p1', 'p2'];
    const pid = playerIds[game.currentPlayerIdx];

    const moveObj = {
      from: sourceSquare,
      to: targetSquare,
      promotion: piece[1].toLowerCase() ?? 'q',
    };

    const { newGame, claimed, error } = applyMove(game, moveObj, pid, playerIds);
    if (error) return false;

    if (claimed > 0) sfx.win();
    else sfx.line();

    setGame(newGame);
    return true;
  };

  const quit = async () => {
    if (!game.finished && await confirm({ title: 'End this match?', body: 'Progress will be lost.', confirmLabel: 'Quit' })) {
      setSetup(true);
      setGame(null);
    } else if (game.finished) {
      setSetup(true);
      setGame(null);
    }
  };

  if (setup) {
    return (
      <div className="fade-in max-w-sm mx-auto space-y-8 py-8">
        <div className="text-center">
          <h1 className="font-display text-4xl mb-2">Chess</h1>
          <p className="font-mono text-xs opacity-60 uppercase tracking-widest">Local Multiplayer</p>
        </div>
        <form onSubmit={handleStart} className="card space-y-6">
          <div className="space-y-4">
            <div>
              <label className="font-mono text-[0.65rem] tracking-widest uppercase opacity-60 mb-1 block">Player 1 Name (White)</label>
              <input value={p1Name} onChange={e => setP1Name(e.target.value)} className="w-full bg-black/5 dark:bg-white/5 border hairline px-3 py-2 font-display outline-none focus-ring" required maxLength={15} />
            </div>
            <div>
              <label className="font-mono text-[0.65rem] tracking-widest uppercase opacity-60 mb-1 block">Player 2 Name (Black)</label>
              <input value={p2Name} onChange={e => setP2Name(e.target.value)} className="w-full bg-black/5 dark:bg-white/5 border hairline px-3 py-2 font-display outline-none focus-ring" required maxLength={15} />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={flipBoard} onChange={e => setFlipBoard(e.target.checked)} />
              <span className="font-mono text-[0.65rem] tracking-widest uppercase opacity-80">Auto-flip board each turn</span>
            </label>
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

  const boardOrientation = flipBoard ? (p1Turn ? 'white' : 'black') : 'white';

  return (
    <div className="fade-in max-w-4xl mx-auto space-y-6">
      {dialog}
      {finished && !isDraw && <Confetti />}

      <div className="flex items-center justify-between border-b hairline pb-4">
        <div className="flex items-center gap-4">
          <button onClick={quit} className="btn-ghost" aria-label="Quit match">
            <X size={16} />
          </button>
          {!flipBoard && (
            <button onClick={() => setFlipBoard(true)} className="btn-ghost" title="Enable auto-flip">
              <RefreshCcw size={16} />
            </button>
          )}
        </div>
        {!finished && (
          <div className="font-mono text-[0.65rem] tracking-widest uppercase px-3 py-1 rounded" style={{
            background: p1Turn ? 'white' : 'black',
            color: p1Turn ? 'black' : 'white',
            border: '1px solid var(--hairline-strong)'
          }}>
            {p1Turn ? p1Name : p2Name}'s Turn
          </div>
        )}
      </div>

      <div className="flex justify-center py-8">
        <div className="w-full max-w-[500px]">
          <Chessboard
            position={game.fen}
            onPieceDrop={onDrop}
            boardOrientation={boardOrientation}
            customDarkSquareStyle={{ backgroundColor: 'var(--ochre)' }}
            customLightSquareStyle={{ backgroundColor: 'var(--paper-tint)' }}
          />
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
             <button onClick={() => setGame(createEmptyGame(['p1', 'p2']))} className="btn-primary">
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
