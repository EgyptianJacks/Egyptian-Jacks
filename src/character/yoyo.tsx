import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, Crown, Sparkles, Check, Flame } from 'lucide-react';

/**
 * Egyptian Jacks — Canonical Character Specification
 * COACH YOYO (الكوتش يويو) — Bible v1.0
 * 
 * Identity: Modern Egyptian Teen (14–17) + Casual Streetwear + Social Card Gamer.
 * Role: Coach → Friend → Rival.
 * Architectural Principle: "The Game Engine knows what happened. Yoyo decides how Yoyo reacts to what happened."
 * Hard Visual Exclusions: NO Pharaoh, NO ancient motifs, NO pyramids, NO crowns on Yoyo.
 */

export type YoyoExpression =
  | 'idle'
  | 'curious'
  | 'watching'
  | 'thinking'
  | 'small_smile'
  | 'approval'
  | 'surprise'
  | 'surprise_steal'
  | 'surprise_golden'
  | 'celebrate_capture'
  | 'celebrate_set'
  | 'jack_set_reaction'
  | 'golden_reaction'
  | 'confused'
  | 'side_eye'
  | 'hmm'
  | 'respect'
  | 'challenge'
  | 'confident'
  | 'victory'
  | 'defeat'
  // Backward compatibility aliases
  | 'positive'
  | 'excited'
  | 'rival'
  | 'respectful_loss'
  | 'confident_win';

export type YoyoRelationshipStage =
  | 'STAGE_1_STRANGER'     // "أهلاً! أنا يويو."
  | 'STAGE_2_COACH'        // "تعالى ألعب معاك وأفهمك اللعبة."
  | 'STAGE_3_FRIEND'       // "أيوه كده يا معلم."
  | 'STAGE_4_RESPECT'      // "واضح إنك بتلقط بسرعة."
  | 'STAGE_5_CHALLENGE'    // "طيب... كفاية تدريب. دلوقتي وريني هتعمل إيه لوحدك."
  | 'STAGE_6_RIVAL'        // "خلاص... دوري أنا."
  | 'STAGE_7_RIVALRY';     // Post-match respectful rivalry

export type YoyoGameEvent =
  | 'NO_REACTION'
  | 'IDLE'
  | 'WATCHING'
  | 'THINKING'
  | 'PLAYER_CAPTURE'
  | 'PLAYER_STEAL'
  | 'PLAYER_REGULAR_SET'
  | 'PLAYER_JACK_SET'
  | 'PLAYER_SILVER_COMBO'
  | 'PLAYER_GOLDEN_COMBO'
  | 'COACH_TRANSITION'
  | 'PLAYER_WIN'
  | 'PLAYER_LOSS'
  | 'MATCH_DRAW'
  | 'QUESTIONABLE_MOVE'
  | 'HINT_REQUEST'
  // Backward-compatible legacy aliases:
  | 'DIRECT_CAPTURE'
  | 'STEAL_EXECUTION'
  | 'REGULAR_SET'
  | 'JACK_SET'
  | 'SILVER_COMBO'
  | 'GOLDEN_COMBO'
  | 'COACH_TO_RIVAL'
  | 'YOYO_WIN'
  | 'AWAITING_ACTION';

export type YoyoReactionIntensity = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'MAX';

export interface YoyoReaction {
  event: YoyoGameEvent;
  expression: YoyoExpression;
  dialogue?: string;
  relationshipStage: YoyoRelationshipStage;
  intensity: YoyoReactionIntensity;
  silent?: boolean;
}

// Backward-compatible type alias
export type YoyoReactionOutcome = YoyoReaction;

/**
 * Ordered relationship stage weights for monotonic progression.
 */
const STAGE_RANK: Record<YoyoRelationshipStage, number> = {
  STAGE_1_STRANGER: 1,
  STAGE_2_COACH: 2,
  STAGE_3_FRIEND: 3,
  STAGE_4_RESPECT: 4,
  STAGE_5_CHALLENGE: 5,
  STAGE_6_RIVAL: 6,
  STAGE_7_RIVALRY: 7,
};

function advanceStage(current: YoyoRelationshipStage | undefined, target: YoyoRelationshipStage): YoyoRelationshipStage {
  if (!current) return target;
  return STAGE_RANK[target] > STAGE_RANK[current] ? target : current;
}

/**
 * Authoritative Game Context used to normalize game results into canonical YoyoGameEvent.
 * Yoyo only inspects authoritative engine outcomes and never computes rules itself.
 */
export interface AuthoritativeGameContext {
  isCapture?: boolean;
  isSteal?: boolean;
  hasRegularSet?: boolean;
  hasJackSet?: boolean;
  hasSilverCombo?: boolean;
  hasGoldenCombo?: boolean;
  isPlayerWin?: boolean;
  isCpuWin?: boolean;
  isDraw?: boolean;
  isTransitionToRival?: boolean;
  isQuestionable?: boolean;
  currentStage?: YoyoRelationshipStage;
  hintLevel?: number;
  isFreePlay?: boolean;
}

/**
 * Normalizes authoritative game state into a canonical event using strict priority:
 * Match Outcome > Golden Combo > Silver Combo > Jack Set > Steal > Regular Set > Capture > Coach Transition > Normal
 */
export function normalizeAuthoritativeGameEvent(context: AuthoritativeGameContext): YoyoGameEvent {
  // 1. Terminal / Match Outcome
  if (context.isPlayerWin) return 'PLAYER_WIN';
  if (context.isCpuWin) return 'PLAYER_LOSS';
  if (context.isDraw) return 'MATCH_DRAW';

  // 2. Golden Combo (75 pts climax) - MUST outrank lower-level events and not be swallowed by transitions
  if (context.hasGoldenCombo) return 'PLAYER_GOLDEN_COMBO';

  // 3. Silver Combo (60 pts) - MUST outrank Jack Set (36 pts)
  if (context.hasSilverCombo) return 'PLAYER_SILVER_COMBO';

  // 4. Jack Set (36 pts)
  if (context.hasJackSet) return 'PLAYER_JACK_SET';

  // 5. Steal Execution (Top-uniform Winning Pile Capture)
  if (context.isSteal) return 'PLAYER_STEAL';

  // 6. Regular Set (12 pts)
  if (context.hasRegularSet) return 'PLAYER_REGULAR_SET';

  // 7. Direct Capture
  if (context.isCapture) return 'PLAYER_CAPTURE';

  // 8. Coach → Rival Transition (when explicitly triggered without higher-priority event)
  if (context.isTransitionToRival) return 'COACH_TRANSITION';

  // 9. Questionable / Suboptimal choice
  if (context.isQuestionable) return 'QUESTIONABLE_MOVE';

  // 10. Hint Request
  if (context.hintLevel !== undefined && context.hintLevel > 0) return 'HINT_REQUEST';

  return 'NO_REACTION';
}

/**
 * Resolves Yoyo's expression, dialogue, relationship stage, and intensity.
 * SINGLE SOURCE OF TRUTH for all Coach Yoyo reactions.
 */
export function resolveYoyoReaction(
  eventOrContext: YoyoGameEvent | AuthoritativeGameContext,
  options?: {
    hintLevel?: number;
    currentStage?: YoyoRelationshipStage;
    isFreePlay?: boolean;
  }
): YoyoReaction {
  let event: YoyoGameEvent;
  let currentStage: YoyoRelationshipStage = options?.currentStage || 'STAGE_1_STRANGER';
  let isFreePlay = options?.isFreePlay || false;
  let hintLevel = options?.hintLevel;

  if (typeof eventOrContext === 'object') {
    event = normalizeAuthoritativeGameEvent(eventOrContext);
    if (eventOrContext.currentStage) currentStage = eventOrContext.currentStage;
    if (eventOrContext.isFreePlay !== undefined) isFreePlay = eventOrContext.isFreePlay;
    if (eventOrContext.hintLevel !== undefined) hintLevel = eventOrContext.hintLevel;
  } else {
    event = eventOrContext;
  }

  // Canonical Event Resolution
  switch (event) {
    case 'PLAYER_GOLDEN_COMBO':
    case 'GOLDEN_COMBO': {
      const stage = advanceStage(currentStage, 'STAGE_5_CHALLENGE');
      return {
        event: 'PLAYER_GOLDEN_COMBO',
        expression: 'surprise_golden',
        dialogue: YOYO_SIGNATURE_QUOTES.goldenSurprise,
        relationshipStage: stage,
        intensity: 'MAX',
      };
    }

    case 'COACH_TRANSITION':
    case 'COACH_TO_RIVAL': {
      const stage = advanceStage(currentStage, 'STAGE_6_RIVAL');
      return {
        event: 'COACH_TRANSITION',
        expression: 'challenge',
        dialogue: YOYO_SIGNATURE_QUOTES.rivalTransition,
        relationshipStage: stage,
        intensity: 'MAX',
      };
    }

    case 'PLAYER_JACK_SET':
    case 'JACK_SET': {
      const stage = advanceStage(currentStage, 'STAGE_4_RESPECT');
      return {
        event: 'PLAYER_JACK_SET',
        expression: 'jack_set_reaction',
        dialogue: YOYO_SIGNATURE_QUOTES.jackSetLead,
        relationshipStage: stage,
        intensity: 'HIGH',
      };
    }

    case 'PLAYER_SILVER_COMBO':
    case 'SILVER_COMBO': {
      const stage = advanceStage(currentStage, 'STAGE_4_RESPECT');
      return {
        event: 'PLAYER_SILVER_COMBO',
        expression: 'celebrate_set',
        dialogue: YOYO_SIGNATURE_QUOTES.silverCombo,
        relationshipStage: stage,
        intensity: 'HIGH',
      };
    }

    case 'PLAYER_STEAL':
    case 'STEAL_EXECUTION': {
      const stage = advanceStage(currentStage, 'STAGE_3_FRIEND');
      const isRival = stage === 'STAGE_6_RIVAL' || isFreePlay;
      return {
        event: 'PLAYER_STEAL',
        expression: 'surprise_steal',
        dialogue: isRival ? YOYO_SIGNATURE_QUOTES.stealRival : YOYO_SIGNATURE_QUOTES.steal,
        relationshipStage: stage,
        intensity: 'HIGH',
      };
    }

    case 'PLAYER_REGULAR_SET':
    case 'REGULAR_SET': {
      const stage = advanceStage(currentStage, 'STAGE_3_FRIEND');
      return {
        event: 'PLAYER_REGULAR_SET',
        expression: 'celebrate_set',
        dialogue: YOYO_SIGNATURE_QUOTES.regularSet,
        relationshipStage: stage,
        intensity: 'MEDIUM',
      };
    }

    case 'PLAYER_CAPTURE':
    case 'DIRECT_CAPTURE': {
      const stage = advanceStage(currentStage, 'STAGE_2_COACH');
      // In Free Play / Rival phase, silence is part of the character (Section 17)
      if (isFreePlay || stage === 'STAGE_6_RIVAL') {
        return {
          event: 'PLAYER_CAPTURE',
          expression: 'watching',
          relationshipStage: stage,
          intensity: 'LOW',
          silent: true,
        };
      }
      return {
        event: 'PLAYER_CAPTURE',
        expression: 'approval',
        dialogue: YOYO_SIGNATURE_QUOTES.capture,
        relationshipStage: stage,
        intensity: 'LOW',
      };
    }

    case 'QUESTIONABLE_MOVE': {
      return {
        event: 'QUESTIONABLE_MOVE',
        expression: 'confused',
        dialogue: YOYO_SIGNATURE_QUOTES.questionableMove,
        relationshipStage: currentStage,
        intensity: 'LOW',
      };
    }

    case 'PLAYER_WIN': {
      return {
        event: 'PLAYER_WIN',
        expression: 'defeat',
        dialogue: YOYO_SIGNATURE_QUOTES.playerWins,
        relationshipStage: 'STAGE_7_RIVALRY',
        intensity: 'HIGH',
      };
    }

    case 'PLAYER_LOSS':
    case 'YOYO_WIN': {
      return {
        event: 'PLAYER_LOSS',
        expression: 'victory',
        dialogue: YOYO_SIGNATURE_QUOTES.yoyoWins,
        relationshipStage: 'STAGE_7_RIVALRY',
        intensity: 'HIGH',
      };
    }

    case 'MATCH_DRAW': {
      return {
        event: 'MATCH_DRAW',
        expression: 'small_smile',
        dialogue: YOYO_SIGNATURE_QUOTES.draw,
        relationshipStage: 'STAGE_7_RIVALRY',
        intensity: 'MEDIUM',
      };
    }

    case 'HINT_REQUEST': {
      const level = hintLevel ?? 1;
      if (level === 1) {
        return {
          event: 'HINT_REQUEST',
          expression: 'watching',
          dialogue: YOYO_SIGNATURE_QUOTES.guidanceLevel1,
          relationshipStage: currentStage,
          intensity: 'LOW',
        };
      }
      if (level === 2) {
        return {
          event: 'HINT_REQUEST',
          expression: 'curious',
          dialogue: YOYO_SIGNATURE_QUOTES.discoveryLevel2,
          relationshipStage: currentStage,
          intensity: 'LOW',
        };
      }
      if (level === 3) {
        return {
          event: 'HINT_REQUEST',
          expression: 'approval',
          dialogue: YOYO_SIGNATURE_QUOTES.confirmationLevel3,
          relationshipStage: currentStage,
          intensity: 'MEDIUM',
        };
      }
      return {
        event: 'HINT_REQUEST',
        expression: 'challenge',
        dialogue: YOYO_SIGNATURE_QUOTES.independenceLevel4,
        relationshipStage: currentStage,
        intensity: 'MEDIUM',
      };
    }

    case 'THINKING':
      return {
        event: 'THINKING',
        expression: 'thinking',
        relationshipStage: currentStage,
        intensity: 'LOW',
        silent: true,
      };

    case 'WATCHING':
      return {
        event: 'WATCHING',
        expression: 'watching',
        relationshipStage: currentStage,
        intensity: 'NONE',
        silent: true,
      };

    case 'NO_REACTION':
    case 'IDLE':
    case 'AWAITING_ACTION':
    default:
      return {
        event: 'NO_REACTION',
        expression: currentStage === 'STAGE_6_RIVAL' ? 'challenge' : 'idle',
        relationshipStage: currentStage,
        intensity: 'NONE',
        silent: true,
      };
  }
}

/**
 * Presentation helper for the LearnByPlay Coach overlay.
 * Centralizes phase reaction logic out of UI components.
 */
export function resolveLearnByPlayReaction(params: {
  phase: string;
  isSuccess: boolean;
  hasHint: boolean;
  isFreePlayActive: boolean;
}): YoyoReaction {
  const { phase, isSuccess, hasHint, isFreePlayActive } = params;

  if (isFreePlayActive || phase === 'PHASE_12_FREE_PLAY') {
    return resolveYoyoReaction('COACH_TRANSITION', {
      currentStage: 'STAGE_6_RIVAL',
      isFreePlay: true,
    });
  }

  if (phase === 'PHASE_6_FIRST_STEAL' && isSuccess) {
    return resolveYoyoReaction('PLAYER_STEAL', {
      currentStage: 'STAGE_3_FRIEND',
    });
  }

  if (phase === 'PHASE_10_COMBOS_REVEAL' && isSuccess) {
    return resolveYoyoReaction('PLAYER_GOLDEN_COMBO', {
      currentStage: 'STAGE_5_CHALLENGE',
    });
  }

  if (phase === 'PHASE_9_JACKS_REVEAL' && isSuccess) {
    return resolveYoyoReaction('PLAYER_JACK_SET', {
      currentStage: 'STAGE_4_RESPECT',
    });
  }

  if (phase === 'PHASE_8_REGULAR_SET' && isSuccess) {
    return resolveYoyoReaction('PLAYER_REGULAR_SET', {
      currentStage: 'STAGE_3_FRIEND',
    });
  }

  if ((phase === 'PHASE_3_FIRST_CAPTURE' || phase === 'PHASE_2_DISCOVER_MATCH') && isSuccess) {
    return resolveYoyoReaction('PLAYER_CAPTURE', {
      currentStage: 'STAGE_2_COACH',
    });
  }

  if (hasHint) {
    return resolveYoyoReaction('HINT_REQUEST', {
      hintLevel: 2,
      currentStage: 'STAGE_2_COACH',
    });
  }

  if (!isSuccess && phase !== 'PHASE_0_WELCOME' && phase !== 'PHASE_1_FIRST_TURN') {
    return resolveYoyoReaction('QUESTIONABLE_MOVE', {
      currentStage: 'STAGE_2_COACH',
    });
  }

  return resolveYoyoReaction('WATCHING', {
    currentStage: 'STAGE_2_COACH',
  });
}

/**
 * Presentation helper for the TutorialCoachOverlay.
 * Centralizes lesson reaction logic out of UI components.
 */
export function resolveTutorialCoachReaction(params: {
  status: string;
  currentHint?: boolean;
}): YoyoReaction {
  const { status, currentHint } = params;

  if (status === 'SUCCESS_FEEDBACK') {
    return resolveYoyoReaction('PLAYER_CAPTURE', {
      currentStage: 'STAGE_2_COACH',
    });
  }

  if (status === 'SUBOPTIMAL_FEEDBACK') {
    return resolveYoyoReaction('QUESTIONABLE_MOVE', {
      currentStage: 'STAGE_2_COACH',
    });
  }

  if (status === 'LESSON_COMPLETE') {
    return resolveYoyoReaction('PLAYER_REGULAR_SET', {
      currentStage: 'STAGE_3_FRIEND',
    });
  }

  if (currentHint) {
    return resolveYoyoReaction('HINT_REQUEST', {
      hintLevel: 2,
      currentStage: 'STAGE_2_COACH',
    });
  }

  return resolveYoyoReaction('WATCHING', {
    currentStage: 'STAGE_2_COACH',
  });
}

export const YOYO_CANONICAL_BIBLE = {
  characterNameAr: 'يويو',
  characterNameEn: 'Yoyo',
  inGameTitleAr: 'الكوتش يويو',
  inGameTitleEn: 'Coach Yoyo',
  ageRange: '14–17',
  nationality: 'Egyptian (Modern Youth Culture)',
  roleArc: 'Coach → Friend → Rival',
  northStar: 'يويو مش شخصية بتمثل مصر. يويو ولد مصري من عالم اللعبة.',
  clothingStyle: 'Casual Sport / Streetwear (hoodie, joggers, sneakers, subtle Jack playing card pocket accent)',
  hardVisualExclusions: [
    'Pharaoh',
    'Pharaoh clothing',
    'Ancient Egypt',
    'Ankh',
    'Pyramid',
    'Hieroglyphics',
    'Ancient Egyptian jewelry',
    'Crowns',
    'Pharaoh headdresses',
    'Mummy imagery',
    'Scarabs',
    'Ancient Egyptian gods',
    'Ancient temples',
  ],
} as const;

/**
 * Signature Canonical Dialogue Quotes from Character Bible v1.0
 */
export const YOYO_SIGNATURE_QUOTES = {
  greeting: 'أهلاً! أنا يويو. تعالى ألعب معاك وأفهمك اللعبة خطوة بخطوة.',
  guidanceLevel1: 'بص كده...',
  discoveryLevel2: 'شايف حاجة شبه اللي في إيدك؟',
  confirmationLevel3: 'أيوه، دي هي بالظبط.',
  independenceLevel4: 'المرة دي اختار إنت يا بطل.',
  capture: 'حلو! أكلتها. دي كومتك (Winning Pile).',
  steal: 'آه يا معلم! سرقتها!',
  stealRival: 'آه يا معلم! سرقتها! بس مش هسيبهالك سهلة!',
  regularSet: 'حلو... كده بدأت تجمع.',
  jackSetLead: 'استنى... الأربع جاكات؟! دي مش قليلة.',
  silverCombo: 'المجموعات نفسها بتركب على بعض! مجموعة أولاد + مجموعة عادية = Silver Combo (60 نقطة)!',
  goldenSurprise: 'إيه ده؟! إنت عملت Golden بجد؟! 75 نقطة كاملة!',
  rivalTransition: 'خلاص... دوري أنا. وريني هتعمل إيه لوحدك!',
  questionableMove: 'ممم... اختيار غريب. بص كده على الطاولة كويس.',
  playerWins: 'إيه ده! أنا كده عملت منك لاعب. مبروك عليك الفوز يا معلم!',
  yoyoWins: 'قلتلك مش هسيبها سهلة! بس لعبك كان عالي جداً. طب واحدة كمان يا يويو؟',
  draw: 'تعادل يا معلم! دي كانت ماتش من العيار الثقيل. نعيدها؟',
  silence: '',
} as const;

/**
 * Modern Egyptian Teen Streetwear Vector Avatar for Coach Yoyo
 * Respecting all hard visual exclusions (no pharaonic/ancient crowns).
 * Expressive face with states matching the complete expression library.
 */
export interface YoyoAvatarProps {
  expression?: YoyoExpression;
  intensity?: YoyoReactionIntensity;
  stage?: YoyoRelationshipStage;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  placement?: 'coach' | 'rival';
  className?: string;
}

export const YoyoAvatar: React.FC<YoyoAvatarProps> = ({
  expression = 'idle',
  intensity,
  stage,
  size = 'md',
  placement,
  className = '',
}) => {
  const sizeClasses = {
    xs: 'w-7 h-7',
    sm: 'w-8 h-8',
    md: 'w-11 h-11',
    lg: 'w-16 h-16 sm:w-18 sm:h-18',
    xl: 'w-24 h-24',
  };

  // Derive intensity if not explicitly passed
  const effectiveIntensity: YoyoReactionIntensity =
    intensity ||
    (expression === 'surprise_golden' || expression === 'golden_reaction'
      ? 'MAX'
      : expression === 'surprise_steal' || expression === 'challenge' || expression === 'victory'
      ? 'HIGH'
      : expression === 'celebrate_set' || expression === 'jack_set_reaction' || expression === 'excited'
      ? 'MEDIUM'
      : expression === 'curious' || expression === 'thinking' || expression === 'hmm'
      ? 'LOW'
      : 'NONE');

  // Expression classification for visual styling
  const isSurprised =
    expression === 'surprise' ||
    expression === 'surprise_steal' ||
    expression === 'surprise_golden' ||
    expression === 'golden_reaction';

  const isRival =
    placement === 'rival' ||
    stage === 'STAGE_5_CHALLENGE' ||
    stage === 'STAGE_6_RIVAL' ||
    stage === 'STAGE_7_RIVALRY' ||
    expression === 'challenge' ||
    expression === 'rival' ||
    expression === 'confident';

  const isClimax =
    expression === 'surprise_golden' ||
    expression === 'golden_reaction' ||
    expression === 'challenge' ||
    expression === 'victory';

  const isThinking =
    expression === 'thinking' ||
    expression === 'hmm' ||
    expression === 'curious' ||
    expression === 'confused';

  const isSmiling =
    expression === 'small_smile' ||
    expression === 'approval' ||
    expression === 'positive' ||
    expression === 'celebrate_capture' ||
    expression === 'celebrate_set' ||
    expression === 'jack_set_reaction' ||
    expression === 'excited' ||
    expression === 'victory' ||
    expression === 'confident_win';

  const isDefeat =
    expression === 'defeat' ||
    expression === 'respectful_loss';

  const isSideEye =
    expression === 'side_eye';

  const isGoldenMoment =
    expression === 'surprise_golden' ||
    expression === 'golden_reaction' ||
    (effectiveIntensity === 'MAX' && (expression === 'surprise' || expression === 'celebrate_set'));

  // Idle eye blink animation (soft eye blink every 3–5 seconds)
  const [isBlinking, setIsBlinking] = useState<boolean>(false);

  useEffect(() => {
    const isEligibleForIdleBlink =
      expression === 'idle' ||
      expression === 'watching' ||
      expression === 'thinking' ||
      expression === 'curious' ||
      expression === 'small_smile';

    if (!isEligibleForIdleBlink) {
      setIsBlinking(false);
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout>;
    let blinkDurationId: ReturnType<typeof setTimeout>;

    const scheduleNextBlink = () => {
      const randomInterval = 3000 + Math.random() * 2500;
      timeoutId = setTimeout(() => {
        setIsBlinking(true);
        blinkDurationId = setTimeout(() => {
          setIsBlinking(false);
          scheduleNextBlink();
        }, 160);
      }, randomInterval);
    };

    scheduleNextBlink();

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(blinkDurationId);
    };
  }, [expression]);

  // Reaction burst trigger for high/max intensity
  const [burstActive, setBurstActive] = useState<boolean>(false);
  const [burstType, setBurstType] = useState<'steal' | 'golden' | 'set' | 'capture' | null>(null);

  // Climax temporary emphasis state (lasts ~1.05s)
  const [climaxEmphasis, setClimaxEmphasis] = useState<boolean>(false);

  useEffect(() => {
    if (
      expression === 'surprise_golden' ||
      expression === 'golden_reaction' ||
      effectiveIntensity === 'MAX'
    ) {
      setClimaxEmphasis(true);
      const timer = setTimeout(() => {
        setClimaxEmphasis(false);
      }, 1050);
      return () => clearTimeout(timer);
    } else {
      setClimaxEmphasis(false);
    }
  }, [expression, effectiveIntensity]);

  useEffect(() => {
    if (effectiveIntensity === 'HIGH' || effectiveIntensity === 'MAX' || isSurprised) {
      const determinedType =
        expression === 'surprise_golden' || expression === 'golden_reaction'
          ? 'golden'
          : expression === 'surprise_steal'
          ? 'steal'
          : expression === 'celebrate_set' || expression === 'jack_set_reaction'
          ? 'set'
          : expression === 'celebrate_capture'
          ? 'capture'
          : effectiveIntensity === 'MAX'
          ? 'golden'
          : 'steal';

      setBurstType(determinedType);
      setBurstActive(true);
      const timer = setTimeout(() => {
        setBurstActive(false);
      }, 1050);
      return () => clearTimeout(timer);
    } else {
      setBurstActive(false);
      setBurstType(null);
    }
  }, [expression, effectiveIntensity, isSurprised]);

  // Micro-animation variants based on Intensity
  const animationVariants = {
    NONE: {
      scale: [1, 1.018, 1],
      y: [0, -0.8, 0],
      transition: { duration: 3.4, repeat: Infinity, ease: 'easeInOut' as const },
    },
    LOW: {
      scale: [1, 1.025, 1],
      y: [0, -1.2, 0],
      transition: { duration: 3.0, repeat: Infinity, ease: 'easeInOut' as const },
    },
    MEDIUM: {
      scale: [1, 1.06, 0.98, 1],
      y: [0, -3.5, 0.5, 0],
      transition: { duration: 0.65, ease: 'easeOut' as const },
    },
    HIGH: {
      scale: [1, 1.1, 0.96, 1],
      y: [0, -6, 1.5, 0],
      rotate: [0, -2.5, 2.5, -1, 0],
      transition: { duration: 0.6, ease: 'easeOut' as const },
    },
    MAX: {
      scale: [1, 1.2, 0.94, 1.08, 1],
      y: [0, -10, 2, -2, 0],
      rotate: [0, -4, 4, -2, 0],
      transition: { duration: 0.85, ease: 'easeInOut' as const },
    },
  };

  const activeAnimation = animationVariants[effectiveIntensity];

  // Visual borders & atmosphere
  const borderAndGlowClasses = climaxEmphasis
    ? 'border-amber-300 ring-4 ring-amber-400 shadow-[0_0_36px_rgba(251,191,36,0.95),0_0_16px_rgba(245,158,11,0.85)] scale-[1.06]'
    : isGoldenMoment
    ? 'border-amber-300 ring-4 ring-amber-400/80 shadow-[0_0_28px_rgba(251,191,36,0.7)]'
    : isRival
    ? 'border-red-500 ring-2 ring-red-500/80 shadow-[0_0_22px_rgba(239,68,68,0.6),0_0_8px_rgba(245,158,11,0.4)]'
    : isSurprised
    ? 'border-amber-400 ring-3 ring-amber-400/50 shadow-[0_0_16px_rgba(251,191,36,0.4)]'
    : isSmiling
    ? 'border-emerald-400 ring-2 ring-emerald-500/30 shadow-[0_0_12px_rgba(52,211,153,0.3)]'
    : 'border-emerald-500/60 ring-1 ring-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)]';

  const bgGradient = isGoldenMoment || climaxEmphasis
    ? 'from-[#382b07] via-[#221804] to-[#120d02]'
    : isRival
    ? 'from-[#2d0e0e] via-[#1c0808] to-[#0a0303]'
    : 'from-[#1b3022] to-[#0a170e]';

  return (
    <div className="relative inline-flex items-center justify-center">
      {/* Climax Upper-Body Accent: Streetwear Floating Jack Card */}
      {(isClimax || climaxEmphasis) && (
        <motion.div
          initial={{ scale: 0, y: 4 }}
          animate={{ scale: [1, 1.15, 1], y: [0, -3, 0] }}
          transition={{ duration: 0.8, repeat: Infinity }}
          className="absolute -top-2 -left-1.5 w-5 h-6 rounded-[4px] bg-gradient-to-b from-amber-200 via-amber-400 to-amber-500 text-black font-black text-[10px] flex items-center justify-center shadow-lg border-2 border-white z-30 pointer-events-none select-none"
          title="Streetwear Jack Card Accent"
        >
          J
        </motion.div>
      )}

      {/* Climax Shockwave Pulse Ring */}
      <AnimatePresence>
        {climaxEmphasis && (
          <motion.div
            key="climax-shockwave"
            initial={{ scale: 0.9, opacity: 0.95 }}
            animate={{ scale: 1.6, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.95, ease: 'easeOut' }}
            className="absolute inset-0 rounded-full border-2 border-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.9)] pointer-events-none z-20"
          />
        )}
      </AnimatePresence>

      {/* Dynamic Particle-Style Reaction Burst Layer */}
      <AnimatePresence>
        {burstActive && burstType && (
          <div className="absolute inset-0 pointer-events-none z-30 flex items-center justify-center">
            {/* STEAL: 8 electrical sparks (Zap icons & sparks) bursting radially outward */}
            {burstType === 'steal' && (
              <>
                {[
                  { x: 30, y: -30, icon: 'zap', delay: 0 },
                  { x: -30, y: -30, icon: 'zap', delay: 0.03 },
                  { x: 30, y: 30, icon: 'zap', delay: 0.05 },
                  { x: -30, y: 30, icon: 'zap', delay: 0.02 },
                  { x: 0, y: -40, icon: 'dot', delay: 0.04 },
                  { x: 0, y: 40, icon: 'dot', delay: 0.06 },
                  { x: 40, y: 0, icon: 'dot', delay: 0.05 },
                  { x: -40, y: 0, icon: 'dot', delay: 0.07 },
                ].map((pt, idx) => (
                  <motion.div
                    key={`steal-pt-${idx}`}
                    initial={{ x: 0, y: 0, scale: 0.2, opacity: 1 }}
                    animate={{
                      x: pt.x,
                      y: pt.y,
                      scale: [0.2, 1.35, 0.2],
                      opacity: [1, 1, 0],
                    }}
                    transition={{ duration: 0.85, delay: pt.delay, ease: 'easeOut' }}
                    className="absolute flex items-center justify-center text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.95)]"
                  >
                    {pt.icon === 'zap' ? (
                      <Zap size={14} className="fill-amber-300" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-amber-300 shadow-[0_0_6px_#fbbf24]" />
                    )}
                  </motion.div>
                ))}
                {/* Center Badge */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.5, y: 0 }}
                  animate={{ opacity: 1, scale: 1.15, y: -20 }}
                  exit={{ opacity: 0, scale: 1.3, y: -28 }}
                  transition={{ duration: 0.85, ease: 'easeOut' }}
                  className="absolute px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-400 text-black font-black text-[10px] shadow-lg shadow-amber-400/60 border border-amber-200 flex items-center gap-1"
                >
                  <Zap size={12} className="fill-black" />
                  <span>سرقة!</span>
                </motion.div>
              </>
            )}

            {/* GOLDEN COMBO: Crown + gold sparkles fountain exploding upward */}
            {burstType === 'golden' && (
              <>
                {/* Expanding golden shockwave ring */}
                <motion.div
                  initial={{ scale: 0.8, opacity: 0.9 }}
                  animate={{ scale: 1.75, opacity: 0 }}
                  transition={{ duration: 0.9, ease: 'easeOut' }}
                  className="absolute inset-0 rounded-full border-2 border-amber-300 shadow-[0_0_18px_rgba(251,191,36,0.9)]"
                />
                {/* Ascending Crown */}
                <motion.div
                  initial={{ x: 0, y: 0, scale: 0.5, opacity: 0 }}
                  animate={{ x: 0, y: -48, scale: [0.5, 1.4, 1.1], opacity: [0, 1, 1, 0] }}
                  transition={{ duration: 0.95, ease: 'easeOut' }}
                  className="absolute text-amber-300 drop-shadow-[0_0_12px_rgba(251,191,36,1)]"
                >
                  <Crown size={22} className="fill-amber-300 text-black" />
                </motion.div>
                {/* 8 Gold Sparkle particles fanning upward */}
                {[
                  { x: -34, y: -34, delay: 0 },
                  { x: -18, y: -50, delay: 0.04 },
                  { x: -6, y: -58, delay: 0.02 },
                  { x: 6, y: -58, delay: 0.02 },
                  { x: 18, y: -50, delay: 0.04 },
                  { x: 34, y: -34, delay: 0 },
                  { x: -44, y: -20, delay: 0.06 },
                  { x: 44, y: -20, delay: 0.06 },
                ].map((pt, idx) => (
                  <motion.div
                    key={`gold-pt-${idx}`}
                    initial={{ x: 0, y: 0, scale: 0.2, opacity: 0 }}
                    animate={{
                      x: pt.x,
                      y: pt.y,
                      scale: [0.2, 1.3, 0],
                      opacity: [0, 1, 0],
                    }}
                    transition={{ duration: 0.95, delay: pt.delay, ease: 'easeOut' }}
                    className="absolute text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.9)]"
                  >
                    <Sparkles size={13} className="fill-amber-300" />
                  </motion.div>
                ))}
                {/* Center Badge */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.5, y: 0 }}
                  animate={{ opacity: 1, scale: 1.25, y: -22 }}
                  exit={{ opacity: 0, scale: 1.4, y: -30 }}
                  transition={{ duration: 0.95, ease: 'easeOut' }}
                  className="absolute px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 text-black font-black text-[10px] shadow-xl shadow-amber-400/70 border border-amber-100 flex items-center gap-1"
                >
                  <Crown size={12} className="fill-black" />
                  <span>كومبو ذهبي!</span>
                </motion.div>
              </>
            )}

            {/* SET: Emerald and gold particle burst */}
            {burstType === 'set' && (
              <>
                {[
                  { x: 26, y: -26, color: 'text-emerald-400', delay: 0 },
                  { x: -26, y: -26, color: 'text-amber-300', delay: 0.03 },
                  { x: 0, y: -36, color: 'text-emerald-300', delay: 0.02 },
                  { x: 32, y: 6, color: 'text-amber-300', delay: 0.05 },
                  { x: -32, y: 6, color: 'text-emerald-400', delay: 0.04 },
                  { x: 18, y: 28, color: 'text-emerald-400', delay: 0.06 },
                  { x: -18, y: 28, color: 'text-amber-300', delay: 0.06 },
                ].map((pt, idx) => (
                  <motion.div
                    key={`set-pt-${idx}`}
                    initial={{ x: 0, y: 0, scale: 0.2, opacity: 1 }}
                    animate={{
                      x: pt.x,
                      y: pt.y,
                      scale: [0.2, 1.25, 0],
                      opacity: [1, 1, 0],
                    }}
                    transition={{ duration: 0.8, delay: pt.delay, ease: 'easeOut' }}
                    className={`absolute ${pt.color} drop-shadow-[0_0_6px_currentColor]`}
                  >
                    <Sparkles size={13} />
                  </motion.div>
                ))}
                <motion.div
                  initial={{ opacity: 0, scale: 0.6, y: 0 }}
                  animate={{ opacity: 1, scale: 1.15, y: -18 }}
                  exit={{ opacity: 0, scale: 1.3, y: -24 }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="absolute px-2 py-0.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black text-[10px] shadow-lg shadow-emerald-500/50 border border-emerald-300 flex items-center gap-1"
                >
                  <Sparkles size={11} className="text-yellow-200" />
                  <span>مجموعة!</span>
                </motion.div>
              </>
            )}

            {/* CAPTURE: Subtle quick spark */}
            {burstType === 'capture' && (
              <>
                {[
                  { x: 18, y: -18 },
                  { x: -18, y: -18 },
                  { x: 18, y: 18 },
                  { x: -18, y: 18 },
                ].map((pt, idx) => (
                  <motion.div
                    key={`cap-pt-${idx}`}
                    initial={{ x: 0, y: 0, scale: 0.3, opacity: 1 }}
                    animate={{
                      x: pt.x,
                      y: pt.y,
                      scale: [0.3, 1.1, 0],
                      opacity: [1, 1, 0],
                    }}
                    transition={{ duration: 0.55, ease: 'easeOut' }}
                    className="absolute text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,0.8)]"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 block" />
                  </motion.div>
                ))}
              </>
            )}
          </div>
        )}
      </AnimatePresence>

      <motion.div
        id={`yoyo-avatar-${expression}`}
        animate={activeAnimation}
        className={`relative rounded-full shrink-0 overflow-hidden select-none border-2 transition-all duration-300 ${borderAndGlowClasses} bg-gradient-to-b ${bgGradient} ${sizeClasses[size]} ${className}`}
        title="الكوتش يويو (Coach Yoyo)"
      >
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Background Radial Glow */}
          <circle cx="50" cy="50" r="48" fill={isRival ? '#2d1010' : '#142c1b'} />

          {/* Modern Streetwear Hoodie Shoulder / Torso */}
          <path
            d={isClimax ? 'M 12 98 C 18 70 32 66 50 66 C 68 66 82 70 88 98 Z' : 'M 16 98 C 20 74 34 68 50 68 C 66 68 80 74 84 98 Z'}
            fill={isRival ? '#4a1515' : '#1c3b28'}
            stroke={isRival ? '#2b0909' : '#0f2417'}
            strokeWidth="1.5"
          />
          {/* Hoodie Collar / Drawstrings */}
          <path
            d="M 38 68 C 42 76 46 84 48 88"
            stroke={isRival ? '#fca5a5' : '#e2e8f0'}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M 62 68 C 58 76 54 84 52 88"
            stroke={isRival ? '#fca5a5' : '#e2e8f0'}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          {/* Subtle Playing Card Jack 'J' Streetwear Patch on Chest */}
          <rect
            x="25"
            y="80"
            width="12"
            height="15"
            rx="2"
            fill={isRival ? '#2b0909' : '#0f2417'}
            stroke={isGoldenMoment ? '#fde047' : isRival ? '#ef4444' : '#fbbf24'}
            strokeWidth="0.8"
          />
          <text
            x="31"
            y="91"
            fontSize="8"
            fontWeight="bold"
            fill={isGoldenMoment ? '#fde047' : isRival ? '#ef4444' : '#fbbf24'}
            textAnchor="middle"
            fontFamily="sans-serif"
          >
            J
          </text>

          {/* Neck */}
          <rect x="43" y="54" width="14" height="15" rx="4" fill="#c68a5c" />

          {/* Head / Face: Warm natural Egyptian skin tone */}
          <ellipse cx="50" cy="42" rx="21" ry="23" fill="#d99b6d" />

          {/* Modern Textured Hairstyle (Short sides, stylish textured top) */}
          <path
            d="M 28 36 C 26 26 32 16 46 15 C 56 14 68 18 72 26 C 75 33 73 40 73 42 C 69 34 68 27 58 26 C 48 25 38 28 32 37 C 30 40 28 40 28 36 Z"
            fill="#231916"
          />
          <path
            d="M 36 21 C 42 16 54 16 63 20 C 58 19 46 19 36 21 Z"
            fill="#332420"
          />

          {/* Ears */}
          <ellipse cx="28" cy="43" rx="3.5" ry="5.5" fill="#c68a5c" />
          <ellipse cx="72" cy="43" rx="3.5" ry="5.5" fill="#c68a5c" />

          {/* Expressive Eyebrows */}
          {isSurprised ? (
            <>
              {/* Raised high in shock / surprise */}
              <path d="M 34 30 Q 41 24 46 29" stroke="#1f1614" strokeWidth="2.2" strokeLinecap="round" fill="none" />
              <path d="M 54 29 Q 59 24 66 30" stroke="#1f1614" strokeWidth="2.2" strokeLinecap="round" fill="none" />
            </>
          ) : isRival ? (
            <>
              {/* Confident, one eyebrow cocked */}
              <path d="M 34 32 Q 41 31 46 33" stroke="#1f1614" strokeWidth="2.2" strokeLinecap="round" fill="none" />
              <path d="M 54 29 Q 59 25 66 30" stroke="#1f1614" strokeWidth="2.2" strokeLinecap="round" fill="none" />
            </>
          ) : isThinking ? (
            <>
              {/* Thinking / Curious / Hmm */}
              <path d="M 34 33 Q 41 34 46 32" stroke="#1f1614" strokeWidth="2" strokeLinecap="round" fill="none" />
              <path d="M 54 28 Q 60 25 66 29" stroke="#1f1614" strokeWidth="2.2" strokeLinecap="round" fill="none" />
            </>
          ) : isDefeat ? (
            <>
              {/* Soft, acknowledging eyebrows */}
              <path d="M 34 30 Q 41 33 46 32" stroke="#1f1614" strokeWidth="2" strokeLinecap="round" fill="none" />
              <path d="M 54 32 Q 59 33 66 30" stroke="#1f1614" strokeWidth="2" strokeLinecap="round" fill="none" />
            </>
          ) : (
            <>
              {/* Friendly relaxed default */}
              <path d="M 34 32 Q 41 29 46 32" stroke="#1f1614" strokeWidth="2" strokeLinecap="round" fill="none" />
              <path d="M 54 32 Q 59 29 66 32" stroke="#1f1614" strokeWidth="2" strokeLinecap="round" fill="none" />
            </>
          )}

          {/* Expressive Eyes */}
          {isBlinking ? (
            <>
              {/* Soft natural eye blink curve */}
              <path d="M 36 39 Q 40 41.5 45 39" stroke="#2d1b14" strokeWidth="2.4" strokeLinecap="round" fill="none" />
              <path d="M 55 39 Q 60 41.5 65 39" stroke="#2d1b14" strokeWidth="2.4" strokeLinecap="round" fill="none" />
            </>
          ) : isSurprised ? (
            <>
              {/* Wide surprised eyes */}
              <ellipse cx="40" cy="38" rx="4.5" ry="5.5" fill="#ffffff" />
              <circle cx="40.5" cy="38" r="2.8" fill="#2d1b14" />
              <circle cx="41.5" cy="36.8" r="0.9" fill="#ffffff" />

              <ellipse cx="60" cy="38" rx="4.5" ry="5.5" fill="#ffffff" />
              <circle cx="59.5" cy="38" r="2.8" fill="#2d1b14" />
              <circle cx="60.5" cy="36.8" r="0.9" fill="#ffffff" />
            </>
          ) : isSideEye ? (
            <>
              {/* Side-eye shifted pupils */}
              <ellipse cx="40" cy="38" rx="3.5" ry="3.8" fill="#ffffff" />
              <circle cx="38" cy="38" r="2.2" fill="#2d1b14" />
              <circle cx="38.8" cy="37.2" r="0.8" fill="#ffffff" />

              <ellipse cx="60" cy="38" rx="3.5" ry="3.8" fill="#ffffff" />
              <circle cx="57" cy="38" r="2.2" fill="#2d1b14" />
              <circle cx="57.8" cy="37.2" r="0.8" fill="#ffffff" />
            </>
          ) : expression === 'victory' || expression === 'confident_win' ? (
            <>
              {/* Winking celebratory right eye, open left */}
              <ellipse cx="40" cy="38" rx="3.5" ry="3.8" fill="#ffffff" />
              <circle cx="40.5" cy="38" r="2.2" fill="#2d1b14" />
              <circle cx="41.2" cy="37.2" r="0.8" fill="#ffffff" />

              {/* Winking eye curve */}
              <path d="M 55 38 Q 60 42 65 38" stroke="#2d1b14" strokeWidth="2.2" strokeLinecap="round" fill="none" />
            </>
          ) : (
            <>
              {/* Warm, alert brown eyes */}
              <ellipse cx="40" cy="38" rx="3.5" ry="3.8" fill="#ffffff" />
              <circle cx="40.5" cy="38" r="2.2" fill="#2d1b14" />
              <circle cx="41.2" cy="37.2" r="0.8" fill="#ffffff" />

              <ellipse cx="60" cy="38" rx="3.5" ry="3.8" fill="#ffffff" />
              <circle cx="59.5" cy="38" r="2.2" fill="#2d1b14" />
              <circle cx="60.2" cy="37.2" r="0.8" fill="#ffffff" />
            </>
          )}

          {/* Natural Nose */}
          <path d="M 49 39 Q 52 44 48 46" stroke="#b07548" strokeWidth="1.6" strokeLinecap="round" fill="none" />

          {/* Expressive Mouth */}
          {isSurprised ? (
            // Open "O" / Shocked jaw
            <ellipse cx="50" cy="51" rx="5" ry="4" fill="#6d1b1b" stroke="#4a1212" strokeWidth="1" />
          ) : isRival ? (
            // Confident wry smirk
            <path d="M 43 51 Q 50 54 59 48" stroke="#5a2318" strokeWidth="2.2" strokeLinecap="round" fill="none" />
          ) : isDefeat ? (
            // Respectful acknowledging soft smile
            <path d="M 44 50 Q 50 53 56 50" stroke="#6b2f21" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          ) : isSmiling ? (
            // Warm open smile
            <path d="M 42 49 Q 51 56 59 49" stroke="#5a2318" strokeWidth="2.2" strokeLinecap="round" fill="none" />
          ) : (
            // Friendly natural smile
            <path d="M 43 49 Q 50 53 57 49" stroke="#6b2f21" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          )}
        </svg>

        {/* Floating Status / Reaction Badge */}
        {isSurprised && (
          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-amber-400 border border-black animate-ping" />
        )}
      </motion.div>
    </div>
  );
};
