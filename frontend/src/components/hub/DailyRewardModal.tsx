import React, { useState } from 'react';
import { useGameBridge } from '../../context/GameContext';
import { X, Check, Lock, Gift, Flame, Sparkles, Coins } from 'lucide-react';
import confetti from 'canvas-confetti';
import { sound } from '../../utils/sound';
import { haptics } from '../../telegram/telegram';

export const DailyRewardModal: React.FC = () => {
  const { 
    isDailyModalOpen, 
    setIsDailyModalOpen, 
    dailyReward, 
    claimDaily 
  } = useGameBridge();
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimedJustNow, setClaimedJustNow] = useState(false);

  if (!isDailyModalOpen) return null;

  const rewards = dailyReward?.rewards || [100, 200, 350, 500, 750, 1000, 2500];
  const currentStreak = dailyReward?.dailyStreak || 0;
  const canClaim = dailyReward?.canClaim ?? false;
  const activeDay = dailyReward?.nextRewardDay || 1;

  const handleClaim = async () => {
    if (!canClaim || isClaiming) return;
    setIsClaiming(true);
    sound.playUiTap();

    try {
      const res = await claimDaily();
      if (res.success) {
        setClaimedJustNow(true);
        haptics.success();
        sound.playRecord();

        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#f59e0b', '#ec4899', '#8b5cf6', '#10b981'],
        });

        setTimeout(() => {
          setIsClaiming(false);
          setTimeout(() => {
            setIsDailyModalOpen(false);
            setClaimedJustNow(false);
          }, 2000);
        }, 500);
      } else {
        setIsClaiming(false);
      }
    } catch {
      setIsClaiming(false);
    }
  };

  const closeModal = () => {
    sound.playUiTap();
    haptics.selection();
    setIsDailyModalOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/80 backdrop-blur-sm animate-fade-in">
      <div 
        className="relative w-full max-w-sm rounded-3xl bg-white dark:bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] p-5 shadow-2xl overflow-hidden text-tg-text"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-500">
              <Flame className="w-5 h-5 fill-amber-500/20" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-tg-text leading-tight">
                Ежедневные награды
              </h2>
              <p className="text-xs text-tg-hint">
                Серия: <span className="font-bold text-amber-500">{currentStreak} дн.</span> подряд
              </p>
            </div>
          </div>

          <button
            onClick={closeModal}
            className="p-1.5 rounded-full text-tg-hint hover:text-tg-text active:scale-95 transition-transform cursor-pointer bg-black/[0.05] dark:bg-tg-bg border border-[var(--tg-theme-section-separator-color)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-tg-hint mb-3.5 leading-relaxed">
          Заходи каждый день без перерыва, чтобы забрать супер-приз на 7-й день! 🎁
        </p>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {rewards.slice(0, 6).map((amount, idx) => {
            const dayNum = idx + 1;
            const isClaimed = canClaim ? dayNum < activeDay : dayNum <= currentStreak;
            const isCurrent = canClaim && dayNum === activeDay;

            return (
              <div
                key={dayNum}
                className={`relative flex flex-col items-center justify-center p-2.5 rounded-2xl border transition-all text-center ${
                  isClaimed
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-500'
                    : isCurrent
                    ? 'bg-amber-500/20 border-amber-400 shadow-lg shadow-amber-500/20 scale-[1.03] text-amber-500 ring-2 ring-amber-400/50'
                    : 'bg-black/[0.04] dark:bg-tg-bg border border-[var(--tg-theme-section-separator-color)] text-tg-hint opacity-60'
                }`}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider mb-1">
                  День {dayNum}
                </span>

                <div className="my-1">
                  {isClaimed ? (
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  ) : isCurrent ? (
                    <div className="w-6 h-6 rounded-full bg-amber-400/20 flex items-center justify-center text-amber-500 animate-pulse">
                      <Coins className="w-4 h-4" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-black/[0.06] dark:bg-tg-secondaryBg flex items-center justify-center text-tg-hint">
                      <Lock className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>

                <span className="text-xs font-black">
                  +{amount} 🪙
                </span>
              </div>
            );
          })}
        </div>

        {(() => {
          const day7Amount = rewards[6] || 2500;
          const isDay7Claimed = canClaim ? activeDay > 7 : currentStreak >= 7;
          const isDay7Current = canClaim && activeDay === 7;

          return (
            <div
              className={`relative mb-5 flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                isDay7Claimed
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-500'
                  : isDay7Current
                  ? 'bg-gradient-to-r from-amber-500/20 via-pink-500/20 to-purple-500/20 border-amber-400 shadow-xl shadow-amber-500/20 ring-2 ring-amber-400/60'
                  : 'bg-black/[0.04] dark:bg-tg-bg border border-[var(--tg-theme-section-separator-color)] text-tg-hint opacity-75'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${
                  isDay7Current 
                    ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/40 animate-bounce' 
                    : isDay7Claimed
                    ? 'bg-emerald-500/20 text-emerald-500'
                    : 'bg-black/[0.06] dark:bg-tg-secondaryBg text-amber-500 border border-[var(--tg-theme-section-separator-color)]'
                }`}>
                  <Gift className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-amber-500">
                      ДЕНЬ 7: СУПЕР-ПРИЗ!
                    </span>
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  </div>
                  <p className="text-[11px] text-tg-hint">Главный джекпот недели</p>
                </div>
              </div>

              <div className="text-right">
                {isDay7Claimed ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-500">
                    <Check className="w-3.5 h-3.5" /> Забрано
                  </span>
                ) : (
                  <span className="text-sm font-black text-amber-500">
                    +{day7Amount.toLocaleString()} 🪙
                  </span>
                )}
              </div>
            </div>
          );
        })()}

        {claimedJustNow ? (
          <div className="w-full py-3.5 px-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-black text-center text-sm flex items-center justify-center gap-2">
            <Check className="w-4 h-4 stroke-[3]" /> Награда получена! Отличная серия!
          </div>
        ) : canClaim ? (
          <button
            onClick={handleClaim}
            disabled={isClaiming}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white font-black text-sm shadow-xl shadow-amber-500/30 hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            {isClaiming ? 'Забираем...' : `Забрать награду (+${dailyReward?.nextReward || 100} 🪙)`}
          </button>
        ) : (
          <button
            onClick={closeModal}
            className="w-full py-3 px-4 rounded-2xl bg-white/5 border border-white/10 text-tg-hint font-bold text-xs hover:bg-white/10 active:scale-98 transition-all cursor-pointer"
          >
            Сегодня уже забрано. Возвращайся завтра!
          </button>
        )}
      </div>
    </div>
  );
};
