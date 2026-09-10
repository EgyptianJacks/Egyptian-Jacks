import { PlayerId, ScoreBreakdown } from '../types/game';
import { CollectionEvent } from '../components/CollectionFeedbackLayer';

/**
 * Compares before and after score breakdowns to detect newly completed canonical collections.
 */
export function detectNewlyCompletedCollection(
  before: ScoreBreakdown,
  after: ScoreBreakdown,
  actor: PlayerId
): CollectionEvent | null {
  // 1. Golden Combo (+75)
  if (after.goldenCombos > before.goldenCombos) {
    return {
      id: `coll_${actor}_golden_${Date.now()}`,
      actor,
      type: 'GOLDEN_COMBO',
      title: 'المجموعة الذهبية',
      scoreBonus: 75,
    };
  }

  // 2. Silver Combo (+60)
  if (after.silverCombos > before.silverCombos) {
    return {
      id: `coll_${actor}_silver_${Date.now()}`,
      actor,
      type: 'SILVER_COMBO',
      title: 'المجموعة الفضية',
      scoreBonus: 60,
    };
  }

  // 3. Iron / Balanced Combo (+50)
  const afterIron = after.ironCombos ?? after.balancedCombos ?? after.tribleCombos ?? 0;
  const beforeIron = before.ironCombos ?? before.balancedCombos ?? before.tribleCombos ?? 0;
  if (afterIron > beforeIron) {
    return {
      id: `coll_${actor}_iron_${Date.now()}`,
      actor,
      type: 'BALANCED_COMBO',
      title: 'المجموعة الحديدية',
      scoreBonus: 50,
    };
  }

  // 4. Double Combo (+30)
  const afterDouble = after.doubleCombos ?? 0;
  const beforeDouble = before.doubleCombos ?? 0;
  if (afterDouble > beforeDouble) {
    return {
      id: `coll_${actor}_double_${Date.now()}`,
      actor,
      type: 'DOUBLE_COMBO',
      title: 'المجموعة الثنائية',
      scoreBonus: 30,
    };
  }

  // 5. Jack Set (+36)
  if (after.jackSets > before.jackSets) {
    return {
      id: `coll_${actor}_jack_${Date.now()}`,
      actor,
      type: 'JACK_SET',
      title: 'مجموعة الأولاد',
      scoreBonus: 36,
    };
  }

  // 6. Regular Set (+12)
  if (after.regularSets > before.regularSets) {
    // Find which rank completed
    const newSets = after.sets.filter((s) => s.isRegularSet);
    const oldSets = before.sets.filter((s) => s.isRegularSet);
    const newRankSet = newSets.find((ns) => {
      const oldMatch = oldSets.find((os) => os.rank === ns.rank);
      return !oldMatch || ns.cardCount > oldMatch.cardCount;
    });

    const rankLabel = newRankSet?.rank ? ` (${newRankSet.rank})` : '';

    return {
      id: `coll_${actor}_regular_${Date.now()}`,
      actor,
      type: 'REGULAR_SET',
      title: `مجموعة عادية${rankLabel}`,
      scoreBonus: 12,
      rank: newRankSet?.rank,
    };
  }

  return null;
}
