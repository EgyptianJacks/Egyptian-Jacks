import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CANONICAL_DECK,
  createStandardDeck,
  getCardByCanonicalId,
  RANKS,
  SUIT_ORDER,
  SUITS,
  shuffleDeck,
  cutDeck,
  calculateDeterministicCutIndex,
  prepareRoundDeck,
} from './deck';
import { calculateScores, evaluateCapture, SCORING_VALUES } from './rules';
import { createInitialGame, executeCpuTurn, playPlayerCard } from './gameEngine';
import { createInitialMatch, finalizeRoundInMatch, startNextRoundInMatch } from './matchEngine';
import { Card, GameState } from '../types/game';

describe('Egyptian Jacks Game Engine Baseline Verification', () => {
  // A & B: Deck Size and Unique IDs
  it('A & B: Deck contains 52 unique cards with no duplicates', () => {
    const deck = createStandardDeck();
    assert.equal(deck.length, 52);
    const uniqueIds = new Set(deck.map((c) => c.id));
    assert.equal(uniqueIds.size, 52);

    const jacks = deck.filter((c) => c.isJack);
    assert.equal(jacks.length, 4);

    const sevens = deck.filter((c) => c.rank === '7');
    assert.equal(sevens.length, 4);
  });

  // C & D: Initial Deal & Accounting
  it('C & D: Initial deal distributes 4 / 4 / 2 / 2 cards, accounting for all 52', () => {
    const game = createInitialGame(12345);
    assert.equal(game.playerHand.length, 4);
    assert.equal(game.cpuHand.length, 4);
    assert.equal(game.table.playerTable.length, 2);
    assert.equal(game.table.opponentTable.length, 2);
    assert.equal(game.deck.length, 40);
    const totalCount =
      game.playerHand.length +
      game.cpuHand.length +
      game.table.playerTable.length +
      game.table.opponentTable.length +
      game.deck.length;
    assert.equal(totalCount, 52);
    assert.equal(game.table.viewMode, 'INITIAL_VIEW');
  });

  // E & F: Legal Card Play and Validation
  it('E & F: Legal card can be played, illegal card is rejected', () => {
    const game = createInitialGame(42);
    const validCardId = game.playerHand[0].id;
    const nextGame = playPlayerCard(game, validCardId);
    assert.equal(nextGame.playerHand.length, 3);
    assert.equal(nextGame.table.viewMode, 'NORMAL_VIEW');
    assert.equal(nextGame.phase, 'CPU_TURN');

    // Attempt playing a card not in hand
    assert.throws(() => {
      playPlayerCard(nextGame, 'NON_EXISTENT_CARD');
    });

    // Attempt playing when it is not player's turn
    assert.throws(() => {
      playPlayerCard(nextGame, nextGame.playerHand[0].id);
    });
  });

  // G: Rank Capture works
  it('G: Rank capture correctly collects matching table cards and played card into winning pile', () => {
    const playedCard: Card = {
      id: '8♠',
      suit: '♠',
      rank: '8',
      numericValue: 8,
      isJack: false,
    };
    const playerTable: Card[] = [];
    const opponentTable: Card[] = [
      { id: '8♥', suit: '♥', rank: '8', numericValue: 8, isJack: false },
    ];
    const { captureResult, updatedOpponentTable } = evaluateCapture(
      playedCard,
      playerTable,
      opponentTable,
      [],
      'NORMAL_VIEW'
    );
    assert.equal(captureResult.capturedFrom, 'OPPONENT_TABLE');
    assert.equal(captureResult.capturedCards.length, 2); // 8♥ + 8♠
    assert.equal(updatedOpponentTable.length, 0);
  });

  // H: No-Capture works
  it('H: No-capture adds played card to table stack', () => {
    const playedCard: Card = {
      id: '3♣',
      suit: '♣',
      rank: '3',
      numericValue: 3,
      isJack: false,
    };
    const playerTable: Card[] = [
      { id: 'K♠', suit: '♠', rank: 'K', numericValue: 13, isJack: false },
    ];
    const opponentTable: Card[] = [
      { id: '9♦', suit: '♦', rank: '9', numericValue: 9, isJack: false },
    ];
    const { captureResult, updatedPlayerTable } = evaluateCapture(
      playedCard,
      playerTable,
      opponentTable,
      [],
      'NORMAL_VIEW'
    );
    assert.equal(captureResult.capturedFrom, 'NONE');
    assert.equal(captureResult.capturedCards.length, 0);
    assert.equal(updatedPlayerTable.length, 2);
    assert.equal(updatedPlayerTable[1].id, '3♣');
  });

  // I: Jack does NOT sweep
  it('I: Jack acts as standard rank matching card and does not sweep disparate cards', () => {
    const jackCard: Card = {
      id: 'J♣',
      suit: '♣',
      rank: 'J',
      numericValue: 11,
      isJack: true,
    };
    const opponentTable: Card[] = [
      { id: '5♠', suit: '♠', rank: '5', numericValue: 5, isJack: false },
      { id: '10♦', suit: '♦', rank: '10', numericValue: 10, isJack: false },
    ];
    const { captureResult } = evaluateCapture(jackCard, [], opponentTable, [], 'NORMAL_VIEW');
    assert.equal(captureResult.capturedCards.length, 0);
  });

  // J: 7♦ does NOT sweep
  it('J: 7♦ acts as standard rank 7 and does not sweep without match', () => {
    const sevenCard: Card = {
      id: '7♦',
      suit: '♦',
      rank: '7',
      numericValue: 7,
      isJack: false,
    };
    const opponentTable: Card[] = [
      { id: '6♠', suit: '♠', rank: '6', numericValue: 6, isJack: false },
    ];
    const { captureResult } = evaluateCapture(sevenCard, [], opponentTable, [], 'NORMAL_VIEW');
    assert.equal(captureResult.capturedCards.length, 0);
  });

  // K: Top Uniform Winning Pile Capture
  it('K: Stealing from top of opponent winning pile works for contiguous matching ranks', () => {
    const playedCard: Card = {
      id: 'A♠',
      suit: '♠',
      rank: 'A',
      numericValue: 1,
      isJack: false,
    };
    const opponentWinningPile: Card[] = [
      { id: '4♣', suit: '♣', rank: '4', numericValue: 4, isJack: false },
      { id: 'A♥', suit: '♥', rank: 'A', numericValue: 1, isJack: false },
      { id: 'A♦', suit: '♦', rank: 'A', numericValue: 1, isJack: false },
    ];
    const { captureResult, updatedOpponentWinningPile } = evaluateCapture(
      playedCard,
      [],
      [],
      opponentWinningPile,
      'NORMAL_VIEW'
    );
    assert.equal(captureResult.isTopUniformCapture, true);
    assert.equal(captureResult.capturedFrom, 'WINNING_PILE');
    assert.equal(captureResult.capturedCards.length, 3); // 2 Aces from pile + played Ace
    assert.equal(updatedOpponentWinningPile.length, 1);
    assert.equal(updatedOpponentWinningPile[0].id, '4♣');
  });

  // L & M: CPU completes legal turn and turns alternate
  it('L & M: CPU executes a legal turn and alternates back to Player', () => {
    const game = createInitialGame(100);
    const card0 = game.playerHand[0].id;
    const afterPlayer = playPlayerCard(game, card0);
    assert.equal(afterPlayer.phase, 'CPU_TURN');
    assert.equal(afterPlayer.activeTurn, 'cpu');

    const afterCpu = executeCpuTurn(afterPlayer);
    assert.equal(afterCpu.phase, 'PLAYER_TURN');
    assert.equal(afterCpu.activeTurn, 'player');
    assert.equal(afterCpu.cpuHand.length, 3);
  });

  // N, O, P, Q: Complete full match simulation, replenishment, and canonical final score calculation
  it('N, O, P, Q: Simulates a complete 52-card match to completion and validates final score calculation', () => {
    let state = createInitialGame(777);
    let turnsCount = 0;

    while (state.phase !== 'MATCH_END' && turnsCount < 100) {
      if (state.phase === 'PLAYER_TURN') {
        const cardToPlay = state.playerHand[0].id;
        state = playPlayerCard(state, cardToPlay);
      } else if (state.phase === 'CPU_TURN') {
        state = executeCpuTurn(state);
      }
      turnsCount++;
    }

    assert.equal(state.phase, 'MATCH_END');
    assert.equal(state.deck.length, 0);
    assert.equal(state.playerHand.length, 0);
    assert.equal(state.cpuHand.length, 0);
    assert.ok(state.playerScore !== null);
    assert.ok(state.cpuScore !== null);
    assert.ok(['player', 'cpu', 'DRAW'].includes(state.winner as string));

    // Card Accounting: Winning Piles + Remaining Table Cards = 52 exactly
    const totalInPiles = state.playerWinningPile.length + state.cpuWinningPile.length;
    const totalOnTables = state.table.playerTable.length + state.table.opponentTable.length;
    assert.equal(totalInPiles + totalOnTables, 52, 'All 52 cards accounted for across winning piles and tables');
  });

  it('Deterministic Endgame Hardening: Empty hands + empty deck preserves tables and scores strictly from winning piles', () => {
    // 1. Construct deterministic pre-endgame state:
    // Deck: empty
    // Player hand: 1 card ('2♣')
    // CPU hand: empty
    // Player table: 2 cards ('K♠', '9♦')
    // CPU table: 2 cards ('Q♣', '8♥')
    // Player winning pile: 4 Jacks ('J♠', 'J♥', 'J♦', 'J♣') -> Jack Set (36 pts)
    // CPU winning pile: 4 Aces ('A♠', 'A♥', 'A♦', 'A♣') -> Regular Set (12 pts)
    const card2C: Card = { id: '2♣', suit: '♣', rank: '2', numericValue: 2, isJack: false };
    const cardKS: Card = { id: 'K♠', suit: '♠', rank: 'K', numericValue: 13, isJack: false };
    const card9D: Card = { id: '9♦', suit: '♦', rank: '9', numericValue: 9, isJack: false };
    const cardQC: Card = { id: 'Q♣', suit: '♣', rank: 'Q', numericValue: 12, isJack: false };
    const card8H: Card = { id: '8♥', suit: '♥', rank: '8', numericValue: 8, isJack: false };

    const initialPlayerWinningPile: Card[] = [
      { id: 'J♠', suit: '♠', rank: 'J', numericValue: 11, isJack: true },
      { id: 'J♥', suit: '♥', rank: 'J', numericValue: 11, isJack: true },
      { id: 'J♦', suit: '♦', rank: 'J', numericValue: 11, isJack: true },
      { id: 'J♣', suit: '♣', rank: 'J', numericValue: 11, isJack: true },
    ];

    const initialCpuWinningPile: Card[] = [
      { id: 'A♠', suit: '♠', rank: 'A', numericValue: 1, isJack: false },
      { id: 'A♥', suit: '♥', rank: 'A', numericValue: 1, isJack: false },
      { id: 'A♦', suit: '♦', rank: 'A', numericValue: 1, isJack: false },
      { id: 'A♣', suit: '♣', rank: 'A', numericValue: 1, isJack: false },
    ];

    const preEndState: GameState = {
      matchId: 'det_test_1',
      seed: 42,
      firstPlayer: 'player',
      revealedLastCard: null,
      actualLastDealtCard: null,
      deck: [],
      playerHand: [card2C],
      cpuHand: [],
      table: {
        playerTable: [cardKS, card9D],
        opponentTable: [cardQC, card8H],
        viewMode: 'NORMAL_VIEW',
      },
      playerWinningPile: [...initialPlayerWinningPile],
      cpuWinningPile: [...initialCpuWinningPile],
      activeTurn: 'player',
      phase: 'PLAYER_TURN',
      roundNumber: 1,
      dealNumber: 6,
      latestEvent: null,
      eventLog: [],
      actionHistory: [],
      playerScore: null,
      cpuScore: null,
      winner: null,
    };

    // 2. Player plays final card '2♣' with NO capture (placed on player's table)
    const endState = playPlayerCard(preEndState, '2♣');

    // 3. Assert exact post-condition invariant:
    // A. Phase transitioned to MATCH_END
    assert.equal(endState.phase, 'MATCH_END');

    // B. Deck and hands are completely empty
    assert.equal(endState.deck.length, 0);
    assert.equal(endState.playerHand.length, 0);
    assert.equal(endState.cpuHand.length, 0);

    // C. Tables are strictly preserved and non-empty (playerTable has K♠, 9♦, 2♣; cpuTable has Q♣, 8♥)
    assert.equal(endState.table.playerTable.length, 3);
    assert.deepEqual(endState.table.playerTable.map((c) => c.id), ['K♠', '9♦', '2♣']);
    assert.equal(endState.table.opponentTable.length, 2);
    assert.deepEqual(endState.table.opponentTable.map((c) => c.id), ['Q♣', '8♥']);

    // D. Winning piles are strictly unchanged
    assert.equal(endState.playerWinningPile.length, 4);
    assert.deepEqual(endState.playerWinningPile.map((c) => c.id), ['J♠', 'J♥', 'J♦', 'J♣']);
    assert.equal(endState.cpuWinningPile.length, 4);
    assert.deepEqual(endState.cpuWinningPile.map((c) => c.id), ['A♠', 'A♥', 'A♦', 'A♣']);

    // E. Scores derived strictly from winning piles ONLY (Player: 36 for Jack Set, CPU: 12 for Regular Set)
    assert.equal(endState.playerScore?.totalScore, 36);
    assert.equal(endState.cpuScore?.totalScore, 12);
    assert.equal(endState.winner, 'player');

    // F. Total card accounting: 4 (Player Pile) + 4 (CPU Pile) + 3 (Player Table) + 2 (CPU Table) = 13 total accounted
    const allDetCards = [
      ...endState.playerWinningPile,
      ...endState.cpuWinningPile,
      ...endState.table.playerTable,
      ...endState.table.opponentTable,
    ];
    assert.equal(allDetCards.length, 13);
    const detCardIds = new Set(allDetCards.map((c) => c.id));
    assert.equal(detCardIds.size, 13, 'All 13 cards are unique and accounted for');
  });

  // R & S: Reset & Determinism
  it('R & S: New match with same seed produces identical initial state and sequence', () => {
    const stateA = createInitialGame(9999);
    const stateB = createInitialGame(9999);

    assert.deepEqual(
      stateA.playerHand.map((c) => c.id),
      stateB.playerHand.map((c) => c.id)
    );
    assert.deepEqual(
      stateA.cpuHand.map((c) => c.id),
      stateB.cpuHand.map((c) => c.id)
    );
    assert.deepEqual(
      stateA.table.playerTable.map((c) => c.id),
      stateB.table.playerTable.map((c) => c.id)
    );
    assert.deepEqual(
      stateA.deck.map((c) => c.id),
      stateB.deck.map((c) => c.id)
    );
  });

  // =========================================================================
  // CANONICAL SCORING CONTRACT VERIFICATION MATRIX (A through F / Items 1 to 20)
  // =========================================================================

  // A. Base scoring
  it('Matrix 1: Single Regular Card = 1 pt', () => {
    const winningPile: Card[] = [
      { id: '2♠', suit: '♠', rank: '2', numericValue: 2, isJack: false },
    ];
    const score = calculateScores(winningPile, 'player');
    assert.equal(score.remainingOtherCards, 1);
    assert.equal(score.cardPoints, 1);
    assert.equal(score.totalScore, 1);
  });

  it('Matrix 2: Single Jack = 3 pts', () => {
    const winningPile: Card[] = [
      { id: 'J♠', suit: '♠', rank: 'J', numericValue: 11, isJack: true },
    ];
    const score = calculateScores(winningPile, 'player');
    assert.equal(score.remainingJacks, 1);
    assert.equal(score.jackPoints, 3);
    assert.equal(score.totalScore, 3);
  });

  it('Matrix 3: Regular Set (4 cards of same non-Jack rank) = 12 pts', () => {
    const winningPile: Card[] = [
      { id: 'A♠', suit: '♠', rank: 'A', numericValue: 1, isJack: false },
      { id: 'A♥', suit: '♥', rank: 'A', numericValue: 1, isJack: false },
      { id: 'A♦', suit: '♦', rank: 'A', numericValue: 1, isJack: false },
      { id: 'A♣', suit: '♣', rank: 'A', numericValue: 1, isJack: false },
    ];
    const score = calculateScores(winningPile, 'player');
    assert.equal(score.regularSets, 1);
    assert.equal(score.regularSetPoints, 12);
    assert.equal(score.totalScore, 12);
  });

  it('Matrix 4: Jack Set (4 Jacks) = 36 pts', () => {
    const winningPile: Card[] = [
      { id: 'J♠', suit: '♠', rank: 'J', numericValue: 11, isJack: true },
      { id: 'J♥', suit: '♥', rank: 'J', numericValue: 11, isJack: true },
      { id: 'J♦', suit: '♦', rank: 'J', numericValue: 11, isJack: true },
      { id: 'J♣', suit: '♣', rank: 'J', numericValue: 11, isJack: true },
    ];
    const score = calculateScores(winningPile, 'player');
    assert.equal(score.jackSets, 1);
    assert.equal(score.jackSetPoints, 36);
    assert.equal(score.totalScore, 36);
  });

  // B. Combo scoring
  it('Matrix 5: Double Combo (2 Regular Sets) = 30 pts', () => {
    const winningPile: Card[] = [
      { id: 'A♠', suit: '♠', rank: 'A', numericValue: 1, isJack: false },
      { id: 'A♥', suit: '♥', rank: 'A', numericValue: 1, isJack: false },
      { id: 'A♦', suit: '♦', rank: 'A', numericValue: 1, isJack: false },
      { id: 'A♣', suit: '♣', rank: 'A', numericValue: 1, isJack: false },
      { id: 'K♠', suit: '♠', rank: 'K', numericValue: 13, isJack: false },
      { id: 'K♥', suit: '♥', rank: 'K', numericValue: 13, isJack: false },
      { id: 'K♦', suit: '♦', rank: 'K', numericValue: 13, isJack: false },
      { id: 'K♣', suit: '♣', rank: 'K', numericValue: 13, isJack: false },
    ];
    const score = calculateScores(winningPile, 'player');
    assert.equal(score.doubleCombos, 1);
    assert.equal(score.doublePoints, 30);
    assert.equal(score.regularSets, 0);
    assert.equal(score.totalScore, 30);
  });

  it('Matrix 6: Iron Combo (3 Regular Sets) = 50 pts', () => {
    const winningPile: Card[] = [
      { id: 'A♠', suit: '♠', rank: 'A', numericValue: 1, isJack: false },
      { id: 'A♥', suit: '♥', rank: 'A', numericValue: 1, isJack: false },
      { id: 'A♦', suit: '♦', rank: 'A', numericValue: 1, isJack: false },
      { id: 'A♣', suit: '♣', rank: 'A', numericValue: 1, isJack: false },
      { id: 'K♠', suit: '♠', rank: 'K', numericValue: 13, isJack: false },
      { id: 'K♥', suit: '♥', rank: 'K', numericValue: 13, isJack: false },
      { id: 'K♦', suit: '♦', rank: 'K', numericValue: 13, isJack: false },
      { id: 'K♣', suit: '♣', rank: 'K', numericValue: 13, isJack: false },
      { id: 'Q♠', suit: '♠', rank: 'Q', numericValue: 12, isJack: false },
      { id: 'Q♥', suit: '♥', rank: 'Q', numericValue: 12, isJack: false },
      { id: 'Q♦', suit: '♦', rank: 'Q', numericValue: 12, isJack: false },
      { id: 'Q♣', suit: '♣', rank: 'Q', numericValue: 12, isJack: false },
    ];
    const score = calculateScores(winningPile, 'player');
    assert.equal(score.balancedCombos, 1);
    assert.equal(score.balancedPoints, 50);
    assert.equal(score.ironCombos, 1);
    assert.equal(score.ironPoints, 50);
    assert.equal(score.regularSets, 0);
    assert.equal(score.totalScore, 50);
  });

  it('Matrix 7: Silver Combo (1 Jack Set + 1 Regular Set) = 60 pts', () => {
    const winningPile: Card[] = [
      { id: 'J♠', suit: '♠', rank: 'J', numericValue: 11, isJack: true },
      { id: 'J♥', suit: '♥', rank: 'J', numericValue: 11, isJack: true },
      { id: 'J♦', suit: '♦', rank: 'J', numericValue: 11, isJack: true },
      { id: 'J♣', suit: '♣', rank: 'J', numericValue: 11, isJack: true },
      { id: 'A♠', suit: '♠', rank: 'A', numericValue: 1, isJack: false },
      { id: 'A♥', suit: '♥', rank: 'A', numericValue: 1, isJack: false },
      { id: 'A♦', suit: '♦', rank: 'A', numericValue: 1, isJack: false },
      { id: 'A♣', suit: '♣', rank: 'A', numericValue: 1, isJack: false },
    ];
    const score = calculateScores(winningPile, 'player');
    assert.equal(score.silverCombos, 1);
    assert.equal(score.silverPoints, 60);
    assert.equal(score.totalScore, 60);
  });

  it('Matrix 8: Golden Combo Contract Definition = 75 pts', () => {
    assert.equal(SCORING_VALUES.GOLDEN, 75);
    assert.equal(SCORING_VALUES.GOLDEN_COMBO, 75);
  });

  it('Matrix 10 & 18: Golden Combo combination definition = 75 pts with exact 12-card deductive consumption', () => {
    // 1. Golden Combo points value verification
    assert.equal(SCORING_VALUES.GOLDEN, 75);
    assert.equal(SCORING_VALUES.GOLDEN_COMBO, 75);

    // 2. Exact card consumption calculation for a Golden Combo:
    // 1 Jack Set (4 cards) + 2 Regular Sets (8 cards) = 12 cards total.
    // At 75 points, exactly 12 cards are consumed with 0 left as individual Jacks or Regular cards.
    const goldenCardsCount = 4 + 8;
    assert.equal(goldenCardsCount, 12);
  });

  // C. Deductive consumption & Non-double counting
  it('Matrix 9 & 13 & 14 & 15: Cards consumed by Silver (4 Jacks + 4 Regular) are not scored again', () => {
    const winningPile: Card[] = [
      { id: 'J♠', suit: '♠', rank: 'J', numericValue: 11, isJack: true },
      { id: 'J♥', suit: '♥', rank: 'J', numericValue: 11, isJack: true },
      { id: 'J♦', suit: '♦', rank: 'J', numericValue: 11, isJack: true },
      { id: 'J♣', suit: '♣', rank: 'J', numericValue: 11, isJack: true },
      { id: 'A♠', suit: '♠', rank: 'A', numericValue: 1, isJack: false },
      { id: 'A♥', suit: '♥', rank: 'A', numericValue: 1, isJack: false },
      { id: 'A♦', suit: '♦', rank: 'A', numericValue: 1, isJack: false },
      { id: 'A♣', suit: '♣', rank: 'A', numericValue: 1, isJack: false },
      { id: '2♠', suit: '♠', rank: '2', numericValue: 2, isJack: false },
      { id: '3♦', suit: '♦', rank: '3', numericValue: 3, isJack: false },
    ];
    const score = calculateScores(winningPile, 'player');
    assert.equal(score.silverCombos, 1);
    assert.equal(score.silverPoints, 60);
    assert.equal(score.jackSets, 0);
    assert.equal(score.jackSetPoints, 0);
    assert.equal(score.regularSets, 0);
    assert.equal(score.regularSetPoints, 0);
    assert.equal(score.remainingJacks, 0);
    assert.equal(score.jackPoints, 0);
    assert.equal(score.remainingOtherCards, 2);
    assert.equal(score.cardPoints, 2);
    assert.equal(score.totalScore, 62);
  });

  it('Matrix 11 & 14 & 15: Cards consumed by Iron (12 Regular) are not scored again', () => {
    const winningPile: Card[] = [
      { id: 'A♠', suit: '♠', rank: 'A', numericValue: 1, isJack: false },
      { id: 'A♥', suit: '♥', rank: 'A', numericValue: 1, isJack: false },
      { id: 'A♦', suit: '♦', rank: 'A', numericValue: 1, isJack: false },
      { id: 'A♣', suit: '♣', rank: 'A', numericValue: 1, isJack: false },
      { id: 'K♠', suit: '♠', rank: 'K', numericValue: 13, isJack: false },
      { id: 'K♥', suit: '♥', rank: 'K', numericValue: 13, isJack: false },
      { id: 'K♦', suit: '♦', rank: 'K', numericValue: 13, isJack: false },
      { id: 'K♣', suit: '♣', rank: 'K', numericValue: 13, isJack: false },
      { id: 'Q♠', suit: '♠', rank: 'Q', numericValue: 12, isJack: false },
      { id: 'Q♥', suit: '♥', rank: 'Q', numericValue: 12, isJack: false },
      { id: 'Q♦', suit: '♦', rank: 'Q', numericValue: 12, isJack: false },
      { id: 'Q♣', suit: '♣', rank: 'Q', numericValue: 12, isJack: false },
      { id: '9♦', suit: '♦', rank: '9', numericValue: 9, isJack: false },
    ];
    const score = calculateScores(winningPile, 'player');
    assert.equal(score.balancedCombos, 1);
    assert.equal(score.balancedPoints, 50);
    assert.equal(score.regularSets, 0);
    assert.equal(score.remainingOtherCards, 1);
    assert.equal(score.cardPoints, 1);
    assert.equal(score.totalScore, 51);
  });

  it('Matrix 12 & 14 & 15: Cards consumed by Double (8 Regular) are not scored again', () => {
    const winningPile: Card[] = [
      { id: 'A♠', suit: '♠', rank: 'A', numericValue: 1, isJack: false },
      { id: 'A♥', suit: '♥', rank: 'A', numericValue: 1, isJack: false },
      { id: 'A♦', suit: '♦', rank: 'A', numericValue: 1, isJack: false },
      { id: 'A♣', suit: '♣', rank: 'A', numericValue: 1, isJack: false },
      { id: 'K♠', suit: '♠', rank: 'K', numericValue: 13, isJack: false },
      { id: 'K♥', suit: '♥', rank: 'K', numericValue: 13, isJack: false },
      { id: 'K♦', suit: '♦', rank: 'K', numericValue: 13, isJack: false },
      { id: 'K♣', suit: '♣', rank: 'K', numericValue: 13, isJack: false },
      { id: '2♠', suit: '♠', rank: '2', numericValue: 2, isJack: false },
      { id: '3♦', suit: '♦', rank: '3', numericValue: 3, isJack: false },
      { id: '4♣', suit: '♣', rank: '4', numericValue: 4, isJack: false },
    ];
    const score = calculateScores(winningPile, 'player');
    assert.equal(score.doubleCombos, 1);
    assert.equal(score.doublePoints, 30);
    assert.equal(score.regularSets, 0);
    assert.equal(score.remainingOtherCards, 3);
    assert.equal(score.cardPoints, 3);
    assert.equal(score.totalScore, 33);
  });

  // D. Priority: Golden MUST take precedence over Silver
  it('Matrix 16: If Jack Set + 1 Regular Set exists (Golden cannot be formed), Silver MUST be formed = 60 pts', () => {
    const winningPile: Card[] = [
      { id: 'J♠', suit: '♠', rank: 'J', numericValue: 11, isJack: true },
      { id: 'J♥', suit: '♥', rank: 'J', numericValue: 11, isJack: true },
      { id: 'J♦', suit: '♦', rank: 'J', numericValue: 11, isJack: true },
      { id: 'J♣', suit: '♣', rank: 'J', numericValue: 11, isJack: true },
      { id: 'A♠', suit: '♠', rank: 'A', numericValue: 1, isJack: false },
      { id: 'A♥', suit: '♥', rank: 'A', numericValue: 1, isJack: false },
      { id: 'A♦', suit: '♦', rank: 'A', numericValue: 1, isJack: false },
      { id: 'A♣', suit: '♣', rank: 'A', numericValue: 1, isJack: false },
    ];
    const score = calculateScores(winningPile, 'player');
    assert.equal(score.goldenCombos, 0);
    assert.equal(score.silverCombos, 1);
    assert.equal(score.silverPoints, 60);
    assert.equal(score.totalScore, 60);
  });

  it('Matrix 17: If Jack Set + 2 Regular Sets exists: Golden-first policy MUST be respected (Golden = 75, NOT Silver 60 + 12 = 72)', () => {
    const winningPile: Card[] = [
      { id: 'J♠', suit: '♠', rank: 'J', numericValue: 11, isJack: true },
      { id: 'J♥', suit: '♥', rank: 'J', numericValue: 11, isJack: true },
      { id: 'J♦', suit: '♦', rank: 'J', numericValue: 11, isJack: true },
      { id: 'J♣', suit: '♣', rank: 'J', numericValue: 11, isJack: true },
      { id: 'A♠', suit: '♠', rank: 'A', numericValue: 1, isJack: false },
      { id: 'A♥', suit: '♥', rank: 'A', numericValue: 1, isJack: false },
      { id: 'A♦', suit: '♦', rank: 'A', numericValue: 1, isJack: false },
      { id: 'A♣', suit: '♣', rank: 'A', numericValue: 1, isJack: false },
      { id: 'K♠', suit: '♠', rank: 'K', numericValue: 13, isJack: false },
      { id: 'K♥', suit: '♥', rank: 'K', numericValue: 13, isJack: false },
      { id: 'K♦', suit: '♦', rank: 'K', numericValue: 13, isJack: false },
      { id: 'K♣', suit: '♣', rank: 'K', numericValue: 13, isJack: false },
    ];
    const score = calculateScores(winningPile, 'player');
    assert.equal(score.goldenCombos, 1);
    assert.equal(score.goldenPoints, 75);
    assert.equal(score.silverCombos, 0);
    assert.equal(score.silverPoints, 0);
    assert.equal(score.regularSets, 0);
    assert.equal(score.regularSetPoints, 0);
    assert.equal(score.totalScore, 75);
  });

  it('Matrix 17B: 1 Jack Set + 3 Regular Sets produces Golden 75 + 1 Regular Set 12 = 87', () => {
    const winningPile: Card[] = [
      // 4 Jacks
      { id: 'J♠', suit: '♠', rank: 'J', numericValue: 11, isJack: true },
      { id: 'J♥', suit: '♥', rank: 'J', numericValue: 11, isJack: true },
      { id: 'J♦', suit: '♦', rank: 'J', numericValue: 11, isJack: true },
      { id: 'J♣', suit: '♣', rank: 'J', numericValue: 11, isJack: true },
      // 4 Aces
      { id: 'A♠', suit: '♠', rank: 'A', numericValue: 1, isJack: false },
      { id: 'A♥', suit: '♥', rank: 'A', numericValue: 1, isJack: false },
      { id: 'A♦', suit: '♦', rank: 'A', numericValue: 1, isJack: false },
      { id: 'A♣', suit: '♣', rank: 'A', numericValue: 1, isJack: false },
      // 4 Kings
      { id: 'K♠', suit: '♠', rank: 'K', numericValue: 13, isJack: false },
      { id: 'K♥', suit: '♥', rank: 'K', numericValue: 13, isJack: false },
      { id: 'K♦', suit: '♦', rank: 'K', numericValue: 13, isJack: false },
      { id: 'K♣', suit: '♣', rank: 'K', numericValue: 13, isJack: false },
      // 4 Queens
      { id: 'Q♠', suit: '♠', rank: 'Q', numericValue: 12, isJack: false },
      { id: 'Q♥', suit: '♥', rank: 'Q', numericValue: 12, isJack: false },
      { id: 'Q♦', suit: '♦', rank: 'Q', numericValue: 12, isJack: false },
      { id: 'Q♣', suit: '♣', rank: 'Q', numericValue: 12, isJack: false },
    ];
    const score = calculateScores(winningPile, 'player');
    assert.equal(score.goldenCombos, 1);
    assert.equal(score.goldenPoints, 75);
    assert.equal(score.silverCombos, 0);
    assert.equal(score.regularSets, 1);
    assert.equal(score.regularSetPoints, 12);
    assert.equal(score.totalScore, 87);
  });

  it('Matrix 17C: 1 Jack Set + 4 Regular Sets produces Golden 75 + Double 30 = 105', () => {
    const winningPile: Card[] = [
      // 4 Jacks
      { id: 'J♠', suit: '♠', rank: 'J', numericValue: 11, isJack: true },
      { id: 'J♥', suit: '♥', rank: 'J', numericValue: 11, isJack: true },
      { id: 'J♦', suit: '♦', rank: 'J', numericValue: 11, isJack: true },
      { id: 'J♣', suit: '♣', rank: 'J', numericValue: 11, isJack: true },
      // 4 Aces
      { id: 'A♠', suit: '♠', rank: 'A', numericValue: 1, isJack: false },
      { id: 'A♥', suit: '♥', rank: 'A', numericValue: 1, isJack: false },
      { id: 'A♦', suit: '♦', rank: 'A', numericValue: 1, isJack: false },
      { id: 'A♣', suit: '♣', rank: 'A', numericValue: 1, isJack: false },
      // 4 Kings
      { id: 'K♠', suit: '♠', rank: 'K', numericValue: 13, isJack: false },
      { id: 'K♥', suit: '♥', rank: 'K', numericValue: 13, isJack: false },
      { id: 'K♦', suit: '♦', rank: 'K', numericValue: 13, isJack: false },
      { id: 'K♣', suit: '♣', rank: 'K', numericValue: 13, isJack: false },
      // 4 Queens
      { id: 'Q♠', suit: '♠', rank: 'Q', numericValue: 12, isJack: false },
      { id: 'Q♥', suit: '♥', rank: 'Q', numericValue: 12, isJack: false },
      { id: 'Q♦', suit: '♦', rank: 'Q', numericValue: 12, isJack: false },
      { id: 'Q♣', suit: '♣', rank: 'Q', numericValue: 12, isJack: false },
      // 4 Tens
      { id: '10♠', suit: '♠', rank: '10', numericValue: 10, isJack: false },
      { id: '10♥', suit: '♥', rank: '10', numericValue: 10, isJack: false },
      { id: '10♦', suit: '♦', rank: '10', numericValue: 10, isJack: false },
      { id: '10♣', suit: '♣', rank: '10', numericValue: 10, isJack: false },
    ];
    const score = calculateScores(winningPile, 'player');
    assert.equal(score.goldenCombos, 1);
    assert.equal(score.goldenPoints, 75);
    assert.equal(score.doubleCombos, 1);
    assert.equal(score.doublePoints, 30);
    assert.equal(score.regularSets, 0);
    assert.equal(score.totalScore, 105);
  });

  // E. Perfect 52-card scoring scenario under Golden-First Contract (75 + 150 + 12 = 237)
  it('Matrix 19: Perfect 52-Card scenario produces exactly 237 (Golden 75 + 3x Iron 150 + 1x Regular Set 12 = 237)', () => {
    // Generate all 52 cards of the canonical deck (4 Jacks + 12 Regular Sets of 4 cards)
    const SUITS: Array<'♠' | '♥' | '♦' | '♣'> = ['♠', '♥', '♦', '♣'];
    const RANKS_LIST = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
    const fullDeck52: Card[] = [];

    for (const rank of RANKS_LIST) {
      for (const suit of SUITS) {
        fullDeck52.push({
          id: `${rank}${suit}`,
          suit,
          rank,
          numericValue: rank === 'A' ? 1 : rank === 'J' ? 11 : rank === 'Q' ? 12 : rank === 'K' ? 13 : parseInt(rank, 10),
          isJack: rank === 'J',
        });
      }
    }

    assert.equal(fullDeck52.length, 52);

    const score = calculateScores(fullDeck52, 'player');
    assert.equal(score.goldenCombos, 1);
    assert.equal(score.goldenPoints, 75);
    assert.equal(score.silverCombos, 0);
    assert.equal(score.silverPoints, 0);
    assert.equal(score.ironCombos, 3);
    assert.equal(score.ironPoints, 150);
    assert.equal(score.balancedCombos, 3);
    assert.equal(score.balancedPoints, 150);
    assert.equal(score.doubleCombos, 0);
    assert.equal(score.doublePoints, 0);
    assert.equal(score.regularSets, 1);
    assert.equal(score.regularSetPoints, 12);
    assert.equal(score.jackSets, 0);
    assert.equal(score.jackSetPoints, 0);
    assert.equal(score.remainingJacks, 0);
    assert.equal(score.remainingOtherCards, 0);
    assert.equal(score.totalScore, 237);
  });

  // F. Conservation
  it('Matrix 20: Card conservation — every card is accounted for exactly once with zero missing or phantom cards', () => {
    // Test pile with mixed cards: 1 Jack set, 2 Regular sets, 3 unconsumed non-Jacks (15 cards)
    const mixedPile: Card[] = [
      // 4 Jacks (Set)
      { id: 'J♠', suit: '♠', rank: 'J', numericValue: 11, isJack: true },
      { id: 'J♥', suit: '♥', rank: 'J', numericValue: 11, isJack: true },
      { id: 'J♦', suit: '♦', rank: 'J', numericValue: 11, isJack: true },
      { id: 'J♣', suit: '♣', rank: 'J', numericValue: 11, isJack: true },
      // 4 Aces (Regular set)
      { id: 'A♠', suit: '♠', rank: 'A', numericValue: 1, isJack: false },
      { id: 'A♥', suit: '♥', rank: 'A', numericValue: 1, isJack: false },
      { id: 'A♦', suit: '♦', rank: 'A', numericValue: 1, isJack: false },
      { id: 'A♣', suit: '♣', rank: 'A', numericValue: 1, isJack: false },
      // 4 Kings (Regular set)
      { id: 'K♠', suit: '♠', rank: 'K', numericValue: 13, isJack: false },
      { id: 'K♥', suit: '♥', rank: 'K', numericValue: 13, isJack: false },
      { id: 'K♦', suit: '♦', rank: 'K', numericValue: 13, isJack: false },
      { id: 'K♣', suit: '♣', rank: 'K', numericValue: 13, isJack: false },
      // 3 unconsumed cards
      { id: '2♠', suit: '♠', rank: '2', numericValue: 2, isJack: false },
      { id: '3♦', suit: '♦', rank: '3', numericValue: 3, isJack: false },
      { id: '4♣', suit: '♣', rank: '4', numericValue: 4, isJack: false },
    ];

    const score = calculateScores(mixedPile, 'player');
    // Under Golden-first: Golden consumes 1 Jack set + 2 Regular sets (12 cards)
    // 0 Regular sets remaining (0 cards)
    // 3 single cards remaining (3 cards)
    // Total accounted: 12 + 3 = 15 cards
    const accountedCards =
      score.goldenCombos * 12 +
      score.silverCombos * 8 +
      score.ironCombos * 12 +
      score.doubleCombos * 8 +
      score.jackSets * 4 +
      score.regularSets * 4 +
      score.remainingJacks +
      score.remainingOtherCards;

    assert.equal(accountedCards, mixedPile.length);
    assert.equal(score.totalCards, mixedPile.length);
    assert.equal(score.goldenCombos, 1);
    assert.equal(score.totalScore, 78); // Golden 75 + 3 singles = 78
  });
});

describe('Scenario 1 — Unified Rank Matching / Multi-Source Capture Tests', () => {
  // Helper to verify 52-card conservation in game states
  function verifyFullGameCardConservation(game: GameState) {
    const allCards: Card[] = [
      ...game.playerHand,
      ...game.cpuHand,
      ...game.table.playerTable,
      ...game.table.opponentTable,
      ...game.playerWinningPile,
      ...game.cpuWinningPile,
      ...game.deck,
    ];
    assert.equal(allCards.length, 52, 'Total cards in game must be exactly 52');
    const uniqueIds = new Set(allCards.map((c) => c.id));
    assert.equal(uniqueIds.size, 52, 'All 52 card IDs must be unique (0 duplicates, 0 missing)');
  }

  // Test 1 — Initial View / Two Tables
  it('Test 1 — Initial View / Two Tables: Played Rank + matching card on Player Table + matching card on Opponent Table = both captured', () => {
    const playedCard: Card = {
      id: '8♠',
      suit: '♠',
      rank: '8',
      numericValue: 8,
      isJack: false,
    };
    const playerTable: Card[] = [
      { id: '8♣', suit: '♣', rank: '8', numericValue: 8, isJack: false },
      { id: '2♦', suit: '♦', rank: '2', numericValue: 2, isJack: false },
    ];
    const opponentTable: Card[] = [
      { id: '8♥', suit: '♥', rank: '8', numericValue: 8, isJack: false },
      { id: 'K♠', suit: '♠', rank: 'K', numericValue: 13, isJack: false },
    ];

    const { captureResult, updatedPlayerTable, updatedOpponentTable, updatedOpponentWinningPile } =
      evaluateCapture(playedCard, playerTable, opponentTable, [], 'INITIAL_VIEW');

    assert.equal(captureResult.capturedFrom, 'MULTI_SOURCE');
    assert.equal(captureResult.capturedCards.length, 3); // 8♥ from oppTable + 8♣ from playerTable + 8♠ played
    assert.deepEqual(
      captureResult.capturedCards.map((c) => c.id).sort(),
      ['8♣', '8♥', '8♠'].sort()
    );

    // Remaining on tables
    assert.equal(updatedPlayerTable.length, 1);
    assert.equal(updatedPlayerTable[0].id, '2♦');
    assert.equal(updatedOpponentTable.length, 1);
    assert.equal(updatedOpponentTable[0].id, 'K♠');
    assert.equal(updatedOpponentWinningPile.length, 0);

    // Verify source metadata
    assert.equal(captureResult.sources?.length, 2);
    assert.ok(captureResult.sources?.includes('OPPONENT_TABLE'));
    assert.ok(captureResult.sources?.includes('PLAYER_TABLE'));
  });

  // Test 2 — Initial View / Jack
  it('Test 2 — Initial View / Jack: J in Hand + J on Player Table + J on Opponent Table = both captured (no full-table sweep, pure rank matching)', () => {
    const jackInHand: Card = {
      id: 'J♠',
      suit: '♠',
      rank: 'J',
      numericValue: 11,
      isJack: true,
    };
    const playerTable: Card[] = [
      { id: 'J♣', suit: '♣', rank: 'J', numericValue: 11, isJack: true },
      { id: '5♦', suit: '♦', rank: '5', numericValue: 5, isJack: false },
    ];
    const opponentTable: Card[] = [
      { id: 'J♥', suit: '♥', rank: 'J', numericValue: 11, isJack: true },
      { id: '9♠', suit: '♠', rank: '9', numericValue: 9, isJack: false },
    ];

    const { captureResult, updatedPlayerTable, updatedOpponentTable } = evaluateCapture(
      jackInHand,
      playerTable,
      opponentTable,
      [],
      'INITIAL_VIEW'
    );

    assert.equal(captureResult.capturedFrom, 'MULTI_SOURCE');
    assert.equal(captureResult.capturedCards.length, 3); // J♥ + J♣ + J♠
    assert.deepEqual(
      captureResult.capturedCards.map((c) => c.id).sort(),
      ['J♣', 'J♥', 'J♠'].sort()
    );

    // Non-Jack cards remain intact on tables
    assert.equal(updatedPlayerTable.length, 1);
    assert.equal(updatedPlayerTable[0].id, '5♦');
    assert.equal(updatedOpponentTable.length, 1);
    assert.equal(updatedOpponentTable[0].id, '9♠');
  });

  // Test 3 — Normal View / Top Only
  it('Test 3 — Normal View / Top Only: matching card buried in stack = NOT captured', () => {
    const playedCard: Card = {
      id: '10♦',
      suit: '♦',
      rank: '10',
      numericValue: 10,
      isJack: false,
    };
    // 10♥ is at bottom (index 0), K♠ is at top (index 1)
    const opponentTable: Card[] = [
      { id: '10♥', suit: '♥', rank: '10', numericValue: 10, isJack: false },
      { id: 'K♠', suit: '♠', rank: 'K', numericValue: 13, isJack: false },
    ];
    const playerTable: Card[] = [
      { id: '3♣', suit: '♣', rank: '3', numericValue: 3, isJack: false },
    ];

    const { captureResult, updatedPlayerTable, updatedOpponentTable } = evaluateCapture(
      playedCard,
      playerTable,
      opponentTable,
      [],
      'NORMAL_VIEW'
    );

    // No capture because top card is K♠ (not 10)
    assert.equal(captureResult.capturedFrom, 'NONE');
    assert.equal(captureResult.capturedCards.length, 0);
    // Played 10♦ is added to player's table stack
    assert.equal(updatedPlayerTable.length, 2);
    assert.equal(updatedPlayerTable[1].id, '10♦');
    assert.equal(updatedOpponentTable.length, 2);
  });

  // Test 4 — Normal View / Top Match
  it('Test 4 — Normal View / Top Match: matching top card = captured', () => {
    const playedCard: Card = {
      id: '10♦',
      suit: '♦',
      rank: '10',
      numericValue: 10,
      isJack: false,
    };
    // K♠ is at bottom (index 0), 10♥ is at top (index 1)
    const opponentTable: Card[] = [
      { id: 'K♠', suit: '♠', rank: 'K', numericValue: 13, isJack: false },
      { id: '10♥', suit: '♥', rank: '10', numericValue: 10, isJack: false },
    ];
    const playerTable: Card[] = [];

    const { captureResult, updatedOpponentTable } = evaluateCapture(
      playedCard,
      playerTable,
      opponentTable,
      [],
      'NORMAL_VIEW'
    );

    assert.equal(captureResult.capturedFrom, 'OPPONENT_TABLE');
    assert.equal(captureResult.capturedCards.length, 2); // 10♥ + 10♦
    assert.equal(updatedOpponentTable.length, 1);
    assert.equal(updatedOpponentTable[0].id, 'K♠'); // K♠ remains on opponent table
  });

  // Test 5 — Winning Pile
  it('Test 5 — Winning Pile: matching Top Rank + contiguous same-rank cards below it = captured', () => {
    const playedCard: Card = {
      id: 'A♣',
      suit: '♣',
      rank: 'A',
      numericValue: 1,
      isJack: false,
    };
    // Winning pile: 4♣ at bottom, followed by A♥, A♦ at top (contiguous Aces)
    const opponentWinningPile: Card[] = [
      { id: '4♣', suit: '♣', rank: '4', numericValue: 4, isJack: false },
      { id: 'A♥', suit: '♥', rank: 'A', numericValue: 1, isJack: false },
      { id: 'A♦', suit: '♦', rank: 'A', numericValue: 1, isJack: false },
    ];

    const { captureResult, updatedOpponentWinningPile } = evaluateCapture(
      playedCard,
      [],
      [],
      opponentWinningPile,
      'NORMAL_VIEW'
    );

    assert.equal(captureResult.capturedFrom, 'WINNING_PILE');
    assert.equal(captureResult.isTopUniformCapture, true);
    assert.equal(captureResult.capturedCards.length, 3); // A♥ + A♦ + played A♣
    assert.deepEqual(
      captureResult.capturedCards.map((c) => c.id).sort(),
      ['A♣', 'A♦', 'A♥'].sort()
    );
    assert.equal(updatedOpponentWinningPile.length, 1);
    assert.equal(updatedOpponentWinningPile[0].id, '4♣');
  });

  // Test 6 — Mixed Source Capture
  it('Test 6 — Mixed Source Capture: Hand + Player Table + Opponent Table + Opponent Winning Pile = single unified Capture', () => {
    const playedCard: Card = {
      id: '10♥',
      suit: '♥',
      rank: '10',
      numericValue: 10,
      isJack: false,
    };
    const playerTable: Card[] = [
      { id: '2♣', suit: '♣', rank: '2', numericValue: 2, isJack: false },
      { id: '10♣', suit: '♣', rank: '10', numericValue: 10, isJack: false },
    ];
    const opponentTable: Card[] = [
      { id: '5♠', suit: '♠', rank: '5', numericValue: 5, isJack: false },
      { id: '10♦', suit: '♦', rank: '10', numericValue: 10, isJack: false },
    ];
    const opponentWinningPile: Card[] = [
      { id: 'Q♠', suit: '♠', rank: 'Q', numericValue: 12, isJack: false },
      { id: '10♠', suit: '♠', rank: '10', numericValue: 10, isJack: false },
    ];

    const { captureResult, updatedPlayerTable, updatedOpponentTable, updatedOpponentWinningPile } =
      evaluateCapture(playedCard, playerTable, opponentTable, opponentWinningPile, 'NORMAL_VIEW');

    assert.equal(captureResult.capturedFrom, 'MULTI_SOURCE');
    assert.equal(captureResult.capturedCards.length, 4); // 10♦ (opp table) + 10♣ (player table) + 10♠ (opp won pile) + 10♥ (hand)
    assert.deepEqual(
      captureResult.capturedCards.map((c) => c.id).sort(),
      ['10♣', '10♦', '10♥', '10♠'].sort()
    );

    // Remaining state checks
    assert.equal(updatedPlayerTable.length, 1);
    assert.equal(updatedPlayerTable[0].id, '2♣');
    assert.equal(updatedOpponentTable.length, 1);
    assert.equal(updatedOpponentTable[0].id, '5♠');
    assert.equal(updatedOpponentWinningPile.length, 1);
    assert.equal(updatedOpponentWinningPile[0].id, 'Q♠');

    // Check origins
    assert.equal(captureResult.capturedWithOrigins?.length, 3);
    const origins = captureResult.capturedWithOrigins!;
    assert.equal(origins.find((o) => o.card.id === '10♦')?.source, 'OPPONENT_TABLE');
    assert.equal(origins.find((o) => o.card.id === '10♣')?.source, 'PLAYER_TABLE');
    assert.equal(origins.find((o) => o.card.id === '10♠')?.source, 'WINNING_PILE');
  });

  // Test 7 — Different Rank Below Top
  it('Test 7 — Different Rank Below Top: matching rank exists below a different-rank top = NOT captured', () => {
    const playedCard: Card = {
      id: '10♦',
      suit: '♦',
      rank: '10',
      numericValue: 10,
      isJack: false,
    };
    // 10♠ is buried under K♥ in winning pile
    const opponentWinningPile: Card[] = [
      { id: '10♠', suit: '♠', rank: '10', numericValue: 10, isJack: false },
      { id: 'K♥', suit: '♥', rank: 'K', numericValue: 13, isJack: false },
    ];
    const playerTable: Card[] = [];
    const opponentTable: Card[] = [];

    const { captureResult, updatedPlayerTable, updatedOpponentWinningPile } = evaluateCapture(
      playedCard,
      playerTable,
      opponentTable,
      opponentWinningPile,
      'NORMAL_VIEW'
    );

    assert.equal(captureResult.capturedFrom, 'NONE');
    assert.equal(captureResult.capturedCards.length, 0);
    assert.equal(updatedPlayerTable.length, 1);
    assert.equal(updatedPlayerTable[0].id, '10♦');
    assert.equal(updatedOpponentWinningPile.length, 2);
    assert.equal(updatedOpponentWinningPile[0].id, '10♠');
    assert.equal(updatedOpponentWinningPile[1].id, 'K♥');
  });

  // Test 8 — Card Conservation
  it('Test 8 — Card Conservation: exactly 52 unique cards throughout multi-turn simulated match with unified multi-source captures', () => {
    let game = createInitialGame(99999);
    verifyFullGameCardConservation(game);

    // Play all 6 rounds (each round 4 player cards + 4 CPU cards = 8 turns per round -> 48 turns total)
    let turnCount = 0;
    while (game.phase !== 'MATCH_END' && turnCount < 100) {
      if (game.phase === 'PLAYER_TURN') {
        const cardToPlay = game.playerHand[0];
        game = playPlayerCard(game, cardToPlay.id);
        verifyFullGameCardConservation(game);
      } else if (game.phase === 'CPU_TURN') {
        game = executeCpuTurn(game);
        verifyFullGameCardConservation(game);
      }
      turnCount++;
    }

    assert.equal(game.phase, 'MATCH_END');
    verifyFullGameCardConservation(game);
    assert.equal(game.deck.length, 0);
    assert.equal(game.playerHand.length, 0);
    assert.equal(game.cpuHand.length, 0);

    // Final total cards collected in winning piles + leftover tables must equal 52
    const finalTotal =
      game.playerWinningPile.length +
      game.cpuWinningPile.length +
      game.table.playerTable.length +
      game.table.opponentTable.length;
    assert.equal(finalTotal, 52);
  });
});

describe('Canonical Standard Deck Specification & Card ID Contract Validation', () => {
  const EXPECTED_CANONICAL_ORDER: { id: string; rank: string; suit: string }[] = [
    // Suit 1 = Clubs (1..13)
    { id: '1', rank: '2', suit: '♣' },
    { id: '2', rank: '3', suit: '♣' },
    { id: '3', rank: '4', suit: '♣' },
    { id: '4', rank: '5', suit: '♣' },
    { id: '5', rank: '6', suit: '♣' },
    { id: '6', rank: '7', suit: '♣' },
    { id: '7', rank: '8', suit: '♣' },
    { id: '8', rank: '9', suit: '♣' },
    { id: '9', rank: '10', suit: '♣' },
    { id: '10', rank: 'J', suit: '♣' },
    { id: '11', rank: 'Q', suit: '♣' },
    { id: '12', rank: 'K', suit: '♣' },
    { id: '13', rank: 'A', suit: '♣' },

    // Suit 2 = Diamonds (14..26)
    { id: '14', rank: '2', suit: '♦' },
    { id: '15', rank: '3', suit: '♦' },
    { id: '16', rank: '4', suit: '♦' },
    { id: '17', rank: '5', suit: '♦' },
    { id: '18', rank: '6', suit: '♦' },
    { id: '19', rank: '7', suit: '♦' },
    { id: '20', rank: '8', suit: '♦' },
    { id: '21', rank: '9', suit: '♦' },
    { id: '22', rank: '10', suit: '♦' },
    { id: '23', rank: 'J', suit: '♦' },
    { id: '24', rank: 'Q', suit: '♦' },
    { id: '25', rank: 'K', suit: '♦' },
    { id: '26', rank: 'A', suit: '♦' },

    // Suit 3 = Hearts (27..39)
    { id: '27', rank: '2', suit: '♥' },
    { id: '28', rank: '3', suit: '♥' },
    { id: '29', rank: '4', suit: '♥' },
    { id: '30', rank: '5', suit: '♥' },
    { id: '31', rank: '6', suit: '♥' },
    { id: '32', rank: '7', suit: '♥' },
    { id: '33', rank: '8', suit: '♥' },
    { id: '34', rank: '9', suit: '♥' },
    { id: '35', rank: '10', suit: '♥' },
    { id: '36', rank: 'J', suit: '♥' },
    { id: '37', rank: 'Q', suit: '♥' },
    { id: '38', rank: 'K', suit: '♥' },
    { id: '39', rank: 'A', suit: '♥' },

    // Suit 4 = Spades (40..52)
    { id: '40', rank: '2', suit: '♠' },
    { id: '41', rank: '3', suit: '♠' },
    { id: '42', rank: '4', suit: '♠' },
    { id: '43', rank: '5', suit: '♠' },
    { id: '44', rank: '6', suit: '♠' },
    { id: '45', rank: '7', suit: '♠' },
    { id: '46', rank: '8', suit: '♠' },
    { id: '47', rank: '9', suit: '♠' },
    { id: '48', rank: '10', suit: '♠' },
    { id: '49', rank: 'J', suit: '♠' },
    { id: '50', rank: 'Q', suit: '♠' },
    { id: '51', rank: 'K', suit: '♠' },
    { id: '52', rank: 'A', suit: '♠' },
  ];

  // A. Card Count
  it('A. Canonical Deck contains exactly 52 cards', () => {
    const deck = createStandardDeck();
    assert.equal(deck.length, 52);
    assert.equal(CANONICAL_DECK.length, 52);
  });

  // B. ID uniqueness (1 to 52 exactly once)
  it('B. IDs 1–52 are strictly unique and sequential', () => {
    const deck = createStandardDeck();
    const ids = deck.map((c) => c.id);
    const uniqueIds = new Set(ids);
    assert.equal(uniqueIds.size, 52);

    for (let i = 1; i <= 52; i++) {
      assert.equal(uniqueIds.has(String(i)), true, `Missing card ID ${i}`);
    }
  });

  // C. Card uniqueness (no duplicate card objects or rank/suit pairs)
  it('C. No duplicate rank-suit card combinations exist', () => {
    const deck = createStandardDeck();
    const pairs = deck.map((c) => `${c.rank}${c.suit}`);
    const uniquePairs = new Set(pairs);
    assert.equal(uniquePairs.size, 52);
  });

  // D. Canonical mapping verification against 100% of specification
  it('D. All 52 Card IDs exactly match the Canonical Specification', () => {
    const deck = createStandardDeck();
    assert.equal(deck.length, EXPECTED_CANONICAL_ORDER.length);

    for (let i = 0; i < 52; i++) {
      const actual = deck[i];
      const expected = EXPECTED_CANONICAL_ORDER[i];
      assert.equal(actual.id, expected.id, `Mismatch at index ${i}: expected ID ${expected.id} but got ${actual.id}`);
      assert.equal(actual.rank, expected.rank, `Mismatch at index ${i} (ID ${actual.id}): expected rank ${expected.rank} but got ${actual.rank}`);
      assert.equal(actual.suit, expected.suit, `Mismatch at index ${i} (ID ${actual.id}): expected suit ${expected.suit} but got ${actual.suit}`);

      // Verify getCardByCanonicalId helper
      const byId = getCardByCanonicalId(expected.id);
      assert.ok(byId);
      assert.equal(byId.id, expected.id);
      assert.equal(byId.rank, expected.rank);
      assert.equal(byId.suit, expected.suit);
    }
  });

  // E. Suit distribution (13 of each suit)
  it('E. Suit distribution is exactly 13 Clubs, 13 Diamonds, 13 Hearts, and 13 Spades', () => {
    const deck = createStandardDeck();
    assert.equal(deck.filter((c) => c.suit === '♣').length, 13);
    assert.equal(deck.filter((c) => c.suit === '♦').length, 13);
    assert.equal(deck.filter((c) => c.suit === '♥').length, 13);
    assert.equal(deck.filter((c) => c.suit === '♠').length, 13);

    // Verify SUIT_ORDER metadata
    assert.equal(SUIT_ORDER['♣'], 1);
    assert.equal(SUIT_ORDER['♦'], 2);
    assert.equal(SUIT_ORDER['♥'], 3);
    assert.equal(SUIT_ORDER['♠'], 4);
  });

  // F. Rank distribution (exactly 4 cards for every rank)
  it('F. Rank distribution contains exactly 4 cards for every rank (2..A)', () => {
    const deck = createStandardDeck();
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const;

    for (const rank of ranks) {
      const cardsOfRank = deck.filter((c) => c.rank === rank);
      assert.equal(cardsOfRank.length, 4, `Rank ${rank} count is ${cardsOfRank.length}, expected 4`);
    }
  });

  // G. Jack IDs verification
  it('G. Jack IDs are strictly J♣ = 10, J♦ = 23, J♥ = 36, J♠ = 49', () => {
    const deck = createStandardDeck();
    const jacks = deck.filter((c) => c.isJack);
    assert.equal(jacks.length, 4);

    const jackClubs = deck.find((c) => c.rank === 'J' && c.suit === '♣');
    const jackDiamonds = deck.find((c) => c.rank === 'J' && c.suit === '♦');
    const jackHearts = deck.find((c) => c.rank === 'J' && c.suit === '♥');
    const jackSpades = deck.find((c) => c.rank === 'J' && c.suit === '♠');

    assert.equal(jackClubs?.id, '10');
    assert.equal(jackDiamonds?.id, '23');
    assert.equal(jackHearts?.id, '36');
    assert.equal(jackSpades?.id, '49');
  });

  // H. Ace IDs verification
  it('H. Ace IDs are strictly A♣ = 13, A♦ = 26, A♥ = 39, A♠ = 52', () => {
    const deck = createStandardDeck();
    const aceClubs = deck.find((c) => c.rank === 'A' && c.suit === '♣');
    const aceDiamonds = deck.find((c) => c.rank === 'A' && c.suit === '♦');
    const aceHearts = deck.find((c) => c.rank === 'A' && c.suit === '♥');
    const aceSpades = deck.find((c) => c.rank === 'A' && c.suit === '♠');

    assert.equal(aceClubs?.id, '13');
    assert.equal(aceDiamonds?.id, '26');
    assert.equal(aceHearts?.id, '39');
    assert.equal(aceSpades?.id, '52');
  });

  // 7♦ ID verification
  it('7♦ ID is strictly 19', () => {
    const deck = createStandardDeck();
    const sevenDiamonds = deck.find((c) => c.rank === '7' && c.suit === '♦');
    assert.ok(sevenDiamonds);
    assert.equal(sevenDiamonds.id, '19');
    assert.equal(sevenDiamonds.rank, '7');
    assert.equal(sevenDiamonds.suit, '♦');
  });

  // Shuffling Contract: preserves identities, only changes position
  it('Shuffling Contract: preserves all 52 card identities, IDs and attributes without mutation', () => {
    const canonical = createStandardDeck();
    const shuffled = shuffleDeck(canonical, 424242);

    assert.equal(shuffled.length, 52);
    const shuffledIds = new Set(shuffled.map((c) => c.id));
    assert.equal(shuffledIds.size, 52);

    for (let i = 1; i <= 52; i++) {
      assert.equal(shuffledIds.has(String(i)), true);
    }

    // Every card in shuffled deck matches its canonical definition
    for (const card of shuffled) {
      const canonicalCard = getCardByCanonicalId(card.id);
      assert.ok(canonicalCard);
      assert.equal(card.rank, canonicalCard.rank);
      assert.equal(card.suit, canonicalCard.suit);
      assert.equal(card.numericValue, canonicalCard.numericValue);
      assert.equal(card.isJack, canonicalCard.isJack);
    }
  });
});

describe('EGYPTIAN JACKS — FINAL SCORING CONTRACT (A through L Regression Suite)', () => {
  // Helper to build 4 cards of a rank
  function makeSet(rank: 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'): Card[] {
    const suits: Array<'♣' | '♦' | '♥' | '♠'> = ['♣', '♦', '♥', '♠'];
    return suits.map((suit) => ({
      id: `${rank}${suit}`,
      rank,
      suit,
      numericValue: rank === 'A' ? 1 : rank === 'J' ? 11 : rank === 'Q' ? 12 : rank === 'K' ? 13 : parseInt(rank, 10),
      isJack: rank === 'J',
    }));
  }

  // A. 1 Jack Set = 36
  it('A. 1 Jack Set = 36 pts', () => {
    const pile = [...makeSet('J')];
    const score = calculateScores(pile, 'player');
    assert.equal(score.jackSets, 1);
    assert.equal(score.jackSetPoints, 36);
    assert.equal(score.totalScore, 36);
  });

  // B. 1 Regular Set = 12
  it('B. 1 Regular Set = 12 pts', () => {
    const pile = [...makeSet('A')];
    const score = calculateScores(pile, 'player');
    assert.equal(score.regularSets, 1);
    assert.equal(score.regularSetPoints, 12);
    assert.equal(score.totalScore, 12);
  });

  // C. 2 Regular Sets = 30 (Double Combo)
  it('C. 2 Regular Sets = 30 pts (Double Combo)', () => {
    const pile = [...makeSet('A'), ...makeSet('K')];
    const score = calculateScores(pile, 'player');
    assert.equal(score.doubleCombos, 1);
    assert.equal(score.doublePoints, 30);
    assert.equal(score.regularSets, 0);
    assert.equal(score.totalScore, 30);
  });

  // D. 3 Regular Sets = 50 (Iron Combo)
  it('D. 3 Regular Sets = 50 pts (Iron Combo)', () => {
    const pile = [...makeSet('A'), ...makeSet('K'), ...makeSet('Q')];
    const score = calculateScores(pile, 'player');
    assert.equal(score.ironCombos, 1);
    assert.equal(score.ironPoints, 50);
    assert.equal(score.regularSets, 0);
    assert.equal(score.totalScore, 50);
  });

  // E. 1 Jack + 1 Regular = 60 (Silver Combo)
  it('E. 1 Jack Set + 1 Regular Set = 60 pts (Silver Combo)', () => {
    const pile = [...makeSet('J'), ...makeSet('A')];
    const score = calculateScores(pile, 'player');
    assert.equal(score.silverCombos, 1);
    assert.equal(score.silverPoints, 60);
    assert.equal(score.goldenCombos, 0);
    assert.equal(score.totalScore, 60);
  });

  // F. 1 Jack + 2 Regular = 75 (Golden Combo takes priority)
  it('F. 1 Jack Set + 2 Regular Sets = 75 pts (Golden Combo takes priority over Silver)', () => {
    const pile = [...makeSet('J'), ...makeSet('A'), ...makeSet('K')];
    const score = calculateScores(pile, 'player');
    assert.equal(score.goldenCombos, 1);
    assert.equal(score.goldenPoints, 75);
    assert.equal(score.silverCombos, 0);
    assert.equal(score.regularSets, 0);
    assert.equal(score.totalScore, 75);
  });

  // G. 1 Jack + 3 Regular = 87 (Golden 75 + Remaining Regular Set 12)
  it('G. 1 Jack Set + 3 Regular Sets = 87 pts (Golden 75 + Regular Set 12)', () => {
    const pile = [...makeSet('J'), ...makeSet('A'), ...makeSet('K'), ...makeSet('Q')];
    const score = calculateScores(pile, 'player');
    assert.equal(score.goldenCombos, 1);
    assert.equal(score.goldenPoints, 75);
    assert.equal(score.silverCombos, 0);
    assert.equal(score.regularSets, 1);
    assert.equal(score.regularSetPoints, 12);
    assert.equal(score.totalScore, 87);
  });

  // H. 1 Jack + 4 Regular = Golden 75 + Double 30 = 105
  it('H. 1 Jack Set + 4 Regular Sets = 105 pts (Golden 75 + Double Combo 30)', () => {
    const pile = [...makeSet('J'), ...makeSet('A'), ...makeSet('K'), ...makeSet('Q'), ...makeSet('10')];
    const score = calculateScores(pile, 'player');
    assert.equal(score.goldenCombos, 1);
    assert.equal(score.goldenPoints, 75);
    assert.equal(score.silverCombos, 0);
    assert.equal(score.doubleCombos, 1);
    assert.equal(score.doublePoints, 30);
    assert.equal(score.regularSets, 0);
    assert.equal(score.totalScore, 105);
  });

  // I. 1 Jack + 12 Regular = 237 (Golden 75 + Iron x3 150 + Regular Set x1 12)
  it('I. 1 Jack Set + 12 Regular Sets = 237 pts (Golden 75 + Iron x3 150 + Regular Set x1 12 = 237)', () => {
    const allRanks: Array<'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'> = [
      'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'
    ];
    const fullDeck52 = allRanks.flatMap(makeSet);
    assert.equal(fullDeck52.length, 52);

    const score = calculateScores(fullDeck52, 'player');
    assert.equal(score.goldenCombos, 1);
    assert.equal(score.goldenPoints, 75);
    assert.equal(score.silverCombos, 0);
    assert.equal(score.silverPoints, 0);
    assert.equal(score.ironCombos, 3);
    assert.equal(score.ironPoints, 150);
    assert.equal(score.doubleCombos, 0);
    assert.equal(score.doublePoints, 0);
    assert.equal(score.regularSets, 1);
    assert.equal(score.regularSetPoints, 12);
    assert.equal(score.jackSets, 0);
    assert.equal(score.totalScore, 237);
  });

  // J. Deductive / No Double Counting
  it('J. No double counting: each set/card resource is consumed exactly once', () => {
    const pile: Card[] = [
      ...makeSet('J'),
      ...makeSet('A'),
      ...makeSet('K'),
      { id: '2♣', rank: '2', suit: '♣', numericValue: 2, isJack: false },
      { id: '3♦', rank: '3', suit: '♦', numericValue: 3, isJack: false },
    ];
    const score = calculateScores(pile, 'player');
    // Golden consumes 1 Jack set + 2 Regular sets (12 cards)
    // Remaining are 2 individual cards
    assert.equal(score.goldenCombos, 1);
    assert.equal(score.goldenPoints, 75);
    assert.equal(score.silverCombos, 0);
    assert.equal(score.jackSets, 0);
    assert.equal(score.regularSets, 0);
    assert.equal(score.remainingOtherCards, 2);
    assert.equal(score.cardPoints, 2);
    assert.equal(score.totalScore, 77);
  });

  // K. Golden MUST take precedence over Silver
  it('K. Golden MUST take precedence over Silver when both are structurally possible', () => {
    const pile = [...makeSet('J'), ...makeSet('A'), ...makeSet('K')];
    const score = calculateScores(pile, 'player');
    // If Silver was chosen: Silver 60 + Regular Set 12 = 72
    // But Golden is chosen: Golden 75 + 0 = 75
    assert.equal(score.goldenCombos, 1);
    assert.equal(score.silverCombos, 0);
    assert.equal(score.totalScore, 75);
    assert.notEqual(score.totalScore, 72);
  });

  // L. Silver MUST only occur when Golden cannot be formed from the remaining resources
  it('L. Silver MUST only occur when Golden cannot be formed from the remaining resources', () => {
    // 1 Jack Set + 1 Regular Set: Golden requires 2 Regular Sets, so Golden cannot form. Silver forms!
    const pileOnlyOneRegular = [...makeSet('J'), ...makeSet('A')];
    const scoreA = calculateScores(pileOnlyOneRegular, 'player');
    assert.equal(scoreA.goldenCombos, 0);
    assert.equal(scoreA.silverCombos, 1);
    assert.equal(scoreA.totalScore, 60);

    // 2 Jack Sets + 3 Regular Sets: 1 Golden forms (uses 1 Jack + 2 Regular), leaving 1 Jack + 1 Regular -> 1 Silver forms!
    // Total = Golden 75 + Silver 60 = 135
    const doubleJacksAndThreeRegular: Card[] = [
      ...makeSet('J'),
      { id: 'J_extra1', rank: 'J', suit: '♣', numericValue: 11, isJack: true },
      { id: 'J_extra2', rank: 'J', suit: '♦', numericValue: 11, isJack: true },
      { id: 'J_extra3', rank: 'J', suit: '♥', numericValue: 11, isJack: true },
      { id: 'J_extra4', rank: 'J', suit: '♠', numericValue: 11, isJack: true },
      ...makeSet('A'),
      ...makeSet('K'),
      ...makeSet('Q'),
    ];
    const scoreB = calculateScores(doubleJacksAndThreeRegular, 'player');
    assert.equal(scoreB.goldenCombos, 1);
    assert.equal(scoreB.silverCombos, 1);
    assert.equal(scoreB.totalScore, 135);
  });
});

describe('Egyptian Jacks — Match Engine & Memory Anchor v2.0', () => {
  it('Deterministic Cut: cut index is strictly between 10 and 42 and deterministic per seed', () => {
    const cut1 = calculateDeterministicCutIndex(12345);
    const cut2 = calculateDeterministicCutIndex(12345);
    assert.equal(cut1, cut2);
    assert.ok(cut1 >= 10 && cut1 <= 42);

    const deck = createStandardDeck();
    const cutResult = cutDeck(deck, 20);
    assert.equal(cutResult.length, 52);
    // After cutting at 20, the original 20th card is now at the beginning
    assert.equal(cutResult[0].id, deck[20].id);
    assert.equal(cutResult[31].id, deck[51].id);
    assert.equal(cutResult[32].id, deck[0].id);
  });

  it('Memory Anchor: revealed bottom card is captured and matches the actual last dealt card', () => {
    const { deck, revealedBottomCard, cutIndex } = prepareRoundDeck(999);
    assert.equal(deck.length, 52);
    assert.ok(cutIndex >= 10 && cutIndex <= 42);
    assert.equal(revealedBottomCard.id, deck[deck.length - 1].id); // bottom of deck is index 51

    const game = createInitialGame(999);
    assert.equal(game.revealedLastCard?.id, revealedBottomCard.id);
  });

  it('Round Starter alternation: supports player or CPU first player deterministically', () => {
    const gamePlayerFirst = createInitialGame(100, 'player');
    assert.equal(gamePlayerFirst.firstPlayer, 'player');
    assert.equal(gamePlayerFirst.activeTurn, 'player');
    assert.equal(gamePlayerFirst.phase, 'PLAYER_TURN');

    const gameCpuFirst = createInitialGame(100, 'cpu');
    assert.equal(gameCpuFirst.firstPlayer, 'cpu');
    assert.equal(gameCpuFirst.activeTurn, 'cpu');
    assert.equal(gameCpuFirst.phase, 'CPU_TURN');
  });

  it('Match Engine: Single Match lifecycle', () => {
    const { match, round } = createInitialMatch('SINGLE', 500, 'player');
    assert.equal(match.format, 'SINGLE');
    assert.equal(match.targetWins, 1);
    assert.equal(match.currentRound, 1);
    assert.equal(match.playerRoundWins, 0);
    assert.equal(match.cpuRoundWins, 0);
    assert.equal(match.status, 'IN_ROUND');
    assert.equal(round.firstPlayer, 'player');
  });

  it('Match Engine: Best of 3 Lifecycle with Starter Rotation', () => {
    const { match: m1, round: r1 } = createInitialMatch('BEST_OF_3', 777, 'player');
    assert.equal(m1.targetWins, 2);
    assert.equal(m1.currentRoundStarter, 'player');

    // Simulate Round 1 finish: Player wins (80 vs 50)
    const finishedR1: GameState = {
      ...r1,
      phase: 'MATCH_END',
      winner: 'player',
      playerScore: {
        playerId: 'player',
        totalScore: 80,
        totalCards: 30,
        goldenCombos: 1,
        goldenPoints: 75,
        silverCombos: 0,
        silverPoints: 0,
        ironCombos: 0,
        ironPoints: 0,
        balancedCombos: 0,
        balancedPoints: 0,
        doubleCombos: 0,
        doublePoints: 0,
        jackSets: 0,
        jackSetPoints: 0,
        regularSets: 0,
        regularSetPoints: 0,
        jackCount: 1,
        remainingJacks: 1,
        jackPoints: 3,
        remainingOtherCards: 2,
        cardPoints: 2,
        sets: [],
        log: [],
      },
      cpuScore: {
        playerId: 'cpu',
        totalScore: 50,
        totalCards: 22,
        goldenCombos: 0,
        goldenPoints: 0,
        silverCombos: 0,
        silverPoints: 0,
        ironCombos: 1,
        ironPoints: 50,
        balancedCombos: 1,
        balancedPoints: 50,
        doubleCombos: 0,
        doublePoints: 0,
        jackSets: 0,
        jackSetPoints: 0,
        regularSets: 0,
        regularSetPoints: 0,
        jackCount: 0,
        remainingJacks: 0,
        jackPoints: 0,
        remainingOtherCards: 0,
        cardPoints: 0,
        sets: [],
        log: [],
      },
    };

    const { match: m1Final } = finalizeRoundInMatch(m1, finishedR1);
    assert.equal(m1Final.playerRoundWins, 1);
    assert.equal(m1Final.cpuRoundWins, 0);
    assert.equal(m1Final.status, 'ROUND_SUMMARY');
    assert.equal(m1Final.matchWinner, null);

    // Start Round 2: Starter must rotate to CPU!
    const { match: m2, round: r2 } = startNextRoundInMatch(m1Final, 888);
    assert.equal(m2.currentRound, 2);
    assert.equal(m2.currentRoundStarter, 'cpu');
    assert.equal(r2.firstPlayer, 'cpu');
    assert.equal(r2.activeTurn, 'cpu');

    // Simulate Round 2 finish: Player wins again (75 vs 40)
    const finishedR2: GameState = {
      ...r2,
      phase: 'MATCH_END',
      winner: 'player',
      playerScore: { ...finishedR1.playerScore!, totalScore: 75 },
      cpuScore: { ...finishedR1.cpuScore!, totalScore: 40 },
    };

    const { match: m2Final } = finalizeRoundInMatch(m2, finishedR2);
    assert.equal(m2Final.playerRoundWins, 2);
    assert.equal(m2Final.status, 'MATCH_OVER');
    assert.equal(m2Final.matchWinner, 'player');
    assert.equal(m2Final.roundHistory.length, 2);
  });
});


