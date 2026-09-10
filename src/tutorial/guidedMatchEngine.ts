import { GameState } from '../types/game';

export interface GuidedMatchTip {
  id: string;
  type: 'DIRECT_CAPTURE' | 'PILE_STEAL' | 'SET_OPPORTUNITY';
  title: string;
  message: string;
  suggestedCardId?: string;
  highlightZone?: 'PLAYER_HAND' | 'PLAYER_TABLE' | 'OPPONENT_TABLE' | 'WINNING_PILE';
}

/**
 * Analyzes the player's visible game state in a live match and generates
 * short, specific, and actionable tactical coaching tips based exclusively on visible cards.
 *
 * Priority order:
 * 1. Opponent Winning Pile Steal
 * 2. 4-Card Set Completion
 * 3. Direct Table Capture
 * 4. Silence (returns null when no tactical opportunity is available)
 *
 * ZERO HIDDEN-INFORMATION LEAKAGE:
 * - Does NOT inspect cpuHand
 * - Does NOT inspect deck
 * - Does NOT simulate future CPU actions
 */
export function analyzeGuidedMatchState(gameState: GameState): GuidedMatchTip | null {
  if (gameState.phase !== 'PLAYER_TURN' || gameState.activeTurn !== 'player') {
    return null;
  }

  const { playerHand, table, cpuWinningPile, playerWinningPile } = gameState;

  // 1. Priority 1: Opponent Winning Pile Steal (Highest Tactical Value)
  if (cpuWinningPile.length > 0) {
    const opponentTopCard = cpuWinningPile[cpuWinningPile.length - 1];
    const stealCard = playerHand.find((c) => c.rank === opponentTopCard.rank);
    if (stealCard) {
      return {
        id: `steal-${stealCard.id}`,
        type: 'PILE_STEAL',
        title: '⚡ سرقة كومة الخصم',
        message: `الورقة العلوية لكومة الخصم ${opponentTopCard.rank}${opponentTopCard.suit}. لديك ${stealCard.rank}${stealCard.suit} — العبها لسرقة الكومة.`,
        suggestedCardId: stealCard.id,
        highlightZone: 'WINNING_PILE',
      };
    }
  }

  // 2. Priority 2: 4-Card Set Completion (+12 points)
  const pileRanksCount: Record<string, number> = {};
  for (const c of playerWinningPile) {
    pileRanksCount[c.rank] = (pileRanksCount[c.rank] || 0) + 1;
  }

  for (const [rank, count] of Object.entries(pileRanksCount)) {
    if (count >= 2 && count < 4) {
      const tableMatching = [
        ...table.playerTable.filter((c) => c.rank === rank),
        ...table.opponentTable.filter((c) => c.rank === rank),
      ];
      const handCard = playerHand.find((c) => c.rank === rank);
      if (handCard && (count + tableMatching.length + 1 >= 4)) {
        return {
          id: `set-complete-${rank}`,
          type: 'SET_OPPORTUNITY',
          title: '👑 إكمال مجموعة ملكية',
          message: `لديك ${count} من رتبة ${rank} في كومة فوزك. لعب ${handCard.rank}${handCard.suit} يكمل المجموعة (+12 نقطة).`,
          suggestedCardId: handCard.id,
          highlightZone: 'PLAYER_HAND',
        };
      }
    }
  }

  // 3. Priority 3: Direct Table Capture
  for (const card of playerHand) {
    const matchingOnPlayerTable = table.playerTable.find((c) => c.rank === card.rank);
    const matchingOnOpponentTable = table.opponentTable.find((c) => c.rank === card.rank);

    if (matchingOnPlayerTable || matchingOnOpponentTable) {
      const targetTable = matchingOnOpponentTable ? 'طاولة الخصم' : 'طاولتك';
      const targetCard = matchingOnOpponentTable || matchingOnPlayerTable!;
      return {
        id: `capture-${card.id}`,
        type: 'DIRECT_CAPTURE',
        title: '🎯 أكل مباشر',
        message: `${card.rank}${card.suit} في يدك تطابق ${targetCard.rank}${targetCard.suit} على ${targetTable}. العبها للأكل.`,
        suggestedCardId: card.id,
        highlightZone: matchingOnOpponentTable ? 'OPPONENT_TABLE' : 'PLAYER_TABLE',
      };
    }
  }

  // 4. Priority 4: No immediate tactical capture/steal/set -> Silence (null)
  return null;
}

