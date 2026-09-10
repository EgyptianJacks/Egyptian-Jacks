import React, { useState, useEffect, useRef } from 'react';
import { Home, Minimize2, Maximize2, Swords, Sparkles, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FirstMatchState } from '../firstMatch';
import { YoyoAvatar } from '../character/yoyo';
import { soundEngine } from '../engine/soundEngine';

interface FirstMatchCoachProps {
  state: FirstMatchState;
  placement?: 'coach' | 'rival';
  onRequestHint?: () => void;
  onExit: () => void;
}

export const FirstMatchCoach: React.FC<FirstMatchCoachProps> = ({
  state,
  placement = 'coach',
  onExit,
}) => {
  const [isMinimized, setIsMinimized] = useState<boolean>(false);

  const {
    coachMessage,
    feedbackTitle,
    feedbackMessage,
    goldenAchieved,
    stealAchieved,
    regularSetAchieved,
    jackSetAchieved,
    silverAchieved,
    yoyoExpression = 'idle',
    yoyoStage = 'STAGE_1_STRANGER',
    isFreePlayActive,
  } = state;

  const isRivalStage =
    placement === 'rival' ||
    yoyoStage === 'STAGE_6_RIVAL' ||
    yoyoStage === 'STAGE_5_CHALLENGE' ||
    yoyoStage === 'STAGE_7_RIVALRY' ||
    isFreePlayActive ||
    goldenAchieved;

  // Stinger trigger on milestone transitions
  const prevMilestonesRef = useRef<{
    steal: boolean;
    regularSet: boolean;
    jackSet: boolean;
    silver: boolean;
    golden: boolean;
    rival: boolean;
  }>({
    steal: stealAchieved,
    regularSet: regularSetAchieved,
    jackSet: jackSetAchieved,
    silver: silverAchieved,
    golden: goldenAchieved,
    rival: isFreePlayActive || isRivalStage,
  });

  useEffect(() => {
    const prev = prevMilestonesRef.current;
    if (!prev.golden && goldenAchieved) {
      soundEngine.playStinger('golden_combo');
    } else if (!prev.rival && (isFreePlayActive || isRivalStage)) {
      soundEngine.playStinger('rival_transition');
    } else if (!prev.silver && silverAchieved) {
      soundEngine.playStinger('silver_combo');
    } else if (!prev.jackSet && jackSetAchieved) {
      soundEngine.playStinger('jack_set');
    } else if (!prev.regularSet && regularSetAchieved) {
      soundEngine.playStinger('regular_set');
    } else if (!prev.steal && stealAchieved) {
      soundEngine.playStinger('steal');
    }

    prevMilestonesRef.current = {
      steal: stealAchieved,
      regularSet: regularSetAchieved,
      jackSet: jackSetAchieved,
      silver: silverAchieved,
      golden: goldenAchieved,
      rival: isFreePlayActive || isRivalStage,
    };
  }, [
    stealAchieved,
    regularSetAchieved,
    jackSetAchieved,
    silverAchieved,
    goldenAchieved,
    isFreePlayActive,
    isRivalStage,
  ]);

  // Check if dialogue is currently silent (no explicit message)
  const isSilentReaction = !coachMessage && !feedbackMessage;

  // Minimized compact pill view
  if (isMinimized) {
    return (
      <div
        id="first-match-coach-minimized"
        className={`w-full max-w-lg mx-auto flex items-center justify-between px-3 py-1.5 rounded-full border shadow-lg backdrop-blur-md z-20 mb-1 animate-fade-in select-none text-xs ${
          isRivalStage
            ? 'bg-[#1a0808]/90 border-red-500/50 text-red-200'
            : 'bg-[#0a1e12]/90 border-amber-400/40 text-amber-200'
        }`}
      >
        <div className="flex items-center gap-2">
          <YoyoAvatar expression={yoyoExpression} stage={yoyoStage} size="sm" />
          <span className={`font-bold ${isRivalStage ? 'text-red-400' : 'text-amber-300'}`}>
            {isRivalStage ? 'يويو — منافسك' : 'الكوتش يويو'}
          </span>
          <span className="text-white/70 truncate max-w-[200px]">
            {feedbackMessage || coachMessage || 'مباراة نشطة...'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            aria-label="توسيع حوار يويو"
            className="p-1 rounded text-white/70 hover:text-white cursor-pointer"
          >
            <Maximize2 size={13} />
          </button>
          <button
            type="button"
            onClick={onExit}
            aria-label="الخروج إلى الصالة"
            className="p-1 rounded text-white/70 hover:text-red-300 cursor-pointer"
          >
            <Home size={13} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      layout
      layoutId="first-match-coach-container"
      id="first-match-coach-container"
      className={`w-full mx-auto z-20 font-sans select-none text-right transition-all duration-300 ${
        isRivalStage
          ? 'max-w-xl px-1 sm:px-2 my-0.5'
          : 'max-w-2xl px-2 mb-1'
      }`}
      initial={{ opacity: 0, y: isRivalStage ? 8 : -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <div className="flex items-start gap-2 sm:gap-3">
        {/* Yoyo Character Presence (Right side in RTL) */}
        <motion.div
          layout
          layoutId="first-match-yoyo-avatar-presence"
          className="flex flex-col items-center gap-1 shrink-0 pt-0.5"
        >
          <div className="relative">
            <YoyoAvatar
              expression={yoyoExpression}
              stage={yoyoStage}
              placement={isRivalStage ? 'rival' : 'coach'}
              size={isRivalStage ? 'lg' : 'md'}
            />
            {isRivalStage && (
              <div
                className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-tr from-red-600 to-amber-500 text-white flex items-center justify-center shadow-lg border border-white/60 animate-pulse"
                title="وضع المنافسة المباشرة"
              >
                <Swords size={10} className="fill-white" />
              </div>
            )}
          </div>
          <span
            className={`text-[10px] sm:text-[11px] font-black px-2.5 py-0.5 rounded-full border shadow-sm tracking-wide ${
              isRivalStage
                ? 'bg-gradient-to-r from-red-950 via-[#260a0a] to-red-950 border-red-500/70 text-red-200 shadow-red-950/50'
                : 'bg-amber-500/15 border-amber-400/40 text-amber-300'
            }`}
          >
            {isRivalStage ? 'يويو — منافسك' : 'الكوتش يويو'}
          </span>
        </motion.div>

        {/* Dynamic Speech Bubble (Points cleanly directly to Yoyo) */}
        <div className="flex-1 min-w-0 relative">
          {/* Speech Bubble Arrow Tail (Pointing towards Yoyo on the right in RTL) */}
          <div
            className={`absolute top-5 -right-1.5 w-3.5 h-3.5 rotate-45 z-10 ${
              isRivalStage
                ? 'bg-[#220707] border-t border-r border-red-500/70'
                : 'bg-[#0d2315] border-t border-r border-amber-400/40'
            }`}
          />

          <div
            className={`relative rounded-2xl shadow-xl px-3.5 py-2.5 sm:px-4 sm:py-3 backdrop-blur-md border transition-colors duration-300 ${
              isRivalStage
                ? 'bg-gradient-to-b from-[#220707]/95 via-[#160505]/95 to-[#0c0202]/98 border-red-500/70 shadow-[0_0_24px_rgba(239,68,68,0.3)] ring-1 ring-red-500/30'
                : 'bg-gradient-to-b from-[#0d2315]/95 via-[#091b10]/95 to-[#06140c]/95 border-amber-400/40'
            }`}
          >
            {/* Bubble Header */}
            <div className="flex items-center justify-between gap-1 pb-1 mb-1.5 border-b border-white/10">
              <span className="text-[10px] sm:text-[11px] font-medium flex items-center gap-1.5">
                {isRivalStage ? (
                  <>
                    <Swords size={12} className="text-red-400" />
                    <span className="text-red-300 font-bold">منافسة حرة على طاولة اللعب</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={11} className="text-amber-400" />
                    <span className="text-amber-200">ماتشك الأول مع يويو</span>
                  </>
                )}
              </span>

              <div className="flex items-center gap-1">
                {isFreePlayActive && (
                  <button
                    type="button"
                    onClick={() => setIsMinimized(true)}
                    aria-label="تصغير شريط يويو"
                    className="p-1 rounded text-white/50 hover:text-white transition cursor-pointer"
                    title="تصغير"
                  >
                    <Minimize2 size={12} />
                  </button>
                )}
                <button
                  type="button"
                  id="btn-coach-exit-lobby"
                  onClick={onExit}
                  aria-label="الخروج إلى الصالة الرئيسية"
                  className="p-1 rounded text-white/50 hover:text-red-300 transition cursor-pointer"
                  title="الخروج إلى الصالة"
                >
                  <Home size={12} />
                </button>
              </div>
            </div>

            {/* Silent Mode vs Spoken Dialogue */}
            {isSilentReaction ? (
              <div className="flex items-center gap-2 py-0.5 text-xs">
                {isRivalStage ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                    <span className="text-[11px] sm:text-xs text-red-200/90 font-medium">
                      يويو يترقب دورك القادم على الطاولة...
                    </span>
                    <Swords size={12} className="text-red-400/80 mr-auto shrink-0" />
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    <span className="text-xs text-white/60 font-mono">
                      يويو يتابع اللعب بتركيز...
                    </span>
                  </>
                )}
              </div>
            ) : (
              <p className="text-xs sm:text-sm text-white/95 leading-relaxed font-medium">
                {coachMessage}
              </p>
            )}

            {/* Dynamic Event Feedback if a move was just played */}
            {feedbackMessage && feedbackMessage !== coachMessage && (
              <div
                id="coach-feedback-card"
                className={`mt-2 p-1.5 sm:p-2 rounded-xl border text-[11px] sm:text-xs flex items-center gap-1.5 animate-in fade-in ${
                  isRivalStage
                    ? 'bg-red-950/60 border-red-500/50 text-red-100 shadow-sm'
                    : 'bg-black/40 border-emerald-400/35 text-emerald-200'
                }`}
              >
                <Sparkles
                  size={12}
                  className={isRivalStage ? 'text-amber-400 shrink-0' : 'text-emerald-400 shrink-0'}
                />
                <span className="leading-snug">
                  {feedbackTitle ? `${feedbackTitle}: ` : ''}
                  {feedbackMessage}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
