import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { YoyoCoachingEngine } from '../yoyoCoachingEngine';
import { MatchTimelineRecorder } from '../../../engine/matchTimeline';
import { BoardSnapshotSummary, TimelineActionRecord } from '../yoyoCoachingTypes';
import { Card, PlayerId, Rank, Suit } from '../../../types/game';

function makeCard(id: string, rank: Rank, suit: Suit = '♥'): Card {
  const numericMap: Record<Rank, number> = {
    A: 1,
    '2': 2,
    '3': 3,
    '4': 4,
    '5': 5,
    '6': 6,
    '7': 7,
    '8': 8,
    '9': 9,
    '10': 10,
    J: 11,
    Q: 12,
    K: 13,
  };
  return {
    id,
    rank,
    suit,
    numericValue: numericMap[rank],
    isJack: rank === 'J',
  };
}

function makeActionData(
  actor: PlayerId,
  cardPlayed: Card,
  capturedCards: Card[],
  isSteal: boolean,
  winningPileAddedRanks: Rank[],
  setsFormedThisAction: Rank[] = []
): Omit<TimelineActionRecord, 'sequence' | 'timestamp'> {
  const snapshot: BoardSnapshotSummary = {
    playerHandCardIds: [],
    cpuHandCount: 0,
    playerTableCards: [],
    opponentTableCards: [],
    playerWinningPileCount: 0,
    cpuWinningPileCount: 0,
  };

  return {
    turnNumber: 1,
    actor,
    cardPlayed,
    capturedCards,
    isSteal,
    isDirectCapture: capturedCards.length > 0 && !isSteal,
    winningPileAddedRanks,
    setsFormedThisAction,
    stateBefore: snapshot,
    stateAfter: snapshot,
  };
}

describe('YO-YO 2.0 — Canonical Coaching & 7-Story Scenario Verification', () => {
  it('1. Executes the Canonical 4-beat "7-Story" Set Recovery Scenario with full evidence and temporal reasoning', () => {
    const timelineRecorder = new MatchTimelineRecorder();
    const coachingEngine = new YoyoCoachingEngine();

    // Turn 1: Player captures 7 (holds 2 sevens in winning pile)
    const card7H = makeCard('c1', '7', '♥');
    const table7D = makeCard('c2', '7', '♦');
    timelineRecorder.recordRawAction(
      makeActionData('player', card7H, [table7D], false, ['7', '7'])
    );

    // Turn 2: Player captures another 7 (holds 3 sevens)
    const card7C = makeCard('c3', '7', '♣');
    timelineRecorder.recordRawAction(
      makeActionData('player', card7C, [], false, ['7'])
    );

    // Turn 3: CPU captures 7 (interrupts player build)
    const cpu7S = makeCard('c4', '7', '♠');
    const table7Alt = makeCard('c5', '7', '♥');
    timelineRecorder.recordRawAction(
      makeActionData('cpu', cpu7S, [table7Alt], false, ['7'])
    );

    // Turn 4: Player steals the 7 back from CPU's winning pile!
    const stealCard7 = makeCard('c6', '7', '♦');
    timelineRecorder.recordRawAction(
      makeActionData('player', stealCard7, [cpu7S], true, ['7', '7'])
    );

    const timeline = timelineRecorder.getTimeline();
    assert.equal(timeline.actions.length, 4, 'Timeline must record all 4 actions');

    // Evaluate turn 4 through the coaching engine
    const latestAction = timeline.actions[3];
    const moment = coachingEngine.evaluateTurn(timeline, latestAction, 'STAGE_3_FRIEND');

    assert.ok(moment, 'Coaching moment must be generated for the 7-story recovery');
    assert.equal(moment.triggerMeaning, 'BUILD_RECOVERED');
    assert.equal(moment.conceptTitle, 'استعادة بناء مجموعة الـ7');
    assert.equal(moment.animation, 'CELEBRATE_RECOVERY');
    assert.equal(moment.presentationLevel, 'LEVEL_3_TEACHING_CARD');
    assert.equal(moment.primaryTarget, 'OPPONENT_WINNING_PILE');
    assert.equal(moment.secondaryTarget, 'PLAYER_WINNING_PILE');

    // Check temporal past -> present dialogue with exact turn references
    assert.ok(moment.dialogue.includes('دور #1'), 'Dialogue must reference initial build turn (#1)');
    assert.ok(moment.dialogue.includes('دور #3'), 'Dialogue must reference interruption turn (#3)');
    assert.ok(moment.dialogue.includes('الـ7'), 'Dialogue must reference rank 7');

    // Check evidence gating: exact 4 evidence items tracing turns 1, 2, 3, 4
    assert.equal(moment.evidence.length, 4, 'Evidence must include all 4 contributing actions');
    assert.deepEqual(moment.historicalTurnReferences, [1, 2, 3, 4]);

    // Check causal timeline relationships
    const recoveryRel = timeline.relationships.find((r) => r.relation === 'RECOVERED');
    assert.ok(recoveryRel, 'Timeline must contain RECOVERED relationship');
    assert.equal(recoveryRel.targetActionSeq, 4);
  });

  it('2. Enforces Evidence Gating: Routine moves or unbacked claims are silenced', () => {
    const timelineRecorder = new MatchTimelineRecorder();
    const coachingEngine = new YoyoCoachingEngine();

    // Routine play with no captures and no sets
    const routineCard = makeCard('c1', '3', '♥');
    timelineRecorder.recordRawAction(
      makeActionData('player', routineCard, [], false, [])
    );

    const timeline = timelineRecorder.getTimeline();
    const moment = coachingEngine.evaluateTurn(timeline, timeline.actions[0]);

    assert.equal(moment, null, 'Routine move with confidence < threshold or routine play must be silenced');
  });

  it('3. Distinguishes Combo Completion from Regular Set Completion', () => {
    const timelineRecorder = new MatchTimelineRecorder();
    const coachingEngine = new YoyoCoachingEngine();

    // Regular Set (4 tens = 12 pts)
    const card10 = makeCard('c1', '10', '♥');
    timelineRecorder.recordRawAction(
      makeActionData('player', card10, [makeCard('c2', '10', '♦')], false, ['10', '10', '10', '10'], ['10'])
    );

    const timeline1 = timelineRecorder.getTimeline();
    const momentSet = coachingEngine.evaluateTurn(timeline1, timeline1.actions[0]);
    assert.ok(momentSet);
    assert.equal(momentSet.triggerMeaning, 'SET_COMPLETION');
    assert.equal(momentSet.conceptTitle, 'مجموعة 10 كاملة (+12 نقطة)');

    // Now Golden Combo formation (75 pts)
    timelineRecorder.recordRawAction(
      makeActionData('player', makeCard('c3', 'J', '♠'), [], false, ['J'])
    );
    // Manually register combo in timeline
    timelineRecorder.recordComboFormation('GOLDEN_COMBO', 'player', 75, 2);

    const timeline2 = timelineRecorder.getTimeline();
    const momentCombo = coachingEngine.evaluateTurn(timeline2, timeline2.actions[1]);
    assert.ok(momentCombo);
    assert.equal(momentCombo.triggerMeaning, 'COMBO_COMPLETION');
    assert.ok(momentCombo.conceptTitle.includes('المجموعة الذهبية'));
    assert.equal(momentCombo.priority, 10);
    assert.equal(momentCombo.expression, 'surprise_golden');
  });
});
