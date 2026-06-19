import React, { useState, useEffect } from 'react';

import { useNavigate } from 'react-router-dom';
import { X, Trophy } from 'lucide-react';
import { useConfirm } from '../components/ConfirmDialog';
import Confetti from '../components/Confetti';
import { sfx } from '../lib/sound';

import Board from '../components/district-exchange/Board';
import PlayerPanel from '../components/district-exchange/PlayerPanel';
import { ActionDialogs, ControlsPanel } from '../components/district-exchange/ActionDialogs';

import {
  createInitialState,
  rollDice,
  endTurn,
  buyProperty,
  declineBuy,
  bidAuction,
  passAuction,
  resolveCard,
  upgradeProperty,
  proposeTrade,
  acceptTrade,
  rejectTrade,
  cancelTrade,
  mortgageProperty,
  unmortgageProperty,
  sellUpgrade,
  declareBankruptcy,
  resolveDebt
} from '../lib/district-exchange/engine';
import { playAITurn, playAIAuction, evaluateIncomingAITrades } from '../lib/district-exchange/ai';

const DEFAULT_PLAYERS = [
  { id: 'p1', name: 'Player 1', isAI: false, color: '#E25C7A' }, // Crimson
  { id: 'p2', name: 'Bot 1', isAI: true, difficulty: 'balanced', color: '#D9A85A' }, // Ochre
  { id: 'p3', name: 'Bot 2', isAI: true, difficulty: 'aggressive', color: '#4B9460' }, // Forest
  { id: 'p4', name: 'Bot 3', isAI: true, difficulty: 'cautious', color: '#4A6984' }, // Ink
];

export default function LocalDistrictExchange() {
  const navigate = useNavigate();
  const [setup, setSetup] = useState(true);
  const [players, setPlayers] = useState(DEFAULT_PLAYERS.slice(0, 4));
  const [gameState, setGameState] = useState(null);
  const [isRolling, setIsRolling] = useState(false);
  const { confirm, dialog: confirmDialogEl } = useConfirm();

  // Handle AI Turns and Auctions
  useEffect(() => {
    if (!gameState || gameState.winner) return;

    const cp = gameState.players[gameState.currentPlayerIdx];

    // Handle AI evaluating incoming trades immediately
    if (gameState.tradeState) {
      const targetPlayer = gameState.players.find(p => p.id === gameState.tradeState.targetId);
      if (targetPlayer && targetPlayer.isAI) {
        const timer = setTimeout(() => {
          setGameState(prev => evaluateIncomingAITrades(prev));
        }, 1500); // UI delay to pretend thinking
        return () => clearTimeout(timer);
      }
    }

    // Handle AI Actions in Auction
    if (gameState.auctionState) {
      const activeAIs = gameState.auctionState.activeBidders.filter(pid => {
         const p = gameState.players.find(x => x.id === pid);
         return p && p.isAI;
      });
      if (activeAIs.length > 0) {
        const timer = setTimeout(() => {
          setGameState(prev => playAIAuction(prev));
        }, 1000); // 1s delay for UI
        return () => clearTimeout(timer);
      }
    }

    // Handle normal AI turn
    if (cp.isAI && !gameState.auctionState) {
      const timer = setTimeout(() => {
        setGameState(prev => {
          // Double check it's still AI's turn (in case of quick manual interventions or state updates)
          if (prev.players[prev.currentPlayerIdx].isAI && !prev.auctionState) {
            return playAITurn(prev);
          }
          return prev;
        });
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [gameState]);

  const handleStart = (e) => {
    e.preventDefault();
    if (players.length < 2) return;
    setGameState(createInitialState(players));
    setSetup(false);
  };

  const handleAddPlayer = () => {
    if (players.length >= 8) return;
    const newId = `p${players.length + 1}`;
    setPlayers([...players, { id: newId, name: `Player ${players.length + 1}`, isAI: false, difficulty: 'balanced', color: '#888888' }]);
  };

  const handleUpdatePlayer = (index, field, value) => {
    const newPlayers = [...players];
    newPlayers[index][field] = value;
    setPlayers(newPlayers);
  };

  const handleRemovePlayer = (index) => {
    const newPlayers = [...players];
    newPlayers.splice(index, 1);
    setPlayers(newPlayers);
  };

  const quit = async () => {
    if (!gameState?.winner && await confirm({ title: 'End this match?', body: 'Progress will be lost.', confirmLabel: 'Quit' })) {
      setSetup(true);
      setGameState(null);
    } else if (gameState?.winner) {
      setSetup(true);
      setGameState(null);
    }
  };

  const handleAction = (type, payload) => {
    if (!gameState) return;
    const cpId = gameState.players[gameState.currentPlayerIdx].id;

    setGameState(prev => {
      let next = { ...prev };
      switch (type) {
        case 'roll':
          sfx.piece();
          setIsRolling(true);
          // Pre-compute the roll results
          const computedNext = rollDice(next);
          // Set an intermediate state just to show dice rolling
          setGameState(prev => ({ ...prev, isRollingAnimation: true }));
          setTimeout(() => {
            setIsRolling(false);
            setGameState(prev => {
              // We replace the state with the actual computed roll state
              // To avoid state desync, we actually just apply rollDice to the latest state
              return rollDice(prev);
            });
          }, 3000);
          return prev; // don't mutate state right now in this switch
        case 'end':
          next = endTurn(next);
          break;
        case 'buy':
          sfx.claim();
          next = buyProperty(next, cpId, prev.pendingAction.spaceId);
          break;
        case 'decline':
          next = declineBuy(next);
          break;
        case 'resolveCard':
          sfx.notify();
          next = resolveCard(next);
          break;
        case 'bidAuction':
          sfx.piece();
          // payload is { amount, playerId }
          next = bidAuction(next, payload.playerId || cpId, payload.amount || payload);
          break;
        case 'passAuction':
          // payload is playerId
          next = passAuction(next, payload || cpId);
          break;
        case 'upgrade':
          sfx.claim();
          next = upgradeProperty(next, cpId, payload);
          break;
        case 'sellUpgrade':
          sfx.claim();
          next = sellUpgrade(next, cpId, payload);
          break;
        case 'proposeTrade':
          sfx.notify();
          next = proposeTrade(next, cpId, payload.targetId, payload.offer, payload.request);
          break;
        case 'acceptTrade':
          sfx.claim();
          next = acceptTrade(next, payload);
          break;
        case 'rejectTrade':
          next = rejectTrade(next);
          break;
        case 'cancelTrade':
          next = cancelTrade(next);
          break;
        case 'mortgage':
          sfx.claim();
          next = mortgageProperty(next, cpId, payload);
          break;
        case 'unmortgage':
          sfx.claim();
          next = unmortgageProperty(next, cpId, payload);
          break;
        case 'declareBankruptcy':
          sfx.piece();
          next = declareBankruptcy(next, cpId);
          break;
        case 'resolveDebt':
          next = resolveDebt(next, cpId);
          break;
        default:
          break;
      }
      return next;
    });
  };

  if (setup) {
    return (
      <div className="fade-in max-w-lg mx-auto space-y-8 py-8 px-4">
        <div className="text-center">
          <h1 className="font-display text-4xl mb-2">District Exchange</h1>
          <p className="font-mono text-xs opacity-60 uppercase tracking-widest">Local Multiplayer</p>
        </div>
        <div className="card space-y-6">
          <div className="space-y-4">
            {players.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="color"
                  value={p.color}
                  onChange={e => handleUpdatePlayer(i, 'color', e.target.value)}
                  className="w-10 h-10 p-0 border-0 cursor-pointer"
                />
                <input
                  value={p.name}
                  onChange={e => handleUpdatePlayer(i, 'name', e.target.value)}
                  className="flex-1 bg-black/5 dark:bg-white/5 border hairline px-3 py-2 font-display outline-none focus-ring"
                  required
                  maxLength={15}
                />
                <label className="flex items-center gap-2 font-mono text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={p.isAI}
                    onChange={e => handleUpdatePlayer(i, 'isAI', e.target.checked)}
                  />
                  Bot
                </label>
                {p.isAI && (
                  <select
                    value={p.difficulty || 'balanced'}
                    onChange={e => handleUpdatePlayer(i, 'difficulty', e.target.value)}
                    className="bg-black/5 dark:bg-white/5 border hairline text-xs font-mono p-1 rounded outline-none"
                  >
                    <option value="cautious">Cautious</option>
                    <option value="balanced">Balanced</option>
                    <option value="aggressive">Aggressive</option>
                  </select>
                )}
                {players.length > 2 && (
                  <button onClick={() => handleRemovePlayer(i)} className="p-2 opacity-50 hover:opacity-100" type="button">
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
          {players.length < 8 && (
            <button onClick={handleAddPlayer} className="btn-ghost w-full justify-center border border-dashed text-xs py-2">
              + Add Player
            </button>
          )}
          <button onClick={handleStart} className="btn-primary w-full justify-center">Start Match</button>
        </div>
      </div>
    );
  }

  // Determine which human's view we are showing. For hotseat, usually the current player if human.
  // If the current player is an AI, and an auction is happening, we might need to show the auction to the first active human.
  let interactingHumanId = gameState.players[gameState.currentPlayerIdx].id;

  if (gameState.auctionState) {
     const activeHumans = gameState.auctionState.activeBidders.filter(pid => {
       const p = gameState.players.find(x => x.id === pid);
       return p && !p.isAI;
     });
     if (activeHumans.length > 0) {
       interactingHumanId = activeHumans[0]; // First human gets the controls. A real hotseat would rotate this, but this is fine for now.
     }
  } else if (gameState.players[gameState.currentPlayerIdx].isAI) {
     // If it's AI turn, controls shouldn't show anyway
  }

  return (
    <div className="fade-in w-full max-w-7xl mx-auto space-y-4 px-2 pb-10">
      {confirmDialogEl}
      {gameState.winner && <Confetti />}

      <div className="flex items-center justify-between border-b hairline pb-2 mb-4">
        <div className="flex items-center gap-4">
          <button onClick={quit} className="btn-ghost" aria-label="Quit match">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <div className="w-full lg:w-[70%] flex-shrink-0 sticky top-4 relative">
           <Board gameState={gameState} isRolling={isRolling} />
           {!isRolling && <ActionDialogs gameState={gameState} currentPlayerId={interactingHumanId} onAction={handleAction} />}
           <ControlsPanel gameState={gameState} currentPlayerId={interactingHumanId} onAction={handleAction} isRolling={isRolling} />
        </div>

        <div className="w-full lg:w-[30%] space-y-4 max-h-[80vh] overflow-y-auto pr-2">
           <PlayerPanel gameState={gameState} currentPlayerId={interactingHumanId} />

           {/* Turn Log (Simplified) */}
           <div className="card p-4 mt-4 h-64 overflow-y-auto text-sm font-mono opacity-80">
             <div className="font-bold mb-2 uppercase tracking-widest text-xs">Game Log</div>
             {/* We don't have a rich log array populated in the engine yet, but we could render history here */}
             <div className="italic text-xs">Waiting for events...</div>
           </div>
        </div>
      </div>

      {gameState.winner && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 fade-in" role="dialog" aria-modal="true" aria-labelledby="winner-dialog-title">
           <div className="card max-w-sm w-full text-center space-y-6 py-10 fade-up">
              <Trophy size={48} className="mx-auto text-yellow-500 mb-4" />
              <h2 id="winner-dialog-title" className="font-display text-4xl">{gameState.players.find(p => p.id === gameState.winner)?.name} Wins!</h2>
              <p className="font-mono text-sm opacity-60">Monopoly Achieved.</p>
              <div className="pt-4">
                 <button onClick={quit} className="btn-primary">Return to Setup</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
