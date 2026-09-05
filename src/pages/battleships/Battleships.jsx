import { useState, useEffect } from 'react';
import { sfx } from '../../lib/sound';
import {
  BOARD_SIZE, SHIPS, createEmptyGrid, canPlaceShip, placeShip,
  generateRandomBoardState, processShot, createInitialShipsState
} from '../../lib/battleships/engine';
import { getBotMove } from '../../lib/battleships/bot';
import { RotateCw } from 'lucide-react';

const GAME_STATES = {
  PLACEMENT: 'PLACEMENT',
  PLAYING: 'PLAYING',
  GAME_OVER: 'GAME_OVER'
};

export default function Battleships() {
  const [gameState, setGameState] = useState(GAME_STATES.PLACEMENT);

  // Placement State
  const [difficulty, setDifficulty] = useState(3);
  const [playerGrid, setPlayerGrid] = useState(createEmptyGrid());
  const [shipsToPlace, setShipsToPlace] = useState([...SHIPS]);
  const [isVertical, setIsVertical] = useState(false);
  const [hoveredCells, setHoveredCells] = useState([]);
  const [hoverValid, setHoverValid] = useState(false);

  // Playing State
  const [playerShips, setPlayerShips] = useState(createInitialShipsState()); // Tracking hits on player ships
  const [botBoardState, setBotBoardState] = useState(null); // Bot's hidden grid and ship state

  // Shot grids
  const [playerShots, setPlayerShots] = useState(createEmptyGrid()); // Where player shot (rendered on right board)
  const [botShots, setBotShots] = useState(createEmptyGrid()); // Where bot shot (rendered on left board)

  const [winner, setWinner] = useState(null); // 'player' | 'bot'
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);

  const currentShip = shipsToPlace[0];

  const handlePlayerGridMouseEnter = (row, col) => {
    if (gameState !== GAME_STATES.PLACEMENT || !currentShip) return;

    const valid = canPlaceShip(playerGrid, currentShip.length, row, col, isVertical);
    const cells = [];
    if (isVertical) {
      for (let i = 0; i < currentShip.length; i++) {
        if (row + i < BOARD_SIZE) cells.push({ r: row + i, c: col });
      }
    } else {
      for (let i = 0; i < currentShip.length; i++) {
        if (col + i < BOARD_SIZE) cells.push({ r: row, c: col + i });
      }
    }
    setHoveredCells(cells);
    setHoverValid(valid);
  };

  const handlePlayerGridMouseLeave = () => {
    if (gameState !== GAME_STATES.PLACEMENT) return;
    setHoveredCells([]);
    setHoverValid(false);
  };

  const handlePlayerGridClick = (row, col) => {
    if (gameState !== GAME_STATES.PLACEMENT || !currentShip) return;

    if (canPlaceShip(playerGrid, currentShip.length, row, col, isVertical)) {
      sfx.click();
      const newGrid = placeShip(playerGrid, currentShip.length, row, col, isVertical, currentShip.id);
      setPlayerGrid(newGrid);
      setShipsToPlace(shipsToPlace.slice(1));
      setHoveredCells([]);

      if (shipsToPlace.length === 1) {
        // All placed
        setGameState(GAME_STATES.PLAYING);
        setBotBoardState(generateRandomBoardState());
        setIsPlayerTurn(true);
        sfx.line();
      }
    } else {
      sfx.click(); // Could add a distinct error sound
    }
  };

  const handleBotGridClick = (row, col) => {
    if (gameState !== GAME_STATES.PLAYING || !isPlayerTurn) return;

    const res = processShot(botBoardState.grid, playerShots, botBoardState.ships, row, col);
    if (!res.valid) return;

    if (res.hit) {
      if (res.sunkShipId) sfx.claim();
      else sfx.piece();
    } else {
      sfx.click();
    }

    setPlayerShots(res.newShotGrid);
    setBotBoardState({ grid: botBoardState.grid, ships: res.newOpponentShips });

    if (res.gameOver) {
      setGameState(GAME_STATES.GAME_OVER);
      setWinner('player');
      sfx.win();
      return;
    }

    setIsPlayerTurn(false);
  };

  // Bot Turn Logic
  useEffect(() => {
    if (gameState === GAME_STATES.PLAYING && !isPlayerTurn) {
      const timer = setTimeout(() => {
        const move = getBotMove(botShots, difficulty, playerGrid, playerShips);
        if (!move) return; // Should not happen

        const res = processShot(playerGrid, botShots, playerShips, move.r, move.c);

        if (res.hit) {
           if (res.sunkShipId) sfx.claim();
           else sfx.piece();
        } else {
           sfx.click();
        }

        setBotShots(res.newShotGrid);
        setPlayerShips(res.newOpponentShips);

        if (res.gameOver) {
          setGameState(GAME_STATES.GAME_OVER);
          setWinner('bot');
          sfx.loss();
        } else {
          setIsPlayerTurn(true);
        }
      }, 600); // Small delay to feel natural

      return () => clearTimeout(timer);
    }
  }, [gameState, isPlayerTurn, botShots, playerGrid, playerShips, difficulty]);

  const resetGame = () => {
    setGameState(GAME_STATES.PLACEMENT);
    setPlayerGrid(createEmptyGrid());
    setShipsToPlace([...SHIPS]);
    setHoveredCells([]);
    setHoverValid(false);
    setPlayerShips(createInitialShipsState());
    setBotBoardState(null);
    setPlayerShots(createEmptyGrid());
    setBotShots(createEmptyGrid());
    setWinner(null);
    setIsPlayerTurn(true);
    sfx.click();
  };

  const renderCellState = (val, shipId = null, shipState = null) => {
    if (val === 'hit') return <div className="w-1/2 h-1/2 rounded-full bg-[var(--crimson)]" />;
    if (val === 'miss') return <div className="w-2 h-2 rounded-full bg-black/20 dark:bg-white/20" />;

    // For showing sunk bot ships, or damaged player ships
    if (shipId && shipState && shipState[shipId].sunk) {
        return <div className="w-full h-full bg-[var(--crimson)] opacity-70" />;
    }

    return null;
  };

  return (
    <div className="fade-in max-w-5xl mx-auto pb-12">
      <div className="text-center mb-8">
        <h1 className="font-display text-4xl mb-2">Battleships</h1>
        {gameState === GAME_STATES.PLACEMENT && (
          <p className="opacity-60 font-mono text-sm tracking-widest uppercase">
            Prepare Your Fleet
          </p>
        )}
        {gameState === GAME_STATES.PLAYING && (
          <p className="opacity-60 font-mono text-sm tracking-widest uppercase">
            {isPlayerTurn ? 'Your Turn' : 'Enemy Turn'}
          </p>
        )}
        {gameState === GAME_STATES.GAME_OVER && (
          <p className="font-display text-2xl text-[var(--forest)] pulse-soft mt-2">
            {winner === 'player' ? 'Victory!' : 'Defeat!'}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-16">
        {/* Player Grid Section */}
        <div className="flex flex-col items-center">
          <h2 className="font-mono text-sm tracking-widest uppercase opacity-60 mb-4">Your Waters</h2>
          {gameState === GAME_STATES.PLACEMENT && (
            <div className="mb-4">
              <label htmlFor="difficulty-select" className="mr-2 text-sm font-medium">Bot Difficulty:</label>
              <select
                id="difficulty-select"
                value={difficulty}
                onChange={(e) => setDifficulty(parseInt(e.target.value, 10))}
                className="bg-white dark:bg-neutral-800 border hairline rounded p-1 text-sm"
              >
                <option value={1}>1 - Easy (Random)</option>
                <option value={2}>2 - Normal</option>
                <option value={3}>3 - Hard (Focused)</option>
                <option value={4}>4 - Expert (Axis Detection)</option>
                <option value={5}>5 - Unbeatable (Parity Hunt)</option>
              </select>
            </div>
          )}
          <div
            className="border hairline p-2 bg-[var(--paper-tint)] shadow-sm inline-block"
            onMouseLeave={handlePlayerGridMouseLeave}
          >
            <div
              className="grid gap-px bg-black/10 dark:bg-white/10"
              style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))` }}
            >
              {playerGrid.map((row, r) =>
                row.map((cell, c) => {
                  const isHovered = hoveredCells.some(hc => hc.r === r && hc.c === c);
                  let bgColor = 'bg-white dark:bg-neutral-900';

                  if (cell !== null) {
                    if (gameState === GAME_STATES.PLAYING && playerShips[cell]?.sunk) {
                      bgColor = 'bg-[var(--crimson)] opacity-70';
                    } else {
                      bgColor = 'bg-[var(--forest)]';
                    }
                  } else if (isHovered) {
                    bgColor = hoverValid ? 'bg-[var(--forest)] opacity-50' : 'bg-[var(--crimson)] opacity-50';
                  }

                  // Add hit/miss markers for bot shots on player grid
                  const shotState = botShots[r][c];

                  return (
                    <div
                      key={`p-${r}-${c}`}
                      className={`w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center transition-colors duration-200 cursor-crosshair ${bgColor}`}
                      onMouseEnter={() => handlePlayerGridMouseEnter(r, c)}
                      onClick={() => handlePlayerGridClick(r, c)}
                    >
                       {shotState && renderCellState(shotState)}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {gameState === GAME_STATES.PLACEMENT && (
            <div className="mt-6 flex flex-col items-center">
              <p className="mb-4 text-sm font-medium">
                {shipsToPlace.length > 0
                  ? `Place your ${shipsToPlace[0].name} (Size: ${shipsToPlace[0].length})`
                  : 'All ships placed!'}
              </p>
              <div className="flex gap-4">
                <button
                  className="btn-ghost flex items-center gap-2"
                  onClick={() => setIsVertical(!isVertical)}
                >
                  <RotateCw size={16}  aria-hidden="true" /> Rotate ({isVertical ? 'Vertical' : 'Horizontal'})
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bot Grid Section */}
        <div className={`flex flex-col items-center ${gameState === GAME_STATES.PLACEMENT ? 'opacity-50 pointer-events-none' : ''}`}>
           <h2 className="font-mono text-sm tracking-widest uppercase opacity-60 mb-4">Enemy Waters</h2>
           <div className="border hairline p-2 bg-[var(--paper-tint)] shadow-sm inline-block">
            <div
              className="grid gap-px bg-black/10 dark:bg-white/10"
              style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))` }}
            >
              {playerShots.map((row, r) =>
                row.map((cell, c) => {
                  let bgColor = 'bg-white dark:bg-neutral-900 hover:bg-[var(--bg-hover)]';

                  // Reveal sunk ships or hit cells
                  if (gameState === GAME_STATES.PLAYING || gameState === GAME_STATES.GAME_OVER) {
                     const botShipId = botBoardState?.grid?.[r]?.[c];
                     if (botShipId && botBoardState.ships[botShipId].sunk) {
                       bgColor = 'bg-[var(--crimson)] opacity-70';
                     } else if (gameState === GAME_STATES.GAME_OVER && botShipId && !botBoardState.ships[botShipId].sunk) {
                       // Reveal unsunk bot ships at game over
                       bgColor = 'bg-[var(--forest)] opacity-50';
                     }
                  }

                  const cursor = (gameState === GAME_STATES.PLAYING && isPlayerTurn && cell === null)
                    ? 'cursor-crosshair' : 'cursor-default';

                  return (
                    <div
                      key={`b-${r}-${c}`}
                      className={`w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center transition-colors duration-200 ${cursor} ${bgColor}`}
                      onClick={() => handleBotGridClick(r, c)}
                    >
                      {cell && renderCellState(cell)}
                    </div>
                  );
                })
              )}
            </div>
           </div>
        </div>
      </div>

      {gameState === GAME_STATES.GAME_OVER && (
        <div className="mt-12 text-center fade-in">
          <button className="btn-primary" onClick={resetGame}>
            Play Again
          </button>
        </div>
      )}
    </div>
  );
}
