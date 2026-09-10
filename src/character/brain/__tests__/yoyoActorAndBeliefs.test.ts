import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { YoyoBrain } from '../yoyoBrain';
import { YoyoStrategicModel } from '../yoyoStrategicModel';
import { YoyoPlayerModel } from '../yoyoPlayerModel';
import { YoyoDeckKnowledge } from '../yoyoDeckKnowledge';
import { YoyoAdaptationModel } from '../yoyoAdaptationModel';
import { Card, GameState } from '../../../types/game';

function createMockGameState(): GameState {
  return {
    matchId: 'test_match',
    firstPlayer: 'player',
    seed: 12345,
    dealNumber: 1,
    phase: 'PLAYER_TURN',
    activeTurn: 'player',
    deck: [],
    revealedLastCard: { id: 'c_bottom', suit: '♥', rank: 'K', numericValue: 13, isJack: false },
    playerHand: [
      { id: 'p_9h', suit: '♥', rank: '9', numericValue: 9, isJack: false },
      { id: 'p_7s', suit: '♠', rank: '7', numericValue: 7, isJack: false },
    ],
    cpuHand: [
      { id: 'c_9d', suit: '♦', rank: '9', numericValue: 9, isJack: false },
      { id: 'c_6c', suit: '♣', rank: '6', numericValue: 6, isJack: false },
    ],
    table: {
      playerTable: [
        { id: 'pt_9c', suit: '♣', rank: '9', numericValue: 9, isJack: false },
      ],
      opponentTable: [
        { id: 'ct_6s', suit: '♠', rank: '6', numericValue: 6, isJack: false },
      ],
      viewMode: 'NORMAL_VIEW',
    },
    playerWinningPile: [
      { id: 'pw_5h', suit: '♥', rank: '5', numericValue: 5, isJack: false },
    ],
    cpuWinningPile: [
      { id: 'cw_7h', suit: '♥', rank: '7', numericValue: 7, isJack: false },
    ],
    roundNumber: 1,
    latestEvent: null,
    playerScore: null,
    cpuScore: null,
    winner: null,
    eventLog: [],
    actionHistory: [],
  };
}

/**
 * Rich, non-trivial GameState with 4 CPU cards, multiple table cards across both sides,
 * providing distinct, competing legal tactical capture paths.
 */
function createRichMockGameState(): GameState {
  return {
    matchId: 'test_rich_match',
    firstPlayer: 'player',
    seed: 54321,
    dealNumber: 1,
    phase: 'CPU_TURN',
    activeTurn: 'cpu',
    deck: [],
    revealedLastCard: { id: 'c_bottom', suit: '♥', rank: 'A', numericValue: 1, isJack: false },
    playerHand: [
      { id: 'p_8h', suit: '♥', rank: '8', numericValue: 8, isJack: false },
      { id: 'p_2s', suit: '♠', rank: '2', numericValue: 2, isJack: false },
    ],
    cpuHand: [
      { id: 'c_9d', suit: '♦', rank: '9', numericValue: 9, isJack: false },
      { id: 'c_6c', suit: '♣', rank: '6', numericValue: 6, isJack: false },
      { id: 'c_4s', suit: '♠', rank: '4', numericValue: 4, isJack: false },
      { id: 'c_Kh', suit: '♥', rank: 'K', numericValue: 13, isJack: false },
    ],
    table: {
      playerTable: [
        { id: 'pt_9c', suit: '♣', rank: '9', numericValue: 9, isJack: false },
        { id: 'pt_6s', suit: '♠', rank: '6', numericValue: 6, isJack: false },
      ],
      opponentTable: [
        { id: 'ct_4d', suit: '♦', rank: '4', numericValue: 4, isJack: false },
        { id: 'ct_3h', suit: '♥', rank: '3', numericValue: 3, isJack: false },
      ],
      viewMode: 'INITIAL_VIEW',
    },
    playerWinningPile: [
      { id: 'pw_5h', suit: '♥', rank: '5', numericValue: 5, isJack: false },
    ],
    cpuWinningPile: [
      { id: 'cw_2d', suit: '♦', rank: '2', numericValue: 2, isJack: false },
    ],
    roundNumber: 1,
    latestEvent: null,
    playerScore: null,
    cpuScore: null,
    winner: null,
    eventLog: [],
    actionHistory: [],
  };
}

describe('YOYO BRAIN — Actor-Isolation & Belief Invariants', () => {
  it('1. STRICT ACTOR ISOLATION: ObserveYoyoTurn and observeTurn(cpu) leave ALL sensitive PlayerModel fields completely unchanged', () => {
    const brain = new YoyoBrain('LEVEL_3_RIVAL');
    const pm = brain.getPlayerModel();

    // 1. Establish rich, non-trivial player model baseline metrics
    pm.recordBeliefEvidence('AGGRESSIVE', 3.0, 'High tempo capture');
    pm.recordBeliefEvidence('COLLECTOR', 2.0, 'Focusing on rank 9');
    pm.recordBeliefEvidence('TACTICAL', 1.5, 'Careful sacrifice');
    (pm as any).metrics.stealsExecutedCount = 2;
    (pm as any).metrics.directCapturesCount = 4;
    (pm as any).metrics.adaptationsCount = 1;
    (pm as any).metrics.greedTendencyScore = 0.65;
    (pm as any).metrics.patienceScore = 0.4;
    (pm as any).metrics.strategicDepthScore = 0.55;
    (pm as any).metrics.consecutivePredictableActions = 3;
    (pm as any).metrics.archetype = 'AGGRESSIVE';
    (pm as any).huntedRanks.set('9', 2);
    (pm as any).huntedRanks.set('K', 1);

    // Snapshot of all sensitive fields before CPU turns
    const baselineMetrics = { ...pm.getMetrics() };
    const baselineHuntedRanks = new Map(pm.getHuntedRanks());
    const baselineBeliefs = new Map(pm.getBeliefs());

    // 2. Perform CPU Steal via observeYoyoTurn
    const prevGame = createMockGameState();
    const playedCpuCard: Card = { id: 'c_5d', suit: '♦', rank: '5', numericValue: 5, isJack: false };
    const nextGameCpuSteal: GameState = {
      ...prevGame,
      cpuWinningPile: [...prevGame.cpuWinningPile, prevGame.playerWinningPile[0], playedCpuCard],
      playerWinningPile: [],
      actionHistory: [
        {
          sequence: 1,
          actor: 'cpu',
          cardId: playedCpuCard.id,
          timestamp: Date.now(),
          captureResult: {
            capturedCards: [prevGame.playerWinningPile[0], playedCpuCard],
            capturedFrom: 'WINNING_PILE',
            isTopUniformCapture: true,
            description: 'CPU Steal',
          },
          resultingPhase: 'PLAYER_TURN',
        },
      ],
    };

    brain.observeYoyoTurn(prevGame, nextGameCpuSteal, playedCpuCard, {
      card: playedCpuCard,
      intent: 'CHALLENGE',
      reasoning: 'CPU Steal of Player Pile',
    });

    // 3. Verify ALL sensitive metrics remain 100% frozen after observeYoyoTurn
    const metricsAfterYoyoTurn = pm.getMetrics();
    assert.equal(metricsAfterYoyoTurn.stealsExecutedCount, baselineMetrics.stealsExecutedCount, 'stealsExecutedCount must not change');
    assert.equal(metricsAfterYoyoTurn.directCapturesCount, baselineMetrics.directCapturesCount, 'directCapturesCount must not change');
    assert.equal(metricsAfterYoyoTurn.adaptationsCount, baselineMetrics.adaptationsCount, 'adaptationsCount must not change');
    assert.equal(metricsAfterYoyoTurn.greedTendencyScore, baselineMetrics.greedTendencyScore, 'greedTendencyScore must not change');
    assert.equal(metricsAfterYoyoTurn.patienceScore, baselineMetrics.patienceScore, 'patienceScore must not change');
    assert.equal(metricsAfterYoyoTurn.strategicDepthScore, baselineMetrics.strategicDepthScore, 'strategicDepthScore must not change');
    assert.equal(metricsAfterYoyoTurn.consecutivePredictableActions, baselineMetrics.consecutivePredictableActions, 'consecutivePredictableActions must not change');
    assert.equal(metricsAfterYoyoTurn.archetype, baselineMetrics.archetype, 'archetype must not change');
    assert.equal(metricsAfterYoyoTurn.totalActions, baselineMetrics.totalActions, 'totalActions must not change');

    // Verify hunted ranks and beliefs remain 100% frozen
    assert.deepEqual(Array.from(pm.getHuntedRanks().entries()), Array.from(baselineHuntedRanks.entries()), 'huntedRanks must remain unchanged');
    for (const [arch, belief] of baselineBeliefs.entries()) {
      const currentBelief = pm.getBelief(arch)!;
      assert.equal(currentBelief.evidenceCount, belief.evidenceCount, `Belief evidence for ${arch} must not change`);
      assert.equal(currentBelief.contradictionCount, belief.contradictionCount, `Belief contradiction for ${arch} must not change`);
      assert.equal(currentBelief.confidence, belief.confidence, `Belief confidence for ${arch} must not change`);
    }

    // 4. Test observeTurn fallback with CPU action: ensures NO contamination via observeTurn
    const nextGameCpuTableCapture: GameState = {
      ...nextGameCpuSteal,
      actionHistory: [
        ...nextGameCpuSteal.actionHistory,
        {
          sequence: 2,
          actor: 'cpu',
          cardId: 'c_9d',
          timestamp: Date.now(),
          captureResult: {
            capturedCards: [prevGame.table.playerTable[0]],
            capturedFrom: 'PLAYER_TABLE',
            isTopUniformCapture: false,
            description: 'CPU Capture 9',
          },
          resultingPhase: 'PLAYER_TURN',
        },
      ],
    };

    brain.observeTurn(nextGameCpuSteal, nextGameCpuTableCapture, { id: 'c_9d', suit: '♦', rank: '9', numericValue: 9, isJack: false });

    const metricsAfterObserveTurn = pm.getMetrics();
    assert.equal(metricsAfterObserveTurn.directCapturesCount, baselineMetrics.directCapturesCount, 'observeTurn with cpu actor MUST NOT alter directCapturesCount');
    assert.equal(metricsAfterObserveTurn.stealsExecutedCount, baselineMetrics.stealsExecutedCount, 'observeTurn with cpu actor MUST NOT alter stealsExecutedCount');
    assert.equal(metricsAfterObserveTurn.totalActions, baselineMetrics.totalActions, 'observeTurn with cpu actor MUST NOT alter totalActions');
    assert.equal(brain.getYoyoSelfHistory().length, 2, 'YoyoSelfHistory correctly recorded both CPU actions');
  });

  it('2. BELIEF ENGINE: Evidence accumulation and contradiction allows Yoyo to change mind', () => {
    const pm = new YoyoPlayerModel();

    // Give evidence for Aggressive
    pm.recordBeliefEvidence('AGGRESSIVE', 2.0, 'Repeated fast captures');
    let aggBelief = pm.getBelief('AGGRESSIVE')!;
    assert.ok(aggBelief.confidence > 0.4);

    // Player acts cautiously, contradicting Aggressive hypothesis
    pm.recordBeliefContradiction('AGGRESSIVE', 2.0, 'Passed on capture to defend');
    aggBelief = pm.getBelief('AGGRESSIVE')!;
    assert.ok(aggBelief.confidence < 0.4, 'Confidence decays when player behavior contradicts hypothesis');
  });

  it('3. PERSISTENT HYPOTHESIS LIFECYCLE: Validates on confirmation and disproves on contradiction', () => {
    const adaptation = new YoyoAdaptationModel();
    const pm = new YoyoPlayerModel();
    const gameState = createMockGameState();

    // Player hunts rank 9 twice
    pm.recordBeliefEvidence('COLLECTOR', 2.0, 'Player hunted 9');
    (pm as any).huntedRanks.set('9', 2);

    adaptation.updateHypotheses(pm, gameState);
    const hypo = adaptation.getHypothesis('DENY_RANK_9');
    assert.ok(hypo, 'Hypothesis DENY_RANK_9 was created');
    assert.equal(hypo.status, 'CREATED');

    // Turn 1: Player captures 9 again -> Hypothesis validated
    const prevG = createMockGameState();
    const nextG = {
      ...prevG,
      actionHistory: [
        {
          sequence: 1,
          actor: 'player' as const,
          cardId: 'p_9h',
          timestamp: Date.now(),
          captureResult: {
            capturedCards: [prevG.table.playerTable[0]],
            capturedFrom: 'PLAYER_TABLE' as const,
            isTopUniformCapture: false,
            description: 'Capture 9',
          },
          resultingPhase: 'CPU_TURN' as const,
        },
      ],
    };
    adaptation.observePlayerResponse(prevG, nextG, { id: 'p_9h', suit: '♥', rank: '9', numericValue: 9, isJack: false }, pm);

    const hypoAfter = adaptation.getHypothesis('DENY_RANK_9')!;
    assert.ok(hypoAfter.confidence > 0.5);
    assert.equal(hypoAfter.status, 'VALIDATED');
  });

  it('4. LINKED DECISION TO HYPOTHESIS & RESPONSE LOOP (B2): Decisions carry hypothesis link and player response updates confidence/status', () => {
    const brain = new YoyoBrain('LEVEL_3_RIVAL');
    const richGame = createRichMockGameState();

    // Setup: Player hunts rank 9
    const pm = brain.getPlayerModel();
    (pm as any).huntedRanks.set('9', 3);
    const adaptation = brain.getAdaptationModel();
    adaptation.updateHypotheses(pm, richGame);

    const activeHypo = adaptation.getHypothesis('DENY_RANK_9');
    assert.ok(activeHypo, 'Hypothesis DENY_RANK_9 must exist');

    // 1. Yoyo decides move: must link decision to active hypothesis
    const decision = brain.decideCpuMove(richGame);
    assert.equal(decision.card.rank, '9', 'Yoyo chooses rank 9 to deny player hypothesis');
    assert.equal(decision.hypothesisId, 'DENY_RANK_9', 'Decision must explicitly carry hypothesisId');
    assert.equal(decision.drivenByHypothesis, true, 'Decision must flag drivenByHypothesis: true');

    // 2. Yoyo turn is observed: YoyoSelfAction must carry hypothesis link
    const nextGameYoyoTurn: GameState = {
      ...richGame,
      actionHistory: [
        {
          sequence: 1,
          actor: 'cpu',
          cardId: decision.card.id,
          timestamp: Date.now(),
          captureResult: {
            capturedCards: [richGame.table.playerTable[0]],
            capturedFrom: 'PLAYER_TABLE',
            isTopUniformCapture: false,
            description: 'Capture 9',
          },
          resultingPhase: 'PLAYER_TURN',
        },
      ],
    };
    brain.observeYoyoTurn(richGame, nextGameYoyoTurn, decision.card, decision);

    const lastSelfAction = brain.getYoyoSelfHistory()[0];
    assert.ok(lastSelfAction, 'YoyoSelfAction must exist');
    assert.equal(lastSelfAction.hypothesisId, 'DENY_RANK_9', 'YoyoSelfAction must record hypothesisId');
    assert.equal(lastSelfAction.drivenByHypothesis, true, 'YoyoSelfAction must record drivenByHypothesis');

    // 3. Response A: Confirmatory player response (player continues targeting rank 9)
    const nextGamePlayerConfirm: GameState = {
      ...nextGameYoyoTurn,
      actionHistory: [
        ...nextGameYoyoTurn.actionHistory,
        {
          sequence: 2,
          actor: 'player',
          cardId: 'p_9h',
          timestamp: Date.now(),
          captureResult: {
            capturedCards: [],
            capturedFrom: 'NONE',
            isTopUniformCapture: false,
            description: 'Player attempts 9',
          },
          resultingPhase: 'CPU_TURN',
        },
      ],
    };
    brain.observePlayerTurn(
      nextGameYoyoTurn,
      nextGamePlayerConfirm,
      { id: 'p_9h', suit: '♥', rank: '9', numericValue: 9, isJack: false }
    );

    const hypoAfterConfirm = adaptation.getHypothesis('DENY_RANK_9')!;
    assert.ok(hypoAfterConfirm.confidence >= 0.7, 'Confidence should rise upon confirmation');
    assert.equal(hypoAfterConfirm.status, 'VALIDATED', 'Status should be VALIDATED');

    // 4. Response B: Contradictory player response (player pivots to rank 2)
    // Create another brain instance to test clean contradictory pivot
    const brain2 = new YoyoBrain('LEVEL_3_RIVAL');
    const pm2 = brain2.getPlayerModel();
    (pm2 as any).huntedRanks.set('9', 2);
    const adapt2 = brain2.getAdaptationModel();
    adapt2.updateHypotheses(pm2, richGame);

    const decision2 = brain2.decideCpuMove(richGame);
    brain2.observeYoyoTurn(richGame, nextGameYoyoTurn, decision2.card, decision2);

    const nextGamePlayerContradict: GameState = {
      ...nextGameYoyoTurn,
      actionHistory: [
        ...nextGameYoyoTurn.actionHistory,
        {
          sequence: 2,
          actor: 'player',
          cardId: 'p_2s',
          timestamp: Date.now(),
          captureResult: {
            capturedCards: [],
            capturedFrom: 'NONE',
            isTopUniformCapture: false,
            description: 'Player plays 2 instead',
          },
          resultingPhase: 'CPU_TURN',
        },
      ],
    };

    brain2.observePlayerTurn(
      nextGameYoyoTurn,
      nextGamePlayerContradict,
      { id: 'p_2s', suit: '♠', rank: '2', numericValue: 2, isJack: false }
    );

    const hypoAfterContradict = adapt2.getHypothesis('DENY_RANK_9')!;
    assert.ok(hypoAfterContradict.contradictionCount > 0, 'Contradiction count must increment');
    assert.ok(hypoAfterContradict.confidence < 0.35, 'Confidence must drop below threshold on contradiction');
    assert.equal(hypoAfterContradict.status, 'DISPROVED', 'Hypothesis should be DISPROVED when contradicted');
  });

  it('5. STRENGTHENED KILLER TEST: Same rich board with 4 CPU cards produces different legal moves for different PlayerModels (B3)', () => {
    const richGame = createRichMockGameState();
    // Hand has [9♦, 6♣, 4♠, K♥]
    // playerTable has [9♣, 6♠], opponentTable has [4♦, 3♥]
    const deckKnowledge = new YoyoDeckKnowledge();
    deckKnowledge.observeGameState(richGame);

    // --- CASE A: Player hunts Rank 9 (Aggressive) ---
    const pmA = new YoyoPlayerModel({ archetype: 'AGGRESSIVE' });
    (pmA as any).huntedRanks.set('9', 3);
    const adaptA = new YoyoAdaptationModel();
    adaptA.updateHypotheses(pmA, richGame);

    const decisionA = YoyoStrategicModel.decideMove(richGame, 'LEVEL_3_RIVAL', deckKnowledge, pmA, adaptA);
    assert.equal(decisionA.card.rank, '9', 'Against Player hunting 9, Rival denies rank 9');
    assert.equal(decisionA.hypothesisId, 'DENY_RANK_9');
    assert.equal(decisionA.drivenByHypothesis, true);

    // --- CASE B: Player hunts Rank 6 (Cautious / Collector) ---
    const pmB = new YoyoPlayerModel({ archetype: 'COLLECTOR' });
    (pmB as any).huntedRanks.set('6', 3);
    const adaptB = new YoyoAdaptationModel();
    adaptB.updateHypotheses(pmB, richGame);

    const decisionB = YoyoStrategicModel.decideMove(richGame, 'LEVEL_3_RIVAL', deckKnowledge, pmB, adaptB);
    assert.equal(decisionB.card.rank, '6', 'Against Player hunting 6, Rival denies rank 6');
    assert.equal(decisionB.hypothesisId, 'DENY_RANK_6');
    assert.equal(decisionB.drivenByHypothesis, true);

    // --- CASE C: Player hunts Rank 4 (Tactical) ---
    const pmC = new YoyoPlayerModel({ archetype: 'TACTICAL' });
    (pmC as any).huntedRanks.set('4', 3);
    const adaptC = new YoyoAdaptationModel();
    adaptC.updateHypotheses(pmC, richGame);

    const decisionC = YoyoStrategicModel.decideMove(richGame, 'LEVEL_3_RIVAL', deckKnowledge, pmC, adaptC);
    assert.equal(decisionC.card.rank, '4', 'Against Player hunting 4, Rival denies rank 4');
    assert.equal(decisionC.hypothesisId, 'DENY_RANK_4');
    assert.equal(decisionC.drivenByHypothesis, true);

    // Verify all 3 decisions are distinct legal moves on the exact same GameState
    assert.notEqual(decisionA.card.id, decisionB.card.id);
    assert.notEqual(decisionB.card.id, decisionC.card.id);
    assert.notEqual(decisionA.card.id, decisionC.card.id);
  });

  it('6. KILLER TEST FOR LEVEL_4_MASTER: Counterfactual lookahead adapts legal choices to player archetype and hunted ranks', () => {
    const richGame = createRichMockGameState();
    const deckKnowledge = new YoyoDeckKnowledge();
    deckKnowledge.observeGameState(richGame);

    // Master against Player hunting 9
    const pmA = new YoyoPlayerModel({ archetype: 'AGGRESSIVE' });
    (pmA as any).huntedRanks.set('9', 3);
    const adaptA = new YoyoAdaptationModel();
    adaptA.updateHypotheses(pmA, richGame);

    const masterDecisionA = YoyoStrategicModel.decideMove(richGame, 'LEVEL_4_MASTER', deckKnowledge, pmA, adaptA);
    assert.equal(masterDecisionA.card.rank, '9', 'Master prioritizes denying rank 9 when player heavily hunts it');
    assert.ok(masterDecisionA.counterfactualCandidate);
    assert.equal(masterDecisionA.drivenByHypothesis, true);

    // Master against Player hunting 6
    const pmB = new YoyoPlayerModel({ archetype: 'COLLECTOR' });
    (pmB as any).huntedRanks.set('6', 3);
    const adaptB = new YoyoAdaptationModel();
    adaptB.updateHypotheses(pmB, richGame);

    const masterDecisionB = YoyoStrategicModel.decideMove(richGame, 'LEVEL_4_MASTER', deckKnowledge, pmB, adaptB);
    assert.equal(masterDecisionB.card.rank, '6', 'Master prioritizes denying rank 6 when player hunts 6');
    assert.ok(masterDecisionB.counterfactualCandidate);
    assert.equal(masterDecisionB.drivenByHypothesis, true);

    // Verify distinct decisions
    assert.notEqual(masterDecisionA.card.id, masterDecisionB.card.id);
  });

  it('7. ADAPTIVE LOOP CYCLE: Contradictory player response drops confidence and alters subsequent Yoyo move choice', () => {
    const richGame = createRichMockGameState();
    const deckKnowledge = new YoyoDeckKnowledge();
    deckKnowledge.observeGameState(richGame);

    // Initialize with active hypothesis DENY_RANK_9
    const pm = new YoyoPlayerModel();
    (pm as any).huntedRanks.set('9', 2);
    const adapt = new YoyoAdaptationModel();
    adapt.updateHypotheses(pm, richGame);

    // Step 1: Initial decision is rank 9
    const initialDecision = YoyoStrategicModel.decideMove(richGame, 'LEVEL_3_RIVAL', deckKnowledge, pm, adapt);
    assert.equal(initialDecision.card.rank, '9');
    assert.equal(initialDecision.hypothesisId, 'DENY_RANK_9');

    // Simulate Yoyo making this move
    const selfAction = {
      turnNumber: 1,
      cardPlayed: initialDecision.card,
      targetRank: initialDecision.targetCardRank,
      intent: initialDecision.intent,
      reasoning: initialDecision.reasoning,
      hypothesisId: initialDecision.hypothesisId,
      drivenByHypothesis: initialDecision.drivenByHypothesis,
    };

    // Step 2: Player CONTRADICTS hypothesis by ignoring 9 completely and playing a defensive 2
    const prevG = richGame;
    const nextG: GameState = {
      ...richGame,
      actionHistory: [
        {
          sequence: 2,
          actor: 'player',
          cardId: 'p_2s',
          timestamp: Date.now(),
          captureResult: {
            capturedCards: [],
            capturedFrom: 'NONE',
            isTopUniformCapture: false,
            description: 'Player ignores 9',
          },
          resultingPhase: 'CPU_TURN',
        },
      ],
    };

    adapt.observePlayerResponse(
      prevG,
      nextG,
      { id: 'p_2s', suit: '♠', rank: '2', numericValue: 2, isJack: false },
      pm,
      [selfAction]
    );

    // Step 3: Verify hypothesis is now DISPROVED and inactive
    const disprovedHypo = adapt.getHypothesis('DENY_RANK_9')!;
    assert.equal(disprovedHypo.status, 'DISPROVED');
    assert.ok(disprovedHypo.confidence < 0.35);
    assert.ok(
      !adapt.getActiveHypotheses().some((h) => h.id === 'DENY_RANK_9'),
      'Disproved hypothesis must NOT be present in active hypotheses'
    );

    // Step 4: Yoyo makes a new decision on a board where 9 and 6 are options.
    // Because DENY_RANK_9 is disproved, Yoyo does not force rank 9 due to hypothesis!
    // Setup a board where rank 6 is a valuable capture:
    const boardState: GameState = {
      ...richGame,
      cpuHand: [
        { id: 'c_9d', suit: '♦', rank: '9', numericValue: 9, isJack: false },
        { id: 'c_6c', suit: '♣', rank: '6', numericValue: 6, isJack: false },
      ],
      table: {
        playerTable: [
          { id: 'pt_9c', suit: '♣', rank: '9', numericValue: 9, isJack: false },
        ],
        opponentTable: [
          { id: 'ct_6s', suit: '♠', rank: '6', numericValue: 6, isJack: false },
        ],
        viewMode: 'NORMAL_VIEW',
      },
    };

    // Now give Player Model B interest in 6
    (pm as any).huntedRanks.delete('9');
    (pm as any).huntedRanks.set('6', 2);
    adapt.updateHypotheses(pm, boardState);

    const subsequentDecision = YoyoStrategicModel.decideMove(boardState, 'LEVEL_3_RIVAL', deckKnowledge, pm, adapt);
    assert.equal(subsequentDecision.card.rank, '6', 'After DENY_RANK_9 is disproved, Yoyo adapts to target rank 6');
    assert.equal(subsequentDecision.hypothesisId, 'DENY_RANK_6');
  });
});
