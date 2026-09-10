import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Lightbulb,
  CheckCircle,
  ChevronLeft,
  Award,
  HelpCircle,
  RotateCcw,
  Home,
  Zap,
  Swords,
  GraduationCap,
} from 'lucide-react';
import { LearnByPlayState } from '../tutorial/tutorialTypes';
import { soundEngine } from '../engine/soundEngine';
import { YoyoAvatar, YoyoExpression, resolveLearnByPlayReaction } from '../character/yoyo';

interface LearnByPlayCoachProps {
  state: LearnByPlayState;
  onAdvance: () => void;
  onRequestHint: () => void;
  onExit: () => void;
  onRetryCurrentPhase?: () => void;
  onPlayFullMatch?: () => void;
  onStartPracticeTable?: () => void;
  onRestartTutorial?: () => void;
}

export const LearnByPlayCoach: React.FC<LearnByPlayCoachProps> = ({
  state,
  onAdvance,
  onRequestHint,
  onExit,
  onRetryCurrentPhase,
  onPlayFullMatch,
  onStartPracticeTable,
  onRestartTutorial,
}) => {
  const [showMilestones, setShowMilestones] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);

  const {
    title,
    coachMessage,
    actionCallout,
    currentHint,
    feedbackTitle,
    feedbackMessage,
    isSuccess,
    canAdvanceNext,
    milestones,
    decisionOptions,
    isFreePlayActive,
    phaseIndex,
    totalPhases,
    observableConsequence,
    liveScoringProof,
    phase,
  } = state;

  const achievedMilestonesCount = milestones.filter((m) => m.achieved).length;
  const isRivalPhase = phase === 'PHASE_12_FREE_PLAY' || isFreePlayActive;

  // Stinger on rival transition or significant milestones
  const prevRivalRef = useRef<boolean>(isRivalPhase);
  const prevMilestonesCountRef = useRef<number>(achievedMilestonesCount);

  useEffect(() => {
    if (!prevRivalRef.current && isRivalPhase) {
      soundEngine.playStinger('rival_transition');
    } else if (achievedMilestonesCount > prevMilestonesCountRef.current) {
      soundEngine.playStinger('regular_set');
    }
    prevRivalRef.current = isRivalPhase;
    prevMilestonesCountRef.current = achievedMilestonesCount;
  }, [isRivalPhase, achievedMilestonesCount]);

  // Authoritative reaction resolution from Character Layer
  const yoyoReaction = resolveLearnByPlayReaction({
    phase,
    isSuccess,
    hasHint: !!currentHint,
    isFreePlayActive: isRivalPhase,
  });
  const yoyoExpression: YoyoExpression = yoyoReaction.expression;

  // Minimized Floating Companion mode (useful during free play)
  if (isMinimized) {
    return (
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-40 animate-fade-in font-sans">
        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          className="px-3.5 py-1.5 rounded-full bg-[#0c2415]/95 border border-[var(--gold)]/80 text-amber-300 shadow-xl backdrop-blur-md flex items-center gap-2 text-xs font-bold hover:bg-[#12331f] transition cursor-pointer"
        >
          <YoyoAvatar expression={yoyoExpression} size="sm" />
          <span>{isRivalPhase ? 'يويو (منافسك)' : 'الكوتش يويو'}: {title}</span>
          <span className="text-[10px] bg-black/40 px-1.5 py-0.5 rounded-md text-white/70">توسيع ▲</span>
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto px-2 z-30 mb-1.5 animate-fade-in font-sans select-none text-right">
      {/* Coach Header Capsule */}
      <div className="bg-gradient-to-r from-[#0c2415]/95 via-[#0e2a18]/95 to-[#0c2415]/95 backdrop-blur-md rounded-2xl border-2 border-[var(--gold)]/70 shadow-2xl p-3 sm:p-4 transition-all">
        {/* Top bar: Phase badge, Companion title, and Controls */}
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onExit}
              aria-label="الخروج إلى الصالة الرئيسية"
              className="px-2.5 py-1 rounded-lg bg-black/40 hover:bg-black/60 text-white/70 hover:text-white text-[11px] sm:text-xs font-bold transition flex items-center gap-1 border border-white/15 cursor-pointer"
            >
              <Home size={12} />
              <span>الصالة</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.playSelect();
                setShowMilestones(!showMilestones);
              }}
              aria-label="عرض شارات الإنجاز والتعلم"
              className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[11px] sm:text-xs font-bold transition flex items-center gap-1 cursor-pointer"
            >
              <Award size={13} className="text-amber-400" />
              <span>{achievedMilestonesCount}/{milestones.length} إنجازات</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {isFreePlayActive && (
              <button
                type="button"
                onClick={() => setIsMinimized(true)}
                className="text-[10px] text-white/60 hover:text-white px-2 py-0.5 rounded bg-white/5 border border-white/10"
                title="تصغير شريط المدرب للتركيز في اللعب"
              >
                تصغير ▼
              </button>
            )}

            <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] sm:text-xs font-mono font-bold ${
              isRivalPhase
                ? 'bg-red-950/40 border-red-500/50 text-red-300'
                : 'bg-[var(--gold)]/20 border-[var(--gold)]/50 text-[#ffeb3b]'
            }`}>
              {isRivalPhase ? (
                <Swords size={12} className="text-red-400" />
              ) : (
                <Zap size={12} className="text-[#ffeb3b]" />
              )}
              <span>{isRivalPhase ? 'المنافسة الحرة' : title}</span>
              {!isFreePlayActive && (
                <span className="text-white/60">({phaseIndex + 1}/{totalPhases})</span>
              )}
            </div>
          </div>
        </div>

        {/* Milestones Drawer (Expandable) */}
        {showMilestones && (
          <div className="bg-black/50 rounded-xl border border-white/10 p-2.5 my-2 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-amber-300 flex items-center gap-1">
                <Award size={13} className="text-amber-400" />
                <span>شارات الإتقان مع يويو:</span>
              </span>
              <button
                type="button"
                onClick={() => setShowMilestones(false)}
                className="text-[10px] text-white/60 hover:text-white"
              >
                إغلاق ✕
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {milestones.map((m) => (
                <div
                  key={m.id}
                  className={`p-1.5 rounded-lg border text-[10px] flex items-center gap-1.5 ${
                    m.achieved
                      ? 'bg-emerald-950/60 border-emerald-400/50 text-emerald-200'
                      : 'bg-white/5 border-white/10 text-white/40'
                  }`}
                >
                  <CheckCircle
                    size={13}
                    className={m.achieved ? 'text-emerald-400' : 'text-white/20'}
                  />
                  <span className="font-bold truncate">{m.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Coach Yoyo Character & Dynamic Dialogue Bubble */}
        <div className="py-2 flex items-start gap-3 sm:gap-4">
          {/* Yoyo Avatar Display */}
          <div className="flex flex-col items-center gap-1 shrink-0 pt-1">
            <YoyoAvatar
              expression={yoyoExpression}
              intensity={yoyoReaction.intensity}
              stage={isRivalPhase ? 'STAGE_6_RIVAL' : 'STAGE_2_COACH'}
              size={isRivalPhase ? 'lg' : 'md'}
            />
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shadow-sm ${
                isRivalPhase
                  ? 'bg-red-950/70 border-red-500/50 text-red-300'
                  : 'bg-amber-500/15 border-amber-400/40 text-amber-300/90'
              }`}
            >
              {isRivalPhase ? 'يويو (منافسك)' : 'الكوتش يويو'}
            </span>
          </div>

          {/* Dynamic Dialogue Speech Bubble */}
          <div className="flex-1 min-w-0 relative">
            {/* Speech Bubble Arrow Tail (Pointing towards Yoyo on the right in RTL) */}
            <div
              className={`absolute top-4 -right-1.5 w-3.5 h-3.5 rotate-45 z-10 ${
                isRivalPhase
                  ? 'bg-[#1e0a0a] border-t border-r border-red-500/50'
                  : 'bg-[#0a2213] border-t border-r border-[var(--gold)]/50'
              }`}
            />

            <div
              className={`relative rounded-2xl p-3 sm:p-3.5 shadow-lg border backdrop-blur-md ${
                isRivalPhase
                  ? 'bg-gradient-to-b from-[#1e0a0a]/90 to-[#120505]/95 border-red-500/50 text-red-100'
                  : 'bg-gradient-to-b from-[#0a2213]/90 to-[#06160c]/95 border-[var(--gold)]/50 text-white/95'
              }`}
            >
              <p className="text-xs sm:text-sm font-medium leading-relaxed whitespace-pre-line">
                {coachMessage}
              </p>

              {/* Live Scoring Proof Banner if available */}
              {liveScoringProof && (
                <div className="mt-2 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-400/40 text-[11px] text-amber-200 font-mono font-bold flex items-center gap-1.5">
                  <Sparkles size={12} className="text-[#ffd54f]" />
                  <span>{liveScoringProof}</span>
                </div>
              )}
            </div>

            {/* Decision Dilemma Options (Phase 11) */}
            {decisionOptions && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-2.5">
                <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-400/40 text-right">
                  <div className="text-xs font-black text-amber-300 mb-0.5">
                    [الخيار الأول: 6♦] {decisionOptions.choiceA.label}
                  </div>
                  <div className="text-[11px] text-white/80 leading-normal">
                    {decisionOptions.choiceA.description}
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-400/40 text-right">
                  <div className="text-xs font-black text-emerald-300 mb-0.5">
                    [الخيار الثاني: 3♦] {decisionOptions.choiceB.label}
                  </div>
                  <div className="text-[11px] text-white/80 leading-normal">
                    {decisionOptions.choiceB.description}
                  </div>
                </div>
              </div>
            )}

            {/* Observable Branch Consequence (Phase 11) */}
            {observableConsequence && (
              <div className="bg-black/60 rounded-xl border border-indigo-400/50 p-2.5 mt-2 text-xs text-indigo-100 animate-in fade-in">
                <div className="font-bold text-amber-300 mb-1 flex items-center gap-1">
                  <Sparkles size={13} className="text-amber-400" />
                  <span>النتيجة الواقعية لقرارك التكتيكي:</span>
                </div>
                <p className="text-[11px] sm:text-xs leading-relaxed whitespace-pre-line text-white/90">
                  {observableConsequence}
                </p>
              </div>
            )}

            {/* Feedback Card if action was evaluated */}
            {feedbackTitle && (
              <div
                className={`rounded-xl border p-2.5 mt-2 text-xs animate-in fade-in duration-200 ${
                  isSuccess
                    ? 'bg-emerald-950/80 border-emerald-400/60 text-emerald-100'
                    : 'bg-amber-950/80 border-amber-400/60 text-amber-100'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold mb-1">
                  {isSuccess ? (
                    <Sparkles size={14} className="text-[#ffeb3b]" />
                  ) : (
                    <HelpCircle size={14} className="text-amber-400" />
                  )}
                  <span>{feedbackTitle}</span>
                </div>
                <p className="text-[11px] sm:text-xs leading-relaxed text-white/90">
                  {feedbackMessage}
                </p>
              </div>
            )}

            {/* Replay CTA Climax on Phase 12 (Emotional & Inviting) */}
            {phase === 'PHASE_12_FREE_PLAY' && (
              <div className="rounded-xl border border-amber-400/50 bg-gradient-to-r from-amber-950/60 to-emerald-950/60 p-3 mt-2.5 text-center sm:text-right">
                <div className="text-xs sm:text-sm font-black text-amber-300 mb-1 flex items-center gap-1.5">
                  <Swords size={16} className="text-amber-400" />
                  <span>«خلاص... دوري أنا. وريني هتعمل إيه لوحدك! ⚔️»</span>
                </div>
                <p className="text-[11px] text-white/80 mb-2.5 leading-normal">
                  أكملت الرحلة التعليمية بنجاح. دلوقتي نلعب بجد: يا تكسبني يا أكسبك، والعب ما تبقى من الجولات بحرية وتكتيك!
                </p>
                <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                  {onPlayFullMatch && (
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playSelect();
                        onPlayFullMatch();
                      }}
                      className="px-3.5 py-1.5 rounded-xl btn-yellow-ref text-xs font-black shadow flex items-center gap-1.5 cursor-pointer"
                    >
                      <Swords size={13} />
                      <span>العب ماتش كامل ضدي ⚔️</span>
                    </button>
                  )}

                  {onStartPracticeTable && (
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playSelect();
                        onStartPracticeTable();
                      }}
                      className="px-3 py-1.5 rounded-xl bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 border border-emerald-400/40 text-xs font-bold flex items-center gap-1 cursor-pointer transition"
                    >
                      <GraduationCap size={13} />
                      <span>ميدان التدريب 🎓</span>
                    </button>
                  )}

                  {onRestartTutorial && (
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playSelect();
                        onRestartTutorial();
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-black/40 hover:bg-black/60 text-white/70 hover:text-white border border-white/15 text-xs font-bold flex items-center gap-1 cursor-pointer transition"
                    >
                      <RotateCcw size={12} />
                      <span>إعادة الشرح</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Hint Area */}
            {currentHint && (
              <div className="bg-black/60 rounded-xl border border-amber-400/40 p-2.5 mt-2 text-xs text-amber-200 flex items-start gap-2">
                <Lightbulb size={15} className="text-amber-300 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-bold block mb-0.5">[{currentHint.title}]:</span>
                  <span className="text-white/90 leading-normal">{currentHint.message}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Bottom Bar */}
        <div className="flex items-center justify-between pt-1 border-t border-white/10 gap-2">
          <div className="flex items-center gap-2">
            {!canAdvanceNext && !isFreePlayActive && (
              <button
                type="button"
                onClick={() => {
                  soundEngine.playSelect();
                  onRequestHint();
                }}
                className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/40 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <Lightbulb size={13} className="text-amber-300" />
                <span>{currentHint ? 'تلميح أدق 💡' : 'تلميح 💡'}</span>
              </button>
            )}

            {onRetryCurrentPhase && !isFreePlayActive && (
              <button
                type="button"
                onClick={onRetryCurrentPhase}
                className="px-2.5 py-1.5 rounded-xl bg-black/40 hover:bg-black/60 text-white/70 hover:text-white border border-white/15 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                title="إعادة المرحلة الحالية"
              >
                <RotateCcw size={12} />
                <span className="hidden sm:inline">إعادة المرحلة</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#ffd54f] font-medium hidden xs:inline">
              {actionCallout}
            </span>

            {canAdvanceNext && (
              <button
                type="button"
                onClick={() => {
                  soundEngine.playSelect();
                  onAdvance();
                }}
                className="px-4 py-1.5 sm:px-5 sm:py-2 rounded-xl btn-yellow-ref text-xs sm:text-sm font-black tracking-wide shadow-lg flex items-center gap-1.5 cursor-pointer transform transition active:scale-95"
              >
                <span>متابعة الخطوة التالية</span>
                <ChevronLeft size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
