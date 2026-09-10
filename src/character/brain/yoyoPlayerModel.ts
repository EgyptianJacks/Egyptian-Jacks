import { Card, GameState, Rank } from '../../types/game';
import { calculateScores } from '../../engine/rules';
import {
  ArchetypeBelief,
  GameSituation,
  ObservedPlayerMetrics,
  PlayerArchetype,
  YoyoMemoryEntry,
} from './yoyoTypes';
import { YoyoGameReader } from './yoyoGameReader';
import { YoyoDeckKnowledge } from './yoyoDeckKnowledge';

const ALL_ARCHETYPES: PlayerArchetype[] = [
  'NOVICE',
  'EXPLORER',
  'AGGRESSIVE',
  'CAUTIOUS',
  'COLLECTOR',
  'PATIENT',
  'TACTICAL',
  'DEFENSIVE',
  'GREEDY',
  'ADAPTIVE',
  'PREDICTABLE',
  'DECEPTIVE',
  'MASTER',
];

export class YoyoPlayerModel {
  private metrics: ObservedPlayerMetrics;
  private matchMemory: YoyoMemoryEntry[] = [];
  private huntedRanks: Map<Rank, number> = new Map();
  private lastObservedActionTypes: string[] = [];
  private archetypeBeliefs: Map<PlayerArchetype, ArchetypeBelief> = new Map();

  // Delayed sacrifice tracking
  private pendingSacrifice: {
    turnNumber: number;
    card: Card;
    targetRank: Rank;
  } | null = null;

  constructor(
    initialMetrics?: Partial<ObservedPlayerMetrics>,
    initialBeliefs?: Partial<Record<PlayerArchetype, { evidence: number; contradictions: number }>>
  ) {
    this.metrics = {
      totalActions: 0,
      directCapturesCount: 0,
      stealsExecutedCount: 0,
      missedStealOpportunitiesCount: 0,
      regularSetsFormedCount: 0,
      jackSetsFormedCount: 0,
      silverCombosCount: 0,
      goldenCombosCount: 0,
      tablePlacementsCount: 0,
      safeDiscardsCount: 0,
      recklessDiscardsCount: 0,
      strategicSacrificesCount: 0,
      consecutivePredictableActions: 0,
      adaptationsCount: 0,
      averageDecisionLatencyMs: 2500,
      tempoPreference: 'DELIBERATE',
      strategicDepthScore: 0.1,
      threatAwarenessScore: 0.2,
      greedTendencyScore: 0.3,
      patienceScore: 0.2,
      riskTolerance: 0.2,
      pileProtection: 0.5,
      baitPreference: 0.1,
      denialPreference: 0.2,
      archetype: 'NOVICE',
      primaryConfidence: 0.5,
      secondaryConfidence: 0.3,
      ...initialMetrics,
    };

    // Initialize all archetype beliefs
    for (const arch of ALL_ARCHETYPES) {
      const init = initialBeliefs?.[arch];
      const ev = init?.evidence ?? 0;
      const co = init?.contradictions ?? 0;
      const conf = (ev + 0.1) / (ev + co + 2.0);
      this.archetypeBeliefs.set(arch, {
        archetype: arch,
        evidenceCount: ev,
        contradictionCount: co,
        confidence: conf,
        lastObservedTurn: 0,
        supportingReasons: [],
      });
    }

    // Default base evidence for NOVICE
    if (!initialBeliefs) {
      const novice = this.archetypeBeliefs.get('NOVICE');
      if (novice) {
        novice.evidenceCount = 0.5;
        novice.confidence = 0.25;
      }
    }
  }

  public getMetrics(): Readonly<ObservedPlayerMetrics> {
    return { ...this.metrics };
  }

  public getMatchMemory(): ReadonlyArray<YoyoMemoryEntry> {
    return [...this.matchMemory];
  }

  public getHuntedRanks(): ReadonlyMap<Rank, number> {
    return new Map(this.huntedRanks);
  }

  public getBeliefs(): ReadonlyMap<PlayerArchetype, ArchetypeBelief> {
    return new Map(this.archetypeBeliefs);
  }

  public getBelief(archetype: PlayerArchetype): ArchetypeBelief | undefined {
    return this.archetypeBeliefs.get(archetype);
  }

  public recordBeliefEvidence(archetype: PlayerArchetype, points: number, reason: string): void {
    const belief = this.archetypeBeliefs.get(archetype);
    if (!belief) return;
    belief.evidenceCount += points;
    belief.lastObservedTurn = this.metrics.totalActions;
    belief.supportingReasons.push(reason);
    if (belief.supportingReasons.length > 5) {
      belief.supportingReasons.shift();
    }
    this.updateConfidence(belief);
  }

  public recordBeliefContradiction(archetype: PlayerArchetype, points: number, reason: string): void {
    const belief = this.archetypeBeliefs.get(archetype);
    if (!belief) return;
    belief.contradictionCount += points;
    belief.lastObservedTurn = this.metrics.totalActions;
    this.updateConfidence(belief);
  }

  private updateConfidence(belief: ArchetypeBelief): void {
    const total = belief.evidenceCount + belief.contradictionCount + 1.5;
    belief.confidence = Math.max(0.05, Math.min(0.98, belief.evidenceCount / total));
  }

  public resetMatchMemory(): void {
    this.matchMemory = [];
    this.huntedRanks.clear();
    this.lastObservedActionTypes = [];
    this.pendingSacrifice = null;
    this.metrics.totalActions = 0;
    this.metrics.consecutivePredictableActions = 0;
  }

  /**
   * Evaluates and updates the player model after a PLAYER's action.
   * STRICT ACTOR INVARIANT: This must NEVER be called with CPU moves!
   */
  public observePlayerAction(
    prevGame: GameState,
    nextGame: GameState,
    playedCard: Card,
    latencyMs?: number,
    deckKnowledge?: YoyoDeckKnowledge,
    isFirstMatchScenario: boolean = false
  ): GameSituation {
    this.metrics.totalActions++;

    // Track decision latency
    if (latencyMs !== undefined && latencyMs > 0) {
      const alpha = 0.2;
      this.metrics.averageDecisionLatencyMs = Math.round(
        this.metrics.averageDecisionLatencyMs * (1 - alpha) + latencyMs * alpha
      );
      if (this.metrics.averageDecisionLatencyMs < 1200) {
        this.metrics.tempoPreference = 'FAST';
        this.recordBeliefEvidence('AGGRESSIVE', 0.5, 'سرعة فائقة في اتخاذ القرار');
      } else if (this.metrics.averageDecisionLatencyMs > 4500) {
        this.metrics.tempoPreference = 'HESITANT';
        this.recordBeliefEvidence('CAUTIOUS', 0.5, 'تفكير طويل وتريث');
      } else {
        this.metrics.tempoPreference = 'DELIBERATE';
      }
    }

    // Read situation through Game Reader with explicit 'player' actor
    const situation = YoyoGameReader.interpretSituation(
      prevGame,
      nextGame,
      playedCard,
      deckKnowledge || new YoyoDeckKnowledge(),
      this,
      'player'
    );

    const action = nextGame.actionHistory[nextGame.actionHistory.length - 1];
    const captureResult = action?.captureResult;
    const isCapture = (captureResult?.capturedCards.length ?? 0) > 0;

    // Track hunted rank
    if (isCapture) {
      const current = this.huntedRanks.get(playedCard.rank) || 0;
      this.huntedRanks.set(playedCard.rank, current + 1);
      if (current + 1 >= 2) {
        this.recordBeliefEvidence('COLLECTOR', 1.5, `تركيز متكرر على أكل رتبة ${playedCard.rank}`);
      }
    }

    // Evaluate delayed sacrifice payoff from previous turns
    if (this.pendingSacrifice) {
      if (isCapture && playedCard.rank === this.pendingSacrifice.targetRank) {
        // Sacrifice paid off! Validate TACTICAL hypothesis
        this.metrics.strategicSacrificesCount++;
        this.metrics.strategicDepthScore = Math.min(1.0, this.metrics.strategicDepthScore + 0.25);
        this.recordBeliefEvidence('TACTICAL', 2.0, 'تحقق التضحية الاستراتيجية بنجاح واقتناص المجموعة المستهدفة');
        this.recordBeliefContradiction('NOVICE', 1.5, 'إثبات تخطيط مسبق عالي المستوى');
        this.addMemory({
          dealNumber: nextGame.dealNumber,
          category: 'SACRIFICE',
          actionSummary: `نجاح التضحية السابقة: أكل كارت ${playedCard.rank} بعد بناء الطاولة`,
          strategicWeight: 5,
        });
        this.pendingSacrifice = null;
      } else if (nextGame.dealNumber !== prevGame.dealNumber || this.metrics.totalActions - this.pendingSacrifice.turnNumber > 3) {
        // Sacrifice window expired without intended payoff
        this.pendingSacrifice = null;
      }
    }

    // Process situation types into metrics & evidence
    if (situation.type === 'GOOD_STRATEGIC_SACRIFICE') {
      this.metrics.strategicSacrificesCount++;
      this.metrics.strategicDepthScore = Math.min(1.0, this.metrics.strategicDepthScore + 0.15);
      this.metrics.patienceScore = Math.min(1.0, this.metrics.patienceScore + 0.2);
      this.metrics.greedTendencyScore = Math.max(0.0, this.metrics.greedTendencyScore - 0.15);
      this.pendingSacrifice = {
        turnNumber: this.metrics.totalActions,
        card: playedCard,
        targetRank: playedCard.rank,
      };
      this.recordBeliefEvidence('TACTICAL', 1.5, `تضحية استراتيجية بكارت ${playedCard.rank}`);
      this.recordBeliefEvidence('PATIENT', 1.0, 'تفضيل الاستثمار طويل الأجل على الربح الفوري');
      this.recordBeliefContradiction('AGGRESSIVE', 1.0, 'عدم الانجراف وراء الأكل الفوري');
      this.recordBeliefContradiction('PREDICTABLE', 1.0, 'حركة غير خطية');
      this.addMemory({
        dealNumber: nextGame.dealNumber,
        category: 'SACRIFICE',
        actionSummary: `تضحية تكتيكية بكارت ${playedCard.rank} لبناء مجموعة`,
        strategicWeight: 4,
      });
    } else if (situation.type === 'POSSIBLE_SACRIFICE') {
      this.metrics.patienceScore = Math.min(1.0, this.metrics.patienceScore + 0.1);
      this.recordBeliefEvidence('PATIENT', 0.8, 'تريث واستثمار على الطاولة');
    } else if (situation.type === 'WINNING_PILE_STEAL') {
      this.metrics.stealsExecutedCount++;
      this.metrics.threatAwarenessScore = Math.min(1.0, this.metrics.threatAwarenessScore + 0.2);
      this.metrics.strategicDepthScore = Math.min(1.0, this.metrics.strategicDepthScore + 0.15);
      this.recordBeliefEvidence('TACTICAL', 1.0, 'اقتناص سرقة الكومة في التوقيت المناسب');
      this.recordBeliefEvidence('AGGRESSIVE', 0.8, 'هجوم مباشر على كومة الخصم');
      this.recordBeliefEvidence('CAUTIOUS', 0.5, 'مراقبة دقيقة لكروت القمة');
      this.addMemory({
        dealNumber: nextGame.dealNumber,
        category: 'STEAL',
        actionSummary: `سرقة كومة الخصم برتبة ${playedCard.rank}`,
        strategicWeight: 5,
      });
    } else if (situation.type === 'MISSED_STEAL') {
      this.metrics.missedStealOpportunitiesCount++;
      this.metrics.threatAwarenessScore = Math.max(0.0, this.metrics.threatAwarenessScore - 0.1);
      this.recordBeliefContradiction('TACTICAL', 1.0, 'تفويت سرقة كومة واضحة');
      this.recordBeliefEvidence('NOVICE', 1.0, 'عدم ملاحظة كارت قمة الكومة');
      this.addMemory({
        dealNumber: nextGame.dealNumber,
        category: 'MISTAKE',
        actionSummary: 'تفويت فرصة سرقة كومة واضحة',
        strategicWeight: 2,
      });
    } else if (situation.type === 'IMMEDIATE_CAPTURE' || situation.type === 'HIGH_VALUE_CAPTURE') {
      this.metrics.directCapturesCount++;
      this.metrics.threatAwarenessScore = Math.min(1.0, this.metrics.threatAwarenessScore + 0.05);
      this.recordBeliefEvidence('AGGRESSIVE', 1.0, 'أكل فوري مباشر من الطاولة');
      this.recordBeliefEvidence('GREEDY', 0.5, 'التركيز على حصد النقاط الفورية');
    }

    if (!isCapture && situation.type !== 'GOOD_STRATEGIC_SACRIFICE' && situation.type !== 'POSSIBLE_SACRIFICE') {
      this.metrics.tablePlacementsCount++;
      if (playedCard.isJack || playedCard.numericValue >= 12) {
        this.metrics.recklessDiscardsCount++;
        this.metrics.greedTendencyScore = Math.min(1.0, this.metrics.greedTendencyScore + 0.1);
        this.recordBeliefEvidence('NOVICE', 1.0, `رمي كارت عالي القيمة (${playedCard.rank}) بلا حماية`);
        this.recordBeliefContradiction('TACTICAL', 1.0, 'رمي كارت حساس');
      } else {
        this.metrics.safeDiscardsCount++;
        this.recordBeliefEvidence('CAUTIOUS', 0.8, 'تخلص آمن بكارت منخفض');
      }
    }

    // Evaluate Sets / Combos formed
    const prevScores = calculateScores(prevGame.playerWinningPile, 'player');
    const nextScores = calculateScores(nextGame.playerWinningPile, 'player');

    if (nextScores.regularSets > prevScores.regularSets) {
      this.metrics.regularSetsFormedCount += nextScores.regularSets - prevScores.regularSets;
      this.metrics.strategicDepthScore = Math.min(1.0, this.metrics.strategicDepthScore + 0.15);
      this.recordBeliefEvidence('COLLECTOR', 2.0, 'إكمال مجموعة كاملة من 4 كروت');
      this.addMemory({
        dealNumber: nextGame.dealNumber,
        category: 'SET',
        actionSummary: 'تكوين مجموعة عادية كاملة من 4 كروت',
        strategicWeight: 3,
      });
    }

    const prevJackSet = prevScores.sets.some((s) => s.isJackSet);
    const nextJackSet = nextScores.sets.some((s) => s.isJackSet);
    if (!prevJackSet && nextJackSet) {
      this.metrics.jackSetsFormedCount++;
      this.metrics.strategicDepthScore = Math.min(1.0, this.metrics.strategicDepthScore + 0.2);
      this.recordBeliefEvidence('TACTICAL', 2.5, 'تجميع الأربعة أولاد (Jack Set)');
    }

    if (nextScores.silverCombos > prevScores.silverCombos) {
      this.metrics.silverCombosCount++;
      this.metrics.strategicDepthScore = Math.min(1.0, this.metrics.strategicDepthScore + 0.25);
      this.recordBeliefEvidence('TACTICAL', 2.5, 'إكمال سيلفر كومبو');
    }

    if (nextScores.goldenCombos > prevScores.goldenCombos) {
      this.metrics.goldenCombosCount++;
      if (isFirstMatchScenario) {
        this.metrics.strategicDepthScore = Math.min(0.75, this.metrics.strategicDepthScore + 0.3);
        this.recordBeliefEvidence('TACTICAL', 2.0, 'تحقيق الجولدن كومبو في المباراة التعليمية');
      } else {
        this.metrics.strategicDepthScore = 1.0;
        this.recordBeliefEvidence('MASTER', 3.5, 'تحقيق الجولدن كومبو باستقلالية كاملة');
      }
      this.addMemory({
        dealNumber: nextGame.dealNumber,
        category: 'SET',
        actionSummary: 'تحقيق الجولدن كومبو (75 نقطة)',
        strategicWeight: 5,
      });
    }

    // Pattern tracking: Predictability vs Adaptation
    const actionKey = isCapture ? `CAPTURE_${playedCard.rank}` : `DISCARD_${playedCard.rank}`;
    if (
      this.lastObservedActionTypes.length >= 2 &&
      this.lastObservedActionTypes.every((k) => k.startsWith('CAPTURE')) &&
      isCapture
    ) {
      this.metrics.consecutivePredictableActions++;
      this.recordBeliefEvidence('PREDICTABLE', 1.0, 'نمط أكل متتالي متوقع');
      this.recordBeliefEvidence('AGGRESSIVE', 0.8, 'استمرار الهجوم على الطاولة');
    } else if (
      this.lastObservedActionTypes.length >= 2 &&
      this.lastObservedActionTypes.every((k) => k.startsWith('CAPTURE')) &&
      !isCapture
    ) {
      // Switched from aggressive captures to careful placement
      this.metrics.consecutivePredictableActions = 0;
      this.metrics.adaptationsCount++;
      this.recordBeliefEvidence('ADAPTIVE', 2.5, 'تغيير واضح في التكتيك من الأكل المباشر إلى التريث');
      this.recordBeliefContradiction('PREDICTABLE', 2.0, 'كسر النمط المتوقع');
      this.addMemory({
        dealNumber: nextGame.dealNumber,
        category: 'ADAPTATION',
        actionSummary: 'اللاعب غيّر أسلوبه من الأكل الفوري المباشر إلى التكتيك الحذر',
        strategicWeight: 4,
      });
    } else {
      this.metrics.consecutivePredictableActions = 0;
    }

    this.lastObservedActionTypes.push(actionKey);
    if (this.lastObservedActionTypes.length > 5) {
      this.lastObservedActionTypes.shift();
    }

    // Update real behavioral dimensions
    const totalDiscards = this.metrics.recklessDiscardsCount + this.metrics.safeDiscardsCount;
    this.metrics.riskTolerance = totalDiscards > 0
      ? Math.min(1.0, (this.metrics.recklessDiscardsCount * 2) / (totalDiscards + 1))
      : 0.2;

    this.metrics.baitPreference = Math.min(1.0, this.metrics.strategicSacrificesCount / 3.0);

    if (situation.type === 'DEFENSIVE_STATE' || situation.type === 'GOOD_STRATEGIC_SACRIFICE') {
      this.metrics.pileProtection = Math.min(1.0, this.metrics.pileProtection + 0.1);
    } else if (situation.type === 'WINNING_PILE_STEAL') {
      this.metrics.pileProtection = Math.min(1.0, this.metrics.pileProtection + 0.15);
    }

    if (deckKnowledge) {
      const cpuCapturedCount = deckKnowledge.getCpuCapturedRankCount(playedCard.rank);
      if (cpuCapturedCount >= 2 && !isCapture) {
        // Player placed or discarded a rank CPU was actively building, or denied it
        this.metrics.denialPreference = Math.min(1.0, this.metrics.denialPreference + 0.15);
      }
    }

    // Reclassify archetype using accumulated evidence beliefs
    this.reclassifyArchetype(isFirstMatchScenario);

    return situation;
  }

  private addMemory(entry: Omit<YoyoMemoryEntry, 'id' | 'timestamp'>): void {
    const fullEntry: YoyoMemoryEntry = {
      id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      timestamp: Date.now(),
      ...entry,
    };
    this.matchMemory.push(fullEntry);
    if (this.matchMemory.length > 15) {
      this.matchMemory.sort((a, b) => b.strategicWeight - a.strategicWeight);
      this.matchMemory = this.matchMemory.slice(0, 12);
      this.matchMemory.sort((a, b) => a.timestamp - b.timestamp);
    }
  }

  /**
   * Derives current archetype and secondary archetype based on evidence accumulation.
   * It is genuinely possible for Yoyo to change belief or be wrong!
   */
  private reclassifyArchetype(isFirstMatchScenario: boolean): void {
    // If not enough actions, baseline is NOVICE or EXPLORER
    if (this.metrics.totalActions < 2) {
      this.metrics.archetype = 'NOVICE';
      this.metrics.primaryConfidence = 0.5;
      this.metrics.secondaryArchetype = 'EXPLORER';
      this.metrics.secondaryConfidence = 0.3;
      return;
    }

    // Sort all beliefs by confidence
    const sortedBeliefs = Array.from(this.archetypeBeliefs.values())
      .filter((b) => {
        // In First Match, MASTER cannot be claimed solely by scripted guidance
        if (isFirstMatchScenario && b.archetype === 'MASTER') return false;
        return b.evidenceCount > 0;
      })
      .sort((a, b) => b.confidence - a.confidence);

    if (sortedBeliefs.length > 0) {
      const top = sortedBeliefs[0];
      this.metrics.archetype = top.archetype;
      this.metrics.primaryConfidence = top.confidence;

      if (sortedBeliefs.length > 1 && sortedBeliefs[1].confidence > 0.3) {
        this.metrics.secondaryArchetype = sortedBeliefs[1].archetype;
        this.metrics.secondaryConfidence = sortedBeliefs[1].confidence;
      } else {
        this.metrics.secondaryArchetype = undefined;
        this.metrics.secondaryConfidence = 0;
      }
    } else {
      this.metrics.archetype = 'NOVICE';
      this.metrics.primaryConfidence = 0.5;
    }
  }
}
