import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, ArrowDown, ChevronRight, X, Swords, Eye, CheckCircle2 } from 'lucide-react';
import { CoachingMoment, CoachingBoardTarget } from '../character/brain/yoyoCoachingTypes';
import { YoyoAvatar } from '../character/yoyo';

interface YoyoBoardDirectorProps {
  moment: CoachingMoment | null;
  onDismiss: () => void;
  onNextStep?: () => void;
}

interface TargetBoundingBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export const YoyoBoardDirector: React.FC<YoyoBoardDirectorProps> = ({
  moment,
  onDismiss,
  onNextStep,
}) => {
  const [targetBox, setTargetBox] = useState<TargetBoundingBox | null>(null);

  useEffect(() => {
    if (!moment) {
      setTargetBox(null);
      return;
    }

    const updateTargetRect = () => {
      let element: Element | null = null;

      // 1. Try card IDs first
      if (moment.highlightedCardIds && moment.highlightedCardIds.length > 0) {
        for (const cardId of moment.highlightedCardIds) {
          element = document.querySelector(`[data-card-anchor="${cardId}"]`);
          if (element) break;
        }
      }

      // 2. Try ranks next
      if (!element && moment.highlightedRanks && moment.highlightedRanks.length > 0) {
        for (const rank of moment.highlightedRanks) {
          element = document.querySelector(`[data-card-rank="${rank}"]`);
          if (element) break;
        }
      }

      // 3. Try primaryTarget zone anchor
      if (!element && moment.primaryTarget) {
        element = document.querySelector(`[data-zone-anchor="${moment.primaryTarget}"]`);
      }

      if (element) {
        const rect = element.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setTargetBox({
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
          });
          return;
        }
      }

      setTargetBox(null);
    };

    updateTargetRect();
    window.addEventListener('resize', updateTargetRect);
    window.addEventListener('scroll', updateTargetRect, true);

    const timer = setTimeout(updateTargetRect, 80);
    return () => {
      window.removeEventListener('resize', updateTargetRect);
      window.removeEventListener('scroll', updateTargetRect, true);
      clearTimeout(timer);
    };
  }, [moment]);

  if (!moment) return null;

  const {
    presentationLevel,
    conceptTitle,
    dialogue,
    expression,
    animation,
    primaryTarget,
    secondaryTarget,
    evidence,
    isFirstOrientation,
  } = moment;

  // Board Target helper for visual badges
  const getTargetLabel = (target?: CoachingBoardTarget): string => {
    switch (target) {
      case 'PLAYER_LAND':
        return 'أرض اللاعب (طاولتك)';
      case 'OPPONENT_LAND':
        return 'أرض الخصم (طاولة يويو)';
      case 'PLAYER_WINNING_PILE':
        return 'كومة فوزك';
      case 'OPPONENT_WINNING_PILE':
        return 'كومة فوز يويو';
      case 'TABLE_CENTER':
        return 'وسط الطاولة';
      default:
        return '';
    }
  };

  // Avatar Animation variants based on YoyoAnimationIntent
  const getAvatarMotionProps = () => {
    switch (animation) {
      case 'CELEBRATE_RECOVERY':
      case 'CELEBRATE':
        return {
          animate: { y: [0, -8, 0], scale: [1, 1.08, 1], rotate: [0, -3, 3, 0] },
          transition: { duration: 0.8, repeat: 2 },
        };
      case 'SURPRISE':
        return {
          animate: { scale: [1, 1.15, 1], y: [0, -4, 0] },
          transition: { duration: 0.5 },
        };
      case 'WARNING':
        return {
          animate: { x: [-3, 3, -3, 3, 0] },
          transition: { duration: 0.5 },
        };
      case 'POINT':
        return {
          animate: { x: [0, -6, 0] },
          transition: { duration: 0.7, repeat: 2 },
        };
      default:
        return {
          animate: { scale: [0.95, 1] },
          transition: { duration: 0.25 },
        };
    }
  };

  return (
    <div
      id="yoyo-board-director-overlay"
      className="pointer-events-none fixed inset-0 z-40 flex flex-col justify-between p-3 sm:p-6"
      aria-live="polite"
    >
      {/* Visual Target Spotlights */}
      <AnimatePresence>
        {primaryTarget && (
          <motion.div
            key={`spotlight-${primaryTarget}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none"
          >
            {/* Soft backdrop vignette if Level 3, Level 4, or Orientation */}
            {(presentationLevel === 'LEVEL_3_TEACHING_CARD' ||
              presentationLevel === 'LEVEL_4_INTERACTIVE_MOMENT' ||
              isFirstOrientation) && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] transition-all" />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Physical DOM Target Highlight Ring & Pointer */}
      <AnimatePresence>
        {targetBox && (
          <motion.div
            key="physical-board-target"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            style={{
              position: 'fixed',
              left: `${targetBox.left - 4}px`,
              top: `${targetBox.top - 4}px`,
              width: `${targetBox.width + 8}px`,
              height: `${targetBox.height + 8}px`,
              pointerEvents: 'none',
              zIndex: 45,
            }}
          >
            <div className="w-full h-full rounded-2xl border-3 border-amber-400 shadow-[0_0_25px_rgba(251,191,36,0.6)] ring-4 ring-amber-300/30 animate-pulse" />
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
              className="absolute -top-7 left-1/2 -translate-x-1/2 bg-amber-400 text-black px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 shadow-md whitespace-nowrap"
            >
              <Sparkles size={12} />
              <span>عينك هنا!</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Presentation Container */}
      <div className="relative w-full max-w-xl mx-auto my-auto pointer-events-auto z-50">
        <AnimatePresence mode="wait">
          {/* LEVEL 1: Board Highlight Pill */}
          {presentationLevel === 'LEVEL_1_BOARD_HIGHLIGHT' && (
            <motion.div
              key={moment.id}
              initial={{ opacity: 0, y: 15, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="mx-auto max-w-md bg-black/85 border-2 border-[var(--gold)] rounded-2xl shadow-2xl p-3 sm:p-4 text-white flex items-center gap-3 backdrop-blur-md"
            >
              <motion.div {...getAvatarMotionProps()}>
                <YoyoAvatar expression={expression} size="sm" />
              </motion.div>
              <div className="flex-1 text-right">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[var(--gold)]">
                    {conceptTitle}
                  </span>
                  {primaryTarget && (
                    <span className="text-[9px] bg-white/10 px-2 py-0.5 rounded text-white/70">
                      🎯 {getTargetLabel(primaryTarget)}
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm font-bold text-white leading-snug mt-0.5">
                  {dialogue}
                </p>
              </div>

              {isFirstOrientation && onNextStep ? (
                <button
                  type="button"
                  id="btn-yoyo-next-orientation"
                  onClick={onNextStep}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs shrink-0 flex items-center gap-1 transition cursor-pointer"
                >
                  <span>التالي</span>
                  <ChevronRight size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onDismiss}
                  className="p-1 rounded-lg text-white/50 hover:text-white transition cursor-pointer shrink-0"
                  aria-label="إغلاق"
                >
                  <X size={16} />
                </button>
              )}
            </motion.div>
          )}

          {/* LEVEL 2: Contextual Speech Bubble */}
          {presentationLevel === 'LEVEL_2_SPEECH_BUBBLE' && (
            <motion.div
              key={moment.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="mx-auto max-w-lg bg-[#0f2316]/95 border-2 border-[var(--gold)] rounded-3xl shadow-2xl p-4 sm:p-5 text-white backdrop-blur-md"
            >
              <div className="flex items-start gap-3.5 text-right">
                <motion.div {...getAvatarMotionProps()}>
                  <YoyoAvatar expression={expression} size="md" />
                </motion.div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5">
                      <Sparkles size={14} className="text-[var(--gold)]" />
                      <span className="text-xs font-black text-[var(--gold)]">
                        {conceptTitle}
                      </span>
                    </div>
                    {primaryTarget && (
                      <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full text-white/70 font-mono">
                        {getTargetLabel(primaryTarget)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-white/95 leading-relaxed">
                    {dialogue}
                  </p>

                  {/* Evidence trail if available */}
                  {evidence.length > 1 && (
                    <div className="mt-2.5 pt-2 border-t border-white/10 flex flex-wrap gap-1.5">
                      <span className="text-[10px] text-white/50 font-bold ml-1">الأدلة:</span>
                      {evidence.map((ev, i) => (
                        <span
                          key={i}
                          className="text-[9px] bg-black/40 border border-white/15 px-2 py-0.5 rounded text-amber-200"
                        >
                          دور #{ev.turnNumber}: {ev.actionSummary}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  id="btn-dismiss-coaching-bubble"
                  onClick={onDismiss}
                  className="px-4 py-1.5 rounded-xl bg-[var(--gold)]/20 hover:bg-[var(--gold)]/30 border border-[var(--gold)]/50 text-[var(--gold)] font-bold text-xs transition cursor-pointer"
                >
                  فهمت يا كوتش ✓
                </button>
              </div>
            </motion.div>
          )}

          {/* LEVEL 3: Teaching Card (High-Impact Strategic Moment) */}
          {presentationLevel === 'LEVEL_3_TEACHING_CARD' && (
            <motion.div
              key={moment.id}
              initial={{ opacity: 0, scale: 0.9, y: 25 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              className="mx-auto max-w-lg bg-[#142d1e]/98 border-3 border-[var(--gold)] rounded-3xl shadow-2xl p-5 sm:p-6 text-white backdrop-blur-xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/15 mb-4 text-right">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-[var(--gold)] flex items-center justify-center text-[var(--gold)]">
                    <Swords size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-[#ffeb3b]">
                      {conceptTitle}
                    </h3>
                    <span className="text-[10px] text-white/60">تحليل تكتيكي من يويو</span>
                  </div>
                </div>
                <motion.div {...getAvatarMotionProps()}>
                  <YoyoAvatar expression={expression} size="md" />
                </motion.div>
              </div>

              {/* Dialogue Body */}
              <div className="bg-black/30 rounded-2xl p-3.5 sm:p-4 border border-white/10 mb-4 text-right">
                <p className="text-xs sm:text-sm font-bold text-white leading-relaxed whitespace-pre-line">
                  {dialogue}
                </p>
              </div>

              {/* Sequential Evidence Line */}
              {evidence.length > 0 && (
                <div className="mb-4 text-right">
                  <span className="text-[11px] font-black text-[var(--gold)] block mb-1.5">
                    تسلسل النقلات المرتبطة:
                  </span>
                  <div className="space-y-1.5">
                    {evidence.map((ev, i) => (
                      <div
                        key={i}
                        className="text-[11px] bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 flex items-center justify-between text-white/80"
                      >
                        <span className="font-mono text-amber-300 font-bold">
                          دور #{ev.turnNumber}
                        </span>
                        <span>{ev.actionSummary}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Button */}
              <div className="flex items-center justify-between pt-2">
                <span className="text-[10px] text-white/40">
                  لوحة اللعب تظل مرئية خلف الكرت
                </span>
                <button
                  type="button"
                  id="btn-confirm-teaching-card"
                  onClick={onDismiss}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black font-black text-xs sm:text-sm shadow-lg transition cursor-pointer"
                >
                  استمر في اللعب
                </button>
              </div>
            </motion.div>
          )}

          {/* LEVEL 4: Interactive Tactical Moment */}
          {presentationLevel === 'LEVEL_4_INTERACTIVE_MOMENT' && (
            <motion.div
              key={moment.id}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              className="mx-auto max-w-lg bg-[#0d2114]/98 border-3 border-amber-400 rounded-3xl shadow-2xl p-5 text-white backdrop-blur-xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-amber-400/20 mb-3 text-right">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-amber-400/20 border border-amber-400 flex items-center justify-center text-amber-400">
                    <Eye size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-amber-300">
                      {conceptTitle}
                    </h3>
                    <span className="text-[10px] text-white/60">لحظة تفاعلية</span>
                  </div>
                </div>
                <motion.div {...getAvatarMotionProps()}>
                  <YoyoAvatar expression={expression} size="md" />
                </motion.div>
              </div>

              <p className="text-xs sm:text-sm font-bold text-white/95 leading-relaxed text-right mb-4">
                {dialogue}
              </p>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  id="btn-interactive-confirm"
                  onClick={onDismiss}
                  className="px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black text-xs sm:text-sm shadow-lg transition cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 size={16} />
                  <span>تمام يا كوتش</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

