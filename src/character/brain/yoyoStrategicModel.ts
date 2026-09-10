import { Card, GameState, Rank } from '../../types/game';
import { evaluateCapture } from '../../engine/rules';
import { YoyoDeckKnowledge } from './yoyoDeckKnowledge';
import { YoyoPlayerModel } from './yoyoPlayerModel';
import { YoyoAdaptationModel } from './yoyoAdaptationModel';
import {
  CounterfactualCandidate,
  YoyoDifficultyLevel,
  YoyoIntent,
  YoyoStrategicDecision,
} from './yoyoTypes';

const ALL_RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export class YoyoStrategicModel {
  /**
   * Decides Yoyo's legal card move based on difficulty level, deck knowledge, and player model.
   * STRICT NO-CHEAT GUARANTEE: Uses only CPU hand, visible table cards, public winning piles,
   * and revealed bottom anchor. Never accesses player hand or hidden deck order.
   */
  public static decideMove(
    gameState: GameState,
    level: YoyoDifficultyLevel,
    deckKnowledge: YoyoDeckKnowledge,
    playerModel: YoyoPlayerModel,
    adaptationModel?: YoyoAdaptationModel
  ): YoyoStrategicDecision {
    const hand = gameState.cpuHand;
    if (hand.length === 0) {
      throw new Error('CPU hand is empty');
    }

    const playerTable = gameState.table.playerTable;
    const cpuTable = gameState.table.opponentTable;
    const playerWinningPile = gameState.playerWinningPile;
    const cpuWinningPile = gameState.cpuWinningPile;
    const viewMode = gameState.table.viewMode;

    const playerMetrics = playerModel.getMetrics();
    const huntedRanks = playerModel.getHuntedRanks();

    // Update hypotheses if adaptation model is provided
    if (adaptationModel) {
      adaptationModel.updateHypotheses(playerModel, gameState);
    }

    // --- LEVEL 0: FRIENDLY ---
    if (level === 'LEVEL_0_FRIENDLY') {
      const match = hand.find((c) => playerTable.some((pt) => pt.rank === c.rank));
      if (match) {
        return {
          card: match,
          targetCardRank: match.rank,
          reasoning: 'Friendly: Table capture',
          intent: 'OBSERVE',
        };
      }
      const lowest = [...hand].sort((a, b) => a.numericValue - b.numericValue)[0];
      return {
        card: lowest,
        reasoning: 'Friendly: Safe low discard',
        intent: 'NUDGE',
      };
    }

    // --- LEVEL 1: COACH ---
    if (level === 'LEVEL_1_COACH') {
      const directMatch = hand.find((c) => playerTable.some((pt) => pt.rank === c.rank));
      if (directMatch) {
        return {
          card: directMatch,
          targetCardRank: directMatch.rank,
          reasoning: 'Coach: Table match',
          intent: 'TEACH',
        };
      }
      const sorted = [...hand].sort((a, b) => a.numericValue - b.numericValue);
      return {
        card: sorted[0],
        reasoning: 'Coach: Discarding card to table',
        intent: 'OBSERVE',
      };
    }

    // --- LEVEL 2: COMPETITOR ---
    if (level === 'LEVEL_2_COMPETITOR') {
      // Priority 1: Winning Pile Steal
      for (const card of hand) {
        const res = evaluateCapture(card, cpuTable, playerTable, playerWinningPile, viewMode);
        if (
          res.captureResult.capturedFrom === 'WINNING_PILE' ||
          res.captureResult.capturedFrom === 'MULTI_SOURCE'
        ) {
          return {
            card,
            targetCardRank: card.rank,
            reasoning: 'Competitor: Winning Pile Steal',
            intent: 'CHALLENGE',
          };
        }
      }

      // Priority 2: Opponent Table capture
      for (const card of hand) {
        const res = evaluateCapture(card, cpuTable, playerTable, playerWinningPile, viewMode);
        if (res.captureResult.capturedFrom === 'OPPONENT_TABLE') {
          return {
            card,
            targetCardRank: card.rank,
            reasoning: 'Competitor: Opponent Table capture',
            intent: 'PRESSURE',
          };
        }
      }

      // Priority 3: Discard lowest non-Jack
      const nonJacks = hand.filter((c) => !c.isJack);
      const pool = nonJacks.length > 0 ? nonJacks : hand;
      const sorted = [...pool].sort((a, b) => a.numericValue - b.numericValue);
      return {
        card: sorted[0],
        reasoning: 'Competitor: Safe discard',
        intent: 'OBSERVE',
      };
    }

    // --- LEVEL 3: RIVAL ---
    if (level === 'LEVEL_3_RIVAL') {
      // Priority 1: Steal Winning Pile
      for (const card of hand) {
        const res = evaluateCapture(card, cpuTable, playerTable, playerWinningPile, viewMode);
        if (
          res.captureResult.capturedFrom === 'WINNING_PILE' ||
          res.captureResult.capturedFrom === 'MULTI_SOURCE'
        ) {
          return {
            card,
            targetCardRank: card.rank,
            reasoning: 'Rival: Stealing player winning pile!',
            intent: 'CHALLENGE',
          };
        }
      }

      // Priority 2: Deny active hypotheses (e.g. DENY_RANK_9)
      const activeHypotheses = adaptationModel?.getActiveHypotheses() || [];
      for (const hypo of activeHypotheses) {
        if (hypo.counterStrategy === 'DENY_RANK' && hypo.targetRank) {
          const matchCard = hand.find((c) => c.rank === hypo.targetRank);
          if (matchCard) {
            const res = evaluateCapture(matchCard, cpuTable, playerTable, playerWinningPile, viewMode);
            if (res.captureResult.capturedCards.length > 0) {
              return {
                card: matchCard,
                targetCardRank: matchCard.rank,
                reasoning: `Rival: فرض استراتيجية حرمان اللاعب من رتبة ${hypo.targetRank} بناء على فرضيته المؤكدة`,
                intent: 'PRESSURE',
                hypothesisId: hypo.id,
                drivenByHypothesis: true,
              };
            }
          }
        }
      }

      // Priority 3: If player is AGGRESSIVE/GREEDY, prioritize immediate denial of valuable table cards
      if (playerMetrics.archetype === 'AGGRESSIVE' || playerMetrics.archetype === 'GREEDY') {
        const aggHypo = activeHypotheses.find(
          (h) => h.id === 'HYPO_AGGRESSIVE_CAPTURE' || h.counterStrategy === 'EXPLOIT_PREDICTABLE'
        );
        // Look for capture that cleans high-value cards
        const captureOptions = hand
          .map((card) => ({
            card,
            res: evaluateCapture(card, cpuTable, playerTable, playerWinningPile, viewMode),
          }))
          .filter((opt) => opt.res.captureResult.capturedCards.length > 0);

        if (captureOptions.length > 0) {
          // Sort by highest value captured cards
          captureOptions.sort(
            (a, b) =>
              b.res.captureResult.capturedCards.reduce((sum, c) => sum + c.numericValue, 0) -
              a.res.captureResult.capturedCards.reduce((sum, c) => sum + c.numericValue, 0)
          );
          return {
            card: captureOptions[0].card,
            targetCardRank: captureOptions[0].card.rank,
            reasoning: 'Rival: حرمان اللاعب الهجومي من نقاط الطاولة الفورية',
            intent: 'PRESSURE',
            hypothesisId: aggHypo?.id,
            drivenByHypothesis: Boolean(aggHypo),
          };
        }
      }

      // Priority 4: Normal table captures (filtered by bait awareness if player prefers baiting)
      for (const card of hand) {
        const res = evaluateCapture(card, cpuTable, playerTable, playerWinningPile, viewMode);
        const caps = res.captureResult.capturedCards;
        if (caps.length > 0) {
          // If player is known for baiting, avoid biting on an isolated single low-value card
          if (playerMetrics.baitPreference > 0.5 && caps.length === 1 && caps[0].numericValue <= 4 && hand.length > 1) {
            continue; // Skip potential bait
          }
          return {
            card,
            targetCardRank: card.rank,
            reasoning: 'Rival: Tactical table capture',
            intent: 'PRESSURE',
          };
        }
      }

      // Priority 5: Strategic Discard
      const sortedDiscards = [...hand].sort((a, b) => {
        if (a.isJack && !b.isJack) return 1;
        if (!a.isJack && b.isJack) return -1;

        const aHunted = huntedRanks.get(a.rank) || 0;
        const bHunted = huntedRanks.get(b.rank) || 0;
        if (aHunted !== bHunted) return aHunted - bHunted;

        const aRemaining = deckKnowledge.getRemainingUnseenRankCount(a.rank);
        const bRemaining = deckKnowledge.getRemainingUnseenRankCount(b.rank);
        if (aRemaining !== bRemaining) return aRemaining - bRemaining;

        return a.numericValue - b.numericValue;
      });

      return {
        card: sortedDiscards[0],
        reasoning: 'Rival: Calculated defensive discard',
        intent: 'OBSERVE',
      };
    }

    // --- LEVEL 4: MASTER (LIGHTWEIGHT COUNTERFACTUAL LOOKAHEAD) ---
    // Simulates: "If I play card C, what can the player likely do in response?"
    // Computes netScore = immediateGain + tacticalBonus - (lookaheadWeight * expectedPlayerResponseScore)
    const evaluatedCandidates: CounterfactualCandidate[] = [];

    // Calculate total unseen cards for probabilistic weighting
    let totalUnseen = 0;
    for (const r of ALL_RANKS) {
      totalUnseen += deckKnowledge.getRemainingUnseenRankCount(r);
    }
    const safeTotalUnseen = Math.max(1, totalUnseen);

    for (const card of hand) {
      const res = evaluateCapture(card, cpuTable, playerTable, playerWinningPile, viewMode);
      const capturedCards = res.captureResult.capturedCards;
      const isSteal =
        res.captureResult.capturedFrom === 'WINNING_PILE' ||
        res.captureResult.capturedFrom === 'MULTI_SOURCE';

      // 1. Immediate Gain
      let immediateGain = capturedCards.length * 10;
      if (isSteal) immediateGain += 85;
      if (card.isJack && capturedCards.length > 0) immediateGain += 40;
      if (card.isJack && capturedCards.length === 0) immediateGain -= 110;

      // Bonus for set progress
      const capturedOfRank = deckKnowledge.getCpuCapturedRankCount(card.rank);
      if (capturedCards.length > 0 && capturedOfRank >= 2) immediateGain += 35;

      // 2. Simulate Resulting Board State
      // Simulated new playerTable after CPU move:
      const newPlayerTable = playerTable.filter((c) => !capturedCards.some((cap) => cap.id === c.id));
      const newCpuTable = [...cpuTable];
      if (capturedCards.length === 0) {
        newCpuTable.push(card);
      }

      // Simulated exposed top card of CPU winning pile
      let newCpuPileTop: Card | undefined = cpuWinningPile[cpuWinningPile.length - 1];
      if (res.captureResult.isTopUniformCapture) {
        newCpuPileTop = card;
      }

      // 3. Counterfactual Expectation of Player's Response
      let expectedPlayerGain = 0;
      let worstCaseRank: Rank | undefined = undefined;
      let worstCaseGain = 0;

      for (const rank of ALL_RANKS) {
        const unseenOfRank = deckKnowledge.getRemainingUnseenRankCount(rank);
        if (unseenOfRank <= 0) continue;

        let rankProb = unseenOfRank / safeTotalUnseen;
        // If player is heavily hunting this rank, probability they hold it is higher
        const playerHunted = huntedRanks.get(rank) || 0;
        if (playerHunted >= 2) {
          rankProb *= 1.8;
        }

        // Simulate player playing this rank against the new board
        const dummyPlayerCard: Card = {
          id: `sim_${rank}`,
          suit: '♥',
          rank,
          numericValue: ALL_RANKS.indexOf(rank) + 1,
          isJack: rank === 'J',
        };

        // Could player steal the new CPU winning pile top?
        let simulatedGain = 0;
        if (newCpuPileTop && (newCpuPileTop.rank === rank || (rank === 'J' && !newCpuPileTop.isJack))) {
          // If player has high pileProtection vigilance, they are eagle-eyed on pile top steals
          const pileVigilanceMultiplier = playerMetrics.pileProtection >= 0.6 ? 1.4 : (playerMetrics.pileProtection < 0.4 ? 0.75 : 1.0);
          simulatedGain += 70 * pileVigilanceMultiplier; // Penalty if CPU exposes pile to steal!
        }

        // Could player capture table cards?
        const canCaptureFromCpuTable = newCpuTable.some((c) => c.rank === rank || rank === 'J');
        if (canCaptureFromCpuTable) {
          simulatedGain += 25;
        }

        // Archetype modifier: Aggressive/Greedy players always capitalize on open captures
        if (playerMetrics.archetype === 'AGGRESSIVE' || playerMetrics.archetype === 'GREEDY') {
          simulatedGain *= 1.3;
        } else if (playerMetrics.archetype === 'CAUTIOUS') {
          simulatedGain *= 0.8;
        }

        // Behavioral dimension: Risk tolerance scaling
        if (playerMetrics.riskTolerance > 0.6) {
          simulatedGain *= 1.25; // High risk player attempts aggressive counters
        } else if (playerMetrics.riskTolerance < 0.35) {
          simulatedGain *= 0.85; // Low risk player avoids risky plays
        }

        const weightedGain = rankProb * simulatedGain;
        expectedPlayerGain += weightedGain;

        if (simulatedGain > worstCaseGain) {
          worstCaseGain = simulatedGain;
          worstCaseRank = rank;
        }
      }

      // 4. Player Model & Adaptation Adjustments
      let tacticalBonus = 0;
      // Check active hypotheses from adaptationModel
      const activeHypothesesMaster = adaptationModel?.getActiveHypotheses() || [];
      const rankHypo = activeHypothesesMaster.find((h) => h.counterStrategy === 'DENY_RANK' && h.targetRank === card.rank);
      if (rankHypo && capturedCards.length > 0) {
        tacticalBonus += 40;
      }

      // Deny player's hunted ranks
      const playerHuntedCount = huntedRanks.get(card.rank) || 0;
      if (playerHuntedCount >= 2) {
        if (capturedCards.length > 0) {
          tacticalBonus += 35; // Deny hunted card
        } else {
          tacticalBonus -= 60; // Do not place hunted card on table!
        }
      }

      // Behavioral dimension: Bait preference defense
      // If player frequently baits, penalize taking isolated single low-value cards from table that expose CPU
      if (playerMetrics.baitPreference > 0.5 && capturedCards.length === 1 && capturedCards[0].numericValue <= 4 && !isSteal) {
        tacticalBonus -= 35; // Suspicious bait trap penalty
      }

      // Behavioral dimension: Denial preference counter-play
      // If player frequently denies Yoyo's ranks, bonus for proactive denial of player's alternate ranks
      if (playerMetrics.denialPreference > 0.5 && playerHuntedCount >= 1 && capturedCards.length > 0) {
        tacticalBonus += 30; // Proactive counter-denial
      }

      // Net Score formula with lookahead weighting
      const lookaheadWeight = 1.15;
      const netScore = immediateGain + tacticalBonus - lookaheadWeight * expectedPlayerGain;

      evaluatedCandidates.push({
        card,
        immediateGain,
        expectedPlayerResponseRank: worstCaseRank,
        expectedPlayerResponseScore: expectedPlayerGain,
        netScore,
        tacticalAdvantage: `Gain: ${immediateGain}, Expected Player Response: ${expectedPlayerGain.toFixed(1)}, Net: ${netScore.toFixed(1)}`,
      });
    }

    // Sort by netScore descending
    evaluatedCandidates.sort((a, b) => b.netScore - a.netScore);
    const chosen = evaluatedCandidates[0];

    const isCapture = (evaluateCapture(chosen.card, cpuTable, playerTable, playerWinningPile, viewMode).captureResult.capturedCards.length) > 0;
    let intent: YoyoIntent = 'OBSERVE';
    if (chosen.immediateGain >= 80) intent = 'CHALLENGE';
    else if (isCapture) intent = 'PRESSURE';

    const activeHypothesesMaster = adaptationModel?.getActiveHypotheses() || [];
    const matchedHypo = activeHypothesesMaster.find(
      (h) => h.counterStrategy === 'DENY_RANK' && h.targetRank === chosen.card.rank
    );

    return {
      card: chosen.card,
      targetCardRank: chosen.card.rank,
      reasoning: `Master (Counterfactual): ${chosen.tacticalAdvantage}`,
      intent,
      evaluationScore: chosen.netScore,
      counterfactualCandidate: chosen,
      hypothesisId: matchedHypo?.id,
      drivenByHypothesis: Boolean(matchedHypo),
    };
  }
}
