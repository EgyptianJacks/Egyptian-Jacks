import { YoyoExpression, YoyoRelationshipStage } from '../yoyo';
import {
  GameSituation,
  PlayerArchetype,
  YoyoDialogueLine,
  YoyoDifficultyLevel,
  YoyoIntent,
} from './yoyoTypes';

export interface SemanticDialogueContext {
  situation: GameSituation;
  playerArchetype: PlayerArchetype;
  secondaryArchetype?: PlayerArchetype;
  relationshipStage: YoyoRelationshipStage;
  difficultyLevel: YoyoDifficultyLevel;
  confidence: number;
  turnsSinceLastDialogue: number;
  isPlayerMove: boolean;
  isFirstMatch?: boolean;
}

export class YoyoDialogueSystem {
  // Cooldown constraint: at least 2 turns between non-crucial dialogues
  private static readonly COOLDOWN_TURNS = 2;

  /**
   * Generates a semantic, contextual Egyptian teenager gamer dialogue line.
   * Employs strict silence thresholds, priority ratings, and context-dependent phrasing.
   */
  public static generateSemanticLine(context: SemanticDialogueContext): YoyoDialogueLine {
    const {
      situation,
      playerArchetype,
      relationshipStage,
      difficultyLevel,
      confidence,
      turnsSinceLastDialogue,
      isPlayerMove,
      isFirstMatch,
    } = context;

    const isCompetitive =
      relationshipStage === 'STAGE_6_RIVAL' ||
      relationshipStage === 'STAGE_7_RIVALRY' ||
      difficultyLevel === 'LEVEL_3_RIVAL' ||
      difficultyLevel === 'LEVEL_4_MASTER';

    // Priority 10: Golden Combo Discovery
    if (situation.type === 'GOLDEN_THREAT') {
      return {
        text: 'إيه ده؟! جولدن كومبو بجد؟! 75 نقطة كاملة! أوكي... إنت بقيت فاهم اللعبة صح!',
        intent: 'GOLDEN_DISCOVERY',
        expression: 'surprise_golden',
        intensity: 'MAX',
        priority: 10,
      };
    }

    // Priority 9: Silver Combo Discovery
    if (situation.type === 'SILVER_THREAT') {
      return {
        text: isCompetitive
          ? 'المجموعة الفضية! 60 نقطة في كومتك... إنت مركز على المكسب بجد.'
          : 'يا لعيب! جمعت المجموعة الفضية: 4 أولاد ومجموعة كاملة = 60 نقطة!',
        intent: 'COMBO_DISCOVERY',
        expression: 'respect',
        intensity: 'HIGH',
        priority: 9,
      };
    }

    // Priority 8: Winning Pile Steal
    if (situation.type === 'WINNING_PILE_STEAL') {
      if (isPlayerMove) {
        if (playerArchetype === 'TACTICAL' || playerArchetype === 'MASTER') {
          return {
            text: 'سرقة في التوقيت الصح... إنت كنت مستني اللحظة دي!',
            intent: 'RESPECT',
            expression: 'surprise_steal',
            intensity: 'HIGH',
            priority: 8,
          };
        }
        return {
          text: 'آه يا معلم! سرقتها مني؟! عينك صاحية على الكومة!',
          intent: 'SURPRISE',
          expression: 'surprise_steal',
          intensity: 'HIGH',
          priority: 8,
        };
      } else {
        return {
          text: isCompetitive
            ? 'سرقت الكومة! ركز معايا... أي غلطة هنا بحساب.'
            : 'أخدت الكومة كلها! شفت إزاي المطابقة مع الكرت المكشوف بتقلب الماتش؟',
          intent: 'CHALLENGE',
          expression: 'confident',
          intensity: 'HIGH',
          priority: 8,
        };
      }
    }

    // Priority 7: Strategic Sacrifice
    if (situation.type === 'GOOD_STRATEGIC_SACRIFICE') {
      if (playerArchetype === 'TACTICAL' || playerArchetype === 'PATIENT') {
        return {
          text: 'إنت سايب الأكلة السهلة ليه؟... استنى، شكلك محضر لتجميعة أكبر.',
          intent: 'SUSPICION',
          expression: 'curious',
          intensity: 'MEDIUM',
          priority: 7,
        };
      }
      return {
        text: 'سبت الأكلة ونزلت الكرت على طاولتك؟ حركة فيها تفكير.',
        intent: 'STRATEGIC_RECOGNITION',
        expression: 'curious',
        intensity: 'MEDIUM',
        priority: 7,
      };
    }

    // Priority 7: Player Adaptation Detected
    if (situation.type === 'PLAYER_ADAPTATION') {
      return {
        text: 'أنا كنت مستني منك نفس الحركة... وإنت غيرت طريقتك! عاجبني لعبك.',
        intent: 'ADAPTATION_NOTICE',
        expression: 'respect',
        intensity: 'HIGH',
        priority: 7,
      };
    }

    // Priority 6: Missed Steal
    if (situation.type === 'MISSED_STEAL') {
      if (isFirstMatch) {
        return {
          text: 'بص على أعلى كرت في كومتي... كان ممكن تخطف الكومة كلها بنفس الرقم!',
          intent: 'TEACHING_MOMENT',
          expression: 'curious',
          intensity: 'MEDIUM',
          priority: 6,
        };
      }
      return {
        text: 'فوت سرقة الكومة؟ شكلك ما أخدتش بالك!',
        intent: 'PLAYFUL_TEASE',
        expression: 'small_smile',
        intensity: 'LOW',
        priority: 6,
      };
    }

    // Check Cooldown for non-critical events (Priority < 7)
    if (turnsSinceLastDialogue < YoyoDialogueSystem.COOLDOWN_TURNS) {
      return {
        text: '',
        intent: 'OBSERVE',
        expression: 'watching',
        intensity: 'NONE',
        silent: true,
        priority: 1,
      };
    }

    // Priority 5: High Value Capture
    if (situation.type === 'HIGH_VALUE_CAPTURE') {
      if (isPlayerMove) {
        if (playerArchetype === 'TACTICAL' || playerArchetype === 'MASTER') {
          return {
            text: 'دي مش مجرد أكلة... إنت قفلت عليا الطريق.',
            intent: 'RESPECT',
            expression: 'respect',
            intensity: 'MEDIUM',
            priority: 5,
          };
        }
        return {
          text: 'أكلة تقيلة! كروت مهمة دخلت كومتك.',
          intent: 'RECOGNIZE',
          expression: 'approval',
          intensity: 'MEDIUM',
          priority: 5,
        };
      }
      return {
        text: 'أكلت كروت مهمة من على الطاولة!',
        intent: 'PRESSURE',
        expression: 'challenge',
        intensity: 'LOW',
        priority: 5,
      };
    }

    // Priority 4: Immediate Capture
    if (situation.type === 'IMMEDIATE_CAPTURE') {
      if (isPlayerMove) {
        if (playerArchetype === 'NOVICE' || isFirstMatch) {
          return {
            text: 'حلو! أكلتها. الكروت دي بتروح كومتك على طول.',
            intent: 'TEACHING_MOMENT',
            expression: 'approval',
            intensity: 'LOW',
            priority: 4,
          };
        } else if (playerArchetype === 'AGGRESSIVE') {
          return {
            text: 'بتاكل أي حاجة قدامك بسرعة... بس خلي بالك من الطاولة.',
            intent: 'PLAYFUL_TEASE',
            expression: 'small_smile',
            intensity: 'LOW',
            priority: 4,
          };
        }
      }
      // Often better to stay silent on ordinary captures
      return {
        text: '',
        intent: 'OBSERVE',
        expression: 'watching',
        intensity: 'NONE',
        silent: true,
        priority: 2,
      };
    }

    // Priority 3: Likely Mistake
    if (situation.type === 'LIKELY_MISTAKE') {
      if (isFirstMatch) {
        return {
          text: 'خلي بالك... كان عندك أكلة جاهزة على الطاولة بس سبتها.',
          intent: 'TEACHING_MOMENT',
          expression: 'curious',
          intensity: 'LOW',
          priority: 3,
        };
      }
      return {
        text: 'رمية غريبة دي... ولا ده فخ؟',
        intent: 'SUSPICION',
        expression: 'curious',
        intensity: 'LOW',
        priority: 3,
      };
    }

    // Default: Silence is golden
    return {
      text: '',
      intent: 'OBSERVE',
      expression: 'watching',
      intensity: 'NONE',
      silent: true,
      priority: 0,
    };
  }

  /**
   * Backward compatibility helper for legacy call sites.
   */
  public static generateLine(context: any): YoyoDialogueLine {
    const intent: YoyoIntent = context.intent || 'OBSERVE';
    const relationshipStage: YoyoRelationshipStage = context.relationshipStage || 'STAGE_1_STRANGER';

    if (intent === 'WELCOME') {
      return {
        text: 'إيه يا معلم؟ داخل تتفرج ولا داخل تلعب؟ تعالى نبدأ أول ماتش مع بعض!',
        intent: 'WELCOME',
        expression: 'idle',
        intensity: 'MEDIUM',
        priority: 5,
      };
    }
    if (intent === 'CELEBRATE') {
      return {
        text: 'إيه ده؟! عملت Golden بجد؟! 75 نقطة كاملة! أوكي... إنت بدأت تفهم.',
        intent: 'CELEBRATE',
        expression: 'surprise_golden',
        intensity: 'MAX',
        priority: 10,
      };
    }
    if (intent === 'SURPRISE') {
      return {
        text: 'آه يا معلم! سرقتها مني؟! عينك صاحية!',
        intent: 'SURPRISE',
        expression: 'surprise_steal',
        intensity: 'HIGH',
        priority: 8,
      };
    }
    if (intent === 'CHALLENGE') {
      return {
        text: 'دوري أنا. وريني هتعمل إيه لوحدك.',
        intent: 'CHALLENGE',
        expression: 'challenge',
        intensity: 'HIGH',
        priority: 7,
      };
    }
    if (intent === 'RESPECT') {
      return {
        text: 'حركة حلوة... إنت حسبتها صح.',
        intent: 'RESPECT',
        expression: 'respect',
        intensity: 'MEDIUM',
        priority: 6,
      };
    }
    if (intent === 'VICTORY') {
      return {
        text: 'ماتش جامد يا معلم! تلعب تاني ونشوف مين يسيطر؟',
        intent: 'VICTORY',
        expression: 'victory',
        intensity: 'HIGH',
        priority: 9,
      };
    }
    if (intent === 'DEFEAT') {
      return {
        text: 'لعبت بذكاء واستاهلت الفوز... ماتش تاني دلوقتي؟ لازم أردها!',
        intent: 'DEFEAT',
        expression: 'defeat',
        intensity: 'HIGH',
        priority: 9,
      };
    }

    return {
      text: '',
      intent: 'OBSERVE',
      expression: 'watching',
      intensity: 'NONE',
      silent: true,
      priority: 0,
    };
  }
}
