import { Card } from '../types/game';
import { getCardByCanonicalId } from '../engine/deck';
import { FirstMatchDeckEntry } from './firstMatchTypes';

/**
 * 52-CARD FIRST MATCH CONSTITUTION
 *
 * Immutable deterministic permutation of canonical IDs 1..52.
 * Strictly complies with the canonical 6-deal lifecycle:
 * Deal 1: 12 cards (Player Hand 4, CPU Hand 4, Player Table 2, Opponent Table 2)
 * Deal 2: 8 cards  (Player Hand 4, CPU Hand 4)
 * Deal 3: 8 cards  (Player Hand 4, CPU Hand 4)
 * Deal 4: 8 cards  (Player Hand 4, CPU Hand 4)
 * Deal 5: 8 cards  (Player Hand 4, CPU Hand 4)
 * Deal 6: 8 cards  (Player Hand 4, CPU Hand 4)
 * Total: 12 + 8*5 = 52.
 * Card at Position 52 (ID 42, 4♠) serves as the revealed bottom memory anchor.
 */
export const FIRST_MATCH_DECK_IDS: readonly number[] = Object.freeze([
  // Deal 1 (12 cards: Pos 1..12)
  34, 16, 32, 7,    // Player Hand (9♥, 4♦, 7♥, 8♣)
  6, 19, 44, 22,    // CPU Hand (7♣, 7♦, 6♠, 10♦)
  14, 43,           // Player Table (2♦, 5♠)
  8, 41,            // Opponent Table (9♣, 3♠)

  // Deal 2 (8 cards: Pos 13..20)
  47, 23, 27, 15,   // Player Hand (9♠, J♦, 2♥, 3♦)
  21, 10, 30, 18,   // CPU Hand (9♦, J♣, 5♥, 6♦)

  // Deal 3 (8 cards: Pos 21..28)
  49, 9, 29, 20,    // Player Hand (J♠, 10♣, 4♥, 8♦)
  36, 35, 17, 5,    // CPU Hand (J♥, 10♥, 5♦, 6♣)

  // Deal 4 (8 cards: Pos 29..36)
  25, 51, 24, 1,    // Player Hand (K♦, K♠, Q♦, 2♣)
  12, 38, 11, 2,    // CPU Hand (K♣, K♥, Q♣, 3♣)

  // Deal 5 (8 cards: Pos 37..44)
  37, 13, 26, 33,   // Player Hand (Q♥, A♣, A♦, 8♥)
  50, 39, 45, 3,    // CPU Hand (Q♠, A♥, 7♠, 4♣)

  // Deal 6 (8 cards: Pos 45..52)
  52, 48, 46, 31,   // Player Hand (A♠, 10♠, 8♠, 6♥)
  40, 28, 4, 42,    // CPU Hand (2♠, 3♥, 5♣, 4♠ - memory anchor)
]);

/**
 * Detailed 52-Card Constitution Metadata
 * Maps every position to its role, recipient, purpose, and recovery function.
 */
export const FIRST_MATCH_DECK_CONSTITUTION: readonly FirstMatchDeckEntry[] = Object.freeze([
  // DEAL 1: POSITIONS 1..12
  {
    position: 1, canonicalId: 34, cardRank: '9', cardSuit: '♥', dealNumber: 1, recipient: 'PLAYER_HAND',
    purpose: 'Initial capture card', milestone: 'milestone-first-capture',
    goldenPathRole: 'Matches 9♣ on Opponent Table to capture first points', recoveryRole: 'Can be played later to match table 9s'
  },
  {
    position: 2, canonicalId: 16, cardRank: '4', cardSuit: '♦', dealNumber: 1, recipient: 'PLAYER_HAND',
    purpose: 'Non-matching discard to table', milestone: 'milestone-own-table',
    goldenPathRole: 'Placed on Player Table to learn table reserve mechanics', recoveryRole: 'Legal discard anytime'
  },
  {
    position: 3, canonicalId: 32, cardRank: '7', cardSuit: '♥', dealNumber: 1, recipient: 'PLAYER_HAND',
    purpose: 'Signature Steal execution', milestone: 'milestone-steal',
    goldenPathRole: 'Steals CPU 7-stack from Winning Pile after CPU captures', recoveryRole: 'Regular capture or discard if steal missed'
  },
  {
    position: 4, canonicalId: 7, cardRank: '8', cardSuit: '♣', dealNumber: 1, recipient: 'PLAYER_HAND',
    purpose: 'Reserve card in hand', milestone: undefined,
    goldenPathRole: 'Discarded to conclude Deal 1 cleanly', recoveryRole: 'Pairs with Deal 3 8♦'
  },
  {
    position: 5, canonicalId: 6, cardRank: '7', cardSuit: '♣', dealNumber: 1, recipient: 'CPU_HAND',
    purpose: 'Bait card for CPU setup', milestone: undefined,
    goldenPathRole: 'Played to Opponent Table on CPU turn 1', recoveryRole: 'Standard CPU discard'
  },
  {
    position: 6, canonicalId: 19, cardRank: '7', cardSuit: '♦', dealNumber: 1, recipient: 'CPU_HAND',
    purpose: 'CPU capture tool (7♦)', milestone: undefined,
    goldenPathRole: 'Captures 7♣ to CPU Winning Pile to set up Player Steal', recoveryRole: 'Standard CPU capture'
  },
  {
    position: 7, canonicalId: 44, cardRank: '6', cardSuit: '♠', dealNumber: 1, recipient: 'CPU_HAND',
    purpose: 'CPU harmless discard', milestone: undefined,
    goldenPathRole: 'Discarded by CPU to table on turn 3', recoveryRole: 'Standard table filler'
  },
  {
    position: 8, canonicalId: 22, cardRank: '10', cardSuit: '♦', dealNumber: 1, recipient: 'CPU_HAND',
    purpose: 'CPU turn 4 discard', milestone: undefined,
    goldenPathRole: 'Played on turn 4 to empty CPU hand and trigger Deal 2', recoveryRole: 'Standard table filler'
  },
  {
    position: 9, canonicalId: 14, cardRank: '2', cardSuit: '♦', dealNumber: 1, recipient: 'PLAYER_TABLE',
    purpose: 'Initial Player Table reserve', milestone: undefined,
    goldenPathRole: 'Visible table anchor demonstrating player table zone', recoveryRole: 'Pairs with later 2s'
  },
  {
    position: 10, canonicalId: 43, cardRank: '5', cardSuit: '♠', dealNumber: 1, recipient: 'PLAYER_TABLE',
    purpose: 'Initial Player Table reserve', milestone: undefined,
    goldenPathRole: 'Visible table anchor demonstrating player table zone', recoveryRole: 'Pairs with later 5s'
  },
  {
    position: 11, canonicalId: 8, cardRank: '9', cardSuit: '♣', dealNumber: 1, recipient: 'OPPONENT_TABLE',
    purpose: 'Initial Opponent Table bait', milestone: 'milestone-rank-match',
    goldenPathRole: 'Available for immediate capture with 9♥', recoveryRole: 'Can be captured by any 9'
  },
  {
    position: 12, canonicalId: 41, cardRank: '3', cardSuit: '♠', dealNumber: 1, recipient: 'OPPONENT_TABLE',
    purpose: 'Initial Opponent Table non-matching card', milestone: undefined,
    goldenPathRole: 'Teaches selective matching vs ignoring non-matches', recoveryRole: 'Can be captured by later 3'
  },

  // DEAL 2: POSITIONS 13..20
  {
    position: 13, canonicalId: 47, cardRank: '9', cardSuit: '♠', dealNumber: 2, recipient: 'PLAYER_HAND',
    purpose: 'Regular Set Completion (4 Nines)', milestone: 'milestone-regular-set',
    goldenPathRole: 'Captures 9♦ to complete 4 Nines (12 pts)', recoveryRole: 'Contributes to Nines set'
  },
  {
    position: 14, canonicalId: 23, cardRank: 'J', cardSuit: '♦', dealNumber: 2, recipient: 'PLAYER_HAND',
    purpose: 'First Jack acquisition', milestone: 'milestone-jack-set',
    goldenPathRole: 'Captures J♣ to secure 2 Jacks in Winning Pile', recoveryRole: 'Captures Jack'
  },
  {
    position: 15, canonicalId: 27, cardRank: '2', cardSuit: '♥', dealNumber: 2, recipient: 'PLAYER_HAND',
    purpose: 'Tactical table placement', milestone: undefined,
    goldenPathRole: 'Placed on table or captures table 2♦', recoveryRole: 'Standard play'
  },
  {
    position: 16, canonicalId: 15, cardRank: '3', cardSuit: '♦', dealNumber: 2, recipient: 'PLAYER_HAND',
    purpose: 'Table balance', milestone: undefined,
    goldenPathRole: 'Placed on table or captures 3♠', recoveryRole: 'Standard play'
  },
  {
    position: 17, canonicalId: 21, cardRank: '9', cardSuit: '♦', dealNumber: 2, recipient: 'CPU_HAND',
    purpose: 'Fourth Nine delivery', milestone: undefined,
    goldenPathRole: 'Played to table for Player 9♠ capture', recoveryRole: 'Provides 4th Nine'
  },
  {
    position: 18, canonicalId: 10, cardRank: 'J', cardSuit: '♣', dealNumber: 2, recipient: 'CPU_HAND',
    purpose: 'First Jack delivery', milestone: undefined,
    goldenPathRole: 'Played to table for Player J♦ capture', recoveryRole: 'Provides Jack'
  },
  {
    position: 19, canonicalId: 30, cardRank: '5', cardSuit: '♥', dealNumber: 2, recipient: 'CPU_HAND',
    purpose: 'CPU neutral move', milestone: undefined,
    goldenPathRole: 'Played to table', recoveryRole: 'Standard play'
  },
  {
    position: 20, canonicalId: 18, cardRank: '6', cardSuit: '♦', dealNumber: 2, recipient: 'CPU_HAND',
    purpose: 'CPU deal closer', milestone: undefined,
    goldenPathRole: 'Concludes Deal 2', recoveryRole: 'Standard play'
  },

  // DEAL 3: POSITIONS 21..28
  {
    position: 21, canonicalId: 49, cardRank: 'J', cardSuit: '♠', dealNumber: 3, recipient: 'PLAYER_HAND',
    purpose: 'Jack Set & Silver Combo trigger', milestone: 'milestone-silver-combo',
    goldenPathRole: 'Captures J♥ to complete all 4 Jacks (36 pts + Silver 60 pts)', recoveryRole: 'Jack Set completion'
  },
  {
    position: 22, canonicalId: 9, cardRank: '10', cardSuit: '♣', dealNumber: 3, recipient: 'PLAYER_HAND',
    purpose: 'Ten capture', milestone: undefined,
    goldenPathRole: 'Captures 10♥ played by CPU', recoveryRole: 'Standard capture'
  },
  {
    position: 23, canonicalId: 29, cardRank: '4', cardSuit: '♥', dealNumber: 3, recipient: 'PLAYER_HAND',
    purpose: 'Four capture / table play', milestone: undefined,
    goldenPathRole: 'Captures 4♦ from table or discards safely', recoveryRole: 'Standard play'
  },
  {
    position: 24, canonicalId: 20, cardRank: '8', cardSuit: '♦', dealNumber: 3, recipient: 'PLAYER_HAND',
    purpose: 'Deal closer', milestone: undefined,
    goldenPathRole: 'Played to conclude Deal 3', recoveryRole: 'Standard play'
  },
  {
    position: 25, canonicalId: 36, cardRank: 'J', cardSuit: '♥', dealNumber: 3, recipient: 'CPU_HAND',
    purpose: 'Final Jack delivery', milestone: undefined,
    goldenPathRole: 'Played to table for Player J♠ capture', recoveryRole: 'Provides 4th Jack'
  },
  {
    position: 26, canonicalId: 35, cardRank: '10', cardSuit: '♥', dealNumber: 3, recipient: 'CPU_HAND',
    purpose: 'Ten delivery', milestone: undefined,
    goldenPathRole: 'Played to table for 10♣ capture', recoveryRole: 'Standard play'
  },
  {
    position: 27, canonicalId: 17, cardRank: '5', cardSuit: '♦', dealNumber: 3, recipient: 'CPU_HAND',
    purpose: 'Five filler', milestone: undefined,
    goldenPathRole: 'Played to table', recoveryRole: 'Standard play'
  },
  {
    position: 28, canonicalId: 5, cardRank: '6', cardSuit: '♣', dealNumber: 3, recipient: 'CPU_HAND',
    purpose: 'Six filler', milestone: undefined,
    goldenPathRole: 'Concludes Deal 3', recoveryRole: 'Standard play'
  },

  // DEAL 4: POSITIONS 29..36
  {
    position: 29, canonicalId: 25, cardRank: 'K', cardSuit: '♦', dealNumber: 4, recipient: 'PLAYER_HAND',
    purpose: 'King Set builder', milestone: undefined,
    goldenPathRole: 'Captures K♣ for first pair of Kings', recoveryRole: 'King Set builder'
  },
  {
    position: 30, canonicalId: 51, cardRank: 'K', cardSuit: '♠', dealNumber: 4, recipient: 'PLAYER_HAND',
    purpose: 'Golden Combo Climax (75 pts)', milestone: 'milestone-golden-combo',
    goldenPathRole: 'Captures K♥ to complete 4 Kings (Second Regular Set -> GOLDEN COMBO)', recoveryRole: 'Golden Combo trigger'
  },
  {
    position: 31, canonicalId: 24, cardRank: 'Q', cardSuit: '♦', dealNumber: 4, recipient: 'PLAYER_HAND',
    purpose: 'Queen capture', milestone: undefined,
    goldenPathRole: 'Captures Q♣ played by CPU', recoveryRole: 'Queen builder'
  },
  {
    position: 32, canonicalId: 1, cardRank: '2', cardSuit: '♣', dealNumber: 4, recipient: 'PLAYER_HAND',
    purpose: 'Two builder / closer', milestone: undefined,
    goldenPathRole: 'Played to table', recoveryRole: 'Standard play'
  },
  {
    position: 33, canonicalId: 12, cardRank: 'K', cardSuit: '♣', dealNumber: 4, recipient: 'CPU_HAND',
    purpose: 'King delivery 1', milestone: undefined,
    goldenPathRole: 'Played to table for K♦ capture', recoveryRole: 'King supply'
  },
  {
    position: 34, canonicalId: 38, cardRank: 'K', cardSuit: '♥', dealNumber: 4, recipient: 'CPU_HAND',
    purpose: 'King delivery 2', milestone: undefined,
    goldenPathRole: 'Played to table for K♠ capture (Golden Combo!)', recoveryRole: 'King supply'
  },
  {
    position: 35, canonicalId: 11, cardRank: 'Q', cardSuit: '♣', dealNumber: 4, recipient: 'CPU_HAND',
    purpose: 'Queen delivery', milestone: undefined,
    goldenPathRole: 'Played to table for Q♦ capture', recoveryRole: 'Queen supply'
  },
  {
    position: 36, canonicalId: 2, cardRank: '3', cardSuit: '♣', dealNumber: 4, recipient: 'CPU_HAND',
    purpose: 'Deal closer', milestone: undefined,
    goldenPathRole: 'Concludes Deal 4 into Free Play transition', recoveryRole: 'Standard play'
  },

  // DEAL 5: POSITIONS 37..44 (FREE PLAY / RIVAL PHASE)
  {
    position: 37, canonicalId: 37, cardRank: 'Q', cardSuit: '♥', dealNumber: 5, recipient: 'PLAYER_HAND',
    purpose: 'Free Play Queen builder', milestone: 'milestone-free-play',
    goldenPathRole: 'Tactical Free Play capture with Queen', recoveryRole: 'Free Play card'
  },
  {
    position: 38, canonicalId: 13, cardRank: 'A', cardSuit: '♣', dealNumber: 5, recipient: 'PLAYER_HAND',
    purpose: 'Free Play Ace builder', milestone: undefined,
    goldenPathRole: 'Tactical Ace play', recoveryRole: 'Free Play card'
  },
  {
    position: 39, canonicalId: 26, cardRank: 'A', cardSuit: '♦', dealNumber: 5, recipient: 'PLAYER_HAND',
    purpose: 'Free Play Ace pair', milestone: undefined,
    goldenPathRole: 'Tactical Ace play', recoveryRole: 'Free Play card'
  },
  {
    position: 40, canonicalId: 33, cardRank: '8', cardSuit: '♥', dealNumber: 5, recipient: 'PLAYER_HAND',
    purpose: 'Free Play Eight play', milestone: undefined,
    goldenPathRole: 'Tactical play', recoveryRole: 'Free Play card'
  },
  {
    position: 41, canonicalId: 50, cardRank: 'Q', cardSuit: '♠', dealNumber: 5, recipient: 'CPU_HAND',
    purpose: 'Free Play CPU move', milestone: undefined,
    goldenPathRole: 'Competitive CPU move', recoveryRole: 'Free Play card'
  },
  {
    position: 42, canonicalId: 39, cardRank: 'A', cardSuit: '♥', dealNumber: 5, recipient: 'CPU_HAND',
    purpose: 'Free Play CPU move', milestone: undefined,
    goldenPathRole: 'Competitive CPU move', recoveryRole: 'Free Play card'
  },
  {
    position: 43, canonicalId: 45, cardRank: '7', cardSuit: '♠', dealNumber: 5, recipient: 'CPU_HAND',
    purpose: 'Free Play CPU move', milestone: undefined,
    goldenPathRole: 'Competitive CPU move', recoveryRole: 'Free Play card'
  },
  {
    position: 44, canonicalId: 3, cardRank: '4', cardSuit: '♣', dealNumber: 5, recipient: 'CPU_HAND',
    purpose: 'Free Play CPU move', milestone: undefined,
    goldenPathRole: 'Competitive CPU move', recoveryRole: 'Free Play card'
  },

  // DEAL 6: POSITIONS 45..52 (MATCH CLIMAX & CONSERVATION EXHAUSTION)
  {
    position: 45, canonicalId: 52, cardRank: 'A', cardSuit: '♠', dealNumber: 6, recipient: 'PLAYER_HAND',
    purpose: 'Final Deal Ace play', milestone: undefined,
    goldenPathRole: 'Final Deal tactical point capture', recoveryRole: 'Endgame play'
  },
  {
    position: 46, canonicalId: 48, cardRank: '10', cardSuit: '♠', dealNumber: 6, recipient: 'PLAYER_HAND',
    purpose: 'Final Deal Ten play', milestone: undefined,
    goldenPathRole: 'Final Deal tactical play', recoveryRole: 'Endgame play'
  },
  {
    position: 47, canonicalId: 46, cardRank: '8', cardSuit: '♠', dealNumber: 6, recipient: 'PLAYER_HAND',
    purpose: 'Final Deal Eight play', milestone: undefined,
    goldenPathRole: 'Final Deal tactical play', recoveryRole: 'Endgame play'
  },
  {
    position: 48, canonicalId: 31, cardRank: '6', cardSuit: '♥', dealNumber: 6, recipient: 'PLAYER_HAND',
    purpose: 'Final Deal Six play', milestone: undefined,
    goldenPathRole: 'Final player card of the match', recoveryRole: 'Endgame play'
  },
  {
    position: 49, canonicalId: 40, cardRank: '2', cardSuit: '♠', dealNumber: 6, recipient: 'CPU_HAND',
    purpose: 'Final Deal CPU move', milestone: undefined,
    goldenPathRole: 'Competitive endgame move', recoveryRole: 'Endgame play'
  },
  {
    position: 50, canonicalId: 28, cardRank: '3', cardSuit: '♥', dealNumber: 6, recipient: 'CPU_HAND',
    purpose: 'Final Deal CPU move', milestone: undefined,
    goldenPathRole: 'Competitive endgame move', recoveryRole: 'Endgame play'
  },
  {
    position: 51, canonicalId: 4, cardRank: '5', cardSuit: '♣', dealNumber: 6, recipient: 'CPU_HAND',
    purpose: 'Final Deal CPU move', milestone: undefined,
    goldenPathRole: 'Competitive endgame move', recoveryRole: 'Endgame play'
  },
  {
    position: 52, canonicalId: 42, cardRank: '4', cardSuit: '♠', dealNumber: 6, recipient: 'CPU_HAND',
    purpose: 'Revealed Memory Anchor Card / Match Final Card', milestone: undefined,
    goldenPathRole: 'Physical 52nd card matching revealed bottom memory anchor', recoveryRole: 'Endgame play'
  },
]);

/**
 * Builds the canonical Card[] array for the First Match.
 * Every card is resolved through getCardByCanonicalId().
 */
export function buildFirstMatchDeck(): Card[] {
  return FIRST_MATCH_DECK_IDS.map((id) => {
    const card = getCardByCanonicalId(id);
    if (!card) {
      throw new Error(`Canonical Card ID ${id} not found in CANONICAL_DECK`);
    }
    return { ...card };
  });
}

export const FIRST_MATCH_DECK: readonly Card[] = Object.freeze(buildFirstMatchDeck());
