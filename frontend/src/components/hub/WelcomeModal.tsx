import React, { useState, useEffect } from 'react';
import { useGameBridge } from '../../context/GameContext';
import { Sparkles, Gamepad2, Swords, Globe, X, Gift, Check } from 'lucide-react';
import confetti from 'canvas-confetti';
import { sound } from '../../utils/sound';
import { haptics } from '../../telegram/telegram';

const WELCOME_KEY = 'taptap_hub_welcomed_v1';

export const WelcomeModal: React.FC = () => {
  const { user, awardBonusCoins } = useGameBridge();
  const [isOpen, setIsOpen] = useState(false);
  const [isClaimed, setIsClaimed] = useState(false);

  useEffect(() => {
    try {
      const welcomed = localStorage.getItem(WELCOME_KEY);
      if (!welcomed) {
        // Delay slightly for smooth app entrance
        const timer = setTimeout(() => {
          setIsOpen(true);
        }, 1200);
        return () => clearTimeout(timer);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleClaimBonus = () => {
    sound.playScore();
    haptics.success();
    setIsClaimed(true);

    try {
      localStorage.setItem(WELCOME_KEY, 'true');
    } catch {
      // ignore
    }

    // Award +250 starter coins
    if (awardBonusCoins) {
      awardBonusCoins(250, 'Приветственный бонус новичка');
    }

    confetti({
      particleCount: 80,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#6366f1', '#a855f7', '#ec4899', '#f59e0b'],
    });

    setTimeout(() => {
      setIsOpen(false);
    }, 1500);
  };

  const handleClose = () => {
    try {
      localStorage.setItem(WELCOME_KEY, 'true');
    } catch {
      // ignore
    }
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-sm rounded-3xl bg-tg-secondaryBg border border-indigo-500/30 p-5 shadow-2xl text-tg-text animate-pop overflow-hidden">
        {/* Glow backdrop */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-pink-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-400 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" /> Добро пожаловать!
            </div>
            <button
              onClick={handleClose}
              className="p-1 rounded-lg text-tg-hint hover:text-tg-text cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="text-center space-y-1">
            <h2 className="text-xl font-black text-tg-text">
              Привет, {user.first_name || 'Игрок'}! 🎮
            </h2>
            <p className="text-xs text-tg-hint">
              TapTap Hub — игровая вселенная прямо в твоем Telegram!
            </p>
          </div>

          {/* 3 Core Highlights */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-tg-bg border border-[var(--tg-theme-section-separator-color)]">
              <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 shrink-0">
                <Gamepad2 className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-tg-text">6 хитовых игр</p>
                <p className="text-[10px] text-tg-hint">Blockudoku, Match-3, 2048, Flappy, Knife и Stack</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-tg-bg border border-[var(--tg-theme-section-separator-color)]">
              <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 shrink-0">
                <Swords className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-tg-text">Дуэли со ставками</p>
                <p className="text-[10px] text-tg-hint">Шахматы, Дурак и Морской бой 1 на 1 онлайн</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-tg-bg border border-[var(--tg-theme-section-separator-color)]">
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
                <Globe className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-tg-text">Кланы на Карте Мира</p>
                <p className="text-[10px] text-tg-hint">Привяжи Telegram-чат и захватывай планету</p>
              </div>
            </div>
          </div>

          {/* Bonus Promo Card */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-transparent border border-amber-500/40 flex items-center justify-between shadow-inner">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/25 text-amber-400">
                <Gift className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-black text-amber-400">Стартовый подарок</p>
                <p className="text-[10px] text-tg-hint">Баланс для первых дуэлей и скинов</p>
              </div>
            </div>
            <span className="text-base font-black text-amber-400">+250 🪙</span>
          </div>

          {/* Action Button */}
          <button
            onClick={handleClaimBonus}
            disabled={isClaimed}
            className={`w-full py-3.5 px-4 rounded-2xl font-black text-xs shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 ${
              isClaimed
                ? 'bg-emerald-600 text-white shadow-emerald-600/30'
                : 'tg-btn-primary shadow-indigo-600/30'
            }`}
          >
            {isClaimed ? (
              <>
                <Check className="w-4 h-4" />
                <span>Бонус начислен! Приятной игры!</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Забрать +250 🪙 и начать играть!</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
