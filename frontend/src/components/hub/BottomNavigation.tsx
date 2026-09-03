import React from 'react';
import { useGameBridge, type HubTab } from '../../context/GameContext';
import { Gamepad2, Trophy, User } from 'lucide-react';
import { haptics } from '../../telegram/telegram';

export const BottomNavigation: React.FC = () => {
  const { activeTab, setActiveTab } = useGameBridge();

  const handleTabChange = (tab: HubTab) => {
    haptics.selection();
    setActiveTab(tab);
  };

  const tabs: { id: HubTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'catalog',
      label: 'Игры',
      icon: <Gamepad2 className="w-5 h-5" />,
    },
    {
      id: 'leaderboard',
      label: 'Лидерборд',
      icon: <Trophy className="w-5 h-5" />,
    },
    {
      id: 'profile',
      label: 'Профиль',
      icon: <User className="w-5 h-5" />,
    },
  ];

  return (
    <nav className="sticky bottom-0 left-0 right-0 z-30 bg-tg-secondaryBg/95 backdrop-blur-md border-t border-slate-800/80 px-4 py-2 pb-[max(0.6rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-around">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex flex-col items-center gap-1 py-1 px-4 rounded-xl transition-all duration-150 cursor-pointer ${
                isActive
                  ? 'text-indigo-400 font-semibold scale-105'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className={`p-1 rounded-lg transition-colors ${isActive ? 'bg-indigo-500/15' : ''}`}>
                {tab.icon}
              </div>
              <span className="text-[11px] leading-none tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
