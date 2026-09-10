import { Card, Rank, Suit } from '../types/game';

/**
 * Canonical Suit Order:
 * 1 = Clubs (♣)
 * 2 = Diamonds (♦)
 * 3 = Hearts (♥)
 * 4 = Spades (♠)
 */
export const SUIT_ORDER: Record<Suit, number> = {
  '♣': 1,
  '♦': 2,
  '♥': 3,
  '♠': 4,
};

export const SUITS: Suit[] = ['♣', '♦', '♥', '♠'];

/**
 * Canonical Rank Order:
 * 2, 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K, A
 */
export const RANKS: Rank[] = [
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
  'A',
];

export const RANK_VALUES: Record<Rank, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 1,
};

/**
 * Canonical Standard Deck (52 cards immutable blueprint)
 * ID 1..13: 2♣ .. A♣
 * ID 14..26: 2♦ .. A♦
 * ID 27..39: 2♥ .. A♥
 * ID 40..52: 2♠ .. A♠
 */
export const CANONICAL_DECK: readonly Card[] = Object.freeze(
  SUITS.flatMap((suit, suitIdx) =>
    RANKS.map((rank, rankIdx) => {
      const canonicalNumericId = suitIdx * 13 + rankIdx + 1;
      return {
        id: String(canonicalNumericId),
        suit,
        rank,
        numericValue: RANK_VALUES[rank],
        isJack: rank === 'J',
      };
    })
  )
);

/**
 * Factory creating a fresh 52-card standard deck in canonical order (IDs 1 to 52).
 */
export function createStandardDeck(): Card[] {
  return CANONICAL_DECK.map((card) => ({ ...card }));
}

/**
 * Helper to retrieve a card by its canonical ID (1..52).
 */
export function getCardByCanonicalId(id: string | number): Card | undefined {
  const targetId = String(id);
  const found = CANONICAL_DECK.find((c) => c.id === targetId);
  return found ? { ...found } : undefined;
}

/**
 * Deterministic Mulberry32 PRNG
 */
function createPrng(seed: number): () => number {
  let s = Math.floor(seed);
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic Fisher-Yates shuffle
 * Preserves Card IDs and properties, modifying only array positions.
 */
export function shuffleDeck(deck: Card[], seed: number = Date.now()): Card[] {
  const shuffled = [...deck];
  const rng = createPrng(seed);

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = temp;
  }

  return shuffled;
}

/**
 * Cuts a deck deterministically at cutIndex.
 * Splitting at cutIndex: cards from [cutIndex..end] become top, cards [0..cutIndex-1] become bottom.
 * Preserves all 52 card identities and properties.
 */
export function cutDeck(deck: Card[], cutIndex: number): Card[] {
  if (cutIndex <= 0 || cutIndex >= deck.length) {
    return [...deck];
  }
  return [...deck.slice(cutIndex), ...deck.slice(0, cutIndex)];
}

/**
 * Calculates a deterministic cut index between [10, 41] for a 52-card deck.
 */
export function calculateDeterministicCutIndex(seed: number, deckLength: number = 52): number {
  if (deckLength <= 4) return Math.floor(deckLength / 2);
  const rng = createPrng((seed ^ 0x9e3779b9) >>> 0);
  const minCut = Math.min(10, Math.floor(deckLength * 0.2));
  const maxCut = Math.max(minCut + 1, Math.floor(deckLength * 0.8));
  return minCut + Math.floor(rng() * (maxCut - minCut + 1));
}

export interface PreparedRoundDeck {
  deck: Card[];
  cutIndex: number;
  revealedBottomCard: Card;
}

/**
 * Prepares a full 52-card round deck with shuffle, cut, and revealed bottom memory anchor.
 */
export function prepareRoundDeck(seed: number = Date.now(), manualCutIndex?: number): PreparedRoundDeck {
  const canonical = createStandardDeck();
  const shuffled = shuffleDeck(canonical, seed);
  const cutIndex = manualCutIndex !== undefined ? manualCutIndex : calculateDeterministicCutIndex(seed, shuffled.length);
  const preparedDeck = cutDeck(shuffled, cutIndex);
  const revealedBottomCard = { ...preparedDeck[preparedDeck.length - 1] };

  return {
    deck: preparedDeck,
    cutIndex,
    revealedBottomCard,
  };
}


