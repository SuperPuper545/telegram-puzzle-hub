import type { GemDefinition } from './types';

export const GEM_TYPES_COUNT = 5;

export const GEM_DEFINITIONS: GemDefinition[] = [
  {
    name: 'Рубин',
    color: 'text-rose-400',
    gradient: 'from-rose-500 via-red-500 to-rose-700',
    glow: 'shadow-rose-500/50 shadow-md',
    border: 'border-rose-300/60',
    icon: '💎',
  },
  {
    name: 'Сапфир',
    color: 'text-sky-400',
    gradient: 'from-sky-400 via-blue-500 to-indigo-600',
    glow: 'shadow-sky-500/50 shadow-md',
    border: 'border-sky-300/60',
    icon: '💠',
  },
  {
    name: 'Изумруд',
    color: 'text-emerald-400',
    gradient: 'from-emerald-400 via-green-500 to-teal-700',
    glow: 'shadow-emerald-500/50 shadow-md',
    border: 'border-emerald-300/60',
    icon: '🟢',
  },
  {
    name: 'Топаз',
    color: 'text-amber-400',
    gradient: 'from-amber-300 via-yellow-500 to-amber-600',
    glow: 'shadow-amber-500/50 shadow-md',
    border: 'border-amber-200/70',
    icon: '⭐',
  },
  {
    name: 'Аметист',
    color: 'text-purple-400',
    gradient: 'from-purple-400 via-violet-500 to-fuchsia-700',
    glow: 'shadow-purple-500/50 shadow-md',
    border: 'border-purple-300/60',
    icon: '🔮',
  },
];

export function getGemDefinition(type: number, skinId: string = 'gem_classic'): GemDefinition {
  const base = GEM_DEFINITIONS[type] || GEM_DEFINITIONS[0];

  if (skinId === 'gem_orbs') {
    const orbIcons = ['🔴', '🔵', '🟢', '🟡', '🟣'];
    return {
      ...base,
      icon: orbIcons[type] || '🔮',
      glow: `${base.glow} rounded-full ring-2 ring-white/30`,
    };
  }

  if (skinId === 'gem_candy') {
    const candyIcons = ['🍓', '🫐', '🍏', '🍋', '🍇'];
    return {
      ...base,
      icon: candyIcons[type] || '🍬',
    };
  }

  return base;
}
