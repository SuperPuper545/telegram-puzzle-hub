export interface TileStyle {
  bg: string;
  text: string;
  glow?: string;
  fontSize: string;
}

export function getTileStyle(val: number, skinId: string = 'tile_classic'): TileStyle {
  if (skinId === 'tile_neon') {
    return getNeonTileStyle(val);
  }
  if (skinId === 'tile_retro') {
    return getRetroTileStyle(val);
  }
  if (skinId === 'tile_gold') {
    return getGoldTileStyle(val);
  }
  return getClassicTileStyle(val);
}

function getClassicTileStyle(val: number): TileStyle {
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
      return {
        bg: 'bg-gradient-to-tr from-purple-600 via-pink-600 to-amber-400 border-pink-300',
        text: 'text-white',
        glow: 'shadow-purple-500/90 shadow-2xl ring-2 ring-pink-300',
        fontSize: 'text-base sm:text-lg',
      };
  }
}

function getNeonTileStyle(val: number): TileStyle {
  switch (val) {
    case 2:
      return {
        bg: 'bg-cyan-950/80 border border-cyan-500/50 shadow-sm shadow-cyan-500/20',
        text: 'text-cyan-300',
        fontSize: 'text-2xl sm:text-3xl',
      };
    case 4:
      return {
        bg: 'bg-fuchsia-950/80 border border-fuchsia-500/50 shadow-sm shadow-fuchsia-500/20',
        text: 'text-fuchsia-300',
        fontSize: 'text-2xl sm:text-3xl',
      };
    case 8:
      return {
        bg: 'bg-gradient-to-br from-cyan-600 to-blue-600 border border-cyan-300',
        text: 'text-white',
        glow: 'shadow-cyan-400/50 shadow-md',
        fontSize: 'text-2xl sm:text-3xl',
      };
    case 16:
      return {
        bg: 'bg-gradient-to-br from-purple-600 to-fuchsia-600 border border-fuchsia-300',
        text: 'text-white',
        glow: 'shadow-fuchsia-400/50 shadow-md',
        fontSize: 'text-2xl sm:text-3xl',
      };
    case 32:
      return {
        bg: 'bg-gradient-to-br from-pink-500 to-rose-600 border border-pink-300',
        text: 'text-white',
        glow: 'shadow-pink-500/60 shadow-md',
        fontSize: 'text-2xl sm:text-3xl',
      };
    case 64:
      return {
        bg: 'bg-gradient-to-br from-emerald-500 to-teal-600 border border-emerald-300',
        text: 'text-white',
        glow: 'shadow-emerald-400/60 shadow-lg',
        fontSize: 'text-2xl sm:text-3xl',
      };
    case 128:
      return {
        bg: 'bg-gradient-to-br from-cyan-400 to-teal-500 border border-cyan-200',
        text: 'text-slate-950',
        glow: 'shadow-cyan-400/80 shadow-lg ring-1 ring-cyan-200',
        fontSize: 'text-xl sm:text-2xl',
      };
    case 256:
      return {
        bg: 'bg-gradient-to-br from-fuchsia-500 to-purple-600 border border-fuchsia-200',
        text: 'text-white',
        glow: 'shadow-fuchsia-400/80 shadow-lg ring-2 ring-fuchsia-300',
        fontSize: 'text-xl sm:text-2xl',
      };
    case 512:
      return {
        bg: 'bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-700 border border-violet-200',
        text: 'text-white',
        glow: 'shadow-violet-500/90 shadow-xl ring-2 ring-violet-300',
        fontSize: 'text-xl sm:text-2xl',
      };
    case 1024:
      return {
        bg: 'bg-gradient-to-br from-pink-400 via-rose-500 to-amber-400 border border-pink-100',
        text: 'text-slate-950',
        glow: 'shadow-pink-400/90 shadow-xl ring-2 ring-pink-200',
        fontSize: 'text-lg sm:text-xl',
      };
    case 2048:
      return {
        bg: 'bg-gradient-to-br from-cyan-300 via-fuchsia-400 to-amber-300 border-2 border-white',
        text: 'text-slate-950',
        glow: 'shadow-fuchsia-400 shadow-2xl ring-4 ring-cyan-300 animate-pulse',
        fontSize: 'text-lg sm:text-xl',
      };
    default:
      return {
        bg: 'bg-gradient-to-tr from-cyan-500 via-fuchsia-500 to-rose-500 border border-cyan-200',
        text: 'text-white',
        glow: 'shadow-cyan-400/90 shadow-2xl ring-2 ring-cyan-200',
        fontSize: 'text-base sm:text-lg',
      };
  }
}

function getRetroTileStyle(val: number): TileStyle {
  switch (val) {
    case 2:
      return {
        bg: 'bg-zinc-800 border-2 border-zinc-600',
        text: 'text-zinc-200 font-mono font-black',
        fontSize: 'text-2xl sm:text-3xl',
      };
    case 4:
      return {
        bg: 'bg-emerald-950 border-2 border-emerald-600',
        text: 'text-emerald-300 font-mono font-black',
        fontSize: 'text-2xl sm:text-3xl',
      };
    case 8:
      return {
        bg: 'bg-emerald-600 border-2 border-emerald-400',
        text: 'text-white font-mono font-black',
        glow: 'shadow-emerald-500/40 shadow-md',
        fontSize: 'text-2xl sm:text-3xl',
      };
    case 16:
      return {
        bg: 'bg-amber-600 border-2 border-amber-400',
        text: 'text-white font-mono font-black',
        glow: 'shadow-amber-500/40 shadow-md',
        fontSize: 'text-2xl sm:text-3xl',
      };
    case 32:
      return {
        bg: 'bg-orange-600 border-2 border-orange-300',
        text: 'text-white font-mono font-black',
        glow: 'shadow-orange-500/40 shadow-md',
        fontSize: 'text-2xl sm:text-3xl',
      };
    case 64:
      return {
        bg: 'bg-rose-700 border-2 border-rose-400',
        text: 'text-white font-mono font-black',
        glow: 'shadow-rose-500/50 shadow-md',
        fontSize: 'text-2xl sm:text-3xl',
      };
    case 128:
      return {
        bg: 'bg-purple-700 border-2 border-purple-300',
        text: 'text-white font-mono font-black',
        glow: 'shadow-purple-500/60 shadow-lg',
        fontSize: 'text-xl sm:text-2xl',
      };
    case 256:
      return {
        bg: 'bg-indigo-600 border-2 border-indigo-300',
        text: 'text-white font-mono font-black',
        glow: 'shadow-indigo-500/70 shadow-lg',
        fontSize: 'text-xl sm:text-2xl',
      };
    case 512:
      return {
        bg: 'bg-blue-600 border-2 border-blue-300',
        text: 'text-white font-mono font-black',
        glow: 'shadow-blue-500/80 shadow-xl',
        fontSize: 'text-xl sm:text-2xl',
      };
    case 1024:
      return {
        bg: 'bg-teal-500 border-2 border-teal-200',
        text: 'text-slate-950 font-mono font-black',
        glow: 'shadow-teal-400/80 shadow-xl',
        fontSize: 'text-lg sm:text-xl',
      };
    case 2048:
      return {
        bg: 'bg-yellow-400 border-2 border-yellow-100',
        text: 'text-slate-950 font-mono font-black',
        glow: 'shadow-yellow-400 shadow-2xl ring-4 ring-yellow-300 animate-pulse',
        fontSize: 'text-lg sm:text-xl',
      };
    default:
      return {
        bg: 'bg-red-600 border-2 border-white',
        text: 'text-white font-mono font-black',
        glow: 'shadow-red-500 shadow-2xl ring-2 ring-white',
        fontSize: 'text-base sm:text-lg',
      };
  }
}

function getGoldTileStyle(val: number): TileStyle {
  switch (val) {
    case 2:
      return {
        bg: 'bg-amber-100/90 border border-amber-300 shadow-sm',
        text: 'text-amber-900 font-bold',
        fontSize: 'text-2xl sm:text-3xl',
      };
    case 4:
      return {
        bg: 'bg-amber-200 border border-amber-400 shadow-sm',
        text: 'text-amber-950 font-bold',
        fontSize: 'text-2xl sm:text-3xl',
      };
    case 8:
      return {
        bg: 'bg-gradient-to-br from-amber-300 to-yellow-500 border border-amber-200',
        text: 'text-slate-900 font-black',
        glow: 'shadow-amber-400/40 shadow-md',
        fontSize: 'text-2xl sm:text-3xl',
      };
    case 16:
      return {
        bg: 'bg-gradient-to-br from-amber-400 to-yellow-600 border border-yellow-200',
        text: 'text-slate-900 font-black',
        glow: 'shadow-amber-400/50 shadow-md',
        fontSize: 'text-2xl sm:text-3xl',
      };
    case 32:
      return {
        bg: 'bg-gradient-to-br from-yellow-500 via-amber-500 to-yellow-600 border border-yellow-200',
        text: 'text-white font-black',
        glow: 'shadow-amber-500/60 shadow-md',
        fontSize: 'text-2xl sm:text-3xl',
      };
    case 64:
      return {
        bg: 'bg-gradient-to-br from-yellow-400 via-amber-600 to-amber-700 border border-yellow-200',
        text: 'text-white font-black',
        glow: 'shadow-amber-600/70 shadow-lg',
        fontSize: 'text-2xl sm:text-3xl',
      };
    case 128:
      return {
        bg: 'bg-gradient-to-br from-amber-200 via-yellow-400 to-amber-500 border-2 border-yellow-100',
        text: 'text-slate-950 font-black',
        glow: 'shadow-amber-400/70 shadow-lg',
        fontSize: 'text-xl sm:text-2xl',
      };
    case 256:
      return {
        bg: 'bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-600 border-2 border-white/80',
        text: 'text-slate-950 font-black',
        glow: 'shadow-yellow-400/80 shadow-lg ring-2 ring-yellow-200',
        fontSize: 'text-xl sm:text-2xl',
      };
    case 512:
      return {
        bg: 'bg-gradient-to-br from-amber-400 via-yellow-300 to-yellow-600 border-2 border-white',
        text: 'text-slate-950 font-black',
        glow: 'shadow-amber-500/90 shadow-xl ring-2 ring-yellow-300',
        fontSize: 'text-xl sm:text-2xl',
      };
    case 1024:
      return {
        bg: 'bg-gradient-to-tr from-yellow-200 via-amber-300 to-yellow-500 border-2 border-yellow-100',
        text: 'text-slate-950 font-black',
        glow: 'shadow-yellow-300/90 shadow-xl ring-3 ring-yellow-200',
        fontSize: 'text-lg sm:text-xl',
      };
    case 2048:
      return {
        bg: 'bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 border-2 border-white',
        text: 'text-slate-950 font-black',
        glow: 'shadow-amber-300 shadow-2xl ring-4 ring-yellow-100 animate-pulse',
        fontSize: 'text-lg sm:text-xl',
      };
    default:
      return {
        bg: 'bg-gradient-to-tr from-yellow-100 via-amber-300 to-yellow-500 border-2 border-white',
        text: 'text-slate-950 font-black',
        glow: 'shadow-yellow-400 shadow-2xl ring-3 ring-white',
        fontSize: 'text-base sm:text-lg',
      };
  }
}
