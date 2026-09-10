import { Card, GameState, Rank } from '../../types/game';
import { calculateScores, evaluateCapture } from '../../engine/rules';
import { YoyoDeckKnowledge } from './yoyoDeckKnowledge';
import { YoyoPlayerModel } from './yoyoPlayerModel';
import { GameSituation, SituationType } from './yoyoTypes';

export class YoyoGameReader {
  /**
   * Interprets the game situation from the last action without guessing or fabricating.
   * Produces situation type, evidence, and confidence score.
   */
  public static interpretSituation(
    prevGame: GameState,
    nextGame: GameState,
    playedCard: Card,
    deckKnowledge: YoyoDeckKnowledge,
    playerModel?: YoyoPlayerModel,
    explicitActor?: 'player' | 'cpu'
  ): GameSituation {
    const action = nextGame.actionHistory[nextGame.actionHistory.length - 1];
    // EXPLICIT ACTOR FIRST: Canonical orchestration passes explicit actor.
    // Compatibility fallback only if explicitActor and action.actor are absent.
    const isPlayer = explicitActor !== undefined
      ? explicitActor === 'player'
      : (action?.actor !== undefined ? action.actor === 'player' : nextGame.activeTurn === 'cpu');
    const captureResult = action?.captureResult;
    const capturedCards = captureResult?.capturedCards ?? [];
    const isCapture = capturedCards.length > 0;

    const evidence: string[] = [];
    let situationType: SituationType = 'ROUTINE_PLAY';
    let confidence = 0.5;
    let immediateValue = capturedCards.length;
    let potentialFutureValue = 0;

    // Check for Golden / Silver milestones
    const prevPlayerScores = calculateScores(prevGame.playerWinningPile, 'player');
    const nextPlayerScores = calculateScores(nextGame.playerWinningPile, 'player');

    if (nextPlayerScores.goldenCombos > prevPlayerScores.goldenCombos) {
      return {
        type: 'GOLDEN_THREAT',
        confidence: 1.0,
        evidence: [
          'Player completed Golden Combo (75 points)',
          '4 Jacks + 4 Sets assembled perfectly in winning pile',
        ],
        immediateValueGained: 75,
        potentialFutureValue: 0,
        rankInvolved: playedCard.rank,
        isPlayerMove: isPlayer,
      };
    }

    if (nextPlayerScores.silverCombos > prevPlayerScores.silverCombos) {
      return {
        type: 'SILVER_THREAT',
        confidence: 0.95,
        evidence: [
          'Player completed Silver Combo (60 points)',
          '4 Jacks + 1 Set assembled in winning pile',
        ],
        immediateValueGained: 60,
        potentialFutureValue: 15, // Golden potential
        rankInvolved: playedCard.rank,
        isPlayerMove: isPlayer,
      };
    }

    // Check for Winning Pile Steal
    const isSteal =
      captureResult?.isTopUniformCapture &&
      (captureResult?.sources?.includes('WINNING_PILE') ||
        captureResult?.capturedFrom === 'WINNING_PILE' ||
        captureResult?.capturedFrom === 'MULTI_SOURCE');

    if (isSteal) {
      evidence.push(`Steal executed using ${playedCard.rank}${playedCard.suit}`);
      evidence.push(`Captured top uniform stack of size ${capturedCards.length}`);
      return {
        type: 'WINNING_PILE_STEAL',
        confidence: 0.95,
        evidence,
        immediateValueGained: capturedCards.length * 2,
        potentialFutureValue: 10,
        rankInvolved: playedCard.rank,
        isPlayerMove: isPlayer,
      };
    }

    // Check for Missed Steal
    const opponentPile = isPlayer ? prevGame.cpuWinningPile : prevGame.playerWinningPile;
    const topOpponentCard =
      opponentPile.length > 0 ? opponentPile[opponentPile.length - 1] : null;

    if (isPlayer && topOpponentCard && !isCapture) {
      const hadMatchingRank = prevGame.playerHand.some(
        (c) => c.rank === topOpponentCard.rank
      );
      if (hadMatchingRank) {
        evidence.push(
          `Top of opponent winning pile was rank ${topOpponentCard.rank}`
        );
        evidence.push(
          `Player held matching rank in hand but played ${playedCard.rank}${playedCard.suit} instead`
        );
        return {
          type: 'MISSED_STEAL',
          confidence: 0.9,
          evidence,
          immediateValueGained: 0,
          potentialFutureValue: 0,
          rankInvolved: topOpponentCard.rank,
          isPlayerMove: isPlayer,
        };
      }
    }

    // Check for Strategic Sacrifice vs Missed Capture
    // Was a direct capture available that the player intentionally declined?
    if (isPlayer && !isCapture) {
      let availableCaptures = 0;
      let highestCapturableRank: Rank | null = null;
      for (const handCard of prevGame.playerHand) {
        const evalRes = evaluateCapture(
          handCard,
          prevGame.table.playerTable,
          prevGame.table.opponentTable,
          prevGame.playerWinningPile,
          prevGame.table.viewMode
        );
        if (evalRes.captureResult.capturedCards.length > 0) {
          availableCaptures++;
          highestCapturableRank = handCard.rank;
        }
      }

      if (availableCaptures > 0) {
        // Player declined an immediate capture. Now analyze why:
        // Did they place a card on their own table that sets up a 3rd/4th card of a rank?
        const currentCountInPile = deckKnowledge.getPlayerCapturedRankCount(
          playedCard.rank
        );
        const countOnTable = prevGame.table.playerTable.filter(
          (c) => c.rank === playedCard.rank
        ).length;
        const totalProgress = currentCountInPile + countOnTable + 1;

        if (totalProgress >= 3 || playedCard.isJack) {
          evidence.push(
            `Immediate capture of rank ${highestCapturableRank} was available but declined`
          );
          evidence.push(
            `Placed ${playedCard.rank}${playedCard.suit} on player table to advance toward set of 4 (progress: ${totalProgress}/4)`
          );
          evidence.push('Table structure preserved for higher-value future harvest');
          return {
            type: 'GOOD_STRATEGIC_SACRIFICE',
            confidence: 0.85,
            evidence,
            immediateValueGained: 0,
            potentialFutureValue: 12,
            rankInvolved: playedCard.rank,
            isPlayerMove: true,
          };
        } else if (playedCard.numericValue <= 6) {
          evidence.push(
            `Player deferred immediate capture to retain hand flexibility and safely placed low card ${playedCard.rank}`
          );
          return {
            type: 'POSSIBLE_SACRIFICE',
            confidence: 0.65,
            evidence,
            immediateValueGained: 0,
            potentialFutureValue: 4,
            rankInvolved: playedCard.rank,
            isPlayerMove: true,
          };
        } else {
          evidence.push(
            `Player missed direct capture of ${highestCapturableRank} and discarded high card ${playedCard.rank}`
          );
          return {
            type: 'LIKELY_MISTAKE',
            confidence: 0.7,
            evidence,
            immediateValueGained: 0,
            potentialFutureValue: 0,
            rankInvolved: playedCard.rank,
            isPlayerMove: true,
          };
        }
      }
    }

    // Check for Multi-Source Capture
    if (captureResult && captureResult.sources.length > 1) {
      evidence.push(
        `Multi-source capture across: ${captureResult.sources.join(', ')}`
      );
      evidence.push(`Captured total of ${capturedCards.length} cards in single play`);
      return {
        type: 'MULTI_SOURCE_CAPTURE',
        confidence: 0.9,
        evidence,
        immediateValueGained: capturedCards.length,
        potentialFutureValue: 5,
        rankInvolved: playedCard.rank,
        isPlayerMove: isPlayer,
      };
    }

    // Check for High Value Capture or Regular Capture
    if (isCapture) {
      const containsJack = capturedCards.some((c) => c.isJack);
      if (containsJack || capturedCards.length >= 3) {
        evidence.push(
          containsJack
            ? `High value capture containing Jack (${playedCard.rank})`
            : `Substantial capture of ${capturedCards.length} cards`
        );
        return {
          type: 'HIGH_VALUE_CAPTURE',
          confidence: 0.88,
          evidence,
          immediateValueGained: containsJack ? 5 : capturedCards.length,
          potentialFutureValue: 4,
          rankInvolved: playedCard.rank,
          isPlayerMove: isPlayer,
        };
      }

      evidence.push(`Standard capture of ${capturedCards.length} cards of rank ${playedCard.rank}`);
      return {
        type: 'IMMEDIATE_CAPTURE',
        confidence: 0.8,
        evidence,
        immediateValueGained: capturedCards.length,
        potentialFutureValue: 2,
        rankInvolved: playedCard.rank,
        isPlayerMove: isPlayer,
      };
    }

    // Routine placement on table
    evidence.push(`Played ${playedCard.rank}${playedCard.suit} to table stack`);
    return {
      type: 'ROUTINE_PLAY',
      confidence: 0.6,
      evidence,
      immediateValueGained: 0,
      potentialFutureValue: 1,
      rankInvolved: playedCard.rank,
      isPlayerMove: isPlayer,
    };
  }
}
