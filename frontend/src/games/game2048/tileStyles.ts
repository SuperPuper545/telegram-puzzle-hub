export interface TileStyle {
  bg: string;
  text: string;
  glow?: string;
  fontSize: string;
}

export function getTileStyle(val: number): TileStyle {
  switch (val) {
    case 2:
      return {
        bg: 'bg-slate-200 border-slate-300',
        text: 'text-slate-800',
        fontSize: 'text-2xl sm:text-3xl',
      };
    case 4:
      return {
        bg: 'bg-amber-100 border-amber-200',
        text: 'text-slate-800',
        fontSize: 'text-2xl sm:text-3xl',
      };
    case 8:
      return {
        bg: 'bg-gradient-to-br from-amber-400 to-orange-500 border-amber-300/60',
        text: 'text-white',
        glow: 'shadow-orange-500/30 shadow-md',
        fontSize: 'text-2xl sm:text-3xl',
      };
    case 16:
      return {
        bg: 'bg-gradient-to-br from-orange-500 to-red-500 border-orange-300/60',
        text: 'text-white',
        glow: 'shadow-orange-500/40 shadow-md',
        fontSize: 'text-2xl sm:text-3xl',
      };
    case 32:
      return {
        bg: 'bg-gradient-to-br from-red-500 to-rose-600 border-red-300/60',
        text: 'text-white',
        glow: 'shadow-red-500/50 shadow-md',
        fontSize: 'text-2xl sm:text-3xl',
      };
    case 64:
      return {
        bg: 'bg-gradient-to-br from-rose-500 to-pink-600 border-rose-300/70',
        text: 'text-white',
        glow: 'shadow-rose-500/60 shadow-lg',
        fontSize: 'text-2xl sm:text-3xl',
      };
    case 128:
      return {
        bg: 'bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-500 border-yellow-200',
        text: 'text-slate-900',
        glow: 'shadow-yellow-400/70 shadow-lg ring-1 ring-yellow-200/60',
        fontSize: 'text-xl sm:text-2xl',
      };
    case 256:
      return {
        bg: 'bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-500 border-amber-200',
        text: 'text-slate-900',
        glow: 'shadow-amber-400/80 shadow-lg ring-2 ring-amber-300/80',
        fontSize: 'text-xl sm:text-2xl',
      };
    case 512:
      return {
        bg: 'bg-gradient-to-br from-yellow-400 via-amber-500 to-orange-500 border-yellow-100',
        text: 'text-slate-950',
        glow: 'shadow-yellow-400/90 shadow-xl ring-2 ring-yellow-200',
        fontSize: 'text-xl sm:text-2xl',
      };
    case 1024:
      return {
        bg: 'bg-gradient-to-br from-cyan-400 via-sky-500 to-blue-600 border-cyan-200',
        text: 'text-white',
        glow: 'shadow-cyan-400/90 shadow-xl ring-2 ring-cyan-300',
        fontSize: 'text-lg sm:text-xl',
      };
    case 2048:
      return {
        bg: 'bg-gradient-to-br from-amber-300 via-yellow-400 to-emerald-400 border-white',
        text: 'text-slate-950',
        glow: 'shadow-amber-400 shadow-2xl ring-4 ring-yellow-300 animate-pulse',
        fontSize: 'text-lg sm:text-xl',
      };
    default:
      // 4096+
      return {
        bg: 'bg-gradient-to-tr from-purple-600 via-pink-600 to-amber-400 border-pink-300',
        text: 'text-white',
        glow: 'shadow-purple-500/90 shadow-2xl ring-2 ring-pink-300',
        fontSize: 'text-base sm:text-lg',
      };
  }
}
