import { Card, CpuDifficulty, GameAction, GameEvent, GameState, ScoreBreakdown } from '../types/game';
import { evaluateCapture } from '../engine/rules';
import { playPlayerCard, checkReplenishOrEnd } from '../engine/gameEngine';
import { YoyoBrain } from '../character/brain/yoyoBrain';
import { YoyoBrainEvaluation, YoyoDifficultyLevel, YoyoStrategicDecision } from '../character/brain/yoyoTypes';
import { YoyoPostMatchAnalysis } from '../character/brain/yoyoMatchAnalysis';
import {
  FirstMatchState,
  GameMode,
  evaluateFirstMatchStep,
  executeFirstMatchCpuTurn,
} from '../firstMatch';
import { MatchTimelineRecorder } from '../engine/matchTimeline';
import { YoyoCoachingEngine } from '../character/brain/yoyoCoachingEngine';
import { CoachingMoment } from '../character/brain/yoyoCoachingTypes';

export interface TurnExecutionResult {
  nextState: GameState;
  yoyoEvaluation: YoyoBrainEvaluation;
  updatedFirstMatchState?: FirstMatchState;
  coachingMoment?: CoachingMoment | null;
}

export class MatchOrchestrator {
  private static instance: MatchOrchestrator;
  private yoyoBrain: YoyoBrain;
  private timelineRecorder: MatchTimelineRecorder | null = null;
  private coachingEngine: YoyoCoachingEngine;

  private constructor() {
    this.yoyoBrain = new YoyoBrain('LEVEL_2_COMPETITOR');
    this.coachingEngine = new YoyoCoachingEngine();
  }

  public static getInstance(): MatchOrchestrator {
    if (!MatchOrchestrator.instance) {
      MatchOrchestrator.instance = new MatchOrchestrator();
    }
    return MatchOrchestrator.instance;
  }

  public getBrain(): YoyoBrain {
    return this.yoyoBrain;
  }

  public getTimelineRecorder(): MatchTimelineRecorder | null {
    return this.timelineRecorder;
  }

  public getCoachingEngine(): YoyoCoachingEngine {
    return this.coachingEngine;
  }

  public getNextOrientationStep(): CoachingMoment | null {
    return this.coachingEngine.getNextOrientationStep();
  }

  /**
   * Initializes or resets Yoyo Brain and Canonical Timeline for a new match context.
   */
  public startMatch(
    gameState: GameState,
    gameMode: GameMode,
    difficulty: CpuDifficulty = 'HARD'
  ): void {
    if (gameMode === 'FIRST_MATCH') {
      this.yoyoBrain.setDifficulty('LEVEL_1_COACH');
      this.yoyoBrain.setRelationshipStage('STAGE_1_STRANGER');
    } else {
      const level = YoyoBrain.mapCpuDifficultyToYoyoLevel(difficulty);
      this.yoyoBrain.setDifficulty(level);
      // In normal match, maintain organic relationship stage without arbitrary skipping
    }
    this.yoyoBrain.startNewMatch(gameState);
    this.timelineRecorder = new MatchTimelineRecorder(gameState.matchId, gameState.seed, gameState);
    this.coachingEngine.reset();
  }

  /**
   * Executes a player move canonically, then processes it through Yoyo Brain & Timeline.
   */
  public handlePlayerMove(
    gameState: GameState,
    card: Card,
    gameMode: GameMode,
    firstMatchState?: FirstMatchState,
    latencyMs?: number
  ): TurnExecutionResult {
    const prevGame = gameState;
    const isFirstMatch = gameMode === 'FIRST_MATCH';

    // 1. Canonical Game Engine execution
    const nextState = playPlayerCard(gameState, card.id);

    // 2. Record to Canonical Timeline
    let coachingMoment: CoachingMoment | null = null;
    if (this.timelineRecorder) {
      const actionRecord = this.timelineRecorder.recordAction('player', card, prevGame, nextState);
      coachingMoment = this.coachingEngine.evaluateTurn(
        this.timelineRecorder.getTimeline(),
        actionRecord,
        this.yoyoBrain.getRelationshipStage()
      );

      // Record replenishment deal if dealt this turn
      if (nextState.dealNumber > prevGame.dealNumber) {
        this.timelineRecorder.recordReplenishDeal(
          nextState.dealNumber,
          nextState.playerHand,
          nextState.cpuHand,
          nextState.table.playerTable,
          nextState.table.opponentTable
        );
      }

      // Record round and match end if match ended this turn
      if (nextState.phase === 'MATCH_END') {
        const pScore = nextState.playerScore?.totalScore ?? 0;
        const cScore = nextState.cpuScore?.totalScore ?? 0;
        const winner = nextState.winner ?? 'DRAW';
        this.timelineRecorder.recordRoundEnd(pScore, cScore, nextState.actionHistory.length);
        this.timelineRecorder.recordMatchEnd(pScore, cScore, winner);
        if (nextState.playerScore && nextState.cpuScore) {
          this.yoyoBrain.recordMatchFinished(nextState, nextState.playerScore, nextState.cpuScore);
        }
      }
    }

    // 3. Yoyo Brain observation and situation interpretation (PLAYER MOVE ONLY)
    const yoyoEvaluation = this.yoyoBrain.observePlayerTurn(
      prevGame,
      nextState,
      card,
      latencyMs,
      isFirstMatch
    );

    // 4. First Match state evaluation if active
    let updatedFirstMatchState = firstMatchState;
    if (isFirstMatch && firstMatchState) {
      updatedFirstMatchState = evaluateFirstMatchStep(firstMatchState, prevGame, nextState, card, yoyoEvaluation);
      // Inject brain's evaluation into First Match state for unified display
      updatedFirstMatchState = {
        ...updatedFirstMatchState,
        yoyoExpression: yoyoEvaluation.expression,
        yoyoStage: yoyoEvaluation.relationshipStage,
        yoyoIntent: yoyoEvaluation.intent,
        playerArchetype: yoyoEvaluation.playerArchetype,
      };
    }

    return {
      nextState,
      yoyoEvaluation,
      updatedFirstMatchState,
      coachingMoment,
    };
  }

  /**
   * Executes a CPU move through Yoyo Brain, then resolves the canonical engine state.
   */
  public handleCpuMove(
    gameState: GameState,
    gameMode: GameMode,
    firstMatchState?: FirstMatchState,
    difficulty: CpuDifficulty = 'HARD'
  ): TurnExecutionResult {
    const prevGame = gameState;
    const isFirstMatch = gameMode === 'FIRST_MATCH';

    let nextState: GameState;
    let playedCard: Card;
    let cpuDecision: YoyoStrategicDecision | undefined = undefined;

    if (isFirstMatch && firstMatchState && !firstMatchState.isFreePlayActive && gameState.dealNumber <= 4) {
      // Guided pedagogical deals in First Match (preserving Golden Path & learning beats)
      nextState = executeFirstMatchCpuTurn(gameState, firstMatchState);
      const latestAction = nextState.actionHistory[nextState.actionHistory.length - 1];
      playedCard = gameState.cpuHand.find((c) => c.id === latestAction?.cardId) || gameState.cpuHand[0];
    } else {
      // Normal Match OR First Match Deals 5 & 6 (Free Play / Rival):
      // Decided authentically by YoyoBrain Strategic Model
      const level = isFirstMatch
        ? 'LEVEL_3_RIVAL'
        : YoyoBrain.mapCpuDifficultyToYoyoLevel(difficulty);
      this.yoyoBrain.setDifficulty(level);

      cpuDecision = this.yoyoBrain.decideCpuMove(gameState);
      playedCard = cpuDecision.card;

      const captureResolution = evaluateCapture(
        playedCard,
        gameState.table.opponentTable,
        gameState.table.playerTable,
        gameState.playerWinningPile,
        gameState.table.viewMode
      );

      const {
        captureResult,
        updatedPlayerTable: newCpuTable,
        updatedOpponentTable: newPlayerTable,
        updatedOpponentWinningPile: newPlayerWinningPile,
      } = captureResolution;

      const newCpuHand = gameState.cpuHand.filter((c) => c.id !== playedCard.id);
      const newCpuWinningPile = [...gameState.cpuWinningPile];
      if (captureResult.capturedCards.length > 0) {
        newCpuWinningPile.push(...captureResult.capturedCards);
      }

      const actionSequence = gameState.actionHistory.length + 1;
      const event: GameEvent = {
        id: `ev_cpu_${actionSequence}_${Date.now()}`,
        timestamp: Date.now(),
        actor: 'cpu',
        type: captureResult.capturedCards.length > 0 ? 'CAPTURE' : 'PLAY_CARD',
        message: `يويو: ${captureResult.description}`,
        card: playedCard,
        capturedCards: captureResult.capturedCards,
        source: captureResult.capturedFrom,
      };

      const action: GameAction = {
        sequence: actionSequence,
        actor: 'cpu',
        cardId: playedCard.id,
        timestamp: Date.now(),
        captureResult,
        resultingPhase: 'PLAYER_TURN',
      };

      const intermediateState: GameState = {
        ...gameState,
        cpuHand: newCpuHand,
        table: {
          playerTable: newPlayerTable,
          opponentTable: newCpuTable,
          viewMode: 'NORMAL_VIEW',
        },
        playerWinningPile: newPlayerWinningPile,
        cpuWinningPile: newCpuWinningPile,
        activeTurn: 'player',
        phase: 'PLAYER_TURN',
        latestEvent: event,
        eventLog: [event, ...gameState.eventLog],
        actionHistory: [...gameState.actionHistory, action],
      };

      nextState = checkReplenishOrEnd(intermediateState);
    }

    // Record CPU action to Canonical Timeline
    let coachingMoment: CoachingMoment | null = null;
    if (this.timelineRecorder) {
      const actionRecord = this.timelineRecorder.recordAction('cpu', playedCard, prevGame, nextState);
      coachingMoment = this.coachingEngine.evaluateTurn(
        this.timelineRecorder.getTimeline(),
        actionRecord,
        this.yoyoBrain.getRelationshipStage()
      );

      // Record replenishment deal if dealt this turn
      if (nextState.dealNumber > prevGame.dealNumber) {
        this.timelineRecorder.recordReplenishDeal(
          nextState.dealNumber,
          nextState.playerHand,
          nextState.cpuHand,
          nextState.table.playerTable,
          nextState.table.opponentTable
        );
      }

      // Record round and match end if match ended this turn
      if (nextState.phase === 'MATCH_END') {
        const pScore = nextState.playerScore?.totalScore ?? 0;
        const cScore = nextState.cpuScore?.totalScore ?? 0;
        const winner = nextState.winner ?? 'DRAW';
        this.timelineRecorder.recordRoundEnd(pScore, cScore, nextState.actionHistory.length);
        this.timelineRecorder.recordMatchEnd(pScore, cScore, winner);
        if (nextState.playerScore && nextState.cpuScore) {
          this.yoyoBrain.recordMatchFinished(nextState, nextState.playerScore, nextState.cpuScore);
        }
      }
    }

    // Yoyo Brain evaluates the CPU turn (YOYO SELF HISTORY ONLY - NEVER POLLUTES PLAYER MODEL)
    const yoyoEvaluation = this.yoyoBrain.observeYoyoTurn(
      prevGame,
      nextState,
      playedCard,
      cpuDecision,
      isFirstMatch
    );

    let updatedFirstMatchState = firstMatchState;
    if (isFirstMatch && firstMatchState) {
      updatedFirstMatchState = {
        ...firstMatchState,
        yoyoExpression: yoyoEvaluation.expression,
        yoyoStage: yoyoEvaluation.relationshipStage,
        yoyoIntent: yoyoEvaluation.intent,
      };
    }

    return {
      nextState,
      yoyoEvaluation,
      updatedFirstMatchState,
      coachingMoment,
    };
  }

  /**
   * Generates post-match analysis using Yoyo Brain.
   */
  public getPostMatchAnalysis(
    gameState: GameState,
    playerScore: ScoreBreakdown,
    cpuScore: ScoreBreakdown
  ): YoyoPostMatchAnalysis {
    return this.yoyoBrain.generateMatchAnalysis(gameState, playerScore, cpuScore);
  }
}
