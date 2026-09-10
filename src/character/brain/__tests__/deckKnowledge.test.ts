import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { YoyoDeckKnowledge } from '../yoyoDeckKnowledge';
import { createInitialFirstMatch } from '../../../firstMatch/firstMatchEngine';

import { CANONICAL_DECK } from '../../../engine/deck';

describe('YOYO BRAIN — Deck Knowledge Model', () => {
  it('1. Initializes with full 52 canonical cards unseen', () => {
    const dk = new YoyoDeckKnowledge();
    assert.equal(dk.getRemainingUnseenRankCount('J'), 4);
    assert.equal(dk.getRemainingUnseenRankCount('7'), 4);
    assert.equal(dk.getRemainingUnseenRankCount('A'), 4);
    assert.equal(dk.getRemainingUnseenRankCount('2'), 4);
  });

  it('2. Observes initial public game state and anchor card without cheating', () => {
    const { game } = createInitialFirstMatch();
    const dk = new YoyoDeckKnowledge();
    dk.observeGameState(game);

    // Anchor card is 4♠ (rank 4)
    assert.equal(dk.isAnchorRank('4'), true);
    assert.equal(dk.getRevealedAnchor()?.rank, '4');

    // CPU hand has 4 known cards
    assert.equal(game.cpuHand.length, 4);

    // Table cards are visible
    assert.equal(game.table.playerTable.length, 2);
    assert.equal(game.table.opponentTable.length, 2);

    // Unseen calculation reflects observed cards
    const initialJacksUnseen = dk.getRemainingUnseenRankCount('J');
    assert.ok(initialJacksUnseen <= 4);
  });

  it('3. Tracks captured ranks into Player and CPU winning piles', () => {
    const { game } = createInitialFirstMatch();
    const dk = new YoyoDeckKnowledge();

    // Simulate player capturing 9s from canonical deck
    const realNines = CANONICAL_DECK.filter((c) => c.rank === '9').slice(0, 2);
    const updatedGame = {
      ...game,
      playerWinningPile: realNines,
    };

    dk.observeGameState(updatedGame);
    assert.equal(dk.getPlayerCapturedRankCount('9'), 2);
    assert.equal(dk.getCpuCapturedRankCount('9'), 0);
  });
});
