import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Swords, Eye } from 'lucide-react';
import { YoyoAvatar, YoyoExpression } from '../character/yoyo';

interface YoyoRivalPresenceProps {
  expression?: YoyoExpression;
  isCpuThinking?: boolean;
  dialogue?: string | null;
  difficultyLabel?: string;
  archetype?: string;
}

export const YoyoRivalPresence: React.FC<YoyoRivalPresenceProps> = ({
  expression = 'watching',
  isCpuThinking = false,
  dialogue,
  difficultyLabel = 'منافس ذكي',
  archetype,
}) => {
  const effectiveExpression: YoyoExpression = (isCpuThinking ? 'thinking' : expression) as YoyoExpression;

  return (
    <div className="w-full flex items-center justify-between px-3 py-1.5 rounded-2xl bg-black/45 border border-red-500/25 backdrop-blur-sm shadow-md mb-1.5 transition-all">
      {/* Right side (RTL): Yoyo Avatar & Identity */}
      <div className="flex items-center gap-2.5">
        <div className="relative">
          <YoyoAvatar
            expression={effectiveExpression}
            size="sm"
            intensity={effectiveExpression === 'surprise_steal' || effectiveExpression === 'surprise_golden' ? 'HIGH' : 'LOW'}
            stage="STAGE_6_RIVAL"
          />
          {isCpuThinking && (
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
            </span>
          )}
        </div>

        <div className="text-right">
          <div className="flex items-center gap-1.5">
            <span className="text-xs sm:text-sm font-black text-amber-300">يويو</span>
            <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-red-950/70 border border-red-500/30 text-red-300">
              <Swords size={10} />
              <span>منافسك المباشر</span>
            </span>
          </div>
          <span className="text-[10px] text-white/60 block">
            {difficultyLabel} {archetype ? `• يقرأ أسلوبك (${archetype})` : ''}
          </span>
        </div>
      </div>

      {/* Left side (RTL): Dynamic Dialogue / Live Reaction */}
      <div className="flex-1 max-w-[260px] sm:max-w-xs text-left mr-2">
        <AnimatePresence mode="wait">
          {dialogue ? (
            <motion.div
              key={dialogue}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 6 }}
              className="px-2.5 py-1 rounded-xl bg-amber-950/50 border border-amber-400/30 text-amber-200 text-[11px] sm:text-xs font-medium shadow-sm leading-tight line-clamp-2"
            >
              "{dialogue}"
            </motion.div>
          ) : isCpuThinking ? (
            <motion.div
              key="thinking"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[10px] sm:text-[11px] text-white/50 italic flex items-center justify-end gap-1"
            >
              <Eye size={11} className="text-amber-400 animate-pulse" />
              <span>يويو يفكر في نقلته...</span>
            </motion.div>
          ) : (
            <div className="text-[10px] text-white/40 text-left">
              <span>يترقب حركتك القادمة</span>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
