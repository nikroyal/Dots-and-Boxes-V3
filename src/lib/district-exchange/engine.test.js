import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  movePlayer,
  resolveSpace,
  buyProperty,
  calculateRent,
  pay,
  declareBankruptcy,
  upgradeProperty,
  proposeTrade,
  acceptTrade,
  mortgageProperty,
  unmortgageProperty
} from './engine';

describe('District Exchange Engine', () => {
  it('creates initial state correctly', () => {
    const players = [{ id: 'p1', name: 'Alice' }, { id: 'p2', name: 'Bob' }];
    const state = createInitialState(players);
    expect(state.players.length).toBe(2);
    expect(state.players[0].cash).toBe(1500);
    expect(state.players[0].position).toBe(0);
    expect(state.boardSpaces.length).toBe(40);
  });

  it('moves player and loops around board, adding 200 cash', () => {
    let state = createInitialState([{ id: 'p1', name: 'Alice' }]);
    state = movePlayer(state, 'p1', 45); // 0 + 45 = 45 -> pos 5
    expect(state.players[0].position).toBe(5);
    expect(state.players[0].cash).toBe(1700); // 1500 + 200
  });

  it('allows buying property and calculates base rent correctly', () => {
    let state = createInitialState([{ id: 'p1', name: 'Alice' }, { id: 'p2', name: 'Bob' }]);

    // Alice moves to space 1 (Tide Pools, price 60, rent 2)
    state = movePlayer(state, 'p1', 1);
    expect(state.pendingAction.type).toBe('buy');

    // Alice buys it
    state = buyProperty(state, 'p1', 1);
    expect(state.players[0].cash).toBe(1440); // 1500 - 60
    expect(state.players[0].properties).toContain(1);

    // Calculate rent for space 1
    const rent = calculateRent(state, 1, 0);
    expect(rent).toBe(2);
  });

  it('calculates monopoly rent correctly', () => {
    let state = createInitialState([{ id: 'p1', name: 'Alice' }]);
    // Harbor set is spaces 1 and 3
    state.players[0].properties = [1, 3];

    const rent = calculateRent(state, 1, 0);
    // Base rent is 2, monopoly is double
    expect(rent).toBe(4);
  });

  it('handles mortgaging and unmortgaging correctly', () => {
    let state = createInitialState([{ id: 'p1', name: 'Alice' }]);
    state.players[0].properties = [1];
    state.players[0].cash = 1000;

    // Mortgage
    state = mortgageProperty(state, 'p1', 1);
    expect(state.players[0].mortgaged).toContain(1);
    expect(state.players[0].cash).toBe(1030); // 1000 + 30 (half of 60)

    // Rent should be 0 when mortgaged
    const rent = calculateRent(state, 1, 0);
    expect(rent).toBe(0);

    // Unmortgage
    state = unmortgageProperty(state, 'p1', 1);
    expect(state.players[0].mortgaged).not.toContain(1);
    expect(state.players[0].cash).toBe(997); // 1030 - 33 (30 + 10%)
  });

  it('calculates upgrade rent correctly', () => {
    let state = createInitialState([{ id: 'p1', name: 'Alice' }]);
    state.players[0].properties = [1, 3];

    // Upgrade space 1 once (Shed)
    state = upgradeProperty(state, 'p1', 1);
    expect(state.players[0].upgrades[1]).toBe(1);

    const rent = calculateRent(state, 1, 0);
    // Rents array for Tide Pools: [10, 30, 90, 160, 250]
    expect(rent).toBe(10);
  });

  it('handles payment and bankruptcy', () => {
    let state = createInitialState([{ id: 'p1', name: 'Alice' }, { id: 'p2', name: 'Bob' }]);
    state.players[0].properties = [1];

    // Bob pays Alice 2000
    state = pay(state, 'p2', 2000, 'p1', 'Debt');

    // Bob is now in debt
    expect(state.players[1].cash).toBe(-500);
    expect(state.players[1].bankrupt).toBe(false);
    expect(state.debtState).toBeDefined();

    // Bob declares bankruptcy
    state = declareBankruptcy(state, 'p2');

    expect(state.players[1].cash).toBe(0);
    expect(state.players[1].bankrupt).toBe(true);
    expect(state.winner).toBe('p1');
  });

  it('handles proposing and accepting a trade', () => {
    let state = createInitialState([{ id: 'p1', name: 'Alice' }, { id: 'p2', name: 'Bob' }]);
    state.players[0].properties = [1, 3];
    state.players[0].cash = 1000;
    state.players[1].properties = [6];
    state.players[1].cash = 1000;

    // Alice proposes a trade to Bob: Give 100 cash and property 1, for property 6
    state = proposeTrade(state, 'p1', 'p2',
      { cash: 100, properties: [1], getOutOfJailCards: 0 },
      { cash: 0, properties: [6], getOutOfJailCards: 0 }
    );

    expect(state.tradeState).toBeDefined();

    state = acceptTrade(state, 'p2');

    expect(state.tradeState).toBeNull();

    // Check Alice
    expect(state.players[0].cash).toBe(900);
    expect(state.players[0].properties).toContain(3);
    expect(state.players[0].properties).toContain(6);
    expect(state.players[0].properties).not.toContain(1);

    // Check Bob
    expect(state.players[1].cash).toBe(1100);
    expect(state.players[1].properties).toContain(1);
    expect(state.players[1].properties).not.toContain(6);
  });
});
