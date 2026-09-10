import { Card, PlayerId, Rank, TableState } from '../../types/game';
import { YoyoExpression, YoyoRelationshipStage } from '../yoyo';
import { YoyoIntent } from './yoyoTypes';

/**
 * YO-YO 2.0 Canonical Coaching Architecture Contracts
 */

export type CanonicalEventType =
  | 'MATCH_STARTED'
  | 'DEAL_INITIAL'
  | 'CARD_PLAYED'
  | 'TARGET_SELECTED'
  | 'CAPTURE_EXECUTED'
  | 'STEAL_EXECUTED'
  | 'PILE_UPDATED'
  | 'WINNING_PILE_UPDATED'
  | 'SET_FORMED'
  | 'JACK_SET_FORMED'
  | 'COMBO_FORMED'
  | 'REPLENISH_DEALT'
  | 'TURN_CHANGED'
  | 'ROUND_ENDED'
  | 'MATCH_ENDED';

export type TimelineEventType = CanonicalEventType;

export interface CanonicalTimelineEvent {
  id: string;
  type: CanonicalEventType;
  sequence: number;
  timestamp: number;
  actor?: PlayerId | 'SYSTEM';
  details: Record<string, unknown>;
}

export type ComboType = 'DOUBLE_COMBO' | 'TRIBLE_COMBO' | 'IRON_COMBO' | 'SILVER_COMBO' | 'GOLDEN_COMBO';

export interface SetFormationRecord {
  rank: Rank;
  actor: PlayerId;
  isJackSet: boolean;
  points: number;
  sequence: number;
  timestamp: number;
}

export interface ComboFormationRecord {
  comboType: ComboType;
  actor: PlayerId;
  points: number;
  sequence: number;
  timestamp: number;
}

export type TacticalRelationshipType =
  | 'BEFORE'
  | 'AFTER'
  | 'SINCE'
  | 'UNTIL'
  | 'BECAUSE'
  | 'CAUSED'
  | 'INTERRUPTED'
  | 'RECOVERED'
  | 'ABANDONED'
  | 'DENIED'
  | 'RESPONDED_TO';

export interface TacticalRelationship {
  sourceActionSeq: number;
  targetActionSeq: number;
  relation: TacticalRelationshipType;
  description: string;
}

export interface BoardSnapshotSummary {
  playerHandCardIds: string[];
  cpuHandCount: number;
  playerTableCards: Card[];
  opponentTableCards: Card[];
  playerWinningPileCount: number;
  cpuWinningPileCount: number;
  playerTopWinningCard?: Card;
  cpuTopWinningCard?: Card;
}

export interface TimelineDealRecord {
  dealNumber: number;
  playerHandCards: Card[];
  cpuHandCardsKnown?: Card[];
  playerTableCards: Card[];
  opponentTableCards: Card[];
  timestamp: number;
}

export interface TimelineActionRecord {
  sequence: number;
  turnNumber: number;
  actor: PlayerId;
  cardPlayed: Card;
  targetLocation?: 'PLAYER_TABLE' | 'OPPONENT_TABLE' | 'WINNING_PILE';
  capturedCards: Card[];
  isSteal: boolean;
  isDirectCapture: boolean;
  stateBefore: BoardSnapshotSummary;
  stateAfter: BoardSnapshotSummary;
  winningPileAddedRanks: Rank[];
  setsFormedThisAction: Rank[];
  timestamp: number;
}

export interface CanonicalMatchTimeline {
  matchId: string;
  seed: number;
  initialDeal: TimelineDealRecord;
  subsequentDeals: TimelineDealRecord[];
  actions: TimelineActionRecord[];
  events: CanonicalTimelineEvent[];
  setsFormed: SetFormationRecord[];
  combosFormed: ComboFormationRecord[];
  relationships: TacticalRelationship[];
  milestones: {
    firstCaptureTurn?: number;
    firstStealTurn?: number;
    firstSetTurn?: number;
    firstComboTurn?: number;
  };
  startTime: number;
  endTime?: number;
}

export type TacticalThreadType =
  | 'SET_BUILD'
  | 'JACK_SET_BUILD'
  | 'COMBO_BUILD'
  | 'PILE_STEAL_RECOVERY'
  | 'DENIAL_DEFENSE'
  | 'MEMORY_ANCHOR';

export type TacticalThreadStatus =
  | 'ACTIVE'
  | 'BUILD_INTERRUPTED'
  | 'BUILD_RECOVERED'
  | 'COMPLETED'
  | 'ABANDONED';

export interface TacticalThread {
  id: string;
  type: TacticalThreadType;
  subject: PlayerId;
  targetRank: Rank;
  startedTurn: number;
  lastUpdatedTurn: number;
  evidenceActions: number[]; // sequence IDs of actions
  capturedRanksBySubject: number;
  capturedRanksByOpponent: number;
  status: TacticalThreadStatus;
  description: string;
}

export type DerivedTacticalMeaning =
  | 'PLAYER_BUILDING_SET'
  | 'OPPONENT_BUILDING_SET'
  | 'OPPONENT_THREAT'
  | 'MISSED_OPPORTUNITY'
  | 'MEMORY_RELEVANT'
  | 'DENIAL_OPPORTUNITY'
  | 'TACTICAL_SACRIFICE'
  | 'COMBO_SETUP'
  | 'COMBO_COMPLETION'
  | 'SET_COMPLETION'
  | 'BUILD_INTERRUPTED'
  | 'BUILD_RECOVERED'
  | 'THREAT_CREATED'
  | 'THREAT_DENIED'
  | 'HIGH_VALUE_CAPTURE'
  | 'STEAL_RECOVERY'
  | 'ROUTINE_PLAY';

export type CoachingBoardTarget =
  | 'PLAYER_LAND'
  | 'OPPONENT_LAND'
  | 'PLAYER_WINNING_PILE'
  | 'OPPONENT_WINNING_PILE'
  | 'PLAYER_TABLE'
  | 'OPPONENT_TABLE'
  | 'TABLE_CENTER'
  | 'PLAYER_HAND'
  | 'SPECIFIC_CARD';

export type CoachingPresentationLevel =
  | 'LEVEL_0_SILENT'
  | 'LEVEL_1_BOARD_HIGHLIGHT'  // Simple spotlight / board highlight ("بص هنا")
  | 'LEVEL_2_SPEECH_BUBBLE'    // Short contextual toast / bubble next to evidence
  | 'LEVEL_3_TEACHING_CARD'    // Meaningful concept card with visible board backdrop
  | 'LEVEL_4_INTERACTIVE_MOMENT'; // Choice / decision moment ("هتاكل دي ولا تستنى؟")

export type YoyoAnimationIntent =
  | 'NOTICE'
  | 'POINT'
  | 'LEAN_IN'
  | 'THINK'
  | 'SURPRISE'
  | 'CELEBRATE'
  | 'TEASE'
  | 'WARNING'
  | 'CELEBRATE_RECOVERY'
  | 'RIVAL_CHALLENGE'
  | 'SILENT_OBSERVE';

export interface CoachingEvidenceItem {
  turnNumber: number;
  actor: PlayerId;
  actionSummary: string;
  rank?: Rank;
  cardId?: string;
  targetZone: CoachingBoardTarget;
}

export interface CoachingMoment {
  id: string;
  timestamp: number;
  turnNumber: number;
  triggerMeaning: DerivedTacticalMeaning;
  actor: PlayerId;
  intent: YoyoIntent;
  conceptTitle: string;
  dialogue: string;
  expression: YoyoExpression;
  animation?: YoyoAnimationIntent;
  relationshipStage: YoyoRelationshipStage;
  presentationLevel: CoachingPresentationLevel;
  primaryTarget: CoachingBoardTarget;
  secondaryTarget?: CoachingBoardTarget;
  highlightedCardIds: string[];
  highlightedRanks: Rank[];
  evidence: CoachingEvidenceItem[];
  historicalTurnReferences: number[];
  threadId?: string;
  confidence: number;
  priority: number; // 1 to 10
  isFirstOrientation?: boolean;
}

export interface RepetitionTracker {
  setsExplainedCount: number;
  stealsExplainedCount: number;
  combosExplainedCount: number;
  capturesExplainedCount: number;
  successfulPlayerSetsCount: number;
  successfulPlayerStealsCount: number;
  successfulPlayerCombosCount: number;
  boardOrientationCompleted: boolean;
  conceptCooldowns: Record<string, number>; // conceptKey -> lastTurnSeen
}

export type YoyoTelemetryEventType =
  | 'YOYO_MOMENT_CREATED'
  | 'YOYO_MOMENT_SHOWN'
  | 'YOYO_MOMENT_DISMISSED'
  | 'YOYO_MOMENT_SKIPPED'
  | 'YOYO_BOARD_TARGET_SHOWN'
  | 'YOYO_INTERACTION_STARTED'
  | 'YOYO_INTERACTION_COMPLETED'
  | 'YOYO_DIALOGUE_SHOWN'
  | 'YOYO_SILENT_DECISION';

export interface YoyoTelemetryPayload {
  event: YoyoTelemetryEventType;
  timestamp: number;
  momentId?: string;
  concept?: string;
  target?: CoachingBoardTarget;
  details?: Record<string, unknown>;
}
