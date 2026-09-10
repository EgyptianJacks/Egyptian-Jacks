import React from 'react';
import { GameEvent } from '../types/game';
import { X, History } from 'lucide-react';

interface HistoryLogDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  events: GameEvent[];
}

export const HistoryLogDrawer: React.FC<HistoryLogDrawerProps> = ({
  isOpen,
  onClose,
  events,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-sm bg-[var(--green-surface-elevated)]/95 border-l border-[var(--gold)]/30 shadow-2xl backdrop-blur-md p-4 flex flex-col justify-between animate-slide-left select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--gold)]/20 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <History size={18} className="text-[var(--gold)]" />
          <h3 className="font-bold text-[var(--gold)] text-sm sm:text-base">
            سجل أحداث المباراة
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-full bg-[var(--green-surface)] border border-[var(--gold)]/30 text-[var(--gold)] hover:bg-[var(--gold)]/15 transition cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      {/* Events List */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
        {events.length === 0 ? (
          <div className="text-center text-[var(--text-muted)] py-8">لا توجد أحداث مسجلة بعد.</div>
        ) : (
          events.map((ev) => {
            const isPlayer = ev.actor === 'player';
            const isCpu = ev.actor === 'cpu';

            return (
              <div
                key={ev.id}
                className={`p-2.5 rounded-2xl border flex flex-col gap-1 transition ${
                  ev.type === 'CAPTURE'
                    ? 'bg-[var(--green-card)] border-[var(--gold)]/40 shadow-sm'
                    : isPlayer
                    ? 'bg-[var(--green-surface)] border-[var(--gold)]/25'
                    : isCpu
                    ? 'bg-[var(--green-surface)] border-[var(--green-border)]'
                    : 'bg-[var(--green-deep)]/60 border-[var(--green-border)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`font-black text-[10px] uppercase px-2 py-0.5 rounded-full ${
                      isPlayer
                        ? 'bg-[var(--gold)]/20 text-[var(--gold-light)] border border-[var(--gold)]/30'
                        : isCpu
                        ? 'bg-[var(--green-border)]/50 text-[var(--text-muted)] border border-[var(--green-border)]'
                        : 'bg-[var(--gold)]/10 text-[var(--gold)]'
                    }`}
                  >
                    {isPlayer ? 'أنت' : isCpu ? 'الخصم' : 'النظام'}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] font-mono">
                    {new Date(ev.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </div>

                <p className="text-[var(--text-main)] font-medium text-[11px] leading-snug">
                  {ev.message}
                </p>

                {ev.card && (
                  <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-[var(--gold-light)]">
                    <span className="font-mono">لعب: {ev.card.rank}{ev.card.suit}</span>
                    {ev.capturedCards && ev.capturedCards.length > 0 && (
                      <span className="text-[var(--gold)] font-bold">
                        (+{ev.capturedCards.length} ورقة)
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="pt-3 border-t border-[var(--gold)]/20 text-center">
        <span className="text-[10px] text-[var(--text-muted)]">
          إجمالي الأحداث: {events.length}
        </span>
      </div>
    </div>
  );
};
