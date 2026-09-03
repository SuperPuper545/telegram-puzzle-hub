import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  getTelegramUser, 
  getTelegramInitData, 
  setupBackButton, 
  removeBackButton, 
  haptics, 
  initTelegramApp,
  type TgUser,
  getTelegramStartParam
} from '../telegram/telegram';

export type GameId = 'blockudoku' | 'match3' | '2048' | 'flappy' | 'stack' | 'knife';
export type HubTab = 'catalog' | 'leaderboard' | 'friends' | 'profile';

export interface LeaderboardEntry {
  rank: number;
  userId: number;
  telegramId: string;
  username: string | null;
  firstName: string;
  lastName: string | null;
  photoUrl: string | null;
  equippedTitle?: string;
  highScore: number;
  achievedAt: string;
}

export interface DailyRewardStatus {
  coins: number;
  dailyStreak: number;
  canClaim: boolean;
  nextReward: number;
  nextRewardDay: number;
  rewards: number[];
  lastDailyClaim: string | null;
}

export interface ReferralUser {
  id: number;
  telegramId: string;
  firstName: string;
  lastName: string;
  username: string | null;
  photoUrl: string | null;
  bonusPoints: number;
  createdAt: string;
}

export interface ReferralsData {
  telegramId: string;
  invitedCount: number;
  totalEarned: number;
  referrals: ReferralUser[];
  botUsername: string;
}

export interface ShopItem {
  id: string;
  category: 'block_skin' | 'gem_skin' | 'tile_skin' | 'bird_skin' | 'stack_skin' | 'knife_skin';
  name: string;
  description: string;
  price: number;
  previewColor?: string;
  icon?: string;
  isPurchased?: boolean;
  isEquipped?: boolean;
}

export interface EquippedState {
  blockSkin?: string;
  gemSkin?: string;
  tileSkin?: string;
  birdSkin?: string;
  stackSkin?: string;
  knifeSkin?: string;
}

export interface ShopCatalog {
  coins: number;
  equipped: EquippedState;
  items: ShopItem[];
}

interface GameContextType {
  user: TgUser;
  currentGame: GameId | null;
  activeTab: HubTab;
  setActiveTab: (tab: HubTab) => void;
  bestScores: Record<string, number>;
  totalGamesPlayed: number;
  coins: number;
  dailyStreak: number;
  dailyReward: DailyRewardStatus | null;
  isDailyModalOpen: boolean;
  setIsDailyModalOpen: (open: boolean) => void;
  claimDaily: () => Promise<{ success: boolean; reward?: number; error?: string }>;
  referralsData: ReferralsData | null;
  fetchReferrals: () => Promise<void>;
  equippedBlockSkin: string;
  equippedGemSkin: string;
  equippedTileSkin: string;
  equippedBirdSkin: string;
  equippedStackSkin: string;
  equippedKnifeSkin: string;
  isShopModalOpen: boolean;
  setIsShopModalOpen: (open: boolean) => void;
  shopCatalog: ShopCatalog | null;
  fetchShop: () => Promise<void>;
  buyShopItem: (itemId: string) => Promise<{ success: boolean; error?: string }>;
  equipShopItem: (itemId: string) => Promise<{ success: boolean; error?: string }>;
  spendCoins: (amount: number, reason: string) => Promise<boolean>;
  openGame: (gameId: GameId) => void;
  closeGame: () => void;
  submitScore: (gameId: GameId, score: number, duration?: number) => Promise<{ isNewRecord: boolean; bestScore: number }>;
  leaderboards: Record<string, LeaderboardEntry[]>;
  fetchLeaderboard: (gameId: GameId) => Promise<void>;
  isLoadingLeaderboard: boolean;
  refreshProfile: () => Promise<void>;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

const LOCAL_SCORES_KEY = 'tma_hub_best_scores';
const LOCAL_TOTAL_PLAYED_KEY = 'tma_hub_total_played';
const LOCAL_COINS_KEY = 'tma_hub_coins';
const LOCAL_STREAK_KEY = 'tma_hub_streak';

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<TgUser>(() => getTelegramUser());
  const [currentGame, setCurrentGame] = useState<GameId | null>(null);
  const [activeTab, setActiveTab] = useState<HubTab>('catalog');
  const [bestScores, setBestScores] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_SCORES_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [totalGamesPlayed, setTotalGamesPlayed] = useState<number>(() => {
    try {
      return parseInt(localStorage.getItem(LOCAL_TOTAL_PLAYED_KEY) || '0', 10);
    } catch {
      return 0;
    }
  });
  const [coins, setCoins] = useState<number>(() => {
    try {
      return parseInt(localStorage.getItem(LOCAL_COINS_KEY) || '0', 10);
    } catch {
      return 0;
    }
  });
  const [dailyStreak, setDailyStreak] = useState<number>(() => {
    try {
      return parseInt(localStorage.getItem(LOCAL_STREAK_KEY) || '0', 10);
    } catch {
      return 0;
    }
  });
  const [dailyReward, setDailyReward] = useState<DailyRewardStatus | null>(null);
  const [isDailyModalOpen, setIsDailyModalOpen] = useState<boolean>(false);
  const [referralsData, setReferralsData] = useState<ReferralsData | null>(null);
  const [leaderboards, setLeaderboards] = useState<Record<string, LeaderboardEntry[]>>({});
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState<boolean>(false);

  // Shop & Customization State
  const [equippedBlockSkin, setEquippedBlockSkin] = useState<string>(() => {
    return localStorage.getItem('tma_hub_block_skin') || 'block_classic';
  });
  const [equippedGemSkin, setEquippedGemSkin] = useState<string>(() => {
    return localStorage.getItem('tma_hub_gem_skin') || 'gem_classic';
  });
  const [equippedTileSkin, setEquippedTileSkin] = useState<string>(() => {
    return localStorage.getItem('tma_hub_tile_skin') || 'tile_classic';
  });
  const [equippedBirdSkin, setEquippedBirdSkin] = useState<string>(() => {
    return localStorage.getItem('tma_hub_bird_skin') || 'bird_classic';
  });
  const [equippedStackSkin, setEquippedStackSkin] = useState<string>(() => {
    return localStorage.getItem('tma_hub_stack_skin') || 'stack_classic';
  });
  const [equippedKnifeSkin, setEquippedKnifeSkin] = useState<string>(() => {
    return localStorage.getItem('tma_hub_knife_skin') || 'knife_classic';
  });
  const [isShopModalOpen, setIsShopModalOpen] = useState<boolean>(false);
  const [shopCatalog, setShopCatalog] = useState<ShopCatalog | null>(null);

  // Initialize TMA on mount
  useEffect(() => {
    initTelegramApp();
    const currentUser = getTelegramUser();
    setUser(currentUser);

    const initData = getTelegramInitData();
    const headers = {
      'Authorization': `tma ${initData}`,
      'x-mock-user-id': String(currentUser.id),
      'x-mock-username': currentUser.first_name || 'Player',
    };

    // 1. Fetch user profile & daily reward from backend
    fetch('/api/me', { headers })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          if (data.scores) {
            setBestScores(prev => {
              const merged = { ...prev, ...data.scores };
              localStorage.setItem(LOCAL_SCORES_KEY, JSON.stringify(merged));
              return merged;
            });
          }
          if (data.totalGamesPlayed !== undefined) {
            setTotalGamesPlayed(data.totalGamesPlayed);
            localStorage.setItem(LOCAL_TOTAL_PLAYED_KEY, String(data.totalGamesPlayed));
          }
          if (data.user) {
            if (typeof data.user.coins === 'number') {
              setCoins(data.user.coins);
              localStorage.setItem(LOCAL_COINS_KEY, String(data.user.coins));
            }
            if (typeof data.user.dailyStreak === 'number') {
              setDailyStreak(data.user.dailyStreak);
              localStorage.setItem(LOCAL_STREAK_KEY, String(data.user.dailyStreak));
            }
            if (data.user.equippedBlockSkin) {
              setEquippedBlockSkin(data.user.equippedBlockSkin);
              localStorage.setItem('tma_hub_block_skin', data.user.equippedBlockSkin);
            }
            if (data.user.equippedGemSkin) {
              setEquippedGemSkin(data.user.equippedGemSkin);
              localStorage.setItem('tma_hub_gem_skin', data.user.equippedGemSkin);
            }
            if (data.user.equippedTileSkin) {
              setEquippedTileSkin(data.user.equippedTileSkin);
              localStorage.setItem('tma_hub_tile_skin', data.user.equippedTileSkin);
            }
            if (data.user.equippedBirdSkin) {
              setEquippedBirdSkin(data.user.equippedBirdSkin);
              localStorage.setItem('tma_hub_bird_skin', data.user.equippedBirdSkin);
            }
            if (data.user.equippedStackSkin) {
              setEquippedStackSkin(data.user.equippedStackSkin);
              localStorage.setItem('tma_hub_stack_skin', data.user.equippedStackSkin);
            }
            if (data.user.equippedKnifeSkin) {
              setEquippedKnifeSkin(data.user.equippedKnifeSkin);
              localStorage.setItem('tma_hub_knife_skin', data.user.equippedKnifeSkin);
            }
          }
          if (data.dailyReward) {
            setDailyReward(data.dailyReward);
            if (data.dailyReward.canClaim) {
              setTimeout(() => setIsDailyModalOpen(true), 600);
            }
          }
        }
      })
      .catch(err => console.log('Using local offline cache for profile:', err));

    // 2. Check for start_param referral or duel deep link
    const startParam = getTelegramStartParam();
    if (startParam && startParam.startsWith('ref_')) {
      fetch('/api/referrals/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({ startParam }),
      })
        .then(res => res.ok ? res.json() : null)
        .then(resData => {
          if (resData?.success) {
            if (typeof resData.newCoins === 'number') {
              setCoins(resData.newCoins);
              localStorage.setItem(LOCAL_COINS_KEY, String(resData.newCoins));
            }
          }
        })
        .catch(err => console.warn('Referral claim error:', err));
    } else if (startParam && startParam.startsWith('duel_')) {
      // Store duel room ID for DuelLobby to join automatically
      try { localStorage.setItem('hub_pending_duel_room', startParam.slice(5)); } catch { /* ignore */ }
    }
  }, []);

  const closeGame = useCallback(() => {
    haptics.selection();
    setCurrentGame(null);
    removeBackButton();
  }, []);

  const openGame = useCallback((gameId: GameId) => {
    haptics.selection();
    setCurrentGame(gameId);
    setupBackButton(() => {
      closeGame();
    });
  }, [closeGame]);

  const refreshProfile = useCallback(async () => {
    try {
      const initData = getTelegramInitData();
      const currentUser = getTelegramUser();
      const headers = { 'Authorization': `tma ${initData}`, 'x-mock-user-id': String(currentUser.id), 'x-mock-username': currentUser.first_name || 'Player' };
      const res = await fetch('/api/me', { headers });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.user && typeof data.user.coins === 'number') {
        setCoins(data.user.coins);
        localStorage.setItem(LOCAL_COINS_KEY, String(data.user.coins));
      }
    } catch { /* ignore */ }
  }, []);

  // Stable submitScore using functional state updates
  const submitScore = useCallback(async (gameId: GameId, score: number, duration: number = 0) => {
    let isNewRecord = false;
    let newBest = score;

    setBestScores((prev) => {
      const prevBest = prev[gameId] || 0;
      isNewRecord = score > prevBest;
      newBest = Math.max(prevBest, score);
      const updated = { ...prev, [gameId]: newBest };
      try {
        localStorage.setItem(LOCAL_SCORES_KEY, JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });

    setTotalGamesPlayed((prev) => {
      const updated = prev + 1;
      try {
        localStorage.setItem(LOCAL_TOTAL_PLAYED_KEY, String(updated));
      } catch (_) {}
      return updated;
    });

    // Send to backend
    try {
      const initData = getTelegramInitData();
      const currentUser = getTelegramUser();
      const res = await fetch('/api/scores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `tma ${initData}`,
          'x-mock-user-id': String(currentUser.id),
          'x-mock-username': currentUser.first_name || 'Player',
        },
        body: JSON.stringify({ gameId, score, duration }),
      });

      if (res.ok) {
        const data = await res.json();
        return {
          isNewRecord: data.isNewRecord ?? isNewRecord,
          bestScore: data.highScore ?? newBest,
        };
      }
    } catch (err) {
      console.warn('Could not post score to server (offline mode):', err);
    }

    return { isNewRecord, bestScore: newBest };
  }, []);

  const fetchLeaderboard = useCallback(async (gameId: GameId) => {
    setIsLoadingLeaderboard(true);
    try {
      const res = await fetch(`/api/leaderboard/${gameId}`);
      if (res.ok) {
        const data = await res.json();
        setLeaderboards(prev => ({ ...prev, [gameId]: data.leaderboard || [] }));
      }
    } catch (err) {
      console.warn(`Failed to fetch leaderboard for ${gameId}:`, err);
    } finally {
      setIsLoadingLeaderboard(false);
    }
  }, []);

  const fetchReferrals = useCallback(async () => {
    try {
      const initData = getTelegramInitData();
      const currentUser = getTelegramUser();
      const res = await fetch('/api/referrals', {
        headers: {
          'Authorization': `tma ${initData}`,
          'x-mock-user-id': String(currentUser.id),
          'x-mock-username': currentUser.first_name || 'Player',
        },
      });
      if (res.ok) {
        const data = await res.json();
        setReferralsData(data);
      }
    } catch (err) {
      console.warn('Failed to fetch referrals:', err);
    }
  }, []);

  const claimDaily = useCallback(async () => {
    try {
      const initData = getTelegramInitData();
      const currentUser = getTelegramUser();
      const res = await fetch('/api/daily-reward/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `tma ${initData}`,
          'x-mock-user-id': String(currentUser.id),
          'x-mock-username': currentUser.first_name || 'Player',
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCoins(data.coins);
        setDailyStreak(data.dailyStreak);
        try {
          localStorage.setItem(LOCAL_COINS_KEY, String(data.coins));
          localStorage.setItem(LOCAL_STREAK_KEY, String(data.dailyStreak));
        } catch (_) {}
        setDailyReward(prev => prev ? {
          ...prev,
          coins: data.coins,
          dailyStreak: data.dailyStreak,
          canClaim: false,
          lastDailyClaim: new Date().toISOString(),
        } : null);
        return { success: true, reward: data.reward };
      }
      return { success: false, error: data.error || 'Не удалось забрать награду' };
    } catch (err) {
      return { success: false, error: 'Ошибка подключения к серверу' };
    }
  }, []);

  const spendCoins = useCallback(async (amount: number, reason: string): Promise<boolean> => {
    if (coins < amount) {
      return false;
    }
    const newCoins = Math.max(0, coins - amount);
    setCoins(newCoins);
    try {
      localStorage.setItem(LOCAL_COINS_KEY, String(newCoins));
    } catch (_) {}

    try {
      const initData = getTelegramInitData();
      const currentUser = getTelegramUser();
      const res = await fetch('/api/coins/spend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `tma ${initData}`,
          'x-mock-user-id': String(currentUser.id),
          'x-mock-username': currentUser.first_name || 'Player',
        },
        body: JSON.stringify({ amount, reason }),
      });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.remainingCoins === 'number') {
          setCoins(data.remainingCoins);
          localStorage.setItem(LOCAL_COINS_KEY, String(data.remainingCoins));
        }
        return true;
      }
      return false;
    } catch {
      return true;
    }
  }, [coins]);

  const fetchShop = useCallback(async () => {
    try {
      const initData = getTelegramInitData();
      const currentUser = getTelegramUser();
      const res = await fetch('/api/shop/items', {
        headers: {
          'Authorization': `tma ${initData}`,
          'x-mock-user-id': String(currentUser.id),
          'x-mock-username': currentUser.first_name || 'Player',
        },
      });
      if (res.ok) {
        const data = await res.json();
        setShopCatalog(data);
        if (typeof data.coins === 'number') {
          setCoins(data.coins);
          localStorage.setItem(LOCAL_COINS_KEY, String(data.coins));
        }
        if (data.equipped) {
          if (data.equipped.blockSkin) {
            setEquippedBlockSkin(data.equipped.blockSkin);
            localStorage.setItem('tma_hub_block_skin', data.equipped.blockSkin);
          }
          if (data.equipped.gemSkin) {
            setEquippedGemSkin(data.equipped.gemSkin);
            localStorage.setItem('tma_hub_gem_skin', data.equipped.gemSkin);
          }
          if (data.equipped.tileSkin) {
            setEquippedTileSkin(data.equipped.tileSkin);
            localStorage.setItem('tma_hub_tile_skin', data.equipped.tileSkin);
          }
          if (data.equipped.birdSkin) {
            setEquippedBirdSkin(data.equipped.birdSkin);
            localStorage.setItem('tma_hub_bird_skin', data.equipped.birdSkin);
          }
          if (data.equipped.stackSkin) {
            setEquippedStackSkin(data.equipped.stackSkin);
            localStorage.setItem('tma_hub_stack_skin', data.equipped.stackSkin);
          }
          if (data.equipped.knifeSkin) {
            setEquippedKnifeSkin(data.equipped.knifeSkin);
            localStorage.setItem('tma_hub_knife_skin', data.equipped.knifeSkin);
          }
        }
      }
    } catch (err) {
      console.warn('Failed to fetch shop catalog:', err);
    }
  }, []);

  const buyShopItem = useCallback(async (itemId: string) => {
    try {
      const initData = getTelegramInitData();
      const currentUser = getTelegramUser();
      const res = await fetch('/api/shop/buy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `tma ${initData}`,
          'x-mock-user-id': String(currentUser.id),
          'x-mock-username': currentUser.first_name || 'Player',
        },
        body: JSON.stringify({ itemId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (typeof data.remainingCoins === 'number') {
          setCoins(data.remainingCoins);
          localStorage.setItem(LOCAL_COINS_KEY, String(data.remainingCoins));
        }
        if (data.equipped) {
          if (data.equipped.blockSkin) {
            setEquippedBlockSkin(data.equipped.blockSkin);
            localStorage.setItem('tma_hub_block_skin', data.equipped.blockSkin);
          }
          if (data.equipped.gemSkin) {
            setEquippedGemSkin(data.equipped.gemSkin);
            localStorage.setItem('tma_hub_gem_skin', data.equipped.gemSkin);
          }
          if (data.equipped.tileSkin) {
            setEquippedTileSkin(data.equipped.tileSkin);
            localStorage.setItem('tma_hub_tile_skin', data.equipped.tileSkin);
          }
          if (data.equipped.birdSkin) {
            setEquippedBirdSkin(data.equipped.birdSkin);
            localStorage.setItem('tma_hub_bird_skin', data.equipped.birdSkin);
          }
          if (data.equipped.stackSkin) {
            setEquippedStackSkin(data.equipped.stackSkin);
            localStorage.setItem('tma_hub_stack_skin', data.equipped.stackSkin);
          }
          if (data.equipped.knifeSkin) {
            setEquippedKnifeSkin(data.equipped.knifeSkin);
            localStorage.setItem('tma_hub_knife_skin', data.equipped.knifeSkin);
          }
        }
        await fetchShop();
        return { success: true };
      }
      return { success: false, error: data.error || 'Ошибка при покупке' };
    } catch {
      return { success: false, error: 'Ошибка соединения с сервером' };
    }
  }, [fetchShop]);

  const equipShopItem = useCallback(async (itemId: string) => {
    try {
      const initData = getTelegramInitData();
      const currentUser = getTelegramUser();
      const res = await fetch('/api/shop/equip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `tma ${initData}`,
          'x-mock-user-id': String(currentUser.id),
          'x-mock-username': currentUser.first_name || 'Player',
        },
        body: JSON.stringify({ itemId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.equipped) {
          if (data.equipped.blockSkin) {
            setEquippedBlockSkin(data.equipped.blockSkin);
            localStorage.setItem('tma_hub_block_skin', data.equipped.blockSkin);
          }
          if (data.equipped.gemSkin) {
            setEquippedGemSkin(data.equipped.gemSkin);
            localStorage.setItem('tma_hub_gem_skin', data.equipped.gemSkin);
          }
          if (data.equipped.tileSkin) {
            setEquippedTileSkin(data.equipped.tileSkin);
            localStorage.setItem('tma_hub_tile_skin', data.equipped.tileSkin);
          }
          if (data.equipped.birdSkin) {
            setEquippedBirdSkin(data.equipped.birdSkin);
            localStorage.setItem('tma_hub_bird_skin', data.equipped.birdSkin);
          }
          if (data.equipped.stackSkin) {
            setEquippedStackSkin(data.equipped.stackSkin);
            localStorage.setItem('tma_hub_stack_skin', data.equipped.stackSkin);
          }
          if (data.equipped.knifeSkin) {
            setEquippedKnifeSkin(data.equipped.knifeSkin);
            localStorage.setItem('tma_hub_knife_skin', data.equipped.knifeSkin);
          }
        }
        await fetchShop();
        return { success: true };
      }
      return { success: false, error: data.error || 'Ошибка экипировки' };
    } catch {
      return { success: false, error: 'Ошибка соединения с сервером' };
    }
  }, [fetchShop]);

  return (
    <GameContext.Provider
      value={{
        user,
        currentGame,
        activeTab,
        setActiveTab,
        bestScores,
        totalGamesPlayed,
        coins,
        dailyStreak,
        dailyReward,
        isDailyModalOpen,
        setIsDailyModalOpen,
        claimDaily,
        referralsData,
        fetchReferrals,
        equippedBlockSkin,
        equippedGemSkin,
        equippedTileSkin,
        equippedBirdSkin,
        equippedStackSkin,
        equippedKnifeSkin,
        isShopModalOpen,
        setIsShopModalOpen,
        shopCatalog,
        fetchShop,
        buyShopItem,
        equipShopItem,
        spendCoins,
        openGame,
        closeGame,
        submitScore,
        leaderboards,
        fetchLeaderboard,
        isLoadingLeaderboard,
        refreshProfile,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};

export const useGameBridge = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGameBridge must be used within GameProvider');
  }
  return context;
};
