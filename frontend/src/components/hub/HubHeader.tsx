import React from 'react';
import { useGameBridge } from '../../context/GameContext';
import { Trophy } from 'lucide-react';

export const HubHeader: React.FC = () => {
  const { user, bestScores } = useGameBridge();
  const totalScore = Object.values(bestScores).reduce((acc, s) => acc + s, 0);

  const initials = (user.first_name || 'U').slice(0, 2).toUpperCase();

  return (
    <header className="px-4 pt-3 pb-4 bg-gradient-to-b from-slate-900/90 to-slate-900/40 backdrop-blur border-b border-slate-800/60 sticky top-0 z-20">
      <div className="flex items-center justify-between">
        {/* User profile avatar & name */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-400 p-[2px] shadow-lg shadow-indigo-500/20">
            {user.photo_url ? (
              <img
                src={user.photo_url}
                alt={user.first_name}
                className="w-full h-full object-cover rounded-[14px]"
              />
            ) : (
              <div className="w-full h-full bg-slate-800 rounded-[14px] flex items-center justify-center font-bold text-indigo-300 text-sm">
                {initials}
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-bold text-base text-slate-100 tracking-tight leading-none">
                {user.first_name}
              </h1>
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {user.username ? `@${user.username}` : 'Игрок TMA'}
            </p>
          </div>
        </div>

        {/* Global score / trophies badge */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-800/90 border border-amber-500/30 px-3 py-1.5 rounded-xl shadow-inner">
            <Trophy className="w-4 h-4 text-amber-400 fill-amber-400/20" />
            <span className="font-extrabold text-amber-300 text-sm tracking-wide">
              {totalScore.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
