import React from 'react';
import { useGameBridge } from '../../context/GameContext';
import { Trophy, Gamepad2, Share2, Sparkles } from 'lucide-react';
import { haptics, getTelegramWebApp } from '../../telegram/telegram';

export const ProfileTab: React.FC = () => {
  const { user, bestScores, totalGamesPlayed } = useGameBridge();
  const totalScore = Object.values(bestScores).reduce((acc, s) => acc + s, 0);
  const initials = (user.first_name || 'U').slice(0, 2).toUpperCase();

  const handleShare = () => {
    haptics.medium();
    const tg = getTelegramWebApp();
    const shareText = `Я набрал ${totalScore.toLocaleString()} очков в Telegram Puzzle Hub! Попробуй побить мой рекорд! 🎮🏆`;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent('https://t.me/taptaphub_bot')}&text=${encodeURIComponent(shareText)}`;
    
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, '_blank');
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Profile Card */}
      <div className="rounded-3xl bg-tg-secondaryBg border border-slate-800/80 p-5 shadow-lg text-center">
        <div className="w-18 h-18 mx-auto rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 p-[2.5px] shadow-lg shadow-indigo-500/20 mb-3">
          {user.photo_url ? (
            <img
              src={user.photo_url}
              alt=""
              className="w-full h-full object-cover rounded-full"
            />
          ) : (
            <div className="w-full h-full bg-slate-800 rounded-full flex items-center justify-center font-black text-xl text-indigo-300">
              {initials}
            </div>
          )}
        </div>

        <h2 className="text-base font-black text-tg-text">{user.first_name}</h2>
        <p className="text-xs text-tg-hint mt-0.5">
          {user.username ? `@${user.username}` : `ID: ${user.id}`}
        </p>

        <div className="mt-3.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-400/25 text-indigo-300 text-xs font-bold">
          <Sparkles className="w-3.5 h-3.5 text-indigo-300" /> Мастер головоломок
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3.5 rounded-2xl bg-tg-secondaryBg border border-slate-800/80 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/15 text-indigo-400">
            <Gamepad2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-tg-hint font-medium">Сыграно игр</span>
            <p className="text-base font-extrabold text-tg-text">{totalGamesPlayed}</p>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-tg-secondaryBg border border-slate-800/80 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-400">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-tg-hint font-medium">Суммарный счет</span>
            <p className="text-base font-extrabold text-amber-300">{totalScore.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Grouped Records Section */}
      <div className="rounded-2xl bg-tg-secondaryBg border border-slate-800/80 p-4 space-y-2.5">
        <h3 className="text-xs font-bold text-tg-hint uppercase tracking-wider mb-2">
          Личные рекорды
        </h3>

        <div className="space-y-2">
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="flex items-center gap-2.5">
              <span className="text-base">🧩</span>
              <div>
                <p className="text-xs font-bold text-tg-text">Blockudoku</p>
                <span className="text-[10px] text-tg-hint">Сетка 9x9</span>
              </div>
            </div>
            <span className="font-extrabold text-xs text-indigo-400">
              {(bestScores['blockudoku'] || 0).toLocaleString()}
            </span>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/30 border border-slate-800/50 opacity-60">
            <div className="flex items-center gap-2.5">
              <span className="text-base">💎</span>
              <div>
                <p className="text-xs font-bold text-tg-text">Match-3</p>
                <span className="text-[10px] text-tg-hint">Кристаллы</span>
              </div>
            </div>
            <span className="text-xs font-medium text-tg-hint">Скоро</span>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/30 border border-slate-800/50 opacity-60">
            <div className="flex items-center gap-2.5">
              <span className="text-base">⚡</span>
              <div>
                <p className="text-xs font-bold text-tg-text">2048 Classic</p>
                <span className="text-[10px] text-tg-hint">Плитки</span>
              </div>
            </div>
            <span className="text-xs font-medium text-tg-hint">Скоро</span>
          </div>
        </div>
      </div>

      {/* Telegram Share Button */}
      <button
        onClick={handleShare}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl tg-btn-primary font-bold text-sm shadow-lg shadow-indigo-600/30 cursor-pointer"
      >
        <Share2 className="w-4 h-4" />
        Поделиться рекордом с друзьями
      </button>
    </div>
  );
};
