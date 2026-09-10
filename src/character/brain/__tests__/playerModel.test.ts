import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { YoyoPlayerModel } from '../yoyoPlayerModel';
import { createInitialFirstMatch, executeFirstMatchCpuTurn } from '../../../firstMatch/firstMatchEngine';
import { playPlayerCard } from '../../../engine/gameEngine';

describe('YOYO BRAIN — Player Model & Behavioral Profiling', () => {
  it('1. Initializes with default novice baseline', () => {
    const pm = new YoyoPlayerModel();
    const metrics = pm.getMetrics();
    assert.equal(metrics.totalActions, 0);
    assert.equal(metrics.archetype, 'NOVICE');
    assert.equal(metrics.stealsExecutedCount, 0);
  });

  it('2. Detects direct capture and updates strategic depth', () => {
    const { state: s0, game: g0 } = createInitialFirstMatch();
    const pm = new YoyoPlayerModel();

    // Player captures 9♣ with 9♥
    const card9h = g0.playerHand.find((c) => c.rank === '9' && c.suit === '♥')!;
    const g1 = playPlayerCard(g0, card9h.id);

    pm.observePlayerAction(g0, g1, card9h, 1500);
    const m1 = pm.getMetrics();

    assert.equal(m1.totalActions, 1);
    assert.equal(m1.directCapturesCount, 1);
    assert.ok(m1.strategicDepthScore > 0);
  });

  it('3. Detects steal and upgrades archetype awareness', () => {
    const { state: s0, game: g0 } = createInitialFirstMatch();
    const pm = new YoyoPlayerModel();

    // Turn 1
    const card9h = g0.playerHand.find((c) => c.rank === '9')!;
    const g1 = playPlayerCard(g0, card9h.id);
    pm.observePlayerAction(g0, g1, card9h, 1000);
    const g2 = executeFirstMatchCpuTurn(g1, s0);

    // Turn 2
    const card4d = g2.playerHand.find((c) => c.rank === '4')!;
    const g3 = playPlayerCard(g2, card4d.id);
    pm.observePlayerAction(g2, g3, card4d, 1200);
    const g4 = executeFirstMatchCpuTurn(g3, s0);

    // Turn 3: STEAL!
    const card7h = g4.playerHand.find((c) => c.rank === '7')!;
    const g5 = playPlayerCard(g4, card7h.id);
    pm.observePlayerAction(g4, g5, card7h, 900);

    const m3 = pm.getMetrics();
    assert.equal(m3.stealsExecutedCount, 1);
    assert.ok(m3.threatAwarenessScore > 0.3);
    assert.ok(m3.archetype === 'CAUTIOUS' || m3.archetype === 'TACTICAL' || m3.archetype === 'AGGRESSIVE');
  });
});
