import React, { useState, useEffect, useCallback, useRef } from 'react';
import { haptics, setupBackButton, removeBackButton } from '../../../telegram/telegram';
import { sound } from '../../../utils/sound';
import confetti from 'canvas-confetti';
import { ArrowLeft, Flag, Trophy, Frown, Sparkles } from 'lucide-react';
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
  '6': '6', '7': '7', '8': '8', '9': '9', '10': '10',
  'J': 'В', 'Q': 'Д', 'K': 'К', 'A': 'Т',
  'В': 'В', 'Д': 'Д', 'К': 'К', 'Т': 'Т',
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

/* ─── Игровая Карта (Аутентичный стиль Дурак Онлайн) ─── */
function PlayingCard({
  card,
  selected,
  onClick,
  small,
  style,
  onDragStart,
  onTouchStart,
  onTouchEnd,
  isDealing,
  className = '',
}: {
  card: Card;
  selected?: boolean;
  onClick?: () => void;
  small?: boolean;
  style?: React.CSSProperties;
  onDragStart?: (e: React.DragEvent) => void;
  onTouchStart?: (e: React.TouchEvent) => void;
  onTouchEnd?: (e: React.TouchEvent) => void;
  isDealing?: boolean;
  className?: string;
}) {
  const rank = RANK_RU[card.rank] || card.rank;
  const sym = SUIT_SYMBOLS[card.suit] || card.suit;
  const isRed = SUIT_IS_RED[card.suit] || false;
  const textColor = isRed ? '#dc2626' : '#1e293b';

  if (small) {
    return (
      <div
        onClick={onClick}
        style={style}
        className={`w-[42px] h-[62px] rounded-lg bg-white border border-slate-300 shadow-md flex flex-col justify-between p-1 select-none shrink-0 ${className}`}
      >
        <div className="flex items-center leading-none" style={{ color: textColor }}>
          <span className="font-extrabold text-[11px]">{rank}</span>
          <span className="text-[10px] ml-0.5">{sym}</span>
        </div>
        <div className="text-center text-lg font-black leading-none" style={{ color: textColor }}>
          {sym}
        </div>
        <div className="flex items-center justify-end leading-none rotate-180" style={{ color: textColor }}>
          <span className="font-extrabold text-[11px]">{rank}</span>
          <span className="text-[10px] ml-0.5">{sym}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onClick={onClick}
      style={{
        ...style,
        color: textColor,
      }}
      className={`relative w-[58px] h-[86px] sm:w-[64px] sm:h-[94px] rounded-xl bg-gradient-to-b from-white via-[#fafbfc] to-[#edf1f7] border select-none transition-all duration-150 cursor-pointer shrink-0 flex flex-col justify-between p-1.5 shadow-xl ${
        isDealing ? 'animate-deal-card' : ''
      } ${
        selected
          ? '-translate-y-6 ring-[3px] ring-amber-400 shadow-2xl shadow-amber-500/50 border-amber-300 z-30 scale-105'
          : 'border-slate-300 hover:-translate-y-2 active:scale-95'
      } ${className}`}
    >
      {/* Top Left */}
      <div className="flex flex-col items-start leading-none pointer-events-none">
        <span className="font-black text-xs sm:text-sm tracking-tight">{rank}</span>
        <span className="text-xs sm:text-sm mt-0.5">{sym}</span>
      </div>

      {/* Center Big Suit */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="text-2xl sm:text-3xl font-black opacity-85">{sym}</span>
      </div>

      {/* Bottom Right */}
      <div className="flex flex-col items-start leading-none rotate-180 self-end pointer-events-none">
        <span className="font-black text-xs sm:text-sm tracking-tight">{rank}</span>
        <span className="text-xs sm:text-sm mt-0.5">{sym}</span>
      </div>
    </div>
  );
}

/* ─── Рубашка Карты (Дурак Онлайн) ─── */
function CardBack({ small, style, count }: { small?: boolean; style?: React.CSSProperties; count?: number }) {
  return (
    <div
      style={style}
      className={`rounded-xl border border-blue-400/40 bg-gradient-to-br from-blue-900 via-indigo-950 to-blue-950 shadow-lg flex flex-col items-center justify-center select-none shrink-0 overflow-hidden relative ${
        small ? 'w-[36px] h-[52px]' : 'w-[52px] h-[78px]'
      }`}
    >
      <div className="absolute inset-1 rounded-lg border border-blue-400/30 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:5px_5px] opacity-70" />
      {count !== undefined && (
        <span className="z-10 font-black text-white text-sm sm:text-base drop-shadow-md">
          {count}
        </span>
      )}
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
  // Поднятые карты в руке (можно поднять 1, 2, 3 или 4 карты одного ранга!)
  const [selectedCards, setSelectedCards] = useState<Card[]>([]);
  const [showSurrender, setShowSurrender] = useState(false);
  const [dealingAnimation, setDealingAnimation] = useState(false);
  const prevHandCountRef = useRef<number>(0);

  // Для свайпа карты вверх (как в мобильном Дурак Онлайн)
  const touchStartY = useRef<number | null>(null);

  const gs = gameState;
  const isAttacker = gs?.attackerId === myUserId;
  const isDefender = gs?.defenderId === myUserId;

  // Очистка выделения при смене фазы или очистке стола
  useEffect(() => {
    setSelectedCards([]);
  }, [gs?.table.length, gs?.phase]);

  // Кнопка «Назад» в Telegram
  useEffect(() => {
    setupBackButton(() => setShowSurrender(true));
    return () => removeBackButton();
  }, []);

  // Анимация раздачи
  useEffect(() => {
    if (gs) {
      if (gs.hand.length > prevHandCountRef.current) {
        setDealingAnimation(true);
        sound.playPickup();
        const t = setTimeout(() => setDealingAnimation(false), 500);
        prevHandCountRef.current = gs.hand.length;
        return () => clearTimeout(t);
      }
      prevHandCountRef.current = gs.hand.length;
    }
  }, [gs?.hand.length]);

  // Конфетти при победе
  useEffect(() => {
    if (gameOverData) {
      const won = gameOverData.winnerUserId === myUserId;
      if (won) {
        sound.playRecord();
        confetti({
          particleCount: 80,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#10b981', '#f59e0b', '#3b82f6', '#ec4899'],
        });
      } else {
        sound.playGameOver();
      }
    }
  }, [gameOverData, myUserId]);

  /* ─── КЛИК ПО КАРТЕ В РУКЕ ─── */
  const handleCardClick = useCallback(
    (card: Card) => {
      if (!gs) return;
      haptics.light();
      sound.playPickup();

      if (isAttacker) {
        // Атакующий может поднять несколько карт одного ранга (например, две 6-ки)
        setSelectedCards((prev) => {
          const already = prev.find((c) => c.rank === card.rank && c.suit === card.suit);
          if (already) {
            // Опустить эту карту
            return prev.filter((c) => !(c.rank === card.rank && c.suit === card.suit));
          }
          if (prev.length === 0) {
            return [card];
          }
          // Если карта того же ранга — поднимаем её тоже!
          if (prev[0].rank === card.rank) {
            const maxTable = gs.isFirstRound ? 5 : 6;
            const maxAllowed = Math.min(
              gs.opponentCardCount - gs.table.filter((s) => !s.defense).length,
              maxTable - gs.table.length
            );
            if (prev.length < maxAllowed) {
              return [...prev, card];
            }
            return prev;
          }
          // Если другой ранг — переключаем выбор на новую карту
          return [card];
        });
      } else if (isDefender) {
        // Защитник выбирает карту для отбоя или перевода
        setSelectedCards((prev) => {
          const already = prev.find((c) => c.rank === card.rank && c.suit === card.suit);
          if (already) return [];
          // В переводном дураке можно поднять несколько карт одного ранга для перевода
          if (
            gs.mode === 'perevodnoy' &&
            gs.table.length > 0 &&
            gs.table.every((s) => !s.defense) &&
            card.rank === gs.table[0].attack.rank
          ) {
            if (prev.length > 0 && prev[0].rank === card.rank) {
              return [...prev, card];
            }
            return [card];
          }
          return [card];
        });
      }
    },
    [gs, isAttacker, isDefender]
  );

  /* ─── КЛИК ПО СТОЛУ / СВАЙП НА СТОЛ (ВЫКИДЫВАНИЕ ПОДНЯТЫХ КАРТ) ─── */
  const handlePlaySelectedCardsToTable = useCallback(() => {
    if (!gs || selectedCards.length === 0) return;

    if (isAttacker && (gs.phase === 'attack' || gs.phase === 'additional' || gs.phase === 'taking')) {
      // Выкидываем все поднятые карты на стол
      sound.playPickup();
      haptics.medium();
      onAttack(selectedCards);
      setSelectedCards([]);
    } else if (isDefender && gs.phase === 'defense') {
      // В переводном: если карты совпадают по рангу с атакой и на столе ничего не побито — это ПЕРЕВОД!
      const canPass =
        gs.mode === 'perevodnoy' &&
        gs.table.length > 0 &&
        gs.table.every((s) => !s.defense) &&
        selectedCards.every((c) => c.rank === gs.table[0].attack.rank);

      if (canPass) {
        sound.playPickup();
        haptics.medium();
        onPass(selectedCards);
        setSelectedCards([]);
        return;
      }

      // Иначе если на столе есть 1 открытая карта и выбранная карта бьет её — покрыть!
      const openSlot = gs.table.find((s) => !s.defense);
      if (openSlot && selectedCards.length === 1 && canBeat(openSlot.attack, selectedCards[0], gs.trump)) {
        sound.playPickup();
        haptics.medium();
        onDefend(openSlot.attack, selectedCards[0]);
        setSelectedCards([]);
      }
    }
  }, [gs, isAttacker, isDefender, selectedCards, onAttack, onPass, onDefend]);

  /* ─── КЛИК ПО КОНКРЕТНОЙ КАРТЕ АТАКИ НА СТОЛЕ (ДЛЯ ОТБОЯ) ─── */
  const handleSlotClick = useCallback(
    (slot: TableSlot) => {
      if (!gs || !isDefender || slot.defense) return;
      if (selectedCards.length === 0) return;

      const cardToUse = selectedCards[0];
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

  /* ─── Drag and Drop на стол ─── */
  const handleDropOnTable = (e: React.DragEvent) => {
    e.preventDefault();
    handlePlaySelectedCardsToTable();
  };

  const handleDropOnSlot = (e: React.DragEvent, slot: TableSlot) => {
    e.preventDefault();
    e.stopPropagation();
    handleSlotClick(slot);
  };

  /* ─── Touch Swipe вверх (выкидывание карты на мобильных) ─── */
  const handleTouchStart = (e: React.TouchEvent, card: Card) => {
    touchStartY.current = e.touches[0].clientY;
    // Если карта еще не выбрана — выбираем её
    if (!selectedCards.some((c) => c.rank === card.rank && c.suit === card.suit)) {
      handleCardClick(card);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current !== null) {
      const touchEndY = e.changedTouches[0].clientY;
      const deltaY = touchStartY.current - touchEndY;
      // Если смахнули вверх более чем на 40px — выкидываем на стол!
      if (deltaY > 40) {
        handlePlaySelectedCardsToTable();
      }
      touchStartY.current = null;
    }
  };

  if (!gs) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-tg-hint bg-[#0c2e1c]">
        <div className="text-4xl animate-spin">🃏</div>
        <p className="text-xs font-bold text-emerald-200">Загрузка стола...</p>
      </div>
    );
  }

  const trumpSym = SUIT_SYMBOLS[gs.trump] || gs.trump;
  const isTrumpRed = SUIT_IS_RED[gs.trump];
  const trumpCol = isTrumpRed ? 'text-red-500' : 'text-slate-900';

  // В «Дурак Онлайн» есть ОДНА контекстная кнопка действия внизу:
  // 1. Атакующий и раунд отбит -> «БИТО»
  // 2. Атакующий и соперник взял -> «ГОТОВО»
  // 3. Защитник и на столе есть карты -> «БЕРУ»
  const showBito = isAttacker && gs.phase === 'additional';
  const showGotovo = isAttacker && gs.phase === 'taking';
  const showTake = isDefender && (gs.phase === 'defense' || gs.phase === 'additional') && gs.table.length > 0;

  const handCount = gs.hand.length;
  const midIndex = (handCount - 1) / 2;

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-[#0a2315] via-[#0d331e] to-[#07190e] select-none overflow-hidden relative touch-none">
      {/* ─── Верхняя панель: Профиль соперника + Банк + Выход ─── */}
      <div className="flex items-center justify-between px-3 py-2 bg-black/30 backdrop-blur-sm border-b border-white/10 z-20 shrink-0">
        <button
          onClick={() => setShowSurrender(true)}
          className="p-2 rounded-xl bg-white/10 text-white/70 hover:text-rose-400 active:scale-90 transition-all cursor-pointer"
          title="Сдаться"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        {/* Инфо о сопернике и статус */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-emerald-500/30 border border-emerald-400/40 flex items-center justify-center text-xs font-black text-emerald-300">
            {opponent.firstName[0]}
          </div>
          <div className="text-left leading-tight">
            <div className="text-xs font-bold text-white truncate max-w-[100px]">{opponent.firstName}</div>
            <div className="text-[10px] text-emerald-300/80 font-medium">
              {isAttacker ? 'Защищается' : 'Атакует'}
            </div>
          </div>
        </div>

        {/* Банк дуэли */}
        {betAmount > 0 && (
          <div className="flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <span>🪙</span>
            <span>{Math.floor(betAmount * 1.8)}</span>
          </div>
        )}
      </div>

      {/* ─── Карты соперника (рубашкой к нам, веер вверху) ─── */}
      <div className="flex items-center justify-center -space-x-5 pt-2 pb-1 shrink-0">
        {Array(Math.min(gs.opponentCardCount, 8))
          .fill(null)
          .map((_, i) => (
            <CardBack
              key={i}
              small
              style={{
                transform: `rotate(${(i - (Math.min(gs.opponentCardCount, 8) - 1) / 2) * 4}deg)`,
              }}
            />
          ))}
        {gs.opponentCardCount > 8 && (
          <span className="text-[11px] font-black text-emerald-300 pl-3">
            +{gs.opponentCardCount - 8}
          </span>
        )}
      </div>

      {/* ─── ИГРОВОЙ СТОЛ (Сукно «Дурак Онлайн») ─── */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDropOnTable}
        onClick={handlePlaySelectedCardsToTable}
        className="flex-1 flex items-center justify-center p-3 relative cursor-pointer"
      >
        {/* Колода слева с открытым поперек козырем */}
        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none z-10">
          {gs.deckCount > 0 ? (
            <div className="relative">
              {/* Открытый козырь ПОПЕРЕК (под колодой) */}
              <div className="absolute top-1/2 left-0 -translate-y-1/2 rotate-90 -translate-x-3 shadow-xl">
                <PlayingCard
                  card={{ rank: 'A', suit: gs.trump }}
                  small
                  className="border-amber-400/80"
                />
              </div>

              {/* Колода рубашкой вверх с числом оставшихся карт */}
              <div className="relative z-10 ml-3">
                <CardBack count={gs.deckCount} />
              </div>
            </div>
          ) : (
            /* Когда колода пуста — знак козырной масти */
            <div className="flex flex-col items-center justify-center w-11 h-16 rounded-xl border border-white/20 bg-black/20 text-center">
              <span className={`text-2xl font-black ${trumpCol}`}>{trumpSym}</span>
              <span className="text-[9px] text-white/60 font-bold uppercase">Козырь</span>
            </div>
          )}
        </div>

        {/* Стопка «Бито» (справа) */}
        {gs.discardCount > 0 && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none opacity-60">
            <CardBack small />
            <span className="text-[10px] font-bold text-white/70 mt-1">Отбой ({gs.discardCount})</span>
          </div>
        )}

        {/* Пары карт на столе (Атака / Защита) */}
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 max-w-[280px] sm:max-w-[340px] z-10">
          {gs.table.length === 0 ? (
            <div className="text-center py-6 pointer-events-none animate-pulse">
              <p className="text-xs sm:text-sm font-black text-emerald-200/80">
                {isAttacker ? 'Ваш ход • Выберите карту и смахните на стол' : 'Соперник думает над ходом...'}
              </p>
              {gs.mode === 'perevodnoy' && (
                <p className="text-[10px] text-emerald-400/70 font-semibold mt-0.5">
                  Режим: Переводной дурак
                </p>
              )}
            </div>
          ) : (
            gs.table.map((slot, i) => (
              <div
                key={i}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDropOnSlot(e, slot)}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSlotClick(slot);
                }}
                className="relative flex flex-col items-center"
              >
                {/* Атакующая карта */}
                <PlayingCard card={slot.attack} />

                {/* Покрывающая карта (ложится поверх со сдвигом, как в Дурак Онлайн) */}
                {slot.defense ? (
                  <div className="absolute -bottom-2 -right-2 shadow-2xl transition-transform animate-scale-up">
                    <PlayingCard card={slot.defense} />
                  </div>
                ) : (
                  isDefender && (
                    <div className="absolute -bottom-2 -right-2 w-[58px] h-[86px] sm:w-[64px] sm:h-[94px] rounded-xl border-2 border-dashed border-amber-400/80 bg-amber-500/15 flex items-center justify-center text-amber-200 text-xs font-black shadow-lg animate-pulse">
                      Крыть
                    </div>
                  )
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ─── Единственная Кнопка Действия (БИТО / БЕРУ / ГОТОВО) ─── */}
      {(showBito || showGotovo || showTake) && (
        <div className="absolute right-4 bottom-28 z-40 animate-scale-up">
          {showBito && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                sound.playUiTap();
                haptics.medium();
                onDoneAttacking();
              }}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 border border-emerald-300 text-white font-black text-sm uppercase tracking-wider shadow-2xl shadow-emerald-900/80 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>БИТО</span>
              <span>✓</span>
            </button>
          )}

          {showGotovo && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                sound.playUiTap();
                haptics.medium();
                onDoneAttacking();
              }}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 border border-amber-300 text-white font-black text-sm uppercase tracking-wider shadow-2xl shadow-amber-900/80 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>ГОТОВО</span>
              <span>✓</span>
            </button>
          )}

          {showTake && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                sound.playUiTap();
                haptics.medium();
                onTake();
              }}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-rose-600 to-red-700 border border-rose-400 text-white font-black text-sm uppercase tracking-wider shadow-2xl shadow-rose-950/80 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>БЕРУ</span>
              <span>📥</span>
            </button>
          )}
        </div>
      )}

      {/* ─── ВЕЕР КАРТ ИГРОКА (Внизу) ─── */}
      <div className="pb-4 pt-4 px-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-20 shrink-0">
        <div className="flex items-end justify-center -space-x-4 sm:-space-x-5 overflow-x-visible max-w-full px-4 min-h-[100px]">
          {gs.hand.map((card, i) => {
            const isSel = selectedCards.some((c) => c.rank === card.rank && c.suit === card.suit);
            const deg = (i - midIndex) * Math.min(4.5, 32 / handCount);
            const translateY = Math.abs(i - midIndex) * 2.2;

            return (
              <div
                key={`${card.rank}${card.suit}${i}`}
                style={{
                  transform: isSel
                    ? 'translateY(-24px) scale(1.08)'
                    : `translateY(${translateY}px) rotate(${deg}deg)`,
                  zIndex: isSel ? 35 : i + 1,
                }}
                className="transition-transform duration-150 ease-out shrink-0"
              >
                <PlayingCard
                  card={card}
                  selected={isSel}
                  isDealing={dealingAnimation}
                  onTouchStart={(e) => handleTouchStart(e, card)}
                  onTouchEnd={handleTouchEnd}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', card.rank + card.suit);
                    if (!selectedCards.some((c) => c.rank === card.rank && c.suit === card.suit)) {
                      handleCardClick(card);
                    }
                  }}
                  onClick={() => handleCardClick(card)}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Модалка Сдачи ─── */}
      {showSurrender && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-tg-secondaryBg border border-white/10 rounded-3xl p-5 shadow-2xl max-w-xs w-full text-center space-y-3 animate-scale-up">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Flag className="w-6 h-6" />
            </div>
            <h4 className="font-black text-base text-white">Сдаться?</h4>
            <p className="text-xs text-tg-hint leading-relaxed">
              Победа и ставка будут присуждены сопернику.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowSurrender(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/10 text-white font-bold text-xs active:scale-95 transition-all cursor-pointer"
              >
                Остаться
              </button>
              <button
                onClick={() => {
                  setShowSurrender(false);
                  onSurrender();
                  onExit();
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white font-bold text-xs active:scale-95 transition-all cursor-pointer"
              >
                Сдаться
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Результат Партии ─── */}
      {gameOverData && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-tg-secondaryBg border border-white/10 rounded-3xl p-6 shadow-2xl max-w-xs w-full text-center space-y-4 animate-scale-up">
            {gameOverData.winnerUserId === myUserId ? (
              <div className="space-y-2">
                <div className="w-16 h-16 mx-auto rounded-3xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-3xl shadow-inner text-amber-400">
                  <Trophy className="w-9 h-9 animate-bounce" />
                </div>
                <h3 className="font-black text-xl text-white">ПОБЕДА!</h3>
                <p className="text-xs text-tg-hint">Вы скинули все карты!</p>
                {betAmount > 0 && (
                  <div className="py-2 px-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-extrabold text-lg flex items-center justify-center gap-1.5">
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
                <h3 className="font-black text-xl text-white">Вы в дураках!</h3>
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
