import React from 'react';
import { GamePhase, PlayerId } from '../types/game';
import { Crown, HelpCircle, History, RotateCcw, Sparkles } from 'lucide-react';

interface HUDProps {
  deckCount: number;
  dealNumber: number;
  activeTurn: PlayerId;
  phase: GamePhase;
  onNewMatch: () => void;
  onToggleRules: () => void;
  onToggleLog: () => void;
  showLog: boolean;
  playerScoreEstimate?: number;
  cpuScoreEstimate?: number;
}

export const HUD: React.FC<HUDProps> = ({
  deckCount,
  dealNumber,
  activeTurn,
  phase,
  onNewMatch,
  onToggleRules,
  onToggleLog,
  showLog,
  playerScoreEstimate,
  cpuScoreEstimate,
}) => {
  const isPlayerTurn = phase === 'PLAYER_TURN' && activeTurn === 'player';

  return (
    <header className="w-full max-w-5xl mx-auto px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between gap-2 border-b border-[var(--gold)]/20 bg-[var(--green-deep)]/90 backdrop-blur-md rounded-b-2xl shadow-lg z-30 select-none">
      {/* Title & Brand */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-[var(--gold)] to-[var(--gold-dark)] p-0.5 shadow-md flex items-center justify-center text-[#1f2e1c] font-black">
          <Crown size={18} />
        </div>
        <div>
          <h1 className="text-sm sm:text-base font-black tracking-tight text-[var(--gold)] flex items-center gap-1.5 leading-tight">
            Egyptian Jacks
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[var(--gold)]/15 text-[var(--gold-light)] border border-[var(--gold)]/30 font-semibold">
              2026
            </span>
          </h1>
          <p className="text-[10px] sm:text-xs text-[var(--text-muted)] font-medium">
            التوزيع #{dealNumber}/5 • الرزمة: {deckCount} ورقة
          </p>
        </div>
      </div>

      {/* Center Turn / Phase Status & Score Badges */}
      <div className="flex items-center gap-1.5 sm:gap-3">
        {playerScoreEstimate !== undefined && (
          <div className="px-2.5 py-0.5 rounded-full bg-black/40 border border-[#ffeb3b]/40 text-[#ffeb3b] text-xs font-black">
            أنت: {playerScoreEstimate}
          </div>
        )}

        {phase === 'MATCH_END' ? (
          <div className="px-3.5 py-1 rounded-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-dark)] text-[#1f2e1c] text-xs font-black tracking-wide shadow-md animate-pulse flex items-center gap-1.5">
            <Sparkles size={13} />
            انتهت المباراة
          </div>
        ) : isPlayerTurn ? (
          <div className="px-3.5 py-1 rounded-full bg-[var(--green-card)] border border-[var(--gold)]/50 text-[var(--gold)] text-xs font-bold tracking-wide shadow-md flex items-center gap-1.5 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-[var(--gold)] shadow-[0_0_8px_var(--gold)]" />
            دورك
          </div>
        ) : (
          <div className="px-3.5 py-1 rounded-full bg-[var(--green-surface)] border border-[var(--green-border)] text-[var(--text-muted)] text-xs font-semibold tracking-wide flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--gold-light)] animate-ping" />
            تفكير الخصم...
          </div>
        )}

        {cpuScoreEstimate !== undefined && (
          <div className="px-2.5 py-0.5 rounded-full bg-black/40 border border-white/30 text-white text-xs font-bold">
            الخصم: {cpuScoreEstimate}
          </div>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onToggleRules}
          title="قواعد اللعبة"
          className="p-1.5 sm:px-3 sm:py-1.5 rounded-full bg-[var(--green-surface)] border border-[var(--gold)]/30 text-[var(--gold)] hover:bg-[var(--gold)]/10 text-xs font-bold flex items-center gap-1 transition active:scale-95 cursor-pointer"
        >
          <HelpCircle size={14} />
          <span className="hidden sm:inline">القواعد</span>
        </button>

        <button
          type="button"
          onClick={onToggleLog}
          title="سجل المباراة"
          className={`p-1.5 sm:px-3 sm:py-1.5 rounded-full border text-xs font-bold flex items-center gap-1 transition active:scale-95 cursor-pointer ${
            showLog
              ? 'bg-[var(--gold)] text-[#1f2e1c] border-[var(--gold)] shadow-md'
              : 'bg-[var(--green-surface)] border-[var(--gold)]/30 text-[var(--gold)] hover:bg-[var(--gold)]/10'
          }`}
        >
          <History size={14} />
          <span className="hidden sm:inline">السجل</span>
        </button>

        <button
          type="button"
          onClick={onNewMatch}
          title="مباراة جديدة"
          className="p-1.5 sm:px-3.5 sm:py-1.5 rounded-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-dark)] text-[#1f2e1c] font-bold text-xs flex items-center gap-1 shadow-md hover:shadow-lg transition active:scale-95 cursor-pointer"
        >
          <RotateCcw size={14} />
          <span className="hidden sm:inline">مباراة جديدة</span>
        </button>
      </div>
    </header>
  );
};
