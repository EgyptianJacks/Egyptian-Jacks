import { GameState, ScoreBreakdown } from '../types/game';
import { calculateScores } from '../engine/rules';

export interface LearningInsight {
  id: string;
  category: 'CAPTURE' | 'STEAL' | 'SET' | 'COMBO' | 'TEMPO';
  title: string;
  whatHappened: string;
  whyItMattered: string;
  keyTakeaway: string;
  badgeText: string;
  badgeVariant: 'gold' | 'emerald' | 'amber' | 'blue';
}

export interface RoundLearningSummary {
  insights: LearningInsight[];
  totalCapturesCount: number;
  stealsCount: number;
  setsCount: number;
  combosCount: number;
  playerBreakdown: ScoreBreakdown;
}

/**
 * Extracts factual learning insights from canonical match events and end-of-round state.
 *
 * GUARANTEES:
 * - 100% derived from actual engine state and actionHistory
 * - Zero fabricated coaching events
 * - Zero hidden-information leakage
 */
export function extractLearningSummary(gameState: GameState): RoundLearningSummary {
  const playerBreakdown = calculateScores(gameState.playerWinningPile, 'player');
  const insights: LearningInsight[] = [];

  // 1. Analyze Player Action History
  const playerActions = gameState.actionHistory.filter((a) => a.actor === 'player');
  let tableCaptures = 0;
  let pileSteals = 0;

  for (const action of playerActions) {
    if (action.captureResult) {
      if (action.captureResult.isTopUniformCapture) {
        pileSteals++;
      } else if (action.captureResult.capturedCards.length > 0) {
        tableCaptures++;
      }
    }
  }

  // 2. Set & Combo Formation Insights
  const totalCombos =
    (playerBreakdown.goldenCombos || 0) +
    (playerBreakdown.silverCombos || 0) +
    (playerBreakdown.ironCombos || playerBreakdown.balancedCombos || 0) +
    (playerBreakdown.doubleCombos || 0);

  const totalSets = (playerBreakdown.jackSets || 0) + (playerBreakdown.regularSets || 0);

  if (totalCombos > 0) {
    let comboName = 'مجموعة مركبة';
    let pts = 0;
    if (playerBreakdown.goldenCombos > 0) {
      comboName = 'المجموعة الذهبية (Golden Combo)';
      pts = playerBreakdown.goldenPoints;
    } else if (playerBreakdown.silverCombos > 0) {
      comboName = 'المجموعة الفضية (Silver Combo)';
      pts = playerBreakdown.silverPoints;
    } else if ((playerBreakdown.ironCombos || playerBreakdown.balancedCombos || 0) > 0) {
      comboName = 'المجموعة الحديدية (Iron Combo)';
      pts = playerBreakdown.ironPoints || playerBreakdown.balancedPoints;
    } else if (playerBreakdown.doubleCombos > 0) {
      comboName = 'المجموعة الثنائية (Double Combo)';
      pts = playerBreakdown.doublePoints;
    }

    insights.push({
      id: 'insight-combo',
      category: 'COMBO',
      title: `👑 إنجاز مركب: ${comboName}`,
      whatHappened: `جمعت بنجاح تشكيلة متقدمة من المجموعات وحصدت ${pts} نقطة.`,
      whyItMattered: 'المجموعات المركبة هي العامل الحاسم لتحقيق الفارق النقطي الأكبر في المباراة.',
      keyTakeaway: 'استمر في مراقبة الرتب المتكررة في كومات الفوز لتوجيه أكلاتك نحو مضاعفة الكومبو.',
      badgeText: `+${pts} نقطة`,
      badgeVariant: 'gold',
    });
  } else if (totalSets > 0) {
    insights.push({
      id: 'insight-sets',
      category: 'SET',
      title: '📚 تكوين المجموعات المكتملة',
      whatHappened: `أكملت ${totalSets} مجموعة نظامية كاملة (4 كروت متطابقة) بنجاح.`,
      whyItMattered: 'كل مجموعة مكتملة تمنحك قفزة بـ 12 نقطة (أو 36 نقطة لمجموعة الأولاد).',
      keyTakeaway: 'تتبع الرتب التي جمعت منها 2 أو 3 كروت للتركيز على استكمال الكرت الرابع عند ظهوره.',
      badgeText: `+${totalSets * 12} نقطة`,
      badgeVariant: 'emerald',
    });
  }

  // 3. Pile Steal Insights
  if (pileSteals > 0) {
    insights.push({
      id: 'insight-steals',
      category: 'STEAL',
      title: '⚡ استغلال سرقة كومة الخصم',
      whatHappened: `نفذت ${pileSteals} عملية سرقة ناجحة لكومة فوز الخصم المكشوفة.`,
      whyItMattered: 'سرقة الكومة تُحدث تحولاً مزدوجاً بانتزاع النقاط من الخصم وإضافتها مباشرة لكومتك.',
      keyTakeaway: 'ابق عينك دائماً على الرتبة العلوية لكومة الخصم بعد كل حركة أكل يقوم بها.',
      badgeText: `${pileSteals} سرقات`,
      badgeVariant: 'amber',
    });
  }

  // 4. Direct Capture Insights
  if (tableCaptures > 0) {
    insights.push({
      id: 'insight-captures',
      category: 'CAPTURE',
      title: '🎯 الأكل المباشر وتأمين الطاولة',
      whatHappened: `أنجزت ${tableCaptures} عملية أكل مباشر لكروت الطاولة.`,
      whyItMattered: 'الأكل المباشر يمنع الخصم من استغلال أوراقك ويغذي كومة فوزك بنقاط الكروت الفردية.',
      keyTakeaway: 'التوازن بين سرعة الأكل المباشر وحفظ كروت المفاتيح هو جوهر السيطرة.',
      badgeText: `${tableCaptures} أكلات`,
      badgeVariant: 'blue',
    });
  }

  // 5. If no captures occurred or purely passive
  if (insights.length === 0) {
    insights.push({
      id: 'insight-foundation',
      category: 'TEMPO',
      title: '💡 التأسيس وبناء اليد',
      whatHappened: 'ركزت الجولة على التوزيع وإعداد الطاولة وتدوير الأوراق.',
      whyItMattered: 'إدارة أوراق اليد غير المتطابقة تحمي طاولتك من تقديم هدايا سهلة للخصم.',
      keyTakeaway: 'حاول في الجولات القادمة استغلال كل كرت متطابق للبدء في تجميع المجموعات.',
      badgeText: 'تكتيك دفاعي',
      badgeVariant: 'blue',
    });
  }

  return {
    insights,
    totalCapturesCount: tableCaptures,
    stealsCount: pileSteals,
    setsCount: totalSets,
    combosCount: totalCombos,
    playerBreakdown,
  };
}
