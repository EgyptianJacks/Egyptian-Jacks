import test from 'node:test';
import assert from 'node:assert/strict';
import { YoyoBrain } from '../yoyoBrain';
import { YoyoDialogueSystem } from '../yoyoDialogueSystem';
import { YoyoMatchAnalysis } from '../yoyoMatchAnalysis';
import { MatchOrchestrator } from '../../../orchestration/matchOrchestrator';
import { createInitialMatch } from '../../../engine/matchEngine';
import { Card, GameState, ScoreBreakdown } from '../../../types/game';

test('YoyoDialogueSystem — Cooldown, Priority, and Silence Verification', async (t) => {
  await t.test('1. Regular captures during cooldown produce silence', () => {
    const line = YoyoDialogueSystem.generateSemanticLine({
      situation: {
        type: 'IMMEDIATE_CAPTURE',
        confidence: 0.8,
        evidence: ['Captured card'],
        immediateValueGained: 2,
        potentialFutureValue: 0,
        isPlayerMove: true,
      },
      playerArchetype: 'CAUTIOUS',
      relationshipStage: 'STAGE_6_RIVAL',
      difficultyLevel: 'LEVEL_3_RIVAL',
      confidence: 0.8,
      turnsSinceLastDialogue: 0, // In cooldown
      isPlayerMove: true,
    });

    assert.equal(line.silent, true);
    assert.equal(line.text, '');
  });

  await t.test('2. High priority Golden Combos bypass cooldown immediately', () => {
    const line = YoyoDialogueSystem.generateSemanticLine({
      situation: {
        type: 'GOLDEN_THREAT',
        confidence: 1.0,
        evidence: ['Golden combo achieved'],
        immediateValueGained: 75,
        potentialFutureValue: 0,
        isPlayerMove: true,
      },
      playerArchetype: 'MASTER',
      relationshipStage: 'STAGE_6_RIVAL',
      difficultyLevel: 'LEVEL_4_MASTER',
      confidence: 1.0,
      turnsSinceLastDialogue: 0, // 0 turns, but Priority 10
      isPlayerMove: true,
    });

    assert.equal(line.silent, false || undefined);
    assert.equal(line.priority, 10);
    assert.ok(line.text.includes('جولدن'));
    assert.equal(line.expression, 'surprise_golden');
  });

  await t.test('3. Tactical player Steal produces respectful recognition rather than novice surprise', () => {
    const line = YoyoDialogueSystem.generateSemanticLine({
      situation: {
        type: 'WINNING_PILE_STEAL',
        confidence: 0.95,
        evidence: ['Stole winning pile'],
        immediateValueGained: 10,
        potentialFutureValue: 5,
        isPlayerMove: true,
      },
      playerArchetype: 'TACTICAL',
      relationshipStage: 'STAGE_6_RIVAL',
      difficultyLevel: 'LEVEL_3_RIVAL',
      confidence: 0.95,
      turnsSinceLastDialogue: 5,
      isPlayerMove: true,
    });

    assert.equal(line.intent, 'RESPECT');
    assert.ok(line.text.includes('التوقيت الصح'));
  });
});

test('YoyoMatchAnalysis — Post Match Reflection Verification', async (t) => {
  const { round: game } = createInitialMatch('SINGLE', 42, 'player');
  const brain = new YoyoBrain('LEVEL_3_RIVAL');

  const dummyPlayerScore: ScoreBreakdown = {
    playerId: 'player',
    jackCount: 1,
    log: [],
    goldenCombos: 1,
    silverCombos: 0,
    balancedCombos: 0,
    ironCombos: 0,
    doubleCombos: 0,
    jackSets: 1,
    regularSets: 2,
    remainingJacks: 0,
    remainingOtherCards: 10,
    goldenPoints: 75,
    silverPoints: 0,
    balancedPoints: 0,
    ironPoints: 0,
    doublePoints: 0,
    jackSetPoints: 36,
    regularSetPoints: 24,
    jackPoints: 0,
    cardPoints: 10,
    totalCards: 22,
    totalScore: 145,
    sets: [],
  };

  const dummyCpuScore: ScoreBreakdown = {
    playerId: 'cpu',
    jackCount: 1,
    log: [],
    goldenCombos: 0,
    silverCombos: 0,
    balancedCombos: 0,
    ironCombos: 0,
    doubleCombos: 0,
    jackSets: 0,
    regularSets: 1,
    remainingJacks: 1,
    remainingOtherCards: 8,
    goldenPoints: 0,
    silverPoints: 0,
    balancedPoints: 0,
    ironPoints: 0,
    doublePoints: 0,
    jackSetPoints: 0,
    regularSetPoints: 12,
    jackPoints: 3,
    cardPoints: 8,
    totalCards: 13,
    totalScore: 23,
    sets: [],
  };

  const analysis = YoyoMatchAnalysis.analyzeMatch(game, dummyPlayerScore, dummyCpuScore, brain);

  assert.ok(analysis.headline.includes('فوز'));
  assert.ok(analysis.whatPlayerDidWell.includes('الجولدن كومبو') || analysis.whatPlayerDidWell.length > 0);
  assert.ok(analysis.yoyoQuote.length > 0);
  assert.ok(analysis.nextChallengeTip.length > 0);
});

test('MatchOrchestrator — Integration & Unified Execution', async (t) => {
  const orchestrator = MatchOrchestrator.getInstance();
  const { round: game } = createInitialMatch('SINGLE', 101, 'player');

  orchestrator.startMatch(game, 'NORMAL', 'HARD');
  assert.equal(orchestrator.getBrain().getDifficulty(), 'LEVEL_3_RIVAL');

  // Verify Player Move Execution through Orchestrator
  const playerCard = game.playerHand[0];
  const playerResult = orchestrator.handlePlayerMove(game, playerCard, 'NORMAL', undefined, 1200);

  assert.ok(playerResult.nextState);
  assert.equal(playerResult.nextState.activeTurn, 'cpu');
  assert.ok(playerResult.yoyoEvaluation);

  // Verify CPU Move Execution through Orchestrator using YoyoBrain
  const cpuResult = orchestrator.handleCpuMove(playerResult.nextState, 'NORMAL', undefined, 'HARD');

  assert.ok(cpuResult.nextState);
  assert.equal(cpuResult.nextState.activeTurn, 'player');
  assert.ok(cpuResult.yoyoEvaluation);
});
