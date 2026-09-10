import React from 'react';
import { Card } from '../types/game';
import { Anchor } from 'lucide-react';

interface MemoryAnchorBadgeProps {
  card: Card;
  isDealt?: boolean;
}

export const MemoryAnchorBadge: React.FC<MemoryAnchorBadgeProps> = ({ card, isDealt = false }) => {
  const isRed = card.suit === '♥' || card.suit === '♦';

  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border transition-all shadow-md select-none ${
        isDealt
          ? 'bg-black/60 border-[var(--gold)]/60 shadow-[var(--gold)]/20 text-white'
          : 'bg-black/50 border-white/20 text-white/90'
      }`}
      title={`البطاقة الأخيرة في الرزمة: ${card.rank}${card.suit} (${isDealt ? 'تم توزيعها في اليد' : 'في قاع الرزمة'})`}
    >
      <Anchor size={12} className="text-[#ffeb3b] shrink-0" />
      <span className="text-[10px] sm:text-xs text-[#c8e6c9] font-medium hidden xs:inline">
        آخر ورقة:
      </span>
      <div className="flex items-center gap-0.5 font-bold font-mono text-xs bg-black/70 px-1.5 py-0.5 rounded border border-white/10">
        <span className={isRed ? 'text-red-400' : 'text-white'}>
          {card.rank}
        </span>
        <span className={isRed ? 'text-red-400' : 'text-slate-300'}>
          {card.suit}
        </span>
      </div>
      {isDealt && (
        <span className="text-[9px] text-[#ffeb3b] font-bold px-1 py-0.2 rounded bg-[var(--gold)]/20 border border-[var(--gold)]/40 hidden sm:inline">
          وُزعت
        </span>
      )}
    </div>
  );
};
