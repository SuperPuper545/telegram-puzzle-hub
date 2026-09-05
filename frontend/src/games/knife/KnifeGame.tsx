import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useGameBridge } from '../../context/GameContext';
import { ArrowLeft, Trophy, Sparkles, Coins, Zap, Target } from 'lucide-react';
import { haptics } from '../../telegram/telegram';
import { sound } from '../../utils/sound';

interface EmbeddedKnife {
  angle: number; // Angle on rotating target in radians
}

interface TargetItem {
  angle: number;
  collected: boolean;
}

interface FlyingKnife {
  y: number;
  speed: number;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
}

export const KnifeGame: React.FC = () => {
  const { closeGame, submitScore, coins, spendCoins, bestScores, equippedKnifeSkin } = useGameBridge();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [score, setScore] = useState(0);
  const [stage, setStage] = useState(1);
  const [knivesRemaining, setKnivesRemaining] = useState(7);
  const [collectedCoins, setCollectedCoins] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [boosterNotice, setBoosterNotice] = useState<string | null>(null);

  const bestKnifeScore = bestScores['knife'] || 0;

  // Game state reference for RAF loop
  const gameStateRef = useRef({
    targetRotation: 0,
    targetRotationSpeed: 0.035,
    targetRadius: 65,
    targetCenterY: 170,
    embeddedKnives: [] as EmbeddedKnife[],
    targetCoins: [] as TargetItem[],
    flyingKnife: null as FlyingKnife | null,
    sparks: [] as Spark[],
    knivesLeft: 7,
    totalStageKnives: 7,
    score: 0,
    stage: 1,
    collectedCoins: 0,
    isGameOver: false,
    gameWidth: 360,
    gameHeight: 600,
    knifeLength: 52,
    knifeWidth: 12,
    rotationTimer: 0,
  });

  const animFrameId = useRef<number>(0);

  const showNotice = (msg: string) => {
    setBoosterNotice(msg);
    setTimeout(() => setBoosterNotice(null), 2500);
  };

  // Init stage targets and obstacle knives
  const initStage = useCallback((stageNum: number) => {
    const s = gameStateRef.current;
    s.stage = stageNum;
    setStage(stageNum);

    const isBoss = stageNum % 5 === 0;
    const requiredKnives = isBoss ? 10 : Math.min(10, 6 + Math.floor(stageNum / 2));
    const obstacleCount = isBoss ? 4 : Math.min(5, Math.floor((stageNum - 1) / 2));

    s.knivesLeft = requiredKnives;
    s.totalStageKnives = requiredKnives;
    setKnivesRemaining(requiredKnives);

    s.embeddedKnives = [];
    s.targetCoins = [];
    s.flyingKnife = null;

    // Place obstacle knives
    for (let i = 0; i < obstacleCount; i++) {
      const angle = (i * (Math.PI * 2 / obstacleCount)) + (Math.random() * 0.4);
      s.embeddedKnives.push({ angle });
    }

    // Place 1-2 coins on wheel
    if (Math.random() > 0.3) {
      s.targetCoins.push({
        angle: Math.random() * Math.PI * 2,
        collected: false,
      });
    }

    // Steady, smooth rotation speed
    s.targetRotationSpeed = (stageNum % 2 === 0 ? -1 : 1) * (0.018 + Math.min(0.012, stageNum * 0.002));
    if (isBoss) {
      showNotice(`БОСС УРОВНЯ ${stageNum}! Приготовься`);
    }
  }, []);

  // Throw knife handler - fast, instant throw
  const handleThrow = useCallback(() => {
    const s = gameStateRef.current;
    if (s.isGameOver || s.flyingKnife !== null || s.knivesLeft <= 0) return;

    sound.playFlap();
    haptics.light();

    s.flyingKnife = {
      y: s.gameHeight - 120,
      speed: 42,
    };
  }, []);

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
        gameStateRef.current.targetCenterY = rect.height * 0.28;
      }
    };

    resize();
    window.addEventListener('resize', resize);
    initStage(1);

    const loop = () => {
      const s = gameStateRef.current;
      const w = s.gameWidth;
      const h = s.gameHeight;
      const cx = w / 2;
      const cy = s.targetCenterY;

      ctx.clearRect(0, 0, w, h);

      // Deep dark arena background
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#0a0a0f');
      bg.addColorStop(0.5, '#120d18');
      bg.addColorStop(1, '#1a0d22');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Smooth, steady target rotation (predictable and fair)
      s.targetRotation += s.targetRotationSpeed;

      // Handle flying knife
      if (s.flyingKnife && !s.isGameOver) {
        s.flyingKnife.y -= s.flyingKnife.speed;

        // Check impact with target radius
        const targetImpactY = cy + s.targetRadius;
        if (s.flyingKnife.y <= targetImpactY) {
          // Bottom of wheel (6 o'clock) is at angle 0 in wheel local space.
          // Since wheel is rotated by targetRotation, local impact angle is: -targetRotation
          const impactAngle = -s.targetRotation;
          const normalizedImpact = ((impactAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

          // Check collision with already embedded knives
          let hitOtherKnife = false;
          const collisionAngleTolerance = 0.22; // ~12.5 degrees

          for (const ek of s.embeddedKnives) {
            const normEk = ((ek.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
            let diff = Math.abs(normEk - normalizedImpact);
            if (diff > Math.PI) diff = Math.PI * 2 - diff;

            if (diff < collisionAngleTolerance) {
              hitOtherKnife = true;
              break;
            }
          }

          if (hitOtherKnife) {
            // Clang & Game Over!
            s.isGameOver = true;
            setIsGameOver(true);
            sound.playHit();
            sound.playGameOver();
            haptics.heavy();

            // Spawn sparks
            for (let i = 0; i < 20; i++) {
              s.sparks.push({
                x: cx,
                y: targetImpactY,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8,
                color: '#f59e0b',
                alpha: 1,
              });
            }

            submitScore('knife', s.score).then((res) => {
              if (res.isNewRecord) setIsNewRecord(true);
            });
          } else {
            // Successful embed!
            sound.playHit();
            haptics.medium();
            s.embeddedKnives.push({ angle: impactAngle });
            s.knivesLeft -= 1;
            s.score += 1;
            setKnivesRemaining(s.knivesLeft);
            setScore(s.score);

            // Check coin pickup
            for (const item of s.targetCoins) {
              if (!item.collected) {
                const normItem = ((item.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
                let diff = Math.abs(normItem - normalizedImpact);
                if (diff > Math.PI) diff = Math.PI * 2 - diff;

                if (diff < 0.35) {
                  item.collected = true;
                  s.collectedCoins += 1;
                  setCollectedCoins(s.collectedCoins);
                  sound.playScore();
                }
              }
            }

            s.flyingKnife = null;

            // Check stage clear!
            if (s.knivesLeft <= 0) {
              sound.playClear(2);
              haptics.success();
              initStage(s.stage + 1);
            }
          }
        }
      }

      // Draw Sparks
      for (let i = s.sparks.length - 1; i >= 0; i--) {
        const sp = s.sparks[i];
        sp.x += sp.vx;
        sp.y += sp.vy;
        sp.alpha -= 0.04;

        if (sp.alpha <= 0) {
          s.sparks.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, sp.alpha);
        ctx.fillStyle = sp.color;
        ctx.fillRect(sp.x, sp.y, 3, 3);
        ctx.restore();
      }

      // Draw Rotating Target Wheel
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(s.targetRotation);

      // Target outer rim
      ctx.shadowColor = s.stage % 5 === 0 ? 'rgba(239, 68, 68, 0.4)' : 'rgba(217, 119, 6, 0.3)';
      ctx.shadowBlur = 18;
      ctx.fillStyle = s.stage % 5 === 0 ? '#b91c1c' : '#78350f';
      ctx.beginPath();
      ctx.arc(0, 0, s.targetRadius, 0, Math.PI * 2);
      ctx.fill();

      // Inner wood rings
      ctx.strokeStyle = s.stage % 5 === 0 ? '#ef4444' : '#b45309';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, s.targetRadius - 10, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = s.stage % 5 === 0 ? '#7f1d1d' : '#92400e';
      ctx.beginPath();
      ctx.arc(0, 0, s.targetRadius - 22, 0, Math.PI * 2);
      ctx.fill();

      // Knife style by equipped skin
      let bladeColor = '#f8fafc';
      let handleColor = '#0f172a';
      let glowColor = 'rgba(255, 255, 255, 0.2)';
      let glowBlur = 6;

      if (equippedKnifeSkin === 'knife_flame') {
        bladeColor = '#ef4444';
        handleColor = '#7f1d1d';
        glowColor = 'rgba(239, 68, 68, 0.7)';
        glowBlur = 12;
      } else if (equippedKnifeSkin === 'knife_kunai') {
        bladeColor = '#06b6d4';
        handleColor = '#0e7490';
        glowColor = 'rgba(6, 182, 212, 0.8)';
        glowBlur = 14;
      } else if (equippedKnifeSkin === 'knife_dragon') {
        bladeColor = '#eab308';
        handleColor = '#713f12';
        glowColor = 'rgba(234, 179, 8, 0.8)';
        glowBlur = 14;
      }

      // Embedded Knives
      for (const ek of s.embeddedKnives) {
        ctx.save();
        ctx.rotate(ek.angle);
        ctx.translate(0, s.targetRadius);

        if (glowBlur > 0) {
          ctx.shadowColor = glowColor;
          ctx.shadowBlur = glowBlur;
        }

        // Knife blade sticking out
        ctx.fillStyle = bladeColor;
        ctx.fillRect(-s.knifeWidth / 2, 0, s.knifeWidth, s.knifeLength - 16);

        // Knife handle
        ctx.fillStyle = handleColor;
        ctx.fillRect(-s.knifeWidth / 2 - 1, s.knifeLength - 16, s.knifeWidth + 2, 16);
        ctx.restore();
      }

      // Target Coins
      for (const item of s.targetCoins) {
        if (!item.collected) {
          ctx.save();
          ctx.rotate(item.angle);
          ctx.translate(0, s.targetRadius - 12);
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.arc(0, 0, 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#92400e';
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🪙', 0, 1);
          ctx.restore();
        }
      }

      ctx.restore();

      // Draw Flying Knife if in flight
      if (s.flyingKnife) {
        ctx.save();
        ctx.translate(cx, s.flyingKnife.y);
        if (glowBlur > 0) {
          ctx.shadowColor = glowColor;
          ctx.shadowBlur = glowBlur;
        }
        ctx.fillStyle = bladeColor;
        ctx.fillRect(-s.knifeWidth / 2, 0, s.knifeWidth, s.knifeLength - 16);
        ctx.fillStyle = handleColor;
        ctx.fillRect(-s.knifeWidth / 2 - 1, s.knifeLength - 16, s.knifeWidth + 2, 16);
        ctx.restore();
      } else if (!s.isGameOver && s.knivesLeft > 0) {
        // Draw Ready Knife at bottom
        const readyY = h - 120;
        ctx.save();
        ctx.translate(cx, readyY);
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = glowBlur;
        ctx.fillStyle = bladeColor;
        ctx.fillRect(-s.knifeWidth / 2, 0, s.knifeWidth, s.knifeLength - 16);
        ctx.fillStyle = handleColor;
        ctx.fillRect(-s.knifeWidth / 2 - 1, s.knifeLength - 16, s.knifeWidth + 2, 16);
        ctx.restore();
      }

      animFrameId.current = requestAnimationFrame(loop);
    };

    animFrameId.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animFrameId.current);
      window.removeEventListener('resize', resize);
    };
  }, [initStage, submitScore]);

  // Restart handler
  const handleRestart = () => {
    const s = gameStateRef.current;
    s.score = 0;
    s.collectedCoins = 0;
    s.isGameOver = false;
    setScore(0);
    setCollectedCoins(0);
    setIsGameOver(false);
    setIsNewRecord(false);
    initStage(1);
  };

  // Rescue Booster (50 coins)
  const handleRescue = async () => {
    if (coins < 50) {
      sound.playUiTap();
      haptics.error();
      showNotice('Нужно 50 🪙 для спасения!');
      return;
    }

    const success = await spendCoins(50, 'knife_rescue');
    if (success) {
      sound.playPickup();
      haptics.success();

      const s = gameStateRef.current;
      s.isGameOver = false;
      s.flyingKnife = null;
      s.sparks = [];

      setIsGameOver(false);
      showNotice('Клинок спасен! Продолжай бой');
    }
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handleThrow}
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

        {/* Stage & Coins indicator */}
        <div className="flex items-center gap-2.5">
          <div className="px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 font-extrabold text-xs">
            Этап {stage}
          </div>

          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-500 font-black text-xs">
            <Coins className="w-3.5 h-3.5" />
            <span>+{collectedCoins}</span>
          </div>
        </div>

        {/* Best Score */}
        <div className="flex items-center gap-1 text-xs font-bold text-tg-hint">
          <Trophy className="w-4 h-4 text-amber-500" />
          <span>{Math.max(score, bestKnifeScore)}</span>
        </div>
      </div>

      {/* Main Canvas */}
      <canvas ref={canvasRef} className="w-full h-full block cursor-pointer" />

      {/* Knife Inventory Left Side Indicator */}
      <div className="absolute left-4 bottom-8 flex flex-col gap-1.5 pointer-events-none">
        {Array.from({ length: gameStateRef.current.totalStageKnives }).map((_, i) => (
          <div
            key={i}
            className={`w-2.5 h-5 rounded-sm transition-all duration-200 ${
              i < knivesRemaining
                ? 'bg-rose-500 shadow-md shadow-rose-500/40'
                : 'bg-tg-hint/20 border border-[var(--tg-theme-section-separator-color)]'
            }`}
          />
        ))}
      </div>

      {/* Booster Toast Notice */}
      {boosterNotice && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 bg-tg-secondaryBg border border-rose-500/40 shadow-xl px-4 py-2 rounded-2xl flex items-center gap-2 text-xs font-bold text-tg-text animate-pop">
          <Target className="w-4 h-4 text-rose-400" />
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
            <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-tr from-rose-500 to-amber-500 p-[2px] shadow-lg shadow-rose-500/20 flex items-center justify-center">
              <Trophy className="w-8 h-8 text-white fill-white/20" />
            </div>

            <h3 className="text-xl font-black text-tg-text">Клинок расколот!</h3>
            <p className="text-xs text-tg-hint mt-1">Нож попал в уже вонзённое лезвие</p>

            <div className="my-4 p-4 rounded-2xl bg-black/[0.04] dark:bg-tg-bg border border-[var(--tg-theme-section-separator-color)]">
              <span className="text-xs text-tg-hint uppercase font-semibold">Итоговые очки</span>
              <p className="text-3xl font-black text-rose-500 mt-0.5">{score}</p>
              <p className="text-xs text-tg-hint mt-1">Достигнут этап {stage}</p>

              {score > 0 && (
                <div className="mt-2 py-1.5 px-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between text-xs">
                  <span className="text-tg-hint font-medium">Очки в рейтинг (x60):</span>
                  <span className="font-black text-indigo-400">+{Math.round(score * 60).toLocaleString()} pts</span>
                </div>
              )}

              {isNewRecord && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-500 text-xs font-extrabold animate-bounce">
                  <Sparkles className="w-3.5 h-3.5" /> Новый рекорд в Knife Master!
                </div>
              )}

              {collectedCoins > 0 && (
                <p className="text-xs font-bold text-emerald-500 mt-2">
                  +{collectedCoins} 🪙 собрано за раунд
                </p>
              )}
            </div>

            <div className="space-y-2">
              {score > 3 && (
                <button
                  onClick={handleRescue}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-rose-500 via-red-500 to-amber-500 text-white font-black text-xs shadow-lg shadow-rose-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Zap className="w-4 h-4" />
                  Спасти партию (Второй шанс за 50 🪙)
                </button>
              )}

              <button
                onClick={handleRestart}
                className="w-full py-3 px-4 rounded-xl tg-btn-primary font-bold text-sm shadow-lg shadow-indigo-600/30 active:scale-95 transition-all cursor-pointer"
              >
                Бросить снова
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
