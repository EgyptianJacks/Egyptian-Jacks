import React from 'react';
import { Card, TableViewMode } from '../types/game';
import { CardView } from './CardView';

interface TableStackViewProps {
  title: string;
  cards: Card[];
  viewMode: TableViewMode;
  isOpponent?: boolean;
  highlightRank?: string | null;
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

export const TableStackView: React.FC<TableStackViewProps> = ({
  title,
  cards,
  viewMode,
  isOpponent = false,
  highlightRank = null,
}) => {
  const topCard = cards.length > 0 ? cards[cards.length - 1] : null;

  return (
    <div className="flex flex-col items-center gap-1 w-full">
      {/* Title Header */}
      <span className="text-[11px] sm:text-xs font-bold text-[#ffeb3b] tracking-wide text-center drop-shadow-xs">
        {title}
      </span>

      {/* Cards Area with Dashed Felt Border */}
      <div
        data-zone-anchor={isOpponent ? 'CPU_TABLE' : 'PLAYER_TABLE'}
        className="relative w-full min-h-[95px] xs:min-h-[105px] sm:min-h-[125px] flex items-center justify-center p-1.5 rounded-xl border border-dashed border-white/30 bg-black/10 backdrop-blur-xs transition-colors shadow-inner"
      >
        {cards.length === 0 ? (
          <div className="w-14 h-21 xs:w-16 xs:h-24 sm:w-20 sm:h-28 rounded-lg border border-dashed border-white/20 flex items-center justify-center text-white/40 text-[10px] font-mono">
            خالي
          </div>
        ) : viewMode === 'INITIAL_VIEW' ? (
          /* Initial View: All cards visible side-by-side with full standard size (same as Hand) */
          <div className="flex items-center justify-center -space-x-2 sm:space-x-1.5 overflow-visible">
            {cards.map((card, idx) => {
              const isTop = idx === 0;
              return (
                <div key={`${card.id}-${idx}`} className="flex flex-col items-center gap-0.5 z-10 hover:z-20 transition-all">
                  <div
                    className={`rounded-xl transition-all ${
                      isTop
                        ? 'ring-2 ring-[#ffeb3b] shadow-[0_0_12px_rgba(255,235,59,0.6)]'
                        : 'ring-2 ring-[#4caf50] shadow-[0_0_12px_rgba(76,175,80,0.6)]'
                    }`}
                  >
                    <CardView
                      card={card}
                      disabled
                      isMatchTarget={highlightRank === card.rank}
                      size="md"
                    />
                  </div>
                  <span
                    className={`text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none mt-0.5 ${
                      isTop ? 'bg-black/80 text-[#ffeb3b] border border-[#ffeb3b]/40' : 'bg-black/80 text-[#4caf50] border border-[#4caf50]/40'
                    }`}
                  >
                    {isTop ? 'العلوي' : 'السفلي'}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          /* Normal View: Stacked layout with top card active */
          <div className="flex flex-col items-center gap-0.5">
            <div className="relative flex items-center justify-center">
              {cards.length > 2 && (
                <div className="absolute -bottom-1 -right-1 w-14 h-21 xs:w-16 xs:h-24 sm:w-20 sm:h-28 rounded-lg bg-[#c62828] border-2 border-white opacity-40 transform rotate-4 pointer-events-none" />
              )}
              {cards.length > 1 && (
                <div className="absolute -bottom-0.5 -left-1 w-14 h-21 xs:w-16 xs:h-24 sm:w-20 sm:h-28 rounded-lg bg-[#c62828] border-2 border-white opacity-60 transform -rotate-3 pointer-events-none" />
              )}
              {topCard && (
                <div className="relative z-10">
                  <CardView
                    card={topCard}
                    disabled
                    isMatchTarget={highlightRank === topCard.rank}
                    size="md"
                  />
                </div>
              )}
            </div>

            {cards.length > 1 && (
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-black/70 text-[#ffeb3b] leading-none mt-0.5">
                {cards.length} كروت
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};


