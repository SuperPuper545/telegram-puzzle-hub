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
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent('https://t.me/')}&text=${encodeURIComponent(shareText)}`;
    
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, '_blank');
    }
  };

  return (
    <div className="px-4 py-4 space-y-4 pb-24">
      {/* Profile Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-indigo-950/60 via-slate-900 to-slate-900 border border-indigo-500/30 p-5 shadow-xl text-center">
        <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 p-[3px] shadow-lg shadow-indigo-500/25 mb-3">
          {user.photo_url ? (
            <img
              src={user.photo_url}
              alt=""
              className="w-full h-full object-cover rounded-[21px]"
            />
          ) : (
            <div className="w-full h-full bg-slate-800 rounded-[21px] flex items-center justify-center font-black text-2xl text-indigo-300">
              {initials}
            </div>
          )}
        </div>

        <h2 className="text-lg font-black text-slate-100">{user.first_name}</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          {user.username ? `@${user.username}` : `ID: ${user.id}`}
        </p>

        <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-bold">
          <Sparkles className="w-3.5 h-3.5 text-indigo-300" /> Мастер головоломок
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/15 text-indigo-400">
            <Gamepad2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-medium">Сыграно игр</span>
            <p className="text-base font-extrabold text-slate-100">{totalGamesPlayed}</p>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-400">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-medium">Суммарный счет</span>
            <p className="text-base font-extrabold text-amber-300">{totalScore.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Game records breakdown */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 space-y-3">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
          Личные рекорды
        </h3>

        <div className="space-y-2.5">
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
            <div className="flex items-center gap-2.5">
              <span className="text-base">🧩</span>
              <div>
                <p className="text-xs font-bold text-slate-200">Blockudoku</p>
                <span className="text-[10px] text-slate-400">Сетка 9x9</span>
              </div>
            </div>
            <span className="font-extrabold text-xs text-indigo-300">
              {(bestScores['blockudoku'] || 0).toLocaleString()}
            </span>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/30 opacity-70">
            <div className="flex items-center gap-2.5">
              <span className="text-base">💎</span>
              <div>
                <p className="text-xs font-bold text-slate-300">Match-3</p>
                <span className="text-[10px] text-slate-400">Кристаллы</span>
              </div>
            </div>
            <span className="text-xs font-medium text-slate-500">Скоро</span>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/30 opacity-70">
            <div className="flex items-center gap-2.5">
              <span className="text-base">⚡</span>
              <div>
                <p className="text-xs font-bold text-slate-300">2048 Classic</p>
                <span className="text-[10px] text-slate-400">Плитки</span>
              </div>
            </div>
            <span className="text-xs font-medium text-slate-500">Скоро</span>
          </div>
        </div>
      </div>

      {/* Share / Invite Friends button */}
      <button
        onClick={handleShare}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 active:scale-98 transition-all"
      >
        <Share2 className="w-4 h-4" />
        Поделиться рекордом с друзьями
      </button>
    </div>
  );
};
