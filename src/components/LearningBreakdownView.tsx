import React from 'react';
import { RoundLearningSummary } from '../tutorial/learningSummaryEngine';
import { Award, Zap, BookOpen, Target, Shield } from 'lucide-react';

interface LearningBreakdownViewProps {
  summary: RoundLearningSummary;
}

export const LearningBreakdownView: React.FC<LearningBreakdownViewProps> = ({ summary }) => {
  return (
    <div className="w-full space-y-3 animate-fade-in text-right">
      {/* Quick Summary Badges */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <div className="p-2 rounded-xl bg-black/30 border border-white/10">
          <div className="text-[10px] text-white/60">أكلات الطاولة</div>
          <div className="text-sm font-bold text-white mt-0.5">{summary.totalCapturesCount}</div>
        </div>
        <div className="p-2 rounded-xl bg-black/30 border border-amber-500/30">
          <div className="text-[10px] text-amber-300">سرقات الكومة</div>
          <div className="text-sm font-bold text-amber-400 mt-0.5">{summary.stealsCount}</div>
        </div>
        <div className="p-2 rounded-xl bg-black/30 border border-emerald-500/30">
          <div className="text-[10px] text-emerald-300">المجموعات</div>
          <div className="text-sm font-bold text-emerald-400 mt-0.5">{summary.setsCount}</div>
        </div>
        <div className="p-2 rounded-xl bg-black/30 border border-[#ffeb3b]/30">
          <div className="text-[10px] text-[#ffeb3b]">الكومبو المركب</div>
          <div className="text-sm font-bold text-[#ffeb3b] mt-0.5">{summary.combosCount}</div>
        </div>
      </div>

      {/* Insights List */}
      <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
        {summary.insights.map((item) => (
          <div
            key={item.id}
            className="p-3 rounded-2xl bg-black/40 border border-[var(--gold)]/25 space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                  item.badgeVariant === 'gold'
                    ? 'bg-[var(--gold)]/20 border-[var(--gold)] text-[#ffeb3b]'
                    : item.badgeVariant === 'amber'
                    ? 'bg-amber-950/50 border-amber-500/50 text-amber-300'
                    : item.badgeVariant === 'emerald'
                    ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-300'
                    : 'bg-blue-950/50 border-blue-500/50 text-blue-300'
                }`}
              >
                {item.badgeText}
              </span>
              <h4 className="text-xs sm:text-sm font-bold text-[var(--gold)] flex items-center gap-1">
                {item.category === 'COMBO' && <Award size={14} className="text-[#ffeb3b]" />}
                {item.category === 'STEAL' && <Zap size={14} className="text-amber-400" />}
                {item.category === 'SET' && <BookOpen size={14} className="text-emerald-400" />}
                {item.category === 'CAPTURE' && <Target size={14} className="text-blue-400" />}
                {item.category === 'TEMPO' && <Shield size={14} className="text-slate-400" />}
                {item.title}
              </h4>
            </div>

            <div className="text-xs text-white/90 leading-relaxed font-sans">
              <span className="text-[#c8e6c9] font-semibold">ما حدث: </span>
              {item.whatHappened}
            </div>

            <div className="text-xs text-white/80 leading-relaxed font-sans">
              <span className="text-amber-300 font-semibold">الأهمية: </span>
              {item.whyItMattered}
            </div>

            <div className="text-[11px] text-white/70 bg-black/30 p-2 rounded-xl border border-white/10 font-sans mt-1">
              <span className="text-[var(--gold)] font-bold">💡 الملاحظة: </span>
              {item.keyTakeaway}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
