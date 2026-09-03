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

const SUIT_SYMBOLS = { s: '♠', h: '♥', d: '♦', c: '♣' };
const SUIT_COLORS = {
  s: 'text-tg-text',
  c: 'text-tg-text',
  h: 'text-rose-500',
  d: 'text-rose-500',
};

function CardItem({
  card,
  selected,
  onClick,
  small,
}: {
  card: Card;
  selected?: boolean;
  onClick?: () => void;
  small?: boolean;
}) {
  const sym = SUIT_SYMBOLS[card.suit];
  const col = SUIT_COLORS[card.suit];

  return (
    <button
      onClick={onClick}
      className={`rounded-xl border-2 flex flex-col justify-between select-none transition-all active:scale-95 cursor-pointer shadow-md ${
        small ? 'w-9 h-14 p-1 text-[10px]' : 'w-12 h-18 p-1.5 text-xs'
      } ${
        selected
          ? 'border-indigo-400 bg-indigo-500/20 -translate-y-3 shadow-indigo-500/30'
          : 'border-[var(--tg-theme-section-separator-color)] bg-tg-secondaryBg hover:border-indigo-400/40'
      }`}
    >
      <div className={`font-black leading-none ${col}`}>{card.rank}</div>
      <div className={`text-center font-bold text-base leading-none ${col}`}>{sym}</div>
      <div className={`font-black leading-none text-right ${col}`}>{card.rank}</div>
    </button>
  );
}

function CardBack({ small }: { small?: boolean }) {
  return (
    <div
      className={`rounded-xl border-2 border-indigo-500/30 bg-gradient-to-br from-indigo-900/40 to-purple-900/40 flex items-center justify-center shadow-inner ${
        small ? 'w-8 h-12 text-xs' : 'w-10 h-15 text-sm'
      }`}
    >
      <span className="opacity-50">🂠</span>
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

  const trumpSym = SUIT_SYMBOLS[gs.trump];
  const trumpCol = SUIT_COLORS[gs.trump];
  const canDone = isAttacker && gs.phase === 'additional';
  const canTake = isDefender && (gs.phase === 'defense' || gs.phase === 'additional');
  const canPass = isDefender && gs.phase === 'defense' && gs.table.length === 1 && !gs.table[0].defense;

  return (
    <div className="flex flex-col h-full bg-tg-bg select-none touch-none overflow-hidden">
      {/* Top Header: Back/Exit + Opponent Info + Status + Bank */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-tg-secondaryBg border-b border-[var(--tg-theme-section-separator-color)] shadow-sm">
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

        {/* Opponent Cards in Hand */}
        <div className="flex items-center gap-1 overflow-x-auto max-w-[120px] px-1">
          {Array(Math.min(gs.opponentCardCount, 6))
            .fill(null)
            .map((_, i) => (
              <CardBack key={i} small />
            ))}
          {gs.opponentCardCount > 6 && (
            <span className="text-[10px] font-bold text-tg-hint">+{gs.opponentCardCount - 6}</span>
          )}
        </div>
      </div>

      {/* Deck & Trump Info Bar */}
      <div className="flex items-center justify-between px-4 py-1.5 text-xs bg-tg-bg border-b border-[var(--tg-theme-section-separator-color)]">
        <div className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-tg-hint">В колоде:</span>
          <span className="font-extrabold text-tg-text">{gs.deckCount}</span>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30">
          <span className="text-tg-hint text-[11px]">Козырь:</span>
          <span className={`text-base font-black leading-none ${trumpCol}`}>{trumpSym}</span>
        </div>

        <div className="text-[11px] text-tg-hint">
          Сброс: <span className="font-bold text-tg-text">{gs.discardCount}</span>
        </div>
      </div>

      {/* Center Table (Playing Area) */}
      <div className="flex-1 flex flex-wrap items-center justify-center gap-3 p-4 overflow-y-auto min-h-0 bg-radial from-indigo-950/20 via-transparent to-transparent">
        {gs.table.length === 0 ? (
          <div className="text-center py-6 space-y-2 opacity-80">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] flex items-center justify-center text-2xl">
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
                <div className="-mt-8 ml-5 shadow-lg">
                  <CardItem card={slot.defense} />
                </div>
              ) : (
                isDefender && (
                  <div className="w-12 h-18 rounded-xl border-2 border-dashed border-indigo-400/60 bg-indigo-500/10 flex items-center justify-center text-indigo-400 text-base -mt-8 ml-5 shadow-sm animate-pulse">
                    Крыть
                  </div>
                )
              )}
            </div>
          ))
        )}
      </div>

      {/* Action Controls Bar */}
      <div className="flex gap-2 px-4 py-2 bg-tg-secondaryBg/70 border-t border-[var(--tg-theme-section-separator-color)]">
        {canDone && (
          <button
            onClick={() => {
              sound.playUiTap();
              haptics.medium();
              onDoneAttacking();
            }}
            className="flex-1 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-extrabold text-xs active:scale-95 transition-all cursor-pointer shadow-sm"
          >
            Бито ✅
          </button>
        )}

        {canTake && (
          <button
            onClick={() => {
              sound.playUiTap();
              haptics.medium();
              onTake();
            }}
            className="flex-1 py-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400 font-extrabold text-xs active:scale-95 transition-all cursor-pointer shadow-sm"
          >
            Взять карты 📥
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
            className="flex-1 py-2.5 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 font-extrabold text-xs active:scale-95 transition-all disabled:opacity-40 cursor-pointer shadow-sm"
          >
            Перевести 🔄
          </button>
        )}
      </div>

      {/* Player Hand */}
      <div className="px-3 py-3 bg-tg-secondaryBg border-t border-[var(--tg-theme-section-separator-color)] shadow-lg overflow-x-auto flex items-end justify-center gap-1.5 min-h-[95px]">
        {gs.hand.map((card, i) => (
          <CardItem
            key={`${card.rank}${card.suit}${i}`}
            card={card}
            selected={selectedCard?.rank === card.rank && selectedCard.suit === card.suit}
            onClick={() => handleCardClick(card)}
          />
        ))}
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
