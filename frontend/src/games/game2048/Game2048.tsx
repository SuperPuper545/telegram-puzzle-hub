import React, { useState, useRef, useEffect } from 'react';
import { useGameBridge } from '../../context/GameContext';
import { useGame2048 } from './useGame2048';
import { getTileStyle } from './tileStyles';
import { sound } from '../../utils/sound';
import { haptics } from '../../telegram/telegram';
import confetti from 'canvas-confetti';
import {
  ArrowLeft,
  RotateCcw,
  Undo2,
  Trophy,
  Sparkles,
  Volume2,
  VolumeX,
  Flame,
} from 'lucide-react';

export const Game2048: React.FC = () => {
  const { closeGame, bestScores, submitScore } = useGameBridge();
  const currentBest = bestScores['2048'] || 0;

  const {
    board,
    score,
    bestScore,
    canUndo,
    isGameOver,
    hasWon,
    lastScorePopup,
    move,
    undo,
    restartGame,
  } = useGame2048(currentBest);

  const [isMuted, setIsMuted] = useState(() => sound.isMuted());
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [acknowledgedWin, setAcknowledgedWin] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
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
      submitScore('2048', score).then((res) => {
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

  // Keyboard navigation on PC (Arrow keys + WASD)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      if (e.key === 'Escape') {
        sound.playUiTap();
        closeGame();
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        move('up');
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        move('down');
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        move('left');
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        move('right');
      } else if (e.key === 'u' || e.key === 'U' || (e.ctrlKey && e.key === 'z')) {
        undo();
      } else if (e.key === 'r' || e.key === 'R') {
        handleRestart();
      } else if (e.key === 'm' || e.key === 'M') {
        toggleSound();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [move, undo, closeGame]);

  const handleRestart = () => {
    haptics.medium();
    sound.playUiTap();
    setIsNewRecord(false);
    setAcknowledgedWin(false);
    hasSubmittedRef.current = false;
    restartGame();
  };

  // Touch Swipe detection
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    const threshold = 25;
    if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
      if (Math.abs(dx) > Math.abs(dy)) {
        move(dx > 0 ? 'right' : 'left');
      } else {
        move(dy > 0 ? 'down' : 'up');
      }
    }
  };

  return (
    <div
      className="w-full h-full min-h-[100dvh] max-h-[100dvh] overflow-hidden flex flex-col justify-between bg-tg-bg text-tg-text select-none game-viewport-lock"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
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
            <span className="text-2xl font-black text-amber-400 tracking-tight leading-none">
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

        {/* Right Buttons: Undo, Sound, Restart */}
        <div className="flex items-center gap-1 -mr-2">
          <button
            onClick={undo}
            disabled={!canUndo}
            className={`p-2 rounded-xl transition-all cursor-pointer ${
              canUndo
                ? 'text-indigo-400 hover:text-tg-text active:scale-95'
                : 'text-tg-hint opacity-30 cursor-not-allowed'
            }`}
            title="Отменить ход (U)"
          >
            <Undo2 className="w-5 h-5" />
          </button>

          <button
            onClick={toggleSound}
            className="p-2 rounded-xl text-tg-hint hover:text-tg-text active:scale-95 transition-transform cursor-pointer"
            title={isMuted ? 'Включить звук (M)' : 'Выключить звук (M)'}
          >
            {isMuted ? (
              <VolumeX className="w-5 h-5 text-tg-hint opacity-50" />
            ) : (
              <Volume2 className="w-5 h-5 text-amber-400" />
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

      {/* 2. Status Bar (h-8) */}
      <div className="h-8 shrink-0 flex items-center justify-between px-5">
        <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/30 text-[11px] font-extrabold text-amber-300">
          <Flame className="w-3.5 h-3.5 fill-amber-400" />
          Цель: плитка 2048!
        </div>

        <span className="text-[11px] text-tg-hint font-medium">
          Свайпай в любую сторону
        </span>
      </div>

      {/* 3. 4x4 Board Container */}
      <div className="flex-1 flex items-center justify-center p-3 min-h-0">
        <div
          style={{
            width: 'min(88vw, 44vh, 370px)',
            height: 'min(88vw, 44vh, 370px)',
          }}
          className="aspect-square bg-tg-secondaryBg rounded-3xl p-3 border-2 border-[var(--tg-theme-section-separator-color)] shadow-2xl grid grid-cols-4 grid-rows-4 gap-2.5 relative"
        >
          {board.map((row, r) =>
            row.map((val, c) => {
              const style = getTileStyle(val);

              return (
                <div
                  key={`${r}-${c}`}
                  className="relative rounded-2xl bg-black/15 border border-white/5 flex items-center justify-center overflow-hidden aspect-square"
                >
                  {val > 0 && (
                    <div
                      className={`w-full h-full rounded-2xl border ${style.bg} ${style.glow || ''} flex items-center justify-center font-black ${style.text} ${style.fontSize} tracking-tighter transition-all duration-100 shadow-inner animate-pop`}
                    >
                      {val}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 4. Controls & Hint Bar (h-14) */}
      <div className="h-14 shrink-0 px-4 flex items-center justify-center border-t border-[var(--tg-theme-section-separator-color)] bg-tg-secondaryBg/40">
        <p className="text-xs text-tg-hint text-center font-medium">
          💡 На ПК используй стрелки клавиатуры или клавиши WASD
        </p>
      </div>

      {/* 2048 Win Modal */}
      {hasWon && !acknowledgedWin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-tg-secondaryBg border border-amber-500/80 p-6 text-center shadow-2xl animate-pop">
            <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-tr from-yellow-400 to-amber-500 p-[2px] shadow-lg shadow-amber-500/40 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-white fill-white/20 animate-spin" />
            </div>

            <h3 className="text-xl font-black text-amber-300">Плитка 2048 собрана! 🎉</h3>
            <p className="text-xs text-tg-hint mt-1">Потрясающая победа! Вы достигли легендарной плитки.</p>

            <div className="my-5 p-4 rounded-2xl bg-black/25 border border-white/10">
              <span className="text-xs text-tg-hint uppercase font-semibold">Текущий счет</span>
              <p className="text-3xl font-black text-amber-400 mt-1">{score}</p>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => setAcknowledgedWin(true)}
                className="w-full py-3 px-4 rounded-xl tg-btn-primary font-bold text-sm shadow-lg shadow-amber-500/30 cursor-pointer"
              >
                Продолжить игру дальше
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

      {/* Game Over Modal */}
      {isGameOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] p-6 text-center shadow-2xl animate-pop">
            <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 p-[2px] shadow-lg shadow-amber-500/20 flex items-center justify-center">
              <Trophy className="w-8 h-8 text-white fill-white/20" />
            </div>

            <h3 className="text-xl font-black text-tg-text">Игра окончена</h3>
            <p className="text-xs text-tg-hint mt-1">Нет доступных ходов для слияния</p>

            <div className="my-5 p-4 rounded-2xl bg-black/25 border border-white/10">
              <span className="text-xs text-tg-hint uppercase font-semibold">
                Итоговый результат
              </span>
              <p className="text-3xl font-black text-amber-400 mt-1">{score}</p>

              {isNewRecord && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-extrabold animate-bounce">
                  <Sparkles className="w-3.5 h-3.5" /> Новый рекорд в 2048!
                </div>
              )}
            </div>

            <div className="space-y-2">
              <button
                onClick={handleRestart}
                className="w-full py-3 px-4 rounded-xl tg-btn-primary font-bold text-sm shadow-lg shadow-amber-600/30 cursor-pointer"
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
