import React, { useState } from 'react';
import { X, Crown, Layers, Sparkles, Trophy, ShieldAlert, BookOpen, Compass } from 'lucide-react';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'BASICS' | 'STEAL' | 'SETS' | 'TACTICS'>('BASICS');

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="أكاديمية قواعد Egyptian Jacks"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in select-none"
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-gradient-to-b from-[var(--green-card)] via-[var(--green-surface-elevated)] to-[var(--green-deep)] border border-[var(--gold)]/40 shadow-2xl p-5 sm:p-7 text-[var(--text-main)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--gold)]/20 pb-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-[var(--gold)]/15 border border-[var(--gold)]/40 text-[var(--gold)]">
              <Crown size={20} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-[var(--gold)] tracking-tight">
                أكاديمية قواعد Egyptian Jacks
              </h2>
              <p className="text-xs text-[var(--text-muted)] font-medium">
                دليل القواعد المعتمد، الحسابات الرياضية، والمرونة التكتيكية
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق دليل القواعد"
            className="p-1.5 rounded-full bg-[var(--green-surface)] border border-[var(--gold)]/30 text-[var(--gold)] hover:bg-[var(--gold)]/15 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-3 border-b border-white/10 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('BASICS')}
            className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1 cursor-pointer whitespace-nowrap ${
              activeTab === 'BASICS'
                ? 'bg-[var(--gold)] text-[#1f2e1c] shadow-sm'
                : 'bg-black/30 text-white/70 hover:text-white'
            }`}
          >
            <Layers size={13} />
            <span>الأساسيات والأكل</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('STEAL')}
            className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1 cursor-pointer whitespace-nowrap ${
              activeTab === 'STEAL'
                ? 'bg-[var(--gold)] text-[#1f2e1c] shadow-sm'
                : 'bg-black/30 text-white/70 hover:text-white'
            }`}
          >
            <ShieldAlert size={13} />
            <span>سرقة الكومة</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('SETS')}
            className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1 cursor-pointer whitespace-nowrap ${
              activeTab === 'SETS'
                ? 'bg-[var(--gold)] text-[#1f2e1c] shadow-sm'
                : 'bg-black/30 text-white/70 hover:text-white'
            }`}
          >
            <Trophy size={13} />
            <span>المجموعات والاحتساب</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('TACTICS')}
            className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1 cursor-pointer whitespace-nowrap ${
              activeTab === 'TACTICS'
                ? 'bg-[var(--gold)] text-[#1f2e1c] shadow-sm'
                : 'bg-black/30 text-white/70 hover:text-white'
            }`}
          >
            <Compass size={13} />
            <span>إدارة اليد والتكتيك</span>
          </button>
        </div>

        {/* Content Sections based on Active Tab */}
        <div className="space-y-3 text-xs sm:text-sm text-[var(--text-main)] leading-relaxed">
          {activeTab === 'BASICS' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-[var(--green-surface)] border border-[var(--green-border)]">
                <h3 className="font-bold text-[var(--gold)] mb-1 flex items-center gap-1.5">
                  <Layers size={14} />
                  ١. التوزيع وطاولة اللعب المزدوجة
                </h3>
                <p className="text-[var(--text-muted)]">
                  تحتوي المجموعة على 52 ورقة لعب قياسية مقسمة على 6 توزيعات في الجولة الواحدة. يتم في التوزيع المبدئي إعطاء <strong className="text-[var(--text-main)]">4 أوراق لك</strong>، و <strong className="text-[var(--text-main)]">4 أوراق للخصم</strong>، و <strong className="text-[var(--text-main)]">ورقتين لكل طاولة لاعب</strong>.
                </p>
                <p className="mt-1.5 text-[var(--text-muted)]">
                  • <strong className="text-[var(--gold)]">العرض المبدئي:</strong> في بداية الجولة، تظهر الأوراق الموزعة على الطاولة مكشوفة ومتاحة للأكل المباشر حسب الرتبة.<br />
                  • <strong className="text-[var(--gold)]">العرض المتراكم:</strong> بعد اللعب، تتشكل الأوراق في كومات، وتكون <strong className="text-[var(--text-main)]">الورقة العلوية فقط</strong> لكل كومة هي المتاحة للأكل.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-[var(--green-surface)] border border-[var(--green-border)]">
                <h3 className="font-bold text-[var(--gold)] mb-1 flex items-center gap-1.5">
                  <Sparkles size={14} />
                  ٢. آلية الأكل المباشر
                </h3>
                <p className="text-[var(--text-muted)]">
                  العب ورقة من يدك لمطابقة الورقة المستهدفة حسب <strong className="text-[var(--text-main)]">الرتبة المتطابقة تمامًا</strong>.
                </p>
                <ul className="mt-1.5 space-y-1 list-disc list-inside text-[var(--text-muted)]">
                  <li><strong className="text-[var(--text-main)]">أكل الطاولة:</strong> طابق رتبة الورقة العلوية على طاولة الخصم (أو طاولتك) لجمع الأوراق ونقلها إلى كومة الفوز الخاصة بك.</li>
                  <li><strong className="text-[var(--text-main)]">بدون أكل:</strong> في حال عدم وجود تطابق، توضع الورقة الملعوبة على كومة طاولتك.</li>
                  <li><strong className="text-[var(--text-main)]">الأولاد (J):</strong> ورقة الولد تطابق الولد فقط مثل سائر الأوراق بدون مسح شامل للأرض.</li>
                  <li><strong className="text-[var(--text-main)]">أكل طاولة اللاعب نفسه (Self Table Capture):</strong> عند مطابقة ورقة من يدك مع الورقة العلوية على طاولتك الخاصة، يتم أكل الورقتين معاً ونقلهما مباشرة إلى كومة فوزك، مما يحمي أوراقك من أكل الخصم.</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'STEAL' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-[var(--green-surface)] border border-[var(--green-border)]">
                <h3 className="font-bold text-[var(--gold-light)] mb-1 flex items-center gap-1.5">
                  <ShieldAlert size={14} />
                  آلية الاستيلاء على كومة فوز الخصم (Winning Pile Steal)
                </h3>
                <p className="text-[var(--text-muted)] leading-relaxed">
                  كومة فوز الخصم تظل مكشوفة الورقة العلوية دائماً. إذا كانت رتبة ورقتك في اليد تطابق <strong className="text-[var(--text-main)]">الورقة العلوية في كومة فوز الخصم</strong>، فإن لعب هذه الورقة يُمكنك من <strong className="text-[#ffeb3b]">الاستيلاء الفوري على جميع الأوراق المتتالية من نفس الرتبة</strong> من أعلى كومة فوزه!
                </p>
                <div className="mt-2.5 p-2.5 rounded-xl bg-black/30 border border-white/10 text-xs">
                  <span className="text-[var(--gold)] font-bold">💡 الأثر النقطي المزدوج:</span>
                  <p className="text-white/80 mt-0.5">
                    سرقة الكومة لا تمنحك أوراقاً إضافية فحسب، بل تحرم الخصم من نقاطها المباشرة وتمنعه من إكمال مجموعات ملكية برتب تلك الأوراق.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'SETS' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-[var(--green-surface)] border border-[var(--green-border)]">
                <h3 className="font-bold text-[var(--gold)] mb-1 flex items-center gap-1.5">
                  <Trophy size={14} />
                  جدول النقاط والمجموعات الملكية
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 font-mono text-xs">
                  <div className="p-2.5 rounded-xl bg-[var(--green-card)] border border-[var(--gold)]/30">
                    <span className="font-bold text-[var(--gold)]">👑 المجموعة الذهبية</span>
                    <p className="text-[var(--text-muted)]">مجموعة أولاد + مجموعتان عاديتان = <strong className="text-[var(--gold-light)]">75 نقطة</strong></p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[var(--green-card)] border border-[var(--gold)]/30">
                    <span className="font-bold text-[var(--gold)]">🥈 المجموعة الفضية</span>
                    <p className="text-[var(--text-muted)]">مجموعة أولاد + مجموعة عادية = <strong className="text-[var(--gold-light)]">60 نقطة</strong></p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[var(--green-card)] border border-[var(--gold)]/30">
                    <span className="font-bold text-[var(--gold)]">⚖️ المجموعة الحديدية</span>
                    <p className="text-[var(--text-muted)]">3 مجموعات عادية = <strong className="text-[var(--gold-light)]">50 نقطة</strong></p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[var(--green-card)] border border-[var(--gold)]/30">
                    <span className="font-bold text-[var(--gold)]">✨ المجموعة الثنائية</span>
                    <p className="text-[var(--text-muted)]">مجموعتان عاديتان = <strong className="text-[var(--gold-light)]">30 نقطة</strong></p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[var(--green-card)] border border-[var(--gold)]/30">
                    <span className="font-bold text-[var(--gold)]">🎴 مجموعة الأولاد</span>
                    <p className="text-[var(--text-muted)]">4 أولاد = <strong className="text-[var(--gold-light)]">36 نقطة</strong></p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[var(--green-card)] border border-[var(--gold)]/30">
                    <span className="font-bold text-[var(--gold)]">📚 مجموعة عادية</span>
                    <p className="text-[var(--text-muted)]">4 من نفس الرتبة = <strong className="text-[var(--gold-light)]">12 نقطة</strong></p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[var(--green-card)] border border-[var(--gold)]/30">
                    <span className="font-bold text-[var(--gold)]">🃏 ولد فردي</span>
                    <p className="text-[var(--text-muted)]">خارج المجموعات = <strong className="text-[var(--gold-light)]">3 نقاط</strong></p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[var(--green-card)] border border-[var(--gold)]/30">
                    <span className="font-bold text-[var(--gold)]">🃏 ورقة فردية عادية</span>
                    <p className="text-[var(--text-muted)]">خارج المجموعات = <strong className="text-[var(--gold-light)]">نقطة واحدة</strong></p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'TACTICS' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-[var(--green-surface)] border border-[var(--green-border)]">
                <h3 className="font-bold text-[var(--gold)] mb-1 flex items-center gap-1.5">
                  <Compass size={14} />
                  الموازنة بين الأكل الفوري والمرونة التكتيكية
                </h3>
                <p className="text-[var(--text-muted)] leading-relaxed">
                  في كل دور، يواجه اللاعب قراراً استراتيجياً: هل يأكل ورقة فورية لحصد نقاط مباشرة، أم يحتفظ بالورقة في يده للحفاظ على مرونة خياراته في التوزيعات القادمة؟
                </p>
                <div className="mt-2 space-y-2 text-xs">
                  <div className="p-2 rounded-xl bg-black/25 border border-white/10">
                    <span className="font-bold text-[#ffeb3b]">1. الأكل الفوري (Immediate Gain):</span>
                    <p className="text-white/80 mt-0.5">
                      يضمن تأمين الأوراق المتاحة فوراً في كومة فوزك ويمنع الخصم من سرقتها أو الاستفادة منها.
                    </p>
                  </div>
                  <div className="p-2 rounded-xl bg-black/25 border border-white/10">
                    <span className="font-bold text-[#ffeb3b]">2. مرونة اليد (Hand Flexibility):</span>
                    <p className="text-white/80 mt-0.5">
                      الاحتفاظ بالأوراق المتعددة يمنحك جاهزية للرد على لعب الخصم وسرقة كوماته عند ظهور رتب مطابقة في الأدوار التالية.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-8 rounded-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-dark)] text-[#1f2e1c] font-black text-sm shadow-md hover:shadow-lg transition active:scale-95 cursor-pointer"
          >
            فهمت، لنبدأ اللعب
          </button>
        </div>
      </div>
    </div>
  );
};

