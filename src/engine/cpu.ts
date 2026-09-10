import { Card, CpuDifficulty, TableViewMode } from '../types/game';
import { CaptureResolution, evaluateCapture } from './rules';

export interface CpuMoveDecision {
  card: Card;
  captureResolution: CaptureResolution;
  reason: string;
}

/**
 * Calculates a move for the CPU player according to the chosen difficulty level.
 * Defaults to HARD for full tactical prowess and baseline engine compatibility.
 */
export function decideCpuMove(
  cpuHand: Card[],
  playerTable: Card[],
  cpuTable: Card[],
  playerWinningPile: Card[],
  viewMode: TableViewMode,
  difficulty: CpuDifficulty = 'HARD'
): CpuMoveDecision {
  if (cpuHand.length === 0) {
    throw new Error('CPU hand is empty');
  }

  // EASY DIFFICULTY: Casual beginner AI
  // Only focuses on immediate opponent table captures; ignores pile steals / multi-source steals.
  if (difficulty === 'EASY') {
    // Check for direct opponent table match first
    for (const card of cpuHand) {
      const res = evaluateCapture(card, cpuTable, playerTable, playerWinningPile, viewMode);
      if (res.captureResult.capturedFrom === 'OPPONENT_TABLE') {
        return {
          card,
          captureResolution: res,
          reason: 'Easy: Normal Rank Capture from Opponent Table',
        };
      }
    }

    // Otherwise discard first card in hand directly
    const chosenCard = cpuHand[0];
    const defaultRes = evaluateCapture(chosenCard, cpuTable, playerTable, playerWinningPile, viewMode);
    return {
      card: chosenCard,
      captureResolution: defaultRes,
      reason: 'Easy: Basic Discard to Table Stack',
    };
  }

  // MEDIUM DIFFICULTY: Balanced intermediate AI
  // Captures from opponent and self table; performs pile steals if available; discards lowest rank.
  if (difficulty === 'MEDIUM') {
    // Priority 1: Direct table captures
    for (const card of cpuHand) {
      const res = evaluateCapture(card, cpuTable, playerTable, playerWinningPile, viewMode);
      if (res.captureResult.capturedFrom === 'OPPONENT_TABLE') {
        return {
          card,
          captureResolution: res,
          reason: 'Medium: Rank Capture from Opponent Table',
        };
      }
    }

    for (const card of cpuHand) {
      const res = evaluateCapture(card, cpuTable, playerTable, playerWinningPile, viewMode);
      if (res.captureResult.capturedFrom === 'PLAYER_TABLE') {
        return {
          card,
          captureResolution: res,
          reason: 'Medium: Table Match from CPU Table',
        };
      }
    }

    // Priority 2: Winning pile steals
    for (const card of cpuHand) {
      const res = evaluateCapture(card, cpuTable, playerTable, playerWinningPile, viewMode);
      if (
        res.captureResult.capturedFrom === 'MULTI_SOURCE' ||
        res.captureResult.capturedFrom === 'WINNING_PILE'
      ) {
        return {
          card,
          captureResolution: res,
          reason: 'Medium: Winning Pile Steal',
        };
      }
    }

    // Priority 3: Discard lowest numeric value
    const sortedHand = [...cpuHand].sort((a, b) => a.numericValue - b.numericValue);
    const chosenCard = sortedHand[0];
    const defaultRes = evaluateCapture(chosenCard, cpuTable, playerTable, playerWinningPile, viewMode);
    return {
      card: chosenCard,
      captureResolution: defaultRes,
      reason: 'Medium: Standard Discard',
    };
  }

  // HARD DIFFICULTY (Default): Full 4-tier tactical greedy algorithm
  // Priority 1: Multi-Source Capture or Top Uniform Steal from Player's Winning Pile
  for (const card of cpuHand) {
    const res = evaluateCapture(card, cpuTable, playerTable, playerWinningPile, viewMode);
    if (
      res.captureResult.capturedFrom === 'MULTI_SOURCE' ||
      res.captureResult.capturedFrom === 'WINNING_PILE'
    ) {
      return {
        card,
        captureResolution: res,
        reason:
          res.captureResult.capturedFrom === 'MULTI_SOURCE'
            ? 'Priority 1: Multi-Source Unified Capture'
            : 'Priority 1: Top Uniform Steal from Player Winning Pile',
      };
    }
  }

  // Priority 2: Normal Capture from Opponent Table
  for (const card of cpuHand) {
    const res = evaluateCapture(card, cpuTable, playerTable, playerWinningPile, viewMode);
    if (res.captureResult.capturedFrom === 'OPPONENT_TABLE') {
      return {
        card,
        captureResolution: res,
        reason: 'Priority 2: Normal Rank Capture from Opponent Table',
      };
    }
  }

  // Priority 3: Self Table Capture
  for (const card of cpuHand) {
    const res = evaluateCapture(card, cpuTable, playerTable, playerWinningPile, viewMode);
    if (res.captureResult.capturedFrom === 'PLAYER_TABLE') {
      return {
        card,
        captureResolution: res,
        reason: 'Priority 3: Table Match from CPU Table',
      };
    }
  }

  // Priority 4: Safe card discard
  // Sort cards by safety: preserve Jacks for sets and combos, discard lowest numeric rank
  const sortedHand = [...cpuHand].sort((a, b) => {
    // Keep Jacks for high-value combos
    if (a.isJack && !b.isJack) return 1;
    if (!a.isJack && b.isJack) return -1;
    // Lower numeric value is safer to lay down
    return a.numericValue - b.numericValue;
  });

  const chosenCard = sortedHand[0];
  const defaultRes = evaluateCapture(chosenCard, cpuTable, playerTable, playerWinningPile, viewMode);

  return {
    card: chosenCard,
    captureResolution: defaultRes,
    reason: 'Priority 4: Safe Discard to Table Stack',
  };
}
