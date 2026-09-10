import { Card, GameState, Rank, Suit } from '../types/game';
import { YoyoExpression, YoyoRelationshipStage } from '../character/yoyo';

export type GameMode = 'NORMAL' | 'FIRST_MATCH';

export type FirstMatchHintLevel = 0 | 1 | 2 | 3;

export interface FirstMatchGuidance {
  level: FirstMatchHintLevel;
  title: string;
  message: string;
  suggestedCardRank?: string;
  highlightTarget?: 'PLAYER_HAND' | 'PLAYER_TABLE' | 'OPPONENT_TABLE' | 'WINNING_PILE';
}

export type FirstMatchMilestoneId =
  | 'milestone-welcome'
  | 'milestone-first-turn'
  | 'milestone-rank-match'
  | 'milestone-first-capture'
  | 'milestone-own-table'
  | 'milestone-winning-pile'
  | 'milestone-steal'
  | 'milestone-why-collect'
  | 'milestone-regular-set'
  | 'milestone-jack-set'
  | 'milestone-silver-combo'
  | 'milestone-golden-combo'
  | 'milestone-free-play';

export interface FirstMatchMilestone {
  id: FirstMatchMilestoneId;
  title: string;
  concept: string;
  coachMessage: string;
  actionCallout: string;
  targetCardRank?: string;
  achieved: boolean;
}

export interface FirstMatchDeckEntry {
  position: number;           // 1 to 52
  canonicalId: number;        // 1 to 52
  cardRank: Rank;
  cardSuit: Suit;
  dealNumber: number;         // 1 to 6
  recipient: 'PLAYER_HAND' | 'CPU_HAND' | 'PLAYER_TABLE' | 'OPPONENT_TABLE';
  purpose: string;
  milestone?: FirstMatchMilestoneId;
  goldenPathRole: string;
  recoveryRole: string;
}

export interface FirstMatchState {
  currentMilestoneId: FirstMatchMilestoneId;
  milestones: FirstMatchMilestone[];
  title: string;
  concept: string;
  coachMessage: string;
  actionCallout: string;
  hintLevel: FirstMatchHintLevel;
  currentHint: FirstMatchGuidance | null;
  targetCardRank?: string;
  highlightZone?: 'PLAYER_HAND' | 'PLAYER_TABLE' | 'OPPONENT_TABLE' | 'WINNING_PILE';
  feedbackTitle: string | null;
  feedbackMessage: string | null;
  isSuccess: boolean;
  canAdvanceNext: boolean;
  isFreePlayActive: boolean;
  goldenAchieved: boolean;
  silverAchieved: boolean;
  jackSetAchieved: boolean;
  regularSetAchieved: boolean;
  stealAchieved: boolean;
  yoyoExpression: YoyoExpression;
  yoyoStage: YoyoRelationshipStage;
  yoyoIntent?: string;
  playerArchetype?: string;
  liveScoringProof?: string;
}
