import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useGameBridge } from '../../context/GameContext';
import { ArrowLeft, Trophy, Sparkles, Coins, Zap } from 'lucide-react';
import { haptics } from '../../telegram/telegram';
import { sound } from '../../utils/sound';

interface StackBlock {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

interface SlicedPiece {
  x: number;
  y: number;
  width: number;
  height: number;
  vy: number;
  color: string;
  alpha: number;
}

export const TowerStackGame: React.FC = () => {
  const { closeGame, submitScore, coins, spendCoins, bestScores } = useGameBridge();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [earnedCoins, setEarnedCoins] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [boosterNotice, setBoosterNotice] = useState<string | null>(null);

  const bestStackScore = bestScores['stack'] || 0;

  // Game state reference for RAF loop
  const gameStateRef = useRef({
    blocks: [] as StackBlock[],
    slicedPieces: [] as SlicedPiece[],
    currentX: 50,
    currentWidth: 160,
    currentSpeed: 1.8,
    direction: 1,
    score: 0,
    combo: 0,
    earnedCoins: 0,
    cameraY: 0,
    targetCameraY: 0,
    isGameOver: false,
    isStarted: false,
    blockHeight: 28,
    gameWidth: 360,
    gameHeight: 600,
    hue: 200,
  });

  const animFrameId = useRef<number>(0);

  const showNotice = (msg: string) => {
    setBoosterNotice(msg);
    setTimeout(() => setBoosterNotice(null), 2500);
  };

  // Generate color by layer hue
  const getBlockColor = (layer: number) => {
    const h = (layer * 9 + 210) % 360;
    return `hsl(${h}, 80%, 55%)`;
  };

  // Handle tap / drop block
  const handleDrop = useCallback(() => {
    const s = gameStateRef.current;
    if (s.isGameOver) return;

    if (!s.isStarted) {
      s.isStarted = true;
      setIsStarted(true);
    }

    const topBlock = s.blocks[s.blocks.length - 1];
    const prevLeft = topBlock.x;
    const prevRight = topBlock.x + topBlock.width;
    const currLeft = s.currentX;
    const currRight = s.currentX + s.currentWidth;

    const diff = currLeft - prevLeft;
    const tolerance = 6; // Generous & satisfying perfect placement threshold

    if (Math.abs(diff) <= tolerance) {
      // PERFECT MATCH: snap precisely to base
      s.currentX = prevLeft;
      s.combo += 1;
      setCombo(s.combo);

      // Rewarding combo audio & haptics
      sound.playSlice(s.combo);
      haptics.medium();

      // Bonus expansion every 4 combos
      if (s.combo % 4 === 0) {
        s.currentWidth = Math.min(s.gameWidth * 0.7, s.currentWidth + 12);
        showNotice(`Комбо x${s.combo}! Платформа расширена`);
      }
    } else {
      s.combo = 0;
      setCombo(0);

      // Calculate exact overlap interval
      const overlapLeft = Math.max(prevLeft, currLeft);
      const overlapRight = Math.min(prevRight, currRight);
      const newWidth = overlapRight - overlapLeft;

      if (newWidth <= 0) {
        // Complete Miss -> Game Over
        s.isGameOver = true;
        setIsGameOver(true);
        sound.playGameOver();
        haptics.heavy();

        // Drop the whole piece as falling slice
        s.slicedPieces.push({
          x: s.currentX,
          y: topBlock.y - s.blockHeight,
          width: s.currentWidth,
          height: s.blockHeight,
          vy: 2,
          color: getBlockColor(s.score + 1),
          alpha: 1,
        });

        submitScore('stack', s.score).then((res) => {
          if (res.isNewRecord) setIsNewRecord(true);
        });
        return;
      }

      // Sliced chunk is the overhang portion outside the base interval
      let sliceX = 0;
      let sliceW = 0;

      if (currLeft < prevLeft) {
        // Overshot/stopped on the left: overhang falls off the left edge
        sliceX = currLeft;
        sliceW = prevLeft - currLeft;
      } else {
        // Overshot on the right: overhang falls off the right edge
        sliceX = prevRight;
        sliceW = currRight - prevRight;
      }

      s.slicedPieces.push({
        x: sliceX,
        y: topBlock.y - s.blockHeight,
        width: sliceW,
        height: s.blockHeight,
        vy: 2,
        color: getBlockColor(s.score + 1),
        alpha: 1,
      });

      // The placed block is strictly inside the overlap interval
      s.currentX = overlapLeft;
      s.currentWidth = newWidth;
      sound.playPlace();
      haptics.light();
    }

    // Place the new block on top
    s.score += 1;
    setScore(s.score);

    // Coin earnings per 5 floors
    if (s.score % 5 === 0) {
      s.earnedCoins += 2;
      setEarnedCoins(s.earnedCoins);
      sound.playScore();
    }

    const nextY = topBlock.y - s.blockHeight;
    s.blocks.push({
      x: s.currentX,
      y: nextY,
      width: s.currentWidth,
      height: s.blockHeight,
      color: getBlockColor(s.score),
    });

    // Move camera up
    s.targetCameraY = Math.max(0, (s.blocks.length - 8) * s.blockHeight);

    // Reset current oscillating block for next floor (alternating sides, smooth speed)
    s.direction = s.score % 2 === 0 ? 1 : -1;
    s.currentX = s.direction > 0 ? -s.currentWidth : s.gameWidth;
    s.currentSpeed = Math.min(3.8, 1.8 + s.score * 0.03);
  }, [submitScore]);

  // Main canvas rendering loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      if (containerRef.current && canvas) {
        const rect = containerRef.current.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        gameStateRef.current.gameWidth = rect.width;
        gameStateRef.current.gameHeight = rect.height;

        if (gameStateRef.current.blocks.length === 0) {
          const initW = Math.min(180, rect.width * 0.55);
          gameStateRef.current.currentWidth = initW;
          gameStateRef.current.blocks = [
            {
              x: (rect.width - initW) / 2,
              y: rect.height - 120,
              width: initW,
              height: gameStateRef.current.blockHeight,
              color: 'hsl(210, 80%, 55%)',
            },
          ];
        }
      }
    };

    resize();
    window.addEventListener('resize', resize);

    const loop = () => {
      const s = gameStateRef.current;
      const w = s.gameWidth;
      const h = s.gameHeight;

      ctx.clearRect(0, 0, w, h);

      // Deep sky gradient background
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#030712');
      bg.addColorStop(0.5, '#0f172a');
      bg.addColorStop(1, '#1e1b4b');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Smooth camera interpolation
      s.cameraY += (s.targetCameraY - s.cameraY) * 0.12;

      ctx.save();
      ctx.translate(0, s.cameraY);

      // Draw placed tower blocks
      for (let i = 0; i < s.blocks.length; i++) {
        const b = s.blocks[i];
        if (b.y + s.blockHeight + s.cameraY < -50) continue; // Culling

        // 3D Bevel effect
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.roundRect(b.x, b.y, b.width, b.height, [4, 4, 0, 0]);
        ctx.fill();

        // Top glossy highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.fillRect(b.x, b.y, b.width, 3);

        // Bottom shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.fillRect(b.x, b.y + b.height - 3, b.width, 3);
      }

      // Draw moving block if game is active
      if (s.isStarted && !s.isGameOver) {
        s.currentX += s.currentSpeed * s.direction;

        if (s.currentX + s.currentWidth >= w + 40) {
          s.direction = -1;
        } else if (s.currentX <= -40) {
          s.direction = 1;
        }

        const topY = s.blocks[s.blocks.length - 1].y - s.blockHeight;
        const activeColor = getBlockColor(s.score + 1);

        ctx.fillStyle = activeColor;
        ctx.beginPath();
        ctx.roundRect(s.currentX, topY, s.currentWidth, s.blockHeight, [4, 4, 0, 0]);
        ctx.fill();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
        ctx.fillRect(s.currentX, topY, s.currentWidth, 3);
      }

      // Draw falling sliced pieces
      for (let i = s.slicedPieces.length - 1; i >= 0; i--) {
        const p = s.slicedPieces[i];
        p.y += p.vy;
        p.vy += 0.4; // Gravity
        p.alpha -= 0.02;

        if (p.alpha <= 0 || p.y > h + 200) {
          s.slicedPieces.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.width, p.height);
        ctx.restore();
      }

      ctx.restore();

      animFrameId.current = requestAnimationFrame(loop);
    };

    animFrameId.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animFrameId.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  // Restart game handler
  const handleRestart = () => {
    const s = gameStateRef.current;
    const initW = Math.min(180, s.gameWidth * 0.55);

    s.currentWidth = initW;
    s.currentX = (s.gameWidth - initW) / 2;
    s.currentSpeed = 1.8;
    s.direction = 1;
    s.score = 0;
    s.combo = 0;
    s.earnedCoins = 0;
    s.cameraY = 0;
    s.targetCameraY = 0;
    s.isGameOver = false;
    s.isStarted = false;
    s.slicedPieces = [];
    s.blocks = [
      {
        x: (s.gameWidth - initW) / 2,
        y: s.gameHeight - 120,
        width: initW,
        height: s.blockHeight,
        color: 'hsl(210, 80%, 55%)',
      },
    ];

    setScore(0);
    setCombo(0);
    setEarnedCoins(0);
    setIsGameOver(false);
    setIsStarted(false);
    setIsNewRecord(false);
  };

  // Rescue Booster (50 coins: expands block back to 150px and clears top drop)
  const handleRescue = async () => {
    if (coins < 50) {
      sound.playUiTap();
      haptics.error();
      showNotice('Нужно 50 🪙 для спасения башни!');
      return;
    }

    const success = await spendCoins(50, 'stack_rescue');
    if (success) {
      sound.playPickup();
      haptics.success();

      const s = gameStateRef.current;
      const topBlock = s.blocks[s.blocks.length - 1];
      const restoredW = Math.min(160, s.gameWidth * 0.6);

      topBlock.width = restoredW;
      topBlock.x = (s.gameWidth - restoredW) / 2;
      s.currentWidth = restoredW;
      s.currentX = topBlock.x;
      s.isGameOver = false;

      setIsGameOver(false);
      showNotice('Башня спасена! Платформа расширена');
    }
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handleDrop}
      className="relative w-full h-full flex flex-col overflow-hidden select-none touch-none bg-tg-bg"
    >
      {/* Top HUD */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-3 bg-tg-bg/85 backdrop-blur-md border-b border-[var(--tg-theme-section-separator-color)]">
        <button
          onClick={(e) => {
            e.stopPropagation();
            sound.playUiTap();
            haptics.light();
            closeGame();
          }}
          className="p-2 rounded-xl text-tg-hint hover:text-tg-text active:scale-95 bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] transition-all cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Live Height Counter */}
        <div className="flex items-center gap-2.5">
          {combo > 1 && (
            <div className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-400/30 text-[11px] font-black animate-pulse">
              Combo x{combo}!
            </div>
          )}

          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-500 font-black text-xs">
            <Coins className="w-3.5 h-3.5" />
            <span>+{earnedCoins}</span>
          </div>

          <div className="text-center">
            <span className="text-xl font-black text-tg-text leading-none">{score}</span>
            <span className="block text-[8px] uppercase tracking-wider text-tg-hint font-bold">
              Этажей
            </span>
          </div>
        </div>

        {/* Best Score */}
        <div className="flex items-center gap-1 text-xs font-bold text-tg-hint">
          <Trophy className="w-4 h-4 text-cyan-400" />
          <span>{Math.max(score, bestStackScore)}</span>
        </div>
      </div>

      {/* Main Canvas */}
      <canvas ref={canvasRef} className="w-full h-full block cursor-pointer" />

      {/* Start Prompt Overlay */}
      {!isStarted && !isGameOver && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-6 text-center animate-fade-in">
          <div className="p-4 rounded-3xl bg-black/50 backdrop-blur-md border border-white/15 max-w-xs space-y-3">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-3xl animate-bounce">
              🏗️
            </div>
            <h2 className="text-lg font-black text-white">Tower Stack</h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Тапай точно вовремя, чтобы ставить блоки идеально ровно. За идеальные попадания начисляется комбо!
            </p>
            <div className="inline-block px-4 py-1.5 rounded-full bg-cyan-500 text-slate-950 text-xs font-black shadow-lg">
              Тапни для первого блока
            </div>
          </div>
        </div>
      )}

      {/* Booster Notification Toast */}
      {boosterNotice && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 bg-tg-secondaryBg border border-cyan-500/40 shadow-xl px-4 py-2 rounded-2xl flex items-center gap-2 text-xs font-bold text-tg-text animate-pop">
          <Zap className="w-4 h-4 text-cyan-400" />
          <span>{boosterNotice}</span>
        </div>
      )}

      {/* Game Over Modal */}
      {isGameOver && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/80 backdrop-blur-sm animate-fade-in"
        >
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] p-6 text-center shadow-2xl animate-pop text-tg-text">
            <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-500 p-[2px] shadow-lg shadow-cyan-500/20 flex items-center justify-center">
              <Trophy className="w-8 h-8 text-white fill-white/20" />
            </div>

            <h3 className="text-xl font-black text-tg-text">Башня обрушилась!</h3>
            <p className="text-xs text-tg-hint mt-1">Блок не попал на предыдущую платформу</p>

            <div className="my-4 p-4 rounded-2xl bg-black/[0.04] dark:bg-tg-bg border border-[var(--tg-theme-section-separator-color)]">
              <span className="text-xs text-tg-hint uppercase font-semibold">Высота башни</span>
              <p className="text-3xl font-black text-cyan-500 mt-0.5">{score} эт.</p>

              {isNewRecord && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-500 text-xs font-extrabold animate-bounce">
                  <Sparkles className="w-3.5 h-3.5" /> Новый личный рекорд!
                </div>
              )}

              {earnedCoins > 0 && (
                <p className="text-xs font-bold text-emerald-500 mt-2">
                  +{earnedCoins} 🪙 заработано за высоту
                </p>
              )}
            </div>

            <div className="space-y-2">
              {score > 5 && (
                <button
                  onClick={handleRescue}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 text-white font-black text-xs shadow-lg shadow-cyan-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Zap className="w-4 h-4" />
                  Спасти башню (Широкий блок за 50 🪙)
                </button>
              )}

              <button
                onClick={handleRestart}
                className="w-full py-3 px-4 rounded-xl tg-btn-primary font-bold text-sm shadow-lg shadow-cyan-600/30 active:scale-95 transition-all cursor-pointer"
              >
                Строить снова
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
