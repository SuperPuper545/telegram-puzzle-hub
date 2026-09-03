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
        };
        themeParams?: Record<string, string>;
        colorScheme?: 'light' | 'dark';
        isExpanded?: boolean;
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

export function initTelegramApp() {
  const tg = getTelegramWebApp();
  if (tg) {
    try {
      tg.ready();
      tg.expand();
      if (typeof tg.disableVerticalSwipe === 'function') {
        tg.disableVerticalSwipe();
      }
      if (tg.setHeaderColor) {
        tg.setHeaderColor('#0f172a');
      }
      if (tg.setBackgroundColor) {
        tg.setBackgroundColor('#0f172a');
      }
    } catch (e) {
      console.warn('Could not fully init TMA WebApp features:', e);
    }
  }
}

export function getTelegramUser(): TgUser {
  const tg = getTelegramWebApp();
  if (tg?.initDataUnsafe?.user) {
    return tg.initDataUnsafe.user;
  }
  // Mock user for desktop/local browser development
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
