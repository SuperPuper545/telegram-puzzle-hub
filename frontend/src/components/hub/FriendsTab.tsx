import React, { useEffect, useState } from 'react';
import { useGameBridge } from '../../context/GameContext';
import { Users, Copy, Check, Share2, Sparkles, Gift, Coins, RefreshCw } from 'lucide-react';
import { sound } from '../../utils/sound';
import { haptics, getTelegramWebApp } from '../../telegram/telegram';

export const FriendsTab: React.FC = () => {
  const { user, referralsData, fetchReferrals, myGroup } = useGameBridge();
  const [copied, setCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    fetchReferrals();
  }, [fetchReferrals]);

  const tgId = referralsData?.telegramId || String(user.id);
  const botUsername = referralsData?.botUsername || 'taptaphub_bot';
  const inviteLink = `https://t.me/${botUsername}?start=ref_${tgId}`;

  const handleCopy = async () => {
    sound.playUiTap();
    haptics.selection();
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(inviteLink);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = inviteLink;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = () => {
    sound.playUiTap();
    haptics.medium();
    const clanNotice = myGroup?.group?.name ? ` и вступай в наш клан «${myGroup.group.name}»` : '';
    const shareText = `🎮 Залетай в TapTap Hub! Играй в любимые головоломки${clanNotice} и забирай +500 🪙 стартового бонуса! 🔥🏰`;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(shareText)}`;

    const tg = getTelegramWebApp();
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, '_blank');
    }
  };

  const handleRefresh = async () => {
    sound.playUiTap();
    haptics.light();
    setIsRefreshing(true);
    await fetchReferrals();
    setTimeout(() => setIsRefreshing(false), 400);
  };

  const friendsCount = referralsData?.invitedCount || 0;
  const totalEarned = referralsData?.totalEarned || 0;
  const referralsList = referralsData?.referrals || [];

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-500/15 via-purple-500/10 to-tg-secondaryBg border border-purple-500/25 p-5 shadow-lg">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-pink-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex items-start justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-400 text-xs font-bold mb-2">
              <Gift className="w-3.5 h-3.5 text-purple-400" /> Реферальная программа
            </div>
            <h2 className="text-xl font-black text-tg-text leading-tight">
              Зови друзей — <br />
              <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
                получайте по +500 🪙
              </span>
            </h2>
            <p className="text-xs text-tg-hint mt-1.5 leading-relaxed max-w-[260px]">
              За каждого приглашенного друга вы оба мгновенно получаете по 500 монет на счет!
            </p>
          </div>

          <div className="p-3 rounded-2xl bg-tg-bg border border-[var(--tg-theme-section-separator-color)] text-amber-500 shadow-inner">
            <Users className="w-8 h-8" />
          </div>
        </div>
      </div>

      {/* Referral Link & Share Buttons */}
      <div className="rounded-3xl bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-tg-hint uppercase tracking-wider">
            Твоя персональная ссылка
          </span>
          <button
            onClick={handleRefresh}
            className={`text-tg-hint hover:text-tg-text transition-transform ${isRefreshing ? 'animate-spin' : 'active:scale-95'}`}
            title="Обновить"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Link box */}
        <div className="flex items-center justify-between p-2.5 rounded-2xl bg-tg-bg border border-[var(--tg-theme-section-separator-color)] text-xs text-tg-text font-mono truncate">
          <span className="truncate mr-2 text-tg-text/90">
            {inviteLink}
          </span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] hover:border-indigo-500/40 active:scale-95 text-xs font-bold text-tg-text transition-all cursor-pointer shrink-0"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500 stroke-[3]" />
                <span className="text-emerald-500">Скопировано</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Копия</span>
              </>
            )}
          </button>
        </div>

        {/* Big Share Button */}
        <button
          onClick={handleShare}
          className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl tg-btn-primary font-black text-sm shadow-xl shadow-indigo-600/25 active:scale-[0.98] transition-all cursor-pointer"
        >
          <Share2 className="w-4 h-4" />
          Отправить инвайт другу в Telegram
        </button>
      </div>

      {/* Stats Counter Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3.5 rounded-2xl bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] flex items-center gap-3 shadow-sm">
          <div className="p-2.5 rounded-xl bg-indigo-500/15 text-indigo-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-tg-hint font-medium">Друзей пришло</span>
            <p className="text-base font-extrabold text-tg-text">{friendsCount}</p>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] flex items-center gap-3 shadow-sm">
          <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-500">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-tg-hint font-medium">Заработано монет</span>
            <p className="text-base font-extrabold text-amber-500">+{totalEarned.toLocaleString()} 🪙</p>
          </div>
        </div>
      </div>

      {/* Invited Friends List */}
      <div className="rounded-3xl bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-tg-hint uppercase tracking-wider">
            Список приглашенных ({friendsCount})
          </h3>
          <span className="text-[11px] text-indigo-400 font-bold">+500 🪙 за каждого</span>
        </div>

        {referralsList.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <div className="w-12 h-12 mx-auto rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <Users className="w-6 h-6 opacity-60" />
            </div>
            <p className="text-xs font-semibold text-tg-text">
              У вас пока нет приглашенных друзей
            </p>
            <p className="text-[11px] text-tg-hint max-w-xs mx-auto">
              Поделитесь ссылкой в личном чате или группе — монеты начислятся сразу после перехода!
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {referralsList.map((ref) => {
              const initials = (ref.firstName || 'U').slice(0, 2).toUpperCase();
              const dateFormatted = new Date(ref.createdAt).toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'short',
              });

              return (
                <div
                  key={ref.id}
                  className="flex items-center justify-between p-2.5 rounded-2xl bg-tg-bg border border-[var(--tg-theme-section-separator-color)]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 p-[1.5px] shrink-0">
                      {ref.photoUrl ? (
                        <img
                          src={ref.photoUrl}
                          alt=""
                          className="w-full h-full object-cover rounded-full"
                        />
                      ) : (
                        <div className="w-full h-full bg-tg-secondaryBg rounded-full flex items-center justify-center font-bold text-xs text-indigo-400 border border-[var(--tg-theme-section-separator-color)]">
                          {initials}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-tg-text leading-snug">
                        {ref.firstName} {ref.lastName || ''}
                      </p>
                      <p className="text-[10px] text-tg-hint">
                        {ref.username ? `@${ref.username}` : `ID: ${ref.telegramId}`} • {dateFormatted}
                      </p>
                    </div>
                  </div>

                  <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-500 text-xs font-black shrink-0">
                    <Sparkles className="w-3.5 h-3.5" /> +{ref.bonusPoints} 🪙
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
