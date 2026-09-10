import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveYoyoReaction,
  normalizeAuthoritativeGameEvent,
  resolveLearnByPlayReaction,
  resolveTutorialCoachReaction,
  YOYO_SIGNATURE_QUOTES,
  YOYO_CANONICAL_BIBLE,
} from './yoyo';

describe('Coach Yoyo Character Layer (Canon v1.0)', () => {
  describe('Authoritative Event Normalization & Priority', () => {
    it('prioritizes match terminal outcomes above all other in-game events', () => {
      const event = normalizeAuthoritativeGameEvent({
        isPlayerWin: true,
        hasGoldenCombo: true,
        isSteal: true,
        isCapture: true,
      });
      assert.equal(event, 'PLAYER_WIN');

      const lossEvent = normalizeAuthoritativeGameEvent({
        isCpuWin: true,
        hasJackSet: true,
      });
      assert.equal(lossEvent, 'PLAYER_LOSS');
    });

    it('Test C: Golden Combo priority — Golden Combo (75 pts) over Silver Combo and Jack Set', () => {
      const event = normalizeAuthoritativeGameEvent({
        hasGoldenCombo: true,
        hasSilverCombo: true,
        hasJackSet: true,
        isTransitionToRival: true,
      });
      assert.equal(event, 'PLAYER_GOLDEN_COMBO');
    });

    it('Test B: Silver Combo priority — Silver Combo (60 pts) over Jack Set (36 pts)', () => {
      const event = normalizeAuthoritativeGameEvent({
        hasSilverCombo: true,
        hasJackSet: true,
      });
      assert.equal(event, 'PLAYER_SILVER_COMBO');
      assert.notEqual(event, 'PLAYER_JACK_SET');
    });

    it('prioritizes Jack Set over Steal', () => {
      const event = normalizeAuthoritativeGameEvent({
        hasJackSet: true,
        isSteal: true,
        isCapture: true,
      });
      assert.equal(event, 'PLAYER_JACK_SET');
    });

    it('prioritizes Steal over Regular Set', () => {
      const event = normalizeAuthoritativeGameEvent({
        isSteal: true,
        hasRegularSet: true,
        isCapture: true,
      });
      assert.equal(event, 'PLAYER_STEAL');
    });

    it('prioritizes Regular Set over simple Capture', () => {
      const event = normalizeAuthoritativeGameEvent({
        hasRegularSet: true,
        isCapture: true,
      });
      assert.equal(event, 'PLAYER_REGULAR_SET');
    });

    it('returns PLAYER_CAPTURE for standard capture', () => {
      const event = normalizeAuthoritativeGameEvent({
        isCapture: true,
      });
      assert.equal(event, 'PLAYER_CAPTURE');
    });

    it('returns QUESTIONABLE_MOVE for suboptimal plays', () => {
      const event = normalizeAuthoritativeGameEvent({
        isQuestionable: true,
      });
      assert.equal(event, 'QUESTIONABLE_MOVE');
    });

    it('returns NO_REACTION when no events match', () => {
      const event = normalizeAuthoritativeGameEvent({});
      assert.equal(event, 'NO_REACTION');
    });
  });

  describe('Relationship Stage Progression', () => {
    it('advances from Stranger to Coach on initial capture', () => {
      const reaction = resolveYoyoReaction('PLAYER_CAPTURE', {
        currentStage: 'STAGE_1_STRANGER',
      });
      assert.equal(reaction.relationshipStage, 'STAGE_2_COACH');
      assert.equal(reaction.expression, 'approval');
    });

    it('advances to Friend on steal or regular set', () => {
      const stealReaction = resolveYoyoReaction('PLAYER_STEAL', {
        currentStage: 'STAGE_2_COACH',
      });
      assert.equal(stealReaction.relationshipStage, 'STAGE_3_FRIEND');
      assert.equal(stealReaction.expression, 'surprise_steal');

      const setReaction = resolveYoyoReaction('PLAYER_REGULAR_SET', {
        currentStage: 'STAGE_2_COACH',
      });
      assert.equal(setReaction.relationshipStage, 'STAGE_3_FRIEND');
      assert.equal(setReaction.expression, 'celebrate_set');
    });

    it('advances to Respect on Jack Set or Silver Combo', () => {
      const reaction = resolveYoyoReaction('PLAYER_JACK_SET', {
        currentStage: 'STAGE_3_FRIEND',
      });
      assert.equal(reaction.relationshipStage, 'STAGE_4_RESPECT');
      assert.equal(reaction.expression, 'jack_set_reaction');
    });

    it('Test D: Golden produces Challenge first — advances to Challenge, not immediately Rival', () => {
      const reaction = resolveYoyoReaction('PLAYER_GOLDEN_COMBO', {
        currentStage: 'STAGE_4_RESPECT',
      });
      assert.equal(reaction.relationshipStage, 'STAGE_5_CHALLENGE');
      assert.notEqual(reaction.relationshipStage, 'STAGE_6_RIVAL');
    });

    it('Test F: Golden reaction is preserved — surprise_golden expression and dialogue', () => {
      const reaction = resolveYoyoReaction('PLAYER_GOLDEN_COMBO', {
        currentStage: 'STAGE_4_RESPECT',
      });
      assert.equal(reaction.expression, 'surprise_golden');
      assert.equal(reaction.dialogue, YOYO_SIGNATURE_QUOTES.goldenSurprise);
      assert.equal(reaction.intensity, 'MAX');
    });

    it('Test E: Challenge transitions to Rival — subsequent COACH_TRANSITION moves to STAGE_6_RIVAL', () => {
      const reaction = resolveYoyoReaction('COACH_TRANSITION', {
        currentStage: 'STAGE_5_CHALLENGE',
      });
      assert.equal(reaction.relationshipStage, 'STAGE_6_RIVAL');
      assert.equal(reaction.expression, 'challenge');
      assert.equal(reaction.dialogue, YOYO_SIGNATURE_QUOTES.rivalTransition);
    });

    it('does NOT demote stage backwards when player executes a basic capture during Rival phase', () => {
      const reaction = resolveYoyoReaction('PLAYER_CAPTURE', {
        currentStage: 'STAGE_6_RIVAL',
        isFreePlay: true,
      });
      assert.equal(reaction.relationshipStage, 'STAGE_6_RIVAL');
      assert.equal(reaction.silent, true);
    });
  });

  describe('Character Dialogue & Anti-Spam (Silence)', () => {
    it('uses different steal dialogue during Rival phase compared to early coaching', () => {
      const coachSteal = resolveYoyoReaction('PLAYER_STEAL', {
        currentStage: 'STAGE_2_COACH',
      });
      assert.equal(coachSteal.dialogue, YOYO_SIGNATURE_QUOTES.steal);

      const rivalSteal = resolveYoyoReaction('PLAYER_STEAL', {
        currentStage: 'STAGE_6_RIVAL',
      });
      assert.equal(rivalSteal.dialogue, YOYO_SIGNATURE_QUOTES.stealRival);
    });

    it('supports silent reaction (NO_REACTION) without unnecessary dialogue', () => {
      const reaction = resolveYoyoReaction('NO_REACTION', {
        currentStage: 'STAGE_2_COACH',
      });
      assert.equal(reaction.silent, true);
      assert.equal(reaction.intensity, 'NONE');
    });

    it('returns respectful defeat dialogue when player wins', () => {
      const reaction = resolveYoyoReaction('PLAYER_WIN');
      assert.equal(reaction.expression, 'defeat');
      assert.equal(reaction.dialogue, YOYO_SIGNATURE_QUOTES.playerWins);
      assert.equal(reaction.relationshipStage, 'STAGE_7_RIVALRY');
    });
  });

  describe('Presentation Helpers', () => {
    it('resolveLearnByPlayReaction maps phases correctly', () => {
      const stealReaction = resolveLearnByPlayReaction({
        phase: 'PHASE_6_FIRST_STEAL',
        isSuccess: true,
        hasHint: false,
        isFreePlayActive: false,
      });
      assert.equal(stealReaction.expression, 'surprise_steal');

      const freePlayReaction = resolveLearnByPlayReaction({
        phase: 'PHASE_12_FREE_PLAY',
        isSuccess: true,
        hasHint: false,
        isFreePlayActive: true,
      });
      assert.equal(freePlayReaction.relationshipStage, 'STAGE_6_RIVAL');
    });

    it('resolveTutorialCoachReaction maps feedback states', () => {
      const success = resolveTutorialCoachReaction({ status: 'SUCCESS_FEEDBACK' });
      assert.equal(success.expression, 'approval');

      const suboptimal = resolveTutorialCoachReaction({ status: 'SUBOPTIMAL_FEEDBACK' });
      assert.equal(suboptimal.expression, 'confused');
    });
  });

  describe('Character Bible Guardrails', () => {
    it('enforces exclusion of Pharaoh and ancient motifs', () => {
      assert.ok(YOYO_CANONICAL_BIBLE.hardVisualExclusions.includes('Pharaoh'));
      assert.ok(YOYO_CANONICAL_BIBLE.hardVisualExclusions.includes('Crowns'));
      assert.ok(YOYO_CANONICAL_BIBLE.hardVisualExclusions.includes('Ancient Egypt'));
    });
  });
});
