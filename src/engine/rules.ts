import {
  Card,
  CapturedItemOrigin,
  CaptureResult,
  CaptureSource,
  GameState,
  PlayerId,
  Rank,
  ScoreBreakdown,
  SetDetail,
  TableViewMode,
} from '../types/game';
import { RANKS } from './deck';

export const SCORING_VALUES = {
  GOLDEN: 75,       // 1 Jack Set + 2 Regular Sets (12 cards) = 75 pts
  GOLDEN_COMBO: 75, // alias
  SILVER: 60,       // 1 Jack Set + 1 Regular Set (8 cards) = 60 pts
  SILVER_COMBO: 60, // alias
  IRON: 50,         // 3 Regular Sets (12 cards) = 50 pts (Canonical Iron Combo)
  IRON_COMBO: 50,   // alias
  BALANCED: 50,     // 3 Regular Sets (12 cards) = 50 pts
  BALANCED_COMBO: 50,
  TRIBLE_COMBO: 50, // alias
  DOUBLE_COMBO: 30, // 2 Regular Sets (8 cards) = 30 pts
  DOUBLE: 30,       // alias
  JACK_SET: 36,     // 4 Jacks not consumed by Combo = 36 pts
  REGULAR_SET: 12,  // 4 of any same non-Jack rank not consumed by Combo = 12 pts
  JACK_CARD: 3,     // 3 pts per unconsumed Jack outside all sets
  OTHER_CARD: 1,    // 1 pt per unconsumed regular card outside all sets
};

const RANK_ARABIC: Record<string, string> = {
  A: 'آس',
  '2': 'اثنين',
  '3': 'ثلاثة',
  '4': 'أربعة',
  '5': 'خمسة',
  '6': 'ستة',
  '7': 'سبعة',
  '8': 'ثمانية',
  '9': 'تسعة',
  '10': 'عشرة',
  J: 'ولد',
  Q: 'بنت',
  K: 'شايب',
};

export interface CaptureResolution {
  captureResult: CaptureResult;
  updatedPlayerTable: Card[];
  updatedOpponentTable: Card[];
  updatedOpponentWinningPile: Card[];
}

/**
 * Evaluates legal capture for played card in Egyptian Jacks dual-table model.
 * Searches across Opponent Table, Player Table, and Opponent Winning Pile according to viewMode & stack accessibility.
 */
export function evaluateCapture(
  playedCard: Card,
  playerTable: Card[],
  opponentTable: Card[],
  opponentWinningPile: Card[],
  viewMode: TableViewMode
): CaptureResolution {
  const playedRankArabic = RANK_ARABIC[playedCard.rank] || playedCard.rank;

  // 1. Check Opponent Table
  let matchedOpponentCards: Card[] = [];
  let newOpponentTable: Card[] = [];

  if (opponentTable.length > 0) {
    if (viewMode === 'INITIAL_VIEW') {
      matchedOpponentCards = opponentTable.filter((c) => c.rank === playedCard.rank);
      newOpponentTable = opponentTable.filter((c) => c.rank !== playedCard.rank);
    } else {
      const topOpponentCard = opponentTable[opponentTable.length - 1];
      if (topOpponentCard.rank === playedCard.rank) {
        matchedOpponentCards = [topOpponentCard];
        newOpponentTable = opponentTable.slice(0, opponentTable.length - 1);
      } else {
        newOpponentTable = [...opponentTable];
      }
    }
  }

  // 2. Check Player Table
  let matchedPlayerCards: Card[] = [];
  let newPlayerTable: Card[] = [];

  if (playerTable.length > 0) {
    if (viewMode === 'INITIAL_VIEW') {
      matchedPlayerCards = playerTable.filter((c) => c.rank === playedCard.rank);
      newPlayerTable = playerTable.filter((c) => c.rank !== playedCard.rank);
    } else {
      const topPlayerCard = playerTable[playerTable.length - 1];
      if (topPlayerCard.rank === playedCard.rank) {
        matchedPlayerCards = [topPlayerCard];
        newPlayerTable = playerTable.slice(0, playerTable.length - 1);
      } else {
        newPlayerTable = [...playerTable];
      }
    }
  }

  // 3. Check Opponent Winning Pile (Top Uniform Contiguous Rank Sequence)
  let matchedWinningPileCards: Card[] = [];
  let newOpponentWinningPile: Card[] = [];

  if (opponentWinningPile.length > 0) {
    const topWinningCard = opponentWinningPile[opponentWinningPile.length - 1];
    if (topWinningCard.rank === playedCard.rank) {
      let uniformCount = 0;
      for (let i = opponentWinningPile.length - 1; i >= 0; i--) {
        if (opponentWinningPile[i].rank === playedCard.rank) {
          uniformCount++;
        } else {
          break;
        }
      }
      matchedWinningPileCards = opponentWinningPile.slice(
        opponentWinningPile.length - uniformCount
      );
      newOpponentWinningPile = opponentWinningPile.slice(
        0,
        opponentWinningPile.length - uniformCount
      );
    } else {
      newOpponentWinningPile = [...opponentWinningPile];
    }
  }

  const totalMatches =
    matchedOpponentCards.length +
    matchedPlayerCards.length +
    matchedWinningPileCards.length;

  // 4. No capture -> Played card is placed on player's table stack
  if (totalMatches === 0) {
    return {
      captureResult: {
        capturedCards: [],
        capturedFrom: 'NONE',
        isTopUniformCapture: false,
        sources: [],
        capturedWithOrigins: [],
        description: `لعب ${playedRankArabic}${playedCard.suit} إلى كومة الطاولة.`,
      },
      updatedPlayerTable: [...playerTable, playedCard],
      updatedOpponentTable: [...opponentTable],
      updatedOpponentWinningPile: [...opponentWinningPile],
    };
  }

  // 5. Unified multi-source capture occurred
  const capturedCards: Card[] = [
    ...matchedOpponentCards,
    ...matchedPlayerCards,
    ...matchedWinningPileCards,
    playedCard,
  ];

  const sources: ('PLAYER_TABLE' | 'OPPONENT_TABLE' | 'WINNING_PILE')[] = [];
  if (matchedOpponentCards.length > 0) sources.push('OPPONENT_TABLE');
  if (matchedPlayerCards.length > 0) sources.push('PLAYER_TABLE');
  if (matchedWinningPileCards.length > 0) sources.push('WINNING_PILE');

  let capturedFrom: CaptureSource = 'MULTI_SOURCE';
  if (sources.length === 1) {
    capturedFrom = sources[0];
  }

  const capturedWithOrigins: CapturedItemOrigin[] = [
    ...matchedOpponentCards.map((c) => ({ card: c, source: 'OPPONENT_TABLE' as const })),
    ...matchedPlayerCards.map((c) => ({ card: c, source: 'PLAYER_TABLE' as const })),
    ...matchedWinningPileCards.map((c) => ({ card: c, source: 'WINNING_PILE' as const })),
  ];

  const isTopUniformCapture = matchedWinningPileCards.length > 0;

  // Build descriptive message
  let description = '';
  if (sources.length > 1) {
    const sourceNames: string[] = [];
    if (matchedOpponentCards.length > 0) sourceNames.push('طاولة الخصم');
    if (matchedPlayerCards.length > 0) sourceNames.push('طاولتك');
    if (matchedWinningPileCards.length > 0) sourceNames.push('كومة فوز الخصم');
    description = `أكل موحّد (${capturedCards.length} أوراق) برتبة ${playedRankArabic} من (${sourceNames.join(' + ')}) بواسطة ${playedRankArabic}${playedCard.suit}.`;
  } else if (matchedOpponentCards.length > 0) {
    const firstMatched = matchedOpponentCards[0];
    const matchedRankArabic = RANK_ARABIC[firstMatched.rank] || firstMatched.rank;
    description =
      matchedOpponentCards.length === 1
        ? `أكل ${matchedRankArabic}${firstMatched.suit} من طاولة الخصم بواسطة ${playedRankArabic}${playedCard.suit}.`
        : `أكل ${matchedOpponentCards.length} ورقة من طاولة الخصم بواسطة ${playedRankArabic}${playedCard.suit}.`;
  } else if (matchedPlayerCards.length > 0) {
    const firstMatched = matchedPlayerCards[0];
    const matchedRankArabic = RANK_ARABIC[firstMatched.rank] || firstMatched.rank;
    description =
      matchedPlayerCards.length === 1
        ? `مطابقة ${matchedRankArabic}${firstMatched.suit} على طاولتك بواسطة ${playedRankArabic}${playedCard.suit}.`
        : `مطابقة ${matchedPlayerCards.length} ورقة على طاولتك بواسطة ${playedRankArabic}${playedCard.suit}.`;
  } else if (matchedWinningPileCards.length > 0) {
    description = `استيلاء علوي! أكل ${matchedWinningPileCards.length} ${playedRankArabic} من كومة فوز الخصم بواسطة ${playedRankArabic}${playedCard.suit}.`;
  }

  return {
    captureResult: {
      capturedCards,
      capturedFrom,
      isTopUniformCapture,
      sources,
      capturedWithOrigins,
      description,
    },
    updatedPlayerTable: newPlayerTable,
    updatedOpponentTable: newOpponentTable,
    updatedOpponentWinningPile: newOpponentWinningPile,
  };
}

export interface OptimalSetAllocation {
  goldenCombos: number;
  silverCombos: number;
  ironCombos: number;
  doubleCombos: number;
  jackSets: number;
  regularSets: number;
  totalPoints: number;
}

/**
 * Deterministically optimizes the allocation of regular sets between Iron Combos,
 * Double Combos, and standalone Regular Sets.
 */
export function optimizeRegularSetAllocation(regularSets: number): {
  ironCombos: number;
  doubleCombos: number;
  remainingSets: number;
  points: number;
} {
  let bestPoints = -1;
  let best = {
    ironCombos: 0,
    doubleCombos: 0,
    remainingSets: regularSets,
    points: regularSets * SCORING_VALUES.REGULAR_SET,
  };

  const maxIron = Math.floor(regularSets / 3);
  for (let i = 0; i <= maxIron; i++) {
    const remAfterIron = regularSets - i * 3;
    const maxDouble = Math.floor(remAfterIron / 2);
    for (let d = 0; d <= maxDouble; d++) {
      const rem = remAfterIron - d * 2;
      const pts =
        i * SCORING_VALUES.IRON +
        d * SCORING_VALUES.DOUBLE_COMBO +
        rem * SCORING_VALUES.REGULAR_SET;
      if (pts > bestPoints) {
        bestPoints = pts;
        best = { ironCombos: i, doubleCombos: d, remainingSets: rem, points: pts };
      }
    }
  }
  return best;
}

/**
 * Deterministic Set & Combo Optimizer.
 * Respects canonical contract:
 * - Golden takes precedence over Silver when structurally possible (Contract K)
 * - Silver forms only from remaining resources (Contract L)
 * - Remaining regular sets are deterministically optimized for maximum points.
 */
export function optimizeSetAllocation(
  availableJackSets: number,
  availableRegularSets: number
): OptimalSetAllocation {
  let remainingJackSets = availableJackSets;
  let remainingRegularSets = availableRegularSets;

  // 1. Golden Combo (Highest Priority under canonical contract): 1 Jack Set + 2 Regular Sets = 75 pts
  let goldenCombos = 0;
  if (remainingJackSets >= 1 && remainingRegularSets >= 2) {
    goldenCombos = Math.min(remainingJackSets, Math.floor(remainingRegularSets / 2));
    remainingJackSets -= goldenCombos * 1;
    remainingRegularSets -= goldenCombos * 2;
  }

  // 2. Silver Combo: 1 Jack Set + 1 Regular Set = 60 pts
  let silverCombos = 0;
  if (remainingJackSets >= 1 && remainingRegularSets >= 1) {
    silverCombos = Math.min(remainingJackSets, remainingRegularSets);
    remainingJackSets -= silverCombos * 1;
    remainingRegularSets -= silverCombos * 1;
  }

  // 3. Deterministically optimize remaining regular sets between Iron (50), Double (30), and Sets (12)
  const regAlloc = optimizeRegularSetAllocation(remainingRegularSets);

  const totalPoints =
    goldenCombos * SCORING_VALUES.GOLDEN +
    silverCombos * SCORING_VALUES.SILVER +
    regAlloc.ironCombos * SCORING_VALUES.IRON +
    regAlloc.doubleCombos * SCORING_VALUES.DOUBLE_COMBO +
    remainingJackSets * SCORING_VALUES.JACK_SET +
    regAlloc.remainingSets * SCORING_VALUES.REGULAR_SET;

  return {
    goldenCombos,
    silverCombos,
    ironCombos: regAlloc.ironCombos,
    doubleCombos: regAlloc.doubleCombos,
    jackSets: remainingJackSets,
    regularSets: regAlloc.remainingSets,
    totalPoints,
  };
}

/**
 * Calculates complete score breakdown from winning pile according to canonical baseline.
 */
export function calculateScores(winningPile: Card[], playerId: PlayerId): ScoreBreakdown {
  const log: string[] = [];

  // 1. Group cards by rank
  const rankGroups: Record<Rank, Card[]> = {
    A: [],
    '2': [],
    '3': [],
    '4': [],
    '5': [],
    '6': [],
    '7': [],
    '8': [],
    '9': [],
    '10': [],
    J: [],
    Q: [],
    K: [],
  };

  for (const card of winningPile) {
    rankGroups[card.rank].push(card);
  }

  const setDetails: SetDetail[] = [];
  let availableJackSets = 0;
  let availableRegularSets = 0;

  for (const rank of RANKS) {
    const cardsOfRank = rankGroups[rank];
    const fullSetsCount = Math.floor(cardsOfRank.length / 4);

    if (rank === 'J') {
      availableJackSets = fullSetsCount;
      if (fullSetsCount > 0) {
        setDetails.push({
          rank,
          cardCount: fullSetsCount * 4,
          isJackSet: true,
          isRegularSet: false,
          cards: cardsOfRank.slice(0, fullSetsCount * 4),
        });
      }
    } else {
      availableRegularSets += fullSetsCount;
      if (fullSetsCount > 0) {
        setDetails.push({
          rank,
          cardCount: fullSetsCount * 4,
          isJackSet: false,
          isRegularSet: true,
          cards: cardsOfRank.slice(0, fullSetsCount * 4),
        });
      }
    }
  }

  // 2. Deterministically optimize set & combo allocation for maximum score
  const allocation = optimizeSetAllocation(availableJackSets, availableRegularSets);

  const goldenCombos = allocation.goldenCombos;
  const goldenPoints = goldenCombos * SCORING_VALUES.GOLDEN;
  if (goldenCombos > 0) {
    log.push(
      `👑 المجموعة الذهبية (4 أولاد + مجموعتان عاديتان): +${goldenPoints} نقطة`
    );
  }

  const silverCombos = allocation.silverCombos;
  const silverPoints = silverCombos * SCORING_VALUES.SILVER;
  if (silverCombos > 0) {
    log.push(
      `🥈 المجموعة الفضية (4 أولاد + مجموعة عادية): +${silverPoints} نقطة`
    );
  }

  const ironCombos = allocation.ironCombos;
  const ironPoints = ironCombos * SCORING_VALUES.IRON;
  if (ironCombos > 0) {
    log.push(
      `⚖️ المجموعة الحديدية (3 مجموعات عادية): +${ironPoints} نقطة`
    );
  }

  const doubleCombos = allocation.doubleCombos;
  const doublePoints = doubleCombos * SCORING_VALUES.DOUBLE_COMBO;
  if (doubleCombos > 0) {
    log.push(
      `✨ المجموعة الثنائية (مجموعتان عاديتان): +${doublePoints} نقطة`
    );
  }

  const regularSets = allocation.regularSets;
  const regularSetPoints = regularSets * SCORING_VALUES.REGULAR_SET;
  if (regularSets > 0) {
    log.push(`📚 مجموعات عادية (${regularSets} × 12 نقطة): +${regularSetPoints} نقطة`);
  }

  const jackSets = allocation.jackSets;
  const jackSetPoints = jackSets * SCORING_VALUES.JACK_SET;
  if (jackSets > 0) {
    log.push(`🎴 مجموعة الأولاد (4 أولاد): +${jackSetPoints} نقطة`);
  }

  // 7. Single Jacks (unconsumed Jacks outside all sets/combos): 3 points each
  const totalJacksInPile = rankGroups.J.length;
  const totalJacksUsed = availableJackSets * 4;
  const remainingJacks = Math.max(0, totalJacksInPile - totalJacksUsed);
  const jackPoints = remainingJacks * SCORING_VALUES.JACK_CARD;
  if (remainingJacks > 0) {
    log.push(`🃏 أولاد فردية (${remainingJacks} × 3 نقاط): +${jackPoints} نقطة`);
  }

  // 8. Single Regular Cards (unconsumed regular cards outside all sets/combos): 1 point each
  let totalOtherInPile = 0;
  for (const rank of RANKS) {
    if (rank !== 'J') {
      totalOtherInPile += rankGroups[rank].length;
    }
  }
  const totalOtherCardsUsedInSets = availableRegularSets * 4;
  const remainingOtherCards = Math.max(0, totalOtherInPile - totalOtherCardsUsedInSets);
  const cardPoints = remainingOtherCards * SCORING_VALUES.OTHER_CARD;
  if (remainingOtherCards > 0) {
    log.push(`🃏 أوراق فردية (${remainingOtherCards} × نقطة): +${cardPoints} نقطة`);
  }

  const totalScore =
    goldenPoints +
    silverPoints +
    ironPoints +
    doublePoints +
    jackSetPoints +
    regularSetPoints +
    jackPoints +
    cardPoints;

  return {
    playerId,
    totalScore,
    totalCards: winningPile.length,
    cardPoints,
    jackCount: totalJacksInPile,
    jackPoints,
    goldenCombos,
    goldenPoints,
    silverCombos,
    silverPoints,
    ironCombos,
    ironPoints,
    balancedCombos: ironCombos,
    balancedPoints: ironPoints,
    tribleCombos: ironCombos,
    triblePoints: ironPoints,
    doubleCombos,
    doublePoints,
    jackSets,
    jackSetPoints,
    regularSets,
    regularSetPoints,
    sets: setDetails,
    remainingJacks,
    remainingOtherCards,
    log,
  };
}

/**
 * Canonical check to determine if a genuine Winning Pile Steal occurred.
 *
 * Success requires:
 * 1. Actor was the player.
 * 2. Capture involved the winning pile (WINNING_PILE or MULTI_SOURCE with isTopUniformCapture).
 * 3. CPU winning pile was reduced.
 * 4. Player winning pile increased.
 * 5. Stolen cards explicitly originated from WINNING_PILE in canonical origins metadata.
 *
 * Fail-closed policy: If origins are missing or empty, returns isSteal: false without rank reconstruction.
 */
export function isCanonicalStealOccurred(
  prevGame: GameState,
  nextGame: GameState
): {
  isSteal: boolean;
  stolenCards: Card[];
} {
  const latestAction = nextGame.actionHistory[nextGame.actionHistory.length - 1];
  if (!latestAction || latestAction.actor !== 'player' || !latestAction.captureResult) {
    return { isSteal: false, stolenCards: [] };
  }

  const { captureResult } = latestAction;
  const hasWinningPileSource =
    Boolean(captureResult.isTopUniformCapture) &&
    (captureResult.capturedFrom === 'WINNING_PILE' ||
      captureResult.capturedFrom === 'MULTI_SOURCE' ||
      captureResult.sources?.includes('WINNING_PILE') ||
      captureResult.capturedWithOrigins?.some((c) => c.source === 'WINNING_PILE'));

  // Pile size divergence: CPU pile must have decreased, Player pile must have increased
  const cpuPileDecreased = prevGame.cpuWinningPile.length > nextGame.cpuWinningPile.length;
  const playerPileIncreased = nextGame.playerWinningPile.length > prevGame.playerWinningPile.length;

  const stolenCards = Array.isArray(captureResult.capturedWithOrigins)
    ? captureResult.capturedWithOrigins
        .filter((c) => c.source === 'WINNING_PILE')
        .map((c) => c.card)
    : [];

  const isSteal = hasWinningPileSource && cpuPileDecreased && playerPileIncreased && stolenCards.length > 0;
  return { isSteal, stolenCards };
}

