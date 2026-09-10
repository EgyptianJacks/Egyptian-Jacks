export type Suit = '♠' | '♥' | '♦' | '♣';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
  numericValue: number;
  isJack: boolean;
}

export type PlayerId = 'player' | 'cpu';

export type GamePhase =
  | 'IDLE'
  | 'DEALING'
  | 'PLAYER_TURN'
  | 'CPU_TURN'
  | 'ROUND_END'
  | 'MATCH_END';

export type TableViewMode = 'INITIAL_VIEW' | 'NORMAL_VIEW';

export interface TableState {
  playerTable: Card[];
  opponentTable: Card[];
  viewMode: TableViewMode;
}

export type CaptureSource =
  | 'OPPONENT_TABLE'
  | 'PLAYER_TABLE'
  | 'WINNING_PILE'
  | 'MULTI_SOURCE'
  | 'NONE';

export interface CapturedItemOrigin {
  card: Card;
  source: 'PLAYER_TABLE' | 'OPPONENT_TABLE' | 'WINNING_PILE';
}

export interface CaptureResult {
  capturedCards: Card[];
  capturedFrom: CaptureSource;
  isTopUniformCapture: boolean;
  capturedWithOrigins?: CapturedItemOrigin[];
  sources?: ('PLAYER_TABLE' | 'OPPONENT_TABLE' | 'WINNING_PILE')[];
  description: string;
}

export interface SetDetail {
  rank: Rank;
  cardCount: number;
  isJackSet: boolean;
  isRegularSet: boolean;
  cards: Card[];
}

export interface ScoreBreakdown {
  playerId: PlayerId;
  totalScore: number;
  totalCards: number;
  cardPoints: number; // 1 pt per unconsumed regular card
  jackCount: number;
  jackPoints: number; // 3 pts per unconsumed Jack
  goldenCombos: number; // 75 pts (1 Jack Set + 2 Regular Sets)
  goldenPoints: number;
  silverCombos: number; // 60 pts (1 Jack Set + 1 Regular Set)
  silverPoints: number;
  ironCombos?: number; // 50 pts (3 Regular Sets - canonical Iron combo)
  ironPoints?: number;
  balancedCombos: number; // 50 pts (3 Regular Sets)
  balancedPoints: number;
  doubleCombos: number; // 30 pts (2 Regular Sets)
  doublePoints: number;
  tribleCombos?: number; // legacy alias
  triblePoints?: number;
  jackSets: number; // 36 pts (4 Jacks)
  jackSetPoints: number;
  regularSets: number; // 12 pts each
  regularSetPoints: number;
  sets: SetDetail[];
  remainingJacks: number;
  remainingOtherCards: number;
  log: string[];
}

export interface GameEvent {
  id: string;
  timestamp: number;
  actor: PlayerId | 'SYSTEM';
  type: 'DEAL' | 'PLAY_CARD' | 'CAPTURE' | 'REPLENISH' | 'ROUND_END';
  message: string;
  card?: Card;
  capturedCards?: Card[];
  source?: CaptureSource;
}

export interface GameAction {
  sequence: number;
  actor: PlayerId;
  cardId: string;
  timestamp: number;
  captureResult?: CaptureResult;
  resultingPhase: GamePhase;
}

export type MatchFormat = 'SINGLE' | 'BEST_OF_3' | 'BEST_OF_5';

export interface RoundScoreRecord {
  roundNumber: number;
  starter: PlayerId;
  playerScore: number;
  cpuScore: number;
  playerBreakdown: ScoreBreakdown;
  cpuBreakdown: ScoreBreakdown;
  winner: PlayerId | 'DRAW';
  revealedLastCard: Card;
  actualLastDealtCard?: Card;
}

export interface MatchState {
  matchId: string;
  format: MatchFormat;
  targetWins: number;
  currentRound: number;
  playerRoundWins: number;
  cpuRoundWins: number;
  roundHistory: RoundScoreRecord[];
  matchStarter: PlayerId;
  currentRoundStarter: PlayerId;
  matchWinner: PlayerId | 'DRAW' | null;
  status: 'IN_ROUND' | 'ROUND_SUMMARY' | 'MATCH_OVER';
}

export type CpuDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface GameState {
  matchId: string;
  seed: number;
  firstPlayer: PlayerId;
  revealedLastCard: Card;
  actualLastDealtCard?: Card;
  cutIndex?: number;
  deck: Card[];
  playerHand: Card[];
  cpuHand: Card[];
  table: TableState;
  playerWinningPile: Card[];
  cpuWinningPile: Card[];
  activeTurn: PlayerId;
  phase: GamePhase;
  roundNumber: number;
  dealNumber: number;
  latestEvent: GameEvent | null;
  eventLog: GameEvent[];
  actionHistory: GameAction[];
  playerScore: ScoreBreakdown | null;
  cpuScore: ScoreBreakdown | null;
  winner: PlayerId | 'DRAW' | null;
}
