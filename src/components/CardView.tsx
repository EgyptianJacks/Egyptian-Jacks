import React from 'react';
import { Card } from '../types/game';
import { Crown, Sparkles } from 'lucide-react';

interface CardViewProps {
  card?: Card;
  faceDown?: boolean;
  selected?: boolean;
  isMatchTarget?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const CardView: React.FC<CardViewProps> = ({
  card,
  faceDown = false,
  selected = false,
  isMatchTarget = false,
  onClick,
  disabled = false,
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'w-11 h-16 sm:w-13 sm:h-19 text-xs',
    md: 'w-14 h-21 xs:w-16 xs:h-24 sm:w-20 sm:h-28 text-xs xs:text-sm sm:text-base',
    lg: 'w-20 h-30 sm:w-24 sm:h-36 text-base sm:text-lg',
  };

  if (faceDown || !card) {
    return (
      <div
        role="img"
        aria-label="ورقة مقلوبة"
        className={`relative ${sizeClasses[size]} rounded-lg bg-[#c62828] border-2 sm:border-3 border-white shadow-md flex items-center justify-center select-none overflow-hidden transition-all ${className}`}
      >
        {/* Central White Diamond Pip */}
        <span className="text-white text-2xl xs:text-3xl sm:text-4xl select-none leading-none drop-shadow-xs font-black">
          ♦
        </span>
      </div>
    );
  }

  const isRed = card.suit === '♥' || card.suit === '♦';
  const isSpecial = card.isJack;
  const cardLabel = card.isJack
    ? `ولد ${card.suit}`
    : `ورقة ${card.rank} ${card.suit}`;

  return (
    <button
      type="button"
      data-card-anchor={card.id}
      data-card-rank={card.rank}
      onClick={onClick}
      disabled={disabled}
      aria-label={cardLabel}
      aria-pressed={selected}
      className={`relative ${sizeClasses[size]} rounded-lg card-face-ref transition-all duration-200 select-none flex flex-col justify-between p-1 sm:p-1.5 text-left cursor-pointer ${
        selected
          ? 'card-selected-glow z-20'
          : isMatchTarget
          ? 'card-target-glow z-10'
          : 'hover:-translate-y-1 hover:shadow-lg'
      } ${
        disabled
          ? 'cursor-not-allowed opacity-95 hover:translate-y-0'
          : 'active:scale-95'
      } ${
        isSpecial
          ? 'ring-1 ring-[var(--gold)]/60'
          : ''
      } ${className}`}
    >
      {/* Top Left Rank & Suit */}
      <div className="flex flex-col items-start leading-tight font-black tracking-tighter">
        <span className={`text-[13px] xs:text-[14px] sm:text-base font-black ${isRed ? 'text-[#d32f2f]' : 'text-[#1a1a1a]'}`}>
          {card.rank}
        </span>
        <span className={`text-[12px] xs:text-xs sm:text-sm -mt-0.5 ${isRed ? 'text-[#d32f2f]' : 'text-[#1a1a1a]'}`}>
          {card.suit}
        </span>
      </div>

      {/* Center Graphic */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {card.isJack ? (
          <div className="flex flex-col items-center">
            <span className="text-lg xs:text-xl sm:text-2xl font-black text-[#c8860a] drop-shadow-xs">J</span>
            <Crown size={12} className="text-[#c8860a] -mt-1" />
          </div>
        ) : (
          <span
            className={`text-2xl xs:text-3xl sm:text-4xl opacity-20 font-black ${
              isRed ? 'text-[#d32f2f]' : 'text-[#1a1a1a]'
            }`}
          >
            {card.suit}
          </span>
        )}
      </div>

      {/* Bottom Right Inverted Rank & Suit */}
      <div className="flex flex-col items-end leading-tight font-black tracking-tighter rotate-180">
        <span className={`text-[13px] xs:text-[14px] sm:text-base font-black ${isRed ? 'text-[#d32f2f]' : 'text-[#1a1a1a]'}`}>
          {card.rank}
        </span>
        <span className={`text-[12px] xs:text-xs sm:text-sm -mt-0.5 ${isRed ? 'text-[#d32f2f]' : 'text-[#1a1a1a]'}`}>
          {card.suit}
        </span>
      </div>

      {/* Special Foil Badge */}
      {card.isJack && (
        <span className="absolute -top-1.5 -right-1.5 px-1 py-0.2 text-[8px] font-black bg-[#ffeb3b] text-[#1f2e1c] rounded-full shadow-sm border border-black/20">
          JACK
        </span>
      )}
    </button>
  );
};

