import React from 'react';
import {
  Sparkles,
  Lightbulb,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Home,
  ChevronRight,
  BookOpen,
} from 'lucide-react';
import { TutorialRuntimeState } from '../tutorial/tutorialTypes';
import { YoyoAvatar, YoyoExpression, resolveTutorialCoachReaction } from '../character/yoyo';

interface TutorialCoachOverlayProps {
  runtime: TutorialRuntimeState;
  isSequentialJourney?: boolean;
  isPracticeMode?: boolean;
  onRequestHint: () => void;
  onRetry: () => void;
  onAdvanceNextLesson?: () => void;
  onCompleteLesson: () => void;
  onExitTutorial: () => void;
}

export const TutorialCoachOverlay: React.FC<TutorialCoachOverlayProps> = ({
  runtime,
  isSequentialJourney = true,
  isPracticeMode = false,
  onRequestHint,
  onRetry,
  onAdvanceNextLesson,
  onCompleteLesson,
  onExitTutorial,
}) => {
  const { status, lesson, lessonTitle, prompt, currentHint, feedbackTitle, feedbackMessage, isSuccess } =
    runtime;

  const hasNextLesson = lesson < 4 && !isPracticeMode;

  const yoyoReaction = resolveTutorialCoachReaction({
    status,
    currentHint: !!currentHint,
  });
  const currentExpression: YoyoExpression = yoyoReaction.expression;

  return (
    <div className="w-full max-w-2xl mx-auto px-2 z-30 mb-1">
      {/* State 1: Awaiting Player Action Prompt */}
      {status === 'AWAITING_ACTION' && (
        <div className="bg-[#0e2a18]/90 backdrop-blur-md rounded-2xl border-2 border-[var(--gold)]/70 shadow-2xl p-3 sm:p-4 text-right transition-all">
          <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-white/10">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onExitTutorial}
                className="px-2.5 py-1 rounded-lg bg-black/40 hover:bg-black/60 text-white/70 hover:text-white text-[11px] sm:text-xs font-bold transition flex items-center gap-1 border border-white/15 cursor-pointer"
              >
                <Home size={12} />
                <span>{isPracticeMode ? 'ميدان التدريب' : 'خروج'}</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="px-2.5 py-0.5 rounded-full bg-[var(--gold)]/20 border border-[var(--gold)]/50 text-[#ffeb3b] text-[10px] sm:text-xs font-mono font-bold">
                {isPracticeMode ? `تمرين: ${lessonTitle}` : `${lessonTitle} (${lesson} من 4)`}
              </span>
              <BookOpen size={14} className="text-[#ffeb3b]" />
            </div>
          </div>

          <div className="flex items-start gap-3 mb-2.5">
            <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
              <YoyoAvatar expression={currentExpression} intensity={yoyoReaction.intensity} size="sm" />
              <span className="text-[10px] font-bold text-amber-300 whitespace-nowrap">الكوتش يويو</span>
            </div>
            <div className="flex-1 min-w-0 relative">
              <div className="absolute top-3 -right-1 w-2.5 h-2.5 rotate-45 bg-black/40 border-t border-r border-white/10" />
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 text-xs sm:text-sm text-white font-medium leading-relaxed">
                {prompt}
              </div>
            </div>
          </div>

          {/* Hint Area */}
          {currentHint && (
            <div className="bg-black/40 rounded-xl border border-[var(--gold)]/40 p-2.5 mb-2.5 text-xs text-[#ffeb3b] flex items-start gap-2">
              <Lightbulb size={16} className="text-[#ffeb3b] flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold block mb-0.5">[{currentHint.title}]:</span>
                <span className="text-white/90 leading-normal">{currentHint.message}</span>
              </div>
            </div>
          )}

          {/* Bottom Bar: Hint Button & Guidance */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={onRequestHint}
              className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/40 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Lightbulb size={13} className="text-amber-300" />
              <span>{currentHint ? 'تلميح أدق 💡' : 'طلب تلميح 💡'}</span>
            </button>

            <span className="text-[11px] text-white/50 font-mono">
              اضغط على الكرت في يدك للعب
            </span>
          </div>
        </div>
      )}

      {/* State 2: Success Feedback */}
      {status === 'SUCCESS_FEEDBACK' && isSuccess && (
        <div className="bg-[#0b3317]/95 backdrop-blur-md rounded-2xl border-2 border-emerald-400 shadow-2xl p-3.5 sm:p-5 text-right animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-emerald-500/30">
            <div className="flex items-center gap-1.5 text-emerald-300 font-bold text-xs">
              <Sparkles size={14} className="text-[#ffeb3b]" />
              <span>{isPracticeMode ? 'إنجاز تكتيكي في ميدان التدريب' : 'مفهوم قانوني مُكتسب'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-400 font-black text-sm">
              <span>{feedbackTitle}</span>
              <CheckCircle size={17} />
            </div>
          </div>

          <div className="flex items-start gap-3 mb-4">
            <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
              <YoyoAvatar expression="positive" intensity="high" size="sm" />
              <span className="text-[10px] font-bold text-amber-300 whitespace-nowrap">الكوتش يويو</span>
            </div>
            <div className="flex-1 min-w-0 relative">
              <div className="absolute top-3 -right-1 w-2.5 h-2.5 rotate-45 bg-[#082210] border-t border-r border-emerald-400/40" />
              <div className="p-2.5 rounded-xl bg-[#082210] border border-emerald-400/40 text-xs sm:text-sm text-white/95 leading-relaxed">
                {feedbackMessage}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onRetry}
              className="px-3 py-1.5 rounded-xl bg-black/40 hover:bg-black/60 text-white/80 text-xs font-bold transition flex items-center gap-1.5 border border-white/20 cursor-pointer"
            >
              <RotateCcw size={13} />
              <span>إعادة التجربة</span>
            </button>

            {hasNextLesson && onAdvanceNextLesson ? (
              <button
                type="button"
                onClick={onAdvanceNextLesson}
                className="px-4 sm:px-6 py-2 rounded-xl btn-yellow-ref text-xs sm:text-sm font-black tracking-wide shadow-lg flex items-center gap-1.5 cursor-pointer transform transition active:scale-95"
              >
                <span>متابعة إلى الدرس التالي</span>
                <ChevronRight size={16} />
              </button>
            ) : isPracticeMode ? (
              <button
                type="button"
                onClick={onExitTutorial}
                className="px-4 sm:px-6 py-2 rounded-xl btn-yellow-ref text-xs sm:text-sm font-black tracking-wide shadow-lg flex items-center gap-1.5 cursor-pointer transform transition active:scale-95"
              >
                <span>العودة إلى ميدان التدريب</span>
                <Home size={15} />
              </button>
            ) : (
              <button
                type="button"
                onClick={onCompleteLesson}
                className="px-4 sm:px-6 py-2 rounded-xl btn-yellow-ref text-xs sm:text-sm font-black tracking-wide shadow-lg flex items-center gap-1.5 cursor-pointer transform transition active:scale-95"
              >
                <span>إنهاء الأكاديمية والعودة إلى الصالة</span>
                <Home size={15} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* State 3: Suboptimal / Missed Capture Feedback */}
      {status === 'SUBOPTIMAL_FEEDBACK' && (
        <div className="bg-[#33180b]/95 backdrop-blur-md rounded-2xl border-2 border-amber-500 shadow-2xl p-3.5 sm:p-5 text-right animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-amber-500/30">
            <span className="text-amber-300 text-xs font-bold">توجيه من الكوتش يويو</span>
            <div className="flex items-center gap-1.5 text-amber-400 font-black text-sm">
              <span>{feedbackTitle}</span>
              <AlertTriangle size={17} />
            </div>
          </div>

          <div className="flex items-start gap-3 mb-4">
            <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
              <YoyoAvatar expression="thinking" intensity="medium" size="sm" />
              <span className="text-[10px] font-bold text-amber-300 whitespace-nowrap">الكوتش يويو</span>
            </div>
            <div className="flex-1 min-w-0 relative">
              <div className="absolute top-3 -right-1 w-2.5 h-2.5 rotate-45 bg-[#231006] border-t border-r border-amber-500/40" />
              <div className="p-2.5 rounded-xl bg-[#231006] border border-amber-500/40 text-xs sm:text-sm text-white/95 leading-relaxed">
                {feedbackMessage}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onRequestHint}
              className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-bold transition flex items-center gap-1.5 border border-amber-400/40 cursor-pointer"
            >
              <Lightbulb size={13} />
              <span>أرني تلميحاً</span>
            </button>

            <button
              type="button"
              onClick={onRetry}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-[#1f2e1c] text-xs sm:text-sm font-black shadow-lg flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw size={14} />
              <span>إعادة المحاولة من جديد</span>
            </button>
          </div>
        </div>
      )}

      {/* State 4: Lesson Complete Screen */}
      {status === 'LESSON_COMPLETE' && (
        <div className="bg-[#0b2814]/98 backdrop-blur-md rounded-2xl border-4 border-[var(--gold)] shadow-2xl p-4 sm:p-6 text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="flex flex-col items-center justify-center mb-2">
            <YoyoAvatar expression="excited" size="lg" />
            <span className="text-xs font-bold text-[#ffd54f] mt-1">الكوتش يويو: عاش يا معلم!</span>
          </div>

          <h3 className="text-base sm:text-lg font-black text-[#ffeb3b] mb-1">
            {feedbackTitle || 'اكتمل الدرس بنجاح!'}
          </h3>

          <p className="text-xs sm:text-sm text-[#c8e6c9] max-w-md mx-auto leading-relaxed mb-4">
            {feedbackMessage}
          </p>

          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={onRetry}
              className="px-3.5 py-2 rounded-xl bg-black/40 hover:bg-black/60 text-white/90 text-xs font-bold transition flex items-center gap-1.5 border border-white/20 cursor-pointer"
            >
              <RotateCcw size={14} />
              <span>إعادة الدرس</span>
            </button>

            {hasNextLesson && onAdvanceNextLesson ? (
              <button
                type="button"
                onClick={onAdvanceNextLesson}
                className="px-5 py-2.5 rounded-xl btn-yellow-ref text-xs sm:text-sm font-black shadow-xl flex items-center gap-1.5 cursor-pointer transform transition active:scale-95"
              >
                <span>متابعة إلى الدرس التالي</span>
                <ChevronRight size={15} />
              </button>
            ) : (
              <button
                type="button"
                onClick={onExitTutorial}
                className="px-5 py-2.5 rounded-xl btn-yellow-ref text-xs sm:text-sm font-black shadow-xl flex items-center gap-1.5 cursor-pointer transform transition active:scale-95"
              >
                <Home size={15} />
                <span>العودة إلى الصالة الرئيسية</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

