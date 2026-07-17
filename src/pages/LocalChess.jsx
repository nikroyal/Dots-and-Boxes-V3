import { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createEmptyGame, applyMove } from '../lib/chessLogic.js';
import { sfx } from '../lib/sound';
import { X, Trophy, RefreshCcw, Clock } from 'lucide-react';
import Confetti from '../components/Confetti';
import { useConfirm } from '../components/ConfirmDialog';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';

// Optimization (Bolt): Extracted static style objects to module-level constants to prevent creating new object references on every 1Hz ticker render.
const CUSTOM_DARK_SQUARE_STYLE = { backgroundColor: 'var(--ochre)' };
const CUSTOM_LIGHT_SQUARE_STYLE = { backgroundColor: 'var(--paper-tint)' };
// Optimization (Bolt): Wrapped heavy Chessboard component in React.memo to prevent unnecessary re-renders driven by the parent's 1Hz ticker.
const MemoizedChessboard = memo(Chessboard);

export default function LocalChess() {
  const navigate = useNavigate();
  const [setup, setSetup] = useState(true);
  const [p1Name, setP1Name] = useState('Player 1 (White)');
  const [p2Name, setP2Name] = useState('Player 2 (Black)');
  const [flipBoard, setFlipBoard] = useState(true);
  const [useTimer, setUseTimer] = useState(false);
  const [timerMins, setTimerMins] = useState(5);

  const [game, setGame] = useState(null);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [optionSquares, setOptionSquares] = useState({});
  const [pendingGame, setPendingGame] = useState(null);
  const pendingTimeoutRef = useRef(null);
  const { confirm, dialog: confirmDialogEl } = useConfirm();

  const [turnTimerMs, setTurnTimerMs] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [turnStartedAtMs, setTurnStartedAtMs] = useState(0);

  useEffect(() => {
    if (!setup && useTimer && game && !game.finished && !pendingGame) {
      const interval = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(interval);
    }
  }, [setup, useTimer, game, pendingGame]);

  useEffect(() => {
    if (useTimer && game && !game.finished && !pendingGame) {
      const turnTimeoutMs = timerMins * 60 * 1000;
      const elapsed = Date.now() - turnStartedAtMs;
      if (elapsed > turnTimeoutMs) {
        // Time is up, current player loses
        const newGame = { ...game, finished: true, winnerIdx: game.currentPlayerIdx === 0 ? 1 : 0 };
        setGame(newGame);
        sfx.win(); // or loss sound depending on who is playing
      }
    }
  }, [now, useTimer, game, pendingGame, turnStartedAtMs, timerMins]);

  const handleStart = (e) => {
    e.preventDefault();
    setGame(createEmptyGame(['p1', 'p2']));
    if (useTimer) {
      setTurnStartedAtMs(Date.now());
    }
    setSetup(false);
  };

  const makeMoveObj = useCallback((sourceSquare, targetSquare, piece) => {
    if (!game || game.finished) return false;
    const playerIds = ['p1', 'p2'];
    const pid = playerIds[game.currentPlayerIdx];

    const moveObj = {
      from: sourceSquare,
      to: targetSquare,
      promotion: piece ? (piece[1].toLowerCase() === 'p' ? 'q' : piece[1].toLowerCase()) : 'q',
    };

    const { newGame, claimed, error } = applyMove(game, moveObj, pid, playerIds);
    if (error) return false;

    if (claimed > 0) sfx.win();
    else sfx.line();

    setPendingGame(newGame);
    setSelectedSquare(null);
    setOptionSquares({});

    if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
    pendingTimeoutRef.current = setTimeout(() => {
      setGame(newGame);
      if (useTimer) {
        setTurnStartedAtMs(Date.now());
      }
      setPendingGame(null);
      pendingTimeoutRef.current = null;
    }, 3000);

    return true;
  }, [game, pendingGame, useTimer]);

  const undoMove = () => {
    if (pendingTimeoutRef.current) {
      clearTimeout(pendingTimeoutRef.current);
      pendingTimeoutRef.current = null;
    }
    setPendingGame(null);
  };

  const onDrop = useCallback((sourceSquare, targetSquare, piece) => {
    if (pendingGame) return false;
    return makeMoveObj(sourceSquare, targetSquare, piece);
  }, [pendingGame, makeMoveObj]);

  const onSquareClick = useCallback((square, piece) => {
    if (!game || game.finished) return;
    if (pendingGame) return; // Prevent interaction during undo window

    if (optionSquares[square]) {
      makeMoveObj(selectedSquare, square, undefined); // If clicking an option, piece is not provided directly, logic infers 'q' for promotion.
      return;
    }

    const chess = new Chess(game.fen);
    const moves = chess.moves({ square, verbose: true });

    if (moves.length === 0) {
      setSelectedSquare(null);
      setOptionSquares({});
      return;
    }

    setSelectedSquare(square);
    const newOptions = {};
    moves.forEach(move => {
      newOptions[move.to] = {
        background: 'radial-gradient(circle, rgba(0,255,0,.2) 25%, transparent 30%)',
        borderRadius: '50%'
      };
    });
    setOptionSquares(newOptions);
  }, [game, pendingGame, optionSquares, selectedSquare, makeMoveObj]);

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
              <label htmlFor="p1-name" className="font-mono text-[0.65rem] tracking-widest uppercase opacity-60 mb-1 block">Player 1 Name (White)</label>
              <input id="p1-name" value={p1Name} onChange={e => setP1Name(e.target.value)} className="w-full bg-black/5 dark:bg-white/5 border hairline px-3 py-2 font-display outline-none focus-ring" required maxLength={15} />
            </div>
            <div>
              <label htmlFor="p2-name" className="font-mono text-[0.65rem] tracking-widest uppercase opacity-60 mb-1 block">Player 2 Name (Black)</label>
              <input id="p2-name" value={p2Name} onChange={e => setP2Name(e.target.value)} className="w-full bg-black/5 dark:bg-white/5 border hairline px-3 py-2 font-display outline-none focus-ring" required maxLength={15} />
            </div>
            <label htmlFor="flip-board" className="flex items-center gap-2 cursor-pointer">
              <input id="flip-board" type="checkbox" checked={flipBoard} onChange={e => setFlipBoard(e.target.checked)} />
              <span className="font-mono text-[0.65rem] tracking-widest uppercase opacity-80">Auto-flip board each turn</span>
            </label>

            <div className="border hairline p-3 space-y-3">
              <label htmlFor="use-timer" className="flex items-center gap-2 cursor-pointer">
                <input id="use-timer" type="checkbox" checked={useTimer} onChange={e => setUseTimer(e.target.checked)} />
                <span className="font-mono text-[0.65rem] tracking-widest uppercase opacity-80">Use Timer (per turn)</span>
              </label>
              {useTimer && (
                <div>
                  <label htmlFor="timer-mins" className="font-mono text-[0.65rem] tracking-widest uppercase opacity-60 mb-1 block">Minutes per turn</label>
                  <input id="timer-mins" type="number" value={timerMins} onChange={e => setTimerMins(Math.max(1, parseInt(e.target.value, 10) || 1))} className="w-full bg-black/5 dark:bg-white/5 border hairline px-3 py-2 font-display outline-none focus-ring" min={1} required />
                </div>
              )}
              <div className="font-mono text-[0.55rem] tracking-widest uppercase opacity-50">Note: Both players should agree on the timer settings.</div>
            </div>
          </div>
          <button type="submit" className="btn-primary w-full justify-center">Start Match</button>
        </form>
      </div>
    );
  }

  const displayGame = pendingGame || game;
  const finished = displayGame.finished;
  const isDraw = finished && displayGame.winnerIdx === -1;
  const winnerName = isDraw ? 'Draw' : (displayGame.winnerIdx === 0 ? p1Name : p2Name);
  const p1Turn = displayGame.currentPlayerIdx === 0;

  const boardOrientation = flipBoard ? (p1Turn ? 'white' : 'black') : 'white';

  const lastMove = displayGame.moves && displayGame.moves.length > 0 ? displayGame.moves[displayGame.moves.length - 1] : null;

  // Optimization (Bolt): Memoized derived object props using useMemo to maintain a stable reference across the 1Hz ticker updates.
  const customSquareStyles = useMemo(() => ({
    ...(lastMove ? {
      [lastMove.from]: { backgroundColor: 'rgba(255, 255, 0, 0.4)' },
      [lastMove.to]: { backgroundColor: 'rgba(255, 255, 0, 0.4)' }
    } : {}),
    ...optionSquares,
    ...(selectedSquare ? { [selectedSquare]: { backgroundColor: 'rgba(255, 0, 0, 0.4)' } } : {})
  }), [lastMove, optionSquares, selectedSquare]);

  return (
    <div className="fade-in max-w-4xl mx-auto space-y-6">
      {confirmDialogEl}
      {finished && !isDraw && <Confetti />}

      <div className="flex flex-col sm:flex-row items-center justify-between border-b hairline pb-4 gap-4">
        <div className="flex items-center gap-4">
          <button onClick={quit} className="btn-ghost" aria-label="Quit match">
            <X size={16} />
          </button>
          {!flipBoard && (
            <button onClick={() => setFlipBoard(true)} className="btn-ghost" title="Enable auto-flip" aria-label="Enable auto-flip">
              <RefreshCcw size={16} />
            </button>
          )}
        </div>
        {!finished && (
          <div className="flex items-center gap-4">
            {useTimer && (
              <div className="flex items-center gap-2 font-mono text-sm tabular-nums" style={{ color: 'var(--ochre)' }}>
                <Clock size={14} />
                {(() => {
                  const remainingMs = Math.max(0, timerMins * 60 * 1000 - (now - turnStartedAtMs));
                  const secs = Math.ceil(remainingMs / 1000);
                  const m = Math.floor(secs / 60);
                  const s = secs % 60;
                  return `${m}:${s.toString().padStart(2, '0')}`;
                })()}
              </div>
            )}
            <div className="font-mono text-[0.65rem] tracking-widest uppercase px-3 py-1 rounded" style={{
              background: p1Turn ? 'white' : 'black',
              color: p1Turn ? 'black' : 'white',
              border: '1px solid var(--hairline-strong)'
            }}>
              {p1Turn ? p1Name : p2Name}'s Turn
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-center py-8">
        <div className="w-full max-w-[500px]">
          <MemoizedChessboard
            position={displayGame.fen}
            onPieceDrop={onDrop}
            onSquareClick={onSquareClick}
            boardOrientation={boardOrientation}
            customDarkSquareStyle={CUSTOM_DARK_SQUARE_STYLE}
            customLightSquareStyle={CUSTOM_LIGHT_SQUARE_STYLE}
            customSquareStyles={customSquareStyles}
          />
        </div>
      </div>

      {pendingGame && (
        <div className="flex justify-center mt-4 fade-in">
          <button onClick={undoMove} className="btn-ghost text-sm py-1 px-3 border border-current rounded">
            Undo Move (3s)
          </button>
        </div>
      )}

      {finished && !pendingGame && (
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
