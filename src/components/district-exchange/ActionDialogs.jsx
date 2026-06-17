import React, { useState } from 'react';
import { getPropertiesInSet } from '../../lib/district-exchange/board';

export function ActionDialogs({ gameState, currentPlayerId, onAction }) {
  if (!gameState) return null;

  const cp = gameState.players[gameState.currentPlayerIdx];
  const isMyTurn = cp.id === currentPlayerId && !cp.isAI;

  return (
    <>
      <PendingActionDialog gameState={gameState} isMyTurn={isMyTurn} onAction={onAction} />
      <AuctionDialog gameState={gameState} currentPlayerId={currentPlayerId} onAction={onAction} />
      <PendingTradeDialog gameState={gameState} currentPlayerId={currentPlayerId} onAction={onAction} />
    </>
  );
}

function PendingTradeDialog({ gameState, currentPlayerId, onAction }) {
  if (!gameState.tradeState) return null;
  const { proposerId, targetId, offer, request } = gameState.tradeState;

  const amITarget = currentPlayerId === targetId;
  const amIProposer = currentPlayerId === proposerId;

  if (!amITarget && !amIProposer) return null;

  const proposer = gameState.players.find(p => p.id === proposerId);
  const target = gameState.players.find(p => p.id === targetId);

  const renderItems = (items, playerName) => (
    <div className="bg-black/5 dark:bg-white/5 p-3 rounded text-left space-y-1">
      <div className="font-mono text-xs uppercase opacity-60 mb-2">{playerName} receives:</div>
      {items.cash > 0 && <div>¤{items.cash}</div>}
      {items.getOutOfJailCards > 0 && <div>{items.getOutOfJailCards}x Release Card</div>}
      {items.properties.map(pid => {
         const space = gameState.boardSpaces[pid];
         return <div key={pid} className="font-bold">{space.name}</div>;
      })}
      {items.cash === 0 && items.getOutOfJailCards === 0 && items.properties.length === 0 && (
        <div className="opacity-50 italic">Nothing</div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="card max-w-md w-full p-6 text-center space-y-6">
        <h2 className="font-display text-2xl">Proposed Trade</h2>
        <div className="text-sm opacity-80">
          {proposer.name} proposed a trade to {target.name}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {renderItems(offer, target.name)}
          {renderItems(request, proposer.name)}
        </div>

        {amITarget ? (
          <div className="flex gap-4 pt-4 border-t hairline">
             <button onClick={() => onAction('acceptTrade', targetId)} className="btn-primary flex-1">Accept Deal</button>
             <button onClick={() => onAction('rejectTrade')} className="btn-ghost flex-1">Reject</button>
          </div>
        ) : (
          <div className="flex gap-4 pt-4 border-t hairline">
             <div className="flex-1 py-2 opacity-60 text-sm">Waiting for {target.name}...</div>
             <button onClick={() => onAction('cancelTrade')} className="btn-ghost flex-1">Cancel Offer</button>
          </div>
        )}
      </div>
    </div>
  );
}

function PendingActionDialog({ gameState, isMyTurn, onAction }) {
  if (!gameState.pendingAction || !isMyTurn) return null;
  const action = gameState.pendingAction;

  if (action.type === 'buy') {
    const space = gameState.boardSpaces[action.spaceId];
    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
        <div className="card max-w-sm w-full p-6 text-center space-y-6">
          <h2 className="font-display text-2xl">Unowned Property</h2>
          <div className="py-4 px-6 border-2 rounded-lg" style={{ borderColor: 'var(--border)' }}>
            <div className="text-xl font-bold mb-2">{space.name}</div>
            <div className="font-mono text-lg text-green-600 dark:text-green-400">Price: ¤{space.price}</div>
          </div>
          <div className="flex gap-4">
             <button onClick={() => onAction('buy')} className="btn-primary flex-1">Buy Property</button>
             <button onClick={() => onAction('decline')} className="btn-ghost flex-1">Auction</button>
          </div>
        </div>
      </div>
    );
  }

  if (action.type === 'card') {
    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
        <div className={`card max-w-sm w-full p-8 text-center space-y-6 border-t-8 shadow-2xl ${action.deckType === 'opportunity' ? 'border-orange-500' : 'border-blue-500'}`}>
          <h2 className="font-display text-3xl uppercase tracking-widest">{action.deckType}</h2>
          <div className="py-8 px-4 text-xl font-medium font-sans">
            {action.card.text}
          </div>
          <button onClick={() => onAction('resolveCard')} className="btn-primary w-full">Continue</button>
        </div>
      </div>
    );
  }

  return null;
}

function AuctionDialog({ gameState, currentPlayerId, onAction }) {
  if (!gameState.auctionState) return null;
  const auction = gameState.auctionState;
  const space = gameState.boardSpaces[auction.spaceId];

  // Find all active human bidders for hotseat
  const activeHumans = auction.activeBidders
    .map(id => gameState.players.find(p => p.id === id))
    .filter(p => p && !p.isAI && !p.bankrupt);

  const handleBid = (playerId, amount) => {
    // In local hotseat, we pass the playerId via payload for bidding
    // However, onAction's LocalDistrictExchange implementation assumes the current interacting human.
    // Wait, LocalDistrictExchange handles bidAuction by picking `payload` as amount, and `cpId` as active human.
    // Let's modify LocalDistrictExchange to accept { amount, playerId } so any human can bid.
    onAction('bidAuction', { amount, playerId });
  };

  const handlePass = (playerId) => {
    onAction('passAuction', playerId);
  };

  const activeBidderCount = auction.activeBidders.length;
  const humanWaitState = activeHumans.length === 0;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="card max-w-2xl w-full p-6 flex flex-col items-center space-y-6 shadow-2xl">
        <h2 className="font-display text-3xl text-red-500 uppercase tracking-widest animate-pulse">Live Auction</h2>

        <div className="text-center">
          <div className="text-2xl font-bold mb-1">{space.name}</div>
          <div className="font-mono text-sm opacity-60">Base Price: ¤{space.price}</div>
        </div>

        <div className="w-full max-w-sm bg-black/5 dark:bg-white/5 rounded p-4 text-center">
          <div className="font-mono text-xs uppercase tracking-widest opacity-60 mb-2">Current Highest Bid</div>
          <div className="font-mono text-4xl text-green-600 dark:text-green-400 font-bold mb-2">¤{auction.highestBid}</div>
          {auction.highestBidder && (
            <div className="text-sm font-bold">
              {gameState.players.find(p => p.id === auction.highestBidder)?.name}
            </div>
          )}
        </div>

        <div className="text-sm opacity-80 w-full text-center border-b hairline pb-4">
          Active Bidders remaining: {activeBidderCount}
        </div>

        {humanWaitState ? (
          <div className="text-center font-mono opacity-50 py-4 w-full">
            Waiting for AI bidders...
          </div>
        ) : (
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeHumans.map(p => {
              const isHighest = auction.highestBidder === p.id;
              const nextBid10 = auction.highestBid + 10;
              const nextBid50 = auction.highestBid + 50;

              return (
                <div key={p.id} className={`card p-3 flex flex-col gap-3 ${isHighest ? 'ring-2 ring-primary bg-primary/5' : ''}`}>
                  <div className="flex justify-between items-center">
                    <span className="font-bold">{p.name}</span>
                    <span className="font-mono text-xs opacity-60">¤{p.cash}</span>
                  </div>

                  {isHighest ? (
                    <div className="text-center font-mono text-primary text-sm py-2">Highest Bidder</div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleBid(p.id, nextBid10)}
                        disabled={p.cash < nextBid10}
                        className="btn-primary flex-1 text-xs px-2 py-1"
                      >
                        +10
                      </button>
                      <button
                        onClick={() => handleBid(p.id, nextBid50)}
                        disabled={p.cash < nextBid50}
                        className="btn-primary flex-1 text-xs px-2 py-1"
                      >
                        +50
                      </button>
                    </div>
                  )}

                  <button
                    onClick={() => handlePass(p.id)}
                    className="btn-ghost w-full text-xs py-1"
                  >
                    Pass
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function ControlsPanel({ gameState, currentPlayerId, onAction }) {
  const [showUpgrades, setShowUpgrades] = useState(false);
  const [showTrade, setShowTrade] = useState(false);
  const [showMortgages, setShowMortgages] = useState(false);

  if (!gameState) return null;
  const cp = gameState.players[gameState.currentPlayerIdx];
  const isMyTurn = cp.id === currentPlayerId && !cp.isAI;

  const inDebt = gameState.debtState && gameState.debtState.playerId === currentPlayerId;

  const handleRoll = () => onAction('roll');
  const handleEnd = () => onAction('end');
  const handleBankruptcy = () => {
    if (window.confirm("Are you sure you want to declare bankruptcy? You will be eliminated from the game.")) {
      onAction('declareBankruptcy', currentPlayerId);
    }
  };
  const handleResolveDebt = () => onAction('resolveDebt', currentPlayerId);

  // Check if I can build or sell
  const me = gameState.players.find(p => p.id === currentPlayerId);
  let canBuildOrSell = false;
  if (me) {
     const sets = ['harbor', 'neon', 'market', 'gardens', 'riverfront', 'foundry', 'summit', 'skyline'];
     for (const setId of sets) {
       const setProps = getPropertiesInSet(setId);
       const hasMonopoly = setProps.length > 0 && setProps.every(id => me.properties.includes(id));
       if (hasMonopoly) {
         canBuildOrSell = true;
         break;
       }
     }
  }

  return (
    <div className="flex gap-4 justify-center items-center py-4 flex-wrap">
      {gameState.turnPhase === 'roll' && isMyTurn && !gameState.pendingAction && !gameState.auctionState && !inDebt && (
        <button onClick={handleRoll} className="btn-primary px-8 py-3 text-lg shadow-lg hover:scale-105 transition-transform">
          Roll Dice
        </button>
      )}
      {gameState.turnPhase === 'end' && isMyTurn && !gameState.pendingAction && !gameState.auctionState && !inDebt && (
        <button onClick={handleEnd} className="btn-primary px-8 py-3 text-lg shadow-lg hover:scale-105 transition-transform">
          End Turn
        </button>
      )}

      {inDebt && me && (
        <div className="flex gap-2 items-center bg-red-500/10 border border-red-500/50 p-2 rounded">
          <div className="text-red-500 font-bold uppercase text-sm mr-2">In Debt!</div>
          {me.cash >= 0 ? (
            <button onClick={handleResolveDebt} className="btn-primary bg-green-500 hover:bg-green-600 border-none shadow-none text-white text-xs">
              Resolve Debt
            </button>
          ) : (
            <button onClick={handleBankruptcy} className="btn-ghost text-red-500 hover:bg-red-500/20 text-xs">
              Declare Bankruptcy
            </button>
          )}
        </div>
      )}

      {!isMyTurn && !gameState.pendingAction && !gameState.auctionState && !gameState.winner && !inDebt && (
        <div className="font-mono text-sm uppercase tracking-widest opacity-60">
          Waiting for {cp.name}...
        </div>
      )}
      {gameState.winner && (
         <div className="font-display text-2xl text-green-500 font-bold uppercase animate-pulse">
           {gameState.players.find(p => p.id === gameState.winner)?.name} Wins!
         </div>
      )}

      {canBuildOrSell && !gameState.auctionState && !gameState.pendingAction && !gameState.winner && (
         <>
           <button onClick={() => setShowUpgrades(true)} className="btn-ghost">
             Upgrades
           </button>
           {showUpgrades && (
             <UpgradeDialog gameState={gameState} currentPlayerId={currentPlayerId} onClose={() => setShowUpgrades(false)} onAction={onAction} />
           )}
         </>
      )}

      {isMyTurn && !gameState.auctionState && !gameState.pendingAction && !gameState.winner && (
         <>
           <button onClick={() => setShowTrade(true)} className="btn-ghost">
             Trade
           </button>
           {showTrade && (
             <ProposeTradeDialog gameState={gameState} currentPlayerId={currentPlayerId} onClose={() => setShowTrade(false)} onAction={onAction} />
           )}
         </>
      )}

      {isMyTurn && me && me.properties.length > 0 && !gameState.auctionState && !gameState.pendingAction && !gameState.winner && (
         <>
           <button onClick={() => setShowMortgages(true)} className="btn-ghost">
             Mortgages
           </button>
           {showMortgages && (
             <MortgageDialog gameState={gameState} currentPlayerId={currentPlayerId} onClose={() => setShowMortgages(false)} onAction={onAction} />
           )}
         </>
      )}
    </div>
  );
}

function MortgageDialog({ gameState, currentPlayerId, onClose, onAction }) {
  const me = gameState.players.find(p => p.id === currentPlayerId);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="card max-w-lg w-full p-6 space-y-6 max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center border-b pb-4 border-black/10 dark:border-white/10">
          <h2 className="font-display text-2xl">Manage Mortgages</h2>
          <button onClick={onClose} className="btn-ghost px-3 py-1">Close</button>
        </div>

        <div className="font-mono text-sm opacity-60">Cash Available: ¤{me.cash}</div>

        <div className="space-y-3 overflow-y-auto flex-1 pr-2">
          {me.properties.map(pid => {
             const space = gameState.boardSpaces[pid];
             const isMortgaged = me.mortgaged.includes(pid);
             const hasUpgrades = me.upgrades[pid] > 0;
             const mortgageValue = Math.floor(space.price / 2);
             const unmortgageCost = Math.floor(mortgageValue * 1.1);

             return (
               <div key={pid} className={`flex justify-between items-center p-3 rounded ${isMortgaged ? 'bg-red-500/10 border border-red-500/30' : 'bg-black/5 dark:bg-white/5'}`}>
                 <div>
                   <div className="font-bold">{space.name}</div>
                   {isMortgaged ? (
                     <div className="text-xs text-red-500 uppercase tracking-widest font-mono mt-1">Mortgaged</div>
                   ) : (
                     <div className="text-xs opacity-60">Mortgage Value: ¤{mortgageValue}</div>
                   )}
                 </div>

                 {isMortgaged ? (
                   <button
                     onClick={() => onAction('unmortgage', pid)}
                     disabled={me.cash < unmortgageCost}
                     className="btn-primary text-sm px-4 py-2"
                   >
                     Unmortgage (¤{unmortgageCost})
                   </button>
                 ) : (
                   <button
                     onClick={() => onAction('mortgage', pid)}
                     disabled={hasUpgrades}
                     className="btn-ghost text-sm px-4 py-2"
                     title={hasUpgrades ? "Must sell upgrades first" : ""}
                   >
                     Mortgage (+¤{mortgageValue})
                   </button>
                 )}
               </div>
             );
          })}
        </div>
      </div>
    </div>
  );
}

function ProposeTradeDialog({ gameState, currentPlayerId, onClose, onAction }) {
  const [targetId, setTargetId] = useState('');

  const [offerCash, setOfferCash] = useState(0);
  const [offerProps, setOfferProps] = useState([]);
  const [offerCards, setOfferCards] = useState(0);

  const [reqCash, setReqCash] = useState(0);
  const [reqProps, setReqProps] = useState([]);
  const [reqCards, setReqCards] = useState(0);

  const me = gameState.players.find(p => p.id === currentPlayerId);
  const otherPlayers = gameState.players.filter(p => p.id !== currentPlayerId && !p.bankrupt);

  const target = gameState.players.find(p => p.id === targetId);

  const toggleProp = (pid, isOffer) => {
    if (isOffer) {
      setOfferProps(prev => prev.includes(pid) ? prev.filter(x => x !== pid) : [...prev, pid]);
    } else {
      setReqProps(prev => prev.includes(pid) ? prev.filter(x => x !== pid) : [...prev, pid]);
    }
  };

  const handlePropose = () => {
    if (!targetId) return;
    onAction('proposeTrade', {
      targetId,
      offer: { cash: parseInt(offerCash) || 0, properties: offerProps, getOutOfJailCards: parseInt(offerCards) || 0 },
      request: { cash: parseInt(reqCash) || 0, properties: reqProps, getOutOfJailCards: parseInt(reqCards) || 0 }
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
      <div className="card max-w-2xl w-full p-6 space-y-6 max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center border-b pb-4 hairline">
          <h2 className="font-display text-2xl">Propose Trade</h2>
          <button onClick={onClose} className="btn-ghost px-3 py-1">Close</button>
        </div>

        <div className="flex items-center gap-4">
          <label className="font-mono text-sm">Trading Partner:</label>
          <select
            value={targetId}
            onChange={(e) => {
              setTargetId(e.target.value);
              setReqProps([]);
              setReqCash(0);
              setReqCards(0);
            }}
            className="bg-black/10 dark:bg-white/10 border-none p-2 rounded outline-none flex-1"
          >
            <option value="" disabled>Select Player</option>
            {otherPlayers.map(p => (
              <option key={p.id} value={p.id}>{p.name} {p.isAI ? '(AI)' : ''}</option>
            ))}
          </select>
        </div>

        {targetId && (
          <div className="grid grid-cols-2 gap-6 flex-1 overflow-y-auto pr-2">
            {/* My Offer */}
            <div className="space-y-4">
              <h3 className="font-bold border-b hairline pb-2">Your Offer</h3>

              <div>
                <label className="text-xs opacity-60 block mb-1">Cash (Max: ¤{me.cash})</label>
                <input
                  type="number"
                  min="0"
                  max={me.cash}
                  value={offerCash}
                  onChange={e => setOfferCash(e.target.value)}
                  className="w-full bg-black/5 dark:bg-white/5 p-2 rounded border hairline"
                />
              </div>

              {me.getOutOfJailCards > 0 && (
                <div>
                  <label className="text-xs opacity-60 block mb-1">Release Cards (Max: {me.getOutOfJailCards})</label>
                  <input
                    type="number"
                    min="0"
                    max={me.getOutOfJailCards}
                    value={offerCards}
                    onChange={e => setOfferCards(e.target.value)}
                    className="w-full bg-black/5 dark:bg-white/5 p-2 rounded border hairline"
                  />
                </div>
              )}

              <div>
                <label className="text-xs opacity-60 block mb-2">Properties</label>
                {me.properties.length === 0 ? <div className="text-sm opacity-50">None</div> : (
                  <div className="space-y-1">
                    {me.properties.map(pid => (
                      <label key={pid} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-black/5 p-1 rounded">
                        <input type="checkbox" checked={offerProps.includes(pid)} onChange={() => toggleProp(pid, true)} />
                        {gameState.boardSpaces[pid].name}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Target's Assets */}
            <div className="space-y-4">
              <h3 className="font-bold border-b hairline pb-2">{target.name}'s Assets</h3>

              <div>
                <label className="text-xs opacity-60 block mb-1">Cash Request (Max: ¤{target.cash})</label>
                <input
                  type="number"
                  min="0"
                  max={target.cash}
                  value={reqCash}
                  onChange={e => setReqCash(e.target.value)}
                  className="w-full bg-black/5 dark:bg-white/5 p-2 rounded border hairline"
                />
              </div>

              {target.getOutOfJailCards > 0 && (
                <div>
                  <label className="text-xs opacity-60 block mb-1">Release Cards (Max: {target.getOutOfJailCards})</label>
                  <input
                    type="number"
                    min="0"
                    max={target.getOutOfJailCards}
                    value={reqCards}
                    onChange={e => setReqCards(e.target.value)}
                    className="w-full bg-black/5 dark:bg-white/5 p-2 rounded border hairline"
                  />
                </div>
              )}

              <div>
                <label className="text-xs opacity-60 block mb-2">Properties Request</label>
                {target.properties.length === 0 ? <div className="text-sm opacity-50">None</div> : (
                  <div className="space-y-1">
                    {target.properties.map(pid => (
                      <label key={pid} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-black/5 p-1 rounded">
                        <input type="checkbox" checked={reqProps.includes(pid)} onChange={() => toggleProp(pid, false)} />
                        {gameState.boardSpaces[pid].name}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="pt-4 border-t hairline flex justify-end">
          <button
            onClick={handlePropose}
            disabled={!targetId || (offerCash === 0 && reqCash === 0 && offerProps.length === 0 && reqProps.length === 0 && offerCards === 0 && reqCards === 0)}
            className="btn-primary px-8"
          >
            Send Offer
          </button>
        </div>
      </div>
    </div>
  );
}

function UpgradeDialog({ gameState, currentPlayerId, onClose, onAction }) {
  const me = gameState.players.find(p => p.id === currentPlayerId);

  // Find properties where player has a monopoly
  const upgradeableProperties = [];
  const sellableProperties = [];
  const sets = ['harbor', 'neon', 'market', 'gardens', 'riverfront', 'foundry', 'summit', 'skyline'];

  for (const setId of sets) {
    const setProps = getPropertiesInSet(setId);
    const hasMonopoly = setProps.length > 0 && setProps.every(id => me.properties.includes(id));

    if (hasMonopoly) {
      // Must build evenly. Find min level in set.
      const levels = setProps.map(id => me.upgrades[id] || 0);
      const minLevel = Math.min(...levels);
      const maxLevel = Math.max(...levels);

      for (const pid of setProps) {
        const space = gameState.boardSpaces[pid];
        const currentLevel = me.upgrades[pid] || 0;

        // Can only build if it's equal to minLevel and < 4
        if (currentLevel === minLevel && currentLevel < 4) {
          upgradeableProperties.push({
             id: pid,
             space,
             currentLevel,
             cost: space.upgradeCost
          });
        }

        // Can only sell if it's equal to maxLevel and > 0
        if (currentLevel === maxLevel && currentLevel > 0) {
          sellableProperties.push({
             id: pid,
             space,
             currentLevel,
             sellValue: Math.floor(space.upgradeCost / 2)
          });
        }
      }
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
      <div className="card max-w-lg w-full p-6 space-y-6 max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center border-b pb-4 hairline">
          <h2 className="font-display text-2xl">Property Upgrades</h2>
          <button onClick={onClose} className="btn-ghost px-3 py-1">Close</button>
        </div>

        <div className="font-mono text-sm opacity-60">Cash Available: ¤{me.cash}</div>

        <div className="flex-1 overflow-y-auto pr-2 space-y-6">
          <div>
            <h3 className="font-bold border-b hairline pb-2 mb-3">Buy Upgrades</h3>
            {upgradeableProperties.length === 0 ? (
              <div className="text-sm opacity-60 italic">No valid properties to upgrade (must build evenly).</div>
            ) : (
              <div className="space-y-2">
                {upgradeableProperties.map(prop => (
                  <div key={prop.id} className="flex justify-between items-center bg-black/5 dark:bg-white/5 p-2 rounded">
                    <div>
                      <div className="font-bold text-sm">{prop.space.name}</div>
                      <div className="text-xs opacity-60">Lvl {prop.currentLevel} → {prop.currentLevel + 1}</div>
                    </div>
                    <button
                      onClick={() => onAction('upgrade', prop.id)}
                      disabled={me.cash < prop.cost}
                      className="btn-primary text-xs px-3 py-1.5"
                    >
                      Buy (¤{prop.cost})
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="font-bold border-b hairline pb-2 mb-3">Sell Upgrades</h3>
            {sellableProperties.length === 0 ? (
              <div className="text-sm opacity-60 italic">No upgrades available to sell.</div>
            ) : (
              <div className="space-y-2">
                {sellableProperties.map(prop => (
                  <div key={prop.id} className="flex justify-between items-center bg-black/5 dark:bg-white/5 p-2 rounded">
                    <div>
                      <div className="font-bold text-sm">{prop.space.name}</div>
                      <div className="text-xs opacity-60">Lvl {prop.currentLevel} → {prop.currentLevel - 1}</div>
                    </div>
                    <button
                      onClick={() => onAction('sellUpgrade', prop.id)}
                      className="btn-primary bg-red-500 hover:bg-red-600 text-white text-xs px-3 py-1.5 border-none shadow-none"
                    >
                      Sell (+¤{prop.sellValue})
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
