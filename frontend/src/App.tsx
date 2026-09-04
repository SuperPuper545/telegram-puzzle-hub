import React, { useEffect } from 'react';
import { GameProvider, useGameBridge } from './context/GameContext';
import { HubHeader } from './components/hub/HubHeader';
import { BottomNavigation } from './components/hub/BottomNavigation';
import { GameCatalog } from './components/hub/GameCatalog';
import { LeaderboardTab } from './components/hub/LeaderboardTab';
import { ProfileTab } from './components/hub/ProfileTab';
import { WorldMapTab } from './components/hub/WorldMapTab';
import { DailyRewardModal } from './components/hub/DailyRewardModal';
import { ShopModal } from './components/hub/ShopModal';
import { BlockudokuGame } from './games/blockudoku/BlockudokuGame';
import { Match3Game } from './games/match3/Match3Game';
import { Game2048 } from './games/game2048/Game2048';
import { FlappyGame } from './games/flappy/FlappyGame';
import { TowerStackGame } from './games/stack/TowerStackGame';
import { KnifeGame } from './games/knife/KnifeGame';

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
        if (e.key === '3') setActiveTab('world');
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

  if (currentGame === 'flappy') {
    return (
      <div className="w-full h-[100dvh] max-h-[100dvh] flex items-center justify-center bg-tg-bg">
        <div className="w-full h-full max-w-md mx-auto flex flex-col overflow-hidden md:border-x md:border-[var(--tg-theme-section-separator-color)] md:shadow-2xl">
          <FlappyGame />
        </div>
      </div>
    );
  }

  if (currentGame === 'stack') {
    return (
      <div className="w-full h-[100dvh] max-h-[100dvh] flex items-center justify-center bg-tg-bg">
        <div className="w-full h-full max-w-md mx-auto flex flex-col overflow-hidden md:border-x md:border-[var(--tg-theme-section-separator-color)] md:shadow-2xl">
          <TowerStackGame />
        </div>
      </div>
    );
  }

  if (currentGame === 'knife') {
    return (
      <div className="w-full h-[100dvh] max-h-[100dvh] flex items-center justify-center bg-tg-bg">
        <div className="w-full h-full max-w-md mx-auto flex flex-col overflow-hidden md:border-x md:border-[var(--tg-theme-section-separator-color)] md:shadow-2xl">
          <KnifeGame />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-tg-bg flex flex-col items-center justify-start">
      {/* Centered responsive container */}
      <div className="w-full max-w-md mx-auto min-h-screen flex flex-col relative bg-tg-bg md:shadow-2xl md:border-x md:border-[var(--tg-theme-section-separator-color)]">
        {/* HubHeader shown in Catalog, Leaderboard and World, hidden in Profile */}
        {activeTab !== 'profile' && <HubHeader />}

        <main className={`flex-1 pb-24 ${activeTab !== 'profile' ? 'pt-[56px]' : ''}`}>
          {activeTab === 'catalog' && <GameCatalog />}
          {activeTab === 'leaderboard' && <LeaderboardTab />}
          {activeTab === 'world' && <WorldMapTab />}
          {(activeTab === 'profile' || activeTab === 'friends') && <ProfileTab />}
        </main>

        {/* Daily Streak Reward Modal */}
        <DailyRewardModal />

        {/* Shop Modal */}
        <ShopModal />

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
