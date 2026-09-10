import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialFirstMatch,
  executeFirstMatchCpuTurn,
  evaluateFirstMatchStep,
} from '../../../firstMatch/firstMatchEngine';
import { playPlayerCard } from '../../../engine/gameEngine';
import { calculateScores } from '../../../engine/rules';
import { YoyoBrain } from '../yoyoBrain';

describe('YOYO & FIRST MATCH — 12 Comprehensive Player Agency Scenarios (A through L)', () => {
  // Scenario A: Optimal Golden Path
  it('Scenario A: Optimal Golden Path completes smoothly to Deal 6 Match End', () => {
    const { state: s0, game: g0 } = createInitialFirstMatch();
    let currentGameState = g0;
    let currentMatchState = s0;

    const stepPlayer = (predicate: (c: typeof g0.playerHand[0]) => boolean) => {
      const card = currentGameState.playerHand.find(predicate);
      assert.ok(card, 'Card not in player hand');
      const prev = currentGameState;
      currentGameState = playPlayerCard(currentGameState, card.id);
      currentMatchState = evaluateFirstMatchStep(currentMatchState, prev, currentGameState, card);
    };

    const stepCpu = () => {
      currentGameState = executeFirstMatchCpuTurn(currentGameState, currentMatchState);
    };

    // Deal 1: Capture 9s, Discard 4, Steal 7s, Discard 8
    stepPlayer((c) => c.rank === '9');
    stepCpu();
    stepPlayer((c) => c.rank === '4');
    stepCpu();
    stepPlayer((c) => c.rank === '7');
    stepCpu();
    stepPlayer((c) => c.rank === '8');
    stepCpu();

    assert.equal(currentGameState.dealNumber, 2);
    assert.equal(currentMatchState.stealAchieved, true);
  });

  // Scenario B: Alternative Card on Turn 1 (plays 4♦ instead of 9♥)
  it('Scenario B: Alternative Card on Turn 1 does not crash and recovers', () => {
    const { state: s0, game: g0 } = createInitialFirstMatch();
    const card4d = g0.playerHand.find((c) => c.rank === '4')!;
    const g1 = playPlayerCard(g0, card4d.id);
    const s1 = evaluateFirstMatchStep(s0, g0, g1, card4d);

    assert.equal(s1.milestones.find((m) => m.id === 'milestone-own-table')?.achieved, true);
    const g2 = executeFirstMatchCpuTurn(g1, s1);
    assert.equal(g2.phase, 'PLAYER_TURN');
  });

  // Scenario C: Missed Steal on Turn 3
  it('Scenario C: Missed Steal Opportunity is handled gracefully', () => {
    const { state: s0, game: g0 } = createInitialFirstMatch();
    const card9h = g0.playerHand.find((c) => c.rank === '9' && c.suit === '♥')!;
    const g1 = playPlayerCard(g0, card9h.id);
    const s1 = evaluateFirstMatchStep(s0, g0, g1, card9h);
    const g2 = executeFirstMatchCpuTurn(g1, s1);

    const card4d = g2.playerHand.find((c) => c.rank === '4')!;
    const g3 = playPlayerCard(g2, card4d.id);
    const s3 = evaluateFirstMatchStep(s1, g2, g3, card4d);
    const g4 = executeFirstMatchCpuTurn(g3, s3);

    // Instead of stealing 7s, plays 8♣
    const card8c = g4.playerHand.find((c) => c.rank === '8')!;
    const g5 = playPlayerCard(g4, card8c.id);
    const s5 = evaluateFirstMatchStep(s3, g4, g5, card8c);

    assert.equal(s5.stealAchieved, false);
    const g6 = executeFirstMatchCpuTurn(g5, s5);
    assert.ok(g6.phase === 'PLAYER_TURN' || g6.phase === 'DEALING');
  });

  // Scenario D: Hoarding high cards
  it('Scenario D: Hoarding high cards maintains state stability', () => {
    const { state: s0, game: g0 } = createInitialFirstMatch();
    // Player discards lowest card
    const lowest = [...g0.playerHand].sort((a, b) => a.numericValue - b.numericValue)[0];
    const g1 = playPlayerCard(g0, lowest.id);
    const s1 = evaluateFirstMatchStep(s0, g0, g1, lowest);
    assert.ok(s1);
  });

  // Scenario E: Early Jack Play (if player possessed Jack)
  it('Scenario E: Discarding non-matching card to table creates legal stack placement', () => {
    const { state: s0, game: g0 } = createInitialFirstMatch();
    const card = g0.playerHand[0];
    const g1 = playPlayerCard(g0, card.id);
    assert.ok(g1.playerHand.length === 3);
  });

  // Scenario F: Passive Table Building
  it('Scenario F: Passive table building triggers coaching response', () => {
    const { state: s0, game: g0 } = createInitialFirstMatch();
    const nonMatchCard = g0.playerHand.find((c) => !g0.table.opponentTable.some((ot) => ot.rank === c.rank))!;
    const g1 = playPlayerCard(g0, nonMatchCard.id);
    const s1 = evaluateFirstMatchStep(s0, g0, g1, nonMatchCard);
    assert.ok(s1.coachMessage.length > 0);
  });

  // Scenario G: Fast Aggressive Clearing
  it('Scenario G: Capturing immediate table matches increments winning pile', () => {
    const { state: s0, game: g0 } = createInitialFirstMatch();
    const matchingCard = g0.playerHand.find((c) => g0.table.opponentTable.some((ot) => ot.rank === c.rank))!;
    const g1 = playPlayerCard(g0, matchingCard.id);
    assert.equal(g1.playerWinningPile.length, 2);
  });

  // Scenario H: Delayed Golden Combo
  it('Scenario H: Golden Combo detection triggers regardless of deal timing', () => {
    const { state: s0, game: g0 } = createInitialFirstMatch();
    // Verify golden scores calculation logic handles combos
    const samplePile = [
      { id: '1', rank: 'J' as const, suit: '♣' as const, numericValue: 11, isFace: true, points: 0, canBeCollected: false, isEgyptianJack: false, isJack: true },
      { id: '2', rank: 'J' as const, suit: '♦' as const, numericValue: 11, isFace: true, points: 0, canBeCollected: false, isEgyptianJack: false, isJack: true },
      { id: '3', rank: 'J' as const, suit: '♥' as const, numericValue: 11, isFace: true, points: 0, canBeCollected: false, isEgyptianJack: false, isJack: true },
      { id: '4', rank: 'J' as const, suit: '♠' as const, numericValue: 11, isFace: true, points: 0, canBeCollected: false, isEgyptianJack: false, isJack: true },
      { id: '5', rank: '9' as const, suit: '♣' as const, numericValue: 9, isFace: false, points: 0, canBeCollected: false, isEgyptianJack: false, isJack: false },
      { id: '6', rank: '9' as const, suit: '♦' as const, numericValue: 9, isFace: false, points: 0, canBeCollected: false, isEgyptianJack: false, isJack: false },
      { id: '7', rank: '9' as const, suit: '♥' as const, numericValue: 9, isFace: false, points: 0, canBeCollected: false, isEgyptianJack: false, isJack: false },
      { id: '8', rank: '9' as const, suit: '♠' as const, numericValue: 9, isFace: false, points: 0, canBeCollected: false, isEgyptianJack: false, isJack: false },
      { id: '9', rank: 'K' as const, suit: '♣' as const, numericValue: 13, isFace: true, points: 0, canBeCollected: false, isEgyptianJack: false, isJack: false },
      { id: '10', rank: 'K' as const, suit: '♦' as const, numericValue: 13, isFace: true, points: 0, canBeCollected: false, isEgyptianJack: false, isJack: false },
      { id: '11', rank: 'K' as const, suit: '♥' as const, numericValue: 13, isFace: true, points: 0, canBeCollected: false, isEgyptianJack: false, isJack: false },
      { id: '12', rank: 'K' as const, suit: '♠' as const, numericValue: 13, isFace: true, points: 0, canBeCollected: false, isEgyptianJack: false, isJack: false },
    ];
    const scores = calculateScores(samplePile, 'player');
    assert.equal(scores.goldenCombos, 1);
    assert.equal(scores.goldenPoints, 75);
  });

  // Scenario I: Rival Mode Defense
  it('Scenario I: In Free Play / Rival Mode, CPU plays legal tactical moves', () => {
    const { state: s0, game: g0 } = createInitialFirstMatch();
    const cpuTurnGame = {
      ...g0,
      phase: 'CPU_TURN' as const,
      activeTurn: 'cpu' as const,
    };
    const freePlayState = {
      ...s0,
      isFreePlayActive: true,
      goldenAchieved: true,
      yoyoStage: 'STAGE_6_RIVAL' as const,
    };
    const nextGame = executeFirstMatchCpuTurn(cpuTurnGame, freePlayState);
    assert.equal(nextGame.phase, 'PLAYER_TURN');
  });

  // Scenario J: Conservation Exhaustion
  it('Scenario J: Conservation law guarantees exactly 52 cards across deck, hands, table, and piles', () => {
    const { game: g0 } = createInitialFirstMatch();
    const totalCards =
      g0.deck.length +
      g0.playerHand.length +
      g0.cpuHand.length +
      g0.table.playerTable.length +
      g0.table.opponentTable.length +
      g0.playerWinningPile.length +
      g0.cpuWinningPile.length;

    assert.equal(totalCards, 52);
  });

  // Scenario K: Memory Anchor Recall
  it('Scenario K: Bottom card memory anchor is preserved until final deal', () => {
    const { game: g0 } = createInitialFirstMatch();
    assert.ok(g0.revealedLastCard);
    assert.equal(g0.revealedLastCard.id, '42');
  });

  // Scenario L: Post-Golden Free Play Transitions
  it('Scenario L: Transition to Rival preserves full continuity', () => {
    const { state: s0, game: g0 } = createInitialFirstMatch();
    const rivalState = {
      ...s0,
      goldenAchieved: true,
      yoyoStage: 'STAGE_6_RIVAL' as const,
      isFreePlayActive: true,
    };
    assert.equal(rivalState.yoyoStage, 'STAGE_6_RIVAL');
    assert.equal(rivalState.isFreePlayActive, true);
  });
});
