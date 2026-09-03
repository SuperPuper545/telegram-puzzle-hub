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
  // T-Shapes (All 4 Directions)
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
  {
    id: 't-shape-left',
    name: 'T-Shape Left',
    matrix: [
      [1, 0],
      [1, 1],
      [1, 0],
    ],
    colorClass: 'bg-purple-500 border-purple-400 text-purple-100',
    glowClass: 'shadow-purple-500/50',
    accentColor: '#a855f7',
  },
  {
    id: 't-shape-right',
    name: 'T-Shape Right',
    matrix: [
      [0, 1],
      [1, 1],
      [0, 1],
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

// Difficulty Categories for Balanced Tray Generation
const SMALL_SHAPES = SHAPES.filter((s) => ['dot-1', 'line-2-h', 'line-2-v', 'line-3-h', 'line-3-v', 'corner-2-tl', 'corner-2-tr', 'corner-2-bl', 'corner-2-br'].includes(s.id));
const MEDIUM_SHAPES = SHAPES.filter((s) => ['square-2', 'line-4-h', 'line-4-v', 't-shape-up', 't-shape-down', 't-shape-left', 't-shape-right', 'l-shape-1', 'l-shape-2'].includes(s.id));
const LARGE_SHAPES = SHAPES.filter((s) => ['line-5-h', 'line-5-v', 'corner-3-tl', 'corner-3-br', 'z-shape', 's-shape'].includes(s.id));

function pickRandom(arr: Shape[]): Shape {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function getRandomShape(): Shape {
  const rand = Math.random();
  if (rand < 0.45) return pickRandom(SMALL_SHAPES);
  if (rand < 0.85) return pickRandom(MEDIUM_SHAPES);
  return pickRandom(LARGE_SHAPES);
}

/**
 * Balanced Tray Generation:
 * Always delivers at least 1-2 playable/convenient shapes, and at most 1 large shape,
 * preventing unfair deadlocks while keeping the puzzle dynamic and rewarding.
 */
export function generateTrayShapes(): (Shape | null)[] {
  const hasLarge = Math.random() < 0.35;
  if (hasLarge) {
    return [
      pickRandom(SMALL_SHAPES),
      pickRandom(MEDIUM_SHAPES),
      pickRandom(LARGE_SHAPES),
    ].sort(() => Math.random() - 0.5);
  }

  return [
    pickRandom(SMALL_SHAPES),
    Math.random() < 0.5 ? pickRandom(SMALL_SHAPES) : pickRandom(MEDIUM_SHAPES),
    pickRandom(MEDIUM_SHAPES),
  ].sort(() => Math.random() - 0.5);
}
