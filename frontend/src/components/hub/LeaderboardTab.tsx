import React, { useEffect, useState } from 'react';
import { useGameBridge, type GameId } from '../../context/GameContext';
import { Trophy, Crown, RefreshCw } from 'lucide-react';
import { haptics } from '../../telegram/telegram';

export const LeaderboardTab: React.FC = () => {
  const { leaderboards, fetchLeaderboard, isLoadingLeaderboard, user } = useGameBridge();
  const [selectedGame, setSelectedGame] = useState<GameId>('blockudoku');

  useEffect(() => {
    fetchLeaderboard(selectedGame);
  }, [selectedGame, fetchLeaderboard]);

  const list = leaderboards[selectedGame] || [];
  const top1 = list[0];
  const top2 = list[1];
  const top3 = list[2];
  const rest = list.slice(3);

  const gameNames: { id: GameId; label: string }[] = [
    { id: 'blockudoku', label: '🧩 Блокудоку' },
    { id: 'match3', label: '💎 3 в ряд' },
    { id: '2048', label: '🔢 2048' },
    { id: 'flappy', label: '🕊️ Flappy' },
    { id: 'stack', label: '🏗️ Stack' },
    { id: 'knife', label: '🗡️ Knife' },
  ];

  return (
    <div className="p-4 space-y-4">
      {/* Leaderboard Header with title and refresh */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h2 className="text-lg font-black text-tg-text tracking-tight flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400 fill-amber-400/20" />
            Таблица лидеров
          </h2>
          <p className="text-xs text-tg-hint mt-0.5">Лучшие игроки игрового сезона</p>
        </div>

        <button
          onClick={() => {
            haptics.light();
            fetchLeaderboard(selectedGame);
          }}
          disabled={isLoadingLeaderboard}
          className="p-2.5 bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] rounded-xl text-tg-hint hover:text-tg-text active:scale-95 transition-transform cursor-pointer"
          title="Обновить"
        >
          <RefreshCw className={`w-4 h-4 ${isLoadingLeaderboard ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Telegram Segmented Control (2x3 Grid for 6 games) */}
      <div className="grid grid-cols-3 gap-1 p-1 bg-tg-secondaryBg rounded-2xl border border-[var(--tg-theme-section-separator-color)]">
        {gameNames.map((g) => {
          const isActive = selectedGame === g.id;
          return (
            <button
              key={g.id}
              onClick={() => {
                haptics.selection();
                setSelectedGame(g.id);
              }}
              className={`py-1.5 px-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer truncate ${
                isActive
                  ? 'tg-btn-primary shadow-sm'
                  : 'text-tg-hint hover:text-tg-text'
              }`}
            >
              {g.label}
            </button>
          );
        })}
      </div>

      {list.length === 0 && !isLoadingLeaderboard ? (
        <div className="p-8 text-center rounded-2xl bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] shadow-sm">
          <Trophy className="w-10 h-10 mx-auto text-tg-hint mb-2 opacity-50" />
          <p className="font-semibold text-tg-text text-sm">Пока нет рекордов</p>
          <p className="text-xs text-tg-hint mt-1">
            Сыграй первую партию и займи 1 место в топе!
          </p>
        </div>
      ) : (
        <>
          {/* Top 3 Podium */}
          {top1 && (
            <div className="pt-7 pb-2">
              <div className="flex items-end justify-center gap-2">
                {/* 2nd Place */}
                <div className="flex-1 flex flex-col items-center">
                  {top2 ? (
                    <>
                      <div className="relative mb-2">
                        <div className="w-12 h-12 rounded-full bg-slate-300 p-[2px] shadow-md">
                          <div className="w-full h-full bg-tg-bg rounded-full flex items-center justify-center font-bold text-tg-text text-xs overflow-hidden border border-[var(--tg-theme-section-separator-color)]">
                            {top2.photoUrl ? (
                              <img src={top2.photoUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              (top2.firstName || 'U')[0]
                            )}
                          </div>
                        </div>
                        <div className="absolute -top-1.5 -right-1 bg-slate-400 text-slate-950 text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-tg-secondaryBg">
                          2
                        </div>
                      </div>
                      <span className="text-xs font-bold text-tg-text truncate max-w-[80px]">
                        {top2.firstName}
                      </span>
                      <span className="text-[11px] font-extrabold text-tg-hint">
                        {top2.highScore.toLocaleString()}
                      </span>
                    </>
                  ) : (
                    <div className="h-16" />
                  )}
                  <div className="w-full h-14 bg-gradient-to-t from-tg-bg to-tg-secondaryBg/50 rounded-t-xl border-t border-[var(--tg-theme-section-separator-color)] flex items-center justify-center text-tg-hint font-black text-sm">
                    2
                  </div>
                </div>

                {/* 1st Place */}
                <div className="flex-1 flex flex-col items-center">
                  <div className="relative mb-2">
                    <Crown className="w-5 h-5 text-amber-500 absolute -top-5 left-1/2 -translate-x-1/2 drop-shadow-sm" />
                    <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-300 p-[2px] shadow-lg shadow-amber-500/20">
                      <div className="w-full h-full bg-tg-bg rounded-full flex items-center justify-center font-black text-amber-500 text-sm overflow-hidden border border-[var(--tg-theme-section-separator-color)]">
                        {top1.photoUrl ? (
                          <img src={top1.photoUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          (top1.firstName || 'U')[0]
                        )}
                      </div>
                    </div>
                    <div className="absolute -top-1.5 -right-1 bg-amber-400 text-slate-950 text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-tg-secondaryBg">
                      1
                    </div>
                  </div>
                  <span className="text-xs font-bold text-amber-500 truncate max-w-[90px]">
                    {top1.firstName}
                  </span>
                  <span className="text-xs font-black text-amber-500">
                    {top1.highScore.toLocaleString()}
                  </span>
                  <div className="w-full h-20 bg-gradient-to-t from-amber-500/20 via-amber-500/10 to-transparent rounded-t-xl border-t-2 border-amber-400 flex items-center justify-center text-amber-500 font-black text-base shadow-sm">
                    👑 1
                  </div>
                </div>

                {/* 3rd Place */}
                <div className="flex-1 flex flex-col items-center">
                  {top3 ? (
                    <>
                      <div className="relative mb-2">
                        <div className="w-12 h-12 rounded-full bg-amber-600 p-[2px] shadow-md">
                          <div className="w-full h-full bg-tg-bg rounded-full flex items-center justify-center font-bold text-amber-600 text-xs overflow-hidden border border-[var(--tg-theme-section-separator-color)]">
                            {top3.photoUrl ? (
                              <img src={top3.photoUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              (top3.firstName || 'U')[0]
                            )}
                          </div>
                        </div>
                        <div className="absolute -top-1.5 -right-1 bg-amber-700 text-slate-100 text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-tg-secondaryBg">
                          3
                        </div>
                      </div>
                      <span className="text-xs font-bold text-tg-text truncate max-w-[80px]">
                        {top3.firstName}
                      </span>
                      <span className="text-[11px] font-extrabold text-amber-600">
                        {top3.highScore.toLocaleString()}
                      </span>
                    </>
                  ) : (
                    <div className="h-16" />
                  )}
                  <div className="w-full h-11 bg-gradient-to-t from-tg-bg to-tg-secondaryBg/40 rounded-t-xl border-t border-amber-700/30 flex items-center justify-center text-amber-700 font-black text-sm">
                    3
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Ranks 4+ in Telegram List Style */}
          {rest.length > 0 && (
            <div className="rounded-2xl bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] divide-y divide-[var(--tg-theme-section-separator-color)] overflow-hidden shadow-sm">
              {rest.map((entry) => {
                const isCurrentUser = String(entry.telegramId) === String(user.id);
                return (
                  <div
                    key={entry.userId}
                    className={`flex items-center justify-between px-3.5 py-2.5 transition-colors ${
                      isCurrentUser ? 'bg-indigo-500/10 border-l-4 border-l-indigo-500' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-5 text-center font-bold text-xs text-tg-hint">
                        {entry.rank}
                      </span>
                      <div className="w-8 h-8 rounded-full bg-tg-bg flex items-center justify-center font-bold text-xs text-tg-hint overflow-hidden border border-[var(--tg-theme-section-separator-color)]">
                        {entry.photoUrl ? (
                          <img src={entry.photoUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          (entry.firstName || 'U')[0]
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="font-semibold text-xs text-tg-text leading-tight">
                            {entry.firstName} {isCurrentUser && ' (Вы)'}
                          </p>
                        </div>
                        {entry.username && (
                          <p className="text-[10px] text-tg-hint">@{entry.username}</p>
                        )}
                      </div>
                    </div>
                    <span className="font-black text-xs text-indigo-400">
                      {entry.highScore.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};
