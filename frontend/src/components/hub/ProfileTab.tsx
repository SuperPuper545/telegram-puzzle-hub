import React, { useState, useEffect } from 'react';
import { useGameBridge } from '../../context/GameContext';
import { Trophy, Gamepad2, Share2, Play, Flame, Coins, Gift, ShoppingBag, Globe, ChevronRight, Copy, Check } from 'lucide-react';
import { haptics, getTelegramWebApp } from '../../telegram/telegram';
import { sound } from '../../utils/sound';

export const ProfileTab: React.FC = () => {
  const { 
    user, 
    bestScores, 
    totalGamesPlayed, 
    coins, 
    dailyStreak, 
    setIsDailyModalOpen,
    setIsShopModalOpen,
    setActiveTab, 
    openGame,
    myGroup,
    referralsData,
    fetchReferrals,
  } = useGameBridge();

  const [copied, setCopied] = useState(false);
  const [showFriendsList, setShowFriendsList] = useState(false);

  useEffect(() => {
    fetchReferrals();
  }, [fetchReferrals]);

  const tgId = referralsData?.telegramId || String(user.id);
  const botUsername = referralsData?.botUsername || 'taptaphub_bot';
  const inviteLink = `https://t.me/${botUsername}?start=ref_${tgId}`;

  const handleCopyLink = async () => {
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

  const handleShareInvite = () => {
    sound.playUiTap();
    haptics.medium();
    const shareText = `🎮 Залетай в TapTap Hub! Играй в любимые головоломки прямо в Telegram и забирай +500 🪙 стартового бонуса! 🔥`;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(shareText)}`;

    const tg = getTelegramWebApp();
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, '_blank');
    }
  };

  const totalScore = Object.values(bestScores).reduce((acc, s) => acc + s, 0);
  const initials = (user.first_name || 'U').slice(0, 2).toUpperCase();

  const shareSpecificGame = (gameTitle: string, score: number) => {
    haptics.medium();
    sound.playUiTap();
    const tg = getTelegramWebApp();
    const shareText = `Мой рекорд в игре «${gameTitle}» в TapTap Hub: ${score.toLocaleString()} очков! 🎮🏆\nСможешь обойти меня?`;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent('https://t.me/taptaphub_bot')}&text=${encodeURIComponent(shareText)}`;

    if (tg?.openTelegramLink) {
      tg.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, '_blank');
    }
  };

  const handleShareAll = () => {
    haptics.medium();
    sound.playUiTap();
    const tg = getTelegramWebApp();

    const bScore = (bestScores['blockudoku'] || 0).toLocaleString();
    const mScore = (bestScores['match3'] || 0).toLocaleString();
    const cScore = (bestScores['2048'] || 0).toLocaleString();

    const shareText = `🎮 Мои рекорды в TapTap Hub:
🧩 Blockudoku: ${bScore}
💎 Match-3: ${mScore}
⚡ 2048: ${cScore}
🏆 Всего: ${totalScore.toLocaleString()} очков!

Попробуй побить мой результат!`;

    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent('https://t.me/taptaphub_bot')}&text=${encodeURIComponent(shareText)}`;

    if (tg?.openTelegramLink) {
      tg.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, '_blank');
    }
  };

  const gameRecords = [
    {
      id: 'blockudoku' as const,
      name: 'Blockudoku',
      subtitle: 'Сетка 9x9',
      icon: '🧩',
      score: bestScores['blockudoku'] || 0,
      textColor: 'text-indigo-400',
    },
    {
      id: 'match3' as const,
      name: 'Match-3',
      subtitle: 'Кристаллы 8x8',
      icon: '💎',
      score: bestScores['match3'] || 0,
      textColor: 'text-pink-400',
    },
    {
      id: '2048' as const,
      name: '2048 Classic',
      subtitle: 'Плитки 4x4',
      icon: '⚡',
      score: bestScores['2048'] || 0,
      textColor: 'text-amber-300',
    },
  ];

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      {/* Profile Card */}
      <div className="rounded-3xl bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] p-5 shadow-lg text-center">
        <div className="w-18 h-18 mx-auto rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 p-[2.5px] shadow-lg shadow-indigo-500/20 mb-3">
          {user.photo_url ? (
            <img
              src={user.photo_url}
              alt=""
              className="w-full h-full object-cover rounded-full"
            />
          ) : (
            <div className="w-full h-full bg-tg-bg rounded-full flex items-center justify-center font-black text-xl text-indigo-400 border border-[var(--tg-theme-section-separator-color)]">
              {initials}
            </div>
          )}
        </div>

        <h2 className="text-base font-black text-tg-text">{user.first_name}</h2>
        <p className="text-xs text-tg-hint mt-0.5">
          {user.username ? `@${user.username}` : `ID: ${user.id}`}
        </p>

        <div className="mt-3.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border bg-indigo-500/15 border-indigo-400/30 text-indigo-400">
          <span>🎮</span>
          <span>Игрок TapTap Hub</span>
        </div>
      </div>

      {/* 4-Item Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Coins */}
        <div 
          onClick={() => {
            sound.playUiTap();
            haptics.selection();
            setIsShopModalOpen(true);
          }}
          className="p-3.5 rounded-2xl bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] flex items-center gap-3 cursor-pointer hover:border-amber-500/40 active:scale-98 transition-all shadow-sm"
        >
          <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-500 shrink-0">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-tg-hint font-medium">Баланс монет</span>
            <p className="text-base font-black text-amber-500">{coins.toLocaleString()} 🪙</p>
          </div>
        </div>

        {/* Daily Streak */}
        <div 
          onClick={() => {
            sound.playUiTap();
            haptics.selection();
            setIsDailyModalOpen(true);
          }}
          className="p-3.5 rounded-2xl bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] flex items-center gap-3 cursor-pointer active:scale-98 transition-transform hover:border-amber-500/40 shadow-sm"
        >
          <div className="p-2.5 rounded-xl bg-orange-500/15 text-orange-500 shrink-0">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-tg-hint font-medium">Серия входов</span>
            <p className="text-base font-black text-orange-500">{dailyStreak} дн. 🔥</p>
          </div>
        </div>

        {/* Games Played */}
        <div className="p-3.5 rounded-2xl bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] flex items-center gap-3 shadow-sm">
          <div className="p-2.5 rounded-xl bg-indigo-500/15 text-indigo-400 shrink-0">
            <Gamepad2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-tg-hint font-medium">Сыграно игр</span>
            <p className="text-base font-extrabold text-tg-text">{totalGamesPlayed}</p>
          </div>
        </div>

        {/* Total Score */}
        <div className="p-3.5 rounded-2xl bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] flex items-center gap-3 shadow-sm">
          <div className="p-2.5 rounded-xl bg-purple-500/15 text-purple-500 shrink-0">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-tg-hint font-medium">Суммарный счет</span>
            <p className="text-base font-extrabold text-purple-500">{totalScore.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Group Section */}
      {myGroup?.group ? (
        <div className="rounded-3xl bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-black text-sm shadow-md overflow-hidden shrink-0"
                style={{ backgroundColor: myGroup.group.color || '#6366f1' }}
              >
                {myGroup.group.photoUrl ? (
                  <img src={myGroup.group.photoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  myGroup.group.name.slice(0, 2).toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-tg-text truncate">{myGroup.group.name}</span>
                  {myGroup.isCommander && (
                    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                      Командир
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-tg-hint flex items-center gap-2">
                  <span>{myGroup.group.memberCount} уч.</span>
                  <span>•</span>
                  <span className="text-amber-400 font-medium">{myGroup.groupCycleScore.toLocaleString()} очков в цикле</span>
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                sound.playUiTap();
                haptics.selection();
                setActiveTab('world');
              }}
              className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 text-xs font-bold flex items-center gap-1 cursor-pointer active:scale-95 transition-all shrink-0 ml-2"
            >
              <span>Карта</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[var(--tg-theme-section-separator-color)]">
            <div className="p-2 rounded-xl bg-tg-bg/50 border border-[var(--tg-theme-section-separator-color)] text-center">
              <span className="text-[10px] text-tg-hint">Мой вклад в цикл</span>
              <p className="text-xs font-extrabold text-tg-text">
                {myGroup.userCycleScore ? myGroup.userCycleScore.toLocaleString() : 0} ⚡
              </p>
            </div>
            <div className="p-2 rounded-xl bg-tg-bg/50 border border-[var(--tg-theme-section-separator-color)] text-center">
              <span className="text-[10px] text-tg-hint">Токены казны</span>
              <p className="text-xs font-extrabold text-amber-400">
                {myGroup.group.treasuryTokens || 0} 🪙
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div 
          onClick={() => {
            sound.playUiTap();
            haptics.selection();
            setActiveTab('world');
          }}
          className="p-4 rounded-3xl bg-gradient-to-r from-indigo-500/15 via-purple-500/10 to-tg-secondaryBg border border-indigo-500/30 flex items-center justify-between cursor-pointer active:scale-98 transition-all hover:border-indigo-400 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-400 shrink-0">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-tg-text">Вступи в группу</p>
              <p className="text-[10px] text-tg-hint">Захватывай клетки мира вместе с кланом</p>
            </div>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-md shadow-indigo-600/30 flex items-center gap-1 shrink-0">
            <span>Войти</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>
      )}

      {/* Customization & Skins Shop Promo Card */}
      <div 
        onClick={() => {
          sound.playUiTap();
          haptics.selection();
          setIsShopModalOpen(true);
        }}
        className="p-3.5 rounded-2xl bg-gradient-to-r from-purple-500/15 via-indigo-500/10 to-tg-secondaryBg border border-purple-500/30 flex items-center justify-between cursor-pointer active:scale-98 transition-all hover:border-purple-400 shadow-sm"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-tg-text">Магазин кастомизации</p>
            <p className="text-[10px] text-tg-hint">Скины для Blockudoku, Match-3 и 2048</p>
          </div>
        </div>
        <div className="px-2.5 py-1 rounded-xl bg-purple-500/20 text-xs font-bold text-purple-400 border border-purple-400/30">
          Открыть
        </div>
      </div>

      {/* Referrals Section: Приглашай друзей — получай 500 🪙 */}
      <div className="rounded-2xl bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-500">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-tg-text">
                Приглашай друзей
              </h3>
              <p className="text-xs text-amber-500 font-bold">
                +500 🪙 каждому
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs font-black text-tg-text">
              {referralsData?.invitedCount || 0} друзей
            </span>
            <p className="text-[11px] text-tg-hint">
              +{(referralsData?.totalEarned || 0).toLocaleString()} 🪙
            </p>
          </div>
        </div>

        {/* Action Buttons: 1-Tap Telegram Share & Copy Link */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleShareInvite}
            className="flex-1 py-2.5 px-3 rounded-xl tg-btn-primary font-black text-xs flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer shadow-md shadow-indigo-600/20 transition-all"
          >
            <Share2 className="w-4 h-4" />
            <span>Позвать друга</span>
          </button>

          <button
            onClick={handleCopyLink}
            className="py-2.5 px-3 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-[var(--tg-theme-section-separator-color)] text-xs font-bold text-tg-text flex items-center gap-1.5 active:scale-95 cursor-pointer transition-all"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-500 stroke-[3]" />
                <span className="text-emerald-500 font-bold">Скопировано</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Ссылка</span>
              </>
            )}
          </button>
        </div>

        {/* Collapsible Friends List if any */}
        {(referralsData?.referrals && referralsData.referrals.length > 0) && (
          <div className="pt-2 border-t border-[var(--tg-theme-section-separator-color)]">
            <button
              onClick={() => setShowFriendsList(!showFriendsList)}
              className="w-full flex items-center justify-between text-xs text-tg-hint hover:text-tg-text py-1 cursor-pointer font-semibold"
            >
              <span>Приглашённые друзья ({referralsData.referrals.length})</span>
              <ChevronRight className={`w-4 h-4 transition-transform ${showFriendsList ? 'rotate-90' : ''}`} />
            </button>

            {showFriendsList && (
              <div className="space-y-1.5 pt-2 max-h-48 overflow-y-auto pr-1">
                {referralsData.referrals.map((ref) => (
                  <div
                    key={ref.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-tg-bg border border-[var(--tg-theme-section-separator-color)] text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-[11px] shrink-0">
                        {(ref.firstName || 'U').slice(0, 1).toUpperCase()}
                      </div>
                      <span className="font-bold text-tg-text truncate">{ref.firstName} {ref.lastName || ''}</span>
                    </div>
                    <span className="text-emerald-500 font-black shrink-0">+{ref.bonusPoints} 🪙</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Grouped Records Section */}
      <div className="rounded-2xl bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] p-4 space-y-2.5 shadow-sm">
        <h3 className="text-xs font-bold text-tg-hint uppercase tracking-wider mb-2">
          Личные рекорды в играх
        </h3>

        <div className="space-y-2">
          {gameRecords.map((game) => (
            <div
              key={game.id}
              className="flex items-center justify-between p-2.5 rounded-xl bg-tg-bg border border-[var(--tg-theme-section-separator-color)]"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-lg">{game.icon}</span>
                <div>
                  <p className="text-xs font-bold text-tg-text">{game.name}</p>
                  <span className="text-xs text-tg-hint">{game.subtitle}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`font-black text-xs ${game.textColor}`}>
                  {game.score > 0 ? game.score.toLocaleString() : '0'}
                </span>

                {game.score > 0 ? (
                  <button
                    onClick={() => shareSpecificGame(game.name, game.score)}
                    className="p-1.5 rounded-lg text-tg-hint hover:text-tg-text active:scale-95 transition-transform cursor-pointer"
                    title={`Поделиться рекордом в ${game.name}`}
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      sound.playUiTap();
                      openGame(game.id);
                    }}
                    className="p-1.5 rounded-lg text-indigo-400 hover:text-indigo-300 active:scale-95 transition-transform cursor-pointer"
                    title={`Сыграть в ${game.name}`}
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Telegram Share All Button */}
      <button
        onClick={handleShareAll}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl tg-btn-primary font-bold text-sm shadow-lg shadow-indigo-600/30 cursor-pointer"
      >
        <Share2 className="w-4 h-4" />
        Поделиться всеми рекордами с друзьями
      </button>
    </div>
  );
};
