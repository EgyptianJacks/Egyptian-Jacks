import { Card, CpuDifficulty, GameState, ScoreBreakdown } from '../../types/game';
import { calculateScores } from '../../engine/rules';
import { storageGet, storageSet } from '../../engine/persistence';
import { YoyoRelationshipStage } from '../yoyo';
import { YoyoDeckKnowledge } from './yoyoDeckKnowledge';
import { YoyoPlayerModel } from './yoyoPlayerModel';
import { YoyoStrategicModel } from './yoyoStrategicModel';
import { YoyoDialogueSystem } from './yoyoDialogueSystem';
import { YoyoAdaptationModel } from './yoyoAdaptationModel';
import { YoyoMatchAnalysis, YoyoPostMatchAnalysis } from './yoyoMatchAnalysis';
import { CanonicalMatchTimeline } from './yoyoCoachingTypes';
import {
  GameSituation,
  LearnedPlayerProfile,
  PlayerArchetype,
  YoyoBrainEvaluation,
  YoyoDifficultyLevel,
  YoyoEpisodicMemory,
  YoyoIntent,
  YoyoSelfAction,
  YoyoStrategicDecision,
} from './yoyoTypes';

const YOYO_PERSISTENCE_KEY = 'ej_yoyo_brain_profile';

export interface YoyoBrainProfile {
  relationshipStage: YoyoRelationshipStage;
  totalMatchesPlayed: number;
  playerWinsCount: number;
  yoyoWinsCount: number;
  highestScoringPlayerCombo: string;
  learnedProfile?: LearnedPlayerProfile;
  episodicMemory?: YoyoEpisodicMemory;
}

export class YoyoBrain {
  private deckKnowledge: YoyoDeckKnowledge;
  private playerModel: YoyoPlayerModel;
  private adaptationModel: YoyoAdaptationModel;
  private currentStage: YoyoRelationshipStage;
  private difficultyLevel: YoyoDifficultyLevel;
  private profile: YoyoBrainProfile;
  private turnsSinceLastDialogue: number = 5;
  private yoyoSelfHistory: YoyoSelfAction[] = [];
  private lastFinalizedMatchId: string | null = null;
  private cachedPostMatchAnalysis: { matchId: string; analysis: YoyoPostMatchAnalysis } | null = null;

  constructor(difficulty: YoyoDifficultyLevel = 'LEVEL_2_COMPETITOR') {
    this.deckKnowledge = new YoyoDeckKnowledge();
    this.adaptationModel = new YoyoAdaptationModel();
    this.difficultyLevel = difficulty;

    this.profile = storageGet<YoyoBrainProfile>(YOYO_PERSISTENCE_KEY, {
      relationshipStage: 'STAGE_1_STRANGER',
      totalMatchesPlayed: 0,
      playerWinsCount: 0,
      yoyoWinsCount: 0,
      highestScoringPlayerCombo: 'NONE',
    });

    this.currentStage = this.profile.relationshipStage;

    // Seed player model with persistent beliefs if available
    const initialBeliefs = this.profile.learnedProfile?.aggregateArchetypeBeliefs as
      | Record<PlayerArchetype, { evidence: number; contradictions: number }>
      | undefined;
    this.playerModel = new YoyoPlayerModel(undefined, initialBeliefs);
  }

  public getDeckKnowledge(): YoyoDeckKnowledge {
    return this.deckKnowledge;
  }

  public getPlayerModel(): YoyoPlayerModel {
    return this.playerModel;
  }

  public getAdaptationModel(): YoyoAdaptationModel {
    return this.adaptationModel;
  }

  public getStage(): YoyoRelationshipStage {
    return this.currentStage;
  }

  public getRelationshipStage(): YoyoRelationshipStage {
    return this.currentStage;
  }

  public setStage(stage: YoyoRelationshipStage): void {
    this.currentStage = stage;
    this.profile.relationshipStage = stage;
    this.persistProfile();
  }

  public setRelationshipStage(stage: YoyoRelationshipStage): void {
    this.setStage(stage);
  }

  public setDifficulty(level: YoyoDifficultyLevel): void {
    this.difficultyLevel = level;
  }

  public getDifficulty(): YoyoDifficultyLevel {
    return this.difficultyLevel;
  }

  public getYoyoSelfHistory(): ReadonlyArray<YoyoSelfAction> {
    return [...this.yoyoSelfHistory];
  }

  public getProfile(): Readonly<YoyoBrainProfile> {
    return { ...this.profile };
  }

  /**
   * Resets match-level tracking for a new game while preserving long-term learned beliefs.
   */
  public startNewMatch(gameState: GameState): void {
    this.deckKnowledge.reset();
    this.deckKnowledge.observeGameState(gameState);
    this.adaptationModel.reset();
    this.playerModel.resetMatchMemory();
    this.yoyoSelfHistory = [];
    this.turnsSinceLastDialogue = 5;
  }

  /**
   * Evaluates a turn with explicit actor verification.
   * STRICT INVARIANT: Routes explicitly to observePlayerTurn or observeYoyoTurn.
   */
  public observeTurn(
    prevGame: GameState,
    nextGame: GameState,
    playedCard: Card,
    latencyMs?: number,
    isFirstMatch: boolean = false,
    explicitActor?: 'player' | 'cpu'
  ): YoyoBrainEvaluation {
    const latestAction = nextGame.actionHistory[nextGame.actionHistory.length - 1];
    const inferredActor = explicitActor ?? latestAction?.actor ?? (nextGame.activeTurn === 'cpu' ? 'player' : 'cpu');
    if (inferredActor === 'player') {
      return this.observePlayerTurn(prevGame, nextGame, playedCard, latencyMs, isFirstMatch);
    } else {
      return this.observeYoyoTurn(prevGame, nextGame, playedCard, undefined, isFirstMatch);
    }
  }

  /**
   * Observes a PLAYER turn.
   * STRICT ACTOR INVARIANT: Only player actions are fed to the PlayerModel.
   */
  public observePlayerTurn(
    prevGame: GameState,
    nextGame: GameState,
    playedCard: Card,
    latencyMs?: number,
    isFirstMatch: boolean = false
  ): YoyoBrainEvaluation {
    // 1. Update deck knowledge from legally visible state (NO CHEATING)
    this.deckKnowledge.observeGameState(nextGame);

    // 2. Update player behavioral model (PLAYER EVIDENCE ONLY)
    const situation = this.playerModel.observePlayerAction(
      prevGame,
      nextGame,
      playedCard,
      latencyMs,
      this.deckKnowledge,
      isFirstMatch
    );

    // 3. Update tactical hypotheses testing against player's response
    this.adaptationModel.observePlayerResponse(
      prevGame,
      nextGame,
      playedCard,
      this.playerModel,
      this.yoyoSelfHistory
    );

    // 4. Update relationship stages organically based on player milestones and evidence
    const prevScores = calculateScores(prevGame.playerWinningPile, 'player');
    const nextScores = calculateScores(nextGame.playerWinningPile, 'player');
    const playerMetrics = this.playerModel.getMetrics();

    if (nextScores.goldenCombos > prevScores.goldenCombos) {
      this.currentStage = 'STAGE_5_CHALLENGE';
      this.profile.highestScoringPlayerCombo = 'GOLDEN_COMBO';
    } else if (
      this.adaptationModel.getPlayerAdaptationCount() >= 1 &&
      this.adaptationModel.getYoyoCounterAdaptationCount() >= 1
    ) {
      // Mutual adaptation detected
      if (this.currentStage === 'STAGE_5_CHALLENGE') {
        this.currentStage = 'STAGE_6_RIVAL';
      }
    } else if (
      nextScores.silverCombos > prevScores.silverCombos ||
      playerMetrics.strategicDepthScore >= 0.5
    ) {
      if (this.currentStage === 'STAGE_3_FRIEND') {
        this.currentStage = 'STAGE_4_RESPECT';
      }
    } else if (situation.type === 'WINNING_PILE_STEAL') {
      if (this.currentStage === 'STAGE_1_STRANGER' || this.currentStage === 'STAGE_2_COACH') {
        this.currentStage = 'STAGE_3_FRIEND';
      }
    } else if (nextScores.sets.length > prevScores.sets.length || playerMetrics.totalActions >= 3) {
      if (this.currentStage === 'STAGE_1_STRANGER') {
        this.currentStage = 'STAGE_2_COACH';
      }
    }

    // 5. Generate semantic dialogue line
    const dialogueLine = YoyoDialogueSystem.generateSemanticLine({
      situation,
      playerArchetype: playerMetrics.archetype,
      secondaryArchetype: playerMetrics.secondaryArchetype,
      relationshipStage: this.currentStage,
      difficultyLevel: this.difficultyLevel,
      confidence: situation.confidence,
      turnsSinceLastDialogue: this.turnsSinceLastDialogue,
      isPlayerMove: true,
      isFirstMatch,
    });

    if (dialogueLine.silent || !dialogueLine.text) {
      this.turnsSinceLastDialogue++;
    } else {
      this.turnsSinceLastDialogue = 0;
    }

    this.persistProfile();

    const latestEvent = nextGame.latestEvent;
    const activeHypotheses = this.adaptationModel.getActiveHypotheses();
    const leadingHypo = activeHypotheses[0];

    return {
      eventId: latestEvent?.id,
      actor: 'player',
      expression: dialogueLine.expression,
      dialogue: dialogueLine.text || null,
      intent: dialogueLine.intent,
      strategicIntent: dialogueLine.intent,
      relationshipStage: this.currentStage,
      relationshipSignal: this.currentStage,
      hypothesisId: leadingHypo?.id,
      silent: Boolean(dialogueLine.silent),
      intensity: dialogueLine.intensity,
      priority: dialogueLine.priority,
      playerArchetype: playerMetrics.archetype,
      secondaryArchetype: playerMetrics.secondaryArchetype,
      confidence: situation.confidence,
      situation,
      boardHighlightZone: situation.type === 'WINNING_PILE_STEAL' ? 'WINNING_PILE' : undefined,
      targetCardRank: situation.rankInvolved,
    };
  }

  /**
   * Observes a YOYO turn.
   * STRICT ACTOR INVARIANT: Yoyo actions are recorded to YOYO SELF HISTORY ONLY.
   * PlayerModel is NEVER updated with Yoyo actions.
   */
  public observeYoyoTurn(
    prevGame: GameState,
    nextGame: GameState,
    playedCard: Card,
    decision?: YoyoStrategicDecision,
    isFirstMatch: boolean = false
  ): YoyoBrainEvaluation {
    // 1. Update deck knowledge from legally visible state
    this.deckKnowledge.observeGameState(nextGame);

    // 2. Record to Yoyo Self History
    const selfAction: YoyoSelfAction = {
      turnNumber: this.yoyoSelfHistory.length + 1,
      cardPlayed: playedCard,
      targetRank: decision?.targetCardRank,
      intent: decision?.intent || 'OBSERVE',
      reasoning: decision?.reasoning || 'CPU legal move',
      hypothesisId: decision?.hypothesisId,
      drivenByHypothesis: decision?.drivenByHypothesis,
    };
    this.yoyoSelfHistory.push(selfAction);

    // 3. Notify adaptation model of Yoyo's counter attempt
    this.adaptationModel.recordYoyoAction(playedCard, selfAction);

    // 4. Create Yoyo turn situation
    const action = nextGame.actionHistory[nextGame.actionHistory.length - 1];
    const isSteal = action?.captureResult?.isTopUniformCapture ?? false;
    const isCapture = (action?.captureResult?.capturedCards.length ?? 0) > 0;

    const situation: GameSituation = {
      type: isSteal ? 'WINNING_PILE_STEAL' : isCapture ? 'IMMEDIATE_CAPTURE' : 'ROUTINE_PLAY',
      confidence: 0.8,
      evidence: [decision?.reasoning || 'CPU play'],
      immediateValueGained: (action?.captureResult?.capturedCards.length ?? 0) * 10,
      potentialFutureValue: 0,
      rankInvolved: playedCard.rank,
      isPlayerMove: false,
    };

    // 5. Generate Yoyo reaction for own move
    const playerMetrics = this.playerModel.getMetrics();
    const dialogueLine = YoyoDialogueSystem.generateSemanticLine({
      situation,
      playerArchetype: playerMetrics.archetype,
      secondaryArchetype: playerMetrics.secondaryArchetype,
      relationshipStage: this.currentStage,
      difficultyLevel: this.difficultyLevel,
      confidence: 0.8,
      turnsSinceLastDialogue: this.turnsSinceLastDialogue,
      isPlayerMove: false,
      isFirstMatch,
    });

    if (dialogueLine.silent || !dialogueLine.text) {
      this.turnsSinceLastDialogue++;
    } else {
      this.turnsSinceLastDialogue = 0;
    }

    const latestEvent = nextGame.latestEvent;

    return {
      eventId: latestEvent?.id,
      actor: 'cpu',
      expression: dialogueLine.expression,
      dialogue: dialogueLine.text || null,
      intent: dialogueLine.intent,
      strategicIntent: decision?.intent || dialogueLine.intent,
      relationshipStage: this.currentStage,
      relationshipSignal: this.currentStage,
      hypothesisId: decision?.hypothesisId,
      silent: Boolean(dialogueLine.silent),
      intensity: dialogueLine.intensity,
      priority: dialogueLine.priority,
      playerArchetype: playerMetrics.archetype,
      secondaryArchetype: playerMetrics.secondaryArchetype,
      confidence: 0.8,
      situation,
      targetCardRank: decision?.targetCardRank || playedCard.rank,
    };
  }

  /**
   * Decides Yoyo's legal card move in the game.
   */
  public decideCpuMove(gameState: GameState): YoyoStrategicDecision {
    this.deckKnowledge.observeGameState(gameState);
    return YoyoStrategicModel.decideMove(
      gameState,
      this.difficultyLevel,
      this.deckKnowledge,
      this.playerModel,
      this.adaptationModel
    );
  }

  /**
   * Finalizes match results, updates long-term learned player profile, records episodic memory, and persists profile.
   * Fully idempotent: will only finalize once per matchId.
   */
  public recordMatchFinished(
    gameStateOrPlayerScore: GameState | ScoreBreakdown,
    playerScoreOrCpuScore: ScoreBreakdown,
    cpuScoreOptional?: ScoreBreakdown
  ): void {
    let gameState: GameState | undefined;
    let playerScore: ScoreBreakdown;
    let cpuScore: ScoreBreakdown;

    if (cpuScoreOptional !== undefined) {
      gameState = gameStateOrPlayerScore as GameState;
      playerScore = playerScoreOrCpuScore;
      cpuScore = cpuScoreOptional;
    } else {
      playerScore = gameStateOrPlayerScore as ScoreBreakdown;
      cpuScore = playerScoreOrCpuScore;
    }

    const matchId = gameState?.matchId || `match_${this.profile.totalMatchesPlayed + 1}`;
    if (this.lastFinalizedMatchId === matchId) {
      // Idempotency guard: already finalized this match!
      return;
    }
    this.lastFinalizedMatchId = matchId;

    const isPlayerWin = playerScore.totalScore > cpuScore.totalScore;
    const isCpuWin = cpuScore.totalScore > playerScore.totalScore;

    this.profile.totalMatchesPlayed++;
    if (isPlayerWin) this.profile.playerWinsCount++;
    if (isCpuWin) this.profile.yoyoWinsCount++;

    // Update relationship stage on match completion if justified by history
    if (this.profile.totalMatchesPlayed >= 3 && this.currentStage === 'STAGE_6_RIVAL') {
      this.currentStage = 'STAGE_7_RIVALRY';
    } else if (isPlayerWin && (this.difficultyLevel === 'LEVEL_3_RIVAL' || this.difficultyLevel === 'LEVEL_4_MASTER')) {
      if (this.currentStage === 'STAGE_5_CHALLENGE') {
        this.currentStage = 'STAGE_6_RIVAL';
      }
    }

    // Update long term learned profile
    const metrics = this.playerModel.getMetrics();
    const currentLearned = this.profile.learnedProfile || {
      version: 1,
      totalMatchesTracked: 0,
      aggregateArchetypeBeliefs: {},
      dominantArchetype: metrics.archetype,
      recurringHuntedRanks: {},
      avgGreedScore: metrics.greedTendencyScore,
      avgPatienceScore: metrics.patienceScore,
      avgStrategicDepth: metrics.strategicDepthScore,
      totalAdaptationsDetected: 0,
      lastUpdated: Date.now(),
    };

    currentLearned.totalMatchesTracked++;
    currentLearned.dominantArchetype = metrics.archetype;
    currentLearned.avgGreedScore = Number(((currentLearned.avgGreedScore + metrics.greedTendencyScore) / 2).toFixed(2));
    currentLearned.avgPatienceScore = Number(((currentLearned.avgPatienceScore + metrics.patienceScore) / 2).toFixed(2));
    currentLearned.avgStrategicDepth = Number(((currentLearned.avgStrategicDepth + metrics.strategicDepthScore) / 2).toFixed(2));
    currentLearned.totalAdaptationsDetected += metrics.adaptationsCount;
    currentLearned.lastUpdated = Date.now();

    // Aggregate beliefs
    for (const [arch, belief] of this.playerModel.getBeliefs().entries()) {
      const prev = currentLearned.aggregateArchetypeBeliefs[arch] || { evidence: 0, contradictions: 0 };
      currentLearned.aggregateArchetypeBeliefs[arch] = {
        evidence: prev.evidence + belief.evidenceCount,
        contradictions: prev.contradictions + belief.contradictionCount,
      };
    }

    this.profile.learnedProfile = currentLearned;

    // Update episodic memory: tangible narrative anchors from this match
    const lastCounter = this.yoyoSelfHistory.slice().reverse().find((a) => a.wasCounterSuccessful);
    const turningPoint = this.extractMatchTurningPoint(gameState);

    this.profile.episodicMemory = {
      matchId,
      turnNumber: gameState?.actionHistory.length,
      lastMatchTurningPoint: turningPoint || 'حركة حاسمة في الجولة الأخيرة',
      lastObservedPlayerBehavior: `${metrics.archetype} (عمق تكتيكي: ${(metrics.strategicDepthScore * 100).toFixed(0)}%, صبر: ${(metrics.patienceScore * 100).toFixed(0)}%)`,
      lastSuccessfulYoyoCounter: lastCounter ? `رد ${lastCounter.cardPlayed.rank} (${lastCounter.intent})` : undefined,
      lastSurprise: playerScore.goldenCombos > 0 ? 'GOLDEN_COMBO' : (playerScore.silverCombos > 0 ? 'SILVER_COMBO' : undefined),
      lastRelationshipSignal: this.currentStage,
    };

    this.persistProfile();
  }

  private extractMatchTurningPoint(gameState?: GameState): string | undefined {
    if (!gameState) return undefined;
    const memory = this.playerModel.getMatchMemory();
    const highWeight = memory.slice().reverse().find((m) => m.strategicWeight >= 4);
    if (highWeight) {
      return highWeight.actionSummary;
    }
    const lastStealEvent = gameState.eventLog.find(
      (e) => e.type === 'CAPTURE' && e.source === 'WINNING_PILE'
    );
    if (lastStealEvent) {
      return `سرقة كومة بالكرت ${lastStealEvent.card?.rank || ''}`;
    }
    return undefined;
  }

  public getEpisodicMemory(): YoyoEpisodicMemory | undefined {
    return this.profile.episodicMemory;
  }

  /**
   * Generates YOYO-aware post match analysis.
   * Completely idempotent and cached per matchId. Safe to call from React useMemo.
   */
  public generateMatchAnalysis(
    gameState: GameState,
    playerScore: ScoreBreakdown,
    cpuScore: ScoreBreakdown,
    timeline?: CanonicalMatchTimeline
  ): YoyoPostMatchAnalysis {
    if (this.cachedPostMatchAnalysis && this.cachedPostMatchAnalysis.matchId === gameState.matchId) {
      return this.cachedPostMatchAnalysis.analysis;
    }
    this.recordMatchFinished(gameState, playerScore, cpuScore);
    const analysis = YoyoMatchAnalysis.analyzeMatch(gameState, playerScore, cpuScore, this, timeline);
    this.cachedPostMatchAnalysis = { matchId: gameState.matchId, analysis };
    return analysis;
  }

  private persistProfile(): void {
    this.profile.relationshipStage = this.currentStage;
    storageSet(YOYO_PERSISTENCE_KEY, this.profile);
  }

  /**
   * Converts a standard UI CpuDifficulty into YoyoDifficultyLevel.
   */
  public static mapCpuDifficultyToYoyoLevel(diff: CpuDifficulty): YoyoDifficultyLevel {
    switch (diff) {
      case 'EASY':
        return 'LEVEL_0_FRIENDLY';
      case 'MEDIUM':
        return 'LEVEL_2_COMPETITOR';
      case 'HARD':
      default:
        return 'LEVEL_3_RIVAL';
    }
  }
}
