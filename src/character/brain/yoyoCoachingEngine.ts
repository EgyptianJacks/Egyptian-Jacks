import { PlayerId, Rank } from '../../types/game';
import {
  CanonicalMatchTimeline,
  CoachingBoardTarget,
  CoachingMoment,
  CoachingPresentationLevel,
  DerivedTacticalMeaning,
  RepetitionTracker,
  TimelineActionRecord,
  YoyoAnimationIntent,
} from './yoyoCoachingTypes';
import { TacticalAnalysisResult, YoyoNarrativeAnalyzer } from './yoyoNarrativeAnalyzer';
import { YoyoExpression, YoyoRelationshipStage } from '../yoyo';
import { YoyoIntent } from './yoyoTypes';

export class YoyoCoachingEngine {
  private analyzer: YoyoNarrativeAnalyzer;
  private repetition: RepetitionTracker;
  private lastCoachingTurn: number = -999;
  private orientationStep: number = 0;

  constructor() {
    this.analyzer = new YoyoNarrativeAnalyzer();
    this.repetition = {
      setsExplainedCount: 0,
      stealsExplainedCount: 0,
      combosExplainedCount: 0,
      capturesExplainedCount: 0,
      successfulPlayerSetsCount: 0,
      successfulPlayerStealsCount: 0,
      successfulPlayerCombosCount: 0,
      boardOrientationCompleted: false,
      conceptCooldowns: {},
    };
  }

  public reset(): void {
    this.analyzer.reset();
    this.lastCoachingTurn = -999;
    this.orientationStep = 0;
    this.repetition.conceptCooldowns = {};
  }

  public getRepetitionTracker(): Readonly<RepetitionTracker> {
    return this.repetition;
  }

  /**
   * Generates step-by-step unmissable board orientation.
   * Section 16 requirement.
   */
  public getNextOrientationStep(): CoachingMoment | null {
    const steps: {
      target: CoachingBoardTarget;
      text: string;
      expression: YoyoExpression;
      intent: YoyoIntent;
      animation: YoyoAnimationIntent;
    }[] = [
      {
        target: 'TABLE_CENTER',
        text: 'استنى يا معلم... بص معايا على الطاولة ثواني.',
        expression: 'small_smile',
        intent: 'TEACH',
        animation: 'POINT',
      },
      {
        target: 'PLAYER_LAND',
        text: 'دي أرضك... هنا بتنزل كروتك المكشوفة.',
        expression: 'curious',
        intent: 'TEACH',
        animation: 'POINT',
      },
      {
        target: 'OPPONENT_LAND',
        text: 'ودي أرضي... هتشوف كروتي عليها.',
        expression: 'challenge',
        intent: 'CHALLENGE',
        animation: 'POINT',
      },
      {
        target: 'PLAYER_WINNING_PILE',
        text: 'ودي كومتك... أي كروت تكسبها بتدخل هنا.',
        expression: 'confident',
        intent: 'TEACH',
        animation: 'POINT',
      },
      {
        target: 'OPPONENT_WINNING_PILE',
        text: 'ودي كومتـي... عيني عليها، وعينك كمان لو حبيت تسرقها!',
        expression: 'small_smile',
        intent: 'CHALLENGE',
        animation: 'POINT',
      },
      {
        target: 'TABLE_CENTER',
        text: 'كده كله جاهز... دلوقتي نلعب!',
        expression: 'confident',
        intent: 'CELEBRATE',
        animation: 'CELEBRATE',
      },
    ];

    if (this.orientationStep >= steps.length) {
      this.repetition.boardOrientationCompleted = true;
      return null;
    }

    const cur = steps[this.orientationStep];
    const isLast = this.orientationStep === steps.length - 1;
    this.orientationStep += 1;

    if (isLast) {
      this.repetition.boardOrientationCompleted = true;
    }

    return {
      id: `orient_step_${this.orientationStep}`,
      timestamp: Date.now(),
      turnNumber: 0,
      triggerMeaning: 'ROUTINE_PLAY',
      actor: 'cpu',
      intent: cur.intent,
      conceptTitle: 'التعرف على الطاولة',
      dialogue: cur.text,
      expression: cur.expression,
      animation: cur.animation,
      relationshipStage: 'STAGE_1_STRANGER',
      presentationLevel: 'LEVEL_1_BOARD_HIGHLIGHT',
      primaryTarget: cur.target,
      highlightedCardIds: [],
      highlightedRanks: [],
      evidence: [],
      historicalTurnReferences: [],
      confidence: 1.0,
      priority: 10,
      isFirstOrientation: true,
    };
  }

  /**
   * Evaluates the latest action and decides if YO-YO should speak or remain silent.
   */
  public evaluateTurn(
    timeline: CanonicalMatchTimeline,
    latestAction: TimelineActionRecord,
    relationshipStage: YoyoRelationshipStage = 'STAGE_2_COACH'
  ): CoachingMoment | null {
    const analysis = this.analyzer.analyzeLatestAction(timeline, latestAction);
    const turn = latestAction.sequence;
    const actor = latestAction.actor;

    // EVIDENCE GATING (Rule: No Evidence = No Claim)
    if (analysis.confidence < 0.7) {
      return null;
    }

    // Repetition tracking updates
    if (actor === 'player') {
      if (latestAction.isSteal) this.repetition.successfulPlayerStealsCount += 1;
      if (latestAction.setsFormedThisAction.length > 0) this.repetition.successfulPlayerSetsCount += 1;
    }

    // High Priority Scenarios bypass cooldown
    const isCritical =
      analysis.primaryMeaning === 'BUILD_RECOVERED' ||
      analysis.primaryMeaning === 'COMBO_COMPLETION' ||
      analysis.primaryMeaning === 'SET_COMPLETION' ||
      analysis.primaryMeaning === 'BUILD_INTERRUPTED';

    // Attention Budget / Silence Filter:
    if (!isCritical) {
      // Cooldown check (at least 1 turn silence)
      if (turn - this.lastCoachingTurn < 2) {
        return null;
      }
      // Routine moves without meaning are silenced
      if (analysis.primaryMeaning === 'ROUTINE_PLAY') {
        return null;
      }
    }

    // 1. CANONICAL SCENARIO: 7-Narrative Set Recovery (Section 22 Killer Scenario)
    if (analysis.primaryMeaning === 'BUILD_RECOVERED' && analysis.activeThread) {
      const thread = analysis.activeThread;
      const rank = thread.targetRank;
      const firstTurn = thread.evidenceActions[0] || 1;
      const interruptTurn = thread.evidenceActions.find(
        (seq) => timeline.actions.find((a) => a.sequence === seq)?.actor === 'cpu'
      );

      this.lastCoachingTurn = turn;
      this.repetition.stealsExplainedCount += 1;
      this.repetition.conceptCooldowns[`recovery_${rank}`] = turn;

      // Temporal Reasoning: Past -> Present -> Future
      const dialogue = interruptTurn
        ? `فاكر الـ${rank} اللي كنت بتجمعهم من دور #${firstTurn}؟ الخصم حاول يقطع عليك السكة في دور #${interruptTurn}، بس لما خطفت الـ${rank} من كومته، رجعت تكمل اللي كنت بتبنيه!`
        : `فاكر الـ${rank} اللي كنت بتجمعهم؟ سحبتها من كومة الخصم ورجعت تسيطر على بناء المجموعة!`;

      return {
        id: `moment_${turn}_build_recovered`,
        timestamp: Date.now(),
        turnNumber: turn,
        triggerMeaning: 'BUILD_RECOVERED',
        actor,
        intent: 'RESPECT',
        conceptTitle: `استعادة بناء مجموعة الـ${rank}`,
        dialogue,
        expression: 'respect',
        animation: 'CELEBRATE_RECOVERY',
        relationshipStage,
        presentationLevel: 'LEVEL_3_TEACHING_CARD',
        primaryTarget: 'OPPONENT_WINNING_PILE',
        secondaryTarget: 'PLAYER_WINNING_PILE',
        highlightedCardIds: [latestAction.cardPlayed.id],
        highlightedRanks: [rank],
        evidence: analysis.evidence,
        historicalTurnReferences: thread.evidenceActions,
        threadId: thread.id,
        confidence: analysis.confidence,
        priority: 9,
      };
    }

    // 2. Combo Completion (Golden 75, Silver 60, Iron 50, Double 30)
    if (analysis.primaryMeaning === 'COMBO_COMPLETION') {
      const latestCombos = timeline.combosFormed.filter((c) => c.sequence === latestAction.sequence);
      const combo = latestCombos[0] || { comboType: 'DOUBLE_COMBO', points: 30 };
      const isPlayer = actor === 'player';
      this.lastCoachingTurn = turn;
      this.repetition.combosExplainedCount += 1;
      this.repetition.conceptCooldowns[`combo_${combo.comboType}`] = turn;

      let comboArabic = 'المجموعة المزدوجة';
      let expression: YoyoExpression = 'approval';
      let priority = 8;
      if (combo.comboType === 'GOLDEN_COMBO') {
        comboArabic = 'المجموعة الذهبية (Golden Combo)';
        expression = 'surprise_golden';
        priority = 10;
      } else if (combo.comboType === 'SILVER_COMBO') {
        comboArabic = 'المجموعة الفضية (Silver Combo)';
        expression = 'respect';
        priority = 9;
      } else if (combo.comboType === 'TRIBLE_COMBO' || combo.comboType === 'IRON_COMBO') {
        comboArabic = 'المجموعة الحديدية (Iron Combo)';
        expression = 'respect';
        priority = 8;
      }

      const dialogue = isPlayer
        ? `حوش يا معلم! حققت ${comboArabic} كاملة = +${combo.points} نقطة كاش في كومتك!`
        : `الخصم حقق ${comboArabic} (+${combo.points} نقطة)! لازم تتحرك بسرعة وتعوض في الجولات الجاية.`;

      return {
        id: `moment_${turn}_combo_${combo.comboType}`,
        timestamp: Date.now(),
        turnNumber: turn,
        triggerMeaning: 'COMBO_COMPLETION',
        actor,
        intent: isPlayer ? 'CELEBRATE' : 'PRESSURE',
        conceptTitle: `${comboArabic} (+${combo.points} نقطة)`,
        dialogue,
        expression,
        animation: isPlayer ? 'CELEBRATE' : 'RIVAL_CHALLENGE',
        relationshipStage,
        presentationLevel: 'LEVEL_3_TEACHING_CARD',
        primaryTarget: isPlayer ? 'PLAYER_WINNING_PILE' : 'OPPONENT_WINNING_PILE',
        highlightedCardIds: [latestAction.cardPlayed.id],
        highlightedRanks: latestAction.setsFormedThisAction,
        evidence: analysis.evidence,
        historicalTurnReferences: analysis.historicalTurnReferences,
        confidence: 0.98,
        priority,
      };
    }

    // 3. Set Completion (4 cards of same rank: 12 pts regular, 36 pts jacks)
    if (analysis.primaryMeaning === 'SET_COMPLETION' && analysis.targetRank) {
      const rank = analysis.targetRank;
      const isJack = rank === 'J';
      const pts = isJack ? 36 : 12;
      this.lastCoachingTurn = turn;
      const isPlayer = actor === 'player';
      this.repetition.setsExplainedCount += 1;
      this.repetition.conceptCooldowns[`set_${rank}`] = turn;

      const isRepeatedMastery = this.repetition.successfulPlayerSetsCount >= 2;
      const dialogue = isPlayer
        ? isJack
          ? `مجموعة الأولاد كاملة! (4 أولاد = 36 نقطة) دي ضربة معلم!`
          : isRepeatedMastery
          ? `مجموعة ثانية كاملة للـ${rank}! (+12 نقطة) إيدك ماشية تمام.`
          : `أكملت مجموعة الـ${rank} كاملة (4 كروت)! دي بتديك 12 نقطة صافية في الحسبة.`
        : isJack
        ? `الخصم قفل مجموعة الأولاد (+36 نقطة للخصم)! لازم تعوض في باقي الكروت.`
        : `الخصم قفل مجموعة الـ${rank}! (+12 نقطة للخصم) ركز على الطاولة.`;

      return {
        id: `moment_${turn}_set_completed`,
        timestamp: Date.now(),
        turnNumber: turn,
        triggerMeaning: 'SET_COMPLETION',
        actor,
        intent: isPlayer ? 'CELEBRATE' : 'PRESSURE',
        conceptTitle: isJack ? 'مجموعة الأولاد (+36 نقطة)' : `مجموعة ${rank} كاملة (+12 نقطة)`,
        dialogue,
        expression: isPlayer ? (isJack ? 'surprise' : 'confident') : 'challenge',
        animation: isPlayer ? 'CELEBRATE' : 'WARNING',
        relationshipStage,
        presentationLevel: 'LEVEL_2_SPEECH_BUBBLE',
        primaryTarget: isPlayer ? 'PLAYER_WINNING_PILE' : 'OPPONENT_WINNING_PILE',
        highlightedCardIds: [latestAction.cardPlayed.id],
        highlightedRanks: [rank],
        evidence: analysis.evidence,
        historicalTurnReferences: analysis.historicalTurnReferences,
        confidence: 0.95,
        priority: isJack ? 9 : 8,
      };
    }

    // 4. Build Interrupted by Opponent
    if (analysis.primaryMeaning === 'BUILD_INTERRUPTED' && analysis.targetRank) {
      const rank = analysis.targetRank;
      this.lastCoachingTurn = turn;
      this.repetition.conceptCooldowns[`interrupted_${rank}`] = turn;

      return {
        id: `moment_${turn}_build_interrupted`,
        timestamp: Date.now(),
        turnNumber: turn,
        triggerMeaning: 'BUILD_INTERRUPTED',
        actor,
        intent: 'SUSPICION',
        conceptTitle: `محاولة تعطيل مجموعة الـ${rank}`,
        dialogue: `الخصم شافك بتجمع في الـ${rank} فأكل كرت منها! عينه كانت صاحية عليك.`,
        expression: 'curious',
        animation: 'WARNING',
        relationshipStage,
        presentationLevel: 'LEVEL_2_SPEECH_BUBBLE',
        primaryTarget: 'OPPONENT_WINNING_PILE',
        highlightedCardIds: [latestAction.cardPlayed.id],
        highlightedRanks: [rank],
        evidence: analysis.evidence,
        historicalTurnReferences: analysis.historicalTurnReferences,
        confidence: 0.88,
        priority: 7,
      };
    }

    // 5. Player Building Set (2 or 3 cards)
    if (analysis.primaryMeaning === 'PLAYER_BUILDING_SET' && analysis.activeThread) {
      const rank = analysis.targetRank;
      // Repetition suppression: do not nag on every card collection if already explained
      if (this.repetition.setsExplainedCount >= 2) {
        return null;
      }
      const lastSeen = this.repetition.conceptCooldowns[`build_${rank}`] || -999;
      if (turn - lastSeen < 3) return null;

      this.lastCoachingTurn = turn;
      this.repetition.setsExplainedCount += 1;
      this.repetition.conceptCooldowns[`build_${rank}`] = turn;

      return {
        id: `moment_${turn}_building_set`,
        timestamp: Date.now(),
        turnNumber: turn,
        triggerMeaning: 'PLAYER_BUILDING_SET',
        actor,
        intent: 'OBSERVE',
        conceptTitle: `بناء مجموعة الـ${rank}`,
        dialogue: `كرت تاني من رتبة ${rank} يدخل كومتك... كمل عليهم عشان تقفل الـ4 كروت وتاخد الـ12 نقطة!`,
        expression: 'small_smile',
        animation: 'POINT',
        relationshipStage,
        presentationLevel: 'LEVEL_1_BOARD_HIGHLIGHT',
        primaryTarget: 'PLAYER_WINNING_PILE',
        highlightedCardIds: [latestAction.cardPlayed.id],
        highlightedRanks: rank ? [rank] : [],
        evidence: analysis.evidence,
        historicalTurnReferences: analysis.historicalTurnReferences,
        confidence: 0.85,
        priority: 5,
      };
    }

    // 6. Steal Execution (Individual)
    if (analysis.primaryMeaning === 'STEAL_RECOVERY') {
      const rank = analysis.targetRank;
      // Repetition suppression
      if (this.repetition.successfulPlayerStealsCount >= 3) {
        return null;
      }
      this.lastCoachingTurn = turn;
      this.repetition.stealsExplainedCount += 1;

      const isPlayer = actor === 'player';
      const dialogue = isPlayer
        ? `سرقت الكومة برتبة ${rank}! شفت إزاي مطابقة الكرت المكشوف مع يدك بتقلب الكومة كلها لصالحك؟`
        : `الخصم خطف كومتك برتبة ${rank}! خلي بالك دائماً من الكرت الأعلى المكشوف.`;

      return {
        id: `moment_${turn}_steal`,
        timestamp: Date.now(),
        turnNumber: turn,
        triggerMeaning: 'STEAL_RECOVERY',
        actor,
        intent: isPlayer ? 'SURPRISE' : 'CHALLENGE',
        conceptTitle: 'سرقة كومة الفوز!',
        dialogue,
        expression: isPlayer ? 'surprise_steal' : 'confident',
        animation: isPlayer ? 'SURPRISE' : 'THINK',
        relationshipStage,
        presentationLevel: 'LEVEL_2_SPEECH_BUBBLE',
        primaryTarget: isPlayer ? 'OPPONENT_WINNING_PILE' : 'PLAYER_WINNING_PILE',
        highlightedCardIds: [latestAction.cardPlayed.id],
        highlightedRanks: rank ? [rank] : [],
        evidence: analysis.evidence,
        historicalTurnReferences: analysis.historicalTurnReferences,
        confidence: 0.9,
        priority: 8,
      };
    }

    // 7. High Value Capture
    if (analysis.primaryMeaning === 'HIGH_VALUE_CAPTURE') {
      const count = latestAction.capturedCards.length;
      if (count < 2 && !latestAction.cardPlayed.isJack) return null;

      this.lastCoachingTurn = turn;
      const isPlayer = actor === 'player';
      const dialogue = isPlayer
        ? `أكلة تقيلة! ${count} كروت دخلوا كومتك بضربة واحدة.`
        : `الخصم سحب ${count} كروت من على الطاولة.`;

      return {
        id: `moment_${turn}_high_capture`,
        timestamp: Date.now(),
        turnNumber: turn,
        triggerMeaning: 'HIGH_VALUE_CAPTURE',
        actor,
        intent: isPlayer ? 'RECOGNIZE' : 'PRESSURE',
        conceptTitle: 'أكلة قوية من الطاولة',
        dialogue,
        expression: isPlayer ? 'approval' : 'challenge',
        animation: isPlayer ? 'NOTICE' : 'THINK',
        relationshipStage,
        presentationLevel: 'LEVEL_1_BOARD_HIGHLIGHT',
        primaryTarget: isPlayer ? 'PLAYER_TABLE' : 'OPPONENT_TABLE',
        highlightedCardIds: [latestAction.cardPlayed.id],
        highlightedRanks: analysis.targetRank ? [analysis.targetRank] : [],
        evidence: analysis.evidence,
        historicalTurnReferences: analysis.historicalTurnReferences,
        confidence: 0.8,
        priority: 6,
      };
    }

    return null;
  }
}

