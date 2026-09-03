// Safe wrapper around Telegram WebApp & TMA SDK
export interface TgUser {
  id: string | number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        initDataUnsafe?: {
          user?: TgUser;
          start_param?: string;
        };
        themeParams?: Record<string, string>;
        colorScheme?: 'light' | 'dark';
        isExpanded?: boolean;
        viewportHeight?: number;
        viewportStableHeight?: number;
        expand: () => void;
        ready: () => void;
        close: () => void;
        setHeaderColor?: (color: string) => void;
        setBackgroundColor?: (color: string) => void;
        enableClosingConfirmation?: () => void;
        disableVerticalSwipe?: () => void;
        openTelegramLink?: (url: string) => void;
        onEvent?: (eventType: string, eventHandler: () => void) => void;
        offEvent?: (eventType: string, eventHandler: () => void) => void;
        BackButton: {
          isVisible: boolean;
          show: () => void;
          hide: () => void;
          onClick: (cb: () => void) => void;
          offClick: (cb: () => void) => void;
        };
        HapticFeedback: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
      };
    };
  }
}

export function getTelegramWebApp() {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    return window.Telegram.WebApp;
  }
  return null;
}

export type ThemeMode = 'auto' | 'light' | 'dark' | 'amoled';

const THEME_STORAGE_KEY = 'tma_hub_theme_mode';

export function getStoredThemeMode(): ThemeMode {
  if (typeof window === 'undefined') return 'auto';
  const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
  return saved === 'light' || saved === 'dark' || saved === 'amoled' ? saved : 'auto';
}

export function setStoredThemeMode(mode: ThemeMode) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(THEME_STORAGE_KEY, mode);
  applyTelegramTheme(mode);
}

// Calculate relative luminance from hex color string
function getLuminance(hex: string): number {
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length !== 6) return 0.2;
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function applyTelegramTheme(modeOverride?: ThemeMode) {
  const tg = getTelegramWebApp();
  const root = document.documentElement;
  const tp = tg?.themeParams || {};
  const mode = modeOverride || getStoredThemeMode();

  const bgHex = (tp.bg_color || '').toLowerCase().trim();
  const lum = bgHex ? getLuminance(bgHex) : 0.05;

  let resolvedTheme: 'light' | 'dark' | 'amoled' = 'dark';

  if (mode === 'light') {
    resolvedTheme = 'light';
  } else if (mode === 'dark') {
    resolvedTheme = 'dark';
  } else if (mode === 'amoled') {
    resolvedTheme = 'amoled';
  } else {
    // Auto detection from Telegram WebApp
    if (lum > 0.55 || tg?.colorScheme === 'light') {
      resolvedTheme = 'light';
    } else if (
      bgHex === '#000000' ||
      bgHex === '#0a0a0a' ||
      bgHex === '#111111' ||
      bgHex === '#121212' ||
      bgHex === '#141414' ||
      bgHex === '#161616' ||
      lum <= 0.025
    ) {
      resolvedTheme = 'amoled';
    } else {
      // Classic Telegram Night / Dark-Sand / Tinted
      resolvedTheme = 'dark';
    }
  }

  // Clean previous classes
  root.classList.remove('tg-light', 'tg-dark', 'tg-amoled');
  root.classList.add(`tg-${resolvedTheme}`);

  if (resolvedTheme === 'light') {
    root.style.setProperty('--tg-theme-bg-color', tp.bg_color || '#f3f4f6');
    root.style.setProperty('--tg-theme-secondary-bg-color', tp.secondary_bg_color || '#ffffff');
    root.style.setProperty('--tg-theme-text-color', tp.text_color || '#111827');
    root.style.setProperty('--tg-theme-hint-color', tp.hint_color || '#6b7280');
    root.style.setProperty('--tg-theme-section-separator-color', tp.section_separator_color || 'rgba(0, 0, 0, 0.08)');
    root.style.setProperty('--tg-theme-button-color', tp.button_color || '#2563eb');
    root.style.setProperty('--tg-theme-button-text-color', tp.button_text_color || '#ffffff');
    root.style.setProperty('--tg-theme-header-bg-color', tp.header_bg_color || '#f3f4f6');
  } else if (resolvedTheme === 'amoled') {
    root.style.setProperty('--tg-theme-bg-color', '#000000');
    root.style.setProperty('--tg-theme-secondary-bg-color', '#121212');
    root.style.setProperty('--tg-theme-text-color', '#ffffff');
    root.style.setProperty('--tg-theme-hint-color', '#8e8e93');
    root.style.setProperty('--tg-theme-section-separator-color', 'rgba(255, 255, 255, 0.12)');
    root.style.setProperty('--tg-theme-button-color', tp.button_color || '#2481cc');
    root.style.setProperty('--tg-theme-button-text-color', '#ffffff');
    root.style.setProperty('--tg-theme-header-bg-color', '#000000');
  } else {
    // 'dark' -> Telegram's dark sand / tinted dark
    root.style.setProperty('--tg-theme-bg-color', tp.bg_color || '#1e1d1a');
    root.style.setProperty('--tg-theme-secondary-bg-color', tp.secondary_bg_color || '#282622');
    root.style.setProperty('--tg-theme-text-color', tp.text_color || '#f5f5f4');
    root.style.setProperty('--tg-theme-hint-color', tp.hint_color || '#a8a29e');
    root.style.setProperty('--tg-theme-section-separator-color', tp.section_separator_color || 'rgba(255, 255, 255, 0.09)');
    root.style.setProperty('--tg-theme-button-color', tp.button_color || '#5288c1');
    root.style.setProperty('--tg-theme-button-text-color', '#ffffff');
    root.style.setProperty('--tg-theme-header-bg-color', tp.header_bg_color || '#1e1d1a');
  }

  // Update Telegram top & bottom container colors if supported
  try {
    const activeBg = root.style.getPropertyValue('--tg-theme-bg-color');
    if (typeof tg?.setHeaderColor === 'function' && activeBg) {
      tg.setHeaderColor(activeBg);
    }
    if (typeof tg?.setBackgroundColor === 'function' && activeBg) {
      tg.setBackgroundColor(activeBg);
    }
  } catch {
    // Ignore unsupported Telegram client calls
  }

  return resolvedTheme;
}

export function initTelegramApp() {
  const tg = getTelegramWebApp();
  if (tg) {
    try {
      tg.ready();
      tg.expand();
      if (typeof tg.disableVerticalSwipe === 'function') {
        tg.disableVerticalSwipe();
      }
      applyTelegramTheme();

      // Listen to Telegram native theme changes
      if (typeof tg.onEvent === 'function') {
        tg.onEvent('themeChanged', () => {
          applyTelegramTheme();
        });
      }
    } catch (e) {
      console.warn('Could not fully init TMA WebApp features:', e);
    }
  } else {
    applyTelegramTheme();
  }
}

export function getTelegramUser(): TgUser {
  const tg = getTelegramWebApp();
  if (tg?.initDataUnsafe?.user) {
    return tg.initDataUnsafe.user;
  }
  return {
    id: '10001',
    first_name: 'Игрок',
    username: 'puzzler_tg',
    photo_url: undefined,
  };
}

export function getTelegramInitData(): string {
  const tg = getTelegramWebApp();
  return tg?.initData || '';
}

// Haptic feedback helpers
export const haptics = {
  light: () => {
    try {
      const tg = getTelegramWebApp();
      tg?.HapticFeedback?.impactOccurred('light');
    } catch (_) {}
  },
  medium: () => {
    try {
      const tg = getTelegramWebApp();
      tg?.HapticFeedback?.impactOccurred('medium');
    } catch (_) {}
  },
  heavy: () => {
    try {
      const tg = getTelegramWebApp();
      tg?.HapticFeedback?.impactOccurred('heavy');
    } catch (_) {}
  },
  success: () => {
    try {
      const tg = getTelegramWebApp();
      tg?.HapticFeedback?.notificationOccurred('success');
    } catch (_) {}
  },
  warning: () => {
    try {
      const tg = getTelegramWebApp();
      tg?.HapticFeedback?.notificationOccurred('warning');
    } catch (_) {}
  },
  error: () => {
    try {
      const tg = getTelegramWebApp();
      tg?.HapticFeedback?.notificationOccurred('error');
    } catch (_) {}
  },
  selection: () => {
    try {
      const tg = getTelegramWebApp();
      tg?.HapticFeedback?.selectionChanged();
    } catch (_) {}
  },
};

// Back button helper
let currentBackHandler: (() => void) | null = null;

export function setupBackButton(onClick: () => void) {
  const tg = getTelegramWebApp();
  if (!tg?.BackButton) return;

  if (currentBackHandler) {
    tg.BackButton.offClick(currentBackHandler);
  }
  currentBackHandler = onClick;
  tg.BackButton.onClick(onClick);
  tg.BackButton.show();
}

export function removeBackButton() {
  const tg = getTelegramWebApp();
  if (!tg?.BackButton) return;

  if (currentBackHandler) {
    tg.BackButton.offClick(currentBackHandler);
    currentBackHandler = null;
  }
  tg.BackButton.hide();
}

export function getTelegramStartParam(): string | null {
  const tg = getTelegramWebApp();
  if (tg?.initDataUnsafe?.start_param) {
    return tg.initDataUnsafe.start_param;
  }
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const param = urlParams.get('tgWebAppStartParam') || urlParams.get('startapp') || urlParams.get('start_param');
    if (param) return param;
  }
  return null;
}

