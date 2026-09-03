import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  getTelegramUser, 
  getTelegramInitData, 
  setupBackButton, 
  removeBackButton, 
  haptics, 
  initTelegramApp,
  type TgUser 
} from '../telegram/telegram';

export type GameId = 'blockudoku' | 'match3' | '2048';
export type HubTab = 'catalog' | 'leaderboard' | 'profile';

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

interface GameContextType {
  user: TgUser;
  currentGame: GameId | null;
  activeTab: HubTab;
  setActiveTab: (tab: HubTab) => void;
  bestScores: Record<string, number>;
  totalGamesPlayed: number;
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
  const [leaderboards, setLeaderboards] = useState<Record<string, LeaderboardEntry[]>>({});
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState<boolean>(false);

  // Initialize TMA on mount
  useEffect(() => {
    initTelegramApp();
    setUser(getTelegramUser());

    // Fetch user profile from backend
    const initData = getTelegramInitData();
    fetch('/api/me', {
      headers: {
        'Authorization': `tma ${initData}`,
        'x-mock-user-id': String(user.id),
        'x-mock-username': user.first_name || 'Player',
      }
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.scores) {
          setBestScores(prev => {
            const merged = { ...prev, ...data.scores };
            localStorage.setItem(LOCAL_SCORES_KEY, JSON.stringify(merged));
            return merged;
          });
          if (data.totalGamesPlayed !== undefined) {
            setTotalGamesPlayed(data.totalGamesPlayed);
            localStorage.setItem(LOCAL_TOTAL_PLAYED_KEY, String(data.totalGamesPlayed));
          }
        }
      })
      .catch(err => console.log('Using local offline cache for profile:', err));
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

  const submitScore = useCallback(async (gameId: GameId, score: number, duration: number = 0) => {
    // 1. Update local state & localStorage immediately
    const prevBest = bestScores[gameId] || 0;
    const isNewRecord = score > prevBest;
    const newBest = Math.max(prevBest, score);

    const updatedScores = { ...bestScores, [gameId]: newBest };
    setBestScores(updatedScores);
    localStorage.setItem(LOCAL_SCORES_KEY, JSON.stringify(updatedScores));

    const updatedPlayed = totalGamesPlayed + 1;
    setTotalGamesPlayed(updatedPlayed);
    localStorage.setItem(LOCAL_TOTAL_PLAYED_KEY, String(updatedPlayed));

    // 2. Send to backend
    try {
      const initData = getTelegramInitData();
      const res = await fetch('/api/scores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `tma ${initData}`,
          'x-mock-user-id': String(user.id),
          'x-mock-username': user.first_name || 'Player',
        },
        body: JSON.stringify({ gameId, score, duration }),
      });
      if (res.ok) {
        const data = await res.json();
        return { isNewRecord: data.isNewRecord, bestScore: data.bestScore };
      }
    } catch (err) {
      console.warn('Could not sync score with server, saved locally:', err);
    }

    return { isNewRecord, bestScore: newBest };
  }, [bestScores, totalGamesPlayed, user]);

  const fetchLeaderboard = useCallback(async (gameId: GameId) => {
    setIsLoadingLeaderboard(true);
    try {
      const initData = getTelegramInitData();
      const res = await fetch(`/api/leaderboard/${gameId}`, {
        headers: {
          'Authorization': `tma ${initData}`,
        }
      });
      if (res.ok) {
        const data = await res.json();
        setLeaderboards(prev => ({
          ...prev,
          [gameId]: data.leaderboard || [],
        }));
      }
    } catch (err) {
      console.warn('Failed to load leaderboard:', err);
    } finally {
      setIsLoadingLeaderboard(false);
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
    throw new Error('useGameBridge must be used within a GameProvider');
  }
  return context;
};
