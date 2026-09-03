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

  // Clear any legacy manual theme override
  try {
    localStorage.removeItem('tma_hub_theme_mode');
  } catch {}

  // 1. Read themeParams from Telegram WebApp object or URL hash
  let tp: Record<string, string> = {};
  if (tg?.themeParams && Object.keys(tg.themeParams).length > 0) {
    tp = tg.themeParams;
  } else if (typeof window !== 'undefined') {
    const hash = window.location.hash || '';
    const match = hash.match(/tgWebAppThemeParams=([^&]+)/);
    if (match && match[1]) {
      try {
        tp = JSON.parse(decodeURIComponent(match[1]));
      } catch {}
    }
  }

  // 2. Map all native Telegram colors directly into CSS variables
  if (tp.bg_color) {
    root.style.setProperty('--tg-theme-bg-color', tp.bg_color);
    if (typeof document !== 'undefined' && document.body) {
      document.body.style.backgroundColor = tp.bg_color;
    }
  }
  if (tp.text_color) {
    root.style.setProperty('--tg-theme-text-color', tp.text_color);
  }
  if (tp.hint_color) {
    root.style.setProperty('--tg-theme-hint-color', tp.hint_color);
  }
  if (tp.link_color) {
    root.style.setProperty('--tg-theme-link-color', tp.link_color);
  }
  if (tp.button_color) {
    root.style.setProperty('--tg-theme-button-color', tp.button_color);
  }
  if (tp.button_text_color) {
    root.style.setProperty('--tg-theme-button-text-color', tp.button_text_color);
  }
  if (tp.header_bg_color) {
    root.style.setProperty('--tg-theme-header-bg-color', tp.header_bg_color);
  }
  if (tp.section_bg_color) {
    root.style.setProperty('--tg-theme-section-bg-color', tp.section_bg_color);
  }

  // 3. Determine if current theme is light or dark based on luminance of actual bg_color or colorScheme
  const currentBg = tp.bg_color || root.style.getPropertyValue('--tg-theme-bg-color') || '#0e1621';
  const isLight = tg?.colorScheme === 'light' || getLuminance(currentBg) > 0.55;

  root.classList.toggle('dark', !isLight);
  root.classList.toggle('light', isLight);

  // 4. Set secondary background (cards, sections, bottom nav)
  if (tp.secondary_bg_color && tp.secondary_bg_color.toLowerCase() !== currentBg.toLowerCase()) {
    root.style.setProperty('--tg-theme-secondary-bg-color', tp.secondary_bg_color);
  } else {
    // If Telegram did not provide a distinct secondary_bg_color, derive it dynamically:
    if (isLight) {
      root.style.setProperty('--tg-theme-secondary-bg-color', '#ffffff');
    } else {
      root.style.setProperty(
        '--tg-theme-secondary-bg-color',
        'color-mix(in srgb, var(--tg-theme-text-color, #ffffff) 7%, var(--tg-theme-bg-color, #121212))'
      );
    }
  }

  // 5. Ensure section separator is visible on all background shades
  if (tp.section_separator_color) {
    root.style.setProperty('--tg-theme-section-separator-color', tp.section_separator_color);
  } else {
    root.style.setProperty(
      '--tg-theme-section-separator-color',
      isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)'
    );
  }

  // 6. Synchronize Telegram system header and background colors
  try {
    const activeHeader = tp.header_bg_color || tp.bg_color;
    if (activeHeader && typeof tg?.setHeaderColor === 'function') {
      tg.setHeaderColor(activeHeader);
    }
    if (tp.bg_color && typeof tg?.setBackgroundColor === 'function') {
      tg.setBackgroundColor(tp.bg_color);
    }
  } catch {}
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

