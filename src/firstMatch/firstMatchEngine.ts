import { Card, GameAction, GameEvent, GameState } from '../types/game';
import { calculateScores, evaluateCapture, isCanonicalStealOccurred } from '../engine/rules';
import { createInitialGame, checkReplenishOrEnd } from '../engine/gameEngine';
import { decideCpuMove } from '../engine/cpu';
import {
  YoyoExpression,
  YoyoRelationshipStage,
  YOYO_SIGNATURE_QUOTES,
  resolveYoyoReaction,
} from '../character/yoyo';
import { YoyoBrainEvaluation } from '../character/brain/yoyoTypes';
import {
  FirstMatchMilestone,
  FirstMatchMilestoneId,
  FirstMatchState,
  FirstMatchGuidance,
  FirstMatchHintLevel,
} from './firstMatchTypes';
import { buildFirstMatchDeck } from './firstMatchDeck';

export const INITIAL_FIRST_MATCH_MILESTONES: FirstMatchMilestone[] = [
  {
    id: 'milestone-welcome',
    title: 'الكوتش يويو',
    concept: 'أهلاً بك في أول ماتش',
    coachMessage: YOYO_SIGNATURE_QUOTES.greeting,
    actionCallout: 'بص كده على إيدك، طاولتك، وطاولة اللعب.',
    achieved: false,
  },
  {
    id: 'milestone-first-turn',
    title: 'دورك الأول',
    concept: 'اختيار كرت ولعبه',
    coachMessage: 'في دورك، بتختار كرت واحد من إيدك وتنزله على الطاولة.',
    actionCallout: 'اختار كرت وابدأ اللعب.',
    achieved: false,
  },
  {
    id: 'milestone-rank-match',
    title: 'المطابقة بالرقم',
    concept: 'الرتبة مش الرمز',
    coachMessage: 'بص كده... شايف حاجة شبه اللي في إيدك؟ المطابقة برقم الكرت مش بالرمز!',
    actionCallout: 'جرب كرت 9♥ عشان تأكل الـ 9♣ المكشوفة.',
    targetCardRank: '9',
    achieved: false,
  },
  {
    id: 'milestone-first-capture',
    title: 'أول أكلة',
    concept: 'انتقال الكروت إلى كومتك',
    coachMessage: 'أيوه! أكلتها. بص الكروت راحت فين: دي كومتك (Winning Pile).',
    actionCallout: 'لاحظ انتقال الكرتين إلى كومة فوزك.',
    achieved: false,
  },
  {
    id: 'milestone-own-table',
    title: 'تكتيك الطاولة',
    concept: 'الاحتياطي التكتيكي',
    coachMessage: 'مش كل كرت لازم تاكله. أحيانًا بتسيبه على طاولتك تكتيك لبعدين.',
    actionCallout: 'نزل كرت مش مطابق وشوف إزاي بيقعد على طاولتك.',
    targetCardRank: '4',
    achieved: false,
  },
  {
    id: 'milestone-winning-pile',
    title: 'كومة الفوز',
    concept: 'حصيلتك الحقيقية',
    coachMessage: 'طاولتك دي احتياطي مؤقت، لكن كومتك هي حصيلتك الحقيقية اللي بتحدد مين كسبان.',
    actionCallout: 'كومتك بتجمع كل الكروت اللي كسبتها.',
    achieved: false,
  },
  {
    id: 'milestone-steal',
    title: 'سرقة الكومة ⚡',
    concept: 'الاستيلاء العلوي',
    coachMessage: 'بص على آخر كرت عندي فوق الكومة (7♦)... لو معاك نفس الرقم تقدر تسرق كروت الرتبة المتطابقة من أعلى الكومة!',
    actionCallout: 'العب كرت 7♥ وشوف المفاجأة!',
    targetCardRank: '7',
    achieved: false,
  },
  {
    id: 'milestone-why-collect',
    title: 'ليه بنجمع؟',
    concept: 'تجميع المجموعات',
    coachMessage: 'شايف الكروت عمالة تتجمع؟ تفتكر التجميع ده ليه لازمة؟ استنى بس وشوف سحر المجموعات!',
    actionCallout: 'تابع تجميع الكروت وشوف النتيجة لما يكتمل 4 كروت.',
    achieved: false,
  },
  {
    id: 'milestone-regular-set',
    title: 'المجموعة العادية (12 نقطة)',
    concept: '4 كروت من نفس الرقم = 12 نقطة',
    coachMessage: 'حلو... كده بدأت تجمع! 4 تسعات في كومتك = 12 نقطة نظامية. دلوقتي ركز مع كروت الأولاد (Jacks)... دي مش مجرد كروت عادية!',
    actionCallout: 'العب 9♠ لإكمال 4 تسعات في كومة الفوز.',
    targetCardRank: '9',
    achieved: false,
  },
  {
    id: 'milestone-jack-set',
    title: 'الأربع أولاد والكومبو الفضي 🥈',
    concept: 'Jack Set (36) + Silver Combo (60)',
    coachMessage: 'استنى... الأربع جاكات؟! دي مش قليلة! 36 نقطة، ومع المجموعة العادية قفزت لـ 60 نقطة (Silver Combo)! باقي خطوة واحدة للمجد الذهبي!',
    actionCallout: 'العب J♠ لإكمال مجموعة الأولاد الأربعة.',
    targetCardRank: 'J',
    achieved: false,
  },
  {
    id: 'milestone-silver-combo',
    title: 'المجموعة الفضية (Silver Combo)',
    concept: 'مجموعة أولاد + مجموعة عادية = 60 نقطة',
    coachMessage: 'المجموعات نفسها بتركب على بعض! مجموعة أولاد + مجموعة عادية = Silver Combo (60 نقطة)!',
    actionCallout: 'شاهد قفزة النقاط لـ 60 نقطة في النتيجة المباشرة.',
    achieved: false,
  },
  {
    id: 'milestone-golden-combo',
    title: 'المجموعة الذهبية (Golden Combo) ⚡',
    concept: 'أعلى تركيبة: 75 نقطة',
    coachMessage: 'إيه ده؟! عملت Golden بجد؟! 75 نقطة كاملة!\n\nخلاص... أعتقد إنك فهمت اللعبة.\nدلوقتي بقى دوري أنا! 😏',
    actionCallout: 'أكملت أعلى تشكيلة نقاط في Egyptian Jacks!',
    targetCardRank: 'K',
    achieved: false,
  },
  {
    id: 'milestone-free-play',
    title: 'يويو — منافسك',
    concept: 'التحول للمنافسة الحرة',
    coachMessage: 'خلاص... دوري أنا. وريني هتعمل إيه!',
    actionCallout: 'العب ما تبقى من الجولات بحرية وتكتيك.',
    achieved: false,
  },
];

/**
 * Initializes the First Match.
 * Employs the canonical engine (createInitialGame) and canonical deck (buildFirstMatchDeck).
 */
export function createInitialFirstMatch(): {
  state: FirstMatchState;
  game: GameState;
} {
  const game = createInitialGame(42, 'player', 0, buildFirstMatchDeck());

  const state: FirstMatchState = {
    currentMilestoneId: 'milestone-welcome',
    milestones: INITIAL_FIRST_MATCH_MILESTONES.map((m) => ({ ...m })),
    title: 'الكوتش يويو',
    concept: 'أهلاً بك في أول ماتش',
    coachMessage: YOYO_SIGNATURE_QUOTES.greeting,
    actionCallout: 'بص كده على إيدك، طاولتك، وطاولة اللعب.',
    hintLevel: 0,
    currentHint: null,
    targetCardRank: '9',
    highlightZone: 'PLAYER_HAND',
    feedbackTitle: null,
    feedbackMessage: null,
    isSuccess: false,
    canAdvanceNext: false,
    isFreePlayActive: false,
    goldenAchieved: false,
    silverAchieved: false,
    jackSetAchieved: false,
    regularSetAchieved: false,
    stealAchieved: false,
    yoyoExpression: 'idle',
    yoyoStage: 'STAGE_1_STRANGER',
  };

  return { state, game };
}

/**
 * Deterministic CPU Partner Move for the First Match.
 * The CPU chooses strictly legal moves from cpuHand that support the learning milestones
 * without cheating, without mutating state, and without throwing the match unrealistically.
 */
export function decideFirstMatchCpuMove(gameState: GameState, firstMatchState?: FirstMatchState): Card {
  const hand = gameState.cpuHand;
  if (hand.length === 0) {
    throw new Error('CPU hand is empty');
  }

  // Once Golden is achieved or in Free Play, CPU plays full competitive game
  if (firstMatchState?.isFreePlayActive || firstMatchState?.goldenAchieved) {
    const decision = decideCpuMove(
      hand,
      gameState.table.playerTable,
      gameState.table.opponentTable,
      gameState.playerWinningPile,
      gameState.table.viewMode,
      'HARD'
    );
    return decision.card;
  }

  const deal = gameState.dealNumber;
  const turnsInHand = 4 - hand.length; // 0, 1, 2, 3

  // Deal 1: Introduce 7 on table, then capture 7s to set up Steal
  if (deal === 1) {
    // Turn 0: Play 7♣ to table (discard)
    if (turnsInHand === 0) {
      const c7 = hand.find((c) => c.rank === '7' && c.suit === '♣') || hand.find((c) => c.rank === '7');
      if (c7) return c7;
    }
    // Turn 1: Capture 7♣ with 7♦ into CPU winning pile
    if (turnsInHand === 1) {
      const c7d = hand.find((c) => c.rank === '7' && c.suit === '♦') || hand.find((c) => c.rank === '7');
      if (c7d) return c7d;
    }
    // Turn 2: Discard 6♠
    if (turnsInHand === 2) {
      const c6 = hand.find((c) => c.rank === '6');
      if (c6) return c6;
    }
    // Turn 3: Discard remaining
    return hand[0];
  }

  // Deal 2: Offer 9♦ to table for Regular Set, then J♣ for Jack intro
  if (deal === 2) {
    if (turnsInHand === 0) {
      const c9 = hand.find((c) => c.rank === '9');
      if (c9) return c9;
    }
    if (turnsInHand === 1) {
      const cJ = hand.find((c) => c.rank === 'J');
      if (cJ) return cJ;
    }
    return hand[0];
  }

  // Deal 3: Offer J♥ to table for Jack Set + Silver Combo
  if (deal === 3) {
    if (turnsInHand === 0) {
      const cJ = hand.find((c) => c.rank === 'J');
      if (cJ) return cJ;
    }
    return hand[0];
  }

  // Deal 4: Offer K♣ then K♥ to table for Second Regular Set + Golden Combo
  if (deal === 4) {
    if (turnsInHand === 0) {
      const k1 = hand.find((c) => c.rank === 'K' && c.suit === '♣') || hand.find((c) => c.rank === 'K');
      if (k1) return k1;
    }
    if (turnsInHand === 1) {
      const k2 = hand.find((c) => c.rank === 'K');
      if (k2) return k2;
    }
    return hand[0];
  }

  // Deals 5 & 6 (Free Play): Adaptive legal CPU play
  const decision = decideCpuMove(
    hand,
    gameState.table.playerTable,
    gameState.table.opponentTable,
    gameState.playerWinningPile,
    gameState.table.viewMode,
    'MEDIUM'
  );
  return decision.card;
}

/**
 * Canonically executes the CPU's turn in the First Match.
 * Employs decideFirstMatchCpuMove to select the card legally from hand,
 * resolves capture with evaluateCapture, and updates GameState cleanly.
 */
export function executeFirstMatchCpuTurn(
  state: GameState,
  firstMatchState?: FirstMatchState
): GameState {
  if (state.phase !== 'CPU_TURN' || state.activeTurn !== 'cpu') {
    throw new Error(
      `Cannot execute First Match CPU turn: Active turn is ${state.activeTurn}, phase is ${state.phase}`
    );
  }

  if (state.cpuHand.length === 0) {
    return checkReplenishOrEnd(state);
  }

  const playedCard = decideFirstMatchCpuMove(state, firstMatchState);
  const newCpuHand = state.cpuHand.filter((c) => c.id !== playedCard.id);

  const captureResolution = evaluateCapture(
    playedCard,
    state.table.opponentTable, // CPU's table
    state.table.playerTable,   // Player's table
    state.playerWinningPile,   // Player's winning pile
    state.table.viewMode
  );

  const {
    captureResult,
    updatedPlayerTable: newCpuTable,
    updatedOpponentTable: newPlayerTable,
    updatedOpponentWinningPile: newPlayerWinningPile,
  } = captureResolution;

  let newCpuWinningPile = [...state.cpuWinningPile];
  if (captureResult.capturedCards.length > 0) {
    newCpuWinningPile.push(...captureResult.capturedCards);
  }

  const actionSequence = state.actionHistory.length + 1;
  const event: GameEvent = {
    id: `ev_cpu_${actionSequence}_${Date.now()}`,
    timestamp: Date.now(),
    actor: 'cpu',
    type: captureResult.capturedCards.length > 0 ? 'CAPTURE' : 'PLAY_CARD',
    message: `الخصم: ${captureResult.description}`,
    card: playedCard,
    capturedCards: captureResult.capturedCards,
    source: captureResult.capturedFrom,
  };

  const action: GameAction = {
    sequence: actionSequence,
    actor: 'cpu',
    cardId: playedCard.id,
    timestamp: Date.now(),
    captureResult,
    resultingPhase: 'PLAYER_TURN',
  };

  const intermediateState: GameState = {
    ...state,
    cpuHand: newCpuHand,
    table: {
      playerTable: newPlayerTable,
      opponentTable: newCpuTable,
      viewMode: 'NORMAL_VIEW',
    },
    playerWinningPile: newPlayerWinningPile,
    cpuWinningPile: newCpuWinningPile,
    activeTurn: 'player',
    phase: 'PLAYER_TURN',
    latestEvent: event,
    eventLog: [event, ...state.eventLog],
    actionHistory: [...state.actionHistory, action],
  };

  return checkReplenishOrEnd(intermediateState);
}

/**
 * Evaluates the transition of the First Match following any player action.
 * Observes canonical engine state without mutating cards or state.
 */
export function evaluateFirstMatchStep(
  currentState: FirstMatchState,
  _prevGame: GameState,
  nextGame: GameState,
  playedCard: Card,
  brainEvaluation?: YoyoBrainEvaluation
): FirstMatchState {
  const nextMilestones = currentState.milestones.map((m) => ({ ...m }));
  const markAchieved = (id: FirstMatchMilestoneId) => {
    const found = nextMilestones.find((m) => m.id === id);
    if (found) found.achieved = true;
  };

  markAchieved('milestone-welcome');
  markAchieved('milestone-first-turn');

  const action = nextGame.actionHistory[nextGame.actionHistory.length - 1];
  const captureRes = action?.captureResult || {
    capturedCards: [],
    capturedFrom: 'NONE',
    isTopUniformCapture: false,
    sources: [],
    capturedWithOrigins: [],
    description: '',
  };

  const isCapture = captureRes.capturedCards.length > 0;
  const { isSteal } = isCanonicalStealOccurred(_prevGame, nextGame);

  const scores = calculateScores(nextGame.playerWinningPile, 'player');
  const prevScores = calculateScores(_prevGame.playerWinningPile, 'player');
  const prevRegularSetsCount = prevScores.sets.filter((s) => s.isRegularSet).length;
  const nextRegularSetsCount = scores.sets.filter((s) => s.isRegularSet).length;
  const isNewRegularSet = nextRegularSetsCount > prevRegularSetsCount;

  const hasGolden = scores.goldenCombos > 0;
  const hasSilver = scores.silverCombos > 0;
  const hasJackSet = scores.sets.some((s) => s.isJackSet);
  const hasRegularSet = scores.sets.some((s) => s.isRegularSet);

  if (!isCapture) {
    markAchieved('milestone-own-table');
  }

  if (isCapture) {
    markAchieved('milestone-first-capture');
    markAchieved('milestone-rank-match');
  }

  if (isSteal) {
    markAchieved('milestone-winning-pile');
    markAchieved('milestone-steal');
  }

  if (hasRegularSet && isNewRegularSet) {
    markAchieved('milestone-why-collect');
    markAchieved('milestone-regular-set');
  }

  if (hasJackSet) {
    markAchieved('milestone-jack-set');
  }

  if (hasSilver) {
    markAchieved('milestone-silver-combo');
  }

  if (hasGolden) {
    markAchieved('milestone-golden-combo');
  }

  // Determine current milestone progression
  let nextMilestoneId: FirstMatchMilestoneId = currentState.currentMilestoneId;
  let title = currentState.title;
  let concept = currentState.concept;
  let coachMessage = currentState.coachMessage;
  let actionCallout = currentState.actionCallout;
  let feedbackTitle: string | null = null;
  let feedbackMessage: string | null = null;
  let isFreePlayActive = currentState.isFreePlayActive;
  let targetCardRank: string | undefined = undefined;
  let highlightZone: 'PLAYER_HAND' | 'PLAYER_TABLE' | 'OPPONENT_TABLE' | 'WINNING_PILE' | undefined = undefined;

  // Yoyo presentation state derived from Brain evaluation (Single Cognitive Authority)
  const isTransitioningToRival = currentState.goldenAchieved && currentState.yoyoStage === 'STAGE_5_CHALLENGE';
  const isCurrentFreePlay = currentState.isFreePlayActive || isTransitioningToRival;
  const isFreshGolden = !currentState.goldenAchieved && hasGolden;
  const isFreshSilver = !currentState.silverAchieved && hasSilver;
  const isFreshJackSet = !currentState.jackSetAchieved && hasJackSet;
  const isFreshRegularSet = !currentState.regularSetAchieved && hasRegularSet && isNewRegularSet;
  const isFreshSteal = !currentState.stealAchieved && isSteal;

  const fallbackReaction = resolveYoyoReaction({
    isCapture,
    isSteal: isFreshSteal,
    hasRegularSet: isFreshRegularSet,
    hasJackSet: isFreshJackSet,
    hasSilverCombo: isFreshSilver,
    hasGoldenCombo: isFreshGolden,
    isTransitionToRival: isTransitioningToRival,
    currentStage: currentState.yoyoStage,
    isFreePlay: isCurrentFreePlay,
  });

  const yoyoExpression: YoyoExpression = brainEvaluation?.expression ?? fallbackReaction.expression;
  const yoyoStage: YoyoRelationshipStage = brainEvaluation?.relationshipStage ?? fallbackReaction.relationshipStage;

  // 1. First Capture / Rank Match
  if (!currentState.milestones.find((m) => m.id === 'milestone-first-capture')?.achieved) {
    if (isCapture && playedCard.rank === '9') {
      nextMilestoneId = 'milestone-own-table';
      title = 'تكتيك الطاولة';
      concept = 'الاحتياطي التكتيكي';
      coachMessage = 'أيوه! أكلتها. بص الكروت راحت فين: دي كومتك (Winning Pile). دلوقتي جرب تلعب كرت مش مطابق وشوف إزاي بيقعد على طاولتك.';
      actionCallout = 'العب كرت 4♦ (أو أي كرت مش مطابق) وشوف إزاي بينزل على طاولتك.';
      targetCardRank = '4';
      highlightZone = 'PLAYER_HAND';
      feedbackTitle = 'أيوه! أكلتها 🎯';
      feedbackMessage = 'أكلت 9♣ بكرت 9♥ وانتقلوا لكومة الفوز.';
    } else if (!isCapture) {
      title = 'الكرت نزل على طاولتك';
      concept = 'الاحتياطي التكتيكي';
      coachMessage = 'حلو، نزلت كرت على طاولتك. دلوقتي بص على الـ 9 اللي على الطاولة: تقدر تأكلها بـ 9♥ من إيدك!';
      actionCallout = 'العب 9♥ لمطابقة 9♣.';
      targetCardRank = '9';
      highlightZone = 'PLAYER_HAND';
      feedbackTitle = 'نزلت كرت على طاولتك! 🛡️';
      feedbackMessage = 'الكرت استقر على طاولتك كاحتياطي للأدوار القادمة.';
    }
  }
  // 2. Steal Opportunity - Signature Yoyo Moment
  else if (!currentState.stealAchieved && isSteal) {
    nextMilestoneId = 'milestone-why-collect';
    title = 'آه يا معلم! سرقتها! ⚡';
    concept = 'الاستيلاء العلوي على الكومة';
    coachMessage = 'آه يا معلم! سرقتها! أخدت كروت الـ 7 من فوق كومتي لكومتك! شايف كومتك كبرت إزاي؟ طب يا ترى التجميع ده ليه لازمة؟ استنى بس وشوف سحر المجموعات!';
    actionCallout = 'راقب كومتك واستعد لاكتشاف المجموعات.';
    feedbackTitle = 'آه يا معلم! سرقتها! ⚡';
    feedbackMessage = 'استوليت على تسلسل الـ 7 بالكامل من كومة الخصم.';
  }
  // 3. Regular Set
  else if (!currentState.regularSetAchieved && hasRegularSet && isNewRegularSet) {
    nextMilestoneId = 'milestone-jack-set';
    title = 'أول مجموعة عادية (12 نقطة)!';
    concept = '4 كروت من نفس الرقم = 12 نقطة';
    coachMessage = 'حلو... كده بدأت تجمع! 4 تسعات في كومتك = 12 نقطة نظامية. دلوقتي ركز مع كروت الأولاد (Jacks)... دي مش مجرد كروت عادية!';
    actionCallout = 'تابع جمع الأولاد لاكتشاف أكبر مفاجأة.';
    targetCardRank = 'J';
    feedbackTitle = 'حلو... كده بدأت تجمع! (+12 نقطة)';
    feedbackMessage = 'اكتملت مجموعة الـ 9 في كومتك.';
  }
  // 4. Jack Set & Silver Combo
  else if (!currentState.jackSetAchieved && (hasJackSet || (hasSilver && !currentState.silverAchieved))) {
    nextMilestoneId = 'milestone-golden-combo';
    title = 'الأربع أولاد والكومبو الفضي! 🥈';
    concept = 'Jack Set (36) + Silver Combo (60)';
    coachMessage = 'استنى... الأربع جاكات؟! دي مش قليلة! 4 أولاد = 36 نقطة، ومع المجموعة العادية قفزت لـ 60 نقطة (Silver Combo)! باقي خطوة واحدة للمجد: مجموعة عادية إضافية توصلك للـ Golden Combo!';
    actionCallout = 'اجمع مجموعة الشايب (Kings) لتفجير الـ Golden Combo ⚡';
    targetCardRank = 'K';
    feedbackTitle = 'استنى... الأربع جاكات؟! 🥈 (60 نقطة)';
    feedbackMessage = '1 Jack Set + 1 Regular Set = 60 نقطة نظامية!';
  }
  // 5. Golden Combo - Signature Climax -> Enters Challenge Stage
  else if (!currentState.goldenAchieved && hasGolden) {
    nextMilestoneId = 'milestone-golden-combo';
    title = 'الكومبو الذهبي (75 نقطة)! ⚡';
    concept = 'أعلى تشكيلة في اللعبة: 75 نقطة';
    coachMessage = YOYO_SIGNATURE_QUOTES.goldenSurprise;
    actionCallout = 'استعد لدخول مرحلة التحدي مع يويو.';
    isFreePlayActive = false;
    feedbackTitle = 'إيه ده؟! عملت Golden بجد؟! ⚡ (75 نقطة)';
    feedbackMessage = 'حصدت المجموعة الذهبية وفق الحساب الكنسي الصارم!';
  }
  // 6. Transition from Challenge to Rival & Free Play
  else if (currentState.goldenAchieved && (currentState.yoyoStage === 'STAGE_5_CHALLENGE' || currentState.isFreePlayActive)) {
    markAchieved('milestone-free-play');
    nextMilestoneId = 'milestone-free-play';
    title = 'يويو — منافسك';
    concept = 'المنافسة الحرة';
    coachMessage = YOYO_SIGNATURE_QUOTES.rivalTransition;
    actionCallout = 'استمتع باللعب التكتيكي الحر حتى آخر كرت.';
    isFreePlayActive = true;
    feedbackTitle = 'دوري أنا! 😏';
    feedbackMessage = 'انتقلت اللعبة لمرحلة اللعب الحر التنافسي.';
  }

  return {
    ...currentState,
    currentMilestoneId: nextMilestoneId,
    milestones: nextMilestones,
    title,
    concept,
    coachMessage,
    actionCallout,
    feedbackTitle,
    feedbackMessage,
    targetCardRank,
    highlightZone,
    isSuccess: true,
    isFreePlayActive: isFreePlayActive || currentState.isFreePlayActive,
    goldenAchieved: currentState.goldenAchieved || hasGolden,
    silverAchieved: currentState.silverAchieved || hasSilver,
    jackSetAchieved: currentState.jackSetAchieved || hasJackSet,
    regularSetAchieved: currentState.regularSetAchieved || hasRegularSet,
    stealAchieved: currentState.stealAchieved || isSteal,
    yoyoExpression,
    yoyoStage,
    yoyoIntent: isFreshGolden ? 'CELEBRATE' : isFreshSteal ? 'SURPRISE' : isFreshRegularSet || isFreshJackSet ? 'RECOGNIZE' : isTransitioningToRival ? 'CHALLENGE' : 'OBSERVE',
    playerArchetype: hasGolden ? 'MASTER' : hasSilver || hasJackSet ? 'TACTICAL' : isSteal ? 'CAUTIOUS' : isCapture ? 'AGGRESSIVE' : 'NOVICE',
  };
}

/**
 * 3-Tier Progressive Hint Engine for First Match (Coach Yoyo Coaching System)
 * Strictly reads only legitimately visible information to the player:
 * Hand, Player Table, Opponent Table, and exposed Top of Opponent Winning Pile.
 * Never leaks CPU hidden cards or remaining deck order.
 */
export function requestFirstMatchHint(
  state: FirstMatchState,
  game: GameState
): FirstMatchState {
  const nextHintLevel = Math.min(3, state.hintLevel + 1) as FirstMatchHintLevel;

  const visibleOpponentTable = game.table.opponentTable;
  const visiblePlayerTable = game.table.playerTable;
  const topCpuWinningCard =
    game.cpuWinningPile.length > 0
      ? game.cpuWinningPile[game.cpuWinningPile.length - 1]
      : null;

  let hint: FirstMatchGuidance | null = null;

  // Level 1: Guidance ("بص كده...")
  if (nextHintLevel === 1) {
    if (topCpuWinningCard && game.playerHand.some((c) => c.rank === topCpuWinningCard.rank)) {
      hint = {
        level: 1,
        title: 'يويو: بص كده... ⚡',
        message: 'بص كده على أعلى ورقة مكشوفة في كومة فوزي... هل هي في أمان؟',
        highlightTarget: 'WINNING_PILE',
      };
    } else if (
      visibleOpponentTable.some((ot) => game.playerHand.some((ph) => ph.rank === ot.rank))
    ) {
      hint = {
        level: 1,
        title: 'يويو: بص كده... 🔍',
        message: 'بص كده على الكروت المكشوفة قدامك على الطاولة... في فرصة مطابقة واضحة.',
        highlightTarget: 'OPPONENT_TABLE',
      };
    } else {
      hint = {
        level: 1,
        title: 'يويو: بص كده... 💡',
        message: 'لو مفيش أكل مباشر، نزل كرت مش محتاجه على طاولتك عشان تحميه للأدوار الجاية.',
        highlightTarget: 'PLAYER_HAND',
      };
    }
  }
  // Level 2: Discovery ("شايف حاجة شبه اللي في إيدك؟")
  else if (nextHintLevel === 2) {
    if (topCpuWinningCard && game.playerHand.some((c) => c.rank === topCpuWinningCard.rank)) {
      hint = {
        level: 2,
        title: 'يويو: شايف حاجة شبه اللي في إيدك؟ ⚡',
        message: `الكرت العلوي عندي هو رتبة (${topCpuWinningCard.rank}). دور في إيدك على نفس الرقم!`,
        suggestedCardRank: topCpuWinningCard.rank,
        highlightTarget: 'WINNING_PILE',
      };
    } else {
      const match = game.playerHand.find((ph) =>
        visibleOpponentTable.some((ot) => ot.rank === ph.rank) ||
        visiblePlayerTable.some((pt) => pt.rank === ph.rank)
      );
      if (match) {
        hint = {
          level: 2,
          title: 'يويو: شايف حاجة شبه اللي في إيدك؟ 🎯',
          message: `معاك كرت برقم (${match.rank}) ومكشوف زيه على الطاولة. المطابقة بالرقم!`,
          suggestedCardRank: match.rank,
          highlightTarget: 'PLAYER_HAND',
        };
      } else {
        hint = {
          level: 2,
          title: 'يويو: نزول هادئ 🛡️',
          message: 'نزل كرت برقم صغير على طاولتك واحتفظ بالرتب المهمة للأدوار الجاية.',
          highlightTarget: 'PLAYER_HAND',
        };
      }
    }
  }
  // Level 3: Confirmation ("أيوه، دي هي.")
  else {
    if (topCpuWinningCard && game.playerHand.some((c) => c.rank === topCpuWinningCard.rank)) {
      hint = {
        level: 3,
        title: 'يويو: أيوه، دي هي! سرقة الكومة ⚡',
        message: `العب كرت (${topCpuWinningCard.rank}) من إيدك حالاً لتنفيذ السرقة ونقل الكروت لكومتك!`,
        suggestedCardRank: topCpuWinningCard.rank,
        highlightTarget: 'PLAYER_HAND',
      };
    } else {
      const match = game.playerHand.find((ph) =>
        visibleOpponentTable.some((ot) => ot.rank === ph.rank) ||
        visiblePlayerTable.some((pt) => pt.rank === ph.rank)
      );
      if (match) {
        hint = {
          level: 3,
          title: 'يويو: أيوه، دي هي بالظبط! 🎯',
          message: `العب كرت (${match.rank}${match.suit}) عشان تاكل الكرت المطابق وتنقله لكومة فوزك.`,
          suggestedCardRank: match.rank,
          highlightTarget: 'PLAYER_HAND',
        };
      } else {
        const lowestCard = [...game.playerHand].sort((a, b) => a.numericValue - b.numericValue)[0];
        hint = {
          level: 3,
          title: 'يويو: أيوه، نزل ده 🛡️',
          message: `العب كرت (${lowestCard.rank}${lowestCard.suit}) عشان ينزل على طاولتك كاحتياطي.`,
          suggestedCardRank: lowestCard.rank,
          highlightTarget: 'PLAYER_HAND',
        };
      }
    }
  }

  return {
    ...state,
    hintLevel: nextHintLevel,
    currentHint: hint,
    yoyoExpression: state.yoyoStage === 'STAGE_6_RIVAL' ? 'rival' : 'thinking',
  };
}

/**
 * Deterministically transitions First Match state from Coach / Challenge (STAGE_5_CHALLENGE)
 * to Rival (STAGE_6_RIVAL) and activates Free Play.
 */
export function transitionCoachToRival(state: FirstMatchState): FirstMatchState {
  if (state.yoyoStage === 'STAGE_6_RIVAL') {
    return state;
  }

  const nextMilestones = state.milestones.map((m) =>
    m.id === 'milestone-free-play' ? { ...m, achieved: true } : m
  );

  return {
    ...state,
    currentMilestoneId: 'milestone-free-play',
    milestones: nextMilestones,
    title: 'يويو — منافسك',
    concept: 'المنافسة الحرة',
    coachMessage: YOYO_SIGNATURE_QUOTES.rivalTransition,
    actionCallout: 'استمتع باللعب التكتيكي الحر حتى آخر كرت.',
    isFreePlayActive: true,
    yoyoExpression: 'challenge',
    yoyoStage: 'STAGE_6_RIVAL',
  };
}

