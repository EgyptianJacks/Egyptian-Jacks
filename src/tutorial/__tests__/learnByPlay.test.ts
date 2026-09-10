import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialLearnByPlay,
  advanceLearnByPlayPhase,
  evaluateLearnByPlayAction,
  requestLearnByPlayHint,
  isCanonicalStealOccurred,
  isCanonicalSetFormed,
  isCanonicalComboAchieved,
  makeCard,
} from '../learnByPlayEngine';
import { createInitialGame, playPlayerCard } from '../../engine/gameEngine';
import { calculateScores } from '../../engine/rules';
import { GameState } from '../../types/game';

describe('Egyptian Jacks — Learn-by-Playing Tutorial System (A4 Validated)', () => {
  it('1. Initializes Phase 0 (Come Play) with friendly tone and deterministic seed', () => {
    const { state, game } = createInitialLearnByPlay();

    assert.equal(state.phase, 'PHASE_0_WELCOME');
    assert.equal(state.phaseIndex, 0);
    assert.equal(state.milestones.length, 8);
    assert.equal(state.milestones.every((m) => !m.achieved), true);

    // Initial board contains player table 9♣, player hand 9♥
    assert.ok(game.playerHand.some((c) => c.rank === '9'));
    assert.ok(game.table.playerTable.some((c) => c.rank === '9'));
  });

  it('2. Advances from Phase 0 to Phase 1/2 (Turn understanding & Rank Matching)', () => {
    const { state: s0, game: g0 } = createInitialLearnByPlay();
    const { state: s1, game: g1 } = advanceLearnByPlayPhase(s0, g0);

    assert.equal(s1.phase, 'PHASE_1_FIRST_TURN');
    assert.equal(s1.targetCardRank, '9');
    assert.ok(s1.coachMessage.includes('المطابقة بالرتبة'));
  });

  it('3. Direct Capture: playing matching card 9♥ captures 9♣ into Winning Pile', () => {
    const { state: s0, game: g0 } = createInitialLearnByPlay();
    const { state: s1, game: g1 } = advanceLearnByPlayPhase(s0, g0);

    const card9 = g1.playerHand.find((c) => c.rank === '9');
    assert.ok(card9);

    const nextGame = playPlayerCard(g1, card9.id);
    const { state: evaluated } = evaluateLearnByPlayAction(s1, g1, nextGame, card9);

    assert.equal(evaluated.phase, 'PHASE_3_FIRST_CAPTURE');
    assert.equal(evaluated.isSuccess, true);
    assert.ok(evaluated.feedbackTitle?.includes('أول أكل مباشر'));

    const captureMilestone = evaluated.milestones.find((m) => m.id === 'milestone-capture');
    assert.equal(captureMilestone?.achieved, true);
  });

  it('4. Own Table: playing non-matching card lands on player table as tactical reserve', () => {
    const { state: s0, game: g0 } = createInitialLearnByPlay();
    const { state: s1, game: g1 } = advanceLearnByPlayPhase(s0, g0);

    // Pick a card that does NOT match any table card (K♦)
    const cardKing = g1.playerHand.find((c) => c.rank === 'K');
    assert.ok(cardKing);

    const nextGame = playPlayerCard(g1, cardKing.id);
    const { state: evaluated } = evaluateLearnByPlayAction(s1, g1, nextGame, cardKing);

    assert.equal(evaluated.phase, 'PHASE_4_OWN_TABLE');
    assert.equal(evaluated.isSuccess, true);
    assert.ok(evaluated.feedbackTitle?.includes('طاولتك'));

    const tableMilestone = evaluated.milestones.find((m) => m.id === 'milestone-table');
    assert.equal(tableMilestone?.achieved, true);
  });

  it('5. Winning Pile & Steal: strictly validated against canonical engine state and rules', () => {
    const { state: s0, game: g0 } = createInitialLearnByPlay();
    const { state: s5, game: g5 } = advanceLearnByPlayPhase(
      { ...s0, phase: 'PHASE_3_FIRST_CAPTURE' },
      g0
    );
    assert.equal(s5.phase, 'PHASE_5_WINNING_PILE');

    // Advance to Steal setup
    const { state: s6, game: g6 } = advanceLearnByPlayPhase(s5, g5);
    assert.equal(s6.phase, 'PHASE_6_FIRST_STEAL');
    assert.equal(s6.targetCardRank, '7');

    // Verify top card of cpu winning pile is 7
    const topCpuCard = g6.cpuWinningPile[g6.cpuWinningPile.length - 1];
    assert.equal(topCpuCard.rank, '7');

    // Player plays 7♥
    const card7 = g6.playerHand.find((c) => c.rank === '7');
    assert.ok(card7);

    const nextGame = playPlayerCard(g6, card7.id);

    // Verify helper isCanonicalStealOccurred
    const { isSteal, stolenCards } = isCanonicalStealOccurred(g6, nextGame);
    assert.equal(isSteal, true);
    assert.ok(stolenCards.length >= 2);

    const { state: evaluated } = evaluateLearnByPlayAction(s6, g6, nextGame, card7);

    assert.equal(evaluated.isSuccess, true);
    assert.ok(evaluated.feedbackTitle?.includes('سرقة'));

    const stealMilestone = evaluated.milestones.find((m) => m.id === 'milestone-steal');
    assert.equal(stealMilestone?.achieved, true);
  });

  it('6. Progressive Hint System: Attention -> Target -> Action without leaking hidden data', () => {
    const { state: s0, game: g0 } = createInitialLearnByPlay();
    const { state: s1, game: g1 } = advanceLearnByPlayPhase(s0, g0);

    // Level 1: Attention
    const h1 = requestLearnByPlayHint(s1, g1);
    assert.equal(h1.hintLevel, 1);
    assert.ok(h1.currentHint?.title.includes('الانتباه'));

    // Level 2: Target
    const h2 = requestLearnByPlayHint(h1, g1);
    assert.equal(h2.hintLevel, 2);
    assert.ok(h2.currentHint?.title.includes('الهدف'));

    // Level 3: Action
    const h3 = requestLearnByPlayHint(h2, g1);
    assert.equal(h3.hintLevel, 3);
    assert.ok(h3.currentHint?.title.includes('المباشرة'));

    // Zero hidden-data leakage verification:
    // Modifying CPU hand has ZERO effect on hints
    const mutatedCpuGame = {
      ...g1,
      cpuHand: [{ id: 'mock', suit: '♠' as const, rank: 'A' as const, numericValue: 1, isJack: false }],
    };
    const h1Mutated = requestLearnByPlayHint(s1, mutatedCpuGame);
    assert.deepEqual(h1.currentHint, h1Mutated.currentHint);
  });

  it('7. Why am I collecting? & Regular Set: completing 4-card Ace Set (+12 pts)', () => {
    const { state: s0, game: g0 } = createInitialLearnByPlay();
    const { state: s7, game: g7 } = advanceLearnByPlayPhase(
      { ...s0, phase: 'PHASE_6_FIRST_STEAL' },
      g0
    );
    assert.equal(s7.phase, 'PHASE_7_WHY_COLLECT');

    // Player hand has Ace, winning pile has 3 Aces
    const cardAce = g7.playerHand.find((c) => c.rank === 'A');
    assert.ok(cardAce);

    const nextGame = playPlayerCard(g7, cardAce.id);
    const { state: evaluated } = evaluateLearnByPlayAction(s7, g7, nextGame, cardAce);

    assert.equal(evaluated.phase, 'PHASE_8_REGULAR_SET');
    assert.equal(evaluated.isSuccess, true);
    assert.ok(evaluated.feedbackTitle?.includes('مجموعة ملكية'));

    const setMilestone = evaluated.milestones.find((m) => m.id === 'milestone-set');
    assert.equal(setMilestone?.achieved, true);

    // Validate canonical set
    const setValidation = isCanonicalSetFormed(g7, nextGame, 'A');
    assert.equal(setValidation.isSet, true);
  });

  it('8. Phase 9 Jacks Reveal: 4 Jacks create Jack Set yielding 36 canonical points', () => {
    const { state: s0, game: g0 } = createInitialLearnByPlay();
    const { state: s9, game: g9 } = advanceLearnByPlayPhase(
      { ...s0, phase: 'PHASE_8_REGULAR_SET' },
      g0
    );
    assert.equal(s9.phase, 'PHASE_9_JACKS_REVEAL');
    assert.equal(s9.targetCardRank, 'J');

    const cardJ = g9.playerHand.find((c) => c.rank === 'J');
    assert.ok(cardJ);

    const nextGame = playPlayerCard(g9, cardJ.id);
    const { state: evaluated } = evaluateLearnByPlayAction(s9, g9, nextGame, cardJ);

    assert.equal(evaluated.isSuccess, true);
    assert.ok(evaluated.feedbackTitle?.includes('مجموعة الأولاد'));

    const jackMilestone = evaluated.milestones.find((m) => m.id === 'milestone-jacks');
    assert.equal(jackMilestone?.achieved, true);

    // Verify canonical calculateScores contains 36 jackSetPoints
    const scores = calculateScores(nextGame.playerWinningPile, 'player');
    assert.equal(scores.jackSets, 1);
    assert.equal(scores.jackSetPoints, 36);
  });

  it('9. Phase 10 Combos Reveal: upgrades Silver Combo (+60) to Golden Combo (+75)', () => {
    const { state: s0, game: g0 } = createInitialLearnByPlay();
    const { state: s10, game: g10 } = advanceLearnByPlayPhase(
      { ...s0, phase: 'PHASE_9_JACKS_REVEAL' },
      g0
    );
    assert.equal(s10.phase, 'PHASE_10_COMBOS_REVEAL');

    // Check pre-condition: Silver combo active
    const preCombo = isCanonicalComboAchieved(g10);
    assert.equal(preCombo.hasSilver, true);

    const cardK = g10.playerHand.find((c) => c.rank === 'K');
    assert.ok(cardK);

    const nextGame = playPlayerCard(g10, cardK.id);
    const { state: evaluated } = evaluateLearnByPlayAction(s10, g10, nextGame, cardK);

    assert.equal(evaluated.isSuccess, true);
    assert.ok(evaluated.feedbackTitle?.includes('المجموعة الذهبية'));

    const comboMilestone = evaluated.milestones.find((m) => m.id === 'milestone-combos');
    assert.equal(comboMilestone?.achieved, true);

    // Verify canonical calculateScores contains Golden Combo (+75 pts)
    const postCombo = isCanonicalComboAchieved(nextGame);
    assert.equal(postCombo.hasGolden, true);
    assert.equal(postCombo.breakdown.goldenPoints, 75);
  });

  it('10. Strategic Decision Dilemma (Phase 11): Choice A (Capture) vs Choice B (Sacrifice) with Observable Consequence', () => {
    const { state: s0, game: g0 } = createInitialLearnByPlay();
    const { state: s11, game: g11 } = advanceLearnByPlayPhase(
      { ...s0, phase: 'PHASE_10_COMBOS_REVEAL' },
      g0
    );
    assert.equal(s11.phase, 'PHASE_11_DECISION_DILEMMA');
    assert.ok(s11.decisionOptions);

    // Branch A: Immediate Capture with 6♦
    const card6 = g11.playerHand.find((c) => c.rank === '6');
    assert.ok(card6);
    const gameBranchA = playPlayerCard(g11, card6.id);
    const { state: stateBranchA } = evaluateLearnByPlayAction(s11, g11, gameBranchA, card6);

    assert.equal(stateBranchA.branchChoiceTaken, 'CAPTURE');
    assert.ok(stateBranchA.observableConsequence?.includes('المباشرة'));
    assert.ok(stateBranchA.feedbackTitle?.includes('الأكل الفوري'));
    const decisionMilestone = stateBranchA.milestones.find((m) => m.id === 'milestone-decision');
    assert.equal(decisionMilestone?.achieved, true);

    // Branch B: Strategic Sacrifice with 3♦
    const card3 = g11.playerHand.find((c) => c.rank === '3');
    assert.ok(card3);
    const gameBranchB = playPlayerCard(g11, card3.id);
    const { state: stateBranchB } = evaluateLearnByPlayAction(s11, g11, gameBranchB, card3);

    assert.equal(stateBranchB.branchChoiceTaken, 'SACRIFICE');
    assert.ok(stateBranchB.observableConsequence?.includes('الاستراتيجي'));
    assert.ok(stateBranchB.feedbackTitle?.includes('التضحية'));
  });

  it('11. Freedom & Free Play: transitions to independent match play with mastery badge', () => {
    const { state: s0, game: g0 } = createInitialLearnByPlay();
    const { state: s12 } = advanceLearnByPlayPhase(
      { ...s0, phase: 'PHASE_11_DECISION_DILEMMA' },
      g0
    );

    assert.equal(s12.phase, 'PHASE_12_FREE_PLAY');
    assert.equal(s12.isFreePlayActive, true);

    const masteryMilestone = s12.milestones.find((m) => m.id === 'milestone-mastery');
    assert.equal(masteryMilestone?.achieved, true);
  });

  it('12. Test A — Golden false positive: playing K without canonical Golden Combo MUST NOT achieve milestone', () => {
    const { state: s0, game: g0 } = createInitialLearnByPlay();
    const { state: s10, game: g10 } = advanceLearnByPlayPhase(
      { ...s0, phase: 'PHASE_9_JACKS_REVEAL' },
      g0
    );
    assert.equal(s10.phase, 'PHASE_10_COMBOS_REVEAL');

    // Mutate player winning pile so it has only Jacks and Aces, but NO Kings
    // Thus playing King gives only 1 King (no 2nd regular set, goldenCombos = 0)
    const nonGoldenGame: typeof g10 = {
      ...g10,
      playerWinningPile: g10.playerWinningPile.filter((c) => c.rank !== 'K'),
    };

    const cardK = nonGoldenGame.playerHand.find((c) => c.rank === 'K');
    assert.ok(cardK);

    const nextGame = playPlayerCard(nonGoldenGame, cardK.id);
    const postScores = calculateScores(nextGame.playerWinningPile, 'player');

    // Assert prerequisites: card played is 'K', but canonical goldenCombos is 0
    assert.equal(cardK.rank, 'K');
    assert.equal(postScores.goldenCombos, 0);

    const { state: evaluated } = evaluateLearnByPlayAction(s10, nonGoldenGame, nextGame, cardK);

    // Assert: Golden milestone MUST NOT be accepted!
    assert.equal(evaluated.isSuccess, false);
    assert.equal(evaluated.canAdvanceNext, false);
    const comboMilestone = evaluated.milestones.find((m) => m.id === 'milestone-combos');
    assert.equal(comboMilestone?.achieved, false);
    assert.ok(evaluated.feedbackTitle?.includes('لم تكتمل'));
  });

  it('13. Test B — Regular Set false positive: score >= 12 without new Regular Set MUST NOT achieve milestone', () => {
    const { state: s0, game: g0 } = createInitialLearnByPlay();
    const { state: s7, game: g7 } = advanceLearnByPlayPhase(
      { ...s0, phase: 'PHASE_6_FIRST_STEAL' },
      g0
    );
    assert.equal(s7.phase, 'PHASE_7_WHY_COLLECT');

    // Construct state where player has 12 single distinct cards in winning pile
    // totalScore >= 12, but ZERO regular sets
    const twelveSingles = [
      makeCard('s2', '♠', '2'),
      makeCard('h2', '♥', '2'),
      makeCard('d3', '♦', '3'),
      makeCard('s4', '♠', '4'),
      makeCard('s5', '♠', '5'),
      makeCard('h5', '♥', '5'),
      makeCard('s6', '♠', '6'),
      makeCard('s7', '♠', '7'),
      makeCard('s8', '♠', '8'),
      makeCard('s9', '♠', '9'),
      makeCard('s10', '♠', '10'),
      makeCard('sq', '♠', 'Q'),
    ];
    const dummyCard = makeCard('d6', '♦', '6');

    const highScoringGame: typeof g7 = {
      ...g7,
      playerWinningPile: twelveSingles,
      playerHand: [dummyCard],
      table: {
        ...g7.table,
        playerTable: [],
        opponentTable: [],
      },
    };

    const nextGame = playPlayerCard(highScoringGame, dummyCard.id);
    const postScores = calculateScores(nextGame.playerWinningPile, 'player');

    // Assert prerequisites: total score >= 12, but regularSets === 0
    assert.ok(postScores.totalScore >= 12);
    assert.equal(postScores.regularSets, 0);

    const { state: evaluated } = evaluateLearnByPlayAction(s7, highScoringGame, nextGame, dummyCard);

    // Assert: Regular Set milestone MUST NOT be accepted!
    assert.equal(evaluated.isSuccess, false);
    assert.equal(evaluated.canAdvanceNext, false);
    const setMilestone = evaluated.milestones.find((m) => m.id === 'milestone-set');
    assert.equal(setMilestone?.achieved, false);
  });

  it('14. Test C — Positive canonical behavior: Regular Set (12), Jack Set (36), Silver Combo (60), Golden Combo (75)', () => {
    // 1. Regular Set = 12
    const regularSetPile = [
      makeCard('sa', '♠', 'A'),
      makeCard('ha', '♥', 'A'),
      makeCard('da', '♦', 'A'),
      makeCard('ca', '♣', 'A'),
    ];
    const regularScore = calculateScores(regularSetPile, 'player');
    assert.equal(regularScore.regularSets, 1);
    assert.equal(regularScore.regularSetPoints, 12);
    assert.equal(regularScore.totalScore, 12);

    // 2. Jack Set = 36
    const jackSetPile = [
      makeCard('sj', '♠', 'J'),
      makeCard('hj', '♥', 'J'),
      makeCard('dj', '♦', 'J'),
      makeCard('cj', '♣', 'J'),
    ];
    const jackScore = calculateScores(jackSetPile, 'player');
    assert.equal(jackScore.jackSets, 1);
    assert.equal(jackScore.jackSetPoints, 36);
    assert.equal(jackScore.totalScore, 36);

    // 3. Silver Combo = 60
    const silverPile = [...jackSetPile, ...regularSetPile];
    const silverScore = calculateScores(silverPile, 'player');
    assert.equal(silverScore.silverCombos, 1);
    assert.equal(silverScore.silverPoints, 60);
    assert.equal(silverScore.totalScore, 60);

    // 4. Golden Combo = 75
    const kingSetPile = [
      makeCard('sk', '♠', 'K'),
      makeCard('hk', '♥', 'K'),
      makeCard('dk', '♦', 'K'),
      makeCard('ck', '♣', 'K'),
    ];
    const goldenPile = [...jackSetPile, ...regularSetPile, ...kingSetPile];
    const goldenScore = calculateScores(goldenPile, 'player');
    assert.equal(goldenScore.goldenCombos, 1);
    assert.equal(goldenScore.goldenPoints, 75);
    assert.equal(goldenScore.totalScore, 75);
  });

  it('15. Canonical Steal Gate: isCanonicalStealOccurred strictly rejects rank-matching without winning pile transfer and CPU pile reduction', () => {
    const { state: s0, game: g0 } = createInitialLearnByPlay();
    const { state: s5, game: g5 } = advanceLearnByPlayPhase(
      { ...s0, phase: 'PHASE_3_FIRST_CAPTURE' },
      g0
    );
    const { state: s6, game: g6 } = advanceLearnByPlayPhase(s5, g5);
    assert.equal(s6.phase, 'PHASE_6_FIRST_STEAL');

    const card7 = makeCard('c7', '♥', '7');

    // Case 1: Rank '7' played, but CPU winning pile NOT reduced
    const unreducedGame: GameState = {
      ...g6,
      cpuWinningPile: [makeCard('cpu7', '♦', '7')],
      playerWinningPile: [],
      actionHistory: [
        {
          sequence: 1,
          actor: 'player',
          cardId: card7.id,
          timestamp: Date.now(),
          captureResult: {
            capturedCards: [card7],
            capturedFrom: 'PLAYER_TABLE',
            isTopUniformCapture: false,
            sources: ['PLAYER_TABLE'],
            capturedWithOrigins: [],
            description: 'Played to table',
          },
          resultingPhase: 'CPU_TURN',
        },
      ],
    };

    const stealCheck = isCanonicalStealOccurred(g6, unreducedGame);
    assert.equal(stealCheck.isSteal, false);
    assert.equal(stealCheck.stolenCards.length, 0);

    const { state: evaluated } = evaluateLearnByPlayAction(s6, g6, unreducedGame, card7);
    assert.equal(evaluated.isSuccess, false);
    assert.equal(evaluated.canAdvanceNext, false);
    const stealMilestone = evaluated.milestones.find((m) => m.id === 'milestone-steal');
    assert.equal(stealMilestone?.achieved, false);
  });

  it('16. Canonical Sets Gate: isCanonicalSetFormed rejects set when 4 cards of rank are not completed in player winning pile', () => {
    const { state: s0, game: g0 } = createInitialLearnByPlay();
    const incompletePile = [
      makeCard('a1', '♠', 'A'),
      makeCard('a2', '♥', 'A'),
      makeCard('a3', '♦', 'A'),
    ];
    const prevGame = { ...g0, playerWinningPile: incompletePile.slice(0, 2) };
    const nextGame = { ...g0, playerWinningPile: incompletePile };

    const setCheck = isCanonicalSetFormed(prevGame, nextGame, 'A');
    assert.equal(setCheck.isSet, false);
    assert.equal(setCheck.newSetsCount, 0);
  });

  it('17. Fail-closed stolenCards: missing capturedWithOrigins results in isSteal: false without rank reconstruction', () => {
    const card7 = makeCard('c7', '♥', '7');
    const prevGame: GameState = {
      ...createInitialGame(1, 'player'),
      cpuWinningPile: [makeCard('cpu7', '♦', '7')],
      playerWinningPile: [],
    };

    // Even if capturedFrom is WINNING_PILE, if capturedWithOrigins is missing, fail-closed: NO rank-based guessing
    const fakeGame: GameState = {
      ...prevGame,
      cpuWinningPile: [],
      playerWinningPile: [card7, makeCard('cpu7', '♦', '7')],
      actionHistory: [
        {
          sequence: 1,
          actor: 'player',
          cardId: card7.id,
          timestamp: Date.now(),
          captureResult: {
            capturedCards: [card7, makeCard('cpu7', '♦', '7')],
            capturedFrom: 'WINNING_PILE',
            isTopUniformCapture: true,
            sources: ['WINNING_PILE'],
            capturedWithOrigins: undefined as any,
            description: 'Capture without origins metadata',
          },
          resultingPhase: 'CPU_TURN',
        },
      ],
    };

    const stealCheck = isCanonicalStealOccurred(prevGame, fakeGame);
    assert.equal(stealCheck.isSteal, false, 'Must fail-closed when capturedWithOrigins is missing');
    assert.deepEqual(stealCheck.stolenCards, [], 'Must not guess stolen cards by rank');
  });
});
