import React, { useState } from 'react';
import { useGameBridge, type GameId } from '../../context/GameContext';
import { Play, Sparkles, Grid, Gem, Layers, Zap, Target, Crown, Swords, Crosshair } from 'lucide-react';
import confetti from 'canvas-confetti';
import { haptics } from '../../telegram/telegram';
import { sound } from '../../utils/sound';
import { DuelLobby } from '../../games/pvp/DuelLobby';
import type { DuelGameType } from '../../games/pvp/types';

type CategoryFilter = 'puzzles' | 'arcade' | 'pvp';

interface CategoryTab {
  id: CategoryFilter;
  title: string;
  emoji: string;
}

export const GameCatalog: React.FC = () => {
  const { openGame, bestScores, isScoreBoosterActive, scoreBoosterRemainingSeconds, activateBooster, coins } = useGameBridge();
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>(() => {
    try {
      const saved = localStorage.getItem('hub_selected_category');
      if (saved === 'puzzles' || saved === 'arcade' || saved === 'pvp') {
        return saved as CategoryFilter;
      }
    } catch {
      // ignore
    }
    return 'puzzles';
  });

  const [selectedPvpGame, setSelectedPvpGame] = useState<DuelGameType | null>(null);
  const [isActivatingBooster, setIsActivatingBooster] = useState<boolean>(false);
  const [boosterError, setBoosterError] = useState<string | null>(null);

  const boosterRemaining = scoreBoosterRemainingSeconds;

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleBuyBooster = async () => {
    sound.playUiTap();
    haptics.selection();
    setIsActivatingBooster(true);
    setBoosterError(null);
    const res = await activateBooster();
    setIsActivatingBooster(false);
    if (!res.success) {
      haptics.error();
      setBoosterError(res.error || 'Не удалось активировать');
      setTimeout(() => setBoosterError(null), 3000);
    } else {
      haptics.success();
      sound.playScore();
      confetti({
        particleCount: 70,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#f59e0b', '#fbbf24', '#f97316'],
      });
    }
  };

  const categories: CategoryTab[] = [
    { id: 'puzzles', title: 'Головоломки', emoji: '🧩' },
    { id: 'arcade', title: 'Аркады', emoji: '⚡' },
    { id: 'pvp', title: 'Дуэли', emoji: '⚔️' },
  ];

  const games: {
    id: GameId | string;
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
    category: CategoryFilter;
    isPvp?: boolean;
    pvpType?: DuelGameType;
  }[] = [
    // ─── Puzzles ──────────────────────────────────────────────────────────
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

    // ─── Arcade ───────────────────────────────────────────────────────────
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

    // ─── Network Duels (PvP) ──────────────────────────────────────────────
    {
      id: 'chess_pvp',
      title: 'Шахматы 1v1',
      subtitle: 'Онлайн блиц со ставками',
      description: 'Интеллектуальная дуэль на шахматной доске в реальном времени. Контроль времени 1м, 3+2 или 15м. Побеждай и забирай банк!',
      icon: <Crown className="w-6 h-6 text-amber-400" />,
      color: 'from-amber-600/20 via-orange-600/10 to-transparent',
      borderColor: 'border-amber-500/30 hover:border-amber-400/50',
      badge: 'Дуэль ♟️',
      available: true,
      bestScore: 0,
      tags: ['Шахматы', 'Таймер', 'Ставки'],
      category: 'pvp',
      isPvp: true,
      pvpType: 'chess',
    },
    {
      id: 'durak_pvp',
      title: 'Дурак Онлайн',
      subtitle: 'Подкидной и Переводной',
      description: 'Легендарная карточная битва на 36 карт один на один. Продумывай ходы, переводи атаки соперника и оставляй его в дураках!',
      icon: <Sparkles className="w-6 h-6 text-rose-400" />,
      color: 'from-rose-600/20 via-pink-600/10 to-transparent',
      borderColor: 'border-rose-500/30 hover:border-rose-400/50',
      badge: 'Хит 🃏',
      available: true,
      bestScore: 0,
      tags: ['Дурак', '36 карт', 'Переводной'],
      category: 'pvp',
      isPvp: true,
      pvpType: 'durak',
    },
    {
      id: 'battleship_pvp',
      title: 'Морской Бой',
      subtitle: 'Тактическая дуэль 10x10',
      description: 'Расставляй эскадру кораблей, вычисляй координаты вражеского флота и топи линкоры соперника на монеты!',
      icon: <Crosshair className="w-6 h-6 text-cyan-400" />,
      color: 'from-cyan-600/20 via-blue-600/10 to-transparent',
      borderColor: 'border-cyan-500/30 hover:border-cyan-400/50',
      badge: 'Флот 🚢',
      available: true,
      bestScore: 0,
      tags: ['Морской бой', '10x10', 'Тактика'],
      category: 'pvp',
      isPvp: true,
      pvpType: 'battleship',
    },
  ];

  const filteredGames = games.filter((g) => g.category === selectedCategory);

  return (
    <div className="p-4 space-y-3.5">
      {/* Clean Casual Category Tabs */}
      <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-black/[0.04] dark:bg-white/[0.05] border border-[var(--tg-theme-section-separator-color)]">
        {categories.map((cat) => {
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => {
                sound.playUiTap();
                haptics.selection();
                setSelectedCategory(cat.id);
                try {
                  localStorage.setItem('hub_selected_category', cat.id);
                } catch {
                  // ignore
                }
              }}
              className={`py-2 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 active:scale-95 ${
                isActive
                  ? 'bg-tg-secondaryBg text-tg-text shadow-sm border border-[var(--tg-theme-section-separator-color)] font-extrabold'
                  : 'text-tg-hint hover:text-tg-text'
              }`}
            >
              <span className="text-sm">{cat.emoji}</span>
              <span>{cat.title}</span>
            </button>
          );
        })}
      </div>

      {/* Score Booster Banner */}
      {isScoreBoosterActive ? (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-500">
              <Zap className="w-4 h-4 fill-amber-500" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-amber-500">Бустер ×2 активен</span>
                <span className="text-[11px] font-bold px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-400 font-mono">
                  {formatSeconds(boosterRemaining)}
                </span>
              </div>
              <p className="text-[11px] text-tg-hint mt-0.5">Очки удваиваются во всех играх</p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-amber-400 bg-black/20 dark:bg-white/10 px-2.5 py-1.5 rounded-xl border border-amber-500/20 shrink-0">
            {formatSeconds(boosterRemaining)}
          </span>
        </div>
      ) : (
        <div className="p-3.5 rounded-2xl bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] hover:border-amber-500/30 transition-colors shadow-sm flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-500">
              <Zap className="w-4 h-4 fill-amber-500" />
            </div>
            <div>
              <p className="text-xs font-bold text-tg-text">Бустер очков ×2</p>
              <p className="text-[11px] text-tg-hint mt-0.5">Удваивает счет на 30 минут</p>
              {boosterError && <p className="text-[11px] text-rose-500 mt-0.5 font-semibold">{boosterError}</p>}
            </div>
          </div>
          <button
            onClick={handleBuyBooster}
            disabled={isActivatingBooster || coins < 500}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-40 text-white font-black text-xs shadow-md shadow-amber-500/20 cursor-pointer active:scale-95 transition-all shrink-0 flex items-center gap-1"
          >
            <span>{isActivatingBooster ? '...' : '500 🪙'}</span>
          </button>
        </div>
      )}

      {/* Grouped Game Cards in Clean Casual Style */}
      <div className="space-y-2.5">
        {filteredGames.map((game) => (
          <div
            key={game.id}
            className="rounded-2xl bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] p-3.5 shadow-sm transition-all hover:border-indigo-500/30"
          >
            <div className="flex items-center justify-between gap-3">
              {/* Left Column: Icon & Info */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-tg-bg border border-[var(--tg-theme-section-separator-color)] flex items-center justify-center text-xl shrink-0 shadow-sm">
                  {game.icon}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-extrabold text-sm text-tg-text truncate">{game.title}</h3>
                    {game.badge && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-tg-hint shrink-0">
                        {game.badge}
                      </span>
                    )}
                    {boosterRemaining > 0 && !game.isPvp && (
                      <span className="px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[9px] font-black shrink-0 animate-pulse">
                        ×2
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-tg-hint truncate">{game.subtitle}</span>
                    {game.bestScore > 0 && !game.isPvp && (
                      <>
                        <span className="text-tg-hint text-xs">•</span>
                        <span className="text-xs font-extrabold text-amber-500 flex items-center gap-0.5 shrink-0">
                          🏆 {game.bestScore.toLocaleString()}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Play / Fight Button */}
              <div className="shrink-0">
                {game.isPvp ? (
                  <button
                    onClick={() => {
                      haptics.medium();
                      sound.playUiTap();
                      setSelectedPvpGame(game.pvpType || 'chess');
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-extrabold text-xs shadow-md shadow-amber-500/20 cursor-pointer active:scale-95 transition-all"
                  >
                    <Swords className="w-3.5 h-3.5" />
                    <span>В бой</span>
                  </button>
                ) : game.available ? (
                  <button
                    onClick={() => {
                      haptics.medium();
                      sound.playUiTap();
                      openGame(game.id as GameId);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl tg-btn-primary font-extrabold text-xs shadow-md shadow-indigo-600/20 cursor-pointer active:scale-95 transition-transform"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Играть</span>
                  </button>
                ) : (
                  <span className="px-3 py-1.5 rounded-xl bg-tg-bg text-tg-hint font-semibold text-xs border border-[var(--tg-theme-section-separator-color)]">
                    Скоро
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Duel Manager & Orchestrator */}
      <DuelLobby
        selectedPvpGame={selectedPvpGame}
        onCloseSetupModal={() => setSelectedPvpGame(null)}
        onOpenSetupModal={(g) => setSelectedPvpGame(g)}
      />
    </div>
  );
};
