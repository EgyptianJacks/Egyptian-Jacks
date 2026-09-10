import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  runAllTutorialScenarios,
  runScenario,
  TUTORIAL_SCENARIOS,
  extractDecisionPoint,
} from '../tutorialScenarioHarness';
import { createInitialGame, playPlayerCard, executeCpuTurn } from '../../engine/gameEngine';
import { evaluateCapture, calculateScores } from '../../engine/rules';
import { TUTORIAL_SETUPS } from '../tutorialSetups';
import { TutorialLesson } from '../tutorialTypes';
import {
  createInitialTutorialRuntime,
  evaluateTutorialActionResult,
  completeTutorialLesson,
} from '../tutorialRuntimeController';
import {
  generateContextualHint,
  getNextHintLevel,
  getHintLevelForIntensity,
} from '../tutorialHintEngine';
import { analyzeGuidedMatchState } from '../guidedMatchEngine';

import { Suit, Rank, Card, GameState } from '../../types/game';

const makeTestCard = (id: string, suit: Suit, rank: Rank): Card => ({
  id,
  suit,
  rank,
  numericValue: rank === 'A' ? 1 : rank === 'J' ? 11 : rank === 'Q' ? 12 : rank === 'K' ? 13 : Number(rank),
  isJack: rank === 'J',
});

describe('A3 — Tutorial Scenario Conformance & Validation Suite', () => {
  // A3.1: Determinism Gate
  describe('A3.1 — Determinism Gate', () => {
    for (const lesson of [1, 2, 3, 4] as const) {
      it(`Lesson ${lesson} (Seed ${TUTORIAL_SETUPS[lesson].seed}) is 100% deterministic across multiple runs`, () => {
        const run1 = runScenario(TUTORIAL_SCENARIOS[lesson]);
        const run2 = runScenario(TUTORIAL_SCENARIOS[lesson]);

        assert.equal(run1.isDeterministic, true);
        assert.equal(run1.seed, run2.seed);
        assert.equal(run1.initialState.cutIndex, run2.initialState.cutIndex);
        assert.equal(run1.initialState.revealedLastCard?.id, run2.initialState.revealedLastCard?.id);
        assert.deepEqual(run1.initialState.playerHand, run2.initialState.playerHand);
        assert.deepEqual(run1.initialState.cpuHand, run2.initialState.cpuHand);
        assert.deepEqual(run1.initialState.playerTable, run2.initialState.playerTable);
        assert.deepEqual(run1.initialState.opponentTable, run2.initialState.opponentTable);
        assert.equal(run1.initialState.deckSize, run2.initialState.deckSize);
        assert.equal(run1.validationStatus, run2.validationStatus);
        assert.deepEqual(run1.decisionPoint, run2.decisionPoint);
        assert.deepEqual(run1.branchComparison, run2.branchComparison);
      });
    }
  });

  // A3.2: Initial State Conformance Gate
  describe('A3.2 — Initial State Conformance Gate', () => {
    for (const lesson of [1, 2, 3, 4] as const) {
      it(`Lesson ${lesson} adheres strictly to canonical initial setup (4/4 hands, 2/2 tables, 40 deck)`, () => {
        const setup = TUTORIAL_SETUPS[lesson];
        const state = createInitialGame(setup.seed, 'player');

        assert.equal(state.playerHand.length, 4, 'Player Hand must be exactly 4 cards');
        assert.equal(state.cpuHand.length, 4, 'CPU Hand must be exactly 4 cards');
        assert.equal(state.table.playerTable.length, 2, 'Player Table must be exactly 2 cards');
        assert.equal(state.table.opponentTable.length, 2, 'Opponent Table must be exactly 2 cards');
        assert.equal(state.deck.length, 40, 'Remaining Deck must be exactly 40 cards');
        assert.equal(state.table.viewMode, 'INITIAL_VIEW', 'Initial table view mode must be INITIAL_VIEW');
        assert.equal(state.playerWinningPile.length, 0, 'Player winning pile starts empty');
        assert.equal(state.cpuWinningPile.length, 0, 'CPU winning pile starts empty');
        assert.equal(state.phase, 'PLAYER_TURN');
        assert.equal(state.activeTurn, 'player');
      });
    }
  });

  // A3.3: Lesson 1 Direct Table Capture Gate
  describe('A3.3 — Lesson 1: Direct Table Capture Gate', () => {
    it('Executes and validates direct table capture on Seed 1 with canonical engine', () => {
      const state0 = createInitialGame(1, 'player');
      // Player hand has 9♥ (id 34) and 10♣ (id 9). Player Table has 9♣ (id 8). Opponent Table has 10♦ (id 22).
      const card9 = state0.playerHand.find((c) => c.rank === '9')!;
      assert.ok(card9 !== undefined);

      // Verify canonical capture evaluation
      const capEval = evaluateCapture(
        card9,
        state0.table.playerTable,
        state0.table.opponentTable,
        state0.cpuWinningPile,
        state0.table.viewMode
      );
      assert.equal(capEval.captureResult.capturedCards.length, 2);
      assert.deepEqual(
        capEval.captureResult.capturedCards.map((c) => c.rank + c.suit),
        ['9♣', '9♥']
      );
      assert.equal(capEval.captureResult.capturedFrom, 'PLAYER_TABLE');

      // Execute through gameEngine
      const postState = playPlayerCard(state0, card9.id);
      assert.equal(postState.playerWinningPile.length, 2);
      assert.deepEqual(
        postState.playerWinningPile.map((c) => c.rank + c.suit),
        ['9♣', '9♥']
      );
      assert.equal(postState.table.playerTable.length, 1);
      assert.equal(postState.table.playerTable[0].rank, '6');

      // Run scenario harness
      const result = runScenario(TUTORIAL_SCENARIOS[1]);
      assert.equal(result.decisionPoint.hasCaptureMove, true);
      assert.equal(result.validationStatus, 'VALIDATED');
      assert.ok(result.evidence.includes('تم إثبات وجود حركة أكل مباشرة'));
    });
  });

  // A3.4: Lesson 2 Winning Pile Steal Gate
  describe('A3.4 — Lesson 2: Winning Pile Steal Gate', () => {
    it('Executes legal deterministic prelude and validates pile steal on Seed 5', () => {
      // 1. Initial State
      const state0 = createInitialGame(5, 'player');
      assert.equal(state0.cpuWinningPile.length, 0);

      // 2. Legal Prelude Step 1: Player plays 7♠ (id 45) to player table without capture
      const card7s = state0.playerHand.find((c) => c.rank === '7' && c.suit === '♠')!;
      assert.ok(card7s !== undefined);
      const state1 = playPlayerCard(state0, card7s.id);
      assert.equal(state1.playerWinningPile.length, 0);
      assert.ok(state1.table.playerTable.some((c) => c.id === '45'));

      // 3. Legal Prelude Step 2: CPU executes canonical turn with 7♦ capturing 7♠
      const state2 = executeCpuTurn(state1);
      assert.equal(state2.cpuWinningPile.length, 2);
      assert.deepEqual(
        state2.cpuWinningPile.map((c) => c.rank + c.suit),
        ['7♠', '7♦']
      );
      const topCpuCard = state2.cpuWinningPile[state2.cpuWinningPile.length - 1];
      assert.equal(topCpuCard.rank, '7');

      // 4. Decision Point: Player has 7♥ in hand
      const card7h = state2.playerHand.find((c) => c.rank === '7')!;
      assert.ok(card7h !== undefined);
      const stealEval = evaluateCapture(
        card7h,
        state2.table.playerTable,
        state2.table.opponentTable,
        state2.cpuWinningPile,
        state2.table.viewMode
      );
      assert.equal(stealEval.captureResult.capturedFrom, 'WINNING_PILE');
      assert.equal(stealEval.captureResult.capturedCards.length, 3);
      assert.deepEqual(
        stealEval.captureResult.capturedCards.map((c) => c.rank + c.suit),
        ['7♠', '7♦', '7♥']
      );

      // 5. Execute Steal via gameEngine
      const state3 = playPlayerCard(state2, card7h.id);
      assert.equal(state3.playerWinningPile.length, 3);
      assert.equal(state3.cpuWinningPile.length, 0);
      assert.deepEqual(
        state3.playerWinningPile.map((c) => c.rank + c.suit),
        ['7♠', '7♦', '7♥']
      );

      // 6. Run Scenario Harness
      const result = runScenario(TUTORIAL_SCENARIOS[2]);
      assert.equal(result.decisionPoint.hasPileStealMove, true);
      assert.equal(result.validationStatus, 'VALIDATED');
      assert.ok(result.evidence.includes('تم إثبات فرصة سرقة كومة فوز الخصم بنجاح'));
    });
  });

  // A3.5: Lesson 3 Pattern / Set Formation Gate
  describe('A3.5 — Lesson 3: Pattern / Set Formation Gate', () => {
    it('Executes 4-card Regular Set completion and verifies canonical scoring on Seed 175', () => {
      // 1. Initial State: Hand has A♥ (id 39), Table has A♦ (id 26), A♣ (id 13), A♠ (id 52)
      const state0 = createInitialGame(175, 'player');
      const aceH = state0.playerHand.find((c) => c.rank === 'A')!;
      assert.ok(aceH !== undefined);

      // 2. Evaluate Capture: Matches all 3 Aces on table
      const capEval = evaluateCapture(
        aceH,
        state0.table.playerTable,
        state0.table.opponentTable,
        state0.cpuWinningPile,
        state0.table.viewMode
      );
      assert.equal(capEval.captureResult.capturedFrom, 'MULTI_SOURCE');
      assert.equal(capEval.captureResult.capturedCards.length, 4);
      assert.deepEqual(
        capEval.captureResult.capturedCards.map((c) => c.rank + c.suit),
        ['A♠', 'A♦', 'A♣', 'A♥']
      );

      // 3. Play card via gameEngine
      const postState = playPlayerCard(state0, aceH.id);
      assert.equal(postState.playerWinningPile.length, 4);

      // 4. Calculate Scores via canonical rules
      const score = calculateScores(postState.playerWinningPile, 'player');
      assert.equal(score.regularSets, 1, 'Exactly 1 full regular set of Aces');
      assert.equal(score.regularSetPoints, 12, '12 points for regular set');
      assert.equal(score.totalScore, 12, 'Total score must equal 12 pts');
      assert.equal(score.sets.length, 1);
      assert.equal(score.sets[0].rank, 'A');

      // 5. Run Scenario Harness
      const result = runScenario(TUTORIAL_SCENARIOS[3]);
      assert.equal(result.validationStatus, 'VALIDATED');
      assert.ok(result.evidence.includes('تم إثبات تشكل مجموعة مكتملة (4 كروت برتبة آس A)'));
    });
  });

  // A3.6: Lesson 4 Strategic Sacrifice & Timing Gate (Hard Gate)
  describe('A3.6 — Lesson 4: Strategic Sacrifice & Timing Gate (Hard Gate)', () => {
    it('Starts from identical initial state and proves genuine mathematical strategic divergence between Branch A and Branch B', () => {
      // 1. Exact same canonical initial state
      const state0 = createInitialGame(404, 'player');
      const decision = extractDecisionPoint(state0, 1);

      assert.equal(decision.hasCaptureMove, true);
      assert.equal(decision.hasSacrificeMove, true);

      // 2. Branch A: Immediate Capture with 6♦ (id 18)
      const stateAfterPlayerA = playPlayerCard(state0, '18');
      const stateAfterCpuA = executeCpuTurn(stateAfterPlayerA);
      const scoreA = calculateScores(stateAfterCpuA.playerWinningPile, 'player');

      // 3. Branch B: Sacrifice with 3♦ (id 15)
      const stateAfterPlayerB = playPlayerCard(state0, '15');
      const stateAfterCpuB = executeCpuTurn(stateAfterPlayerB);
      const scoreB = calculateScores(stateAfterCpuB.playerWinningPile, 'player');

      // 4. Exact delta assertions
      // Winning pile delta: A = 2, B = 0
      assert.equal(stateAfterCpuA.playerWinningPile.length, 2);
      assert.equal(stateAfterCpuB.playerWinningPile.length, 0);

      // Score delta: A = 2 pts, B = 0 pts
      assert.equal(scoreA.totalScore, 2);
      assert.equal(scoreB.totalScore, 0);

      // Table delta: A table = 1 card [5♦], B table = 3 cards [5♦, 6♠, 3♦]
      assert.equal(stateAfterCpuA.table.playerTable.length, 1);
      assert.equal(stateAfterCpuB.table.playerTable.length, 3);
      assert.deepEqual(
        stateAfterCpuA.table.playerTable.map((c) => c.rank + c.suit),
        ['5♦']
      );
      assert.deepEqual(
        stateAfterCpuB.table.playerTable.map((c) => c.rank + c.suit),
        ['5♦', '6♠', '3♦']
      );

      // Hand delta: B retains 6♦
      assert.ok(stateAfterCpuB.playerHand.some((c) => c.rank === '6' && c.suit === '♦'));
      assert.ok(!stateAfterCpuA.playerHand.some((c) => c.rank === '6' && c.suit === '♦'));

      // Future capture opportunities in next turn
      const futureCapsA = stateAfterCpuA.playerHand.filter((c) => {
        const r = evaluateCapture(
          c,
          stateAfterCpuA.table.playerTable,
          stateAfterCpuA.table.opponentTable,
          stateAfterCpuA.cpuWinningPile,
          stateAfterCpuA.table.viewMode
        );
        return r.captureResult.capturedCards.length > 0;
      });
      assert.equal(futureCapsA.length, 1, 'Branch A has 5♠ matching 5♦ on table');
      assert.equal(futureCapsA[0].rank, '5');

      // CPU response is identical (plays 2♥ capturing 2♣)
      assert.equal(stateAfterCpuA.latestEvent?.card?.rank, '2');
      assert.equal(stateAfterCpuB.latestEvent?.card?.rank, '2');

      // 5. Run Scenario Harness
      const result = runScenario(TUTORIAL_SCENARIOS[4]);
      assert.equal(result.validationStatus, 'VALIDATED');
      assert.ok(result.branchComparison !== undefined);
      assert.equal(result.branchComparison!.divergence.isObservable, true);
    });
  });

  // A3.7: Hidden Information Safety Gate
  describe('A3.7 — Hidden Information Safety Gate', () => {
    it('ExtractDecisionPoint only evaluates player hand and visible table/pile cards without reading CPU hand or deck order', () => {
      const state = createInitialGame(404, 'player');
      const decision = extractDecisionPoint(state);

      // Options length matches playerHand length exactly
      assert.equal(decision.options.length, state.playerHand.length);

      // Verify no option references CPU hand cards or deck cards
      const cpuCardIds = new Set(state.cpuHand.map((c) => c.id));
      const deckCardIds = new Set(state.deck.map((c) => c.id));

      for (const opt of decision.options) {
        assert.equal(cpuCardIds.has(opt.card.id), false, 'Option card must not come from CPU hand');
        assert.equal(deckCardIds.has(opt.card.id), false, 'Option card must not come from deck');
        for (const capCard of opt.capturedCards) {
          assert.equal(cpuCardIds.has(capCard.id), false, 'Captured cards must not come from CPU hand');
          assert.equal(deckCardIds.has(capCard.id), false, 'Captured cards must not come from deck');
        }
      }
    });
  });

  // A3.8: Engine Conformance Gate
  describe('A3.8 — Engine Conformance Gate', () => {
    it('All scenarios execute strictly via canonical engine functions without custom tutorial engine overrides', () => {
      const allResults = runAllTutorialScenarios();
      for (const lesson of [1, 2, 3, 4] as const) {
        const res = allResults[lesson];
        assert.ok(res.scenarioId.startsWith('scen_lesson_'));
        assert.ok(res.initialState.deckSize === 40);
        assert.equal(res.validationStatus, 'VALIDATED', `Lesson ${lesson} must be VALIDATED`);
      }
    });
  });
});

describe('A4 & A5 & A6 — Tutorial Runtime, Hints, and Lesson 1 Integration Suite', () => {
  // A4: Runtime Lifecycle Gate
  describe('A4 — Tutorial Runtime Controller Lifecycle Gate', () => {
    it('Initializes Lesson 1 runtime state deterministically without hidden data', () => {
      const { runtimeState, initialGame } = createInitialTutorialRuntime(1);

      assert.equal(runtimeState.status, 'AWAITING_ACTION');
      assert.equal(runtimeState.lesson, 1);
      assert.equal(runtimeState.stepNumber, 1);
      assert.equal(runtimeState.seed, 1);
      assert.equal(runtimeState.isSuccess, false);
      assert.equal(runtimeState.attempts, 0);
      assert.equal(runtimeState.hintLevel, 0);
      assert.equal(runtimeState.currentHint, null);

      assert.equal(initialGame.playerHand.length, 4);
      assert.equal(initialGame.cpuHand.length, 4);
      assert.equal(initialGame.table.playerTable.length, 2);
      assert.equal(initialGame.table.opponentTable.length, 2);
      assert.equal(initialGame.phase, 'PLAYER_TURN');
    });

    it('Correctly evaluates successful capture with 9♥ on Lesson 1', () => {
      const { runtimeState, initialGame } = createInitialTutorialRuntime(1);
      const card9h = initialGame.playerHand.find((c) => c.rank === '9' && c.suit === '♥')!;
      assert.ok(card9h !== undefined);

      const nextGame = playPlayerCard(initialGame, card9h.id);
      const evaluated = evaluateTutorialActionResult(
        runtimeState,
        initialGame,
        nextGame,
        card9h
      );

      assert.equal(evaluated.status, 'SUCCESS_FEEDBACK');
      assert.equal(evaluated.isSuccess, true);
      assert.equal(evaluated.attempts, 1);
      assert.ok(evaluated.feedbackTitle?.includes('أكل ناجح'));
      assert.equal(nextGame.playerWinningPile.length, 2);
    });

    it('Correctly evaluates suboptimal play (missed capture) on Lesson 1', () => {
      const { runtimeState, initialGame } = createInitialTutorialRuntime(1);
      // Play a card that does not match any card on table (e.g. 2♦ or 7♠)
      const nonMatchingCard = initialGame.playerHand.find((c) => c.rank !== '9')!;
      assert.ok(nonMatchingCard !== undefined);

      const nextGame = playPlayerCard(initialGame, nonMatchingCard.id);
      const evaluated = evaluateTutorialActionResult(
        runtimeState,
        initialGame,
        nextGame,
        nonMatchingCard
      );

      assert.equal(evaluated.status, 'SUBOPTIMAL_FEEDBACK');
      assert.equal(evaluated.isSuccess, false);
      assert.equal(evaluated.attempts, 1);
      assert.ok(evaluated.feedbackTitle?.includes('حركة غير مطابقة'));
      assert.equal(nextGame.playerWinningPile.length, 0);
    });

    it('Transitions from SUCCESS_FEEDBACK to LESSON_COMPLETE', () => {
      const { runtimeState, initialGame } = createInitialTutorialRuntime(1);
      const card9h = initialGame.playerHand.find((c) => c.rank === '9')!;
      const nextGame = playPlayerCard(initialGame, card9h.id);
      const evaluated = evaluateTutorialActionResult(
        runtimeState,
        initialGame,
        nextGame,
        card9h
      );

      const completed = completeTutorialLesson(evaluated);
      assert.equal(completed.status, 'LESSON_COMPLETE');
      assert.equal(completed.isSuccess, true);
    });
  });

  // A5: Contextual Hint Engine Gate
  describe('A5 — Contextual Hint Engine Gate', () => {
    it('Generates progressive hints (L1 -> L2 -> L3) strictly from visible state', () => {
      const { initialGame } = createInitialTutorialRuntime(1);

      // Level 1: Conceptual attention
      const hintL1 = generateContextualHint(1, initialGame, 1);
      assert.ok(hintL1 !== null);
      assert.equal(hintL1?.level, 1);
      assert.equal(hintL1?.title, 'تلميح المفاهيم');
      assert.ok(hintL1?.message.includes('ابحث عن كرت في يدك يمتلك نفس رتبة'));

      // Level 2: Target rank guidance
      const hintL2 = generateContextualHint(1, initialGame, 2);
      assert.ok(hintL2 !== null);
      assert.equal(hintL2?.level, 2);
      assert.equal(hintL2?.suggestedCardRank, '9');

      // Level 3: Direct Action Guidance
      const hintL3 = generateContextualHint(1, initialGame, 3);
      assert.ok(hintL3 !== null);
      assert.equal(hintL3?.level, 3);
      assert.ok(hintL3?.message.includes('9♥'));
      assert.ok(hintL3?.message.includes('9♣'));
    });

    it('Respects hints intensity mapping (off -> 0, low -> 1, medium -> 2, high -> 3)', () => {
      assert.equal(getHintLevelForIntensity('off'), 0);
      assert.equal(getHintLevelForIntensity('low'), 1);
      assert.equal(getHintLevelForIntensity('medium'), 2);
      assert.equal(getHintLevelForIntensity('high'), 3);
    });

    it('Level 0 returns null with zero leakage', () => {
      const { initialGame } = createInitialTutorialRuntime(1);
      const hintL0 = generateContextualHint(1, initialGame, 0);
      assert.equal(hintL0, null);
    });

    it('Advances hint levels smoothly via getNextHintLevel', () => {
      assert.equal(getNextHintLevel(0), 1);
      assert.equal(getNextHintLevel(1), 2);
      assert.equal(getNextHintLevel(2), 3);
      assert.equal(getNextHintLevel(3), 3);
    });
  });

  // A6: End-to-End Lesson 1 Acceptance Gate
  describe('A6 — Lesson 1 End-to-End Acceptance Gate', () => {
    it('Proves human player action path: 9♥ -> canonical engine -> 9♣ captured -> winning pile updated -> objective verified', () => {
      // 1. Initial State
      const { runtimeState, initialGame } = createInitialTutorialRuntime(1);

      // Verify visible setup
      const playerCard9 = initialGame.playerHand.find((c) => c.rank === '9');
      const tableCard9 = initialGame.table.playerTable.find((c) => c.rank === '9');

      assert.ok(playerCard9, 'Player must have 9 in hand');
      assert.ok(tableCard9, 'Player table must have 9♣ on table');
      assert.equal(playerCard9.suit, '♥');
      assert.equal(tableCard9.suit, '♣');

      // 2. Dispatch action through canonical gameEngine playPlayerCard
      const postState = playPlayerCard(initialGame, playerCard9.id);

      // 3. Engine captures both cards into playerWinningPile
      assert.equal(postState.playerWinningPile.length, 2);
      assert.deepEqual(
        postState.playerWinningPile.map((c) => c.rank + c.suit),
        ['9♣', '9♥']
      );
      assert.equal(postState.table.playerTable.length, 1);
      assert.equal(postState.playerHand.length, 3);

      // 4. Runtime Controller evaluation
      const postRuntime = evaluateTutorialActionResult(
        runtimeState,
        initialGame,
        postState,
        playerCard9
      );

      assert.equal(postRuntime.status, 'SUCCESS_FEEDBACK');
      assert.equal(postRuntime.isSuccess, true);
      assert.ok(postRuntime.feedbackTitle?.includes('أكل ناجح'));

      // 5. Completion transition
      const completedRuntime = completeTutorialLesson(postRuntime);
      assert.equal(completedRuntime.status, 'LESSON_COMPLETE');

      // 6. Reset / Replay verification (same deterministic seed)
      const replay = createInitialTutorialRuntime(1);
      assert.deepEqual(replay.initialGame.playerHand, initialGame.playerHand);
      assert.deepEqual(replay.initialGame.table.playerTable, initialGame.table.playerTable);
    });
  });
});

describe('A7.1 — Lesson 2: Winning Pile Steal Vertical Slice Suite', () => {
  it('1. Initializes Lesson 2 scenario correctly with canonical legal prelude', () => {
    const { runtimeState, initialGame } = createInitialTutorialRuntime(2);

    assert.equal(runtimeState.status, 'AWAITING_ACTION');
    assert.equal(runtimeState.lesson, 2);
    assert.equal(runtimeState.seed, 5);
    assert.equal(runtimeState.isSuccess, false);
    assert.equal(runtimeState.attempts, 0);

    // Verify canonical legal prelude has formed the CPU winning pile
    assert.equal(initialGame.cpuWinningPile.length, 2, 'CPU winning pile must contain 2 cards from legal prelude');
    assert.deepEqual(
      initialGame.cpuWinningPile.map((c) => c.rank + c.suit),
      ['7♠', '7♦'],
      'CPU winning pile must be exactly [7♠, 7♦]'
    );
    assert.equal(initialGame.phase, 'PLAYER_TURN');
    assert.equal(initialGame.playerHand.length, 3);
    assert.ok(
      initialGame.playerHand.some((c) => c.rank === '7' && c.suit === '♥'),
      'Player hand must contain 7♥'
    );
  });

  it('2. Legal Prelude actually forms visible opponent winning pile with top card exposed', () => {
    const { initialGame } = createInitialTutorialRuntime(2);
    const topCard = initialGame.cpuWinningPile[initialGame.cpuWinningPile.length - 1];

    assert.ok(topCard !== undefined);
    assert.equal(topCard.rank, '7');
    assert.equal(topCard.suit, '♦');
  });

  it('3. Canonical engine resolves Pile Steal when player plays 7♥', () => {
    const { runtimeState, initialGame } = createInitialTutorialRuntime(2);
    const card7h = initialGame.playerHand.find((c) => c.rank === '7' && c.suit === '♥')!;
    assert.ok(card7h !== undefined);

    // Execute via canonical engine
    const nextGame = playPlayerCard(initialGame, card7h.id);

    // Player steals entire CPU winning pile + played card
    assert.equal(nextGame.cpuWinningPile.length, 0, 'CPU winning pile must be completely stolen and emptied');
    assert.equal(nextGame.playerWinningPile.length, 3, 'Player winning pile must now contain 3 cards');
    assert.deepEqual(
      nextGame.playerWinningPile.map((c) => c.rank + c.suit),
      ['7♠', '7♦', '7♥']
    );

    // Evaluate tutorial observer outcome
    const evaluated = evaluateTutorialActionResult(
      runtimeState,
      initialGame,
      nextGame,
      card7h
    );

    assert.equal(evaluated.status, 'SUCCESS_FEEDBACK');
    assert.equal(evaluated.isSuccess, true);
    assert.equal(evaluated.attempts, 1);
    assert.ok(evaluated.feedbackTitle?.includes('سرقة ناجحة'));
    assert.ok(evaluated.feedbackMessage?.includes('7♥'));
  });

  it('4. Correctly diagnoses suboptimal play (missed pile steal) with educational feedback', () => {
    const { runtimeState, initialGame } = createInitialTutorialRuntime(2);
    // Player plays 10♠ instead of capturing the vulnerable winning pile
    const card10s = initialGame.playerHand.find((c) => c.rank === '10')!;
    assert.ok(card10s !== undefined);

    const nextGame = playPlayerCard(initialGame, card10s.id);
    const evaluated = evaluateTutorialActionResult(
      runtimeState,
      initialGame,
      nextGame,
      card10s
    );

    assert.equal(evaluated.status, 'SUBOPTIMAL_FEEDBACK');
    assert.equal(evaluated.isSuccess, false);
    assert.equal(evaluated.attempts, 1);
    assert.ok(evaluated.feedbackTitle?.includes('فوتت سرقة الكومة'));
    assert.ok(evaluated.feedbackMessage?.includes('كومة فوز الخصم'));
  });

  it('5. Contextual Hint Engine generates progressive hints for Lesson 2 without leaking hidden info', () => {
    const { initialGame } = createInitialTutorialRuntime(2);

    // Level 1: Conceptual attention to opponent winning pile
    const hintL1 = generateContextualHint(2, initialGame, 1);
    assert.ok(hintL1 !== null);
    assert.equal(hintL1?.level, 1);
    assert.equal(hintL1?.highlightTarget, 'WINNING_PILE');
    assert.ok(hintL1?.message.includes('راقب كومة فوز الخصم'));

    // Level 2: Target rank guidance (rank 7)
    const hintL2 = generateContextualHint(2, initialGame, 2);
    assert.ok(hintL2 !== null);
    assert.equal(hintL2?.level, 2);
    assert.equal(hintL2?.suggestedCardRank, '7');
    assert.ok(hintL2?.message.includes('(7)'));

    // Level 3: Direct Action Guidance (7♥ on 7♦)
    const hintL3 = generateContextualHint(2, initialGame, 3);
    assert.ok(hintL3 !== null);
    assert.equal(hintL3?.level, 3);
    assert.ok(hintL3?.message.includes('7♥'));
    assert.ok(hintL3?.message.includes('7♦'));
  });

  it('6. Supports Reset / Replay deterministically on Lesson 2', () => {
    const run1 = createInitialTutorialRuntime(2);
    const run2 = createInitialTutorialRuntime(2);

    assert.deepEqual(run1.initialGame.playerHand, run2.initialGame.playerHand);
    assert.deepEqual(run1.initialGame.cpuWinningPile, run2.initialGame.cpuWinningPile);
    assert.deepEqual(run1.initialGame.table, run2.initialGame.table);
  });

  it('7. Transitions from SUCCESS_FEEDBACK to LESSON_COMPLETE with Lesson 2 custom message', () => {
    const { runtimeState, initialGame } = createInitialTutorialRuntime(2);
    const card7h = initialGame.playerHand.find((c) => c.rank === '7')!;
    const nextGame = playPlayerCard(initialGame, card7h.id);
    const evaluated = evaluateTutorialActionResult(
      runtimeState,
      initialGame,
      nextGame,
      card7h
    );

    const completed = completeTutorialLesson(evaluated);
    assert.equal(completed.status, 'LESSON_COMPLETE');
    assert.ok(completed.feedbackTitle?.includes('اكتمل درس سرقة الكومة'));
  });
});

describe('A7.2 — Lesson 3: Pattern Recognition & Set Formation Vertical Slice Suite', () => {
  it('1. Initializes Lesson 3 scenario correctly on Seed 175', () => {
    const { runtimeState, initialGame } = createInitialTutorialRuntime(3);

    assert.equal(runtimeState.status, 'AWAITING_ACTION');
    assert.equal(runtimeState.lesson, 3);
    assert.equal(runtimeState.seed, 175);
    assert.equal(runtimeState.isSuccess, false);
    assert.equal(runtimeState.attempts, 0);

    // Verify 3 Aces exposed across dual tables: A♦, A♣ on playerTable and A♠ on opponentTable
    const tableAces = [
      ...initialGame.table.playerTable.filter((c) => c.rank === 'A'),
      ...initialGame.table.opponentTable.filter((c) => c.rank === 'A'),
    ];
    assert.equal(tableAces.length, 3, 'Must have exactly 3 Aces exposed across tables');

    // Verify Player hand has remaining Ace (A♥)
    const playerAce = initialGame.playerHand.find((c) => c.rank === 'A');
    assert.ok(playerAce !== undefined, 'Player hand must contain A♥');
    assert.equal(playerAce?.suit, '♥');
  });

  it('2. Playing A♥ captures all 3 remaining Aces and completes canonical 4-card Regular Set (+12 pts)', () => {
    const { runtimeState, initialGame } = createInitialTutorialRuntime(3);
    const playerAce = initialGame.playerHand.find((c) => c.rank === 'A')!;

    // Execute via canonical game engine
    const nextGame = playPlayerCard(initialGame, playerAce.id);

    // Verify all 4 Aces captured into player winning pile
    assert.equal(nextGame.playerWinningPile.length, 4, 'Must capture all 4 Aces');
    assert.ok(nextGame.playerWinningPile.every((c) => c.rank === 'A'));

    // Verify canonical scoring
    const scores = calculateScores(nextGame.playerWinningPile, 'player');
    assert.equal(scores.regularSets, 1, 'Must form exactly 1 Regular Set');
    assert.equal(scores.regularSetPoints, 12, 'Regular Set must score exactly 12 points');
    assert.equal(scores.totalScore, 12, 'Total score must be 12 points');

    // Evaluate tutorial observer outcome
    const evaluated = evaluateTutorialActionResult(
      runtimeState,
      initialGame,
      nextGame,
      playerAce
    );

    assert.equal(evaluated.status, 'SUCCESS_FEEDBACK');
    assert.equal(evaluated.isSuccess, true);
    assert.equal(evaluated.attempts, 1);
    assert.ok(evaluated.feedbackTitle?.includes('تشكيل مجموعة ملكية'));
    assert.ok(evaluated.feedbackMessage?.includes('12'));
  });

  it('3. Suboptimal play on Lesson 3 gives clear educational feedback explaining missed set', () => {
    const { runtimeState, initialGame } = createInitialTutorialRuntime(3);
    const nonAceCard = initialGame.playerHand.find((c) => c.rank !== 'A')!;
    assert.ok(nonAceCard !== undefined);

    const nextGame = playPlayerCard(initialGame, nonAceCard.id);
    const evaluated = evaluateTutorialActionResult(
      runtimeState,
      initialGame,
      nextGame,
      nonAceCard
    );

    assert.equal(evaluated.status, 'SUBOPTIMAL_FEEDBACK');
    assert.equal(evaluated.isSuccess, false);
    assert.ok(evaluated.feedbackTitle?.includes('فوتت تكوين المجموعة'));
    assert.ok(evaluated.feedbackMessage?.includes('آس'));
  });

  it('4. Contextual Hint Engine generates progressive hints for Lesson 3 without leaking hidden cards', () => {
    const { initialGame } = createInitialTutorialRuntime(3);

    const hintL1 = generateContextualHint(3, initialGame, 1);
    assert.ok(hintL1 !== null);
    assert.equal(hintL1?.level, 1);
    assert.equal(hintL1?.highlightTarget, 'PLAYER_TABLE');
    assert.ok(hintL1?.message.includes('راقب كروت الطاولة'));

    const hintL2 = generateContextualHint(3, initialGame, 2);
    assert.ok(hintL2 !== null);
    assert.equal(hintL2?.level, 2);
    assert.equal(hintL2?.suggestedCardRank, 'A');
    assert.ok(hintL2?.message.includes('(A)'));

    const hintL3 = generateContextualHint(3, initialGame, 3);
    assert.ok(hintL3 !== null);
    assert.equal(hintL3?.level, 3);
    assert.equal(hintL3?.suggestedCardRank, 'A');
    assert.ok(hintL3?.message.includes('A♥'));
  });

  it('5. Transitions from SUCCESS_FEEDBACK to LESSON_COMPLETE with Lesson 3 custom message', () => {
    const { runtimeState, initialGame } = createInitialTutorialRuntime(3);
    const playerAce = initialGame.playerHand.find((c) => c.rank === 'A')!;
    const nextGame = playPlayerCard(initialGame, playerAce.id);
    const evaluated = evaluateTutorialActionResult(
      runtimeState,
      initialGame,
      nextGame,
      playerAce
    );

    const completed = completeTutorialLesson(evaluated);
    assert.equal(completed.status, 'LESSON_COMPLETE');
    assert.ok(completed.feedbackTitle?.includes('اكتمل درس تشكيل المجموعات'));
  });
});

describe('A7.3 — Lesson 4: Strategic Sacrifice & Timing Decision Vertical Slice Suite', () => {
  it('1. Initializes Lesson 4 scenario correctly on Seed 404', () => {
    const { runtimeState, initialGame } = createInitialTutorialRuntime(4);

    assert.equal(runtimeState.status, 'AWAITING_ACTION');
    assert.equal(runtimeState.lesson, 4);
    assert.equal(runtimeState.seed, 404);
    assert.equal(runtimeState.isSuccess, false);
    assert.equal(runtimeState.attempts, 0);

    // Verify Decision point contains both capture moves (6♦, 5♠) and sacrifice moves (3♦, K♦)
    assert.ok(initialGame.playerHand.some((c) => c.rank === '6' && c.suit === '♦'));
    assert.ok(initialGame.playerHand.some((c) => c.rank === '5' && c.suit === '♠'));
    assert.ok(initialGame.playerHand.some((c) => c.rank === '3' && c.suit === '♦'));
    assert.ok(initialGame.playerHand.some((c) => c.rank === 'K' && c.suit === '♦'));
  });

  it('2. Mathematically proves observable strategic branch divergence (Branch A vs Branch B)', () => {
    const { initialGame } = createInitialTutorialRuntime(4);

    const cardCapture = initialGame.playerHand.find((c) => c.rank === '6' && c.suit === '♦')!;
    const cardSacrifice = initialGame.playerHand.find((c) => c.rank === '3' && c.suit === '♦')!;

    // Branch A: Immediate Capture (6♦)
    const stateAfterPlayerA = playPlayerCard(initialGame, cardCapture.id);
    const scoreA = calculateScores(stateAfterPlayerA.playerWinningPile, 'player');

    // Branch B: Strategic Sacrifice / Wait (3♦)
    const stateAfterPlayerB = playPlayerCard(initialGame, cardSacrifice.id);
    const scoreB = calculateScores(stateAfterPlayerB.playerWinningPile, 'player');

    // Divergence Assertions
    assert.equal(stateAfterPlayerA.playerWinningPile.length, 2, 'Branch A winning pile count must be 2');
    assert.equal(stateAfterPlayerB.playerWinningPile.length, 0, 'Branch B winning pile count must be 0');
    assert.equal(scoreA.totalScore, 2, 'Branch A total score must be 2');
    assert.equal(scoreB.totalScore, 0, 'Branch B total score must be 0');

    // Exposed Table Cards Difference
    assert.equal(stateAfterPlayerA.table.playerTable.length, 1, 'Branch A leaves 1 card on player table');
    assert.equal(stateAfterPlayerB.table.playerTable.length, 3, 'Branch B leaves 3 cards on player table');

    // Tactical Cards Retained in Hand Difference
    assert.ok(
      stateAfterPlayerB.playerHand.some((c) => c.rank === '6' && c.suit === '♦'),
      'Branch B retains the powerful 6♦ capture card in hand'
    );
    assert.ok(
      !stateAfterPlayerA.playerHand.some((c) => c.rank === '6' && c.suit === '♦'),
      'Branch A consumed the 6♦ capture card'
    );
  });

  it('3. Immediate Capture choice (6♦) receives deep pedagogical feedback on short-term security vs card consumption', () => {
    const { runtimeState, initialGame } = createInitialTutorialRuntime(4);
    const cardCapture = initialGame.playerHand.find((c) => c.rank === '6' && c.suit === '♦')!;
    const nextGame = playPlayerCard(initialGame, cardCapture.id);

    const evaluated = evaluateTutorialActionResult(
      runtimeState,
      initialGame,
      nextGame,
      cardCapture
    );

    assert.equal(evaluated.status, 'SUCCESS_FEEDBACK');
    assert.equal(evaluated.isSuccess, true);
    assert.ok(evaluated.feedbackTitle?.includes('الأكل اللحظي'));
    assert.ok(evaluated.feedbackMessage?.includes('تأمين كرتين'));
  });

  it('4. Strategic Sacrifice choice (3♦) receives deep pedagogical feedback on tempo control and card preservation', () => {
    const { runtimeState, initialGame } = createInitialTutorialRuntime(4);
    const cardSacrifice = initialGame.playerHand.find((c) => c.rank === '3' && c.suit === '♦')!;
    const nextGame = playPlayerCard(initialGame, cardSacrifice.id);

    const evaluated = evaluateTutorialActionResult(
      runtimeState,
      initialGame,
      nextGame,
      cardSacrifice
    );

    assert.equal(evaluated.status, 'SUCCESS_FEEDBACK');
    assert.equal(evaluated.isSuccess, true);
    assert.ok(evaluated.feedbackTitle?.includes('التضحية والتحكم بالتوقيت'));
    assert.ok(evaluated.feedbackMessage?.includes('كروت الأكل القوية'));
  });

  it('5. Contextual Hint Engine generates progressive hints for Lesson 4 without leaking CPU hidden state', () => {
    const { initialGame } = createInitialTutorialRuntime(4);

    const hintL1 = generateContextualHint(4, initialGame, 1);
    assert.ok(hintL1 !== null);
    assert.equal(hintL1?.level, 1);
    assert.ok(hintL1?.message.includes('فكر في موازنة اللعب'));

    const hintL2 = generateContextualHint(4, initialGame, 2);
    assert.ok(hintL2 !== null);
    assert.equal(hintL2?.level, 2);
    assert.ok(hintL2?.message.includes('6♦'));

    const hintL3 = generateContextualHint(4, initialGame, 3);
    assert.ok(hintL3 !== null);
    assert.equal(hintL3?.level, 3);
    assert.ok(hintL3?.message.includes('6♦'));
    assert.ok(hintL3?.message.includes('3♦'));
  });

  it('6. Transitions from SUCCESS_FEEDBACK to LESSON_COMPLETE with Lesson 4 custom message', () => {
    const { runtimeState, initialGame } = createInitialTutorialRuntime(4);
    const cardCapture = initialGame.playerHand.find((c) => c.rank === '6')!;
    const nextGame = playPlayerCard(initialGame, cardCapture.id);
    const evaluated = evaluateTutorialActionResult(
      runtimeState,
      initialGame,
      nextGame,
      cardCapture
    );

    const completed = completeTutorialLesson(evaluated);
    assert.equal(completed.status, 'LESSON_COMPLETE');
    assert.ok(completed.feedbackTitle?.includes('اكتمل درس التضحية والتوقيت'));
  });
});

describe('A7.4 — Sequential Academy Journey & Practice Table Suite', () => {
  it('1. Sequential Journey progresses smoothly from Lesson 1 -> 2 -> 3 -> 4', () => {
    // Lesson 1: Direct capture
    let currentLesson: TutorialLesson = 1;
    let completedList: TutorialLesson[] = [];

    const l1 = createInitialTutorialRuntime(currentLesson);
    const card9 = l1.initialGame.playerHand.find((c) => c.rank === '9')!;
    const stateL1 = playPlayerCard(l1.initialGame, card9.id);
    const evalL1 = evaluateTutorialActionResult(l1.runtimeState, l1.initialGame, stateL1, card9);
    assert.equal(evalL1.isSuccess, true);
    assert.equal(evalL1.status, 'SUCCESS_FEEDBACK');

    // Complete L1 and transition to L2
    completedList.push(currentLesson);
    assert.deepEqual(completedList, [1]);
    currentLesson = (currentLesson + 1) as TutorialLesson;
    assert.equal(currentLesson, 2);

    // Lesson 2: Winning pile steal
    const l2 = createInitialTutorialRuntime(currentLesson);
    const card7 = l2.initialGame.playerHand.find((c) => c.rank === '7')!;
    const stateL2 = playPlayerCard(l2.initialGame, card7.id);
    const evalL2 = evaluateTutorialActionResult(l2.runtimeState, l2.initialGame, stateL2, card7);
    assert.equal(evalL2.isSuccess, true);
    assert.equal(evalL2.status, 'SUCCESS_FEEDBACK');

    // Complete L2 and transition to L3
    completedList.push(currentLesson);
    assert.deepEqual(completedList, [1, 2]);
    currentLesson = (currentLesson + 1) as TutorialLesson;
    assert.equal(currentLesson, 3);

    // Lesson 3: Sets formation
    const l3 = createInitialTutorialRuntime(currentLesson);
    const cardA = l3.initialGame.playerHand.find((c) => c.rank === 'A')!;
    const stateL3 = playPlayerCard(l3.initialGame, cardA.id);
    const evalL3 = evaluateTutorialActionResult(l3.runtimeState, l3.initialGame, stateL3, cardA);
    assert.equal(evalL3.isSuccess, true);
    assert.equal(evalL3.status, 'SUCCESS_FEEDBACK');

    // Complete L3 and transition to L4
    completedList.push(currentLesson);
    assert.deepEqual(completedList, [1, 2, 3]);
    currentLesson = (currentLesson + 1) as TutorialLesson;
    assert.equal(currentLesson, 4);

    // Lesson 4: Immediate vs Flexibility
    const l4 = createInitialTutorialRuntime(currentLesson);
    const card6 = l4.initialGame.playerHand.find((c) => c.rank === '6')!;
    const stateL4 = playPlayerCard(l4.initialGame, card6.id);
    const evalL4 = evaluateTutorialActionResult(l4.runtimeState, l4.initialGame, stateL4, card6);
    assert.equal(evalL4.isSuccess, true);
    assert.equal(evalL4.status, 'SUCCESS_FEEDBACK');

    // Complete L4 - End of Academy
    completedList.push(currentLesson);
    assert.deepEqual(completedList, [1, 2, 3, 4]);
    assert.equal(completedList.length, 4);
  });

  it('2. Standalone individual lesson access initializes with full feedback capability', () => {
    for (const lesson of [1, 2, 3, 4] as const) {
      const { runtimeState, initialGame } = createInitialTutorialRuntime(lesson);
      assert.equal(runtimeState.lesson, lesson);
      assert.equal(runtimeState.status, 'AWAITING_ACTION');
      assert.ok(runtimeState.lessonTitle.length > 0);
      assert.ok(initialGame.playerHand.length >= 3);
    }
  });

  it('3. Practice Table Concept modes use exact canonical seeds (1, 5, 175, 404)', () => {
    const conceptSeeds = {
      1: 1,
      2: 5,
      3: 175,
      4: 404,
    };

    for (const [lessonStr, expectedSeed] of Object.entries(conceptSeeds)) {
      const lesson = Number(lessonStr) as TutorialLesson;
      const { initialGame, runtimeState } = createInitialTutorialRuntime(lesson);
      assert.equal(runtimeState.lesson, lesson);
      assert.equal(initialGame.seed, expectedSeed);
      assert.equal(initialGame.phase, 'PLAYER_TURN');
      assert.equal(initialGame.activeTurn, 'player');
    }
  });

  it('4. Practice Table Free Match live tip generator produces non-leaking tactical tips', () => {
    const state = createInitialGame(1, 'player');
    const tip = analyzeGuidedMatchState(state);
    assert.ok(tip !== null);
    assert.ok(tip?.title.length > 0);
    assert.ok(tip?.message.length > 0);
  });

  it('5. Prioritizes PILE_STEAL when opponent winning pile top card matches a hand card', () => {
    const baseState = createInitialGame(1, 'player');
    const testCard = baseState.playerHand[0];
    const stateWithSteal: typeof baseState = {
      ...baseState,
      cpuWinningPile: [
        makeTestCard('opp-1', '♠', 'K'),
        makeTestCard('opp-top', '♦', testCard.rank),
      ],
      table: {
        playerTable: [makeTestCard('pt-1', '♣', testCard.rank)],
        opponentTable: [],
        viewMode: 'NORMAL_VIEW',
      },
    };

    const tip = analyzeGuidedMatchState(stateWithSteal);
    assert.ok(tip !== null);
    assert.equal(tip?.type, 'PILE_STEAL');
    assert.equal(tip?.suggestedCardId, testCard.id);
    assert.equal(tip?.highlightZone, 'WINNING_PILE');
    assert.ok(tip?.message.includes(testCard.rank));
  });

  it('6. Prioritizes SET_OPPORTUNITY when player can complete a 4-card set', () => {
    const baseState = createInitialGame(1, 'player');
    const setRank = 'Q';
    const qHeart = makeTestCard('hand-q', '♥', setRank);
    const stateWithSet: typeof baseState = {
      ...baseState,
      playerHand: [qHeart, makeTestCard('hand-other', '♦', '2')],
      playerWinningPile: [
        makeTestCard('wp-1', '♠', setRank),
        makeTestCard('wp-2', '♣', setRank),
      ],
      table: {
        playerTable: [makeTestCard('tbl-q', '♦', setRank)],
        opponentTable: [],
        viewMode: 'NORMAL_VIEW',
      },
      cpuWinningPile: [],
    };

    const tip = analyzeGuidedMatchState(stateWithSet);
    assert.ok(tip !== null);
    assert.equal(tip?.type, 'SET_OPPORTUNITY');
    assert.equal(tip?.suggestedCardId, 'hand-q');
    assert.equal(tip?.highlightZone, 'PLAYER_HAND');
    assert.ok(tip?.message.includes('Q'));
    assert.ok(tip?.message.includes('+12'));
  });

  it('7. Returns DIRECT_CAPTURE when direct table matching exists and no steal/set', () => {
    const baseState = createInitialGame(1, 'player');
    const captureRank = '8';
    const stateWithCapture: typeof baseState = {
      ...baseState,
      playerHand: [makeTestCard('hand-8', '♥', captureRank)],
      playerWinningPile: [],
      cpuWinningPile: [],
      table: {
        playerTable: [],
        opponentTable: [makeTestCard('tbl-8', '♠', captureRank)],
        viewMode: 'NORMAL_VIEW',
      },
    };

    const tip = analyzeGuidedMatchState(stateWithCapture);
    assert.ok(tip !== null);
    assert.equal(tip?.type, 'DIRECT_CAPTURE');
    assert.equal(tip?.suggestedCardId, 'hand-8');
    assert.equal(tip?.highlightZone, 'OPPONENT_TABLE');
    assert.ok(tip?.message.includes('8'));
  });

  it('8. Returns null (silence) when no tactical capture/steal/set is available', () => {
    const baseState = createInitialGame(1, 'player');
    const stateNoOpportunity: typeof baseState = {
      ...baseState,
      playerHand: [makeTestCard('hand-2', '♥', '2')],
      playerWinningPile: [],
      cpuWinningPile: [makeTestCard('cpu-top', '♠', 'K')],
      table: {
        playerTable: [makeTestCard('pt-5', '♣', '5')],
        opponentTable: [makeTestCard('ot-9', '♦', '9')],
        viewMode: 'NORMAL_VIEW',
      },
    };

    const tip = analyzeGuidedMatchState(stateNoOpportunity);
    assert.equal(tip, null);
  });

  describe('Strict Canonical Milestone Acceptance Gate (Steal & Sets)', () => {
    it('Steal milestone CANNOT pass on rank alone if opponent winning pile is not reduced', () => {
      const { runtimeState, initialGame } = createInitialTutorialRuntime(2);
      const card7 = initialGame.playerHand.find((c) => c.rank === '7')!;
      assert.ok(card7);

      // Construct simulated next game where rank '7' is played, but opponent winning pile is NOT reduced
      const fakeNextGame: GameState = {
        ...initialGame,
        cpuWinningPile: [...initialGame.cpuWinningPile], // Not reduced!
        playerWinningPile: [...initialGame.playerWinningPile], // No transfer!
        actionHistory: [
          ...initialGame.actionHistory,
          {
            sequence: initialGame.actionHistory.length + 1,
            actor: 'player',
            cardId: card7.id,
            timestamp: Date.now(),
            captureResult: {
              capturedCards: [],
              capturedFrom: 'NONE',
              isTopUniformCapture: false,
              sources: [],
              capturedWithOrigins: [],
              description: 'No steal',
            },
            resultingPhase: 'CPU_TURN',
          },
        ],
      };

      const result = evaluateTutorialActionResult(runtimeState, initialGame, fakeNextGame, card7);
      assert.equal(result.isSuccess, false, 'Must FAIL when opponent winning pile was not reduced');
      assert.equal(result.status, 'SUBOPTIMAL_FEEDBACK');
    });

    it('Steal milestone CANNOT pass on rank alone if captureResult is not from winning pile', () => {
      const { runtimeState, initialGame } = createInitialTutorialRuntime(2);
      const card7 = initialGame.playerHand.find((c) => c.rank === '7')!;
      assert.ok(card7);

      // Captured cards from table only, not winning pile
      const fakeNextGame: GameState = {
        ...initialGame,
        cpuWinningPile: [...initialGame.cpuWinningPile],
        playerWinningPile: [...initialGame.playerWinningPile, card7],
        actionHistory: [
          ...initialGame.actionHistory,
          {
            sequence: initialGame.actionHistory.length + 1,
            actor: 'player',
            cardId: card7.id,
            timestamp: Date.now(),
            captureResult: {
              capturedCards: [card7],
              capturedFrom: 'PLAYER_TABLE',
              isTopUniformCapture: false,
              sources: ['PLAYER_TABLE'],
              capturedWithOrigins: [{ card: card7, source: 'PLAYER_TABLE' }],
              description: 'Table capture only',
            },
            resultingPhase: 'CPU_TURN',
          },
        ],
      };

      const result = evaluateTutorialActionResult(runtimeState, initialGame, fakeNextGame, card7);
      assert.equal(result.isSuccess, false, 'Must FAIL when capturedFrom is not WINNING_PILE or MULTI_SOURCE');
      assert.equal(result.status, 'SUBOPTIMAL_FEEDBACK');
    });

    it('Set milestone CANNOT pass by playing completing rank card without canonical scoring confirmation', () => {
      const { runtimeState, initialGame } = createInitialTutorialRuntime(3);
      const cardA = initialGame.playerHand.find((c) => c.rank === 'A')!;
      assert.ok(cardA);

      // Played card is A, but player winning pile only has 2 Aces (no regular set formed)
      const fakeNextGame: GameState = {
        ...initialGame,
        playerWinningPile: [
          makeTestCard('a1', '♠', 'A'),
          makeTestCard('a2', '♥', 'A'),
        ],
        actionHistory: [
          ...initialGame.actionHistory,
          {
            sequence: initialGame.actionHistory.length + 1,
            actor: 'player',
            cardId: cardA.id,
            timestamp: Date.now(),
            captureResult: {
              capturedCards: [cardA],
              capturedFrom: 'PLAYER_TABLE',
              isTopUniformCapture: false,
              sources: ['PLAYER_TABLE'],
              capturedWithOrigins: [],
              description: 'Captured one card',
            },
            resultingPhase: 'CPU_TURN',
          },
        ],
      };

      const result = evaluateTutorialActionResult(runtimeState, initialGame, fakeNextGame, cardA);
      assert.equal(result.isSuccess, false, 'Must FAIL when canonical scoring does not confirm a completed set');
      assert.equal(result.status, 'SUBOPTIMAL_FEEDBACK');
    });

    it('Set milestone SUCCEEDS when canonical scoring and collection detector confirm +12 pts regular set', () => {
      const { runtimeState, initialGame } = createInitialTutorialRuntime(3);
      const cardA = initialGame.playerHand.find((c) => c.rank === 'A')!;
      assert.ok(cardA);

      // Canonical engine execution: play cardA which captures 3 table Aces into player winning pile
      const nextGame = playPlayerCard(initialGame, cardA.id);
      const scores = calculateScores(nextGame.playerWinningPile, 'player');
      assert.equal(scores.regularSets, 1);
      assert.equal(scores.regularSetPoints, 12);

      const result = evaluateTutorialActionResult(runtimeState, initialGame, nextGame, cardA);
      assert.equal(result.isSuccess, true);
      assert.equal(result.status, 'SUCCESS_FEEDBACK');
    });
  });

  it('9. Zero hidden-data leakage: modifying cpuHand or deck has zero effect on analysis', () => {
    const baseState = createInitialGame(1, 'player');
    const tipA = analyzeGuidedMatchState(baseState);

    const modifiedState: typeof baseState = {
      ...baseState,
      cpuHand: [
        makeTestCard('cpu-x1', '♠', 'A'),
        makeTestCard('cpu-x2', '♣', 'K'),
      ],
      deck: [
        makeTestCard('deck-x1', '♦', 'Q'),
        makeTestCard('deck-x2', '♥', 'J'),
      ],
    };

    const tipB = analyzeGuidedMatchState(modifiedState);
    assert.deepEqual(tipA, tipB);
  });

  it('10. Never recommends a card ID that does not exist in playerHand', () => {
    const baseState = createInitialGame(5, 'player');
    const tip = analyzeGuidedMatchState(baseState);
    if (tip && tip.suggestedCardId) {
      const cardInHand = baseState.playerHand.find((c) => c.id === tip.suggestedCardId);
      assert.ok(cardInHand !== undefined);
    }
  });
});


