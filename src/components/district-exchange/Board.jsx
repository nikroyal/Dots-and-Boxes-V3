import React from 'react';
import { PROPERTY_SETS, BOARD_SPACES } from '../../lib/district-exchange/board';

// Utility for formatting cells based on their row/col on the standard 11x11 grid layout
// Bottom row: 10 to 0 (right to left)
// Left row: 10 to 20 (bottom to top)
// Top row: 20 to 30 (left to right)
// Right row: 30 to 40(0) (top to bottom)
const getSpaceStyle = (index) => {
  if (index >= 0 && index <= 10) return { gridRow: 11, gridColumn: 11 - index };
  if (index >= 11 && index <= 19) return { gridRow: 11 - (index - 10), gridColumn: 1 };
  if (index >= 20 && index <= 30) return { gridRow: 1, gridColumn: index - 19 };
  if (index >= 31 && index <= 39) return { gridRow: index - 29, gridColumn: 11 };
  return {};
};

const getSpaceClassNames = (index) => {
  let classes = "border border-gray-400 dark:border-gray-600 flex flex-col justify-between items-center relative overflow-hidden text-center text-[0.6rem] leading-tight ";
  if (index % 10 === 0) classes += " bg-gray-200 dark:bg-gray-800 font-bold p-2"; // corners
  else classes += " bg-white dark:bg-gray-900"; // edges
  return classes;
};

const getBandColor = (setId) => {
  if (!setId) return 'transparent';
  return PROPERTY_SETS[setId]?.color || 'transparent';
};

const getOrientation = (index) => {
  if (index > 0 && index < 10) return 'bottom';
  if (index > 10 && index < 20) return 'left';
  if (index > 20 && index < 30) return 'top';
  if (index > 30 && index < 40) return 'right';
  return 'corner';
};

const BoardSpace = React.memo(function BoardSpace({ space, index, owner, level, playersOnSpace }) {
  const style = getSpaceStyle(index);
  const orientation = getOrientation(index);
  const hasColorBand = space.type === 'property';
  const isCorner = orientation === 'corner';

  const renderTokens = () => {
    return (
      <div className="absolute inset-0 flex flex-wrap justify-center items-center gap-1 pointer-events-none p-1">
        {playersOnSpace.map(p => (
          <div
            key={p.id}
            className="w-3 h-3 rounded-full border border-black shadow-md z-10"
            style={{ backgroundColor: p.color }}
            title={p.name}
          />
        ))}
      </div>
    );
  };

  const renderUpgrades = () => {
    if (level === 0) return null;

    const markers = [];
    if (level < 4) {
      for (let i = 0; i < level; i++) {
        markers.push(
          <div key={i} className="w-1.5 h-1.5 bg-green-500 rounded-sm shadow-sm" />
        );
      }
    } else {
      markers.push(
        <div key="tower" className="w-2.5 h-2.5 bg-red-500 rounded-sm shadow-sm" />
      );
    }
    return (
      <div className="flex gap-0.5 justify-center mt-1">
        {markers}
      </div>
    );
  };

  const renderOwnerBar = () => {
    if (!owner) return null;
    return (
      <div
        className="absolute bottom-0 left-0 right-0 h-1"
        style={{ backgroundColor: owner.color }}
      />
    );
  };

  return (
    <div
      className={getSpaceClassNames(index)}
      style={style}
    >
      {/* Color Band for properties */}
      {!isCorner && hasColorBand && (
        <div
          className={`absolute ${
            orientation === 'bottom' ? 'top-0 left-0 right-0 h-1/4 border-b' :
            orientation === 'top' ? 'bottom-0 left-0 right-0 h-1/4 border-t' :
            orientation === 'left' ? 'top-0 right-0 bottom-0 w-1/4 border-l' :
            'top-0 left-0 bottom-0 w-1/4 border-r'
          } border-gray-400 dark:border-gray-600`}
          style={{ backgroundColor: getBandColor(space.setId) }}
        >
          {/* Upgrade markers placed inside color band area */}
          {orientation === 'bottom' || orientation === 'top' ? (
             <div className="flex justify-center h-full items-center">
               {renderUpgrades()}
             </div>
          ) : (
             <div className="flex flex-col justify-center h-full items-center">
               {renderUpgrades()}
             </div>
          )}
        </div>
      )}

      {/* Content Container */}
      <div className={`p-1 flex flex-col justify-center items-center h-full w-full z-0 ${
          orientation === 'left' ? 'ml-auto w-3/4' :
          orientation === 'right' ? 'mr-auto w-3/4' :
          orientation === 'top' ? 'mb-auto h-3/4' :
          orientation === 'bottom' ? 'mt-auto h-3/4' : ''
      } ${''
      }`}>
        {isCorner ? (
          <div className="font-display text-sm sm:text-base uppercase text-center w-full break-words leading-none">
            {space.name}
          </div>
        ) : (
          <>
            <div className="font-sans font-bold leading-tight break-words w-full text-center mb-0.5 text-[0.55rem] sm:text-xs">
              {space.name}
            </div>
            {space.price && (
              <div className="font-mono text-[0.55rem] mt-auto">
                ¤{space.price}
              </div>
            )}
          </>
        )}
      </div>

      {renderOwnerBar()}
      {renderTokens()}
    </div>
  );
});

export default function Board({ gameState, isRolling }) {
  if (!gameState) return null;

  // Optimization (Bolt): Pre-compute property owners to avoid O(N*M) lookups during render.
  // The old code scanned `gameState.players` and `.includes(spaceId)` for every space on the board,
  // twice per render (once for upgrades, once for owner bar). This Map turns those into O(1) lookups.
  const propertyOwners = React.useMemo(() => {
    const map = new Map();
    for (const player of gameState.players || []) {
      if (player.bankrupt) continue;
      for (const spaceId of player.properties || []) {
        map.set(spaceId, player);
      }
    }
    return map;
  }, [gameState.players]);

  // Optimization (Bolt): Group players by space ID to maintain reference stability for React.memo
  // on BoardSpace component. Without this, `.filter` creates a new array on every render and defeats memoization.
  const playersBySpace = React.useMemo(() => {
    const map = new Map();
    for (const player of gameState.players || []) {
      if (player.bankrupt) continue;
      const arr = map.get(player.position) || [];
      arr.push(player);
      map.set(player.position, arr);
    }
    return map;
  }, [gameState.players]);

  return (
    <div className="aspect-square w-full max-w-[800px] mx-auto bg-[#cce3c6] dark:bg-[#1a2f24] p-1 sm:p-2 select-none relative">
      <div
        className="w-full h-full grid gap-px"
        style={{
          gridTemplateColumns: '1.5fr repeat(9, 1fr) 1.5fr',
          gridTemplateRows: '1.5fr repeat(9, 1fr) 1.5fr'
        }}
      >
        {BOARD_SPACES.map((space, index) => {
          const owner = propertyOwners.get(space.id);
          const level = owner?.upgrades[space.id] || 0;
          const playersOnSpace = playersBySpace.get(space.id) || EMPTY_ARRAY;
          return (
            <BoardSpace
              key={space.id}
              space={space}
              index={index}
              owner={owner}
              level={level}
              playersOnSpace={playersOnSpace}
            />
          );
        })}

        {/* Center Logo / Play Area */}
        <div
          className="bg-[#cce3c6] dark:bg-[#1a2f24] flex items-center justify-center relative shadow-inner"
          style={{ gridRow: '2 / 11', gridColumn: '2 / 11' }}
        >
          <div className="-rotate-45 text-center">
            <h1 className="font-display text-4xl sm:text-6xl text-black/20 dark:text-white/20 tracking-widest uppercase">
              District
              <br />
              Exchange
            </h1>
          </div>

          {/* Deck Placements (Decorative) */}
          <div className="absolute top-8 left-8 w-16 h-24 sm:w-24 sm:h-36 bg-orange-400/20 border-2 border-orange-400/50 rounded flex items-center justify-center rotate-[135deg]">
            <span className="font-display text-orange-600/50 dark:text-orange-300/50 text-xs sm:text-lg">OPPORTUNITY</span>
          </div>
          <div className="absolute bottom-8 right-8 w-16 h-24 sm:w-24 sm:h-36 bg-blue-400/20 border-2 border-blue-400/50 rounded flex items-center justify-center rotate-[135deg]">
            <span className="font-display text-blue-600/50 dark:text-blue-300/50 text-xs sm:text-lg">FORTUNE</span>
          </div>

          {/* Dice Area */}
          {(gameState.turnPhase !== 'roll' || isRolling) && (
             <div className="absolute flex gap-2">
                {isRolling ? (
                  <>
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white dark:bg-gray-800 text-black dark:text-white rounded flex items-center justify-center font-bold text-lg shadow-lg border animate-bounce">?</div>
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white dark:bg-gray-800 text-black dark:text-white rounded flex items-center justify-center font-bold text-lg shadow-lg border animate-bounce" style={{animationDelay: '150ms'}}>?</div>
                  </>
                ) : (
                  gameState.lastDice && gameState.lastDice[0] > 0 && (
                    <>
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white dark:bg-gray-800 text-black dark:text-white rounded flex items-center justify-center font-bold text-lg shadow-lg border">
                        {gameState.lastDice[0]}
                      </div>
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white dark:bg-gray-800 text-black dark:text-white rounded flex items-center justify-center font-bold text-lg shadow-lg border">
                        {gameState.lastDice[1]}
                      </div>
                    </>
                  )
                )}
             </div>
          )}
        </div>
      </div>
    </div>
  );
}