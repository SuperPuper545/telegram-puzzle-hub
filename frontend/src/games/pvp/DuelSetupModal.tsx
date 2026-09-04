import React, { useState, useEffect, useRef } from 'react';
import { X, Zap, Share2, Swords, Timer, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';
import { sound } from '../../utils/sound';
import { haptics, getTelegramWebApp } from '../../telegram/telegram';
import { useLockBodyScroll } from '../../utils/useLockBodyScroll';
import type { DuelGameType } from './types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  gameType: DuelGameType | null;
  coins: number;
  onStartQueue: (gameType: DuelGameType, betAmount: number, timerMode: string, durakMode: string) => void;
  onCancelQueue: () => void;
  onCreateInviteRoom: (gameType: DuelGameType, betAmount: number, timerMode: string, durakMode: string) => void;
  isSearching: boolean;
  inviteDeepLink: string | null;
  serverConnected: boolean;
}

const BETS = [0, 50, 100, 300, 500];

const GAME_TITLES: Record<DuelGameType, { title: string; subtitle: string; icon: string; badge: string }> = {
  chess: { title: 'Шахматы 1v1', subtitle: 'Интеллектуальная дуэль с таймером', icon: '♟️', badge: 'Блиц' },
  durak: { title: 'Дурак Онлайн', subtitle: 'Карточная дуэль 1 на 1', icon: '🃏', badge: '36 карт' },
  battleship: { title: 'Морской Бой', subtitle: 'Морская тактическая битва 10x10', icon: '🚢', badge: 'Флот' },
};

const CHESS_TIMERS = [
  { id: '1min', label: '1 мин', sub: 'Пуля' },
  { id: '3+2', label: '3+2 мин', sub: 'Блиц' },
  { id: '15min', label: '15 мин', sub: 'Рапид' },
];

const DURAK_MODES = [
  { id: 'perevodnoy', label: 'Переводной', sub: 'Можно переводить' },
  { id: 'podkidnoy', label: 'Подкидной', sub: 'Только крыть' },
];

export const DuelSetupModal: React.FC<Props> = ({
  isOpen,
  onClose,
  gameType,
  coins,
  onStartQueue,
  onCancelQueue,
  onCreateInviteRoom,
  isSearching,
  inviteDeepLink,
  serverConnected,
}) => {
  const [selectedBet, setSelectedBet] = useState<number>(0);
  const [timerMode, setTimerMode] = useState<string>('3+2');
  const [durakMode, setDurakMode] = useState<string>('perevodnoy');
  const [searchSeconds, setSearchSeconds] = useState(0);
  const searchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useLockBodyScroll(isOpen);

  useEffect(() => {
    if (isSearching) {
      setSearchSeconds(0);
      searchTimerRef.current = setInterval(() => {
        setSearchSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (searchTimerRef.current) clearInterval(searchTimerRef.current);
    }
    return () => {
      if (searchTimerRef.current) clearInterval(searchTimerRef.current);
    };
  }, [isSearching]);

  if (!isOpen || !gameType) return null;

  const info = GAME_TITLES[gameType];
  const canAfford = selectedBet === 0 || coins >= selectedBet;
  const potentialWin = selectedBet > 0 ? Math.floor(selectedBet * 1.8) : 0;

  const handleQuickMatch = () => {
    if (!canAfford || !serverConnected) return;
    sound.playUiTap();
    haptics.medium();
    onStartQueue(gameType, selectedBet, timerMode, durakMode);
  };

  const handleCreateInvite = () => {
    if (!canAfford || !serverConnected) return;
    sound.playUiTap();
    haptics.medium();
    onCreateInviteRoom(gameType, selectedBet, timerMode, durakMode);
  };

  const handleShareLink = () => {
    if (!inviteDeepLink) return;
    sound.playUiTap();
    haptics.selection();
    const tg = getTelegramWebApp();
    const text = encodeURIComponent(`🎮 Сыграем в ${info.title}? Ставка: ${selectedBet > 0 ? `${selectedBet} 🪙` : 'Дружеская'}! Заходи по ссылке!`);
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteDeepLink)}&text=${text}`;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, '_blank');
    }
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      onTouchMove={(e) => {
        if (e.target === e.currentTarget) e.preventDefault();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in touch-none overscroll-contain"
    >
      <div
        className="relative w-full max-w-sm rounded-3xl bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] p-5 shadow-2xl overflow-hidden flex flex-col text-tg-text animate-scale-up overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--tg-theme-section-separator-color)]">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-xl shadow-inner">
              {info.icon}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-extrabold text-base text-tg-text leading-tight">{info.title}</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-400/30">
                  {info.badge}
                </span>
              </div>
              <p className="text-[11px] text-tg-hint leading-tight mt-0.5">{info.subtitle}</p>
            </div>
          </div>

          {!isSearching && (
            <button
              onClick={() => {
                sound.playUiTap();
                onClose();
              }}
              className="w-8 h-8 rounded-full bg-tg-bg border border-[var(--tg-theme-section-separator-color)] flex items-center justify-center text-tg-hint hover:text-tg-text active:scale-90 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Searching State View */}
        {isSearching ? (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
            <div className="relative w-20 h-20 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20 animate-ping" />
              <div className="absolute inset-0 rounded-full border-2 border-indigo-400/40 animate-pulse" />
              <div className="w-14 h-14 rounded-full bg-indigo-500/20 border border-indigo-400/50 flex items-center justify-center text-2xl shadow-lg">
                <Swords className="w-7 h-7 text-indigo-400 animate-bounce" />
              </div>
            </div>

            <div>
              <h4 className="font-extrabold text-base text-tg-text">Поиск соперника...</h4>
              <p className="text-xs text-tg-hint mt-1">
                {selectedBet > 0 ? `Ставка: ${selectedBet} 🪙` : 'Дружеская игра'}
              </p>
              <p className="font-mono text-xs font-bold text-indigo-400 mt-1">
                Время в очереди: {formatTimer(searchSeconds)}
              </p>
            </div>

            <button
              onClick={() => {
                sound.playUiTap();
                haptics.light();
                onCancelQueue();
              }}
              className="px-6 py-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 font-bold text-xs hover:bg-rose-500/25 active:scale-95 transition-all"
            >
              Отменить поиск
            </button>
          </div>
        ) : inviteDeepLink ? (
          /* Invite Link Created View */
          <div className="py-4 flex flex-col items-center text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-2xl shadow-inner text-emerald-400">
              <Share2 className="w-7 h-7" />
            </div>

            <div>
              <h4 className="font-extrabold text-base text-tg-text">Приглашение готово!</h4>
              <p className="text-xs text-tg-hint mt-1">
                Отправьте ссылку другу. Как только он перейдет — битва начнется!
              </p>
            </div>

            {/* Link Preview Box */}
            <div className="w-full p-2.5 rounded-xl bg-tg-bg border border-[var(--tg-theme-section-separator-color)] text-[11px] font-mono text-indigo-400 break-all select-all text-left">
              {inviteDeepLink}
            </div>

            {/* Waiting status pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Ожидаем подключения соперника...</span>
            </div>

            <div className="w-full flex flex-col gap-2 pt-1">
              <button
                onClick={handleShareLink}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl tg-btn-primary font-bold text-xs shadow-md active:scale-95 transition-all cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                Отправить в чат Telegram
              </button>

              <button
                onClick={() => {
                  sound.playUiTap();
                  haptics.selection();
                  if (typeof navigator !== 'undefined' && navigator.clipboard) {
                    navigator.clipboard.writeText(inviteDeepLink);
                  }
                  alert('Ссылка скопирована в буфер обмена!');
                }}
                className="w-full py-2.5 rounded-xl bg-tg-bg border border-[var(--tg-theme-section-separator-color)] text-tg-text text-xs font-bold hover:border-indigo-400/40 active:scale-95 transition-all cursor-pointer"
              >
                📋 Скопировать ссылку
              </button>

              <button
                onClick={() => {
                  sound.playUiTap();
                  onClose();
                }}
                className="w-full py-2 rounded-xl text-tg-hint text-xs font-semibold hover:text-tg-text active:scale-95 transition-all cursor-pointer"
              >
                Отменить и выйти
              </button>
            </div>
          </div>
        ) : (
          /* Setup Options View */
          <div className="py-4 space-y-4">
            {/* Bet Selector */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-tg-hint">
                  Размер ставки
                </span>
                <span className="text-[11px] font-bold text-amber-500 flex items-center gap-1">
                  Баланс: {coins.toLocaleString()} 🪙
                </span>
              </div>

              <div className="grid grid-cols-5 gap-1.5">
                {BETS.map((bet) => {
                  const active = selectedBet === bet;
                  const isAvailable = bet === 0 || coins >= bet;
                  return (
                    <button
                      key={bet}
                      onClick={() => {
                        sound.playUiTap();
                        haptics.selection();
                        setSelectedBet(bet);
                      }}
                      className={`py-2 px-1 rounded-xl text-xs font-extrabold flex flex-col items-center justify-center gap-0.5 border transition-all active:scale-95 cursor-pointer relative ${
                        active
                          ? bet === 300 
                            ? 'bg-gradient-to-b from-amber-500/30 to-amber-600/20 border-amber-400 text-amber-300 shadow-md shadow-amber-500/20'
                            : 'bg-amber-500/20 border-amber-500 text-amber-400 shadow-sm'
                          : bet === 300
                          ? 'bg-amber-500/10 border-amber-500/40 text-amber-400 hover:border-amber-400'
                          : isAvailable
                          ? 'bg-tg-bg border-[var(--tg-theme-section-separator-color)] text-tg-text hover:border-amber-500/30'
                          : 'bg-tg-bg/50 border-[var(--tg-theme-section-separator-color)] text-tg-hint/40 opacity-50'
                      }`}
                    >
                      {bet === 300 && (
                        <span className="absolute -top-1.5 px-1 py-0.2 rounded-full bg-amber-500 text-black text-[8px] font-black uppercase tracking-wider shadow-sm">
                          Ранг
                        </span>
                      )}
                      <span>{bet === 0 ? '0' : bet}</span>
                      <span className="text-[9px] font-normal leading-none opacity-80">
                        {bet === 0 ? 'Фан' : '🪙'}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Pot banner */}
              <div className="mt-2 text-center">
                {selectedBet === 300 ? (
                  <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 space-y-0.5 animate-fade-in">
                    <span className="text-[11px] font-extrabold text-amber-400 flex items-center justify-center gap-1">
                      <span>🏆 Рейтинговая Дуэль</span>
                      <span>•</span>
                      <span>Банк: {potentialWin} 🪙</span>
                    </span>
                    <p className="text-[10px] text-tg-hint">
                      Победитель приносит <strong>+150 очков</strong> в копилку своей группы!
                    </p>
                  </div>
                ) : selectedBet > 0 ? (
                  <span className="text-[11px] font-medium text-emerald-400">
                    Банк победителя: <strong className="font-extrabold">{potentialWin} 🪙</strong> (комиссия 10%)
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-tg-hint">
                    🤝 Дружеский матч без потери монет
                  </span>
                )}
              </div>

              {!canAfford && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-rose-400 bg-rose-500/10 p-2 rounded-xl border border-rose-500/20">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Недостаточно монет для этой ставки</span>
                </div>
              )}
            </div>

            {/* Custom Mode Selectors */}
            {gameType === 'chess' && (
              <div className="pt-2 border-t border-[var(--tg-theme-section-separator-color)]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-tg-hint flex items-center gap-1">
                    <Timer className="w-3 h-3 text-indigo-400" /> Контроль времени
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  {CHESS_TIMERS.map((t) => {
                    const active = timerMode === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => {
                          sound.playUiTap();
                          haptics.selection();
                          setTimerMode(t.id);
                        }}
                        className={`py-2 px-1 rounded-xl text-center border transition-all active:scale-95 cursor-pointer ${
                          active
                            ? 'bg-indigo-500/20 border-indigo-400 text-indigo-400'
                            : 'bg-tg-bg border-[var(--tg-theme-section-separator-color)] text-tg-text hover:border-indigo-500/30'
                        }`}
                      >
                        <div className="font-extrabold text-xs">{t.label}</div>
                        <div className="text-[10px] text-tg-hint">{t.sub}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {gameType === 'durak' && (
              <div className="pt-2 border-t border-[var(--tg-theme-section-separator-color)]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-tg-hint flex items-center gap-1">
                    <RefreshCw className="w-3 h-3 text-rose-400" /> Режим игры
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {DURAK_MODES.map((m) => {
                    const active = durakMode === m.id;
                    return (
                      <button
                        key={m.id}
                        onClick={() => {
                          sound.playUiTap();
                          haptics.selection();
                          setDurakMode(m.id);
                        }}
                        className={`py-2.5 px-2 rounded-xl text-center border transition-all active:scale-95 cursor-pointer ${
                          active
                            ? 'bg-rose-500/20 border-rose-400 text-rose-400'
                            : 'bg-tg-bg border-[var(--tg-theme-section-separator-color)] text-tg-text hover:border-rose-500/30'
                        }`}
                      >
                        <div className="font-extrabold text-xs">{m.label}</div>
                        <div className="text-[10px] text-tg-hint">{m.sub}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="pt-2 border-t border-[var(--tg-theme-section-separator-color)] flex flex-col gap-2">
              <button
                onClick={handleQuickMatch}
                disabled={!canAfford || !serverConnected}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl tg-btn-primary font-bold text-xs shadow-md shadow-indigo-600/25 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                {!serverConnected ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Подключение к серверу...
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 fill-current" />
                    Быстрый матч
                  </>
                )}
              </button>

              <button
                onClick={handleCreateInvite}
                disabled={!canAfford || !serverConnected}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-tg-bg border border-[var(--tg-theme-section-separator-color)] text-tg-text font-bold text-xs hover:border-indigo-400/40 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5 text-indigo-400" />
                Пригласить друга
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
