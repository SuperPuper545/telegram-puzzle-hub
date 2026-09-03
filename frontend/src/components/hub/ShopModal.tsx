import React, { useState, useEffect } from 'react';
import { useGameBridge } from '../../context/GameContext';
import { X, Check, Sparkles, Coins, ShoppingBag, Palette, Gem, Layers } from 'lucide-react';
import confetti from 'canvas-confetti';
import { sound } from '../../utils/sound';
import { haptics } from '../../telegram/telegram';

type ShopCategory = 'block_skin' | 'gem_skin' | 'tile_skin';

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
  } = useGameBridge();

  const [activeCategory, setActiveCategory] = useState<ShopCategory>('block_skin');
  const [loadingItemId, setLoadingItemId] = useState<string | null>(null);

  useEffect(() => {
    if (isShopModalOpen) {
      fetchShop();
    }
  }, [isShopModalOpen, fetchShop]);

  if (!isShopModalOpen) return null;

  const items = shopCatalog?.items.filter((item) => item.category === activeCategory) || [];

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

  const closeModal = () => {
    sound.playUiTap();
    haptics.selection();
    setIsShopModalOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        className="relative w-full max-w-sm rounded-3xl bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] p-5 shadow-2xl overflow-hidden flex flex-col max-h-[85dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-amber-500/20 rounded-full blur-2xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-500/15 text-purple-400">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-tg-text leading-tight">
                Магазин Хаба
              </h2>
              <div className="flex items-center gap-1 mt-0.5">
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-black text-amber-300">
                  {coins.toLocaleString()} 🪙
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={closeModal}
            className="p-1.5 rounded-full text-tg-hint hover:text-tg-text active:scale-95 transition-transform cursor-pointer bg-black/20"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Categories Tab Bar */}
        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-black/20 border border-white/5 mb-3.5 shrink-0">
          <button
            onClick={() => {
              sound.playUiTap();
              haptics.selection();
              setActiveCategory('block_skin');
            }}
            className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeCategory === 'block_skin'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-tg-hint hover:text-tg-text'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Блоки</span>
          </button>

          <button
            onClick={() => {
              sound.playUiTap();
              haptics.selection();
              setActiveCategory('gem_skin');
            }}
            className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeCategory === 'gem_skin'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-tg-hint hover:text-tg-text'
            }`}
          >
            <Gem className="w-3.5 h-3.5" />
            <span>Кристаллы</span>
          </button>

          <button
            onClick={() => {
              sound.playUiTap();
              haptics.selection();
              setActiveCategory('tile_skin');
            }}
            className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeCategory === 'tile_skin'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-tg-hint hover:text-tg-text'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>2048</span>
          </button>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 -mr-1">
          {items.map((item) => {
            const isEquipped =
              item.id === equippedBlockSkin ||
              item.id === equippedGemSkin ||
              item.id === equippedTileSkin;
            const isPurchased = item.isPurchased || item.price === 0;
            const canAfford = coins >= item.price;
            const isLoading = loadingItemId === item.id;

            return (
              <div
                key={item.id}
                className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                  isEquipped
                    ? 'bg-indigo-950/30 border-indigo-500/50 shadow-sm'
                    : 'bg-black/15 border-white/5 hover:border-white/10'
                }`}
              >
                {/* Item Icon / Swatch */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    style={{ backgroundColor: item.previewColor || '#6366f1' }}
                    className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg shadow-md shrink-0 border border-white/20"
                  >
                    {item.icon || (item.category === 'block_skin' ? '🧩' : item.category === 'gem_skin' ? '💎' : '🔢')}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-tg-text truncate">
                        {item.name}
                      </p>
                      {isEquipped && (
                        <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-[9px] font-black text-emerald-400 border border-emerald-500/30">
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
                    <div className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-xs font-black">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>Надето</span>
                    </div>
                  ) : isPurchased ? (
                    <button
                      onClick={() => handleEquip(item.id)}
                      disabled={isLoading}
                      className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 active:scale-95 text-xs font-bold text-tg-text transition-all cursor-pointer"
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
                          : 'bg-white/5 text-tg-hint border border-white/5 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{item.price} 🪙</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
