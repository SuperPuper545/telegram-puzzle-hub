import type { Shape } from './types';

export const SHAPES: Shape[] = [
  // 1x1 Dot
  {
    id: 'dot-1',
    name: 'Dot',
    matrix: [[1]],
    colorClass: 'bg-emerald-500 border-emerald-400 text-emerald-100',
    glowClass: 'shadow-emerald-500/50',
    accentColor: '#10b981',
  },
  // 1x2 and 2x1
  {
    id: 'line-2-h',
    name: '2-Line H',
    matrix: [[1, 1]],
    colorClass: 'bg-cyan-500 border-cyan-400 text-cyan-100',
    glowClass: 'shadow-cyan-500/50',
    accentColor: '#06b6d4',
  },
  {
    id: 'line-2-v',
    name: '2-Line V',
    matrix: [[1], [1]],
    colorClass: 'bg-cyan-500 border-cyan-400 text-cyan-100',
    glowClass: 'shadow-cyan-500/50',
    accentColor: '#06b6d4',
  },
  // 1x3 and 3x1
  {
    id: 'line-3-h',
    name: '3-Line H',
    matrix: [[1, 1, 1]],
    colorClass: 'bg-blue-500 border-blue-400 text-blue-100',
    glowClass: 'shadow-blue-500/50',
    accentColor: '#3b82f6',
  },
  {
    id: 'line-3-v',
    name: '3-Line V',
    matrix: [[1], [1], [1]],
    colorClass: 'bg-blue-500 border-blue-400 text-blue-100',
    glowClass: 'shadow-blue-500/50',
    accentColor: '#3b82f6',
  },
  // 1x4 and 4x1
  {
    id: 'line-4-h',
    name: '4-Line H',
    matrix: [[1, 1, 1, 1]],
    colorClass: 'bg-indigo-500 border-indigo-400 text-indigo-100',
    glowClass: 'shadow-indigo-500/50',
    accentColor: '#6366f1',
  },
  {
    id: 'line-4-v',
    name: '4-Line V',
    matrix: [[1], [1], [1], [1]],
    colorClass: 'bg-indigo-500 border-indigo-400 text-indigo-100',
    glowClass: 'shadow-indigo-500/50',
    accentColor: '#6366f1',
  },
  // 1x5 and 5x1
  {
    id: 'line-5-h',
    name: '5-Line H',
    matrix: [[1, 1, 1, 1, 1]],
    colorClass: 'bg-violet-500 border-violet-400 text-violet-100',
    glowClass: 'shadow-violet-500/50',
    accentColor: '#8b5cf6',
  },
  {
    id: 'line-5-v',
    name: '5-Line V',
    matrix: [[1], [1], [1], [1], [1]],
    colorClass: 'bg-violet-500 border-violet-400 text-violet-100',
    glowClass: 'shadow-violet-500/50',
    accentColor: '#8b5cf6',
  },
  // 2x2 Square
  {
    id: 'square-2',
    name: '2x2 Square',
    matrix: [
      [1, 1],
      [1, 1],
    ],
    colorClass: 'bg-amber-500 border-amber-400 text-amber-100',
    glowClass: 'shadow-amber-500/50',
    accentColor: '#f59e0b',
  },
  // 3x3 Square
  {
    id: 'square-3',
    name: '3x3 Square',
    matrix: [
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
    ],
    colorClass: 'bg-rose-500 border-rose-400 text-rose-100',
    glowClass: 'shadow-rose-500/50',
    accentColor: '#f43f5e',
  },
  // 2x2 Corners
  {
    id: 'corner-2-tl',
    name: 'Corner TL',
    matrix: [
      [1, 1],
      [1, 0],
    ],
    colorClass: 'bg-teal-500 border-teal-400 text-teal-100',
    glowClass: 'shadow-teal-500/50',
    accentColor: '#14b8a6',
  },
  {
    id: 'corner-2-tr',
    name: 'Corner TR',
    matrix: [
      [1, 1],
      [0, 1],
    ],
    colorClass: 'bg-teal-500 border-teal-400 text-teal-100',
    glowClass: 'shadow-teal-500/50',
    accentColor: '#14b8a6',
  },
  {
    id: 'corner-2-bl',
    name: 'Corner BL',
    matrix: [
      [1, 0],
      [1, 1],
    ],
    colorClass: 'bg-teal-500 border-teal-400 text-teal-100',
    glowClass: 'shadow-teal-500/50',
    accentColor: '#14b8a6',
  },
  {
    id: 'corner-2-br',
    name: 'Corner BR',
    matrix: [
      [0, 1],
      [1, 1],
    ],
    colorClass: 'bg-teal-500 border-teal-400 text-teal-100',
    glowClass: 'shadow-teal-500/50',
    accentColor: '#14b8a6',
  },
  // 3x3 Large Corners
  {
    id: 'corner-3-tl',
    name: 'Big Corner TL',
    matrix: [
      [1, 1, 1],
      [1, 0, 0],
      [1, 0, 0],
    ],
    colorClass: 'bg-orange-500 border-orange-400 text-orange-100',
    glowClass: 'shadow-orange-500/50',
    accentColor: '#f97316',
  },
  {
    id: 'corner-3-br',
    name: 'Big Corner BR',
    matrix: [
      [0, 0, 1],
      [0, 0, 1],
      [1, 1, 1],
    ],
    colorClass: 'bg-orange-500 border-orange-400 text-orange-100',
    glowClass: 'shadow-orange-500/50',
    accentColor: '#f97316',
  },
  // T-Shapes
  {
    id: 't-shape-up',
    name: 'T-Shape Up',
    matrix: [
      [1, 1, 1],
      [0, 1, 0],
    ],
    colorClass: 'bg-purple-500 border-purple-400 text-purple-100',
    glowClass: 'shadow-purple-500/50',
    accentColor: '#a855f7',
  },
  {
    id: 't-shape-down',
    name: 'T-Shape Down',
    matrix: [
      [0, 1, 0],
      [1, 1, 1],
    ],
    colorClass: 'bg-purple-500 border-purple-400 text-purple-100',
    glowClass: 'shadow-purple-500/50',
    accentColor: '#a855f7',
  },
  // L-Shapes (3x2 and 2x3)
  {
    id: 'l-shape-1',
    name: 'L-Shape 1',
    matrix: [
      [1, 0],
      [1, 0],
      [1, 1],
    ],
    colorClass: 'bg-sky-500 border-sky-400 text-sky-100',
    glowClass: 'shadow-sky-500/50',
    accentColor: '#0ea5e9',
  },
  {
    id: 'l-shape-2',
    name: 'L-Shape 2',
    matrix: [
      [0, 1],
      [0, 1],
      [1, 1],
    ],
    colorClass: 'bg-sky-500 border-sky-400 text-sky-100',
    glowClass: 'shadow-sky-500/50',
    accentColor: '#0ea5e9',
  },
  // Z / S shapes
  {
    id: 'z-shape',
    name: 'Z-Shape',
    matrix: [
      [1, 1, 0],
      [0, 1, 1],
    ],
    colorClass: 'bg-pink-500 border-pink-400 text-pink-100',
    glowClass: 'shadow-pink-500/50',
    accentColor: '#ec4899',
  },
  {
    id: 's-shape',
    name: 'S-Shape',
    matrix: [
      [0, 1, 1],
      [1, 1, 0],
    ],
    colorClass: 'bg-pink-500 border-pink-400 text-pink-100',
    glowClass: 'shadow-pink-500/50',
    accentColor: '#ec4899',
  },
];

export function getRandomShape(): Shape {
  const index = Math.floor(Math.random() * SHAPES.length);
  return SHAPES[index];
}

export function generateTrayShapes(): (Shape | null)[] {
  return [getRandomShape(), getRandomShape(), getRandomShape()];
}
