import { Rank, Suit } from '../types/game';
import { getCardByCanonicalId } from '../engine/deck';
import { FIRST_MATCH_DECK_IDS, buildFirstMatchDeck } from './firstMatchDeck';

export interface DeckValidationResult {
  valid: boolean;
  errors: string[];
  details: {
    totalCards: number;
    uniqueIdCount: number;
    rankDistribution: Record<Rank, number>;
    suitDistribution: Record<Suit, number>;
    bottomCardAnchorId: number;
  };
}

/**
 * Validates the First Match Deck Constitution.
 * Proves that:
 * 1. Total length is strictly 52.
 * 2. Every ID is an integer between 1 and 52.
 * 3. All 52 canonical IDs are strictly unique (no duplicates).
 * 4. No IDs from 1 to 52 are missing.
 * 5. Every card resolves cleanly through getCardByCanonicalId().
 * 6. Suit distribution is exactly 13 Clubs, 13 Diamonds, 13 Hearts, 13 Spades.
 * 7. Rank distribution is exactly 4 cards for each rank (2..A).
 * 8. The deck is strictly an exact permutation of the CANONICAL_DECK.
 */
export function validateFirstMatchDeck(): DeckValidationResult {
  const errors: string[] = [];

  // 1. Length check
  if (FIRST_MATCH_DECK_IDS.length !== 52) {
    errors.push(`FIRST_MATCH_DECK_IDS length is ${FIRST_MATCH_DECK_IDS.length}, expected 52`);
  }

  // 2. ID integer range check
  for (let i = 0; i < FIRST_MATCH_DECK_IDS.length; i++) {
    const id = FIRST_MATCH_DECK_IDS[i];
    if (!Number.isInteger(id) || id < 1 || id > 52) {
      errors.push(`Position ${i + 1} has invalid canonical ID ${id} (must be integer 1..52)`);
    }
  }

  const idSet = new Set<number>();
  for (const id of FIRST_MATCH_DECK_IDS) {
    if (idSet.has(id)) {
      errors.push(`Duplicate canonical ID found: ${id}`);
    }
    idSet.add(id);
  }

  // Missing IDs check
  for (let id = 1; id <= 52; id++) {
    if (!idSet.has(id)) {
      errors.push(`Missing canonical ID ${id} from deck`);
    }
  }

  // 3. Card object canonical resolution
  const deck = buildFirstMatchDeck();
  if (deck.length !== 52) {
    errors.push(`Resolved deck length is ${deck.length}, expected 52`);
  }

  const rankDistribution: Record<Rank, number> = {
    '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0, '8': 0, '9': 0, '10': 0,
    J: 0, Q: 0, K: 0, A: 0,
  };

  const suitDistribution: Record<Suit, number> = {
    '♣': 0, '♦': 0, '♥': 0, '♠': 0,
  };

  for (const card of deck) {
    rankDistribution[card.rank] = (rankDistribution[card.rank] || 0) + 1;
    suitDistribution[card.suit] = (suitDistribution[card.suit] || 0) + 1;

    const canonicalRef = getCardByCanonicalId(card.id);
    if (!canonicalRef) {
      errors.push(`Card with ID ${card.id} failed getCardByCanonicalId lookup`);
    } else if (canonicalRef.rank !== card.rank || canonicalRef.suit !== card.suit) {
      errors.push(
        `Card ID ${card.id} attributes (${card.rank}${card.suit}) differ from canonical (${canonicalRef.rank}${canonicalRef.suit})`
      );
    }
  }

  for (const [rank, count] of Object.entries(rankDistribution)) {
    if (count !== 4) {
      errors.push(`Rank ${rank} count is ${count}, expected 4`);
    }
  }

  for (const [suit, count] of Object.entries(suitDistribution)) {
    if (count !== 13) {
      errors.push(`Suit ${suit} count is ${count}, expected 13`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    details: {
      totalCards: deck.length,
      uniqueIdCount: idSet.size,
      rankDistribution,
      suitDistribution,
      bottomCardAnchorId: FIRST_MATCH_DECK_IDS[FIRST_MATCH_DECK_IDS.length - 1],
    },
  };
}
