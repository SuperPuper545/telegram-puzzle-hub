import React from 'react';
import { useGameBridge } from '../../context/GameContext';
import { Flame, Coins } from 'lucide-react';
import { sound } from '../../utils/sound';
import { haptics } from '../../telegram/telegram';

export const HubHeader: React.FC = () => {
  const { user, coins, dailyStreak, dailyReward, setIsDailyModalOpen } = useGameBridge();
  const initials = (user.first_name || 'U').slice(0, 2).toUpperCase();
  const canClaim = dailyReward?.canClaim ?? false;

  const handleOpenDaily = () => {
    sound.playUiTap();
    haptics.selection();
    setIsDailyModalOpen(true);
  };

  return (
    <header className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-md z-30 h-[56px] px-4 bg-tg-bg/95 backdrop-blur-md border-b border-[var(--tg-theme-section-separator-color)] shadow-sm flex items-center">
      <div className="w-full flex items-center justify-between">
        {/* User profile avatar & name */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 p-[2px] shadow-md shadow-indigo-500/20 shrink-0">
            {user.photo_url ? (
              <img
                src={user.photo_url}
                alt={user.first_name}
                className="w-full h-full object-cover rounded-full"
              />
            ) : (
              <div className="w-full h-full bg-tg-secondaryBg rounded-full flex items-center justify-center font-bold text-indigo-300 text-xs">
                {initials}
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-bold text-xs text-tg-text tracking-tight leading-tight truncate max-w-[110px]">
                {user.first_name}
              </h1>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <p className="text-[10px] text-tg-hint leading-none mt-0.5 truncate max-w-[110px]">
              {user.username ? `@${user.username}` : 'Игрок TMA'}
            </p>
          </div>
        </div>

        {/* Action Widgets: Daily Streak & Coins */}
        <div className="flex items-center gap-2">
          {/* Daily Streak Trigger */}
          <button
            onClick={handleOpenDaily}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer ${
              canClaim
                ? 'bg-amber-500/20 border border-amber-400 text-amber-300 animate-pulse shadow-md shadow-amber-500/20'
                : 'bg-tg-secondaryBg border border-white/5 text-tg-hint hover:text-tg-text'
            }`}
            title="Ежедневные награды"
          >
            <Flame className={`w-3.5 h-3.5 ${canClaim ? 'text-amber-400 fill-amber-400/40' : 'text-orange-400'}`} />
            <span>{canClaim ? 'Награда!' : `${dailyStreak} дн.`}</span>
          </button>

          {/* Coins Badge */}
          <div className="flex items-center gap-1.5 bg-tg-secondaryBg border border-amber-500/25 px-2.5 py-1.5 rounded-full shadow-inner">
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-black text-amber-300 text-xs tracking-tight">
              {coins.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};

