import React from 'react';
import { useGameBridge } from '../../context/GameContext';
import { Play, Sparkles, Grid, Gem, Layers } from 'lucide-react';
import { haptics } from '../../telegram/telegram';
import { sound } from '../../utils/sound';

export const GameCatalog: React.FC = () => {
  const { openGame, bestScores } = useGameBridge();

  const games = [
    {
      id: 'blockudoku' as const,
      title: 'Blockudoku',
      subtitle: 'Блокудоку 9x9',
      description: 'Размещай блоки, очищай строки и квадраты 3x3. Казуальная классика с комбо-очками!',
      icon: <Grid className="w-6 h-6 text-indigo-400" />,
      color: 'from-indigo-600/20 via-violet-600/10 to-transparent',
      borderColor: 'border-indigo-500/30 hover:border-indigo-400/50',
      badge: 'Популярно 🔥',
      available: true,
      bestScore: bestScores['blockudoku'] || 0,
      tags: ['Головоломка', '9x9', 'Комбо'],
    },
    {
      id: 'match3' as const,
      title: 'Crystal Match-3',
      subtitle: 'Три в ряд',
      description: 'Собирай разноцветные кристаллы 3+ в ряд, вызывай каскадные взрывы и получай супер-бомбы!',
      icon: <Gem className="w-6 h-6 text-pink-400" />,
      color: 'from-pink-600/20 via-rose-600/10 to-transparent',
      borderColor: 'border-pink-500/30 hover:border-pink-400/50',
      badge: 'Новинка 💎',
      available: true,
      bestScore: bestScores['match3'] || 0,
      tags: ['Три в ряд', 'Каскады', '8x8'],
    },
    {
      id: '2048' as const,
      title: '2048 Classic',
      subtitle: 'Слияние плиток',
      description: 'Сдвигай плитки, объединяй одинаковые числа и доберись до заветной плитки 2048!',
      icon: <Layers className="w-6 h-6 text-amber-400" />,
      color: 'from-amber-600/10 to-transparent',
      borderColor: 'border-slate-800/80',
      badge: 'Скоро ⚡',
      available: false,
      bestScore: bestScores['2048'] || 0,
      tags: ['Логика', 'Свайпы'],
    },
  ];

  return (
    <div className="p-4 space-y-4">
      {/* Featured Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-950/80 via-purple-950/50 to-tg-secondaryBg p-4 border border-indigo-500/25 shadow-lg">
        <div className="relative z-10">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 mb-2">
            <Sparkles className="w-3 h-3 text-indigo-300" /> Сезон #1
          </span>
          <h2 className="text-lg font-black text-tg-text tracking-tight">
            Каталог Головоломок
          </h2>
          <p className="text-xs text-tg-hint mt-1 max-w-[260px] leading-relaxed">
            Выбирай игру, тренируй логику и соревнуйся за первое место в лидерборде!
          </p>
        </div>
        <div className="absolute right-2 -bottom-2 opacity-15 pointer-events-none">
          <Grid className="w-28 h-28 text-indigo-400" />
        </div>
      </div>

      {/* Grouped Game Cards */}
      <div className="space-y-3">
        {games.map((game) => (
          <div
            key={game.id}
            className={`rounded-2xl bg-tg-secondaryBg border ${game.borderColor} p-4 shadow-md transition-all duration-200`}
          >
            <div className="flex items-start gap-3.5">
              {/* Left Column: Icon + Best Score Badge underneath */}
              <div className="flex flex-col items-center gap-1.5 shrink-0 w-12">
                <div className="p-2.5 rounded-xl bg-slate-800/90 border border-slate-700/60 flex items-center justify-center">
                  {game.icon}
                </div>
                {game.bestScore > 0 && (
                  <div className="text-center w-full px-0.5">
                    <span className="block text-[9px] uppercase tracking-wider text-tg-hint leading-none font-semibold mb-0.5">
                      Рекорд
                    </span>
                    <span className="text-[11px] font-black text-amber-300 leading-none">
                      {game.bestScore.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Right Column: Title, Subtitle, Description */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold text-sm text-tg-text truncate">{game.title}</h3>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800/80 text-tg-hint border border-slate-700/50 shrink-0">
                    {game.badge}
                  </span>
                </div>
                <p className="text-[11px] text-tg-hint font-medium mt-0.5">{game.subtitle}</p>
                <p className="text-xs text-slate-300/90 mt-1.5 leading-relaxed">
                  {game.description}
                </p>
              </div>
            </div>

            {/* Bottom Row: Tags on left, Play Button on right */}
            <div className="mt-3.5 pt-3 border-t border-slate-800/70 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                {game.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] text-tg-hint bg-slate-800/60 px-2 py-0.5 rounded-md"
                  >
                    #{tag}
                  </span>
                ))}
              </div>

              {game.available ? (
                <button
                  onClick={() => {
                    haptics.medium();
                    sound.playUiTap();
                    openGame(game.id);
                  }}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl tg-btn-primary font-bold text-xs shadow-md shadow-indigo-600/25 cursor-pointer shrink-0 active:scale-95 transition-transform"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Играть
                </button>
              ) : (
                <span className="px-3 py-1.5 rounded-xl bg-slate-800/60 text-slate-500 font-semibold text-xs border border-slate-700/40 shrink-0">
                  Скоро
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
