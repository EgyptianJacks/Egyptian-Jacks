import React from 'react';
import { Card } from '../types/game';
import { CardView } from './CardView';
import { ShieldAlert } from 'lucide-react';

interface WinningPileViewProps {
  title: string;
  pile: Card[];
  isOpponent?: boolean;
  highlightMatchRank?: string | null;
}

const RANK_ARABIC: Record<string, string> = {
  A: 'آس',
  '2': 'اثنين',
  '3': 'ثلاثة',
  '4': 'أربعة',
  '5': 'خمسة',
  '6': 'ستة',
  '7': 'سبعة',
  '8': 'ثمانية',
  '9': 'تسعة',
  '10': 'عشرة',
  J: 'ولد',
  Q: 'بنت',
  K: 'شايب',
};

export const WinningPileView: React.FC<WinningPileViewProps> = ({
  title,
  pile,
  isOpponent = false,
  highlightMatchRank = null,
}) => {
  const topCard = pile.length > 0 ? pile[pile.length - 1] : null;

  // Calculate contiguous top uniform rank count
  let uniformTopCount = 0;
  if (topCard) {
    for (let i = pile.length - 1; i >= 0; i--) {
      if (pile[i].rank === topCard.rank) {
        uniformTopCount++;
      } else {
        break;
      }
    }
  }

  const isStealTarget = isOpponent && topCard && highlightMatchRank === topCard.rank;

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Title in Bright Gold/Yellow */}
      <span className="text-[11px] sm:text-xs font-bold text-[#ffeb3b] tracking-wide text-center drop-shadow-xs">
        {title}
      </span>

      {/* Pile Stack Container with authentic tilt */}
      <div
        data-zone-anchor={isOpponent ? 'CPU_WINNING_PILE' : 'PLAYER_WINNING_PILE'}
        className={`relative w-16 h-23 xs:w-18 xs:h-26 sm:w-22 sm:h-30 rounded-xl flex items-center justify-center p-1 transition-all ${
          isStealTarget
            ? 'border-2 border-[#ffeb3b] ring-3 ring-[#ffeb3b] shadow-xl shadow-[#ffeb3b]/40 bg-black/30 animate-pulse'
            : 'border border-dashed border-white/30 bg-black/15 shadow-inner'
        }`}
      >
        {pile.length === 0 ? (
          <div className="text-[10px] text-white/40 font-mono text-center px-1">
            0 كروت
          </div>
        ) : (
          <div className="relative transform rotate-2 sm:rotate-3 transition-transform">
            {/* Visual stack depth */}
            {pile.length > 3 && (
              <div className="absolute -top-1 -left-1 w-14 h-21 xs:w-16 xs:h-24 sm:w-20 sm:h-28 rounded-lg bg-[#c62828] border-2 border-white opacity-40 pointer-events-none" />
            )}
            {pile.length > 1 && (
              <div className="absolute -top-0.5 -right-0.5 w-14 h-21 xs:w-16 xs:h-24 sm:w-20 sm:h-28 rounded-lg bg-[#c62828] border-2 border-white opacity-60 pointer-events-none" />
            )}
            {topCard && (
              <div className="relative z-10">
                <CardView
                  card={topCard}
                  disabled
                  isMatchTarget={isStealTarget}
                  size="md"
                />
              </div>
            )}
          </div>
        )}

        {/* Steal Alert Pill */}
        {isStealTarget && (
          <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap bg-[#ffeb3b] text-[#1f2e1c] text-[8px] xs:text-[9px] font-black px-2 py-0.5 rounded-full shadow-lg flex items-center gap-1 z-20 border border-black/30 animate-bounce">
            <ShieldAlert size={10} />
            سرقة متاحة ({uniformTopCount})
          </div>
        )}
      </div>

      {/* Pile Count Badge */}
      {topCard && (
        <span className="text-[9px] font-mono font-bold text-[#ffeb3b] text-center leading-tight drop-shadow-xs px-1.5 py-0.2 rounded-full bg-black/60">
          {uniformTopCount > 1
            ? `${uniformTopCount} متشابهة`
            : `${pile.length} كروت`}
        </span>
      )}
    </div>
  );
};


