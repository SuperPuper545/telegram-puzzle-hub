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

export type GameId = 'blockudoku' | 'match3' | '2048';
export type HubTab = 'catalog' | 'leaderboard' | 'friends' | 'profile';

export interface LeaderboardEntry {
  rank: number;
  userId: number;
  telegramId: string;
  username: string | null;
  firstName: string;
  lastName: string | null;
  photoUrl: string | null;
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
  openGame: (gameId: GameId) => void;
  closeGame: () => void;
  submitScore: (gameId: GameId, score: number, duration?: number) => Promise<{ isNewRecord: boolean; bestScore: number }>;
  leaderboards: Record<string, LeaderboardEntry[]>;
  fetchLeaderboard: (gameId: GameId) => Promise<void>;
  isLoadingLeaderboard: boolean;
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

    // 2. Check for start_param referral deep link
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
        openGame,
        closeGame,
        submitScore,
        leaderboards,
        fetchLeaderboard,
        isLoadingLeaderboard,
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
