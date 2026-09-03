import React, { useState, useRef, useEffect } from 'react';
import { useGameBridge } from '../../context/GameContext';
import { useMatch3 } from './useMatch3';
import { GEM_DEFINITIONS, GEM_TYPES_COUNT } from './gemData';
import { MATCH3_SIZE } from './match3Logic';
import { sound } from '../../utils/sound';
import { haptics } from '../../telegram/telegram';
import confetti from 'canvas-confetti';
import {
  ArrowLeft,
  RotateCcw,
  Trophy,
  Sparkles,
  Volume2,
  VolumeX,
  Zap,
  CheckCircle2,
} from 'lucide-react';

export const Match3Game: React.FC = () => {
  const { closeGame, bestScores, submitScore } = useGameBridge();
  const currentBest = bestScores['match3'] || 0;

  const {
    board,
    score,
    bestScore,
    movesLeft,
    isBusy,
    isGameOver,
    selectedGem,
    clearingKeys,
    lastScorePopup,
    setSelectedGem,
    trySwap,
    finishGameEarly,
    restartGame,
  } = useMatch3(currentBest);

  const [isMuted, setIsMuted] = useState(() => sound.isMuted());
  const [isNewRecord, setIsNewRecord] = useState(false);
  const touchStartRef = useRef<{ row: number; col: number; x: number; y: number } | null>(null);
  const hasSubmittedRef = useRef(false);

  const toggleSound = () => {
    const next = sound.toggleMute();
    setIsMuted(next);
  };

  // Submit score on game over (EXACTLY ONCE)
  useEffect(() => {
    if (isGameOver && score > 0 && !hasSubmittedRef.current) {
      hasSubmittedRef.current = true;
      sound.playGameOver();
      haptics.warning();
      submitScore('match3', score).then((res) => {
        if (res.isNewRecord) {
          setIsNewRecord(true);
          sound.playRecord();
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 },
          });
        }
      });
    }
  }, [isGameOver, score, submitScore]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedGem) {
          setSelectedGem(null);
        } else {
          sound.playUiTap();
          closeGame();
        }
      } else if (e.key === 'r' || e.key === 'R') {
        handleRestart();
      } else if (e.key === 'm' || e.key === 'M') {
        toggleSound();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedGem, closeGame]);

  const handleRestart = () => {
    haptics.medium();
    sound.playUiTap();
    setIsNewRecord(false);
    hasSubmittedRef.current = false;
    restartGame();
  };

  const handleFinishEarly = () => {
    if (score === 0) return;
    haptics.medium();
    sound.playUiTap();
    finishGameEarly();
  };

  // Click on gem
  const handleCellClick = (r: number, c: number) => {
    if (isBusy || isGameOver) return;

    if (!selectedGem) {
      setSelectedGem({ row: r, col: c });
      sound.playPickup();
      haptics.selection();
    } else {
      if (selectedGem.row === r && selectedGem.col === c) {
        setSelectedGem(null);
      } else {
        trySwap(selectedGem, { row: r, col: c });
      }
    }
  };

  // Touch Swipe Handlers
  const handleTouchStart = (r: number, c: number, e: React.TouchEvent) => {
    if (isBusy || isGameOver) return;
    const touch = e.touches[0];
    touchStartRef.current = { row: r, col: c, x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || isBusy || isGameOver) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const { row, col } = touchStartRef.current;
    touchStartRef.current = null;

    const threshold = 25;
    if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
      if (Math.abs(dx) > Math.abs(dy)) {
        const targetCol = dx > 0 ? col + 1 : col - 1;
        if (targetCol >= 0 && targetCol < MATCH3_SIZE) {
          trySwap({ row, col }, { row, col: targetCol });
        }
      } else {
        const targetRow = dy > 0 ? row + 1 : row - 1;
        if (targetRow >= 0 && targetRow < MATCH3_SIZE) {
          trySwap({ row, col }, { row: targetRow, col });
        }
      }
    }
  };

  return (
    <div className="w-full h-full min-h-[100dvh] max-h-[100dvh] overflow-hidden flex flex-col justify-between bg-tg-bg text-tg-text select-none game-viewport-lock">
      {/* 1. Fixed Header (h-14) */}
      <header className="h-14 shrink-0 px-4 flex items-center justify-between border-b border-[var(--tg-theme-section-separator-color)] bg-tg-secondaryBg/90 backdrop-blur-md z-10">
        <button
          onClick={() => {
            sound.playUiTap();
            closeGame();
          }}
          className="p-2 -ml-2 rounded-xl text-tg-hint hover:text-tg-text active:scale-95 transition-transform cursor-pointer"
          title="В меню (Esc)"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>

        {/* Centered Scores */}
        <div className="flex items-center gap-5">
          <div className="text-center relative">
            <span className="text-[10px] uppercase tracking-wider text-tg-hint font-semibold block leading-none mb-1">
              Счет
            </span>
            <span className="text-2xl font-black text-pink-400 tracking-tight leading-none">
              {score}
            </span>
            {lastScorePopup && (
              <span
                key={lastScorePopup.id}
                className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-black text-amber-300 whitespace-nowrap animate-bounce drop-shadow pointer-events-none"
              >
                {lastScorePopup.text}
              </span>
            )}
          </div>

          <div className="h-6 w-[1px] bg-[var(--tg-theme-section-separator-color)]" />

          <div className="text-center">
            <span className="text-[10px] uppercase tracking-wider text-tg-hint font-semibold block leading-none mb-1">
              Рекорд
            </span>
            <span className="text-base font-bold text-amber-300 leading-none flex items-center gap-1 justify-center">
              <Trophy className="w-3.5 h-3.5 fill-amber-400/20" />
              {bestScore}
            </span>
          </div>
        </div>

        {/* Right Header Buttons */}
        <div className="flex items-center gap-1 -mr-2">
          {score > 0 && !isGameOver && (
            <button
              onClick={handleFinishEarly}
              className="p-2 rounded-xl text-emerald-400 hover:text-emerald-300 active:scale-95 transition-transform cursor-pointer"
              title="Завершить и сохранить счет"
            >
              <CheckCircle2 className="w-5 h-5" />
            </button>
          )}

          <button
            onClick={toggleSound}
            className="p-2 rounded-xl text-tg-hint hover:text-tg-text active:scale-95 transition-transform cursor-pointer"
            title={isMuted ? 'Включить звук (M)' : 'Выключить звук (M)'}
          >
            {isMuted ? (
              <VolumeX className="w-5 h-5 text-tg-hint opacity-50" />
            ) : (
              <Volume2 className="w-5 h-5 text-pink-400" />
            )}
          </button>

          <button
            onClick={handleRestart}
            className="p-2 rounded-xl text-tg-hint hover:text-tg-text active:scale-95 transition-transform cursor-pointer"
            title="Начать заново (R)"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* 2. Moves & Status Bar (h-8) */}
      <div className="h-8 shrink-0 flex items-center justify-between px-5">
        <div className="flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-slate-800/80 border border-slate-700/60">
          <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
          <span className="text-xs font-extrabold text-tg-text">
            Ходов: <span className={movesLeft <= 5 ? 'text-rose-400 animate-pulse font-black' : 'text-amber-300'}>{movesLeft}</span>
          </span>
        </div>

        {score > 0 && (
          <button
            onClick={handleFinishEarly}
            className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-2 cursor-pointer"
          >
            Завершить и зафиксировать
          </button>
        )}
      </div>

      {/* 3. Responsive 8x8 Board Container */}
      <div className="flex-1 flex items-center justify-center p-2 min-h-0">
        <div
          style={{
            width: 'min(88vw, 44vh, 370px)',
            height: 'min(88vw, 44vh, 370px)',
          }}
          className="aspect-square bg-tg-secondaryBg rounded-2xl p-2 border-2 border-[var(--tg-theme-section-separator-color)] shadow-2xl grid grid-cols-8 gap-1 relative"
        >
          {board.map((row, r) =>
            row.map((gem, c) => {
              const key = `${r},${c}`;
              const isClearing = clearingKeys.has(key);
              const isSelected = selectedGem?.row === r && selectedGem?.col === c;
              const def = GEM_DEFINITIONS[gem.type % GEM_TYPES_COUNT];

              return (
                <div
                  key={gem.id}
                  onClick={() => handleCellClick(r, c)}
                  onTouchStart={(e) => handleTouchStart(r, c, e)}
                  onTouchEnd={handleTouchEnd}
                  className={`relative rounded-xl flex items-center justify-center cursor-pointer transition-all duration-150 aspect-square ${
                    isClearing
                      ? 'scale-110 bg-amber-300 shadow-xl shadow-amber-400/80 z-20 animate-ping'
                      : isSelected
                      ? 'ring-2 ring-white scale-105 shadow-lg shadow-white/30 z-10'
                      : 'hover:scale-105 active:scale-95'
                  }`}
                >
                  <div
                    className={`w-full h-full rounded-xl bg-gradient-to-br ${def.gradient} border ${def.border} ${def.glow} flex items-center justify-center relative overflow-hidden transition-transform`}
                  >
                    <div className="absolute inset-0 bg-white/20 rounded-xl clip-triangle pointer-events-none opacity-60" />

                    {gem.special === 'line_h' && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-full h-1 bg-white shadow-lg shadow-white animate-pulse" />
                      </div>
                    )}
                    {gem.special === 'line_v' && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="h-full w-1 bg-white shadow-lg shadow-white animate-pulse" />
                      </div>
                    )}
                    {gem.special === 'hypercube' && (
                      <div className="absolute inset-1 rounded-full bg-gradient-to-r from-amber-400 via-rose-500 to-indigo-500 animate-spin opacity-80" />
                    )}

                    <span className="text-sm select-none drop-shadow-md">
                      {gem.special === 'hypercube' ? '🌈' : def.icon}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 4. Bottom Hint Bar (h-14) */}
      <div className="h-14 shrink-0 px-4 flex items-center justify-center border-t border-[var(--tg-theme-section-separator-color)] bg-tg-secondaryBg/40">
        <p className="text-xs text-tg-hint text-center font-medium">
          💡 Собирай 4 в ряд для линейной бомбы, 5 — для радужной!
        </p>
      </div>

      {/* Game Over Modal */}
      {isGameOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] p-6 text-center shadow-2xl animate-pop">
            <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-tr from-pink-500 to-amber-500 p-[2px] shadow-lg shadow-pink-500/20 flex items-center justify-center">
              <Trophy className="w-8 h-8 text-white fill-white/20" />
            </div>

            <h3 className="text-xl font-black text-tg-text">Партия завершена!</h3>
            <p className="text-xs text-tg-hint mt-1">
              {movesLeft <= 0 ? 'Закончились все доступные ходы' : 'Вы зафиксировали результат'}
            </p>

            <div className="my-5 p-4 rounded-2xl bg-black/25 border border-white/10">
              <span className="text-xs text-tg-hint uppercase font-semibold">
                Итоговые кристаллы
              </span>
              <p className="text-3xl font-black text-pink-400 mt-1">{score}</p>

              {isNewRecord && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-extrabold animate-bounce">
                  <Sparkles className="w-3.5 h-3.5" /> Новый рекорд в Match-3!
                </div>
              )}
            </div>

            <div className="space-y-2">
              <button
                onClick={handleRestart}
                className="w-full py-3 px-4 rounded-xl tg-btn-primary font-bold text-sm shadow-lg shadow-pink-600/30 cursor-pointer"
              >
                Играть снова
              </button>
              <button
                onClick={() => {
                  sound.playUiTap();
                  closeGame();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-black/30 hover:bg-black/40 text-tg-hint font-semibold text-xs border border-white/10 active:scale-95 transition-all cursor-pointer"
              >
                В главное меню
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
