import { GameState, ScoreBreakdown } from '../../types/game';
import { YoyoBrain } from './yoyoBrain';
import { PlayerArchetype } from './yoyoTypes';
import { CanonicalMatchTimeline } from './yoyoCoachingTypes';

export interface YoyoPostMatchAnalysis {
  headline: string;
  yoyoQuote: string;
  whatPlayerDidWell: string;
  whatYoyoExploited: string;
  turningPoint: string;
  adaptationInsight: string;
  nextChallengeTip: string;
  playerArchetype: PlayerArchetype;
  strategicDepthScore: number;
  yoyoLearning?: string;
  timelineEvidenceTrace?: string;
}

export class YoyoMatchAnalysis {
  /**
   * Generates a concise, strategic post-match analysis in authentic Egyptian gaming voice.
   * Features evidence-driven turning point grounded in Canonical Timeline, and deep self-reflection on Yoyo's hypotheses.
   */
  public static analyzeMatch(
    gameState: GameState,
    playerScore: ScoreBreakdown,
    cpuScore: ScoreBreakdown,
    brain: YoyoBrain,
    timeline?: CanonicalMatchTimeline
  ): YoyoPostMatchAnalysis {
    const isPlayerWin = playerScore.totalScore > cpuScore.totalScore;
    const isDraw = playerScore.totalScore === cpuScore.totalScore;
    const playerModel = brain.getPlayerModel();
    const adaptationModel = brain.getAdaptationModel();
    const metrics = playerModel.getMetrics();
    const memory = playerModel.getMatchMemory();
    const hypotheses = adaptationModel.getHypotheses();

    // 1. Check for Yoyo hypothesis failures / learning from mistakes
    const disprovedHypo = hypotheses.find((h) => h.status === 'DISPROVED');
    const validatedHypo = hypotheses.find((h) => h.status === 'VALIDATED');

    let yoyoLearning = 'تابعت نسق اللعب بدقة وراجعت توقعاتي لكل دور.';
    if (isPlayerWin && disprovedHypo) {
      if (disprovedHypo.targetRank) {
        yoyoLearning = `أنا بنيت خطتي على إنك بتجمع رتبة ${disprovedHypo.targetRank}، بس قراءتي طلعت غلط وإنت غيرت الهدف.`;
      } else {
        yoyoLearning = 'كنت متوقع تستمر في الاندفاع للأكل الفوري، بس تريثك كسر حساباتي تماماً.';
      }
    } else if (isPlayerWin && metrics.strategicSacrificesCount > 0) {
      yoyoLearning = 'تأخرت في قراءة تضحياتك على الطاولة، وافتكرتك بترمي كروت عشوائية لحد ما فاجئتني بالمجموعة.';
    } else if (!isPlayerWin && validatedHypo) {
      yoyoLearning = `توقعت تركيزك على خطتك (${validatedHypo.description}) ونجحت في غلق المساحات.`;
    }

    // 2. Turning point detection: Timeline (Priority 1) -> Player Memory (Priority 2)
    let turningPoint = 'الصراع المستمر على الكروت المكشوفة في منتصف الماتش';
    let timelineTrace: string | undefined = undefined;

    if (timeline) {
      // Timeline check for combo formation
      const playerCombo = timeline.combosFormed.find((c) => c.actor === 'player');
      const timelineSteal = timeline.actions.find(
        (a) => a.actor === 'player' && a.isSteal
      );
      const playerSet = timeline.setsFormed.find((s) => s.actor === 'player');

      if (playerCombo) {
        turningPoint = `تحقيق كومبو ${playerCombo.comboType} بقيمة ${playerCombo.points} نقطة`;
        timelineTrace = `Timeline event #${playerCombo.sequence}: ${playerCombo.comboType}`;
      } else if (timelineSteal) {
        turningPoint = `اقتناص سرقة الكومة بالكرت ${timelineSteal.cardPlayed.rank} في الدور #${timelineSteal.turnNumber}`;
        timelineTrace = `Timeline action #${timelineSteal.sequence}: STEAL`;
      } else if (playerSet) {
        turningPoint = `إكمال مجموعة كروت ${playerSet.rank} (${playerSet.isJackSet ? 'الأولاد 36 نقطة' : '12 نقطة'})`;
        timelineTrace = `Timeline set #${playerSet.sequence}: rank ${playerSet.rank}`;
      }
    }

    if (turningPoint === 'الصراع المستمر على الكروت المكشوفة في منتصف الماتش') {
      const turningPointEntry =
        memory.find((m) => m.category === 'STEAL' || m.category === 'SET' || m.category === 'ADAPTATION') ||
        memory[0];

      if (turningPointEntry) {
        turningPoint = `في التوزيع #${turningPointEntry.dealNumber}: ${turningPointEntry.actionSummary}`;
      }
    }

    // 3. What player did well
    let whatPlayerDidWell = 'قراءة حركة الطاولة والتركيز على الكروت المكشوفة.';
    if (metrics.goldenCombosCount > 0) {
      whatPlayerDidWell = 'تحقيق الجولدن كومبو النادر (75 نقطة) بإتقان استثنائي!';
    } else if (metrics.silverCombosCount > 0) {
      whatPlayerDidWell = 'بناء المجموعة الفضية وتجميع الأولاد بكفاءة عالية (60 نقطة).';
    } else if (metrics.strategicSacrificesCount > 0) {
      whatPlayerDidWell = 'الصبر على الأكلات السهلة وبناء طاولة قوية تكتيكياً.';
    } else if (metrics.stealsExecutedCount > 0) {
      whatPlayerDidWell = 'مباغتة الخصم وسرقة الكومة في التوقيت المناسب.';
    }

    // 4. What Yoyo exploited / observed
    let whatYoyoExploited = 'اللعب المتوازن والحرص المتبادل على عدم ارتكاب أخطاء مكلفة.';
    if (!isPlayerWin) {
      if (metrics.consecutivePredictableActions >= 2 || metrics.directCapturesCount > 4) {
        whatYoyoExploited = 'كنت بتاخد الأكلة السهلة بسرعة، فبدأت أقفل عليك الطاولة وأمنع الكروت.';
      } else if (metrics.missedStealOpportunitiesCount > 0) {
        whatYoyoExploited = 'استغليت تفويت سرقة الكومة وحافظت على كروت الفوز.';
      } else if (metrics.recklessDiscardsCount > 0) {
        whatYoyoExploited = 'نزول كروت عالية مكشوفة سمح للخصم باقتناصها فوراً.';
      }
    } else {
      if (disprovedHypo && disprovedHypo.targetRank) {
        whatYoyoExploited = `حاولت أحرمك من كروت ${disprovedHypo.targetRank}، بس إنت سبقت بخطوة وسحبت البساط.`;
      } else {
        whatYoyoExploited = 'حاولت أقفل عليك السكك بس إنت كنت بتسبق بخطوة ومركّز.';
      }
    }

    // 5. Adaptation Insight
    let adaptationInsight = 'حافظت على نسق لعب ثابت طوال الجولات.';
    if (metrics.adaptationsCount > 0) {
      adaptationInsight = 'غيرت أسلوبك بذكاء في الوقت المناسب وكسرت التوقع.';
    } else if (metrics.strategicSacrificesCount > 0) {
      adaptationInsight = 'لعبت بتكتيك الصبر وبناء المجموعات بدلاً من الاندفاع.';
    }

    // 6. Next Challenge Tip
    let nextChallengeTip = 'جرب تركز على تجميع الأولاد الأربعة لعمل مجموعة خاصة (36 نقطة).';
    if (metrics.goldenCombosCount === 0 && metrics.silverCombosCount > 0) {
      nextChallengeTip = 'أنت قريب جداً من الجولدن! ركز على الاحتفاظ بالأولاد مع 4 مجموعات عادية.';
    } else if (metrics.stealsExecutedCount === 0) {
      nextChallengeTip = 'دائماً راقب الكرت الأعلى في كومة فوز الخصم؛ سرقتها بتقلب موازين الماتش.';
    } else if (metrics.strategicSacrificesCount === 0) {
      nextChallengeTip = 'مش كل كرت لازم تاكله فوراً؛ أحياناً تركه على طاولتك يصنع تجميعة أكبر.';
    }

    // 7. YOYO Quote & Headline
    let headline = isPlayerWin ? 'فوز استراتيجي مستحق!' : isDraw ? 'تعادل ناري وتكافؤ كامل!' : 'مباراة تكتيكية قوية!';
    let yoyoQuote = '';

    if (isPlayerWin) {
      if (disprovedHypo && disprovedHypo.targetRank) {
        yoyoQuote = `أنا افتكرتك لسه مركز على رتبة ${disprovedHypo.targetRank}... قراءتي طلعت أوت وإنت فاجئتني بتغيير الخطة! عاش يا بطل.`;
      } else if (metrics.adaptationsCount > 0) {
        yoyoQuote = 'إنت غيرت طريقتك في الوقت الصح... أنا كنت مستني منك نفس الحركة وإنت عكستها! مبروك يا معلم.';
      } else if (metrics.strategicSacrificesCount > 0) {
        yoyoQuote = 'فهمت لعبتك متأخر... كنت سايب الأكلة عشان محضر لتجميعة أكبر. برافو!';
      } else if (metrics.goldenCombosCount > 0) {
        yoyoQuote = 'جولدن كومبو؟! دي حركة للتاريخ... استاهلت الفوز بجدارة!';
      } else {
        yoyoQuote = 'لعبتها أذكى مني المرة دي... بس الماتش الجاي مش هسيبلك فرصة!';
      }
    } else if (isDraw) {
      yoyoQuote = 'ماتش على شعرة! لا أنا عرفت أهرب ولا إنت سبتلي مساحة. لازم ماتش فاصل!';
    } else {
      if (metrics.directCapturesCount > 4) {
        yoyoQuote = 'كنت بتاخد الأكلة السهلة بسرعة، فبدأت أقفل عليك... ركز على تجميع الكروت الكبيرة المرة الجاية!';
      } else {
        yoyoQuote = 'ماتش جامد... اتعلمت من طريقتك، يلا ماتش تاني ونشوف مين هيكسب!';
      }
    }

    return {
      headline,
      yoyoQuote,
      whatPlayerDidWell,
      whatYoyoExploited,
      turningPoint,
      adaptationInsight,
      nextChallengeTip,
      playerArchetype: metrics.archetype,
      strategicDepthScore: metrics.strategicDepthScore,
      yoyoLearning,
    };
  }
}
