export type TutorialLesson = 1 | 2 | 3 | 4;

export type HintsIntensity = 'high' | 'medium' | 'low' | 'off';

export type HintLevel = 0 | 1 | 2 | 3;

export type TutorialRuntimeStatus =
  | 'IDLE'
  | 'INTRO'
  | 'AWAITING_ACTION'
  | 'ACTION_RESOLVED'
  | 'SUCCESS_FEEDBACK'
  | 'SUBOPTIMAL_FEEDBACK'
  | 'LESSON_COMPLETE';

export interface TutorialHint {
  level: HintLevel;
  title: string;
  message: string;
  suggestedCardRank?: string;
  highlightTarget?: 'PLAYER_HAND' | 'PLAYER_TABLE' | 'OPPONENT_TABLE' | 'WINNING_PILE';
}

export interface TutorialRuntimeState {
  status: TutorialRuntimeStatus;
  lesson: TutorialLesson;
  stepNumber: number;
  setupId: string;
  seed: number;
  lessonTitle: string;
  targetConcept: string;
  objective: string;
  prompt: string;
  hintLevel: HintLevel;
  currentHint: TutorialHint | null;
  attempts: number;
  lastPlayedCardId: string | null;
  feedbackTitle: string | null;
  feedbackMessage: string | null;
  isSuccess: boolean;
  canReplay: boolean;
}

export interface TutorialSessionState {
  isTutorial: boolean;
  currentLesson: TutorialLesson | null;
  lessonStep: number;
  completedLessons: TutorialLesson[];
  forcedSetupId: string | null;
  hintsEnabled: boolean;
  hintsIntensity: HintsIntensity;
  showSimplifiedScoring: boolean;
  tutorialFinished: boolean;
}

/**
 * Learn by Playing (تعلم أثناء اللعب)
 * The progressive, match-embedded coaching journey
 */
export type LearnByPlayPhase =
  | 'PHASE_0_WELCOME'
  | 'PHASE_1_FIRST_TURN'
  | 'PHASE_2_DISCOVER_MATCH'
  | 'PHASE_3_FIRST_CAPTURE'
  | 'PHASE_4_OWN_TABLE'
  | 'PHASE_5_WINNING_PILE'
  | 'PHASE_6_FIRST_STEAL'
  | 'PHASE_7_WHY_COLLECT'
  | 'PHASE_8_REGULAR_SET'
  | 'PHASE_9_JACKS_REVEAL'
  | 'PHASE_10_COMBOS_REVEAL'
  | 'PHASE_11_DECISION_DILEMMA'
  | 'PHASE_12_FREE_PLAY'
  | 'PHASE_COMPLETED';

export interface LearnByPlayMilestone {
  id: string;
  title: string;
  description: string;
  achieved: boolean;
  category: 'CAPTURE' | 'TABLE' | 'STEAL' | 'SET' | 'JACKS' | 'COMBOS' | 'DECISION' | 'MASTERY';
}

export interface LearnByPlayState {
  phase: LearnByPlayPhase;
  phaseIndex: number;
  totalPhases: number;
  title: string;
  concept: string;
  coachMessage: string;
  actionCallout: string;
  hintLevel: HintLevel;
  currentHint: TutorialHint | null;
  targetCardRank?: string;
  highlightZone?: 'PLAYER_HAND' | 'PLAYER_TABLE' | 'OPPONENT_TABLE' | 'WINNING_PILE';
  decisionOptions?: {
    choiceA: { label: string; description: string; cardRank: string };
    choiceB: { label: string; description: string; cardRank: string };
  };
  feedbackTitle: string | null;
  feedbackMessage: string | null;
  isSuccess: boolean;
  milestones: LearnByPlayMilestone[];
  isAwaitingPlayerAction: boolean;
  canAdvanceNext: boolean;
  isFreePlayActive: boolean;
  hasSeenSteal: boolean;
  hasSeenSet: boolean;
  hasSeenJack: boolean;
  hasSeenCombos: boolean;
  branchChoiceTaken?: 'CAPTURE' | 'SACRIFICE';
  observableConsequence?: string;
  liveScoringProof?: string;
}

