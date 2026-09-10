import React, { useState } from 'react';
import { Play, HelpCircle, Volume2, VolumeX, Crown, Sparkles, Swords, User, Bot, GraduationCap, Zap, Shield, Flame } from 'lucide-react';
import { CpuDifficulty, MatchFormat, PlayerId } from '../types/game';
import { TutorialLesson } from '../tutorial/tutorialTypes';
import { soundEngine } from '../engine/soundEngine';
import { storageGet, storageSet, STORAGE_KEYS } from '../engine/persistence';
import { YoyoAvatar } from '../character/yoyo';

interface LobbyProps {
  onStartMatch: (format?: MatchFormat, starter?: PlayerId, isGuided?: boolean, difficulty?: CpuDifficulty) => void;
  onStartFirstMatch?: () => void;
  onStartLearnByPlay?: () => void;
  onStartTutorial?: (lesson: TutorialLesson, isSequential?: boolean) => void;
  onStartPracticeTable?: () => void;
  onOpenRules: () => void;
  completedLessons?: TutorialLesson[];
  initialDifficulty?: CpuDifficulty;
  onDifficultyChange?: (difficulty: CpuDifficulty) => void;
}

export const Lobby: React.FC<LobbyProps> = ({
  onStartMatch,
  onStartFirstMatch,
  onStartLearnByPlay,
  onStartTutorial: _onStartTutorial,
  onStartPracticeTable: _onStartPracticeTable,
  onOpenRules,
  completedLessons: _completedLessons = [],
  initialDifficulty = 'HARD',
  onDifficultyChange,
}) => {
  const [audioEnabled, setAudioEnabled] = useState<boolean>(() => soundEngine.isEnabled());
  const [showCustomSettings, setShowCustomSettings] = useState<boolean>(false);
  const [selectedFormat, setSelectedFormat] = useState<MatchFormat>('SINGLE');
  const [selectedStarter, setSelectedStarter] = useState<PlayerId>('player');
  const [selectedDifficulty, setSelectedDifficulty] = useState<CpuDifficulty>(() => {
    const fallback: CpuDifficulty = (initialDifficulty as CpuDifficulty) || 'HARD';
    return storageGet<CpuDifficulty>(STORAGE_KEYS.CPU_DIFFICULTY, fallback);
  });
  const [isGuidedMode, setIsGuidedMode] = useState<boolean>(false);

  const toggleAudio = () => {
    const next = soundEngine.toggle();
    setAudioEnabled(next);
    if (next) soundEngine.playSelect();
  };

  const handleFormatChange = (fmt: MatchFormat) => {
    setSelectedFormat(fmt);
    soundEngine.playSelect();
  };

  const handleStarterChange = (starter: PlayerId) => {
    setSelectedStarter(starter);
    soundEngine.playSelect();
  };

  const handleDifficultyChange = (diff: CpuDifficulty) => {
    setSelectedDifficulty(diff);
    storageSet(STORAGE_KEYS.CPU_DIFFICULTY, diff);
    if (onDifficultyChange) {
      onDifficultyChange(diff);
    }
    soundEngine.playSelect();
  };

  const handleStartFirstMatch = () => {
    soundEngine.playCardSlide();
    if (onStartFirstMatch) {
      onStartFirstMatch();
    } else if (onStartLearnByPlay) {
      onStartLearnByPlay();
    } else {
      onStartMatch(selectedFormat, selectedStarter, true, 'EASY');
    }
  };

  const handleStartNormalMatch = () => {
    soundEngine.playCardSlide();
    onStartMatch(selectedFormat, selectedStarter, isGuidedMode, selectedDifficulty);
  };

  return (
    <div className="relative min-h-screen w-full bg-[#0d1e13] text-white flex flex-col justify-between p-3 sm:p-6 select-none font-sans overflow-hidden">
      {/* Top Bar */}
      <div className="w-full max-w-4xl mx-auto flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#f5b042] to-[#c8860a] p-0.5 shadow-md flex items-center justify-center text-[#1f2e1c]">
            <Crown size={20} />
          </div>
          <span className="text-base sm:text-lg font-black tracking-tight text-[#ffeb3b]">
            Egyptian Jacks
          </span>
        </div>

        {/* Audio Toggle */}
        <button
          type="button"
          onClick={toggleAudio}
          aria-label={audioEnabled ? 'كتم الصوت' : 'تشغيل الصوت'}
          className="p-2 sm:px-3 sm:py-1.5 rounded-full bg-black/40 border border-white/20 text-white/80 hover:text-white flex items-center gap-1.5 transition cursor-pointer"
          title={audioEnabled ? 'كتم الصوت' : 'تشغيل الصوت'}
        >
          {audioEnabled ? <Volume2 size={16} className="text-[#ffeb3b]" /> : <VolumeX size={16} />}
          <span className="text-xs font-bold hidden sm:inline">
            {audioEnabled ? 'الصوت مفعل' : 'الصوت متوقف'}
          </span>
        </button>
      </div>

      {/* Hero Canvas Center */}
      <div className="relative z-10 w-full max-w-xl mx-auto flex flex-col items-center text-center felt-surface rounded-3xl border-4 border-[#144720] shadow-2xl p-5 sm:p-8 my-auto">
        {/* Emblem */}
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-tr from-[#f5b042] via-[#ffd966] to-[#c8860a] p-1 flex items-center justify-center text-[#1f2e1c] shadow-2xl mb-3 border-4 border-[#0d1e13]">
          <Sparkles size={36} />
        </div>

        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#ffeb3b] mb-1">
          Egyptian Jacks
        </h1>
        <p className="text-xs sm:text-sm text-[#c8e6c9] max-w-sm mb-4 leading-relaxed">
          طاولة البطاقات الرقمية. طابق الرتب، استولِ على كومات الفوز، وحقق المجموعات الملكية!
        </p>

        {/* PRIMARY CTA: Play First Match with Coach Yoyo */}
        <div className="w-full max-w-md mb-4">
          <button
            type="button"
            id="btn-play-first-match"
            onClick={handleStartFirstMatch}
            aria-label="العب أول ماتش مع الكوتش يويو"
            className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-black font-black text-base sm:text-lg tracking-wide shadow-2xl flex items-center justify-between gap-3 cursor-pointer transform transition active:scale-98 border-2 border-[var(--gold)]"
          >
            <div className="flex items-center gap-3 text-right">
              <YoyoAvatar expression="watching" size="md" />
              <div>
                <div className="flex items-center gap-1.5 font-black text-base sm:text-lg text-[#1f2e1c]">
                  <Play size={18} className="fill-black" />
                  <span>🃏 العب أول ماتش</span>
                </div>
                <p className="text-[11px] sm:text-xs text-black/80 font-bold mt-0.5">
                  مع الكوتش يويو • اتعلم اللعبة مباشرة على الطاولة الحقيقية
                </p>
              </div>
            </div>
            <span className="text-xs bg-black/15 text-black px-3 py-1.5 rounded-full font-black shrink-0">
              ابدأ الآن
            </span>
          </button>
        </div>

        {/* SECONDARY SECTION: Custom / Normal Match Settings */}
        <div className="w-full max-w-md bg-black/35 rounded-2xl border border-white/15 p-3 sm:p-4 mb-3 text-right">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowCustomSettings(!showCustomSettings)}
              className="w-full flex items-center justify-between text-xs font-bold text-[#ffeb3b] py-1 cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <Swords size={15} />
                <span>مباراة عادية (تخصيص الإعدادات)</span>
              </div>
              <span className="text-[10px] text-white/60 bg-white/10 px-2 py-0.5 rounded-md">
                {showCustomSettings ? 'إخفاء ▲' : 'خيارات ▼'}
              </span>
            </button>
          </div>

          {showCustomSettings && (
            <div className="pt-3 border-t border-white/10 mt-2 space-y-3 animate-fade-in">
              {/* Format Selector */}
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#ffeb3b] mb-1.5">
                  <Swords size={13} />
                  <span>نوع المباراة:</span>
                </div>
                <div role="radiogroup" aria-label="نوع المباراة" className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selectedFormat === 'SINGLE'}
                    onClick={() => handleFormatChange('SINGLE')}
                    className={`py-1.5 px-1 rounded-xl text-xs font-bold transition flex flex-col items-center border cursor-pointer ${
                      selectedFormat === 'SINGLE'
                        ? 'bg-[var(--gold)]/20 border-[var(--gold)] text-[#ffeb3b]'
                        : 'bg-black/20 border-white/10 text-white/70 hover:text-white'
                    }`}
                  >
                    <span>جولة واحدة</span>
                    <span className="text-[9px] text-white/50 font-normal">سريعة</span>
                  </button>

                  <button
                    type="button"
                    role="radio"
                    aria-checked={selectedFormat === 'BEST_OF_3'}
                    onClick={() => handleFormatChange('BEST_OF_3')}
                    className={`py-1.5 px-1 rounded-xl text-xs font-bold transition flex flex-col items-center border cursor-pointer ${
                      selectedFormat === 'BEST_OF_3'
                        ? 'bg-[var(--gold)]/20 border-[var(--gold)] text-[#ffeb3b]'
                        : 'bg-black/20 border-white/10 text-white/70 hover:text-white'
                    }`}
                  >
                    <span>أفضل من 3</span>
                    <span className="text-[9px] text-white/50 font-normal">أول من يفوز بـ 2</span>
                  </button>

                  <button
                    type="button"
                    role="radio"
                    aria-checked={selectedFormat === 'BEST_OF_5'}
                    onClick={() => handleFormatChange('BEST_OF_5')}
                    className={`py-1.5 px-1 rounded-xl text-xs font-bold transition flex flex-col items-center border cursor-pointer ${
                      selectedFormat === 'BEST_OF_5'
                        ? 'bg-[var(--gold)]/20 border-[var(--gold)] text-[#ffeb3b]'
                        : 'bg-black/20 border-white/10 text-white/70 hover:text-white'
                    }`}
                  >
                    <span>أفضل من 5</span>
                    <span className="text-[9px] text-white/50 font-normal">أول من يفوز بـ 3</span>
                  </button>
                </div>
              </div>

              {/* First Player Starter Selector */}
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#c8e6c9] mb-1.5">
                  <User size={13} />
                  <span>من يبدأ الجولة الأولى:</span>
                </div>
                <div role="radiogroup" aria-label="من يبدأ الجولة الأولى" className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selectedStarter === 'player'}
                    onClick={() => handleStarterChange('player')}
                    className={`py-1.5 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 border cursor-pointer ${
                      selectedStarter === 'player'
                        ? 'bg-[var(--gold)]/20 border-[var(--gold)] text-[#ffeb3b]'
                        : 'bg-black/20 border-white/10 text-white/70 hover:text-white'
                    }`}
                  >
                    <User size={12} />
                    <span>أنت أولاً</span>
                  </button>

                  <button
                    type="button"
                    role="radio"
                    aria-checked={selectedStarter === 'cpu'}
                    onClick={() => handleStarterChange('cpu')}
                    className={`py-1.5 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 border cursor-pointer ${
                      selectedStarter === 'cpu'
                        ? 'bg-red-950/40 border-red-500/60 text-red-300'
                        : 'bg-black/20 border-white/10 text-white/70 hover:text-white'
                    }`}
                  >
                    <Bot size={12} />
                    <span>الخصم أولاً</span>
                  </button>
                </div>
              </div>

              {/* CPU Difficulty Selector */}
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#ffd54f] mb-1.5">
                  <Bot size={13} />
                  <span>مستوى ذكاء الخصم:</span>
                </div>
                <div role="radiogroup" aria-label="مستوى ذكاء الخصم" className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selectedDifficulty === 'EASY'}
                    onClick={() => handleDifficultyChange('EASY')}
                    className={`py-1.5 px-1 rounded-xl text-xs font-bold transition flex flex-col items-center border cursor-pointer ${
                      selectedDifficulty === 'EASY'
                        ? 'bg-emerald-500/25 border-emerald-400 text-emerald-300'
                        : 'bg-black/20 border-white/10 text-white/70 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <Shield size={11} className="text-emerald-400" />
                      <span>سهل</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    role="radio"
                    aria-checked={selectedDifficulty === 'MEDIUM'}
                    onClick={() => handleDifficultyChange('MEDIUM')}
                    className={`py-1.5 px-1 rounded-xl text-xs font-bold transition flex flex-col items-center border cursor-pointer ${
                      selectedDifficulty === 'MEDIUM'
                        ? 'bg-amber-500/25 border-amber-400 text-amber-300'
                        : 'bg-black/20 border-white/10 text-white/70 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <Zap size={11} className="text-amber-400" />
                      <span>متوسط</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    role="radio"
                    aria-checked={selectedDifficulty === 'HARD'}
                    onClick={() => handleDifficultyChange('HARD')}
                    className={`py-1.5 px-1 rounded-xl text-xs font-bold transition flex flex-col items-center border cursor-pointer ${
                      selectedDifficulty === 'HARD'
                        ? 'bg-red-500/25 border-red-400 text-red-300'
                        : 'bg-black/20 border-white/10 text-white/70 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <Flame size={11} className="text-red-400" />
                      <span>خبير</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Start Normal Match Button */}
              <button
                type="button"
                id="btn-start-normal-match"
                onClick={handleStartNormalMatch}
                aria-label="بدء مباراة عادية"
                className="w-full py-2.5 px-4 rounded-xl bg-black/50 hover:bg-black/70 border border-white/25 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer mt-2"
              >
                <Swords size={15} className="text-[#ffeb3b]" />
                <span>ابدأ مباراة عادية</span>
              </button>
            </div>
          )}
        </div>

        {/* Rules Modal Button */}
        <button
          type="button"
          onClick={onOpenRules}
          aria-label="فتح دليل قواعد اللعبة والمجموعات"
          className="py-2 px-4 rounded-xl text-xs sm:text-sm font-bold text-white/80 hover:text-white flex items-center gap-1.5 transition cursor-pointer"
        >
          <HelpCircle size={15} />
          <span>قواعد اللعبة والمجموعات</span>
        </button>
      </div>

      {/* Footer Info */}
      <div className="w-full max-w-4xl mx-auto flex items-center justify-center text-[11px] sm:text-xs text-white/50 font-mono z-10 text-center">
        <span>Egyptian Jacks • طاولة البطاقات الرقمية</span>
      </div>
    </div>
  );
};

