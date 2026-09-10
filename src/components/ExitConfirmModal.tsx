import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ExitConfirmModalProps {
  isOpen: boolean;
  onStay: () => void;
  onLeave: () => void;
}

export const ExitConfirmModal: React.FC<ExitConfirmModalProps> = ({
  isOpen,
  onStay,
  onLeave,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="تأكيد مغادرة المباراة"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in select-none"
    >
      <div className="relative w-full max-w-sm rounded-3xl bg-[#133a25] border-2 border-white/30 shadow-2xl p-6 text-center text-white flex flex-col items-center">
        <div className="w-12 h-12 rounded-full bg-red-950/60 border border-red-500/50 flex items-center justify-center text-red-400 mb-3 shadow-md">
          <AlertCircle size={26} />
        </div>

        <h3 className="text-lg sm:text-xl font-black mb-1">
          هل تريد مغادرة المباراة؟
        </h3>
        <p className="text-xs text-white/70 mb-6">
          سيتم إنهاء المباراة الحالية والعودة إلى الردهة الرئيسية.
        </p>

        <div className="w-full flex items-center gap-3">
          <button
            type="button"
            onClick={onStay}
            aria-label="البقاء في المباراة الحالية"
            className="flex-1 py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs sm:text-sm font-bold transition cursor-pointer"
          >
            البقاء
          </button>
          <button
            type="button"
            onClick={onLeave}
            aria-label="تأكيد مغادرة المباراة"
            className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs sm:text-sm font-bold shadow-md transition cursor-pointer"
          >
            مغادرة المباراة
          </button>
        </div>
      </div>
    </div>
  );
};
