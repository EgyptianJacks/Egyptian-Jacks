import { Card, PlayerId } from './game';

export type MovementZone =
  | 'DECK'
  | 'PLAYER_HAND'
  | 'CPU_HAND'
  | 'PLAYER_TABLE'
  | 'CPU_TABLE'
  | 'PLAYER_WINNING_PILE'
  | 'CPU_WINNING_PILE';

export type MovementType =
  | 'DEAL'
  | 'PLAY_DISCARD'
  | 'CAPTURE_MATCH'
  | 'CAPTURE_STEAL';

export interface CardMotionItem {
  id: string; // Unique movement item identifier
  card: Card;
  faceDown?: boolean;
  originZone: MovementZone;
  destinationZone: MovementZone;
  originCardId?: string;
  destinationCardId?: string;
  stage: number; // 0: Strike/Approach, 1: Collect/Deliver
  durationMs: number;
  delayMs: number;
  rotationDeg?: number;
}

export interface MovementSequence {
  id: string;
  type: MovementType;
  actor: PlayerId | 'SYSTEM';
  description: string;
  items: CardMotionItem[];
  totalStages: number;
  currentStage: number;
}

export interface ZoneRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
