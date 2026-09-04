import React, { useState, useRef, useEffect } from 'react';
import { useGameBridge } from '../../context/GameContext';
import { useMatch3 } from './useMatch3';
import { getGemDefinition } from './gemData';
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
  Coins,
  Bomb,
  Hourglass,
  Swords,
} from 'lucide-react';
import { ChallengeBanner } from '../../components/hub/ChallengeBanner';

export const Match3Game: React.FC = () => {
  const { closeGame, bestScores, submitScore, coins, spendCoins, equippedGemSkin, shareChallenge } = useGameBridge();
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
    restartGame,
    addExtraMoves,
    triggerColorBomb,
  } = useMatch3(currentBest);

  const [boosterNotice, setBoosterNotice] = useState<string | null>(null);

  const [isMuted, setIsMuted] = useState(() => sound.isMuted());
  const [isNewRecord, setIsNewRecord] = useState(false);
  const pointerStartRef = useRef<{ row: number; col: number; startX: number; startY: number; moved: boolean } | null>(null);
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

  // Click / Tap on gem
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

  // Pointer Swipe & Tap Handlers (immediate response during movement)
  const handleGemPointerDown = (r: number, c: number, e: React.PointerEvent) => {
    if (isBusy || isGameOver) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);

    pointerStartRef.current = {
      row: r,
      col: c,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    };
  };

  const handleGemPointerMove = (e: React.PointerEvent) => {
    if (!pointerStartRef.current || pointerStartRef.current.moved || isBusy || isGameOver) return;
    const { row, col, startX, startY } = pointerStartRef.current;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const SWIPE_THRESHOLD = 18; // Very responsive thumb threshold

    if (Math.abs(dx) > SWIPE_THRESHOLD || Math.abs(dy) > SWIPE_THRESHOLD) {
      pointerStartRef.current.moved = true;
      haptics.selection();

      let targetRow = row;
      let targetCol = col;

      if (Math.abs(dx) > Math.abs(dy)) {
        targetCol = dx > 0 ? col + 1 : col - 1;
      } else {
        targetRow = dy > 0 ? row + 1 : row - 1;
      }

      if (targetRow >= 0 && targetRow < MATCH3_SIZE && targetCol >= 0 && targetCol < MATCH3_SIZE) {
        trySwap({ row, col }, { row: targetRow, col: targetCol });
      }
      setSelectedGem(null);
    }
  };

  const handleGemPointerUp = (r: number, c: number, e: React.PointerEvent) => {
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch (_) {}

    if (!pointerStartRef.current) return;
    const wasMoved = pointerStartRef.current.moved;
    pointerStartRef.current = null;

    // If it was just a tap without swipe movement
    if (!wasMoved) {
      handleCellClick(r, c);
    }
  };

  const showBoosterNotice = (msg: string) => {
    setBoosterNotice(msg);
    setTimeout(() => setBoosterNotice(null), 2500);
  };

  const handleBoosterMoves = async () => {
    if (coins < 100) {
      sound.playUiTap();
      haptics.error();
      showBoosterNotice('Нужно 100 🪙 для +5 ходов!');
      return;
    }
    const success = await spendCoins(100, 'match3_extra_moves');
    if (success) {
      sound.playCombo();
      haptics.success();
      addExtraMoves(5);
      hasSubmittedRef.current = false;
      showBoosterNotice('+5 ходов добавлено! (-100 🪙)');
    }
  };

  const handleBoosterBomb = async () => {
    if (coins < 150) {
      sound.playUiTap();
      haptics.error();
      showBoosterNotice('Нужно 150 🪙 для Бомбы!');
      return;
    }
    const success = await spendCoins(150, 'match3_color_bomb');
    if (success) {
      sound.playCombo();
      haptics.heavy();
      await triggerColorBomb();
      showBoosterNotice('Бомба активирована! (-150 🪙)');
    }
  };

  return (
    <div className="w-full h-full min-h-[100dvh] max-h-[100dvh] overflow-hidden flex flex-col justify-between bg-tg-bg text-tg-text select-none game-viewport-lock">
      <ChallengeBanner currentScore={score} />

      {/* 1. Header with Scores (h-14) */}
      <header className="h-14 shrink-0 px-4 flex items-center justify-between border-b border-[var(--tg-theme-section-separator-color)] bg-tg-secondaryBg/80 backdrop-blur-md z-10">
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
            <span className="text-base font-bold text-amber-500 leading-none flex items-center gap-1 justify-center">
              <Trophy className="w-3.5 h-3.5 fill-amber-500/20" />
              {bestScore}
            </span>
          </div>
        </div>

        {/* Right Header Buttons: Coins, Sound & Restart */}
        <div className="flex items-center gap-1.5 -mr-1">
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/15 border border-amber-400/25 text-amber-500 text-xs font-black shadow-sm">
            <Coins className="w-3.5 h-3.5" />
            <span>{coins}</span>
          </div>

          <button
            onClick={toggleSound}
            className="p-1.5 rounded-xl text-tg-hint hover:text-tg-text active:scale-95 transition-transform cursor-pointer"
            title={isMuted ? 'Включить звук (M)' : 'Выключить звук (M)'}
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-tg-hint opacity-50" />
            ) : (
              <Volume2 className="w-4 h-4 text-pink-400" />
            )}
          </button>

          <button
            onClick={handleRestart}
            className="p-1.5 rounded-xl text-tg-hint hover:text-tg-text active:scale-95 transition-transform cursor-pointer"
            title="Начать заново (R)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2. Top Booster Action Bar (+5 Moves & Rainbow Bomb at the top) */}
      <div className="shrink-0 px-4 pt-1.5 pb-0.5 flex items-center justify-between gap-3 max-w-md mx-auto w-full">
        <button
          onClick={handleBoosterMoves}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] active:scale-95 transition-all text-xs font-bold text-tg-text hover:border-amber-500/50 cursor-pointer shadow-sm"
          title="+5 ходов за 100 монет"
        >
          <Hourglass className="w-3.5 h-3.5 text-amber-500" />
          <span>+5 ходов</span>
          <span className="text-[10px] text-amber-500 font-black">100🪙</span>
        </button>

        <button
          onClick={handleBoosterBomb}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] active:scale-95 transition-all text-xs font-bold text-tg-text hover:border-purple-500/50 cursor-pointer shadow-sm"
          title="Бомба за 150 монет"
        >
          <Bomb className="w-3.5 h-3.5 text-pink-400" />
          <span>Бомба</span>
          <span className="text-[10px] text-amber-500 font-black">150🪙</span>
        </button>
      </div>

      {/* 3. Moves & Status Bar (Always visible moves count, non-blocking floating booster toast) */}
      <div className="h-7 shrink-0 flex items-center justify-center px-4 relative">
        <div className="flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] shadow-sm">
          <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
          <span className="text-xs font-extrabold text-tg-text">
            Осталось ходов: <span className={movesLeft <= 5 ? 'text-rose-400 animate-pulse font-black' : 'text-amber-500'}>{movesLeft}</span>
          </span>
        </div>

        {boosterNotice && (
          <div className="absolute top-8 z-30 inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-500 border border-amber-300/80 text-white text-[11px] font-black shadow-lg shadow-amber-500/40 animate-fade-in pointer-events-none">
            <Sparkles className="w-3 h-3 fill-white text-white" />
            <span>{boosterNotice}</span>
          </div>
        )}
      </div>

      {/* 4. Enlarged Responsive 7x7 Board - Centered higher with bottom breathing room */}
      <div className="flex-1 flex flex-col items-center justify-center p-2 pb-8 sm:pb-12 min-h-0">
        <div
          style={{
            width: 'min(94vw, 55vh, 420px)',
            height: 'min(94vw, 55vh, 420px)',
          }}
          className="aspect-square bg-tg-secondaryBg/90 backdrop-blur-sm rounded-2xl p-2 border-[1.5px] border-[var(--tg-theme-section-separator-color)] shadow-2xl grid grid-cols-7 grid-rows-7 gap-1.5 sm:gap-2 relative overflow-hidden select-none touch-none"
        >
          {board.map((row, r) =>
            row.map((gem, c) => {
              const key = `${r},${c}`;
              const isClearing = clearingKeys.has(key);
              const isSelected = selectedGem?.row === r && selectedGem?.col === c;
              const def = getGemDefinition(gem.type, equippedGemSkin);
              const isKnopachki = equippedGemSkin === 'gem_orbs';

              return (
                <div
                  key={gem.id}
                  onPointerDown={(e) => handleGemPointerDown(r, c, e)}
                  onPointerMove={handleGemPointerMove}
                  onPointerUp={(e) => handleGemPointerUp(r, c, e)}
                  onPointerCancel={() => { pointerStartRef.current = null; }}
                  className={`relative flex items-center justify-center cursor-pointer transition-all duration-200 aspect-square select-none touch-none ${
                    isKnopachki ? 'rounded-full' : 'rounded-2xl'
                  } ${
                    isClearing
                      ? 'scale-0 opacity-0 rotate-12 transition-all duration-200 ease-in brightness-125 z-20'
                      : isSelected
                      ? 'ring-4 ring-white/90 scale-105 shadow-xl shadow-white/40 z-10'
                      : 'hover:scale-105 active:scale-95'
                  }`}
                >
                  <div
                    className={`w-full h-full bg-gradient-to-br ${def.gradient} border ${def.border} ${def.glow} flex items-center justify-center relative overflow-hidden transition-all shadow-md ${
                      isKnopachki ? 'rounded-full ring-2 ring-white/40' : 'rounded-2xl'
                    }`}
                  >
                    {/* Glossy / tactile highlight */}
                    {isKnopachki ? (
                      <>
                        {/* Tactile Button: upper curved specular glare and central indicator */}
                        <div className="absolute top-0 inset-x-0 h-[45%] rounded-t-full bg-gradient-to-b from-white/50 to-transparent pointer-events-none" />
                        <div className="w-2.5 h-2.5 rounded-full bg-white/70 shadow-sm border border-white/50 pointer-events-none" />
                      </>
                    ) : (
                      <>
                        {/* Sleek Faceted Gem: crisp diagonal facet reflection without emoji */}
                        <div className="absolute inset-0 bg-white/20 rounded-2xl clip-triangle pointer-events-none opacity-60" />
                        <div className="w-3 h-3 rounded-[3px] bg-white/30 border border-white/50 shadow-inner rotate-45 pointer-events-none" />
                      </>
                    )}

                    {/* Special Gem Effects */}
                    {gem.special === 'line_h' && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-full h-1.5 bg-white shadow-lg shadow-white animate-pulse" />
                      </div>
                    )}
                    {gem.special === 'line_v' && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="h-full w-1.5 bg-white shadow-lg shadow-white animate-pulse" />
                      </div>
                    )}
                    {gem.special === 'hypercube' && (
                      <div className="absolute inset-1 rounded-full bg-gradient-to-r from-amber-400 via-rose-500 to-indigo-500 animate-spin opacity-90 shadow-lg" />
                    )}

                    {def.icon ? (
                      <span className="text-base select-none drop-shadow-md z-10">
                        {gem.special === 'hypercube' ? '🌈' : def.icon}
                      </span>
                    ) : gem.special === 'hypercube' ? (
                      <span className="text-base select-none drop-shadow-md z-10">🌈</span>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Game Over Modal */}
      {isGameOver && (
        <div
          onTouchMove={(e) => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in touch-none overscroll-contain"
        >
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] p-6 text-center shadow-2xl animate-pop text-tg-text overscroll-contain">
            <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-tr from-pink-500 to-amber-500 p-[2px] shadow-lg shadow-pink-500/20 flex items-center justify-center">
              <Trophy className="w-8 h-8 text-white fill-white/20" />
            </div>

            <h3 className="text-xl font-black text-tg-text">Партия завершена!</h3>
            <p className="text-xs text-tg-hint mt-1">
              Закончились все доступные ходы
            </p>

            <div className="my-5 p-4 rounded-2xl bg-black/[0.04] dark:bg-tg-bg border border-[var(--tg-theme-section-separator-color)]">
              <span className="text-xs text-tg-hint uppercase font-semibold">
                Итоговые кристаллы
              </span>
              <p className="text-3xl font-black text-pink-500 mt-1">{score}</p>

              {isNewRecord && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-500 text-xs font-extrabold animate-bounce">
                  <Sparkles className="w-3.5 h-3.5" /> Новый рекорд в Match-3!
                </div>
              )}
            </div>

            <div className="space-y-2">
              <button
                onClick={async () => {
                  if (coins >= 100) {
                    const success = await spendCoins(100, 'match3_rescue');
                    if (success) {
                      sound.playCombo();
                      haptics.success();
                      addExtraMoves(5);
                      hasSubmittedRef.current = false;
                      showBoosterNotice('Партия продлена: +5 ходов!');
                    }
                  } else {
                    sound.playUiTap();
                    haptics.error();
                    showBoosterNotice('Нужно 100 🪙 для продления игры!');
                  }
                }}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-pink-500 to-purple-600 text-white font-black text-xs shadow-lg shadow-pink-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Zap className="w-4 h-4" />
                Продлить игру (+5 ходов за 100 🪙)
              </button>

              {score > 0 && (
                <button
                  onClick={() => {
                    sound.playUiTap();
                    shareChallenge('match3', score, 'Match-3');
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-pink-500 via-rose-500 to-purple-600 text-white font-black text-xs shadow-lg shadow-pink-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Swords className="w-4 h-4" />
                  Бросить вызов другу в чат
                </button>
              )}

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
                className="w-full py-3 px-4 rounded-xl bg-black/[0.05] dark:bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] text-tg-text font-bold text-sm hover:opacity-80 transition-opacity cursor-pointer"
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
