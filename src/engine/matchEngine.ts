import { GameState, MatchFormat, MatchState, PlayerId, RoundScoreRecord } from '../types/game';
import { createInitialGame } from './gameEngine';

export function getTargetWins(format: MatchFormat): number {
  switch (format) {
    case 'BEST_OF_5':
      return 3;
    case 'BEST_OF_3':
      return 2;
    case 'SINGLE':
    default:
      return 1;
  }
}

export function getNextRoundStarter(currentStarter: PlayerId): PlayerId {
  return currentStarter === 'player' ? 'cpu' : 'player';
}

export interface MatchEngineResult {
  match: MatchState;
  round: GameState;
}

/**
 * Initializes a new match with the chosen format and starting player.
 */
export function createInitialMatch(
  format: MatchFormat = 'SINGLE',
  seed: number = Date.now(),
  matchStarter: PlayerId = 'player',
  manualCutIndex?: number
): MatchEngineResult {
  const targetWins = getTargetWins(format);
  const round = createInitialGame(seed, matchStarter, manualCutIndex);

  const match: MatchState = {
    matchId: `match-${seed}`,
    format,
    targetWins,
    currentRound: 1,
    playerRoundWins: 0,
    cpuRoundWins: 0,
    roundHistory: [],
    matchStarter,
    currentRoundStarter: matchStarter,
    matchWinner: null,
    status: 'IN_ROUND',
  };

  return { match, round };
}

/**
 * Finalizes the finished round within the match lifecycle and checks for match victory.
 */
export function finalizeRoundInMatch(match: MatchState, round: GameState): MatchEngineResult {
  if (!round.playerScore || !round.cpuScore) {
    throw new Error('Cannot finalize round: scores are not calculated');
  }

  const roundWinner: PlayerId | 'DRAW' = round.winner ?? 'DRAW';
  const newPlayerWins = roundWinner === 'player' ? match.playerRoundWins + 1 : match.playerRoundWins;
  const newCpuWins = roundWinner === 'cpu' ? match.cpuRoundWins + 1 : match.cpuRoundWins;

  const roundRecord: RoundScoreRecord = {
    roundNumber: match.currentRound,
    starter: match.currentRoundStarter,
    playerScore: round.playerScore.totalScore,
    cpuScore: round.cpuScore.totalScore,
    playerBreakdown: round.playerScore,
    cpuBreakdown: round.cpuScore,
    winner: roundWinner,
    revealedLastCard: round.revealedLastCard,
    actualLastDealtCard: round.actualLastDealtCard,
  };

  const updatedHistory = [...match.roundHistory, roundRecord];

  let matchWinner: PlayerId | 'DRAW' | null = null;
  let status: 'IN_ROUND' | 'ROUND_SUMMARY' | 'MATCH_OVER' = 'ROUND_SUMMARY';

  if (newPlayerWins >= match.targetWins) {
    matchWinner = 'player';
    status = 'MATCH_OVER';
  } else if (newCpuWins >= match.targetWins) {
    matchWinner = 'cpu';
    status = 'MATCH_OVER';
  } else if (match.format === 'SINGLE') {
    matchWinner = roundWinner;
    status = 'MATCH_OVER';
  }

  const updatedMatch: MatchState = {
    ...match,
    playerRoundWins: newPlayerWins,
    cpuRoundWins: newCpuWins,
    roundHistory: updatedHistory,
    matchWinner,
    status,
  };

  return { match: updatedMatch, round };
}

/**
 * Starts the next round in the current match with rotated starter, fresh shuffle, cut, and revealed bottom card.
 */
export function startNextRoundInMatch(
  match: MatchState,
  nextSeed: number = Date.now(),
  manualCutIndex?: number
): MatchEngineResult {
  if (match.status === 'MATCH_OVER') {
    throw new Error('Cannot start next round: match is already over');
  }

  const nextRoundNumber = match.currentRound + 1;
  const nextStarter = getNextRoundStarter(match.currentRoundStarter);
  const newRound = createInitialGame(nextSeed, nextStarter, manualCutIndex);

  const updatedMatch: MatchState = {
    ...match,
    currentRound: nextRoundNumber,
    currentRoundStarter: nextStarter,
    status: 'IN_ROUND',
  };

  return { match: updatedMatch, round: newRound };
}
