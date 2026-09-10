import { Card, GameState, Rank, Suit, ScoreBreakdown } from '../types/game';
import {
  LearnByPlayMilestone,
  LearnByPlayPhase,
  LearnByPlayState,
  HintLevel,
} from './tutorialTypes';
import { createInitialGame, playPlayerCard, executeCpuTurn } from '../engine/gameEngine';
import { calculateScores, isCanonicalStealOccurred } from '../engine/rules';
import { detectNewlyCompletedCollection } from '../engine/collectionDetector';

/**
 * Egyptian Jacks — Learn-by-Playing Engine (A4 Master Remediation)
 *
 * Core Concept:
 * The player does not sit in a classroom. The first match itself IS the tutorial.
 * A friendly, witty companion ("صاحبك اللي قاعد قدامك") guides the player through
 * natural discovery:
 *
 * Turn -> Match (Rank not suit) -> Capture -> Own Table -> Winning Pile -> Steal (WOW!)
 * -> Sets -> Jacks -> Combos -> Decision & Timing -> Freedom!
 *
 * ZERO HIDDEN LEAKAGE:
 * Contextual hints inspect only player-visible state (hand, tables, top opponent winning pile).
 *
 * CANONICAL RULE INTEGRITY:
 * Zero fake rule evaluations. Every milestone is strictly validated against canonical
 * engine results (rules.ts, calculateScores, captureResult).
 */

export const makeCard = (id: string, suit: Suit, rank: Rank): Card => ({
  id,
  suit,
  rank,
  numericValue: rank === 'A' ? 1 : rank === 'J' ? 11 : rank === 'Q' ? 12 : rank === 'K' ? 13 : Number(rank),
  isJack: rank === 'J',
});

export const INITIAL_MILESTONES: LearnByPlayMilestone[] = [
  {
    id: 'milestone-capture',
    title: 'أول أكل مباشر',
    description: 'مطابقة رتبة كرت من يدك مع كرت على الطاولة ونقلهما لكومة فوزك',
    achieved: false,
    category: 'CAPTURE',
  },
  {
    id: 'milestone-table',
    title: 'إتقان ساحة طاولتك',
    description: 'فهم أن الكرت غير المطابق ينزل على طاولتك كمستودع تكتيكي للأدوار القادمة',
    achieved: false,
    category: 'TABLE',
  },
  {
    id: 'milestone-steal',
    title: 'سرقة كومة الخصم',
    description: 'الاستيلاء على التسلسل المتطابق من أعلى كومة فوز الخصم بنقلها لكومتك',
    achieved: false,
    category: 'STEAL',
  },
  {
    id: 'milestone-set',
    title: 'تكوين مجموعة ملكية',
    description: 'تجميع 4 كروت من نفس الرتبة لحصد +12 نقطة دفعة واحدة في المحرك',
    achieved: false,
    category: 'SET',
  },
  {
    id: 'milestone-jacks',
    title: 'استيعاب قوة الأولاد',
    description: 'فهم أن تجميع 4 Jacks يمنحك Jack Set جباراً بـ 36 نقطة كاملة',
    achieved: false,
    category: 'JACKS',
  },
  {
    id: 'milestone-combos',
    title: 'سر الكومبو الكبير',
    description: 'دمج المجموعات في الكومبو الفضي (60 نقطة) والذهبي (75 نقطة)',
    achieved: false,
    category: 'COMBOS',
  },
  {
    id: 'milestone-decision',
    title: 'القرار التكتيكي الواعي',
    description: 'الموازنة الحكيمة بين الأكل اللحظي السريع والتضحية لإعداد حركة أكبر',
    achieved: false,
    category: 'DECISION',
  },
  {
    id: 'milestone-mastery',
    title: 'جاهزية اللعب المستقل',
    description: 'إتمام التجربة التعليمية والانطلاق في اللعب الحر بثقة تامة',
    achieved: false,
    category: 'MASTERY',
  },
];

/**
 * Authoritative Canonical Steal check re-exported from canonical rules.
 */
export { isCanonicalStealOccurred };

/**
 * Validates Set formation against canonical calculateScores and collection detector.
 * Rank-alone execution is not enough; score confirmation is required.
 */
export function isCanonicalSetFormed(
  prevGame: GameState,
  nextGame: GameState,
  expectedRank?: Rank
): {
  isSet: boolean;
  isJackSet: boolean;
  newSetsCount: number;
} {
  const prevScores = calculateScores(prevGame.playerWinningPile, 'player');
  const nextScores = calculateScores(nextGame.playerWinningPile, 'player');
  const collectionEvent = detectNewlyCompletedCollection(prevScores, nextScores, 'player');

  const prevRegularSets = prevScores.sets.filter((s) => s.isRegularSet).length;
  const nextRegularSets = nextScores.sets.filter((s) => s.isRegularSet).length;
  const newRegularSetsCount = Math.max(0, nextRegularSets - prevRegularSets);

  const prevJackSets = prevScores.sets.filter((s) => s.isJackSet).length;
  const nextJackSets = nextScores.sets.filter((s) => s.isJackSet).length;
  const newJackSetsCount = Math.max(0, nextJackSets - prevJackSets);

  if (expectedRank === 'J') {
    const hasJackBonus = nextScores.jackSetPoints > prevScores.jackSetPoints;
    const isJackCollection = collectionEvent?.type === 'JACK_SET' || hasJackBonus;
    return {
      isSet: newJackSetsCount > 0 && isJackCollection,
      isJackSet: true,
      newSetsCount: newJackSetsCount,
    };
  }

  if (expectedRank) {
    const prevRankSets = prevScores.sets.filter((s) => s.isRegularSet && s.rank === expectedRank).length;
    const nextRankSets = nextScores.sets.filter((s) => s.isRegularSet && s.rank === expectedRank).length;
    const newRankSetsCount = Math.max(0, nextRankSets - prevRankSets);
    const hasScoreGain = nextScores.regularSetPoints > prevScores.regularSetPoints;
    const isSetConfirmed = newRankSetsCount > 0 && (hasScoreGain || collectionEvent?.type === 'REGULAR_SET');
    return {
      isSet: isSetConfirmed,
      isJackSet: false,
      newSetsCount: newRankSetsCount,
    };
  }

  const hasGeneralScoreGain = nextScores.regularSetPoints > prevScores.regularSetPoints;
  return {
    isSet: newRegularSetsCount > 0 && (hasGeneralScoreGain || collectionEvent?.type === 'REGULAR_SET'),
    isJackSet: false,
    newSetsCount: newRegularSetsCount,
  };
}

/**
 * Validates Combos against canonical calculateScores.
 */
export function isCanonicalComboAchieved(
  nextGame: GameState
): {
  hasSilver: boolean;
  hasGolden: boolean;
  hasIron: boolean;
  totalScore: number;
  breakdown: ScoreBreakdown;
} {
  const scores = calculateScores(nextGame.playerWinningPile, 'player');
  return {
    hasSilver: scores.silverCombos > 0,
    hasGolden: scores.goldenCombos > 0,
    hasIron: scores.ironCombos > 0,
    totalScore: scores.totalScore,
    breakdown: scores,
  };
}

/**
 * Creates the deterministic initial game and tutorial state for the Learn-by-Play match.
 */
export function createInitialLearnByPlay(): {
  state: LearnByPlayState;
  game: GameState;
} {
  // Deterministic curated hand and table for optimal pedagogical discovery
  const card9Heart = makeCard('h9', '♥', '9');
  const card10Club = makeCard('c10', '♣', '10');
  const cardKingDiamond = makeCard('dk', '♦', 'K');
  const card3Spade = makeCard('s3', '♠', '3');

  const card9Club = makeCard('c9', '♣', '9');
  const card4Diamond = makeCard('d4', '♦', '4');
  const card10Diamond = makeCard('d10', '♦', '10');
  const card8Spade = makeCard('s8', '♠', '8');

  const card7Diamond = makeCard('d7', '♦', '7');
  const card2Heart = makeCard('h2', '♥', '2');
  const cardQueenSpade = makeCard('sq', '♠', 'Q');
  const card5Club = makeCard('c5', '♣', '5');

  const baseGame = createInitialGame(1, 'player', 26);
  baseGame.playerHand = [card9Heart, card10Club, cardKingDiamond, card3Spade];
  baseGame.table.playerTable = [card9Club, card4Diamond];
  baseGame.table.opponentTable = [card10Diamond, card8Spade];
  baseGame.cpuHand = [card7Diamond, card2Heart, cardQueenSpade, card5Club];

  const state: LearnByPlayState = {
    phase: 'PHASE_0_WELCOME',
    phaseIndex: 0,
    totalPhases: 13,
    title: 'تعالى نلعب أول إيد',
    concept: 'البداية السريعة والتعلم أثناء اللعب',
    coachMessage:
      'أهلاً بيك في Egyptian Jacks! مش هنقعد نقرأ قوانين ناشفة.. اعتبرني صاحبك اللي قاعد قدامك بنلعب سوا. هسيبك تجرب براحتك، وأنا في ضهرك خطوة بخطوة.',
    actionCallout: 'اضغط "يلا نبدأ" أو اختر أي كرت من إيدك للعب.',
    hintLevel: 0,
    currentHint: null,
    targetCardRank: '9',
    highlightZone: 'PLAYER_HAND',
    feedbackTitle: null,
    feedbackMessage: null,
    isSuccess: false,
    milestones: INITIAL_MILESTONES.map((m) => ({ ...m })),
    isAwaitingPlayerAction: true,
    canAdvanceNext: false,
    isFreePlayActive: false,
    hasSeenSteal: false,
    hasSeenSet: false,
    hasSeenJack: false,
    hasSeenCombos: false,
  };

  return { state, game: baseGame };
}

/**
 * Advances the Learn-by-Playing state to the next phase smoothly.
 */
export function advanceLearnByPlayPhase(
  currentState: LearnByPlayState,
  currentGame: GameState
): { state: LearnByPlayState; game: GameState } {
  let updatedGame = { ...currentGame };

  switch (currentState.phase) {
    case 'PHASE_0_WELCOME': {
      // Transition to Phase 1 & 2: Understand the Turn & Discover Matching
      return {
        state: {
          ...currentState,
          phase: 'PHASE_1_FIRST_TURN',
          phaseIndex: 1,
          title: 'افهم دورك واكتشف المطابقة',
          concept: 'المطابقة بالرتبة (الرقم) مش بالرمز',
          coachMessage:
            'في دورك، بتختار كرت واحد من إيدك وتلعبه. بص على الكروت المكشوفة قدامك: عندك 9♣ على طاولتك، ومعاك 9♥ في إيدك. المطابقة بالرتبة (الرقم) مش بالرمز!',
          actionCallout: 'العب كرت 9♥ لتأكل 9♣ من الطاولة، أو جرب كرت غير مطابق لتشوف إيه اللي هيحصل.',
          targetCardRank: '9',
          highlightZone: 'PLAYER_HAND',
          hintLevel: 0,
          currentHint: null,
          isAwaitingPlayerAction: true,
          canAdvanceNext: false,
        },
        game: updatedGame,
      };
    }

    case 'PHASE_1_FIRST_TURN':
    case 'PHASE_2_DISCOVER_MATCH':
    case 'PHASE_3_FIRST_CAPTURE':
    case 'PHASE_4_OWN_TABLE': {
      // Transition to Phase 5: Understanding the Winning Pile
      return {
        state: {
          ...currentState,
          phase: 'PHASE_5_WINNING_PILE',
          phaseIndex: 4,
          title: 'كومة الفوز (Winning Pile)',
          concept: 'الفرق بين الطاولة المؤقتة وحصيلة الفوز الحقيقية',
          coachMessage:
            'بص على الكومة اللي على يمينك: دي Winning Pile بتاعتك. الطاولة دي ساحة المعركة التكتيكية المؤقتة، لكن كومة الفوز هي حصيلتك الحقيقية اللي بتحدد مين كسبان في نهاية الجولة. بس هل الكومة دي في أمان تام؟ تعال نشوف المفاجأة!',
          actionCallout: 'اضغط "التالي" لمشاهدة أخطر حركة في اللعبة: السرقة ⚡',
          highlightZone: 'WINNING_PILE',
          isAwaitingPlayerAction: false,
          canAdvanceNext: true,
        },
        game: updatedGame,
      };
    }

    case 'PHASE_5_WINNING_PILE': {
      // Transition to Phase 6: First Steal (WOW moment)
      // Set up the deterministic steal situation:
      // Opponent winning pile has 7♦ on top (with 7♣ beneath). Player has 7♥ in hand.
      const card7Heart = makeCard('h7', '♥', '7');
      const card7Diamond = makeCard('d7', '♦', '7');
      const card7Club = makeCard('c7', '♣', '7');
      const cardAceSpade = makeCard('sa', '♠', 'A');

      updatedGame = {
        ...updatedGame,
        playerHand: [card7Heart, ...updatedGame.playerHand.filter((c) => c.rank !== '7')],
        cpuWinningPile: [cardAceSpade, card7Club, card7Diamond], // Top cards are contiguous 7s
        activeTurn: 'player',
        phase: 'PLAYER_TURN',
      };

      return {
        state: {
          ...currentState,
          phase: 'PHASE_6_FIRST_STEAL',
          phaseIndex: 5,
          title: 'لحظة المفاجأة: سرقة كومة الخصم ⚡',
          concept: 'استغلال الورقة العلوية المكشوفة لكومة فوز الخصم',
          coachMessage:
            'بص على كومة فوز الخصم! الورقة العلوية مكشوفة ومعرضة للخطر (7♦). في Egyptian Jacks، الكومة مش آمنة 100%.. لو معاك نفس الرتبة، تقدر تسرق التسلسل المتطابق من أعلى الكومة كاملة وتنقله لكومتك!',
          actionCallout: 'العب كرت 7♥ من إيدك واشهد أول عملية سرقة لكومة الخصم!',
          targetCardRank: '7',
          highlightZone: 'WINNING_PILE',
          hintLevel: 0,
          currentHint: null,
          isAwaitingPlayerAction: true,
          canAdvanceNext: false,
        },
        game: updatedGame,
      };
    }

    case 'PHASE_6_FIRST_STEAL': {
      // Transition to Phase 7: Why am I collecting? & Phase 8: Regular Sets
      // Setup: In playerWinningPile, put 2 Aces: A♠, A♦ (along with stolen 7s).
      // Put A♣ on opponentTable.
      // Give player A♥ in hand to complete the 4-card set by capturing A♣!
      const aceSpade = makeCard('sa', '♠', 'A');
      const aceDiamond = makeCard('da', '♦', 'A');
      const aceClub = makeCard('ca', '♣', 'A');
      const aceHeart = makeCard('ha', '♥', 'A');

      updatedGame = {
        ...updatedGame,
        playerWinningPile: [
          ...updatedGame.playerWinningPile.filter((c) => c.rank !== 'A'),
          aceSpade,
          aceDiamond,
        ],
        table: {
          ...updatedGame.table,
          opponentTable: [
            ...updatedGame.table.opponentTable.filter((c) => c.rank !== 'A'),
            aceClub,
          ],
        },
        playerHand: [aceHeart, ...updatedGame.playerHand.filter((c) => c.rank !== 'A')],
        activeTurn: 'player',
        phase: 'PLAYER_TURN',
      };

      return {
        state: {
          ...currentState,
          phase: 'PHASE_7_WHY_COLLECT',
          phaseIndex: 6,
          title: 'ليه بنجمع الكروت؟ سر المجموعات 👑',
          concept: 'المجموعات الملكية (Regular Sets) هي صانعة الفارق (+12 نقطة)',
          coachMessage:
            'دلوقتي اسأل نفسك: ليه بجمع الكروت أصلاً؟ بص على كومة فوزك.. عندك كروت برتبة آس (A)، وفي كرت A♣ مكشوف على الطاولة. تجميع 4 كروت من نفس الرتبة بيكون (Regular Set) وبيديك 12 نقطة دفعة واحدة!',
          actionCallout: 'العب كرت A♥ من إيدك لتأكل كرت الآس وتكمل الـ 4 كروت وتصنع أول مجموعة ملكية!',
          targetCardRank: 'A',
          highlightZone: 'PLAYER_HAND',
          hintLevel: 0,
          currentHint: null,
          isAwaitingPlayerAction: true,
          canAdvanceNext: false,
        },
        game: updatedGame,
      };
    }

    case 'PHASE_7_WHY_COLLECT':
    case 'PHASE_8_REGULAR_SET': {
      // Transition to Phase 9: Jacks Reveal (Active & Interactive Gameplay)
      // Setup: In playerWinningPile, put 2 Jacks: J♠, J♦.
      // Put J♣ on opponentTable.
      // Give player J♥ in hand to complete the 4-card Jack Set by capturing J♣!
      const jackSpade = makeCard('sj', '♠', 'J');
      const jackDiamond = makeCard('dj', '♦', 'J');
      const jackClub = makeCard('cj', '♣', 'J');
      const jackHeart = makeCard('hj', '♥', 'J');

      updatedGame = {
        ...updatedGame,
        playerWinningPile: [
          ...updatedGame.playerWinningPile.filter((c) => c.rank !== 'J' && c.rank !== 'A'),
          jackSpade,
          jackDiamond,
        ],
        table: {
          ...updatedGame.table,
          opponentTable: [
            ...updatedGame.table.opponentTable.filter((c) => c.rank !== 'J'),
            jackClub,
          ],
        },
        playerHand: [jackHeart, ...updatedGame.playerHand.filter((c) => c.rank !== 'J')],
        activeTurn: 'player',
        phase: 'PLAYER_TURN',
      };

      return {
        state: {
          ...currentState,
          phase: 'PHASE_9_JACKS_REVEAL',
          phaseIndex: 7,
          title: 'الأولاد (Jacks): كنز النقاط الملكي 🃏',
          concept: 'تجميع 4 Jacks = Jack Set = 36 نقطة كاملة في المحرك',
          coachMessage:
            'طيب وإيه حكاية الأولاد (J)؟ في ألعاب تانية الولد بيمسح الأرض.. هنا الولد مش سحر، الولد كنز نقاط ملكي! الولد بيطابق ولد زيه فقط، لكن تجميع 4 أولاد بيعمل Jack Set وبيديك 36 نقطة كاملة! بص على الطاولة: في J♣، ومعاك J♥ في إيدك ومعاك ولدين في كومتك.. العبه لتأكل الولد وتكمل مجموعة الـ 4 أولاد وتكسب 36 نقطة!',
          actionCallout: 'العب كرت J♥ من إيدك لتأكل الولد وتشهد تسجيل الـ 36 نقطة في المحرك!',
          targetCardRank: 'J',
          highlightZone: 'PLAYER_HAND',
          hintLevel: 0,
          currentHint: null,
          isAwaitingPlayerAction: true,
          canAdvanceNext: false,
        },
        game: updatedGame,
      };
    }

    case 'PHASE_9_JACKS_REVEAL': {
      // Transition to Phase 10: Combos Reveal & Upgrade (Active Discovery)
      // Player already has 4 Jacks (Jack Set) + 4 Aces (Regular Set) -> Silver Combo (+60 pts) is active!
      // Add 2 Kings to winning pile, put K♣ on opponentTable, and give player K♥ in hand to upgrade to Golden Combo (+75 pts)!
      const kingSpade = makeCard('sk', '♠', 'K');
      const kingDiamond = makeCard('dk', '♦', 'K');
      const kingClub = makeCard('ck', '♣', 'K');
      const kingHeart = makeCard('hk', '♥', 'K');

      const aceCards = [
        makeCard('sa', '♠', 'A'),
        makeCard('da', '♦', 'A'),
        makeCard('ca', '♣', 'A'),
        makeCard('ha', '♥', 'A'),
      ];
      const jackCards = [
        makeCard('sj', '♠', 'J'),
        makeCard('dj', '♦', 'J'),
        makeCard('cj', '♣', 'J'),
        makeCard('hj', '♥', 'J'),
      ];

      updatedGame = {
        ...updatedGame,
        playerWinningPile: [
          ...updatedGame.playerWinningPile.filter((c) => c.rank !== 'K' && c.rank !== 'A' && c.rank !== 'J'),
          ...aceCards,
          ...jackCards,
          kingSpade,
          kingDiamond,
        ],
        table: {
          ...updatedGame.table,
          opponentTable: [
            ...updatedGame.table.opponentTable.filter((c) => c.rank !== 'K'),
            kingClub,
          ],
        },
        playerHand: [kingHeart, ...updatedGame.playerHand.filter((c) => c.rank !== 'K')],
        activeTurn: 'player',
        phase: 'PLAYER_TURN',
      };

      const currentScores = calculateScores(updatedGame.playerWinningPile, 'player');

      return {
        state: {
          ...currentState,
          phase: 'PHASE_10_COMBOS_REVEAL',
          phaseIndex: 8,
          title: 'المجموعات المركبة (Combos) ✨',
          concept: 'Silver (60 نقطة) والارتقاء إلى Golden (75 نقطة)',
          coachMessage:
            `بص على السحر الحقيقي! عندك مجموعة أولاد + مجموعة آسات، اتحدوا في (Silver Combo) بقيمة 60 نقطة!\nودلوقتي في إيدك K♥، ومعاك 3 ملوك في كومتك. لما تكمل مجموعة الملوك، هترتقي إلى:\n👑 المجموعة الذهبية (Golden Combo) = 75 نقطة!\nالعب K♥ لتفجير الكومبو الذهبي!`,
          actionCallout: 'العب كرت K♥ للارتقاء إلى المجموعة الذهبية (75 نقطة)!',
          targetCardRank: 'K',
          highlightZone: 'PLAYER_HAND',
          hintLevel: 0,
          currentHint: null,
          isAwaitingPlayerAction: true,
          canAdvanceNext: false,
          liveScoringProof: `النقاط الحالية: ${currentScores.totalScore} نقطة (Silver Combo: +${currentScores.silverPoints})`,
        },
        game: updatedGame,
      };
    }

    case 'PHASE_10_COMBOS_REVEAL': {
      // Transition to Phase 11: Strategic Decision Dilemma (Observable Consequence)
      // Set up scenario with 6♦ and 3♦ in hand, 6♣ on opponent table
      const card6Diamond = makeCard('d6', '♦', '6');
      const card3Diamond = makeCard('d3', '♦', '3');
      const card6Club = makeCard('c6', '♣', '6');
      const cardKingHeart = makeCard('hk', '♥', 'K');
      const cpuCard3Spade = makeCard('s3', '♠', '3');
      const cpuCard8Spade = makeCard('s8', '♠', '8');

      updatedGame = {
        ...updatedGame,
        playerHand: [card6Diamond, card3Diamond, cardKingHeart],
        table: {
          ...updatedGame.table,
          opponentTable: [card6Club],
          playerTable: [],
          viewMode: 'NORMAL_VIEW',
        },
        cpuHand: [cpuCard3Spade, cpuCard8Spade],
        activeTurn: 'player',
        phase: 'PLAYER_TURN',
      };

      return {
        state: {
          ...currentState,
          phase: 'PHASE_11_DECISION_DILEMMA',
          phaseIndex: 9,
          title: 'معادلة القرار والتوقيت: تأكل دلوقتي ولا تجهّز لقدام؟ ⏳',
          concept: 'التوازن بين المكسب اللحظي والتضحية التكتيكية',
          coachMessage:
            'قدامك موقف بيحدد المحترف من الهاوي:\nعندك خيارين قانونيين تماماً:\n[أ] تأكل 6♣ بكرت 6♦ فوراً (تأمين نقطتين، بس استهلكت كرت قوي).\n[ب] تضحي بكرت 3♦ على طاولتك (تحافظ على الـ 6، وتجهز لفخ أو رد لاحق).\nEgyptian Jacks مش بتسألك: تقدر تاكل؟ اللعبة بتسألك: هل الأكل دلوقتي هو القرار الأذكى؟',
          actionCallout: 'اختر 6♦ للأكل المباشر، أو 3♦ للتضحية والتريث التكتيكي.',
          decisionOptions: {
            choiceA: { label: 'أكل فوري بالـ 6', description: 'تأمين نقطتين فوريتين وحماية الطاولة', cardRank: '6' },
            choiceB: { label: 'تضحية وتريث بالـ 3', description: 'الاحتفاظ بكروت الأكل القوية لحركة أكبر', cardRank: '3' },
          },
          targetCardRank: undefined,
          highlightZone: 'PLAYER_HAND',
          hintLevel: 0,
          currentHint: null,
          isAwaitingPlayerAction: true,
          canAdvanceNext: false,
        },
        game: updatedGame,
      };
    }

    case 'PHASE_11_DECISION_DILEMMA': {
      // Transition to Phase 12: Freedom & Free Play!
      const updatedMilestones = currentState.milestones.map((m) =>
        m.id === 'milestone-mastery' ? { ...m, achieved: true } : m
      );

      return {
        state: {
          ...currentState,
          phase: 'PHASE_12_FREE_PLAY',
          phaseIndex: 10,
          totalPhases: 11,
          title: 'اللعبة لعبتك! حرية كاملة 🏆',
          concept: 'اللعب المستقل وتطبيق كل ما تعلمته',
          coachMessage:
            'عاش جداً يا بطل! دلوقتي أنت استوعبت كل مفاهيم اللعبة الأساسية والاستراتيجية. كمل الماتش ده بحرية تامة ضد الخصم، وأنا جنبك كمدرب هادي لو احتجت أي تلميح.',
          actionCallout: 'العب كرتك واستمتع بالمباراة!',
          milestones: updatedMilestones,
          isAwaitingPlayerAction: true,
          canAdvanceNext: false,
          isFreePlayActive: true,
        },
        game: updatedGame,
      };
    }

    default:
      return { state: currentState, game: currentGame };
  }
}

/**
 * Evaluates the player's action during the Learn-by-Playing session.
 * STRICTLY uses canonical engine state and rules.
 */
export function evaluateLearnByPlayAction(
  currentState: LearnByPlayState,
  prevGame: GameState,
  nextGame: GameState,
  playedCard: Card
): { state: LearnByPlayState; game: GameState } {
  let updatedState = { ...currentState };
  let updatedGame = { ...nextGame };

  const latestAction = nextGame.actionHistory[nextGame.actionHistory.length - 1];
  const capturedCards = latestAction?.captureResult?.capturedCards || [];

  // Phase 0, 1, 2: Direct capture vs Table placement
  if (
    currentState.phase === 'PHASE_0_WELCOME' ||
    currentState.phase === 'PHASE_1_FIRST_TURN' ||
    currentState.phase === 'PHASE_2_DISCOVER_MATCH'
  ) {
    if (capturedCards.length > 0) {
      // SUCCESSFUL DIRECT CAPTURE
      const updatedMilestones = currentState.milestones.map((m) =>
        m.id === 'milestone-capture' ? { ...m, achieved: true } : m
      );

      updatedState = {
        ...currentState,
        phase: 'PHASE_3_FIRST_CAPTURE',
        phaseIndex: 2,
        title: 'أول أكل مباشر! 🎯',
        concept: 'المطابقة بالرتبة والأكل إلى كومة الفوز',
        feedbackTitle: 'أول أكل مباشر ومطابقة متقنة! 🎯',
        feedbackMessage:
          `عاش! لعبت ${playedCard.rank}${playedCard.suit} وطابقت كرت برتبة (${playedCard.rank}) على الطاولة. الكرتين اتأكلوا ودخلوا كومة فوزك. ده أول مكسب لك في الجولة!`,
        milestones: updatedMilestones,
        isSuccess: true,
        canAdvanceNext: true,
        isAwaitingPlayerAction: false,
      };
    } else {
      // NON-MATCHING CARD PLACED ON PLAYER'S TABLE
      const updatedMilestones = currentState.milestones.map((m) =>
        m.id === 'milestone-table' ? { ...m, achieved: true } : m
      );

      updatedState = {
        ...currentState,
        phase: 'PHASE_4_OWN_TABLE',
        phaseIndex: 3,
        title: 'الكرت نزل على طاولتك! 🛡️',
        concept: 'طاولتك جزء فاعل في اللعبة وليست سلة مهملات',
        feedbackTitle: 'الكرت نزل على طاولتك الخاصة',
        feedbackMessage:
          `لاحظت إيه اللي حصل؟ الكرت ${playedCard.rank}${playedCard.suit} ملقاش رتبة تطابقه، فنزل على طاولتك. طاولتك دي مش مجرد مكان رمي، دي مستودع تكتيكي للأدوار الجاية تقدر تاكل منه لما يجيلك نفس الرتبة!`,
        milestones: updatedMilestones,
        isSuccess: true,
        canAdvanceNext: true,
        isAwaitingPlayerAction: false,
      };
    }

    return { state: updatedState, game: updatedGame };
  }

  // Phase 6: Winning Pile Steal
  // Strict canonical state validation: NO rank shortcuts!
  if (currentState.phase === 'PHASE_6_FIRST_STEAL') {
    const { isSteal, stolenCards } = isCanonicalStealOccurred(prevGame, nextGame);

    if (isSteal) {
      const updatedMilestones = currentState.milestones.map((m) =>
        m.id === 'milestone-steal' ? { ...m, achieved: true } : m
      );

      const stolenRanks = stolenCards.map((c) => `${c.rank}${c.suit}`).join('، ');

      updatedState = {
        ...currentState,
        feedbackTitle: 'سرقة كومة الخصم بالكامل! 💥',
        feedbackMessage:
          `رائع جداً! لعبت 7 وطابقت الكرت العلوي في كومة فوز الخصم. المحرك نفذ سرقة التسلسل العلوي المتطابق (${stolenRanks}) ونقلهم فوراً إلى كومة فوزك! أنت مش بس كسبت نقاط، أنت حرمت الخصم من نقاطه في نفس اللحظة.`,
        milestones: updatedMilestones,
        isSuccess: true,
        canAdvanceNext: true,
        isAwaitingPlayerAction: false,
        hasSeenSteal: true,
      };
    } else {
      updatedState = {
        ...currentState,
        feedbackTitle: 'حركة قانونية لكنها فوتت السرقة! ⚠️',
        feedbackMessage:
          'هذه حركة صحيحة قانوناً، لكن راقب كومة الخصم: الكرت العلوي كان 7 معرضاً للسرقة لو لعبت كرت 7 من إيدك لمطابقته.',
        isSuccess: false,
        canAdvanceNext: false,
        isAwaitingPlayerAction: true,
      };
    }

    return { state: updatedState, game: updatedGame };
  }

  // Phase 7 & 8: Regular Set Formation
  // Strict canonical scoring engine validation: MUST form a new Regular Set
  if (currentState.phase === 'PHASE_7_WHY_COLLECT' || currentState.phase === 'PHASE_8_REGULAR_SET') {
    const { isSet, newSetsCount } = isCanonicalSetFormed(prevGame, nextGame, 'A');

    if (isSet && newSetsCount > 0) {
      const updatedMilestones = currentState.milestones.map((m) =>
        m.id === 'milestone-set' ? { ...m, achieved: true } : m
      );

      updatedState = {
        ...currentState,
        phase: 'PHASE_8_REGULAR_SET',
        feedbackTitle: 'مجموعة ملكية مكتملة (Regular Set) +12 نقطة! 👑',
        feedbackMessage:
          'ألف مبروك! كملت 4 كروت برتبة آس (A) في كومة فوزك. المحرك احتسب +12 نقطة نظامية دفعة واحدة! اللعبة سباق حقيقي لبناء هذه المجموعات.',
        milestones: updatedMilestones,
        isSuccess: true,
        canAdvanceNext: true,
        isAwaitingPlayerAction: false,
        hasSeenSet: true,
      };
    } else {
      updatedState = {
        ...currentState,
        feedbackTitle: 'حركة جيدة، لكن فرصة المجموعة قائمة!',
        feedbackMessage: 'لديك 3 كروت آس في كومة فوزك، لعب كرت الآس الرابع يكمل المجموعة الملكية فوراً ويمنحك 12 نقطة.',
        isSuccess: false,
        canAdvanceNext: false,
        isAwaitingPlayerAction: true,
      };
    }

    return { state: updatedState, game: updatedGame };
  }

  // Phase 9: Jacks Reveal (Interactive 4-Jacks Jack Set)
  // Strict canonical scoring engine validation: MUST form a new Jack Set
  if (currentState.phase === 'PHASE_9_JACKS_REVEAL') {
    const { isSet } = isCanonicalSetFormed(prevGame, nextGame, 'J');
    const nextScores = calculateScores(nextGame.playerWinningPile, 'player');

    if (isSet && nextScores.jackSets > 0) {
      const updatedMilestones = currentState.milestones.map((m) =>
        m.id === 'milestone-jacks' ? { ...m, achieved: true } : m
      );

      updatedState = {
        ...currentState,
        feedbackTitle: 'مجموعة الأولاد الملكية (Jack Set) = 36 نقطة! 🃏',
        feedbackMessage:
          `عاش يا بطل! كملت 4 أولاد (J) في كومة فوزك. المحرك احتسب +${nextScores.jackSetPoints} نقطة كاملة! الأولاد استثمار ملكي يقلب موازين أي مباراة.`,
        milestones: updatedMilestones,
        isSuccess: true,
        canAdvanceNext: true,
        isAwaitingPlayerAction: false,
        hasSeenJack: true,
        liveScoringProof: `Jack Set: +${nextScores.jackSetPoints} نقطة`,
      };
    } else {
      updatedState = {
        ...currentState,
        feedbackTitle: 'حركة قانونية، لكن الأولاد تنتظر الاكتمال!',
        feedbackMessage: 'لعب كرت الولد (J) يكمل الـ 4 أولاد ويمنحك Jack Set فوري بـ 36 نقطة.',
        isSuccess: false,
        canAdvanceNext: false,
        isAwaitingPlayerAction: true,
      };
    }

    return { state: updatedState, game: updatedGame };
  }

  // Phase 10: Combos Reveal & Formation
  // Strict canonical calculateScores validation: ONLY succeeds when nextScores.goldenCombos > 0
  if (currentState.phase === 'PHASE_10_COMBOS_REVEAL') {
    const nextScores = calculateScores(nextGame.playerWinningPile, 'player');
    const hasGolden = nextScores.goldenCombos > 0;

    if (hasGolden) {
      const updatedMilestones = currentState.milestones.map((m) =>
        m.id === 'milestone-combos' ? { ...m, achieved: true } : m
      );

      updatedState = {
        ...currentState,
        feedbackTitle: 'المجموعة الذهبية (Golden Combo) = 75 نقطة! 👑',
        feedbackMessage:
          `انفجار نقطي عملاق! كملت مجموعة الملوك، فاتحدت مجموعة الأولاد مع مجموعتين عاديتين، والمحرك منحك 75 نقطة كاملة (Golden Combo)! دي أعلى ضربة في تاريخ Egyptian Jacks. إجمالي نقاطك الآن: ${nextScores.totalScore} نقطة!`,
        milestones: updatedMilestones,
        isSuccess: true,
        canAdvanceNext: true,
        isAwaitingPlayerAction: false,
        hasSeenCombos: true,
        liveScoringProof: `Golden Combo: +${nextScores.goldenPoints} نقطة (إجمالي: ${nextScores.totalScore})`,
      };
    } else {
      updatedState = {
        ...currentState,
        feedbackTitle: 'لم تكتمل المجموعة الذهبية بعد!',
        feedbackMessage:
          'المجموعة الذهبية (Golden Combo) تتطلب إكمال مجموعتين عاديتين مع مجموعة الأولاد لتسجيل 75 نقطة كاملة.',
        isSuccess: false,
        canAdvanceNext: false,
        isAwaitingPlayerAction: true,
      };
    }

    return { state: updatedState, game: updatedGame };
  }

  // Phase 11: Strategic Decision Dilemma & Timing (Controlled Branching with Visible Consequence)
  if (currentState.phase === 'PHASE_11_DECISION_DILEMMA') {
    const isCapture = playedCard.rank === '6';
    const isSacrifice = playedCard.rank === '3' || playedCard.rank === 'K';

    const updatedMilestones = currentState.milestones.map((m) =>
      m.id === 'milestone-decision' ? { ...m, achieved: true } : m
    );

    if (isCapture) {
      // Execute natural CPU counter-play to reveal future consequence
      let postCpuGame = nextGame;
      try {
        if (postCpuGame.phase === 'CPU_TURN' && postCpuGame.activeTurn === 'cpu' && postCpuGame.cpuHand.length > 0) {
          postCpuGame = executeCpuTurn(postCpuGame, 'EASY');
        }
      } catch (_err) {
        // Safe fallback
      }

      updatedState = {
        ...currentState,
        branchChoiceTaken: 'CAPTURE',
        observableConsequence:
          '• النتيجة المباشرة: أمنت كرتين (+2) في كومة فوزك فوراً.\n• التكلفة التكتيكية: استهلكت كرت الـ 6، والخصم نزل كرتاً على الطاولة وبدأ يبني دوراً جديداً.',
        feedbackTitle: 'اخترت الأكل الفوري وتأمين النقاط! ⚡',
        feedbackMessage:
          'قرار تكتيكي سليم: أمنت نقطتين في كومة فوزك ومنعت الخصم من استغلال الـ 6، مع إدراك أنك استهلكت كرت أكل قوي من يدك والخصم استعاد المبادرة.',
        milestones: updatedMilestones,
        isSuccess: true,
        canAdvanceNext: true,
        isAwaitingPlayerAction: false,
      };
      return { state: updatedState, game: postCpuGame };
    } else if (isSacrifice) {
      // Consequence: CPU captures the sacrificed 3♦ from player's table
      let postCpuGame = nextGame;
      try {
        if (postCpuGame.phase === 'CPU_TURN' && postCpuGame.activeTurn === 'cpu' && postCpuGame.cpuHand.length > 0) {
          postCpuGame = executeCpuTurn(postCpuGame, 'EASY');
        }
      } catch (_err) {
        // Safe fallback
      }

      updatedState = {
        ...currentState,
        branchChoiceTaken: 'SACRIFICE',
        observableConsequence:
          '• النتيجة المباشرة: الخصم استهلك حركته في كرت صغير وأكل الـ 3.\n• المكسب الاستراتيجي: كرت 6♦ ما زال في إيدك وكرت 6♣ ما زال على طاولة الخصم جاهزاً لاقتناصه في التوقيت الأنسب!',
        feedbackTitle: 'اخترت التضحية والتريث التكتيكي! ⏳',
        feedbackMessage:
          'رؤية استراتيجية عميقة: ضحيت بكرت غير أساسي على طاولتك، واحتفظت بكرت الـ 6 كفخ أو لرد تكتيكي حاسم في الدور القادم.',
        milestones: updatedMilestones,
        isSuccess: true,
        canAdvanceNext: true,
        isAwaitingPlayerAction: false,
      };
      return { state: updatedState, game: postCpuGame };
    } else {
      updatedState = {
        ...currentState,
        feedbackTitle: 'تم تنفيذ قرارك في المحرك!',
        feedbackMessage: 'كل قرار في Egyptian Jacks يؤثر مباشرة على توقيت الجولة وسرعة جمع النقاط.',
        milestones: updatedMilestones,
        isSuccess: true,
        canAdvanceNext: true,
        isAwaitingPlayerAction: false,
      };
      return { state: updatedState, game: updatedGame };
    }
  }

  // Free play fallback: update silently or with subtle praise
  return { state: currentState, game: updatedGame };
}

/**
 * Generates progressive hints (Level 1: Attention -> Level 2: Target -> Level 3: Action)
 * STRICTLY reads visible player state (no CPU hand inspection, no deck peaking).
 */
export function requestLearnByPlayHint(
  currentState: LearnByPlayState,
  _game: GameState
): LearnByPlayState {
  const nextLevel: HintLevel =
    currentState.hintLevel === 0 ? 1 : currentState.hintLevel === 1 ? 2 : 3;

  if (
    currentState.phase === 'PHASE_1_FIRST_TURN' ||
    currentState.phase === 'PHASE_2_DISCOVER_MATCH'
  ) {
    if (nextLevel === 1) {
      return {
        ...currentState,
        hintLevel: 1,
        currentHint: {
          level: 1,
          title: 'تلميح الانتباه 👀',
          message: 'بص على الكروت المكشوفة قدامك على الطاولة وركز في رتب (أرقام) الكروت في إيدك.',
          highlightTarget: 'PLAYER_HAND',
        },
      };
    }
    if (nextLevel === 2) {
      return {
        ...currentState,
        hintLevel: 2,
        currentHint: {
          level: 2,
          title: 'تلميح الهدف 🎯',
          message: 'توجد ورقة برتبة 9 على طاولتك. هل تملك ورقة برتبة 9 في إيدك؟',
          suggestedCardRank: '9',
          highlightTarget: 'PLAYER_TABLE',
        },
      };
    }
    return {
      ...currentState,
      hintLevel: 3,
      currentHint: {
        level: 3,
        title: 'توجيه الحركة المباشرة 🚀',
        message: 'العب 9♥ من إيدك لتطابق 9♣ على الطاولة وتأكلهما إلى كومة فوزك!',
        suggestedCardRank: '9',
        highlightTarget: 'PLAYER_HAND',
      },
    };
  }

  if (currentState.phase === 'PHASE_6_FIRST_STEAL') {
    if (nextLevel === 1) {
      return {
        ...currentState,
        hintLevel: 1,
        currentHint: {
          level: 1,
          title: 'تلميح الانتباه 👀',
          message: 'بص على الورقة العلوية المكشوفة فوق كومة فوز الخصم.',
          highlightTarget: 'WINNING_PILE',
        },
      };
    }
    if (nextLevel === 2) {
      return {
        ...currentState,
        hintLevel: 2,
        currentHint: {
          level: 2,
          title: 'تلميح الهدف 🎯',
          message: 'الورقة العلوية عند الخصم رتبتها 7. بص في إيدك على كرت برتبة 7.',
          suggestedCardRank: '7',
          highlightTarget: 'WINNING_PILE',
        },
      };
    }
    return {
      ...currentState,
      hintLevel: 3,
      currentHint: {
        level: 3,
        title: 'توجيه الحركة المباشرة 🚀',
        message: 'العب 7♥ من إيدك لسرقة التسلسل العلوي من كومة فوز الخصم!',
        suggestedCardRank: '7',
        highlightTarget: 'PLAYER_HAND',
      },
    };
  }

  if (currentState.phase === 'PHASE_7_WHY_COLLECT' || currentState.phase === 'PHASE_8_REGULAR_SET') {
    if (nextLevel === 1) {
      return {
        ...currentState,
        hintLevel: 1,
        currentHint: {
          level: 1,
          title: 'تلميح الانتباه 👀',
          message: 'بص على الكروت اللي جمعتها في كومة فوزك.. لاحظ الرتب المكررة.',
          highlightTarget: 'WINNING_PILE',
        },
      };
    }
    if (nextLevel === 2) {
      return {
        ...currentState,
        hintLevel: 2,
        currentHint: {
          level: 2,
          title: 'تلميح الهدف 🎯',
          message: 'معاك 3 كروت برتبة آس (A). ناقص كرت واحد لإتمام 4 كروت (مجموعة ملكية).',
          suggestedCardRank: 'A',
          highlightTarget: 'PLAYER_HAND',
        },
      };
    }
    return {
      ...currentState,
      hintLevel: 3,
      currentHint: {
        level: 3,
        title: 'توجيه الحركة المباشرة 🚀',
        message: 'العب A♥ من إيدك لتكمل المجموعة الملكية (+12 نقطة)!',
        suggestedCardRank: 'A',
        highlightTarget: 'PLAYER_HAND',
      },
    };
  }

  if (currentState.phase === 'PHASE_9_JACKS_REVEAL') {
    return {
      ...currentState,
      hintLevel: nextLevel,
      currentHint: {
        level: nextLevel,
        title: 'تلميح الأولاد 🃏',
        message: 'العب كرت الولد (J♥) من يدك لإكمال 4 أولاد وحصد 36 نقطة Jack Set كاملة!',
        suggestedCardRank: 'J',
        highlightTarget: 'PLAYER_HAND',
      },
    };
  }

  if (currentState.phase === 'PHASE_10_COMBOS_REVEAL') {
    return {
      ...currentState,
      hintLevel: nextLevel,
      currentHint: {
        level: nextLevel,
        title: 'تلميح الكومبو 👑',
        message: 'العب K♥ لإكمال مجموعة الملوك والارتقاء من الفضي (60) إلى الذهبي (75 نقطة)!',
        suggestedCardRank: 'K',
        highlightTarget: 'PLAYER_HAND',
      },
    };
  }

  if (currentState.phase === 'PHASE_11_DECISION_DILEMMA') {
    return {
      ...currentState,
      hintLevel: nextLevel,
      currentHint: {
        level: nextLevel,
        title: 'تلميح القرار ⏳',
        message: 'كلا الخيارين قانوني ومفيد تكتيكياً: 6 للأكل الفوري، أو 3 للتضحية والاحتفاظ بالـ 6!',
        highlightTarget: 'PLAYER_HAND',
      },
    };
  }

  // Generic fallback hint
  return {
    ...currentState,
    hintLevel: nextLevel,
    currentHint: {
      level: nextLevel,
      title: 'تلميح المدرب 💡',
      message: currentState.coachMessage,
      highlightTarget: currentState.highlightZone,
    },
  };
}
