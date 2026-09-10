import React, { useState } from 'react';
import { ScoreBreakdown, PlayerId, MatchState, GameState } from '../types/game';
import {
  Trophy,
  RotateCcw,
  Crown,
  Sparkles,
  Home,
  BookOpen,
  BarChart3,
  CheckCircle,
  Lightbulb,
  Compass,
  Flame,
  Brain,
} from 'lucide-react';
import { YoyoAvatar, YoyoExpression } from '../character/yoyo';
import { YoyoPostMatchAnalysis } from '../character/brain/yoyoMatchAnalysis';

export interface FirstMatchMilestoneSummary {
  id: string;
  title: string;
  description: string;
  achieved: boolean;
}

interface GameOverModalProps {
  isOpen: boolean;
  winner: PlayerId | 'DRAW' | null;
  playerScore: ScoreBreakdown | null;
  cpuScore: ScoreBreakdown | null;
  matchState?: MatchState | null;
  gameState?: GameState | null;
  yoyoAnalysis?: YoyoPostMatchAnalysis | null;
  firstMatchMilestones?: FirstMatchMilestoneSummary[] | null;
  onPlayAgain: () => void;
  onBackToLobby?: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  isOpen,
  winner,
  playerScore,
  cpuScore,
  matchState,
  gameState,
  yoyoAnalysis,
  firstMatchMilestones,
  onPlayAgain,
  onBackToLobby,
}) => {
  const [activeTab, setActiveTab] = useState<'SCORE' | 'ANALYSIS'>('SCORE');
  if (!isOpen || !playerScore || !cpuScore) return null;

  const isPlayerWin = winner === 'player';
  const isCpuWin = winner === 'cpu';
  const isDraw = winner === 'DRAW';

  const isMultiRound = matchState && matchState.format !== 'SINGLE';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="نتائج المباراة النهائية"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in select-none"
    >
      <div className="relative w-full max-w-lg rounded-3xl bg-gradient-to-b from-[var(--green-card)] via-[var(--green-surface-elevated)] to-[var(--green-deep)] border border-[var(--gold)]/40 shadow-2xl p-5 sm:p-7 text-[var(--text-main)] flex flex-col items-center">
        {/* Banner Top */}
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-[var(--gold)] to-[var(--gold-dark)] p-1 flex items-center justify-center text-[#1f2e1c] shadow-xl -mt-12 sm:-mt-14 mb-3 border-4 border-[var(--green-deep)]">
          {isPlayerWin ? (
            <Trophy size={32} />
          ) : isDraw ? (
            <Sparkles size={32} />
          ) : (
            <Crown size={32} />
          )}
        </div>

        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-center uppercase">
          {isPlayerWin ? (
            <span className="text-[#ffeb3b] drop-shadow">
              {isMultiRound ? 'بطل المباراة!' : 'لقد فزت!'}
            </span>
          ) : isDraw ? (
            <span className="text-[var(--gold-light)]">تعادل في المباراة</span>
          ) : (
            <span className="text-red-400">
              {isMultiRound ? 'فاز الخصم بالمباراة' : 'لقد خسرت'}
            </span>
          )}
        </h2>
        <p className="text-xs sm:text-sm text-[var(--text-muted)] text-center mb-3">
          {yoyoAnalysis ? yoyoAnalysis.headline : isPlayerWin
            ? 'أداء رائع وتخطيط متقن! حققت النصر في المباراة.'
            : isDraw
            ? 'مباراة متكافئة ومستوى قوي من كلا الطرفين.'
            : 'فاز الخصم بهذه المباراة. العب مجددًا لتحقيق الفوز!'}
        </p>

        {/* Tab Selector */}
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
            <span>النتيجة النهائية</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ANALYSIS')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
              activeTab === 'ANALYSIS'
                ? 'bg-[var(--gold)] text-[#1f2e1c] shadow-sm'
                : 'text-white/70 hover:text-white'
            }`}
          >
            <BookOpen size={13} />
            <span>تحليل يويو للماتش 🧠</span>
          </button>
        </div>

        {/* Yoyo Post-Match Commentary */}
        <div className="w-full bg-black/40 rounded-2xl border border-amber-400/30 p-3 mb-3 text-right">
          <div className="flex items-center gap-3">
            <YoyoAvatar
              expression={isPlayerWin ? 'respect' : isCpuWin ? 'victory' : 'small_smile'}
              size="md"
            />
            <div className="flex-1 min-w-0">
              <span className="text-[11px] font-bold text-amber-300 block mb-0.5">
                يويو (منافسك):
              </span>
              <p className="text-xs sm:text-sm text-white/95 leading-relaxed font-medium">
                {yoyoAnalysis?.yoyoQuote ||
                  (isPlayerWin
                    ? 'لعبتها أذكى مني المرة دي... بس الماتش الجاي مش هسيبلك فرصة!'
                    : 'ماتش جامد يا معلم! اتعلمت من طريقتك، يلا ماتش تاني ونشوف مين يسيطر؟')}
              </p>
            </div>
          </div>
        </div>

        {activeTab === 'ANALYSIS' && yoyoAnalysis ? (
          <div className="w-full mb-4 space-y-2.5 text-right text-xs">
            {/* What player did well */}
            <div className="bg-[var(--green-surface)]/80 border border-emerald-500/30 rounded-xl p-3">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold mb-1">
                <CheckCircle size={14} />
                <span>إيه اللي عملته صح؟</span>
              </div>
              <p className="text-white/90 leading-relaxed font-sans">
                {yoyoAnalysis.whatPlayerDidWell}
              </p>
            </div>

            {/* What Yoyo exploited */}
            <div className="bg-[var(--green-surface)]/80 border border-amber-500/30 rounded-xl p-3">
              <div className="flex items-center gap-1.5 text-amber-400 font-bold mb-1">
                <Compass size={14} />
                <span>نظرة يويو لتكتيكك:</span>
              </div>
              <p className="text-white/90 leading-relaxed font-sans">
                {yoyoAnalysis.whatYoyoExploited}
              </p>
            </div>

            {/* Turning Point */}
            <div className="bg-[var(--green-surface)]/80 border border-indigo-500/30 rounded-xl p-3">
              <div className="flex items-center gap-1.5 text-indigo-300 font-bold mb-1">
                <Flame size={14} />
                <span>نقطة التحول في الماتش:</span>
              </div>
              <p className="text-white/90 leading-relaxed font-sans">
                {yoyoAnalysis.turningPoint}
              </p>
            </div>

            {/* Yoyo Learning / Self Reflection */}
            {yoyoAnalysis.yoyoLearning && (
              <div className="bg-[var(--green-surface)]/80 border border-purple-500/30 rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-purple-300 font-bold mb-1">
                  <Brain size={14} />
                  <span>اعتراف يويو والدرس اللي اتعلمه:</span>
                </div>
                <p className="text-white/90 leading-relaxed font-sans">
                  {yoyoAnalysis.yoyoLearning}
                </p>
              </div>
            )}

            {/* Adaptation & Tip */}
            <div className="bg-[var(--green-surface)]/80 border border-[var(--gold)]/30 rounded-xl p-3">
              <div className="flex items-center gap-1.5 text-[#ffeb3b] font-bold mb-1">
                <Lightbulb size={14} />
                <span>التحدي الجاي:</span>
              </div>
              <p className="text-white/90 leading-relaxed font-sans">
                {yoyoAnalysis.nextChallengeTip}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Multi-Round Match Score Summary */}
            {isMultiRound && matchState && (
              <div className="w-full bg-black/40 rounded-2xl border border-[var(--gold)]/40 p-3 mb-4 text-center">
                <span className="text-[11px] font-bold text-[#c8e6c9] uppercase tracking-wider">
                  النتيجة النهائية للمباراة ({matchState.format === 'BEST_OF_3' ? 'أفضل من 3' : 'أفضل من 5'})
                </span>
                <div className="flex items-center justify-center gap-6 mt-1 text-2xl font-black font-mono">
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-sans text-[#ffeb3b]">أنت</span>
                    <span className="text-white">{matchState.playerRoundWins}</span>
                  </div>
                  <span className="text-[#c8e6c9] text-base font-light">-</span>
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-sans text-red-300">الخصم</span>
                    <span className="text-white">{matchState.cpuRoundWins}</span>
                  </div>
                </div>

                {/* Round History pills */}
                {matchState.roundHistory.length > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-2 pt-2 border-t border-white/10 text-[11px] font-mono">
                    {matchState.roundHistory.map((r) => (
                      <span
                        key={r.roundNumber}
                        className={`px-2 py-0.5 rounded-md border ${
                          r.winner === 'player'
                            ? 'bg-[var(--gold)]/20 border-[var(--gold)] text-[#ffeb3b]'
                            : r.winner === 'cpu'
                            ? 'bg-red-950/40 border-red-500/40 text-red-300'
                            : 'bg-black/30 border-white/20 text-white/70'
                        }`}
                      >
                        ج#{r.roundNumber}: {r.playerScore}-{r.cpuScore}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Big Score Cards (Last/Deciding Round) */}
            <div className="w-full grid grid-cols-2 gap-3 sm:gap-4 mb-4">
              {/* Player Score */}
              <div
                className={`p-3.5 sm:p-4 rounded-2xl border text-center ${
                  isPlayerWin
                    ? 'bg-[var(--green-surface)] border-[var(--gold)] shadow-lg shadow-[var(--gold)]/10'
                    : 'bg-[var(--green-surface)]/60 border-[var(--green-border)]'
                }`}
              >
                <span className="text-xs font-bold uppercase tracking-wider text-[#ffeb3b]">
                  نقاطك (الجولة الأخيرة)
                </span>
                <div className="text-3xl sm:text-4xl font-black text-white mt-1">
                  {playerScore.totalScore}
                  <span className="text-xs font-normal text-[var(--gold-light)] ml-1">نقطة</span>
                </div>
                <span className="text-[11px] text-[var(--text-muted)] font-mono">
                  {playerScore.totalCards} ورقة تم جمعها
                </span>
              </div>

              {/* Opponent Score */}
              <div
                className={`p-3.5 sm:p-4 rounded-2xl border text-center ${
                  isCpuWin
                    ? 'bg-[var(--green-surface)] border-[var(--gold)] shadow-lg'
                    : 'bg-[var(--green-surface)]/60 border-[var(--green-border)]'
                }`}
              >
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  نقاط الخصم
                </span>
                <div className="text-3xl sm:text-4xl font-black text-white mt-1">
                  {cpuScore.totalScore}
                  <span className="text-xs font-normal text-[var(--gold-light)] ml-1">نقطة</span>
                </div>
                <span className="text-[11px] text-[var(--text-muted)] font-mono">
                  {cpuScore.totalCards} ورقة تم جمعها
                </span>
              </div>
            </div>

            {/* Detailed Breakdown Comparison */}
            <div className="w-full bg-[var(--green-surface)] rounded-2xl border border-[var(--gold)]/20 p-3 sm:p-4 mb-5 max-h-40 overflow-y-auto space-y-2 text-xs font-mono">
              <div className="flex justify-between items-center text-[#ffeb3b] font-bold border-b border-[var(--gold)]/20 pb-1">
                <span>النتيجة التفصيلية</span>
                <div className="flex gap-6">
                  <span>أنت</span>
                  <span>الخصم</span>
                </div>
              </div>

              <div className="flex justify-between items-center text-[var(--text-main)]">
                <span>👑 المجموعة الذهبية (75 نقطة)</span>
                <div className="flex gap-8">
                  <span>{playerScore.goldenCombos} ({playerScore.goldenPoints})</span>
                  <span>{cpuScore.goldenCombos} ({cpuScore.goldenPoints})</span>
                </div>
              </div>

              <div className="flex justify-between items-center text-[var(--text-main)]">
                <span>🥈 المجموعة الفضية (60 نقطة)</span>
                <div className="flex gap-8">
                  <span>{playerScore.silverCombos} ({playerScore.silverPoints})</span>
                  <span>{cpuScore.silverCombos} ({cpuScore.silverPoints})</span>
                </div>
              </div>

              <div className="flex justify-between items-center text-[var(--text-main)]">
                <span>⚖️ المجموعة الحديدية (50 نقطة)</span>
                <div className="flex gap-8">
                  <span>{playerScore.ironCombos ?? playerScore.balancedCombos ?? 0} ({playerScore.ironPoints ?? playerScore.balancedPoints ?? 0})</span>
                  <span>{cpuScore.ironCombos ?? cpuScore.balancedCombos ?? 0} ({cpuScore.ironPoints ?? cpuScore.balancedPoints ?? 0})</span>
                </div>
              </div>

              <div className="flex justify-between items-center text-[var(--text-main)]">
                <span>✨ المجموعة الثنائية (30 نقطة)</span>
                <div className="flex gap-8">
                  <span>{playerScore.doubleCombos ?? 0} ({playerScore.doublePoints ?? 0})</span>
                  <span>{cpuScore.doubleCombos ?? 0} ({cpuScore.doublePoints ?? 0})</span>
                </div>
              </div>

              <div className="flex justify-between items-center text-[var(--text-main)]">
                <span>🎴 مجموعة الأولاد (36 نقطة)</span>
                <div className="flex gap-8">
                  <span>{playerScore.jackSets} ({playerScore.jackSetPoints})</span>
                  <span>{cpuScore.jackSets} ({cpuScore.jackSetPoints})</span>
                </div>
              </div>

              <div className="flex justify-between items-center text-[var(--text-main)]">
                <span>📚 مجموعة عادية (12 نقطة)</span>
                <div className="flex gap-8">
                  <span>{playerScore.regularSets} ({playerScore.regularSetPoints})</span>
                  <span>{cpuScore.regularSets} ({cpuScore.regularSetPoints})</span>
                </div>
              </div>

              <div className="flex justify-between items-center text-[var(--text-main)]">
                <span>🃏 أولاد فردية (3 نقاط)</span>
                <div className="flex gap-8">
                  <span>{playerScore.remainingJacks} ({playerScore.jackPoints})</span>
                  <span>{cpuScore.remainingJacks} ({cpuScore.jackPoints})</span>
                </div>
              </div>

              <div className="flex justify-between items-center text-[var(--text-main)]">
                <span>🃏 أوراق فردية (نقطة واحدة)</span>
                <div className="flex gap-8">
                  <span>{playerScore.remainingOtherCards} ({playerScore.cardPoints})</span>
                  <span>{cpuScore.remainingOtherCards} ({cpuScore.cardPoints})</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Action Buttons (Play Again + Back to Lobby) */}
        <div className="w-full flex flex-col sm:flex-row items-center gap-2.5">
          <button
            type="button"
            onClick={onPlayAgain}
            className="w-full flex-1 py-3 px-5 rounded-xl btn-yellow-ref font-bold text-xs sm:text-sm uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw size={16} />
            <span>مباراة جديدة</span>
          </button>

          {onBackToLobby && (
            <button
              type="button"
              onClick={onBackToLobby}
              className="w-full sm:w-auto py-3 px-5 rounded-xl bg-black/40 border border-white/20 text-white hover:text-[#ffeb3b] font-bold text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Home size={16} />
              <span>العودة إلى الردهة</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
