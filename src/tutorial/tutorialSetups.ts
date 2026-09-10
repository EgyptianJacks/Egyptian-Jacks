import { TutorialLesson, HintsIntensity } from './tutorialTypes';

export interface TutorialSetup {
  setupId: string;
  lesson: TutorialLesson;
  seed: number;
  purpose: string;
  targetConcept: string;
  hintsIntensity: HintsIntensity;
  showSimplifiedScoring: boolean;
}

export const TUTORIAL_SETUPS: Record<TutorialLesson, TutorialSetup> = {
  1: {
    setupId: 'tut_lesson_1_capture',
    lesson: 1,
    seed: 1,
    purpose: 'إتقان آلية الأكل الأساسية ومطابقة الرتب من الطاولة المكشوفة مع حفظ ترتيب الكروت الملعوبة.',
    targetConcept: 'Memory & Direct Capture',
    hintsIntensity: 'high',
    showSimplifiedScoring: true,
  },
  2: {
    setupId: 'tut_lesson_2_pile_steal',
    lesson: 2,
    seed: 5,
    purpose: 'استيعاب آلية سرقة كومة فوز الخصم عبر مطابقة الورقة العلوية المفتوحة وإدارة المخاطر الدفاعية.',
    targetConcept: 'Winning Pile Steal & Vulnerability',
    hintsIntensity: 'high',
    showSimplifiedScoring: true,
  },
  3: {
    setupId: 'tut_lesson_3_patterns',
    lesson: 3,
    seed: 175,
    purpose: 'التعرف على أنماط المجموعات والمطابقات المتعددة وبناء التشكيلات ذات النقاط العالية.',
    targetConcept: 'Pattern Recognition & High-Value Combos',
    hintsIntensity: 'medium',
    showSimplifiedScoring: false,
  },
  4: {
    setupId: 'tut_lesson_4_sacrifice_timing',
    lesson: 4,
    seed: 404,
    purpose: 'التحول من اللعب التفاعلي اللحظي إلى التخطيط الاستراتيجي عبر التضحية الواعية والتحكم بتوقيت الهجوم.',
    targetConcept: 'Strategic Sacrifice, Memory Anchor & Tempo Control',
    hintsIntensity: 'low',
    showSimplifiedScoring: false,
  },
};
