import React from 'react';
import {
  Sparkles,
  Swords,
  Target,
  Zap,
  Crown,
  Lightbulb,
  X,
  Play,
  RotateCcw,
} from 'lucide-react';
import { TutorialLesson } from '../tutorial/tutorialTypes';
import { soundEngine } from '../engine/soundEngine';

interface PracticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectConcept: (lesson: TutorialLesson) => void;
  onStartFreePractice: () => void;
}

export const PracticeModal: React.FC<PracticeModalProps> = ({
  isOpen,
  onClose,
  onSelectConcept,
  onStartFreePractice,
}) => {
  if (!isOpen) return null;

  const concepts: Array<{
    lesson: TutorialLesson;
    title: string;
    description: string;
    icon: React.ReactNode;
    tag: string;
    tagColor: string;
  }> = [
    {
      lesson: 1,
      title: 'الأكل المباشر ومطابقة الرتب',
      description: 'مطابقة رتبة الكرت من يدك مع الكروت المكشوفة على الطاولة ونقلها إلى كومة الفوز.',
      icon: <Target size={18} className="text-emerald-400" />,
      tag: 'أساسي • Seed 1',
      tagColor: 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300',
    },
    {
      lesson: 2,
      title: 'سرقة كومة فوز الخصم',
      description: 'استغلال الورقة العلوية المكشوفة لكومة فوز الخصم والاستيلاء على كامل الكومة.',
      icon: <Zap size={18} className="text-amber-400" />,
      tag: 'تكتيكي • Seed 5',
      tagColor: 'bg-amber-950/80 border-amber-500/50 text-amber-300',
    },
    {
      lesson: 3,
      title: 'تشكيل المجموعات الملكية (Sets)',
      description: 'تمييز الأنماط وجمع 4 كروت من نفس الرتبة لحصد النقاط الكبرى (+12 نقطة).',
      icon: <Crown size={18} className="text-yellow-400" />,
      tag: 'نقاط كبرى • Seed 175',
      tagColor: 'bg-yellow-950/80 border-yellow-500/50 text-yellow-300',
    },
    {
      lesson: 4,
      title: 'الأكل الفوري مقابل مرونة اليد',
      description: 'الموازنة الاستراتيجية بين تأمين النقاط اللحظية والتضحية الواعية للتحكم في الإيقاع.',
      icon: <Lightbulb size={18} className="text-blue-400" />,
      tag: 'استراتيجي • Seed 404',
      tagColor: 'bg-blue-950/80 border-blue-500/50 text-blue-300',
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="ميدان التدريب الحر"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 select-none"
    >
      <div className="relative w-full max-w-xl bg-[#0e2a18] border-2 border-[var(--gold)]/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-right">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-black/40 border-b border-white/10">
          <button
            type="button"
            onClick={() => {
              soundEngine.playSelect();
              onClose();
            }}
            aria-label="إغلاق ميدان التدريب"
            className="p-1.5 rounded-full bg-white/5 hover:bg-white/15 text-white/70 hover:text-white transition cursor-pointer"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-2">
            <span className="text-sm sm:text-base font-black text-[#ffeb3b]">
              ميدان التدريب الحر (Practice Table)
            </span>
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#f5b042] to-[#c8860a] p-0.5 flex items-center justify-center text-[#1f2e1c] shadow-md">
              <Sparkles size={16} />
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto max-h-[75vh] flex flex-col gap-4">
          <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
            اختر أسلوب التدريب المناسب: يمكنك التدرب الحر على مفهوم تكتيكي محدد مع سيناريو موجه، أو خوض مباراة تدريب كاملة بإرشاد لحظي.
          </p>

          {/* Section 1: Concept Practice */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#ffeb3b]">
              <Target size={14} />
              <span>1. التدريب على مفهوم محدد (Concept Practice):</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {concepts.map((item) => (
                <button
                  key={item.lesson}
                  type="button"
                  onClick={() => {
                    soundEngine.playSelect();
                    onSelectConcept(item.lesson);
                  }}
                  className="p-3 rounded-2xl bg-black/35 hover:bg-emerald-950/60 border border-emerald-500/30 hover:border-emerald-400 text-right flex flex-col justify-between gap-2 transition cursor-pointer group shadow-sm hover:shadow-md active:scale-98"
                >
                  <div className="flex items-center justify-between w-full">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${item.tagColor}`}
                    >
                      {item.tag}
                    </span>
                    <div className="flex items-center gap-1.5 text-white font-bold text-xs sm:text-sm group-hover:text-[#ffeb3b] transition">
                      <span>{item.title}</span>
                      {item.icon}
                    </div>
                  </div>

                  <p className="text-[11px] sm:text-xs text-white/70 leading-relaxed group-hover:text-white/90">
                    {item.description}
                  </p>

                  <div className="flex items-center justify-end gap-1 text-[11px] font-bold text-emerald-300 group-hover:text-[#ffeb3b] pt-1 border-t border-white/5">
                    <span>بدء تمرين المفهوم</span>
                    <Play size={11} />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Section 2: Free Practice Match */}
          <div className="mt-1 pt-3 border-t border-white/10 flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#c8e6c9]">
              <Swords size={14} />
              <span>2. مباراة تدريب حرة كاملة (Free Practice Match):</span>
            </div>

            <button
              type="button"
              onClick={() => {
                soundEngine.playSelect();
                onStartFreePractice();
              }}
              className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/90 via-[#0d2a17]/90 to-emerald-950/90 hover:from-emerald-900 hover:to-emerald-900 border border-emerald-500/50 hover:border-emerald-400 text-right flex items-center justify-between transition cursor-pointer shadow-md active:scale-98"
            >
              <div className="px-3 py-1.5 rounded-xl btn-yellow-ref text-xs font-black flex items-center gap-1 shrink-0">
                <span>بدء المباراة</span>
                <Play size={13} />
              </div>

              <div className="flex flex-col text-right">
                <span className="text-xs sm:text-sm font-bold text-[#ffeb3b]">
                  مباراة حرة كاملة مع إرشاد تكتيكي لحظي
                </span>
                <span className="text-[11px] text-white/70">
                  مباراة فردية قياسية مع شريط توجيه مباشر يرصد الأكل المباشر، سرقة الكومة، وبناء المجموعات.
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-4 sm:px-6 py-3 bg-black/40 border-t border-white/10 flex items-center justify-between text-xs text-white/60">
          <button
            type="button"
            onClick={() => {
              soundEngine.playSelect();
              onClose();
            }}
            className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition cursor-pointer"
          >
            إغلاق
          </button>
          <span className="font-mono text-[11px]">Egyptian Jacks • Practice Table</span>
        </div>
      </div>
    </div>
  );
};
