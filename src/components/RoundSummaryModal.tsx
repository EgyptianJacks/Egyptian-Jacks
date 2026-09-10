import React, { useState } from 'react';
import { GameState, MatchState, PlayerId, RoundScoreRecord } from '../types/game';
import { Trophy, ArrowLeft, Crown, Sparkles, Home, BookOpen, BarChart3 } from 'lucide-react';
import { extractLearningSummary } from '../tutorial/learningSummaryEngine';
import { LearningBreakdownView } from './LearningBreakdownView';

interface RoundSummaryModalProps {
  isOpen: boolean;
  matchState: MatchState;
  gameState?: GameState;
  onStartNextRound: () => void;
  onBackToLobby?: () => void;
}

export const RoundSummaryModal: React.FC<RoundSummaryModalProps> = ({
  isOpen,
  matchState,
  gameState,
  onStartNextRound,
  onBackToLobby,
}) => {
  const [activeTab, setActiveTab] = useState<'SCORE' | 'LEARNING'>('SCORE');
  if (!isOpen || matchState.roundHistory.length === 0) return null;

  const latestRound: RoundScoreRecord = matchState.roundHistory[matchState.roundHistory.length - 1];
  const isPlayerWin = latestRound.winner === 'player';
  const isCpuWin = latestRound.winner === 'cpu';
  const isDraw = latestRound.winner === 'DRAW';

  const nextStarter: PlayerId = matchState.currentRoundStarter === 'player' ? 'cpu' : 'player';
  const learningSummary = gameState ? extractLearningSummary(gameState) : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="ملخص نتيجة الجولة"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in select-none"
    >
      <div className="relative w-full max-w-lg rounded-3xl bg-gradient-to-b from-[var(--green-card)] via-[var(--green-surface-elevated)] to-[var(--green-deep)] border border-[var(--gold)]/40 shadow-2xl p-5 sm:p-7 text-[var(--text-main)] flex flex-col items-center">
        {/* Emblem Top */}
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-[var(--gold)] to-[var(--gold-dark)] p-1 flex items-center justify-center text-[#1f2e1c] shadow-xl -mt-12 sm:-mt-14 mb-3 border-4 border-[var(--green-deep)]">
          {isPlayerWin ? (
            <Trophy size={30} />
          ) : isDraw ? (
            <Sparkles size={30} />
          ) : (
            <Crown size={30} />
          )}
        </div>

        {/* Round Result Title */}
        <h2 className="text-xl sm:text-2xl font-black tracking-tight text-center uppercase mb-1">
          <span>الجولة #{latestRound.roundNumber} </span>
          {isPlayerWin ? (
            <span className="text-[#ffeb3b]">فوز لك!</span>
          ) : isDraw ? (
            <span className="text-[var(--gold-light)]">تعادل</span>
          ) : (
            <span className="text-red-400">فوز للخصم</span>
          )}
        </h2>

        {/* Tab Selector */}
        {learningSummary && (
          <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 mb-3 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('SCORE')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                activeTab === 'SCORE'
                  ? 'bg-[var(--gold)] text-[#1f2e1c] shadow-sm'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              <BarChart3 size={13} />
              <span>نتيجة الجولة</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('LEARNING')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                activeTab === 'LEARNING'
                  ? 'bg-[var(--gold)] text-[#1f2e1c] shadow-sm'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              <BookOpen size={13} />
              <span>تحليل الأداء والتعلم 💡</span>
            </button>
          </div>
        )}

        {activeTab === 'LEARNING' && learningSummary ? (
          <div className="w-full mb-4">
            <LearningBreakdownView summary={learningSummary} />
          </div>
        ) : (
          <>
            {/* Match Progress Score (e.g. 1 - 0) */}
            <div className="w-full bg-[var(--green-surface)] rounded-2xl border border-[var(--gold)]/20 p-3 my-3 text-center">
              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#c8e6c9]">
                نتيجة المباراة (الأول إلى {matchState.targetWins} انتصارات)
              </span>
              <div className="flex items-center justify-center gap-6 mt-1 text-2xl sm:text-3xl font-black font-mono">
                <div className="flex flex-col items-center">
                  <span className="text-xs font-sans text-[#ffeb3b]">أنت</span>
                  <span className="text-white">{matchState.playerRoundWins}</span>
                </div>
                <span className="text-[#c8e6c9] text-lg font-light">-</span>
                <div className="flex flex-col items-center">
                  <span className="text-xs font-sans text-red-300">الخصم</span>
                  <span className="text-white">{matchState.cpuRoundWins}</span>
                </div>
              </div>
            </div>

            {/* Round Points Comparison */}
            <div className="w-full grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 rounded-xl border border-white/10 bg-black/20 text-center">
                <span className="text-xs text-[#c8e6c9] font-bold">نقاطك بالجولة</span>
                <div className="text-2xl font-black text-[#ffeb3b] mt-0.5">
                  {latestRound.playerScore}
                </div>
              </div>
              <div className="p-3 rounded-xl border border-white/10 bg-black/20 text-center">
                <span className="text-xs text-red-300 font-bold">نقاط الخصم بالجولة</span>
                <div className="text-2xl font-black text-white mt-0.5">
                  {latestRound.cpuScore}
                </div>
              </div>
            </div>

            {/* Next Round Info & Starter */}
            <div className="w-full text-center text-xs text-[#c8e6c9] bg-black/30 py-2 px-3 rounded-xl border border-white/10 mb-5 flex items-center justify-center gap-2">
              <span>الجولة القادمة (#{matchState.currentRound + 1}):</span>
              <span className="font-bold text-[#ffeb3b]">
                البداية مع {nextStarter === 'player' ? 'أنت' : 'الخصم'}
              </span>
            </div>
          </>
        )}

        {/* Action Buttons */}
        <div className="w-full flex flex-col sm:flex-row items-center gap-2.5">
          <button
            type="button"
            onClick={onStartNextRound}
            className="w-full flex-1 py-3 px-5 rounded-xl btn-yellow-ref font-bold text-xs sm:text-sm uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>ابدأ الجولة التالية</span>
            <ArrowLeft size={16} />
          </button>

          {onBackToLobby && (
            <button
              type="button"
              onClick={onBackToLobby}
              className="w-full sm:w-auto py-3 px-4 rounded-xl bg-black/40 border border-white/20 text-white hover:text-[#ffeb3b] font-bold text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Home size={15} />
              <span>الردهة</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
