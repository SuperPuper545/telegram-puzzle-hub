import React, { useState, useEffect, useCallback } from 'react';
import { haptics, setupBackButton, removeBackButton } from '../../../telegram/telegram';
import { sound } from '../../../utils/sound';
import confetti from 'canvas-confetti';
import { ArrowLeft, Flag, Trophy, Frown, Sparkles, Shield, Swords, Layers } from 'lucide-react';
import type { Card, TableSlot, GameOverPayload, DuelOpponent } from '../types';

interface Props {
  roomId: string;
  myUserId: number;
  opponent: DuelOpponent;
  betAmount: number;
  gameState: {
    hand: Card[];
    opponentCardCount: number;
    table: TableSlot[];
    phase: string;
    deckCount: number;
    trump: 's' | 'h' | 'd' | 'c';
    attackerId: number;
    defenderId: number;
    discardCount: number;
  } | null;
  onAttack: (card: Card) => void;
  onDefend: (attackCard: Card, defenseCard: Card) => void;
  onPass: (card: Card) => void;
  onTake: () => void;
  onDoneAttacking: () => void;
  onSurrender: () => void;
  gameOverData?: GameOverPayload | null;
  onExit: () => void;
}

const RANK_RU: Record<string, string> = {
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  '10': '10',
  'J': 'В',
  'Q': 'Д',
  'K': 'К',
  'A': 'Т',
  'В': 'В',
  'Д': 'Д',
  'К': 'К',
  'Т': 'Т',
};

const SUIT_SYMBOLS: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
const SUIT_IS_RED: Record<string, boolean> = { s: false, c: false, h: true, d: true };

function CardItem({
  card,
  selected,
  onClick,
  small,
  style,
}: {
  card: Card;
  selected?: boolean;
  onClick?: () => void;
  small?: boolean;
  style?: React.CSSProperties;
}) {
  const rank = RANK_RU[card.rank] || card.rank;
  const sym = SUIT_SYMBOLS[card.suit] || card.suit;
  const isRed = SUIT_IS_RED[card.suit] || false;
  const textColor = isRed ? '#dc2626' : '#0f172a';

  if (small) {
    return (
      <div
        onClick={onClick}
        style={style}
        className="w-[42px] h-[64px] rounded-lg bg-gradient-to-b from-white via-[#fcfdfe] to-[#f1f5f9] border border-slate-300 shadow-md flex flex-col justify-between p-1 select-none cursor-pointer transition-all shrink-0"
      >
        <div className="flex items-center gap-0.5" style={{ color: textColor }}>
          <span className="font-black text-[11px] leading-none">{rank}</span>
          <span className="text-[10px] leading-none">{sym}</span>
        </div>
        <div className="text-center text-lg font-black leading-none" style={{ color: textColor }}>
          {sym}
        </div>
        <div className="flex items-center justify-end gap-0.5 rotate-180" style={{ color: textColor }}>
          <span className="font-black text-[11px] leading-none">{rank}</span>
          <span className="text-[10px] leading-none">{sym}</span>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      style={{
        ...style,
        color: textColor,
      }}
      className={`relative w-[52px] h-[78px] rounded-xl bg-gradient-to-b from-white via-[#fdfefe] to-[#edf2f7] border select-none transition-all duration-200 cursor-pointer shrink-0 flex flex-col justify-between p-1.5 ${
        selected
          ? 'ring-[2.5px] ring-amber-400 shadow-2xl shadow-amber-500/50 -translate-y-5 z-40 border-amber-300'
          : 'border-slate-300/90 shadow-lg shadow-black/25 hover:-translate-y-2'
      }`}
    >
      {/* Top Left Rank & Suit */}
      <div className="flex flex-col items-start leading-none text-left">
        <span className="font-black text-xs tracking-tighter">{rank}</span>
        <span className="text-[11px] mt-0.5 leading-none">{sym}</span>
      </div>

      {/* Center Large Suit Symbol */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="text-2xl font-black opacity-90">{sym}</span>
      </div>

      {/* Bottom Right Rank & Suit (Inverted) */}
      <div className="flex flex-col items-start leading-none rotate-180 self-end text-left">
        <span className="font-black text-xs tracking-tighter">{rank}</span>
        <span className="text-[11px] mt-0.5 leading-none">{sym}</span>
      </div>
    </button>
  );
}

function CardBack({ small, style }: { small?: boolean; style?: React.CSSProperties }) {
  return (
    <div
      style={style}
      className={`rounded-xl border border-indigo-300/40 bg-gradient-to-br from-indigo-900 via-blue-950 to-indigo-950 shadow-md flex items-center justify-center select-none shrink-0 overflow-hidden relative ${
        small ? 'w-[36px] h-[52px]' : 'w-[46px] h-[70px]'
      }`}
    >
      {/* Pattern on Card Back */}
      <div className="absolute inset-1 rounded-lg border border-indigo-400/30 bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:6px_6px] opacity-60" />
      <div className="w-5 h-5 rounded-full border border-amber-400/40 flex items-center justify-center text-amber-300/70 text-[10px] font-bold z-10">
        ⚔️
      </div>
    </div>
  );
}

export const DurakGame: React.FC<Props> = ({
  myUserId,
  opponent,
  betAmount,
  gameState,
  onAttack,
  onDefend,
  onPass,
  onTake,
  onDoneAttacking,
  onSurrender,
  gameOverData,
  onExit,
}) => {
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [showSurrender, setShowSurrender] = useState(false);

  const gs = gameState;
  const isAttacker = gs?.attackerId === myUserId;
  const isDefender = gs?.defenderId === myUserId;

  // Telegram BackButton integration
  useEffect(() => {
    setupBackButton(() => {
      setShowSurrender(true);
    });
    return () => removeBackButton();
  }, []);

  useEffect(() => {
    if (gameOverData) {
      const won = gameOverData.winnerUserId === myUserId;
      if (won) {
        sound.playRecord();
        confetti({
          particleCount: 80,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#ec4899', '#f59e0b', '#10b981', '#6366f1'],
        });
      } else {
        sound.playGameOver();
      }
    }
  }, [gameOverData, myUserId]);

  const handleCardClick = useCallback(
    (card: Card) => {
      if (!gs) return;
      haptics.light();
      sound.playPickup();

      if (isAttacker && (gs.phase === 'attack' || gs.phase === 'additional')) {
        sound.playPickup();
        onAttack(card);
        setSelectedCard(null);
      } else if (isDefender && gs.phase === 'defense') {
        const attackSlot = gs.table.find((s) => !s.defense);
        if (attackSlot) {
          sound.playPickup();
          onDefend(attackSlot.attack, card);
          setSelectedCard(null);
        } else {
          setSelectedCard(card);
        }
      } else {
        setSelectedCard((prev) =>
          prev?.rank === card.rank && prev.suit === card.suit ? null : card
        );
      }
    },
    [gs, isAttacker, isDefender, onAttack, onDefend]
  );

  const handleTableSlotClick = useCallback(
    (slot: TableSlot) => {
      if (!gs || !isDefender || gs.phase !== 'defense' || slot.defense) return;
      if (!selectedCard) return;
      sound.playPickup();
      haptics.medium();
      onDefend(slot.attack, selectedCard);
      setSelectedCard(null);
    },
    [gs, isDefender, selectedCard, onDefend]
  );

  if (!gs) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-tg-hint">
        <div className="text-3xl animate-spin">🃏</div>
        <p className="text-xs">Загрузка партии...</p>
      </div>
    );
  }

  const trumpSym = SUIT_SYMBOLS[gs.trump] || gs.trump;
  const isTrumpRed = SUIT_IS_RED[gs.trump];
  const trumpCol = isTrumpRed ? 'text-rose-500' : 'text-slate-900';
  const canDone = isAttacker && gs.phase === 'additional';
  const canTake = isDefender && (gs.phase === 'defense' || gs.phase === 'additional');
  const canPass = isDefender && gs.phase === 'defense' && gs.table.length === 1 && !gs.table[0].defense;

  const handCount = gs.hand.length;
  const midIndex = (handCount - 1) / 2;

  return (
    <div className="flex flex-col h-full bg-tg-bg select-none overflow-hidden">
      {/* Top Header: Back/Exit + Opponent Info + Status + Bank */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-tg-secondaryBg border-b border-[var(--tg-theme-section-separator-color)] shadow-sm shrink-0">
        <div className="flex items-center gap-2">
          {/* Dedicated Exit / Surrender Back Button */}
          <button
            onClick={() => {
              sound.playUiTap();
              haptics.selection();
              setShowSurrender(true);
            }}
            className="p-2 rounded-xl bg-tg-bg border border-[var(--tg-theme-section-separator-color)] text-tg-hint hover:text-rose-400 active:scale-90 transition-all cursor-pointer"
            title="Покинуть матч"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center font-bold text-xs text-rose-400">
            {opponent.firstName[0]}
          </div>
          <div>
            <div className="text-xs font-bold text-tg-text truncate max-w-[90px]">
              {opponent.firstName}
            </div>
            <div className="text-[10px] font-medium text-tg-hint flex items-center gap-1">
              {!isAttacker ? (
                <span className="text-amber-400 font-bold flex items-center gap-0.5">
                  <Swords className="w-3 h-3" /> Атакует
                </span>
              ) : (
                <span className="text-indigo-400 font-bold flex items-center gap-0.5">
                  <Shield className="w-3 h-3" /> Защищается
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Bank badge in center */}
        {betAmount > 0 && (
          <div className="flex items-center gap-1 text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <span>🪙</span>
            <span>Банк: {Math.floor(betAmount * 1.8)}</span>
          </div>
        )}

        {/* Opponent Cards Fan (compact) */}
        <div className="flex items-center -space-x-4 px-1 py-1">
          {Array(Math.min(gs.opponentCardCount, 6))
            .fill(null)
            .map((_, i) => (
              <CardBack
                key={i}
                small
                style={{
                  transform: `rotate(${(i - 2.5) * 4}deg)`,
                }}
              />
            ))}
          {gs.opponentCardCount > 6 && (
            <span className="text-[10px] font-bold text-tg-hint pl-2">+{gs.opponentCardCount - 6}</span>
          )}
        </div>
      </div>

      {/* Deck & Trump Info Bar */}
      <div className="flex items-center justify-between px-4 py-1.5 text-xs bg-tg-bg border-b border-[var(--tg-theme-section-separator-color)] shrink-0">
        <div className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-tg-hint">В колоде:</span>
          <span className="font-extrabold text-tg-text">{gs.deckCount}</span>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30">
          <span className="text-tg-hint text-[11px] font-medium">Козырь:</span>
          <span className={`text-base font-black leading-none ${trumpCol}`}>{trumpSym}</span>
        </div>

        <div className="text-[11px] text-tg-hint">
          Сброс: <span className="font-bold text-tg-text">{gs.discardCount}</span>
        </div>
      </div>

      {/* Center Table (Playing Field) */}
      <div className="flex-1 flex flex-wrap items-center justify-center gap-4 p-4 overflow-y-auto min-h-0 bg-radial from-emerald-950/20 via-transparent to-transparent">
        {gs.table.length === 0 ? (
          <div className="text-center py-6 space-y-2 opacity-80">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] flex items-center justify-center text-3xl shadow-sm">
              🃏
            </div>
            <p className="text-xs font-bold text-tg-text">
              {isAttacker ? 'Ваш ход! Выберите карту для атаки' : 'Ожидаем ход соперника...'}
            </p>
          </div>
        ) : (
          gs.table.map((slot, i) => (
            <div
              key={i}
              className="relative flex flex-col items-center cursor-pointer"
              onClick={() => handleTableSlotClick(slot)}
            >
              <CardItem card={slot.attack} />
              {slot.defense ? (
                <div className="-mt-10 ml-6 shadow-2xl transition-transform">
                  <CardItem card={slot.defense} />
                </div>
              ) : (
                isDefender && (
                  <div className="w-[52px] h-[78px] rounded-xl border-2 border-dashed border-indigo-400/80 bg-indigo-500/15 flex items-center justify-center text-indigo-300 text-xs font-black -mt-10 ml-6 shadow-md animate-pulse">
                    Крыть
                  </div>
                )
              )}
            </div>
          ))
        )}
      </div>

      {/* Action Controls Bar */}
      {(canDone || canTake || canPass) && (
        <div className="flex gap-2 px-4 py-2 bg-tg-secondaryBg/90 border-t border-[var(--tg-theme-section-separator-color)] shrink-0">
          {canDone && (
            <button
              onClick={() => {
                sound.playUiTap();
                haptics.medium();
                onDoneAttacking();
              }}
              className="flex-1 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-extrabold text-xs active:scale-95 transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
            >
              <span>Бито</span>
              <span>✅</span>
            </button>
          )}

          {canTake && (
            <button
              onClick={() => {
                sound.playUiTap();
                haptics.medium();
                onTake();
              }}
              className="flex-1 py-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400 font-extrabold text-xs active:scale-95 transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
            >
              <span>Взять карты</span>
              <span>📥</span>
            </button>
          )}

          {canPass && (
            <button
              onClick={() => {
                if (selectedCard) {
                  sound.playPickup();
                  haptics.medium();
                  onPass(selectedCard);
                }
              }}
              disabled={!selectedCard}
              className="flex-1 py-2.5 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 font-extrabold text-xs active:scale-95 transition-all disabled:opacity-40 cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
            >
              <span>Перевести</span>
              <span>🔄</span>
            </button>
          )}
        </div>
      )}

      {/* Player Hand (Realistic Hand Fan Layout) */}
      <div className="pt-6 pb-4 px-2 bg-gradient-to-t from-tg-secondaryBg via-tg-secondaryBg/90 to-transparent border-t border-[var(--tg-theme-section-separator-color)] shadow-2xl shrink-0">
        <div className="flex items-end justify-center -space-x-3 sm:-space-x-4 overflow-x-visible max-w-full px-4 min-h-[92px]">
          {gs.hand.map((card, i) => {
            const isSel = selectedCard?.rank === card.rank && selectedCard.suit === card.suit;
            const deg = (i - midIndex) * Math.min(5, 36 / handCount);
            const translateY = Math.abs(i - midIndex) * 2.5;

            return (
              <div
                key={`${card.rank}${card.suit}${i}`}
                style={{
                  transform: isSel ? 'translateY(-20px) scale(1.08)' : `translateY(${translateY}px) rotate(${deg}deg)`,
                  zIndex: isSel ? 35 : i + 1,
                }}
                className="transition-transform duration-150 ease-out shrink-0"
              >
                <CardItem
                  card={card}
                  selected={isSel}
                  onClick={() => handleCardClick(card)}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Surrender Confirmation Modal */}
      {showSurrender && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] rounded-3xl p-5 shadow-2xl max-w-xs w-full text-center space-y-3 animate-scale-up">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Flag className="w-6 h-6" />
            </div>
            <h4 className="font-extrabold text-base text-tg-text">Покинуть матч?</h4>
            <p className="text-xs text-tg-hint leading-relaxed">
              Вы уверены? Победа и банк будут присуждены сопернику.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowSurrender(false)}
                className="flex-1 py-2.5 rounded-xl bg-tg-bg border border-[var(--tg-theme-section-separator-color)] text-tg-hint text-xs font-bold active:scale-95 transition-all cursor-pointer"
              >
                Остаться
              </button>
              <button
                onClick={() => {
                  setShowSurrender(false);
                  onSurrender();
                  onExit();
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400 text-xs font-bold active:scale-95 transition-all cursor-pointer"
              >
                Сдаться и выйти
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game Over Modal */}
      {gameOverData && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] rounded-3xl p-6 shadow-2xl max-w-xs w-full text-center space-y-4 animate-scale-up">
            {gameOverData.winnerUserId === myUserId ? (
              <div className="space-y-2">
                <div className="w-16 h-16 mx-auto rounded-3xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-3xl shadow-inner text-amber-400">
                  <Trophy className="w-9 h-9 animate-bounce" />
                </div>
                <h3 className="font-black text-xl text-tg-text">ПОБЕДА!</h3>
                <p className="text-xs text-tg-hint">
                  {gameOverData.reason === 'hand_empty'
                    ? 'Вы первыми скинули все карты!'
                    : 'Соперник сдался'}
                </p>
                {betAmount > 0 && (
                  <div className="py-2 px-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-extrabold text-lg flex items-center justify-center gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    +{gameOverData.payout} 🪙
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="w-16 h-16 mx-auto rounded-3xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-3xl shadow-inner text-rose-400">
                  <Frown className="w-9 h-9" />
                </div>
                <h3 className="font-black text-xl text-tg-text">Вы в дураках!</h3>
                <p className="text-xs text-tg-hint">Соперник избавился от всех карт</p>
                {betAmount > 0 && (
                  <div className="text-xs font-bold text-rose-400">-{betAmount} 🪙</div>
                )}
              </div>
            )}

            <button
              onClick={() => {
                sound.playUiTap();
                onExit();
              }}
              className="w-full py-3 rounded-xl tg-btn-primary font-bold text-xs shadow-md active:scale-95 transition-all cursor-pointer"
            >
              Вернуться в хаб
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
