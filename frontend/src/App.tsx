import React, { useEffect } from 'react';
import { GameProvider, useGameBridge } from './context/GameContext';
import { HubHeader } from './components/hub/HubHeader';
import { BottomNavigation } from './components/hub/BottomNavigation';
import { GameCatalog } from './components/hub/GameCatalog';
import { LeaderboardTab } from './components/hub/LeaderboardTab';
import { FriendsTab } from './components/hub/FriendsTab';
import { ProfileTab } from './components/hub/ProfileTab';
import { DailyRewardModal } from './components/hub/DailyRewardModal';
import { BlockudokuGame } from './games/blockudoku/BlockudokuGame';
import { Match3Game } from './games/match3/Match3Game';
import { Game2048 } from './games/game2048/Game2048';

const HubContent: React.FC = () => {
  const { currentGame, closeGame, activeTab, setActiveTab } = useGameBridge();

  // Desktop keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && currentGame) {
        closeGame();
      }
      if (!currentGame) {
        if (e.key === '1') setActiveTab('catalog');
        if (e.key === '2') setActiveTab('leaderboard');
        if (e.key === '3') setActiveTab('friends');
        if (e.key === '4') setActiveTab('profile');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentGame, closeGame, setActiveTab]);

  if (currentGame === 'blockudoku') {
    return (
      <div className="w-full h-[100dvh] max-h-[100dvh] flex items-center justify-center bg-tg-bg">
        <div className="w-full h-full max-w-md mx-auto flex flex-col overflow-hidden md:border-x md:border-[var(--tg-theme-section-separator-color)] md:shadow-2xl">
          <BlockudokuGame />
        </div>
      </div>
    );
  }

  if (currentGame === 'match3') {
    return (
      <div className="w-full h-[100dvh] max-h-[100dvh] flex items-center justify-center bg-tg-bg">
        <div className="w-full h-full max-w-md mx-auto flex flex-col overflow-hidden md:border-x md:border-[var(--tg-theme-section-separator-color)] md:shadow-2xl">
          <Match3Game />
        </div>
      </div>
    );
  }

  if (currentGame === '2048') {
    return (
      <div className="w-full h-[100dvh] max-h-[100dvh] flex items-center justify-center bg-tg-bg">
        <div className="w-full h-full max-w-md mx-auto flex flex-col overflow-hidden md:border-x md:border-[var(--tg-theme-section-separator-color)] md:shadow-2xl">
          <Game2048 />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-tg-bg flex flex-col items-center justify-start">
      {/* Centered responsive container */}
      <div className="w-full max-w-md mx-auto min-h-screen flex flex-col relative bg-tg-bg md:shadow-2xl md:border-x md:border-[var(--tg-theme-section-separator-color)]">
        {/* HubHeader shown in Catalog, Leaderboard and Friends, hidden in Profile */}
        {activeTab !== 'profile' && <HubHeader />}

        <main className="flex-1 pb-24">
          {activeTab === 'catalog' && <GameCatalog />}
          {activeTab === 'leaderboard' && <LeaderboardTab />}
          {activeTab === 'friends' && <FriendsTab />}
          {activeTab === 'profile' && <ProfileTab />}
        </main>

        {/* Daily Streak Reward Modal */}
        <DailyRewardModal />

        {/* Firmly anchored bottom navigation bar */}
        <BottomNavigation />
      </div>
    </div>
  );
};

export function App() {
  return (
    <GameProvider>
      <HubContent />
    </GameProvider>
  );
}

export default App;
