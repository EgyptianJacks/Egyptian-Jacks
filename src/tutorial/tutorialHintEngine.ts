import { GameState, Card } from '../types/game';
import { TutorialLesson, HintLevel, TutorialHint } from './tutorialTypes';
import { evaluateCapture } from '../engine/rules';

/**
 * Egyptian Jacks — Contextual Hint Engine (A5)
 *
 * Responsibilities:
 * - Generates pedagogically staged hints (Level 1 Attention -> Level 2 Target -> Level 3 Action).
 * - Strictly operates ONLY on player-visible state (Player Hand, Visible Tables, CPU Winning Pile Top).
 * - STRICT ISOLATION: Never accesses or leaks CPU hidden hand or deck card contents.
 */

export function generateContextualHint(
  lesson: TutorialLesson,
  gameState: GameState,
  hintLevel: HintLevel,
  _attempts = 0
): TutorialHint | null {
  if (hintLevel === 0) {
    return null;
  }

  // Hidden Information Safety: only read visible game components
  const playerHand = gameState.playerHand;
  const playerTable = gameState.table.playerTable;
  const opponentTable = gameState.table.opponentTable;
  const cpuWinningPile = gameState.cpuWinningPile;
  const viewMode = gameState.table.viewMode;

  // Find all possible legal capture moves using the canonical rules evaluator
  const captureMoves = playerHand
    .map((card) => {
      const evaluation = evaluateCapture(
        card,
        playerTable,
        opponentTable,
        cpuWinningPile,
        viewMode
      );
      return {
        card,
        capturedCards: evaluation.captureResult.capturedCards,
        capturedFrom: evaluation.captureResult.capturedFrom,
      };
    })
    .filter((m) => m.capturedCards.length > 0);

  if (lesson === 1) {
    // Lesson 1: Direct Table Capture (Rank Matching)
    const matchingMove = captureMoves.find(
      (m) => m.capturedFrom === 'PLAYER_TABLE' || m.capturedFrom === 'OPPONENT_TABLE'
    ) || captureMoves[0];

    const targetTableCard = matchingMove?.capturedCards.find(
      (c) => c.id !== matchingMove.card.id
    );

    if (hintLevel === 1) {
      return {
        level: 1,
        title: 'تلميح المفاهيم',
        message:
          'ابحث عن كرت في يدك يمتلك نفس رتبة (رقم) أحد الكروت المكشوفة أمامك على الطاولة.',
        highlightTarget: 'PLAYER_HAND',
      };
    }

    if (hintLevel === 2) {
      const tableRank = targetTableCard ? targetTableCard.rank : '9';
      return {
        level: 2,
        title: 'تلميح توجيهي',
        message: `انظر إلى الكروت المكشوفة على الطاولة؛ يوجد كرت برتبة (${tableRank}). هل تملك كرت (${tableRank}) في يدك؟`,
        highlightTarget: 'PLAYER_TABLE',
        suggestedCardRank: tableRank,
      };
    }

    if (hintLevel === 3) {
      const playCardStr = matchingMove
        ? `${matchingMove.card.rank}${matchingMove.card.suit}`
        : '9♥';
      const targetStr = targetTableCard
        ? `${targetTableCard.rank}${targetTableCard.suit}`
        : '9♣';

      return {
        level: 3,
        title: 'توجيه مباشر',
        message: `العب الكرت ${playCardStr} من يدك لمطابقة ${targetStr} على الطاولة وأكلهما إلى كومة فوزك.`,
        highlightTarget: 'PLAYER_HAND',
        suggestedCardRank: matchingMove?.card.rank || '9',
      };
    }
  }

  if (lesson === 2) {
    // Lesson 2: Opponent Winning Pile Steal
    const topCpuCard = cpuWinningPile.length > 0 ? cpuWinningPile[cpuWinningPile.length - 1] : null;
    const stealMove = captureMoves.find(
      (m) => m.capturedFrom === 'WINNING_PILE' || m.capturedFrom === 'MULTI_SOURCE'
    ) || captureMoves[0];

    const topRank = topCpuCard ? topCpuCard.rank : '7';
    const topCardStr = topCpuCard ? `${topCpuCard.rank}${topCpuCard.suit}` : '7♦';
    const playCardStr = stealMove ? `${stealMove.card.rank}${stealMove.card.suit}` : '7♥';

    if (hintLevel === 1) {
      return {
        level: 1,
        title: 'تلميح استراتيجي',
        message: 'راقب كومة فوز الخصم. الكرت العلوي المكشوف ليس محمياً ويمكن الاستيلاء عليه إذا طابقت رتبته.',
        highlightTarget: 'WINNING_PILE',
      };
    }

    if (hintLevel === 2) {
      return {
        level: 2,
        title: 'تلميح توجيهي',
        message: `الكرت العلوي في كومة فوز الخصم هو (${topRank}). هل تملك كرت (${topRank}) في يدك لسرقة الكومة؟`,
        highlightTarget: 'WINNING_PILE',
        suggestedCardRank: topRank,
      };
    }

    if (hintLevel === 3) {
      return {
        level: 3,
        title: 'توجيه مباشر',
        message: `العب الكرت ${playCardStr} من يدك لمطابقة الكرت العلوي ${topCardStr} في كومة الخصم، وسرقة الكومة بالكامل إلى كومة فوزك!`,
        highlightTarget: 'PLAYER_HAND',
        suggestedCardRank: stealMove?.card.rank || '7',
      };
    }
  }

  if (lesson === 3) {
    // Lesson 3: Pattern Recognition & High-Value Combos (4-card Regular Sets)
    if (hintLevel === 1) {
      return {
        level: 1,
        title: 'تلميح استكشافي',
        message: 'راقب كروت الطاولة بعناية: هل تلاحظ رتبة معينة مكررة وموزعة على الطاولتين؟',
        highlightTarget: 'PLAYER_TABLE',
      };
    }

    if (hintLevel === 2) {
      return {
        level: 2,
        title: 'تلميح تشكيل المجموعات',
        message: 'توجد 3 كروت برتبة آس (A) مكشوفة على الطاولات. تجميع 4 كروت من نفس الرتبة يمنحك مجموعة ملكية كاملة (+12 نقطة).',
        highlightTarget: 'PLAYER_TABLE',
        suggestedCardRank: 'A',
      };
    }

    if (hintLevel === 3) {
      return {
        level: 3,
        title: 'توجيه مباشر',
        message: 'العب كرت A♥ من يدك لأكل كروت الآس الثلاثة من الطاولتين في حركة واحدة وتشكيل مجموعة كاملة!',
        highlightTarget: 'PLAYER_HAND',
        suggestedCardRank: 'A',
      };
    }
  }

  if (lesson === 4) {
    // Lesson 4: Strategic Sacrifice & Timing Decision
    if (hintLevel === 1) {
      return {
        level: 1,
        title: 'تلميح استراتيجي',
        message: 'فكر في موازنة اللعب: هل الأفضل أن تأكل فوراً لتأمين نقطتين، أم تحتفظ بكروت الأكل القوية وتضحي بكرت غير ضروري؟',
        highlightTarget: 'PLAYER_HAND',
      };
    }

    if (hintLevel === 2) {
      return {
        level: 2,
        title: 'تلميح الخيارات التكتيكية',
        message: 'لديك خياران: أكل فوري بالكرت (6♦ أو 5♠) لتأمين نقاط وحماية طاولتك، أو التضحية بكرت (3♦ أو K♦) للاحتفاظ بأوراق الأكل القوية.',
        highlightTarget: 'PLAYER_HAND',
        suggestedCardRank: '6',
      };
    }

    if (hintLevel === 3) {
      return {
        level: 3,
        title: 'توجيه القرار',
        message: 'العب 6♦ للأكل اللحظي وحصاد النقاط، أو العب 3♦ للتضحية والتريث التكتيكي.',
        highlightTarget: 'PLAYER_HAND',
        suggestedCardRank: '6',
      };
    }
  }

  // Fallback for general lessons if needed
  if (hintLevel === 1) {
    return {
      level: 1,
      title: 'تلميح عام',
      message: 'اختر الكرت المناسب وفقاً للهدف التعليمي للدرس الحالي.',
    };
  }

  return null;
}

/**
 * Evaluates whether a hint should advance to the next level
 */
export function getNextHintLevel(currentLevel: HintLevel): HintLevel {
  if (currentLevel >= 3) return 3;
  return (currentLevel + 1) as HintLevel;
}

/**
 * Maps player HintsIntensity preference to initial HintLevel
 */
export function getHintLevelForIntensity(intensity: 'high' | 'medium' | 'low' | 'off'): HintLevel {
  switch (intensity) {
    case 'off':
      return 0;
    case 'low':
      return 1;
    case 'medium':
      return 2;
    case 'high':
      return 3;
    default:
      return 1;
  }
}
