import { Card, GameState } from '../types/game';
import {
  TutorialLesson,
  TutorialRuntimeState,
  HintLevel,
} from './tutorialTypes';
import { TUTORIAL_SETUPS } from './tutorialSetups';
import { createInitialGame, playPlayerCard, executeCpuTurn } from '../engine/gameEngine';
import { calculateScores, isCanonicalStealOccurred } from '../engine/rules';
import { detectNewlyCompletedCollection } from '../engine/collectionDetector';
import { generateContextualHint, getNextHintLevel } from './tutorialHintEngine';

/**
 * Egyptian Jacks — Tutorial Runtime Controller (A4)
 *
 * Responsibilities:
 * - Manages tutorial lesson lifecycle (Start, Decision Point, Engine Observation, Feedback, Complete, Reset).
 * - Orchestrates gameplay strictly via canonical game engine (createInitialGame, playPlayerCard, executeCpuTurn).
 * - Observes actual game state mutations to verify true pedagogical success or diagnose suboptimal plays.
 * - Enforces zero fake engines, zero fake states, and zero fake animations.
 */

export function createInitialTutorialRuntime(lesson: TutorialLesson = 1): {
  runtimeState: TutorialRuntimeState;
  initialGame: GameState;
} {
  const setup = TUTORIAL_SETUPS[lesson];
  let initialGame = createInitialGame(setup.seed, 'player');

  let lessonTitle = 'الدرس 1: الأكل المباشر ومطابقة الرتب';
  let targetConcept = 'مطابقة الرتب من الطاولة المكشوفة';
  let objective = 'تعلم كيف تأكل الكروت من الطاولة المكشوفة بمطابقة رتبة الكرت من يدك.';
  let prompt = 'اختر كرت 9♥ من يدك لمطابقة كرت 9♣ على طاولتك وأكلهما معاً إلى كومة فوزك.';

  if (lesson === 2) {
    lessonTitle = 'الدرس 2: سرقة كومة فوز الخصم';
    targetConcept = 'استغلال الورقة العلوية المكشوفة لكومة فوز الخصم';
    objective = 'تعلم كيف تستولي على كومة فوز الخصم عبر مطابقة الكرت العلوي المكشوف.';
    prompt = 'الخصم جمع كروتاً في كومة فوزه والكرت العلوي المكشوف هو 7♦. العب 7♥ من يدك لسرقة الكومة كاملة!';

    // Execute the deterministic legal prelude through canonical gameEngine
    // 1. Player plays non-capturing 7♠ to table (cardId: 45)
    // 2. CPU plays 7♦ and legally captures 7♠ into cpuWinningPile
    const playerPreludeCard = initialGame.playerHand.find((c) => c.id === '45' || (c.rank === '7' && c.suit === '♠'));
    if (playerPreludeCard) {
      initialGame = playPlayerCard(initialGame, playerPreludeCard.id);
      if (initialGame.phase === 'CPU_TURN') {
        initialGame = executeCpuTurn(initialGame);
      }
    }
  } else if (lesson === 3) {
    lessonTitle = 'الدرس 3: بناء المجموعات الملكية (Sets & Combos)';
    targetConcept = 'تجميع 4 كروت من نفس الرتبة لحساب النقاط الكبرى';
    objective = 'تعلم كيف تكمل تشكيل 4 كروت متشابهة لتكوين مجموعة قانونية (+12 نقطة).';
    prompt = 'العب الكرت الذي يجمع لك باقي كروت الرتبة الموزعة على الطاولات.';
  } else if (lesson === 4) {
    lessonTitle = 'الدرس 4: التضحية والتوقيت الاستراتيجي';
    targetConcept = 'إدارة التوقيت والاحتفاظ بكروت الأكل القوية';
    objective = 'تعلم الفرق بين الأكل المتسرع والتضحية الواعية للتحكم بمسار الجولة.';
    prompt = 'قارن بين الأكل اللحظي والانتظار التكتيكي للتحكم في اللعب.';
  }

  const runtimeState: TutorialRuntimeState = {
    status: 'AWAITING_ACTION',
    lesson,
    stepNumber: 1,
    setupId: setup.setupId,
    seed: setup.seed,
    lessonTitle,
    targetConcept,
    objective,
    prompt,
    hintLevel: 0,
    currentHint: null,
    attempts: 0,
    lastPlayedCardId: null,
    feedbackTitle: null,
    feedbackMessage: null,
    isSuccess: false,
    canReplay: true,
  };

  return { runtimeState, initialGame };
}

/**
 * Evaluates the player's action after canonical engine execution.
 */
export function evaluateTutorialActionResult(
  currentRuntime: TutorialRuntimeState,
  _prevGameState: GameState,
  nextGameState: GameState,
  playedCard: Card
): TutorialRuntimeState {
  const latestAction =
    nextGameState.actionHistory[nextGameState.actionHistory.length - 1];
  const captureResult = latestAction?.captureResult;
  const capturedCards = captureResult?.capturedCards || [];

  if (currentRuntime.lesson === 1) {
    // Lesson 1 Goal: Direct Table Capture (Match rank 9)
    const matchedRank = playedCard.rank === '9';
    const hasCapturedTarget =
      capturedCards.some((c) => c.rank === '9' && c.id !== playedCard.id) ||
      nextGameState.playerWinningPile.some((c) => c.rank === '9' && c.id !== playedCard.id);

    if (matchedRank && hasCapturedTarget && nextGameState.playerWinningPile.length >= 2) {
      // SUCCESS!
      return {
        ...currentRuntime,
        status: 'SUCCESS_FEEDBACK',
        lastPlayedCardId: playedCard.id,
        attempts: currentRuntime.attempts + 1,
        isSuccess: true,
        feedbackTitle: 'أكل ناجح ومطابقة متقنة! 🎉',
        feedbackMessage:
          'ممتاز! قمت بلعب 9♥ وطابقت كرت 9♣ على الطاولة. تم أكل الكرتين ونقلهما بنجاح إلى كومة فوزك لتجميع النقاط.',
      };
    } else {
      // SUBOPTIMAL / MISSED CAPTURE
      return {
        ...currentRuntime,
        status: 'SUBOPTIMAL_FEEDBACK',
        lastPlayedCardId: playedCard.id,
        attempts: currentRuntime.attempts + 1,
        isSuccess: false,
        feedbackTitle: 'حركة غير مطابقة ⚠️',
        feedbackMessage:
          'هذا الكرت لم يطابق أي كرت مكشوف على الطاولة، فتمت إضافته إلى الطاولة دون أكل. اضغط "إعادة المحاولة" لتجربة مطابقة رتبة صحيحة.',
      };
    }
  }

  if (currentRuntime.lesson === 2) {
    // Lesson 2 Goal: Winning Pile Steal
    // Canonical Engine validation via authoritative isCanonicalStealOccurred:
    // Success ONLY when canonical engine reports winning pile source and top uniform capture,
    // actual cards were transferred from WINNING_PILE, and opponent winning pile was reduced.
    const { isSteal: isPileSteal } = isCanonicalStealOccurred(_prevGameState, nextGameState);

    if (isPileSteal) {
      // SUCCESS!
      return {
        ...currentRuntime,
        status: 'SUCCESS_FEEDBACK',
        lastPlayedCardId: playedCard.id,
        attempts: currentRuntime.attempts + 1,
        isSuccess: true,
        feedbackTitle: 'سرقة ناجحة لكومة فوز الخصم! ⚡',
        feedbackMessage:
          'رائع! قمت بلعب 7♥ وطابقت الكرت العلوي 7♦ في كومة فوز الخصم. استوليت على كامل الكومة ونقلتها إلى كومة فوزك!',
      };
    } else {
      // SUBOPTIMAL / MISSED PILE STEAL
      return {
        ...currentRuntime,
        status: 'SUBOPTIMAL_FEEDBACK',
        lastPlayedCardId: playedCard.id,
        attempts: currentRuntime.attempts + 1,
        isSuccess: false,
        feedbackTitle: 'حركة قانونية لكنها فوتت سرقة الكومة ⚠️',
        feedbackMessage:
          'هذه حركة قانونية، ولكن راقب كومة فوز الخصم: الكرت العلوي المكشوف (7♦) كان معرضاً للسرقة لو لعبت كرت (7) من يدك. اضغط "إعادة المحاولة" لتجربة السرقة.',
      };
    }
  }

  if (currentRuntime.lesson === 3) {
    // Lesson 3 Goal: Pattern Recognition & Set Formation
    // Canonical Engine validation:
    // Success ONLY when Collection Detector / canonical scoring confirms the set/combo.
    // Playing the completing card alone is not enough.
    const prevScores = calculateScores(_prevGameState.playerWinningPile, 'player');
    const nextScores = calculateScores(nextGameState.playerWinningPile, 'player');
    const collectionEvent = detectNewlyCompletedCollection(prevScores, nextScores, 'player');

    const hasNewRegularSet = nextScores.regularSets > prevScores.regularSets;
    const scoreConfirmed = nextScores.regularSetPoints > prevScores.regularSetPoints;
    const completedSet =
      (hasNewRegularSet && scoreConfirmed) ||
      collectionEvent?.type === 'REGULAR_SET';

    if (completedSet) {
      // SUCCESS!
      return {
        ...currentRuntime,
        status: 'SUCCESS_FEEDBACK',
        lastPlayedCardId: playedCard.id,
        attempts: currentRuntime.attempts + 1,
        isSuccess: true,
        feedbackTitle: 'تشكيل مجموعة ملكية مكتملة (+12 نقطة)! 👑',
        feedbackMessage:
          'رائع جداً! استطعت تمييز كروت الآس (A) المكشوفة على الطاولتين، ولعبت A♥ لتجمع كافة كروت الآس الأربعة وتكوين مجموعة نظامية كاملة (Regular Set) تمنحك +12 نقطة!',
      };
    } else {
      // SUBOPTIMAL / MISSED SET
      return {
        ...currentRuntime,
        status: 'SUBOPTIMAL_FEEDBACK',
        lastPlayedCardId: playedCard.id,
        attempts: currentRuntime.attempts + 1,
        isSuccess: false,
        feedbackTitle: 'حركة قانونية لكنها فوتت تكوين المجموعة ⚠️',
        feedbackMessage:
          'لاحظ الطاولتين: توجد 3 كروت برتبة آس (A♦ و A♣ على طاولتك، و A♠ على طاولة الخصم). لو لعبت A♥ من يدك لاستوليت على جميع كروت الآس وكونت مجموعة مكتملة (+12 نقطة). اضغط "إعادة المحاولة" لتجربة تجميعها.',
      };
    }
  }

  if (currentRuntime.lesson === 4) {
    // Lesson 4 Goal: Strategic Sacrifice & Timing Decision
    const isCaptureMove = playedCard.rank === '6' || playedCard.rank === '5';
    const isSacrificeMove = playedCard.rank === '3' || playedCard.rank === 'K';

    if (isCaptureMove) {
      return {
        ...currentRuntime,
        status: 'SUCCESS_FEEDBACK',
        lastPlayedCardId: playedCard.id,
        attempts: currentRuntime.attempts + 1,
        isSuccess: true,
        feedbackTitle: 'خيار الأكل اللحظي وتأمين النقاط! ⚡',
        feedbackMessage:
          `اخترت الأكل المباشر بالكرت ${playedCard.rank}${playedCard.suit}. هذا الخيار يضمن لك تأمين كرتين في كومة فوزك (+2 نقطة) وحماية طاولتك، ولكنه استهلك كرت أكل قوي من يدك.`,
      };
    }

    if (isSacrificeMove) {
      return {
        ...currentRuntime,
        status: 'SUCCESS_FEEDBACK',
        lastPlayedCardId: playedCard.id,
        attempts: currentRuntime.attempts + 1,
        isSuccess: true,
        feedbackTitle: 'خيار التضحية والتحكم بالتوقيت! ⏳',
        feedbackMessage:
          `اخترت التضحية بالكرت ${playedCard.rank}${playedCard.suit}. هذا الخيار يؤجل الأكل اللحظي لكنه يحافظ على كروت الأكل القوية (6♦ و 5♠) في يدك لردود تكتيكية لاحقة.`,
      };
    }
  }

  // Fallback for generic actions
  return {
    ...currentRuntime,
    status: 'SUCCESS_FEEDBACK',
    lastPlayedCardId: playedCard.id,
    isSuccess: true,
    feedbackTitle: 'تم تنفيذ الحركة',
    feedbackMessage: 'تم تنفيذ الحركة في المحرك القانوني بنجاح.',
  };
}

/**
 * Handles requesting a progressive hint
 */
export function requestTutorialHint(
  currentRuntime: TutorialRuntimeState,
  gameState: GameState
): TutorialRuntimeState {
  const nextLevel = getNextHintLevel(currentRuntime.hintLevel);
  const hint = generateContextualHint(
    currentRuntime.lesson,
    gameState,
    nextLevel,
    currentRuntime.attempts
  );

  return {
    ...currentRuntime,
    hintLevel: nextLevel,
    currentHint: hint,
  };
}

/**
 * Completes the current lesson
 */
export function completeTutorialLesson(
  currentRuntime: TutorialRuntimeState
): TutorialRuntimeState {
  if (currentRuntime.lesson === 2) {
    return {
      ...currentRuntime,
      status: 'LESSON_COMPLETE',
      feedbackTitle: 'اكتمل درس سرقة الكومة بنجاح! 🏆',
      feedbackMessage:
        'أتقنت الآن مهارة مراقبة واستغلال الورقة العلوية المكشوفة لكومة فوز الخصم. تذكر دائماً: الكومة المكشوفة فرصة استراتيجية مستمرة في اللعبة.',
    };
  }

  if (currentRuntime.lesson === 3) {
    return {
      ...currentRuntime,
      status: 'LESSON_COMPLETE',
      feedbackTitle: 'اكتمل درس تشكيل المجموعات بنجاح! 👑',
      feedbackMessage:
        'أتقنت الآن مهارة تمييز الأنماط وبناء المجموعات الملكية (Sets) لتحقيق أعلى النقاط في اللعبة.',
    };
  }

  if (currentRuntime.lesson === 4) {
    return {
      ...currentRuntime,
      status: 'LESSON_COMPLETE',
      feedbackTitle: 'اكتمل درس التضحية والتوقيت الاستراتيجي بنجاح! ⏳',
      feedbackMessage:
        'أتقنت الآن فن التضحية وإدارة التوقيت والتحكم في إيقاع المباراة بين الأكل الفوري والاحتفاظ الاستراتيجي.',
    };
  }

  return {
    ...currentRuntime,
    status: 'LESSON_COMPLETE',
    feedbackTitle: 'اكتمل الدرس الأول بنجاح! 🏆',
    feedbackMessage:
      'أتقنت الآن قاعدة الأكل المباشر ومطابقة الرتب من الطاولة. يمكنك العودة إلى الصالة الرئيسية أو إعادة تشغيل الدرس لتثبيت المفهوم.',
  };
}
