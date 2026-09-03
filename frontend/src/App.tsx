import React, { useEffect } from 'react';
import { GameProvider, useGameBridge } from './context/GameContext';
import { HubHeader } from './components/hub/HubHeader';
import { BottomNavigation } from './components/hub/BottomNavigation';
import { GameCatalog } from './components/hub/GameCatalog';
import { LeaderboardTab } from './components/hub/LeaderboardTab';
import { ProfileTab } from './components/hub/ProfileTab';
import { BlockudokuGame } from './games/blockudoku/BlockudokuGame';

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
        if (e.key === '3') setActiveTab('profile');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentGame, closeGame, setActiveTab]);

  if (currentGame === 'blockudoku') {
    return (
      <div className="w-full h-[100dvh] max-h-[100dvh] flex items-center justify-center bg-slate-950">
        <div className="w-full h-full max-w-md mx-auto flex flex-col overflow-hidden md:border-x md:border-slate-800/80 md:shadow-2xl">
          <BlockudokuGame />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-start md:py-6 md:px-4">
      {/* Container with responsive desktop framing */}
      <div className="w-full max-w-md mx-auto min-h-screen md:min-h-[840px] md:h-[840px] flex flex-col relative bg-tg-bg md:rounded-3xl md:border md:border-slate-800/80 md:shadow-2xl md:shadow-indigo-500/10 overflow-hidden">
        <HubHeader />

        <main className="flex-1 overflow-y-auto overscroll-contain">
          {activeTab === 'catalog' && <GameCatalog />}
          {activeTab === 'leaderboard' && <LeaderboardTab />}
          {activeTab === 'profile' && <ProfileTab />}
        </main>

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
