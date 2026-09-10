import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PlayerId } from '../types/game';
import { resolveAnchorRect } from '../engine/anchorResolver';
import { Crown, Sparkles, Layers } from 'lucide-react';

export interface CollectionEvent {
  id: string;
  actor: PlayerId;
  type: 'REGULAR_SET' | 'JACK_SET' | 'DOUBLE_COMBO' | 'BALANCED_COMBO' | 'SILVER_COMBO' | 'GOLDEN_COMBO';
  title: string;
  scoreBonus: number;
  rank?: string;
}

interface CollectionAnimationProps {
  event: CollectionEvent | null;
  onComplete: () => void;
}

export const CollectionFeedbackLayer: React.FC<CollectionAnimationProps> = ({
  event,
  onComplete,
}) => {
  const [anchorPos, setAnchorPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    if (!event) return;

    const targetZone = event.actor === 'player' ? 'PLAYER_WINNING_PILE' : 'CPU_WINNING_PILE';
    const rect = resolveAnchorRect(targetZone);
    setAnchorPos({
      x: rect.x + (rect.width || 80) / 2,
      y: rect.y + (rect.height || 100) / 2,
    });

    const duration = event.type === 'GOLDEN_COMBO' || event.type === 'BALANCED_COMBO' ? 2200 : 1600;
    const timer = setTimeout(() => {
      onComplete();
    }, duration);

    return () => clearTimeout(timer);
  }, [event, onComplete]);

  if (!event) return null;

  const isPlayer = event.actor === 'player';
  const isGolden = event.type === 'GOLDEN_COMBO';
  const isJack = event.type === 'JACK_SET';
  const isBalanced = event.type === 'BALANCED_COMBO';

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden select-none">
      <AnimatePresence>
        <motion.div
          key={event.id}
          initial={{ opacity: 0, scale: 0.6, y: isPlayer ? 30 : -30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: isPlayer ? -20 : 20 }}
          transition={{ type: 'spring', damping: 15, stiffness: 300 }}
          className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
          style={{
            left: anchorPos.x || '50%',
            top: anchorPos.y || (isPlayer ? '70%' : '30%'),
          }}
        >
          {/* Glowing Aura Ring */}
          <div
            className={`w-28 h-28 sm:w-36 sm:h-36 rounded-full absolute -inset-3 sm:-inset-4 animate-ping opacity-25 pointer-events-none ${
              isGolden
                ? 'bg-[#ffd700]'
                : isBalanced
                ? 'bg-[#00e5ff]'
                : isJack
                ? 'bg-[#ff9100]'
                : 'bg-[#76ff03]'
            }`}
          />

          {/* Banner Container */}
          <div
            className={`relative px-4 py-2 sm:px-5 sm:py-2.5 rounded-2xl border-2 shadow-2xl flex flex-col items-center gap-1 backdrop-blur-md ${
              isGolden
                ? 'bg-black/90 border-[#ffd700] text-[#ffd700] shadow-[0_0_30px_#ffd700]'
                : isBalanced
                ? 'bg-black/90 border-[#00e5ff] text-[#00e5ff] shadow-[0_0_25px_#00e5ff]'
                : isJack
                ? 'bg-black/85 border-[#ff9100] text-[#ff9100] shadow-[0_0_20px_#ff9100]'
                : 'bg-black/85 border-[#76ff03] text-[#76ff03] shadow-[0_0_15px_#76ff03]'
            }`}
          >
            {/* Header: WHO */}
            <div className="flex items-center gap-1 text-[11px] sm:text-xs font-black uppercase tracking-wider text-white/90">
              {isGolden ? (
                <Crown size={14} className="text-[#ffd700]" />
              ) : isJack ? (
                <Sparkles size={14} className="text-[#ff9100]" />
              ) : (
                <Layers size={14} />
              )}
              <span>{isPlayer ? 'أنت أكملت' : 'الخصم أكمل'}</span>
            </div>

            {/* Set Name */}
            <div className="text-sm sm:text-base font-black tracking-tight uppercase flex items-center gap-1.5">
              <span>{event.title}</span>
            </div>

            {/* Score Points Pill */}
            <div className="px-2.5 py-0.5 rounded-full bg-white/20 text-white font-black text-xs sm:text-sm font-mono tracking-wider shadow-inner">
              +{event.scoreBonus} نقطة
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
