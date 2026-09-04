import React, { useState, useEffect } from 'react';
import { useGameBridge } from '../../context/GameContext';
import { X, Check, Sparkles, Coins, ShoppingBag, Palette, Gem, Layers, Zap, Target, Star, Loader2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { sound } from '../../utils/sound';
import { haptics, getTelegramInitData, getTelegramUser } from '../../telegram/telegram';
import { useLockBodyScroll } from '../../utils/useLockBodyScroll';

type ShopCategory = 'stars' | 'block_skin' | 'gem_skin' | 'tile_skin' | 'bird_skin' | 'stack_skin' | 'knife_skin';

interface StarsProductItem {
  id: string;
  name: string;
  stars: number;
  icon: string;
  description: string;
  badge?: string;
}

const STARS_CATALOG: StarsProductItem[] = [
  { id: 'coins_s', name: 'Пакет монет S', stars: 25, icon: '🪙', description: '+2 500 монет на баланс' },
  { id: 'coins_m', name: 'Пакет монет M', stars: 75, icon: '💰', description: '+10 000 монет на баланс', badge: 'Выгодно' },
  { id: 'coins_l', name: 'Пакет монет L', stars: 200, icon: '🏦', description: '+30 000 монет на баланс', badge: 'Хит 🔥' },
  { id: 'group_boost', name: 'Групповой буст ×1.5', stars: 100, icon: '🚀', description: '+50% ко всем очкам клана на 24 часа' },
  { id: 'extra_tokens', name: 'Экстра токены (+3)', stars: 80, icon: '💎', description: '+3 токена в казну группы на 7 дней' },
  { id: 'cell_shield', name: 'Щит клетки (7 дней)', stars: 30, icon: '🛡️', description: 'Защита клетки карты от атак и саботажа' },
  { id: 'group_color', name: 'Цвет группы', stars: 50, icon: '🎨', description: 'Уникальный цвет клана на карте мира' },
  { id: 'monument_5x5', name: 'Монумент 5x5', stars: 150, icon: '🏛️', description: 'Строительство мега-монумента 5x5 клеток' },
];

export const ShopModal: React.FC = () => {
  const {
    isShopModalOpen,
    setIsShopModalOpen,
    coins,
    shopCatalog,
    fetchShop,
    buyShopItem,
    equipShopItem,
    equippedBlockSkin,
    equippedGemSkin,
    equippedTileSkin,
    equippedBirdSkin,
    equippedStackSkin,
    equippedKnifeSkin,
    refreshProfile,
    fetchMyGroup,
  } = useGameBridge();

  const [activeCategory, setActiveCategory] = useState<ShopCategory>('stars');
  const [loadingItemId, setLoadingItemId] = useState<string | null>(null);
  const [isPurchasingStars, setIsPurchasingStars] = useState<string | null>(null);
  const [starsMessage, setStarsMessage] = useState<string | null>(null);

  useLockBodyScroll(isShopModalOpen);

  useEffect(() => {
    if (isShopModalOpen) {
      fetchShop();
    }
  }, [isShopModalOpen, fetchShop]);

  if (!isShopModalOpen) return null;

  const items = shopCatalog?.items.filter((item) => item.category === activeCategory) || [];

  const categoriesList: { id: ShopCategory; label: string; icon: React.ReactNode; activeColor: string }[] = [
    { id: 'stars', label: 'Звёзды ⭐', icon: <Star className="w-3.5 h-3.5 fill-amber-300" />, activeColor: 'bg-amber-500' },
    { id: 'block_skin', label: 'Блоки', icon: <Palette className="w-3.5 h-3.5" />, activeColor: 'bg-indigo-600' },
    { id: 'gem_skin', label: 'Кристаллы', icon: <Gem className="w-3.5 h-3.5" />, activeColor: 'bg-purple-600' },
    { id: 'tile_skin', label: '2048', icon: <Layers className="w-3.5 h-3.5" />, activeColor: 'bg-amber-600' },
    { id: 'bird_skin', label: 'Птица', icon: <Zap className="w-3.5 h-3.5" />, activeColor: 'bg-emerald-600' },
    { id: 'stack_skin', label: 'Башня', icon: <Sparkles className="w-3.5 h-3.5" />, activeColor: 'bg-cyan-600' },
    { id: 'knife_skin', label: 'Ножи', icon: <Target className="w-3.5 h-3.5" />, activeColor: 'bg-rose-600' },
  ];

  const handleBuy = async (itemId: string, price: number) => {
    if (coins < price) {
      sound.playUiTap();
      haptics.error();
      return;
    }

    setLoadingItemId(itemId);
    sound.playUiTap();

    try {
      const res = await buyShopItem(itemId);
      if (res.success) {
        sound.playRecord();
        haptics.success();
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#f59e0b', '#ec4899', '#8b5cf6', '#10b981'],
        });
      } else {
        haptics.error();
      }
    } finally {
      setLoadingItemId(null);
    }
  };

  const handleEquip = async (itemId: string) => {
    setLoadingItemId(itemId);
    sound.playUiTap();
    haptics.selection();

    try {
      await equipShopItem(itemId);
    } finally {
      setLoadingItemId(null);
    }
  };

  const handleBuyStars = async (product: StarsProductItem) => {
    sound.playUiTap();
    haptics.selection();
    setIsPurchasingStars(product.id);
    setStarsMessage(null);

    try {
      const initData = getTelegramInitData();
      const currentUser = getTelegramUser();
      const res = await fetch('/api/stars/create-invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `tma ${initData}`,
          'x-mock-user-id': String(currentUser.id),
          'x-mock-username': currentUser.first_name || 'Player',
        },
        body: JSON.stringify({ productId: product.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.invoiceLink) {
        throw new Error(data.error || 'Ошибка создания инвойса');
      }

      const tg = (window as any).Telegram?.WebApp;
      if (tg?.openInvoice) {
        tg.openInvoice(data.invoiceLink, (status: string) => {
          if (status === 'paid') {
            sound.playScore();
            haptics.success();
            confetti({
              particleCount: 80,
              spread: 80,
              origin: { y: 0.6 },
              colors: ['#f59e0b', '#ec4899', '#8b5cf6', '#10b981'],
            });
            refreshProfile();
            fetchMyGroup();
            setStarsMessage('Оплата успешно завершена!');
            setTimeout(() => setStarsMessage(null), 4000);
          } else if (status === 'cancelled') {
            setStarsMessage('Оплата отменена');
            setTimeout(() => setStarsMessage(null), 3000);
          } else if (status === 'failed') {
            haptics.error();
            setStarsMessage('Ошибка проведения платежа');
            setTimeout(() => setStarsMessage(null), 3000);
          }
        });
      } else {
        window.open(data.invoiceLink, '_blank');
      }
    } catch (err: any) {
      haptics.error();
      setStarsMessage(err.message || 'Ошибка сети');
      setTimeout(() => setStarsMessage(null), 3000);
    } finally {
      setIsPurchasingStars(null);
    }
  };

  const closeModal = () => {
    sound.playUiTap();
    haptics.selection();
    setIsShopModalOpen(false);
  };

  return (
    <div
      onTouchMove={(e) => {
        if (e.target === e.currentTarget) e.preventDefault();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/80 backdrop-blur-sm animate-fade-in touch-none overscroll-contain"
    >
      <div
        className="relative w-full max-w-sm rounded-3xl bg-white dark:bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] p-5 shadow-2xl overflow-hidden flex flex-col max-h-[85dvh] text-tg-text"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-500/15 text-purple-500">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-tg-text leading-tight">
                Магазин Хаба
              </h2>
              <div className="flex items-center gap-1 mt-0.5">
                <Coins className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs font-black text-amber-500">
                  {coins.toLocaleString()} 🪙
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={closeModal}
            className="p-1.5 rounded-full text-tg-hint hover:text-tg-text active:scale-95 transition-transform cursor-pointer bg-black/[0.05] dark:bg-tg-bg border border-[var(--tg-theme-section-separator-color)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Categories Tab Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden p-1 rounded-2xl bg-black/[0.04] dark:bg-tg-bg border border-[var(--tg-theme-section-separator-color)] mb-3.5 shrink-0">
          {categoriesList.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  sound.playUiTap();
                  haptics.selection();
                  setActiveCategory(cat.id);
                }}
                className={`shrink-0 flex items-center justify-center gap-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? `${cat.activeColor} text-white shadow-md scale-105`
                    : 'text-tg-hint hover:text-tg-text'
                }`}
              >
                {cat.icon}
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {starsMessage && (
          <div className="mb-2.5 p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-xs font-bold text-amber-400 text-center animate-fade-in shrink-0">
            {starsMessage}
          </div>
        )}

        {/* Items List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 -mr-1 overscroll-contain touch-pan-y">
          {activeCategory === 'stars' ? (
            STARS_CATALOG.map((item) => {
              const isLoading = isPurchasingStars === item.id;
              return (
                <div
                  key={item.id}
                  className="p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 bg-gradient-to-r from-amber-500/10 via-black/[0.02] dark:via-tg-bg to-black/[0.03] dark:to-tg-bg border-amber-500/25 shadow-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-xl shadow-md shrink-0">
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-extrabold text-tg-text truncate">
                          {item.name}
                        </p>
                        {item.badge && (
                          <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-[9px] font-black text-amber-400 border border-amber-500/30 shrink-0">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-tg-hint truncate mt-0.5">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <button
                      onClick={() => handleBuyStars(item)}
                      disabled={isLoading || isPurchasingStars !== null}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shadow-md bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-black active:scale-95 shadow-amber-500/25 hover:brightness-105 disabled:opacity-50"
                    >
                      {isLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
                      ) : (
                        <>
                          <Star className="w-3.5 h-3.5 fill-black text-black" />
                          <span>{item.stars}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            items.map((item) => {
              const isEquipped =
              item.id === equippedBlockSkin ||
              item.id === equippedGemSkin ||
              item.id === equippedTileSkin ||
              item.id === equippedBirdSkin ||
              item.id === equippedStackSkin ||
              item.id === equippedKnifeSkin;
            const isPurchased = item.isPurchased || item.price === 0;
            const canAfford = coins >= item.price;
            const isLoading = loadingItemId === item.id;

            return (
              <div
                key={item.id}
                className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                  isEquipped
                    ? 'bg-indigo-500/15 border-indigo-500/40 shadow-sm'
                    : 'bg-black/[0.03] dark:bg-tg-bg border border-[var(--tg-theme-section-separator-color)]'
                }`}
              >
                {/* Item Icon / Swatch */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    style={{ backgroundColor: item.previewColor || '#6366f1' }}
                    className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg shadow-md shrink-0 border border-white/20"
                  >
                    {item.icon || (item.category === 'block_skin' ? '🧩' : item.category === 'gem_skin' ? <div className="w-5 h-5 rounded-lg bg-white/30 border border-white/40 shadow-inner rotate-45" /> : '🔢')}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-tg-text truncate">
                        {item.name}
                      </p>
                      {isEquipped && (
                        <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-[9px] font-black text-emerald-500 border border-emerald-500/30">
                          Активен
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-tg-hint truncate mt-0.5">
                      {item.description}
                    </p>
                  </div>
                </div>

                {/* Action Button */}
                <div className="shrink-0">
                  {isEquipped ? (
                    <div className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-500 text-xs font-black">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>Надето</span>
                    </div>
                  ) : isPurchased ? (
                    <button
                      onClick={() => handleEquip(item.id)}
                      disabled={isLoading}
                      className="px-3.5 py-1.5 rounded-xl bg-black/[0.05] dark:bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] hover:border-indigo-500/40 active:scale-95 text-xs font-bold text-tg-text transition-all cursor-pointer shadow-sm"
                    >
                      {isLoading ? '...' : 'Надеть'}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleBuy(item.id, item.price)}
                      disabled={!canAfford || isLoading}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shadow-md ${
                        canAfford
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white active:scale-95 shadow-amber-500/20 hover:brightness-110'
                          : 'bg-black/[0.05] dark:bg-tg-secondaryBg text-tg-hint border border-[var(--tg-theme-section-separator-color)] opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{item.price} 🪙</span>
                    </button>
                  )}
                </div>
              </div>
            );
          }))}
        </div>
      </div>
    </div>
  );
};
