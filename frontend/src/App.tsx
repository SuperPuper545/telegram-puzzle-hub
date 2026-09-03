import React from 'react';
import { GameProvider, useGameBridge } from './context/GameContext';
import { HubHeader } from './components/hub/HubHeader';
import { BottomNavigation } from './components/hub/BottomNavigation';
import { GameCatalog } from './components/hub/GameCatalog';
import { LeaderboardTab } from './components/hub/LeaderboardTab';
import { ProfileTab } from './components/hub/ProfileTab';
import { BlockudokuGame } from './games/blockudoku/BlockudokuGame';

const HubContent: React.FC = () => {
  const { currentGame, activeTab } = useGameBridge();

  if (currentGame === 'blockudoku') {
    return <BlockudokuGame />;
  }

  return (
    <div className="flex flex-col min-h-screen max-w-md mx-auto relative bg-slate-950 shadow-2xl">
      <HubHeader />

      <main className="flex-1 overflow-y-auto">
        {activeTab === 'catalog' && <GameCatalog />}
        {activeTab === 'leaderboard' && <LeaderboardTab />}
        {activeTab === 'profile' && <ProfileTab />}
      </main>

      <BottomNavigation />
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
