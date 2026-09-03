import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useGameBridge } from '../../context/GameContext';
import { ArrowLeft, Trophy, Sparkles, Coins, Zap } from 'lucide-react';
import { haptics } from '../../telegram/telegram';
import { sound } from '../../utils/sound';

interface Pipe {
  x: number;
  topHeight: number;
  bottomHeight: number;
  passed: boolean;
  hasCoin: boolean;
  coinCollected: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
}

export const FlappyGame: React.FC = () => {
  const { closeGame, submitScore, coins, spendCoins, bestScores } = useGameBridge();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [score, setScore] = useState(0);
  const [collectedCoins, setCollectedCoins] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [boosterNotice, setBoosterNotice] = useState<string | null>(null);

  // Game loop references
  const gameStateRef = useRef({
    birdY: 250,
    birdVy: 0,
    birdAngle: 0,
    pipes: [] as Pipe[],
    particles: [] as Particle[],
    score: 0,
    collectedCoins: 0,
    isGameOver: false,
    isStarted: false,
    lastPipeX: 0,
    gameWidth: 360,
    gameHeight: 600,
    pipeGap: 140,
    pipeWidth: 54,
    gravity: 0.38,
    flapStrength: -7.2,
    speed: 2.5,
    frameCount: 0,
  });

  const animFrameId = useRef<number>(0);
  const bestFlappyScore = bestScores['flappy'] || 0;

  // Show temporary booster notice
  const showNotice = (msg: string) => {
    setBoosterNotice(msg);
    setTimeout(() => setBoosterNotice(null), 2500);
  };

  // Flap wings handler
  const handleFlap = useCallback(() => {
    const s = gameStateRef.current;
    if (s.isGameOver) return;

    if (!s.isStarted) {
      s.isStarted = true;
      setIsStarted(true);
    }

    s.birdVy = s.flapStrength;
    s.birdAngle = -0.45;
    sound.playFlap();
    haptics.light();
  }, []);

  // Trigger collision particles
  const spawnParticles = (x: number, y: number) => {
    const colors = ['#f59e0b', '#ec4899', '#6366f1', '#10b981', '#ffffff'];
    for (let i = 0; i < 24; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 4;
      gameStateRef.current.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
      });
    }
  };

  // Main canvas animation loop
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
        if (!gameStateRef.current.isStarted) {
          gameStateRef.current.birdY = rect.height * 0.45;
        }
      }
    };

    resize();
    window.addEventListener('resize', resize);

    const loop = () => {
      const s = gameStateRef.current;
      const w = s.gameWidth;
      const h = s.gameHeight;
      s.frameCount++;

      ctx.clearRect(0, 0, w, h);

      // Draw background gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
      bgGrad.addColorStop(0, '#0a0f1d');
      bgGrad.addColorStop(1, '#05070d');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Draw distant stars / ambient particles
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      for (let i = 0; i < 15; i++) {
        const starX = ((i * 47 + s.frameCount * 0.2) % w);
        const starY = (i * 39) % (h * 0.7);
        ctx.fillRect(starX, starY, 1.5, 1.5);
      }

      if (s.isStarted && !s.isGameOver) {
        // Apply physics to bird
        s.birdVy += s.gravity;
        s.birdY += s.birdVy;
        s.birdAngle = Math.min(Math.PI / 3, Math.max(-0.5, s.birdVy * 0.08));

        // Pipe spawn
        if (s.pipes.length === 0 || w - s.lastPipeX >= 180) {
          const minPipe = 60;
          const maxPipe = h - s.pipeGap - minPipe;
          const topH = Math.floor(minPipe + Math.random() * (maxPipe - minPipe));
          const botH = h - topH - s.pipeGap;

          s.pipes.push({
            x: w + 20,
            topHeight: topH,
            bottomHeight: botH,
            passed: false,
            hasCoin: Math.random() > 0.45,
            coinCollected: false,
          });
          s.lastPipeX = w + 20;
        }

        // Move pipes
        const birdRadius = 14;
        const birdX = w * 0.25;

        for (let i = s.pipes.length - 1; i >= 0; i--) {
          const p = s.pipes[i];
          p.x -= s.speed;

          // Check if bird passed pipe
          if (!p.passed && p.x + s.pipeWidth < birdX) {
            p.passed = true;
            s.score += 1;
            setScore(s.score);
            sound.playScore();
            haptics.light();
          }

          // Check coin collection
          if (p.hasCoin && !p.coinCollected) {
            const coinX = p.x + s.pipeWidth / 2;
            const coinY = p.topHeight + s.pipeGap / 2;
            const dist = Math.hypot(birdX - coinX, s.birdY - coinY);

            if (dist < birdRadius + 12) {
              p.coinCollected = true;
              s.collectedCoins += 1;
              setCollectedCoins(s.collectedCoins);
              sound.playScore();
              haptics.selection();
            }
          }

          // Collision detection with pipe
          if (
            birdX + birdRadius > p.x &&
            birdX - birdRadius < p.x + s.pipeWidth
          ) {
            if (
              s.birdY - birdRadius < p.topHeight ||
              s.birdY + birdRadius > h - p.bottomHeight
            ) {
              s.isGameOver = true;
              setIsGameOver(true);
              sound.playHit();
              haptics.error();
              spawnParticles(birdX, s.birdY);
              submitScore('flappy', s.score).then((res) => {
                if (res.isNewRecord) setIsNewRecord(true);
              });
            }
          }

          // Remove off-screen pipe
          if (p.x + s.pipeWidth < -30) {
            s.pipes.splice(i, 1);
          }
        }

        // Collision with floor or ceiling
        if (s.birdY + birdRadius >= h - 10 || s.birdY - birdRadius <= 0) {
          s.isGameOver = true;
          setIsGameOver(true);
          sound.playGameOver();
          haptics.heavy();
          spawnParticles(birdX, s.birdY);
          submitScore('flappy', s.score).then((res) => {
            if (res.isNewRecord) setIsNewRecord(true);
          });
        }
      }

      // Draw Pipes
      for (const p of s.pipes) {
        // Top Pipe
        const topGrad = ctx.createLinearGradient(p.x, 0, p.x + s.pipeWidth, 0);
        topGrad.addColorStop(0, '#10b981');
        topGrad.addColorStop(0.5, '#34d399');
        topGrad.addColorStop(1, '#059669');

        ctx.fillStyle = topGrad;
        ctx.beginPath();
        ctx.roundRect(p.x, 0, s.pipeWidth, p.topHeight, [0, 0, 8, 8]);
        ctx.fill();

        // Top Pipe Cap
        ctx.fillStyle = '#059669';
        ctx.fillRect(p.x - 3, p.topHeight - 16, s.pipeWidth + 6, 16);

        // Bottom Pipe
        const botGrad = ctx.createLinearGradient(p.x, 0, p.x + s.pipeWidth, 0);
        botGrad.addColorStop(0, '#10b981');
        botGrad.addColorStop(0.5, '#34d399');
        botGrad.addColorStop(1, '#059669');

        ctx.fillStyle = botGrad;
        ctx.beginPath();
        ctx.roundRect(p.x, h - p.bottomHeight, s.pipeWidth, p.bottomHeight, [8, 8, 0, 0]);
        ctx.fill();

        // Bottom Pipe Cap
        ctx.fillStyle = '#059669';
        ctx.fillRect(p.x - 3, h - p.bottomHeight, s.pipeWidth + 6, 16);

        // Draw Floating Coin if available
        if (p.hasCoin && !p.coinCollected) {
          const coinX = p.x + s.pipeWidth / 2;
          const coinY = p.topHeight + s.pipeGap / 2;
          ctx.save();
          ctx.fillStyle = '#fbbf24';
          ctx.shadowColor = '#f59e0b';
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(coinX, coinY, 9, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#d97706';
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🪙', coinX, coinY + 1);
          ctx.restore();
        }
      }

      // Draw Particles
      for (let i = s.particles.length - 1; i >= 0; i--) {
        const pt = s.particles[i];
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.alpha -= 0.03;

        if (pt.alpha <= 0) {
          s.particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, pt.alpha);
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Draw Bird
      const birdX = w * 0.25;
      const birdY = s.birdY;

      ctx.save();
      ctx.translate(birdX, birdY);
      ctx.rotate(s.birdAngle);

      // Bird body
      ctx.shadowColor = 'rgba(245, 158, 11, 0.4)';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.ellipse(0, 0, 16, 13, 0, 0, Math.PI * 2);
      ctx.fill();

      // Wing animation
      const wingY = Math.sin(s.frameCount * 0.4) * 4;
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.ellipse(-4, wingY, 8, 5, 0.2, 0, Math.PI * 2);
      ctx.fill();

      // Eye
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(7, -4, 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(8.5, -4, 2, 0, Math.PI * 2);
      ctx.fill();

      // Beak
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.moveTo(13, -1);
      ctx.lineTo(21, 2);
      ctx.lineTo(13, 5);
      ctx.closePath();
      ctx.fill();

      ctx.restore();

      animFrameId.current = requestAnimationFrame(loop);
    };

    animFrameId.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animFrameId.current);
      window.removeEventListener('resize', resize);
    };
  }, [submitScore]);

  // Restart handler
  const handleRestart = () => {
    const s = gameStateRef.current;
    s.birdY = s.gameHeight * 0.45;
    s.birdVy = 0;
    s.birdAngle = 0;
    s.pipes = [];
    s.particles = [];
    s.score = 0;
    s.collectedCoins = 0;
    s.isGameOver = false;
    s.isStarted = false;
    s.lastPipeX = 0;

    setScore(0);
    setCollectedCoins(0);
    setIsGameOver(false);
    setIsStarted(false);
    setIsNewRecord(false);
  };

  // Rescue Booster (50 coins)
  const handleRescue = async () => {
    if (coins < 50) {
      sound.playUiTap();
      haptics.error();
      showNotice('Нужно 50 🪙 для спасения!');
      return;
    }

    const success = await spendCoins(50, 'flappy_rescue');
    if (success) {
      sound.playPickup();
      haptics.success();

      const s = gameStateRef.current;
      s.birdY = s.gameHeight * 0.45;
      s.birdVy = -4;
      s.isGameOver = false;

      // Clear immediate nearest pipe to grant safe runway
      s.pipes = s.pipes.filter((p) => p.x > s.gameWidth * 0.45);

      setIsGameOver(false);
      showNotice('Птица спасена! Полёт продолжается');
    }
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handleFlap}
      className="relative w-full h-full flex flex-col overflow-hidden select-none touch-none bg-tg-bg"
    >
      {/* Top Header Bar */}
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

        {/* Live Score Counter */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-500">
            <Coins className="w-3.5 h-3.5" />
            <span className="text-xs font-black">+{collectedCoins}</span>
          </div>

          <div className="text-center">
            <span className="text-xl font-black text-tg-text leading-none">{score}</span>
          </div>
        </div>

        {/* Best Score Indicator */}
        <div className="flex items-center gap-1 text-xs font-bold text-tg-hint">
          <Trophy className="w-4 h-4 text-amber-500" />
          <span>{Math.max(score, bestFlappyScore)}</span>
        </div>
      </div>

      {/* Main Canvas Element */}
      <canvas ref={canvasRef} className="w-full h-full block cursor-pointer" />

      {/* Start Prompt Overlay */}
      {!isStarted && !isGameOver && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-6 text-center animate-fade-in">
          <div className="p-4 rounded-3xl bg-black/50 backdrop-blur-md border border-white/15 max-w-xs space-y-3">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-3xl animate-bounce">
              🕊️
            </div>
            <h2 className="text-lg font-black text-white">Flappy Hub</h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Тапай по экрану в любом месте, чтобы взмахивать крыльями и собирать золотые монетки!
            </p>
            <div className="inline-block px-4 py-1.5 rounded-full bg-amber-500 text-slate-950 text-xs font-black shadow-lg">
              Тапни для старта
            </div>
          </div>
        </div>
      )}

      {/* Booster Notification Toast */}
      {boosterNotice && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 bg-tg-secondaryBg border border-amber-500/40 shadow-xl px-4 py-2 rounded-2xl flex items-center gap-2 text-xs font-bold text-tg-text animate-pop">
          <Zap className="w-4 h-4 text-amber-400" />
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
            <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-tr from-amber-500 to-emerald-500 p-[2px] shadow-lg shadow-amber-500/20 flex items-center justify-center">
              <Trophy className="w-8 h-8 text-white fill-white/20" />
            </div>

            <h3 className="text-xl font-black text-tg-text">Полёт завершён!</h3>
            <p className="text-xs text-tg-hint mt-1">Птица задела препятствие</p>

            {/* Score Box */}
            <div className="my-4 p-4 rounded-2xl bg-black/[0.04] dark:bg-tg-bg border border-[var(--tg-theme-section-separator-color)]">
              <span className="text-xs text-tg-hint uppercase font-semibold">Итоговый счёт</span>
              <p className="text-3xl font-black text-amber-500 mt-0.5">{score}</p>

              {isNewRecord && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-500 text-xs font-extrabold animate-bounce">
                  <Sparkles className="w-3.5 h-3.5" /> Новый рекорд в Flappy!
                </div>
              )}

              {collectedCoins > 0 && (
                <p className="text-xs font-bold text-emerald-500 mt-2">
                  +{collectedCoins} 🪙 собрано за полёт
                </p>
              )}
            </div>

            {/* Modal Actions */}
            <div className="space-y-2">
              {score > 0 && (
                <button
                  onClick={handleRescue}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white font-black text-xs shadow-lg shadow-amber-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Zap className="w-4 h-4" />
                  Спасти птицу (Второе дыхание за 50 🪙)
                </button>
              )}

              <button
                onClick={handleRestart}
                className="w-full py-3 px-4 rounded-xl tg-btn-primary font-bold text-sm shadow-lg shadow-indigo-600/30 active:scale-95 transition-all cursor-pointer"
              >
                Лететь снова
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
