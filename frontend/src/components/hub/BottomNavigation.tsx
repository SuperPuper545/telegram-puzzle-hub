import React from 'react';
import { useGameBridge, type HubTab } from '../../context/GameContext';
import { Gamepad2, Trophy, User } from 'lucide-react';
import { haptics } from '../../telegram/telegram';
import { sound } from '../../utils/sound';

export const BottomNavigation: React.FC = () => {
  const { activeTab, setActiveTab } = useGameBridge();

  const handleTabChange = (tab: HubTab) => {
    haptics.selection();
    sound.playUiTap();
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
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-40 bg-tg-secondaryBg/95 backdrop-blur-xl border-t border-[var(--tg-theme-section-separator-color)] px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-lg">
      <div className="flex items-center justify-around">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-1 cursor-pointer transition-colors select-none ${
                isActive
                  ? 'text-[var(--tg-theme-button-color)] font-bold'
                  : 'text-tg-hint opacity-70 hover:opacity-100 font-medium'
              }`}
            >
              <div className="relative flex items-center justify-center">
                {tab.icon}
              </div>
              <span className="text-[10px] tracking-tight leading-none">
                {tab.label}
              </span>
              {/* Minimalist Native Active Dot Indicator */}
              <div
                className={`w-1 h-1 rounded-full bg-[var(--tg-theme-button-color)] transition-opacity duration-150 ${
                  isActive ? 'opacity-100' : 'opacity-0'
                }`}
              />
            </button>
          );
        })}
      </div>
    </nav>
  );
};
