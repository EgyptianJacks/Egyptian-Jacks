import { Card, CpuDifficulty, GameState, Rank, Suit } from '../../types/game';
import { YoyoExpression, YoyoRelationshipStage } from '../yoyo';

export type YoyoDifficultyLevel =
  | 'LEVEL_0_FRIENDLY'
  | 'LEVEL_1_COACH'
  | 'LEVEL_2_COMPETITOR'
  | 'LEVEL_3_RIVAL'
  | 'LEVEL_4_MASTER';

export type YoyoCardLocation =
  | 'IN_DECK_UNSEEN'
  | 'REVEALED_BOTTOM_ANCHOR'
  | 'PLAYER_HAND_INFERRED'
  | 'CPU_HAND_KNOWN'
  | 'PLAYER_TABLE_VISIBLE'
  | 'CPU_TABLE_VISIBLE'
  | 'PLAYER_PILE_CAPTURED'
  | 'CPU_PILE_CAPTURED'
  | 'TABLE_DISCARDED';

export type PlayerArchetype =
  | 'NOVICE'
  | 'EXPLORER'
  | 'AGGRESSIVE'
  | 'CAUTIOUS'
  | 'COLLECTOR'
  | 'PATIENT'
  | 'TACTICAL'
  | 'DEFENSIVE'
  | 'GREEDY'
  | 'ADAPTIVE'
  | 'PREDICTABLE'
  | 'DECEPTIVE'
  | 'MASTER';

export interface ObservedPlayerMetrics {
  totalActions: number;
  directCapturesCount: number;
  stealsExecutedCount: number;
  missedStealOpportunitiesCount: number;
  regularSetsFormedCount: number;
  jackSetsFormedCount: number;
  silverCombosCount: number;
  goldenCombosCount: number;
  tablePlacementsCount: number;
  safeDiscardsCount: number;
  recklessDiscardsCount: number;
  strategicSacrificesCount: number;
  consecutivePredictableActions: number;
  adaptationsCount: number;
  averageDecisionLatencyMs: number;
  tempoPreference: 'FAST' | 'DELIBERATE' | 'HESITANT';
  strategicDepthScore: number; // 0.0 to 1.0 (future value orientation)
  threatAwarenessScore: number; // 0.0 to 1.0
  greedTendencyScore: number; // 0.0 to 1.0 (capture greed)
  patienceScore: number; // 0.0 to 1.0 (patience)
  riskTolerance: number; // 0.0 to 1.0: willingness to risk high-value discards
  pileProtection: number; // 0.0 to 1.0: attentiveness to protecting winning pile top
  baitPreference: number; // 0.0 to 1.0: propensity for tactical sacrifices/baiting
  denialPreference: number; // 0.0 to 1.0: tendency to prioritize denying opponent ranks
  archetype: PlayerArchetype;
  secondaryArchetype?: PlayerArchetype;
  primaryConfidence: number;
  secondaryConfidence: number;
}

export type SituationType =
  | 'IMMEDIATE_CAPTURE'
  | 'HIGH_VALUE_CAPTURE'
  | 'MULTI_SOURCE_CAPTURE'
  | 'WINNING_PILE_STEAL'
  | 'MISSED_STEAL'
  | 'MISSED_CAPTURE'
  | 'POTENTIAL_SET'
  | 'SET_THREAT'
  | 'JACK_THREAT'
  | 'SILVER_THREAT'
  | 'GOLDEN_THREAT'
  | 'DEFENSIVE_STATE'
  | 'DANGEROUS_EXPOSED_CARD'
  | 'FUTURE_CAPTURE_OPPORTUNITY'
  | 'GOOD_STRATEGIC_SACRIFICE'
  | 'POSSIBLE_SACRIFICE'
  | 'QUESTIONABLE_MOVE'
  | 'LIKELY_MISTAKE'
  | 'BAIT'
  | 'PREDICTABLE_MOVE'
  | 'UNUSUAL_MOVE'
  | 'PLAYER_ADAPTATION'
  | 'YOYO_ADAPTATION'
  | 'OPPONENT_THREAT'
  | 'PLAYER_THREAT'
  | 'ROUTINE_PLAY';

export interface GameSituation {
  type: SituationType;
  confidence: number; // 0.0 to 1.0
  evidence: string[];
  immediateValueGained: number;
  potentialFutureValue: number;
  rankInvolved?: Rank;
  isPlayerMove: boolean;
}

export type YoyoIntent =
  | 'WELCOME'
  | 'OBSERVE'
  | 'INVITE'
  | 'QUESTION'
  | 'NUDGE'
  | 'ENCOURAGE'
  | 'TEACH'
  | 'TEACHING_MOMENT'
  | 'RECOGNIZE'
  | 'STRATEGIC_RECOGNITION'
  | 'TEASE'
  | 'PLAYFUL_TEASE'
  | 'WARN'
  | 'SURPRISE'
  | 'RESPECT'
  | 'CHALLENGE'
  | 'PRESSURE'
  | 'CELEBRATE'
  | 'CONSOLATION'
  | 'RIVALRY'
  | 'VICTORY'
  | 'DEFEAT'
  | 'REMATCH'
  | 'SUSPICION'
  | 'MISTAKE_NOTICE'
  | 'ADAPTATION_NOTICE'
  | 'PLAYER_OUTPLAYED_YOYO'
  | 'YOYO_OUTPLAYED_PLAYER'
  | 'SET_DISCOVERY'
  | 'COMBO_DISCOVERY'
  | 'GOLDEN_DISCOVERY'
  | 'RIVAL_TRANSITION'
  | 'DRAW';

export interface YoyoDialogueLine {
  text: string;
  intent: YoyoIntent;
  expression: YoyoExpression;
  intensity: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'MAX';
  silent?: boolean;
  priority: number; // 0 (mundane) to 10 (crucial milestone)
}

export interface YoyoMemoryEntry {
  id: string;
  timestamp: number;
  dealNumber: number;
  actionSummary: string;
  category: 'CAPTURE' | 'STEAL' | 'SACRIFICE' | 'SET' | 'ADAPTATION' | 'THREAT' | 'MISTAKE';
  strategicWeight: number; // 1 to 5
  observedPattern?: string;
  lessonKey?: string;
}

export interface YoyoStrategicDecision {
  card: Card;
  targetCardRank?: string;
  reasoning: string;
  intent: YoyoIntent;
  projectedOpportunity?: string;
  evaluationScore?: number;
  counterfactualCandidate?: CounterfactualCandidate;
  hypothesisId?: string;
  drivenByHypothesis?: boolean;
}

export type ActorType = 'player' | 'cpu';

export interface ArchetypeBelief {
  archetype: PlayerArchetype;
  evidenceCount: number;
  contradictionCount: number;
  confidence: number; // 0.0 to 1.0
  lastObservedTurn: number;
  supportingReasons: string[];
}

export type HypothesisStatus = 'CREATED' | 'TESTING' | 'VALIDATED' | 'DISPROVED' | 'INACTIVE';

export interface StrategicHypothesis {
  id: string;
  hypothesis: string;
  targetRank?: Rank;
  counterStrategy:
    | 'DEFENSIVE_HOLD'
    | 'DENY_RANK'
    | 'PUNISH_GREED'
    | 'EXPLOIT_PREDICTABLE'
    | 'BAIT_TRAP'
    | 'TEMPO_PRESSURE'
    | 'NEUTRAL';
  status: HypothesisStatus;
  confidence: number; // 0.0 to 1.0
  evidenceCount: number;
  contradictionCount: number;
  turnsActive: number;
  lastEvaluatedTurn: number;
  description: string;
}

export interface YoyoSelfAction {
  turnNumber: number;
  cardPlayed: Card;
  targetRank?: string;
  intent: YoyoIntent;
  reasoning: string;
  expectedPlayerResponse?: string;
  wasCounterSuccessful?: boolean;
  hypothesisId?: string;
  drivenByHypothesis?: boolean;
}

export interface CounterfactualCandidate {
  card: Card;
  immediateGain: number;
  expectedPlayerResponseRank?: Rank;
  expectedPlayerResponseScore: number;
  netScore: number;
  tacticalAdvantage: string;
}

export interface LearnedPlayerProfile {
  version: number;
  totalMatchesTracked: number;
  aggregateArchetypeBeliefs: Record<string, { evidence: number; contradictions: number }>;
  dominantArchetype: PlayerArchetype;
  recurringHuntedRanks: Record<string, number>;
  avgGreedScore: number;
  avgPatienceScore: number;
  avgStrategicDepth: number;
  totalAdaptationsDetected: number;
  lastUpdated: number;
}

export interface YoyoBrainEvaluation {
  eventId?: string;
  actor: 'player' | 'cpu';
  expression: YoyoExpression;
  dialogue?: string | null;
  intent: YoyoIntent;
  strategicIntent?: YoyoIntent;
  relationshipStage: YoyoRelationshipStage;
  relationshipSignal?: string;
  hypothesisId?: string;
  silent: boolean;
  intensity: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'MAX';
  suggestedAction?: string;
  playerArchetype: PlayerArchetype;
  secondaryArchetype?: PlayerArchetype;
  confidence: number;
  situation?: GameSituation;
  priority: number;
  boardHighlightZone?: 'PLAYER_HAND' | 'PLAYER_TABLE' | 'OPPONENT_TABLE' | 'WINNING_PILE';
  targetCardRank?: string;
}

/**
 * Canonical Runtime Decision contract for Yoyo across all presentation boundaries.
 */
export type YoyoRuntimeDecision = YoyoBrainEvaluation;

export interface YoyoEpisodicMemory {
  matchId?: string;
  turnNumber?: number;
  lastMatchTurningPoint?: string;
  lastObservedPlayerBehavior?: string;
  lastSuccessfulYoyoCounter?: string;
  lastSurprise?: string;
  lastRelationshipSignal?: string;
}
