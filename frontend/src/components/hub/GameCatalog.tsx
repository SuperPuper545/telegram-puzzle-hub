import React, { useState } from 'react';
import { useGameBridge, type GameId } from '../../context/GameContext';
import { Play, Sparkles, Grid, Gem, Layers, Zap, Target, Flame } from 'lucide-react';
import { haptics } from '../../telegram/telegram';
import { sound } from '../../utils/sound';

type CategoryFilter = 'all' | 'puzzles' | 'arcade' | 'pvp';

export const GameCatalog: React.FC = () => {
  const { openGame, bestScores } = useGameBridge();
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');

  const games: {
    id: GameId;
    title: string;
    subtitle: string;
    description: string;
    icon: React.ReactNode;
    color: string;
    borderColor: string;
    badge: string;
    available: boolean;
    bestScore: number;
    tags: string[];
    category: 'puzzles' | 'arcade' | 'pvp';
  }[] = [
    {
      id: 'blockudoku',
      title: 'Blockudoku',
      subtitle: 'Блокудоку 9x9',
      description: 'Размещай блоки, очищай строки и квадраты 3x3. Казуальная классика с комбо-очками!',
      icon: <Grid className="w-6 h-6 text-indigo-400" />,
      color: 'from-indigo-600/20 via-violet-600/10 to-transparent',
      borderColor: 'border-indigo-500/30 hover:border-indigo-400/50',
      badge: 'Хит 🔥',
      available: true,
      bestScore: bestScores['blockudoku'] || 0,
      tags: ['Головоломка', '9x9', 'Комбо'],
      category: 'puzzles',
    },
    {
      id: 'match3',
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
      category: 'puzzles',
    },
    {
      id: '2048',
      title: '2048 Classic',
      subtitle: 'Слияние плиток',
      description: 'Сдвигай плитки, объединяй одинаковые числа и доберись до заветной плитки 2048!',
      icon: <Layers className="w-6 h-6 text-amber-400" />,
      color: 'from-amber-600/20 via-yellow-600/10 to-transparent',
      borderColor: 'border-amber-500/30 hover:border-amber-400/50',
      badge: 'Классика ⚡',
      available: true,
      bestScore: bestScores['2048'] || 0,
      tags: ['Логика', 'Свайпы', '4x4'],
      category: 'puzzles',
    },
    {
      id: 'flappy',
      title: 'Flappy Hub',
      subtitle: 'Птичий полёт',
      description: 'Тапай по экрану, держи высоту и пролетай сквозь трубы. Собирай золотые монетки на лету!',
      icon: <Zap className="w-6 h-6 text-emerald-400" />,
      color: 'from-emerald-600/20 via-teal-600/10 to-transparent',
      borderColor: 'border-emerald-500/30 hover:border-emerald-400/50',
      badge: 'Аркада 🕊️',
      available: true,
      bestScore: bestScores['flappy'] || 0,
      tags: ['Аркада', 'Тап', 'Реакция'],
      category: 'arcade',
    },
    {
      id: 'stack',
      title: 'Tower Stack',
      subtitle: 'Строитель башни',
      description: 'Ставь блоки точно вовремя! Срезай лишние края и возводи самую высокую башню.',
      icon: <Layers className="w-6 h-6 text-cyan-400" />,
      color: 'from-cyan-600/20 via-blue-600/10 to-transparent',
      borderColor: 'border-cyan-500/30 hover:border-cyan-400/50',
      badge: 'Тайминг 🏗️',
      available: true,
      bestScore: bestScores['stack'] || 0,
      tags: ['Башня', 'Комбо', 'Тайминг'],
      category: 'arcade',
    },
    {
      id: 'knife',
      title: 'Knife Master',
      subtitle: 'Метание клинков',
      description: 'Метко вонзай ножи во вращающуюся мишень. Не задень другие клинки и побеждай боссов!',
      icon: <Target className="w-6 h-6 text-rose-400" />,
      color: 'from-rose-600/20 via-red-600/10 to-transparent',
      borderColor: 'border-rose-500/30 hover:border-rose-400/50',
      badge: 'Драйв 🗡️',
      available: true,
      bestScore: bestScores['knife'] || 0,
      tags: ['Точность', 'Боссы', 'Реакция'],
      category: 'arcade',
    },
  ];

  const filteredGames = games.filter((g) => {
    if (selectedCategory === 'all') return true;
    return g.category === selectedCategory;
  });

  return (
    <div className="p-4 space-y-4">
      {/* Featured Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-500/15 via-purple-500/10 to-tg-secondaryBg p-4 border border-indigo-500/25 shadow-md">
        <div className="relative z-10">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-400/30 mb-2">
            <Sparkles className="w-3 h-3 text-indigo-400" /> Игровой Каталог #1
          </span>
          <h2 className="text-lg font-black text-tg-text tracking-tight">
            Каталог Игр TapTap Hub
          </h2>
          <p className="text-xs text-tg-hint mt-1 max-w-[260px] leading-relaxed">
            Головоломки, скоростные аркады и сетевые дуэли за монеты в одном месте!
          </p>
        </div>
        <div className="absolute right-2 -bottom-2 opacity-15 pointer-events-none">
          <Flame className="w-28 h-28 text-indigo-400" />
        </div>
      </div>

      {/* Category Segmented Filter */}
      <div className="flex items-center gap-1 p-1 rounded-2xl bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] shadow-sm">
        <button
          onClick={() => {
            sound.playUiTap();
            haptics.selection();
            setSelectedCategory('all');
          }}
          className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            selectedCategory === 'all'
              ? 'tg-btn-primary shadow-sm'
              : 'text-tg-hint hover:text-tg-text'
          }`}
        >
          Все ({games.length})
        </button>
        <button
          onClick={() => {
            sound.playUiTap();
            haptics.selection();
            setSelectedCategory('puzzles');
          }}
          className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            selectedCategory === 'puzzles'
              ? 'tg-btn-primary shadow-sm'
              : 'text-tg-hint hover:text-tg-text'
          }`}
        >
          🧩 Логика
        </button>
        <button
          onClick={() => {
            sound.playUiTap();
            haptics.selection();
            setSelectedCategory('arcade');
          }}
          className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            selectedCategory === 'arcade'
              ? 'tg-btn-primary shadow-sm'
              : 'text-tg-hint hover:text-tg-text'
          }`}
        >
          ⚡ Аркады
        </button>
        <button
          onClick={() => {
            sound.playUiTap();
            haptics.selection();
            setSelectedCategory('pvp');
          }}
          className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            selectedCategory === 'pvp'
              ? 'tg-btn-primary shadow-sm'
              : 'text-tg-hint hover:text-tg-text'
          }`}
        >
          ⚔️ PvP
        </button>
      </div>

      {/* Grouped Game Cards */}
      <div className="space-y-3">
        {selectedCategory === 'pvp' ? (
          <div className="p-8 text-center rounded-2xl bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] shadow-sm space-y-2">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center text-2xl">
              ⚔️
            </div>
            <h3 className="font-extrabold text-tg-text text-sm">Сетевые Дуэли со ставками</h3>
            <p className="text-xs text-tg-hint max-w-xs mx-auto leading-relaxed">
              Шахматы онлайн, Подкидной дурак и Морской бой на подходе! Готовься к игре со ставками.
            </p>
          </div>
        ) : (
          filteredGames.map((game) => (
          <div
            key={game.id}
            className={`rounded-2xl bg-tg-secondaryBg border ${game.borderColor} p-4 shadow-sm transition-all duration-200`}
          >
            <div className="flex items-start gap-3.5">
              {/* Left Column: Icon + Best Score Badge underneath */}
              <div className="flex flex-col items-center gap-1.5 shrink-0 w-12">
                <div className="p-2.5 rounded-xl bg-tg-bg border border-[var(--tg-theme-section-separator-color)] flex items-center justify-center shadow-inner">
                  {game.icon}
                </div>
                {game.bestScore > 0 && (
                  <div className="text-center w-full px-0.5">
                    <span className="block text-[9px] uppercase tracking-wider text-tg-hint leading-none font-semibold mb-0.5">
                      Рекорд
                    </span>
                    <span className="text-[11px] font-black text-amber-500 leading-none">
                      {game.bestScore.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Right Column: Title, Subtitle, Description */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold text-sm text-tg-text truncate">{game.title}</h3>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-tg-bg text-tg-hint border border-[var(--tg-theme-section-separator-color)] shrink-0">
                    {game.badge}
                  </span>
                </div>
                <p className="text-[11px] text-tg-hint font-medium mt-0.5">{game.subtitle}</p>
                <p className="text-xs text-tg-hint mt-1.5 leading-relaxed">
                  {game.description}
                </p>
              </div>
            </div>

            {/* Bottom Row: Tags on left, Play Button on right */}
            <div className="mt-3.5 pt-3 border-t border-[var(--tg-theme-section-separator-color)] flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                {game.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] text-tg-hint bg-tg-bg border border-[var(--tg-theme-section-separator-color)] px-2 py-0.5 rounded-md"
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
                <span className="px-3 py-1.5 rounded-xl bg-tg-bg text-tg-hint font-semibold text-xs border border-[var(--tg-theme-section-separator-color)] shrink-0">
                  Скоро
                </span>
              )}
            </div>
          </div>
        )))}
      </div>
    </div>
  );
};
