import React, { useState, useEffect, useCallback, useRef } from 'react';
import { haptics, setupBackButton, removeBackButton } from '../../../telegram/telegram';
import { sound } from '../../../utils/sound';
import confetti from 'canvas-confetti';
import { ArrowLeft, Flag, Trophy, Frown, Sparkles, Shield, Swords, Layers, Send, CornerDownRight } from 'lucide-react';
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
    mode?: string;
    isFirstRound?: boolean;
  } | null;
  onAttack: (cards: Card | Card[]) => void;
  onDefend: (attackCard: Card, defenseCard: Card) => void;
  onPass: (cards: Card | Card[]) => void;
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

const RV = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUIT_SYMBOLS: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
const SUIT_IS_RED: Record<string, boolean> = { s: false, c: false, h: true, d: true };

function canBeat(attack: Card, defense: Card, trump: string): boolean {
  const ta = attack.suit === trump;
  const td = defense.suit === trump;
  if (defense.suit === attack.suit) {
    return RV.indexOf(defense.rank) > RV.indexOf(attack.rank);
  }
  return td && !ta;
}

function CardItem({
  card,
  selected,
  onClick,
  small,
  style,
  onDragStart,
  isDealing,
}: {
  card: Card;
  selected?: boolean;
  onClick?: () => void;
  small?: boolean;
  style?: React.CSSProperties;
  onDragStart?: (e: React.DragEvent) => void;
  isDealing?: boolean;
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
        className="w-[44px] h-[66px] rounded-xl bg-gradient-to-b from-white via-[#fdfefe] to-[#eef2f6] border border-slate-300 shadow-md flex flex-col justify-between p-1 select-none cursor-pointer transition-all shrink-0"
      >
        <div className="flex items-center gap-0.5" style={{ color: textColor }}>
          <span className="font-black text-[11px] leading-none">{rank}</span>
          <span className="text-[10px] leading-none">{sym}</span>
        </div>
        <div className="text-center text-xl font-black leading-none" style={{ color: textColor }}>
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
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      style={{
        ...style,
        color: textColor,
      }}
      className={`relative w-[54px] h-[82px] rounded-2xl bg-gradient-to-b from-white via-[#fcfdfe] to-[#eaeff5] border select-none transition-all duration-200 cursor-grab active:cursor-grabbing shrink-0 flex flex-col justify-between p-1.5 ${
        isDealing ? 'animate-deal-card' : ''
      } ${
        selected
          ? 'ring-[3px] ring-amber-400 shadow-2xl shadow-amber-500/50 -translate-y-6 z-40 border-amber-300 scale-105'
          : 'border-slate-300/90 shadow-xl shadow-black/25 hover:-translate-y-2'
      }`}
    >
      {/* Top Left Rank & Suit */}
      <div className="flex flex-col items-start leading-none text-left pointer-events-none">
        <span className="font-black text-xs tracking-tight">{rank}</span>
        <span className="text-[11px] mt-0.5 leading-none">{sym}</span>
      </div>

      {/* Center Large Suit Symbol */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="text-2xl font-black opacity-90">{sym}</span>
      </div>

      {/* Bottom Right Rank & Suit (Inverted) */}
      <div className="flex flex-col items-start leading-none rotate-180 self-end text-left pointer-events-none">
        <span className="font-black text-xs tracking-tight">{rank}</span>
        <span className="text-[11px] mt-0.5 leading-none">{sym}</span>
      </div>
    </div>
  );
}

function CardBack({ small, style }: { small?: boolean; style?: React.CSSProperties }) {
  return (
    <div
      style={style}
      className={`rounded-2xl border border-indigo-300/40 bg-gradient-to-br from-indigo-900 via-blue-950 to-indigo-950 shadow-md flex items-center justify-center select-none shrink-0 overflow-hidden relative ${
        small ? 'w-[38px] h-[54px]' : 'w-[48px] h-[72px]'
      }`}
    >
      <div className="absolute inset-1 rounded-xl border border-indigo-400/30 bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:6px_6px] opacity-60" />
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
  // Support selecting MULTIPLE cards of the same rank (e.g. two 6s or three 7s)
  const [selectedCards, setSelectedCards] = useState<Card[]>([]);
  const [showSurrender, setShowSurrender] = useState(false);
  const [draggedCard, setDraggedCard] = useState<Card | null>(null);
  const [dealingAnimation, setDealingAnimation] = useState(false);
  const prevHandCountRef = useRef<number>(0);

  const gs = gameState;
  const isAttacker = gs?.attackerId === myUserId;
  const isDefender = gs?.defenderId === myUserId;

  // Clear selected cards when table clears or phase changes
  useEffect(() => {
    setSelectedCards([]);
  }, [gs?.table.length, gs?.phase]);

  // Telegram BackButton integration
  useEffect(() => {
    setupBackButton(() => {
      setShowSurrender(true);
    });
    return () => removeBackButton();
  }, []);

  // Card Deal animation trigger
  useEffect(() => {
    if (gs) {
      if (gs.hand.length > prevHandCountRef.current) {
        setDealingAnimation(true);
        sound.playPickup();
        const t = setTimeout(() => setDealingAnimation(false), 600);
        prevHandCountRef.current = gs.hand.length;
        return () => clearTimeout(t);
      }
      prevHandCountRef.current = gs.hand.length;
    }
  }, [gs?.hand.length]);

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

      if (isAttacker && (gs.phase === 'attack' || gs.phase === 'additional' || gs.phase === 'taking')) {
        // Multi-card selection logic:
        setSelectedCards((prev) => {
          const alreadyIdx = prev.findIndex((c) => c.rank === card.rank && c.suit === card.suit);
          if (alreadyIdx !== -1) {
            return prev.filter((_, i) => i !== alreadyIdx);
          }
          if (prev.length === 0) {
            return [card];
          }
          if (prev[0].rank === card.rank) {
            const maxTable = gs.isFirstRound ? 5 : 6;
            const maxAllowed = Math.min(gs.opponentCardCount - gs.table.filter((s) => !s.defense).length, maxTable - gs.table.length);
            if (prev.length < maxAllowed) {
              return [...prev, card];
            }
            return prev;
          }
          return [card];
        });
      } else if (isDefender && gs.phase === 'defense') {
        // If mode is perevodnoy and card can be used to pass, allow multi-selection for pass
        const canBePassed = gs.mode === 'perevodnoy' &&
          gs.table.length > 0 &&
          gs.table.every((s) => !s.defense) &&
          card.rank === gs.table[0].attack.rank;

        if (canBePassed) {
          setSelectedCards((prev) => {
            const alreadyIdx = prev.findIndex((c) => c.rank === card.rank && c.suit === card.suit);
            if (alreadyIdx !== -1) return prev.filter((_, i) => i !== alreadyIdx);
            if (prev.length > 0 && prev[0].rank === card.rank) return [...prev, card];
            return [card];
          });
          return;
        }

        // Otherwise defend: if single attack slot is open and card can beat it, beat it directly
        const attackSlot = gs.table.find((s) => !s.defense);
        if (attackSlot && canBeat(attackSlot.attack, card, gs.trump)) {
          onDefend(attackSlot.attack, card);
          setSelectedCards([]);
        } else {
          setSelectedCards([card]);
        }
      } else {
        setSelectedCards([card]);
      }
    },
    [gs, isAttacker, isDefender, onDefend]
  );

  const handleSendSelectedCards = useCallback(() => {
    if (!gs || selectedCards.length === 0) return;
    sound.playPickup();
    haptics.medium();
    onAttack(selectedCards);
    setSelectedCards([]);
  }, [gs, selectedCards, onAttack]);

  const handlePassSelectedCards = useCallback(() => {
    if (!gs || selectedCards.length === 0) return;
    sound.playPickup();
    haptics.medium();
    onPass(selectedCards);
    setSelectedCards([]);
  }, [gs, selectedCards, onPass]);

  const handleTableSlotClick = useCallback(
    (slot: TableSlot) => {
      if (!gs || !isDefender || slot.defense) return;
      const cardToUse = selectedCards[0];
      if (!cardToUse) return;
      if (!canBeat(slot.attack, cardToUse, gs.trump)) {
        haptics.error();
        return;
      }
      sound.playPickup();
      haptics.medium();
      onDefend(slot.attack, cardToUse);
      setSelectedCards([]);
    },
    [gs, isDefender, selectedCards, onDefend]
  );

  // Drop card on Table Area
  const handleTableDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!gs) return;

    if (isAttacker && (gs.phase === 'attack' || gs.phase === 'additional' || gs.phase === 'taking')) {
      haptics.medium();
      sound.playPickup();
      if (selectedCards.length > 1 && draggedCard && selectedCards.some((c) => c.rank === draggedCard.rank && c.suit === draggedCard.suit)) {
        onAttack(selectedCards);
      } else if (draggedCard) {
        onAttack([draggedCard]);
      }
    } else if (isDefender && gs.phase === 'defense' && draggedCard) {
      // Check for translation drop
      if (gs.mode === 'perevodnoy' && gs.table.length > 0 && gs.table.every((s) => !s.defense) && draggedCard.rank === gs.table[0].attack.rank) {
        onPass([draggedCard]);
      } else {
        const openSlot = gs.table.find((s) => !s.defense && canBeat(s.attack, draggedCard, gs.trump));
        if (openSlot) {
          haptics.medium();
          sound.playPickup();
          onDefend(openSlot.attack, draggedCard);
        }
      }
    }
    setDraggedCard(null);
    setSelectedCards([]);
  };

  // Drop on specific Slot
  const handleSlotDrop = (e: React.DragEvent, slot: TableSlot) => {
    e.preventDefault();
    e.stopPropagation();
    if (!gs || !draggedCard || !isDefender || slot.defense) return;
    if (canBeat(slot.attack, draggedCard, gs.trump)) {
      haptics.medium();
      sound.playPickup();
      onDefend(slot.attack, draggedCard);
    } else {
      haptics.error();
    }
    setDraggedCard(null);
    setSelectedCards([]);
  };

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

  // Durak Action conditions
  const canDone = isAttacker && (gs.phase === 'additional' || gs.phase === 'taking');
  // Defender can take cards ANY TIME during defense or additional phase
  const canTake = isDefender && (gs.phase === 'defense' || gs.phase === 'additional') && gs.table.length > 0;
  // Perevod: allowed when in perevodnoy mode, defending, no cards defended yet, and table cards share the same rank
  const canPass = isDefender &&
    gs.phase === 'defense' &&
    gs.mode === 'perevodnoy' &&
    gs.table.length > 0 &&
    gs.table.every((s) => !s.defense) &&
    gs.table.every((s) => s.attack.rank === gs.table[0].attack.rank);

  const handCount = gs.hand.length;
  const midIndex = (handCount - 1) / 2;

  // Status message
  let statusMessage = '';
  if (gs.phase === 'taking') {
    if (isAttacker) {
      statusMessage = '📥 Соперник берет! Вы можете подкинуть карты вдогонку или нажать «Сдать карты»';
    } else {
      statusMessage = '📥 Вы забираете карты. Соперник может подкинуть карты вдогонку...';
    }
  } else if (isAttacker) {
    if (gs.phase === 'attack') {
      statusMessage = `⚔️ Ваш ход! Выберите карты одного достоинства${gs.isFirstRound ? ' (Первый отбой: до 5 карт)' : ''}`;
    } else if (gs.phase === 'defense') {
      statusMessage = '⏳ Соперник отбивается...';
    } else if (gs.phase === 'additional') {
      statusMessage = '⚔️ Вы можете подкинуть карты того же достоинства или нажать «Бито»';
    }
  } else {
    if (gs.phase === 'defense') {
      statusMessage = canPass
        ? '🛡️ Ваш ход! Покройте карты, переведите их или нажмите «Взять»'
        : '🛡️ Ваш ход! Покройте карты или нажмите «Взять»';
    } else if (gs.phase === 'additional') {
      statusMessage = '🛡️ Вы отбились! Соперник решает, подкинуть ли карты... (или вы можете взять)';
    } else {
      statusMessage = '⏳ Ожидаем ход соперника...';
    }
  }

  return (
    <div className="flex flex-col h-full bg-tg-bg select-none overflow-hidden relative">
      {/* Top Header: Exit + Opponent Info + Status + Bank */}
      <div className="flex items-center justify-between px-3 py-2 bg-tg-secondaryBg border-b border-[var(--tg-theme-section-separator-color)] shadow-sm shrink-0">
        <div className="flex items-center gap-2">
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
          {dealingAnimation && (
            <span className="text-[10px] text-amber-400 font-bold animate-pulse">Раздача...</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 shadow-sm">
          <span className="text-tg-hint text-[11px] font-medium">Козырь:</span>
          <span className={`text-base font-black leading-none ${trumpCol}`}>{trumpSym}</span>
        </div>

        <div className="text-[11px] text-tg-hint">
          Сброс: <span className="font-bold text-tg-text">{gs.discardCount}</span>
        </div>
      </div>

      {/* Status Bar */}
      <div className="px-3 py-1 bg-tg-secondaryBg/40 border-b border-[var(--tg-theme-section-separator-color)] text-center">
        <span className="text-[11px] font-bold text-tg-text">{statusMessage}</span>
      </div>

      {/* Center Table (Playing Field & Drop Zone) */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleTableDrop}
        className="flex-1 flex flex-wrap items-center justify-center gap-4 p-4 overflow-y-auto min-h-0 bg-radial from-emerald-950/20 via-transparent to-transparent relative"
      >
        {gs.table.length === 0 ? (
          <div className="text-center py-6 space-y-2 opacity-85">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] flex items-center justify-center text-4xl shadow-md">
              🃏
            </div>
            <p className="text-xs font-black text-tg-text">
              {isAttacker
                ? 'Выберите карты (можно пару одинаковых) и нажмите «Пойти»'
                : 'Ожидаем ход соперника...'}
            </p>
            <p className="text-[10px] text-tg-hint">
              {gs.mode === 'perevodnoy' ? 'Режим: Переводной дурак' : 'Режим: Классический подкидной'}
            </p>
          </div>
        ) : (
          gs.table.map((slot, i) => (
            <div
              key={i}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleSlotDrop(e, slot)}
              className="relative flex flex-col items-center cursor-pointer"
              onClick={() => handleTableSlotClick(slot)}
            >
              <CardItem card={slot.attack} />
              {slot.defense ? (
                <div className="-mt-11 ml-7 shadow-2xl transition-transform">
                  <CardItem card={slot.defense} />
                </div>
              ) : (
                isDefender && (
                  <div className="w-[54px] h-[82px] rounded-2xl border-2 border-dashed border-indigo-400 bg-indigo-500/15 flex items-center justify-center text-indigo-300 text-xs font-black -mt-11 ml-7 shadow-lg animate-pulse">
                    Крыть
                  </div>
                )
              )}
            </div>
          ))
        )}
      </div>

      {/* Action Controls Bar */}
      {(canDone || canTake || (canPass && selectedCards.length > 0) || (isAttacker && selectedCards.length > 0)) && (
        <div className="flex gap-2 px-4 py-2 bg-tg-secondaryBg/95 border-t border-[var(--tg-theme-section-separator-color)] shrink-0">
          {/* Quick Play Selected Cards Button */}
          {isAttacker && selectedCards.length > 0 && (
            <button
              onClick={handleSendSelectedCards}
              className="flex-1 py-3 rounded-2xl bg-amber-500/25 border border-amber-500/50 text-amber-300 font-black text-xs active:scale-95 transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5 animate-pulse"
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {gs.phase === 'additional' || gs.phase === 'taking' ? 'Подкинуть' : 'Пойти'}{' '}
                {selectedCards.length > 1
                  ? `${selectedCards.length} шт (${selectedCards.map((c) => RANK_RU[c.rank] + SUIT_SYMBOLS[c.suit]).join(' ')})`
                  : `1 шт (${RANK_RU[selectedCards[0].rank]}${SUIT_SYMBOLS[selectedCards[0].suit]})`}
              </span>
            </button>
          )}

          {/* Translation Button */}
          {canPass && selectedCards.length > 0 && (
            <button
              onClick={handlePassSelectedCards}
              className="flex-1 py-3 rounded-2xl bg-indigo-500/25 border border-indigo-500/50 text-indigo-300 font-black text-xs active:scale-95 transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5 animate-pulse"
            >
              <CornerDownRight className="w-3.5 h-3.5" />
              <span>
                Перевести {selectedCards.length > 1 ? `(${selectedCards.length} шт)` : `(${RANK_RU[selectedCards[0].rank]}${SUIT_SYMBOLS[selectedCards[0].suit]})`} 🔄
              </span>
            </button>
          )}

          {canDone && (
            <button
              onClick={() => {
                sound.playUiTap();
                haptics.medium();
                onDoneAttacking();
              }}
              className={`flex-1 py-3 rounded-2xl font-black text-xs active:scale-95 transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5 ${
                gs.phase === 'taking'
                  ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400'
                  : 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
              }`}
            >
              <span>{gs.phase === 'taking' ? 'Сдать карты (Закончить)' : 'Бито'}</span>
              <span>{gs.phase === 'taking' ? '📥' : '✅'}</span>
            </button>
          )}

          {canTake && (
            <button
              onClick={() => {
                sound.playUiTap();
                haptics.medium();
                onTake();
              }}
              className="flex-1 py-3 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 font-black text-xs active:scale-95 transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5"
            >
              <span>Взять карты</span>
              <span>📥</span>
            </button>
          )}
        </div>
      )}

      {/* Player Hand (Realistic Fan with Drag and Drop) */}
      <div className="pt-6 pb-4 px-2 bg-gradient-to-t from-tg-secondaryBg via-tg-secondaryBg/95 to-transparent border-t border-[var(--tg-theme-section-separator-color)] shadow-2xl shrink-0">
        <div className="flex items-end justify-center -space-x-3 sm:-space-x-4 overflow-x-visible max-w-full px-4 min-h-[96px]">
          {gs.hand.map((card, i) => {
            const isSel = selectedCards.some((c) => c.rank === card.rank && c.suit === card.suit);
            const deg = (i - midIndex) * Math.min(5, 36 / handCount);
            const translateY = Math.abs(i - midIndex) * 2.5;

            return (
              <div
                key={`${card.rank}${card.suit}${i}`}
                style={{
                  transform: isSel ? 'translateY(-22px) scale(1.08)' : `translateY(${translateY}px) rotate(${deg}deg)`,
                  zIndex: isSel ? 40 : i + 1,
                }}
                className="transition-transform duration-150 ease-out shrink-0"
              >
                <CardItem
                  card={card}
                  selected={isSel}
                  isDealing={dealingAnimation}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', card.rank + card.suit);
                    setDraggedCard(card);
                    if (!selectedCards.some((c) => c.rank === card.rank && c.suit === card.suit)) {
                      setSelectedCards([card]);
                    }
                    haptics.light();
                  }}
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
