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

  const rawBg = (tp.bg_color || '').trim();
  const rawSec = (tp.secondary_bg_color || '').trim();
  const rawHdr = (tp.header_bg_color || '').trim();

  // 2. Determine whether client is in Light or Dark mode
  const bgCandidate = rawBg || rawHdr || root.style.getPropertyValue('--tg-theme-bg-color') || '#0e1621';
  const isLight = tg?.colorScheme === 'light' || (bgCandidate ? getLuminance(bgCandidate) > 0.55 : false);

  root.classList.toggle('dark', !isLight);
  root.classList.toggle('light', isLight);

  let finalBg = rawBg || '#0e1621';
  let finalSec = rawSec || '#17212b';

  if (!isLight) {
    // In Dark / Night / AMOLED mode:
    // The page background must connect seamlessly with Telegram's top header.
    // On Telegram Android Night/AMOLED mode, header_bg_color is #000000, while bg_color is #212121,
    // and secondary_bg_color is #0f0f0f / #121212 (darker than bg_color!).
    const bgLum = rawBg ? getLuminance(rawBg) : 1;
    const hdrLum = rawHdr ? getLuminance(rawHdr) : 1;
    const secLum = rawSec ? getLuminance(rawSec) : 1;

    if (rawHdr && (rawHdr === '#000000' || hdrLum < bgLum)) {
      finalBg = rawHdr;
      finalSec = rawSec && rawSec !== finalBg && getLuminance(rawSec) > hdrLum
        ? rawSec
        : rawBg && rawBg !== finalBg
        ? rawBg
        : 'color-mix(in srgb, var(--tg-theme-text-color, #ffffff) 9%, var(--tg-theme-bg-color, #000000))';
    } else if (rawSec && secLum < bgLum) {
      finalBg = rawSec;
      finalSec = rawBg;
    } else {
      finalBg = rawBg || '#0e1621';
      finalSec = rawSec && rawSec.toLowerCase() !== finalBg.toLowerCase()
        ? rawSec
        : 'color-mix(in srgb, var(--tg-theme-text-color, #ffffff) 8%, var(--tg-theme-bg-color, #0e1621))';
    }
  } else {
    // Light mode (Classic, Day)
    finalBg = rawBg || '#ffffff';
    finalSec = rawSec && rawSec.toLowerCase() !== finalBg.toLowerCase() ? rawSec : '#ffffff';
  }

  // 3. Set CSS variables
  root.style.setProperty('--tg-theme-bg-color', finalBg);
  root.style.setProperty('--tg-theme-secondary-bg-color', finalSec);

  if (typeof document !== 'undefined' && document.body) {
    document.body.style.backgroundColor = finalBg;
  }

  if (tp.text_color) root.style.setProperty('--tg-theme-text-color', tp.text_color);
  if (tp.hint_color) root.style.setProperty('--tg-theme-hint-color', tp.hint_color);
  if (tp.link_color) root.style.setProperty('--tg-theme-link-color', tp.link_color);
  if (tp.button_color) root.style.setProperty('--tg-theme-button-color', tp.button_color);
  if (tp.button_text_color) root.style.setProperty('--tg-theme-button-text-color', tp.button_text_color);
  if (tp.header_bg_color) root.style.setProperty('--tg-theme-header-bg-color', tp.header_bg_color);
  if (tp.section_bg_color) root.style.setProperty('--tg-theme-section-bg-color', tp.section_bg_color);

  // 4. Section separator
  if (tp.section_separator_color) {
    root.style.setProperty('--tg-theme-section-separator-color', tp.section_separator_color);
  } else {
    root.style.setProperty(
      '--tg-theme-section-separator-color',
      isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)'
    );
  }

  // 5. Synchronize Telegram system header and background colors
  try {
    if (typeof tg?.setHeaderColor === 'function') {
      tg.setHeaderColor(finalBg);
    }
    if (typeof tg?.setBackgroundColor === 'function') {
      tg.setBackgroundColor(finalBg);
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
    // 1. Check URL query params
    const urlParams = new URLSearchParams(window.location.search);
    let param = urlParams.get('tgWebAppStartParam') || urlParams.get('startapp') || urlParams.get('start_param');
    if (param) return param;

    // 2. Check URL hash params (standard Telegram WebApp startapp format)
    const hash = window.location.hash ? window.location.hash.substring(1) : '';
    if (hash) {
      const hashParams = new URLSearchParams(hash);
      param = hashParams.get('tgWebAppStartParam') || hashParams.get('startapp') || hashParams.get('start_param');
      if (param) return param;
    }
  }
  return null;
}

export interface ChallengeData {
  gameId: string;
  targetScore: number;
  challengerName?: string;
}

export function parseChallengeParam(param: string | null): ChallengeData | null {
  if (!param || !param.startsWith('challenge_')) return null;
  const parts = param.split('_');
  if (parts.length >= 3) {
    const gameId = parts[1];
    const targetScore = parseInt(parts[2], 10);
    const challengerName = parts.slice(3).join('_') || undefined;
    if (!isNaN(targetScore) && targetScore > 0) {
      return { gameId, targetScore, challengerName };
    }
  }
  return null;
}

export function createChallengeShareUrl(botUsername: string, gameId: string, gameTitle: string, score: number, userName?: string): string {
  const safeName = (userName || 'Игрок').replace(/[^a-zA-Z0-9а-яА-ЯёЁ_]/g, '');
  const startParam = `challenge_${gameId}_${score}_${encodeURIComponent(safeName)}`;
  const challengeLink = `https://t.me/${botUsername}?startapp=${startParam}`;
  const shareText = `⚔️ Я набрал ${score.toLocaleString()} очков в игре «${gameTitle}» в TapTap Hub!\nСможешь побить мой рекорд? Залетай и забери бонус! 🔥`;
  return `https://t.me/share/url?url=${encodeURIComponent(challengeLink)}&text=${encodeURIComponent(shareText)}`;
}

