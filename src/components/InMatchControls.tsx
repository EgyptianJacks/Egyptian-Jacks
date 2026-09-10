import React from 'react';
import { LogOut, Volume2, VolumeX, HelpCircle, History } from 'lucide-react';
import { soundEngine } from '../engine/soundEngine';

interface InMatchControlsProps {
  onExit: () => void;
  onOpenRules: () => void;
  onToggleLog?: () => void;
}

export const InMatchControls: React.FC<InMatchControlsProps> = ({
  onExit,
  onOpenRules,
  onToggleLog,
}) => {
  const [audioEnabled, setAudioEnabled] = React.useState<boolean>(() => soundEngine.isEnabled());

  const handleToggleAudio = () => {
    const next = soundEngine.toggle();
    setAudioEnabled(next);
    if (next) soundEngine.playSelect();
  };

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {/* Audio Toggle Icon */}
      <button
        type="button"
        onClick={handleToggleAudio}
        aria-label={audioEnabled ? 'كتم الصوت' : 'تشغيل الصوت'}
        className="p-1.5 sm:p-2 rounded-lg bg-black/40 border border-white/20 text-white/80 hover:text-white transition cursor-pointer"
        title={audioEnabled ? 'كتم الصوت' : 'تشغيل الصوت'}
      >
        {audioEnabled ? <Volume2 size={16} className="text-[#ffeb3b]" /> : <VolumeX size={16} />}
      </button>

      {/* Rules Modal Button */}
      <button
        type="button"
        onClick={onOpenRules}
        aria-label="عرض قواعد اللعبة"
        className="p-1.5 sm:p-2 rounded-lg bg-black/40 border border-white/20 text-white/80 hover:text-white transition cursor-pointer"
        title="قواعد اللعبة"
      >
        <HelpCircle size={16} />
      </button>

      {/* History Log Toggle */}
      {onToggleLog && (
        <button
          type="button"
          onClick={onToggleLog}
          aria-label="عرض سجل أحداث اللعبة"
          className="p-1.5 sm:p-2 rounded-lg bg-black/40 border border-white/20 text-white/80 hover:text-white transition cursor-pointer"
          title="سجل اللعبة"
        >
          <History size={16} />
        </button>
      )}

      {/* Exit Match Icon */}
      <button
        type="button"
        onClick={onExit}
        aria-label="مغادرة المباراة إلى القائمة الرئيسية"
        className="p-1.5 sm:p-2 rounded-lg bg-black/40 border border-red-500/40 text-red-400 hover:text-red-300 hover:bg-red-950/40 transition cursor-pointer"
        title="مغادرة المباراة"
      >
        <LogOut size={16} />
      </button>
    </div>
  );
};
