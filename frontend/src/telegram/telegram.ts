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

// Calculate relative luminance from hex color string
function getLuminance(hex: string): number {
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length !== 6) return 0.2;
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function applyTelegramTheme() {
  const tg = getTelegramWebApp();
  const root = document.documentElement;
  const tp = tg?.themeParams || {};

  // Standard Telegram Theme variables
  if (tp.bg_color) root.style.setProperty('--tg-theme-bg-color', tp.bg_color);
  if (tp.secondary_bg_color) root.style.setProperty('--tg-theme-secondary-bg-color', tp.secondary_bg_color);
  if (tp.text_color) root.style.setProperty('--tg-theme-text-color', tp.text_color);
  if (tp.hint_color) root.style.setProperty('--tg-theme-hint-color', tp.hint_color);
  if (tp.link_color) root.style.setProperty('--tg-theme-link-color', tp.link_color);
  if (tp.button_color) root.style.setProperty('--tg-theme-button-color', tp.button_color);
  if (tp.button_text_color) root.style.setProperty('--tg-theme-button-text-color', tp.button_text_color);
  if (tp.header_bg_color) root.style.setProperty('--tg-theme-header-bg-color', tp.header_bg_color);
  if (tp.section_bg_color) root.style.setProperty('--tg-theme-section-bg-color', tp.section_bg_color);
  if (tp.section_separator_color) root.style.setProperty('--tg-theme-section-separator-color', tp.section_separator_color);

  // Clean previous theme classes
  root.classList.remove('tg-light', 'tg-dark', 'tg-amoled');

  const bgHex = (tp.bg_color || '').toLowerCase().trim();
  const lum = bgHex ? getLuminance(bgHex) : 0.05;

  if (lum > 0.55 || tg?.colorScheme === 'light') {
    root.classList.add('tg-light');
  } else if (bgHex === '#000000' || bgHex === '#0a0a0a' || lum < 0.015) {
    // Pure AMOLED Black
    root.classList.add('tg-amoled');
  } else {
    // Classic Telegram Night / Midnight Blue
    root.classList.add('tg-dark');
  }
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

