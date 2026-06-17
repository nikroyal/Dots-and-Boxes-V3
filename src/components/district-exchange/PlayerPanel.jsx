import React from 'react';
import { PROPERTY_SETS, BOARD_SPACES } from '../../lib/district-exchange/board';

export default function PlayerPanel({ gameState, currentPlayerId }) {
  if (!gameState) return null;

  return (
    <div className="flex flex-col gap-4 w-full">
      {gameState.players.map((player, idx) => {
        const isCurrentTurn = idx === gameState.currentPlayerIdx;
        const isMe = player.id === currentPlayerId;

        return (
          <div
            key={player.id}
            className={`card p-4 flex flex-col gap-2 transition-all duration-300 ${isCurrentTurn ? 'ring-2 ring-primary scale-[1.02] shadow-xl' : 'opacity-80'} ${player.bankrupt ? 'grayscale opacity-50' : ''}`}
            style={{ borderTop: `4px solid ${player.color}` }}
          >
            <div className="flex justify-between items-start gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-bold text-lg flex items-center gap-2 truncate">
                  <span className="truncate">{player.name}</span>
                  {isMe && <span className="text-[0.6rem] font-mono bg-primary/20 text-primary px-1.5 py-0.5 rounded uppercase tracking-wider flex-shrink-0">You</span>}
                  {player.isAI && <span className="text-[0.6rem] font-mono bg-gray-500/20 text-gray-400 px-1.5 py-0.5 rounded uppercase tracking-wider flex-shrink-0">Bot</span>}
                </h3>
                {player.inJail && (
                  <span className="text-xs font-mono text-red-500 uppercase tracking-widest block truncate">In Holding Cell</span>
                )}
                {player.bankrupt && (
                  <span className="text-xs font-mono text-red-500 uppercase tracking-widest font-bold block truncate">Bankrupt</span>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <div className="font-mono text-xl font-bold text-green-600 dark:text-green-400">
                  ¤{player.cash}
                </div>
              </div>
            </div>

            {/* Properties summary */}
            <div className="flex flex-wrap gap-1 mt-auto pt-2">
              {player.properties.map(spaceId => {
                const space = BOARD_SPACES[spaceId];
                if (!space) return null;
                const isMortgaged = player.mortgaged.includes(spaceId);
                const color = space.type === 'property' ? PROPERTY_SETS[space.setId]?.color : '#aaa';
                return (
                  <div
                    key={spaceId}
                    className={`w-4 h-4 rounded-sm border border-black/20 ${isMortgaged ? 'opacity-30 grayscale relative' : ''}`}
                    style={{ backgroundColor: color }}
                    title={`${space.name}${isMortgaged ? ' (Mortgaged)' : ''}`}
                  >
                    {isMortgaged && <div className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-red-500 bg-white/50 leading-none">M</div>}
                  </div>
                );
              })}
            </div>

            {player.getOutOfJailCards > 0 && (
              <div className="text-xs font-mono mt-1 opacity-70">
                Release Cards: {player.getOutOfJailCards}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
