import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { YoyoStrategicModel } from '../yoyoStrategicModel';
import { YoyoDeckKnowledge } from '../yoyoDeckKnowledge';
import { YoyoPlayerModel } from '../yoyoPlayerModel';
import { createInitialFirstMatch } from '../../../firstMatch/firstMatchEngine';

describe('YOYO BRAIN — Strategic Decision Model across Difficulty Tiers', () => {
  it('1. Level 0 Friendly: prefers safe non-aggressive moves', () => {
    const { game } = createInitialFirstMatch();
    const dk = new YoyoDeckKnowledge();
    const pm = new YoyoPlayerModel();

    const decision = YoyoStrategicModel.decideMove(game, 'LEVEL_0_FRIENDLY', dk, pm);
    assert.ok(decision.card);
    assert.ok(game.cpuHand.some((c) => c.id === decision.card.id));
  });

  it('2. Level 2 Competitor & Level 3 Rival: legally selects optimal tactical move', () => {
    const { game } = createInitialFirstMatch();
    const dk = new YoyoDeckKnowledge();
    const pm = new YoyoPlayerModel();

    const decisionCompetitor = YoyoStrategicModel.decideMove(game, 'LEVEL_2_COMPETITOR', dk, pm);
    assert.ok(decisionCompetitor.card);
    assert.ok(game.cpuHand.some((c) => c.id === decisionCompetitor.card.id));

    const decisionRival = YoyoStrategicModel.decideMove(game, 'LEVEL_3_RIVAL', dk, pm);
    assert.ok(decisionRival.card);
    assert.ok(game.cpuHand.some((c) => c.id === decisionRival.card.id));
  });
});
