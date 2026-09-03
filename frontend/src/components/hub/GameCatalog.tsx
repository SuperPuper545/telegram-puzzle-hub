import React from 'react';
import { useGameBridge } from '../../context/GameContext';
import { Play, Sparkles, Grid, Gem, Layers } from 'lucide-react';
import { haptics } from '../../telegram/telegram';

export const GameCatalog: React.FC = () => {
  const { openGame, bestScores } = useGameBridge();

  const games = [
    {
      id: 'blockudoku' as const,
      title: 'Blockudoku',
      subtitle: 'Блокудоку 9x9',
      description: 'Размещай фигуры, очищай линии и квадраты 3x3. Казуальная классика с комбо-очками!',
      icon: <Grid className="w-7 h-7 text-indigo-400" />,
      color: 'from-indigo-600/30 via-violet-600/20 to-slate-900',
      borderColor: 'border-indigo-500/40 hover:border-indigo-400',
      glowColor: 'shadow-indigo-500/10',
      badge: 'ТОП Игра 🔥',
      available: true,
      bestScore: bestScores['blockudoku'] || 0,
      tags: ['Головоломка', '9x9', 'Комбо'],
    },
    {
      id: 'match3' as const,
      title: 'Crystal Match-3',
      subtitle: 'Три в ряд',
      description: 'Собирай разноцветные кристаллы 3+ в ряд, вызывай каскадные взрывы и собирай звезды!',
      icon: <Gem className="w-7 h-7 text-pink-400" />,
      color: 'from-pink-600/20 via-rose-600/10 to-slate-900',
      borderColor: 'border-pink-500/30',
      glowColor: 'shadow-pink-500/5',
      badge: 'Скоро 💎',
      available: false,
      bestScore: bestScores['match3'] || 0,
      tags: ['Три в ряд', 'Каскады', 'Кристаллы'],
    },
    {
      id: '2048' as const,
      title: '2048 Classic',
      subtitle: 'Слияние плиток',
      description: 'Сдвигай плитки, объединяй одинаковые числа и доберись до заветной плитки 2048!',
      icon: <Layers className="w-7 h-7 text-amber-400" />,
      color: 'from-amber-600/20 via-orange-600/10 to-slate-900',
      borderColor: 'border-amber-500/30',
      glowColor: 'shadow-amber-500/5',
      badge: 'Скоро ⚡',
      available: false,
      bestScore: bestScores['2048'] || 0,
      tags: ['Логика', 'Свайпы', 'Числа'],
    },
  ];

  return (
    <div className="px-4 py-4 space-y-4 pb-24">
      {/* Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-900/60 via-purple-900/40 to-slate-900 p-4 border border-indigo-500/30 shadow-xl">
        <div className="relative z-10">
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 mb-2">
            <Sparkles className="w-3 h-3 text-indigo-300" /> Игровой сезон #1
          </span>
          <h2 className="text-xl font-extrabold text-white tracking-tight">
            Каталог Головоломок
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-[260px]">
            Тренируй логику, ставь рекорды и поднимайся в глобальном лидерборде!
          </p>
        </div>
        <div className="absolute right-2 -bottom-3 opacity-15 pointer-events-none">
          <Grid className="w-32 h-32 text-indigo-300" />
        </div>
      </div>

      {/* Game cards */}
      <div className="space-y-3.5">
        {games.map((game) => (
          <div
            key={game.id}
            className={`relative rounded-2xl bg-gradient-to-br ${game.color} border ${game.borderColor} p-4 shadow-lg ${game.glowColor} transition-all duration-300 backdrop-blur-sm`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3.5">
                <div className="p-3 rounded-xl bg-slate-800/90 border border-slate-700/60 shadow-inner">
                  {game.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-slate-100">{game.title}</h3>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      {game.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">{game.subtitle}</p>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                    {game.description}
                  </p>
                </div>
              </div>
            </div>

            {/* Tags & Action row */}
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                {game.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-md"
                  >
                    #{tag}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-3">
                {game.bestScore > 0 && (
                  <div className="text-right">
                    <span className="block text-[10px] text-slate-400 font-medium">Рекорд</span>
                    <span className="text-xs font-bold text-amber-300">
                      {game.bestScore.toLocaleString()}
                    </span>
                  </div>
                )}

                {game.available ? (
                  <button
                    onClick={() => {
                      haptics.medium();
                      openGame(game.id);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 active:scale-95 text-white font-bold text-xs shadow-md shadow-indigo-500/25 transition-all"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    Играть
                  </button>
                ) : (
                  <span className="px-3 py-1.5 rounded-xl bg-slate-800/80 text-slate-500 font-semibold text-xs border border-slate-700/40">
                    Скоро
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
