import React from 'react';
import { useGameBridge } from '../../context/GameContext';
import { Trophy } from 'lucide-react';

export const HubHeader: React.FC = () => {
  const { user, bestScores } = useGameBridge();
  const totalScore = Object.values(bestScores).reduce((acc, s) => acc + s, 0);

  const initials = (user.first_name || 'U').slice(0, 2).toUpperCase();

  return (
    <header className="px-4 py-3 bg-tg-bg/95 backdrop-blur-md border-b border-slate-800/60 sticky top-0 z-20 shrink-0">
      <div className="flex items-center justify-between">
        {/* User profile avatar & name */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 p-[2px] shadow-md shadow-indigo-500/20">
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
              <h1 className="font-bold text-sm text-tg-text tracking-tight leading-tight">
                {user.first_name}
              </h1>
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <p className="text-[11px] text-tg-hint leading-none mt-0.5">
              {user.username ? `@${user.username}` : 'Игрок TMA'}
            </p>
          </div>
        </div>

        {/* Global score / trophies badge */}
        <div className="flex items-center gap-1.5 bg-tg-secondaryBg border border-amber-500/20 px-3 py-1.5 rounded-full shadow-inner">
          <Trophy className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20" />
          <span className="font-black text-amber-300 text-xs tracking-wide">
            {totalScore.toLocaleString()}
          </span>
        </div>
      </div>
    </header>
  );
};
