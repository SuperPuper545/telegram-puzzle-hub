import React from 'react';
import { useGameBridge } from '../../context/GameContext';
import { Swords, X, CheckCircle2 } from 'lucide-react';

interface ChallengeBannerProps {
  currentScore: number;
}

export const ChallengeBanner: React.FC<ChallengeBannerProps> = ({ currentScore }) => {
  const { activeChallenge, dismissChallenge, isChallengeCompleted } = useGameBridge();

  if (!activeChallenge) return null;

  const isBeaten = currentScore > activeChallenge.targetScore || isChallengeCompleted;

  return (
    <div className={`w-full px-3 py-2 border-b backdrop-blur-md transition-all shadow-md flex items-center justify-between z-30 ${
      isBeaten
        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 animate-pulse'
        : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
    }`}>
      <div className="flex items-center gap-2 min-w-0">
        {isBeaten ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
        ) : (
          <Swords className="w-4 h-4 text-amber-400 shrink-0 animate-bounce" />
        )}
        <div className="min-w-0">
          <p className="text-[11px] font-black truncate">
            {isBeaten
              ? `🏆 Вызов выполнен! Рекорд ${activeChallenge.targetScore.toLocaleString()} побит (+150 🪙)`
              : `⚔️ Вызов от ${activeChallenge.challengerName || 'друга'}: цель ${activeChallenge.targetScore.toLocaleString()} очков`}
          </p>
          {!isBeaten && (
            <p className="text-[9px] opacity-80 truncate">
              Осталось: {Math.max(0, activeChallenge.targetScore - currentScore + 1).toLocaleString()} очков • Награда: +150 🪙
            </p>
          )}
        </div>
      </div>

      <button
        onClick={dismissChallenge}
        className="p-1 rounded-lg text-white/50 hover:text-white active:scale-95 cursor-pointer shrink-0 ml-2"
        title="Скрыть вызов"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
