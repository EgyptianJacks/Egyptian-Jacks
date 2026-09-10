import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { YoyoBrain } from '../yoyoBrain';
import { createInitialFirstMatch } from '../../../firstMatch/firstMatchEngine';
import { playPlayerCard } from '../../../engine/gameEngine';
import { calculateScores } from '../../../engine/rules';

describe('YOYO BRAIN — Unified Character & Strategy Integration', () => {
  it('1. Initializes with default difficulty and stranger stage', () => {
    const brain = new YoyoBrain('LEVEL_3_RIVAL');
    assert.equal(brain.getDifficulty(), 'LEVEL_3_RIVAL');
    assert.ok(brain.getRelationshipStage());
  });

  it('2. Observes turn and produces contextual expression and dialogue', () => {
    const brain = new YoyoBrain('LEVEL_2_COMPETITOR');
    const { game: g0 } = createInitialFirstMatch();
    brain.startNewMatch(g0);

    const card9h = g0.playerHand.find((c) => c.rank === '9' && c.suit === '♥')!;
    const g1 = playPlayerCard(g0, card9h.id);

    const evaluation = brain.observeTurn(g0, g1, card9h);
    assert.ok(evaluation.expression);
    assert.ok(evaluation.relationshipStage);
    assert.ok(evaluation.playerArchetype);
  });

  it('3. Maps CPU difficulty from UI cleanly to Yoyo levels', () => {
    assert.equal(YoyoBrain.mapCpuDifficultyToYoyoLevel('EASY'), 'LEVEL_0_FRIENDLY');
    assert.equal(YoyoBrain.mapCpuDifficultyToYoyoLevel('MEDIUM'), 'LEVEL_2_COMPETITOR');
    assert.equal(YoyoBrain.mapCpuDifficultyToYoyoLevel('HARD'), 'LEVEL_3_RIVAL');
  });

  it('4. Records episodic memory and remains idempotent on duplicate match finish calls', () => {
    const brain = new YoyoBrain('LEVEL_2_COMPETITOR');
    const { game: g0 } = createInitialFirstMatch();
    brain.startNewMatch(g0);

    const dummyScores = {
      ...calculateScores(g0.playerWinningPile, 'player'),
      silverCombos: 1,
      totalScore: 77,
    };

    const cpuScores = {
      ...calculateScores(g0.cpuWinningPile, 'cpu'),
      totalScore: 50,
    };

    brain.recordMatchFinished(g0, dummyScores, cpuScores);
    const mem1 = brain.getEpisodicMemory();
    assert.ok(mem1);
    assert.equal(mem1.lastSurprise, 'SILVER_COMBO');

    // Duplicate call with same matchId must be idempotent
    const matchesBefore = brain.getProfile().totalMatchesPlayed;
    brain.recordMatchFinished(g0, dummyScores, cpuScores);
    assert.equal(brain.getProfile().totalMatchesPlayed, matchesBefore);

    // generateMatchAnalysis must also be idempotent and cached
    const a1 = brain.generateMatchAnalysis(g0, dummyScores, cpuScores);
    const a2 = brain.generateMatchAnalysis(g0, dummyScores, cpuScores);
    assert.equal(a1, a2);
  });

  it('5. Tracks behavioral metrics (riskTolerance, pileProtection, baitPreference, denialPreference)', () => {
    const brain = new YoyoBrain('LEVEL_2_COMPETITOR');
    const { game: g0 } = createInitialFirstMatch();
    brain.startNewMatch(g0);

    const metrics = brain.getPlayerModel().getMetrics();
    assert.equal(typeof metrics.riskTolerance, 'number');
    assert.equal(typeof metrics.pileProtection, 'number');
    assert.equal(typeof metrics.baitPreference, 'number');
    assert.equal(typeof metrics.denialPreference, 'number');
  });
});
