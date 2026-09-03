import React, { useState, useCallback } from 'react';
import { haptics } from '../../../telegram/telegram';

type Suit = 's' | 'h' | 'd' | 'c';
type Rank = '6'|'7'|'8'|'9'|'10'|'J'|'Q'|'K'|'A';
interface Card { rank: Rank; suit: Suit }
interface TableSlot { attack: Card; defense: Card | null }

const SUIT_SYMBOL: Record<Suit, string> = { s:'♠', h:'♥', d:'♦', c:'♣' };
const SUIT_COLOR: Record<Suit, string> = { s:'text-tg-text', h:'text-rose-500', d:'text-rose-500', c:'text-tg-text' };

interface Props {
  roomId: string;
  myUserId: number;
  opponent: { firstName: string; username: string | null; userId: number };
  betAmount: number;
  gameState: {
    hand: Card[]; opponentCardCount: number; table: TableSlot[];
    phase: string; deckCount: number; trump: Suit; attackerId: number; defenderId: number; discardCount: number;
  } | null;
  onAttack: (card: Card) => void;
  onDefend: (attackCard: Card, defenseCard: Card) => void;
  onPass: (card: Card) => void;
  onTake: () => void;
  onDoneAttacking: () => void;
  onSurrender: () => void;
  gameOverData?: { reason: string; winnerUserId: number | null; payout: number; commission: number } | null;
}

function CardView({ card, selected, onClick, small }: { card: Card; selected?: boolean; onClick?: () => void; small?: boolean }) {
  const sym = SUIT_SYMBOL[card.suit];
  const col = SUIT_COLOR[card.suit];
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border-2 flex flex-col items-center justify-between select-none active:scale-95 transition-all ${small ? 'w-9 h-12 text-xs p-0.5' : 'w-11 h-16 text-sm p-1'} ${selected ? 'border-indigo-400 bg-indigo-500/20 -translate-y-3' : 'border-[var(--tg-theme-section-separator-color)] bg-tg-secondaryBg'}`}
      style={{ touchAction: 'none' }}
    >
      <span className={`font-bold leading-none ${col} ${small ? 'text-[9px]' : 'text-xs'}`}>{card.rank}</span>
      <span className={`leading-none ${col} ${small ? 'text-base' : 'text-xl'}`}>{sym}</span>
      <span className={`font-bold leading-none rotate-180 ${col} ${small ? 'text-[9px]' : 'text-xs'}`}>{card.rank}</span>
    </button>
  );
}

function CardBack({ small }: { small?: boolean }) {
  return (
    <div className={`rounded-lg border-2 border-indigo-500/30 bg-indigo-900/30 flex items-center justify-center ${small ? 'w-9 h-12' : 'w-11 h-16'}`}>
      <span className="text-indigo-400/60" style={{ fontSize: small ? 10 : 16 }}>🂠</span>
    </div>
  );
}

export const DurakGame: React.FC<Props> = ({
  myUserId, opponent, betAmount, gameState, onAttack, onDefend, onPass, onTake, onDoneAttacking, onSurrender, gameOverData,
}) => {
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [showSurrender, setShowSurrender] = useState(false);

  const gs = gameState;
  const isAttacker = gs?.attackerId === myUserId;
  const isDefender = gs?.defenderId === myUserId;

  const handleCardClick = useCallback((card: Card) => {
    if (!gs) return;
    haptics.light();
    if (isAttacker && (gs.phase === 'attack' || gs.phase === 'additional')) {
      onAttack(card);
      setSelectedCard(null);
    } else if (isDefender && gs.phase === 'defense') {
      if (!selectedCard) {
        // First: select attack card to defend against
        const attackSlot = gs.table.find(s => !s.defense);
        if (attackSlot) {
          setSelectedCard(card); // selected = my defense card for the pending attack
          onDefend(attackSlot.attack, card);
          setSelectedCard(null);
        }
      }
    } else if (isDefender && gs.phase === 'defense' && gs.table.length === 1 && !gs.table[0].defense) {
      // Pass (perevodnoy)
      setSelectedCard(prev => prev?.rank === card.rank && prev.suit === card.suit ? null : card);
    }
  }, [gs, isAttacker, isDefender, selectedCard, onAttack, onDefend]);

  const handleTableSlotClick = useCallback((slot: TableSlot) => {
    if (!gs || !isDefender || gs.phase !== 'defense' || slot.defense) return;
    if (!selectedCard) return;
    onDefend(slot.attack, selectedCard);
    setSelectedCard(null);
  }, [gs, isDefender, selectedCard, onDefend]);

  if (gameOverData) {
    const won = gameOverData.winnerUserId === myUserId;
    const draw = !gameOverData.winnerUserId;
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-6 touch-none select-none">
        <div className="text-6xl">{draw ? '🤝' : won ? '🏆' : '😔'}</div>
        <h2 className="text-2xl font-black text-tg-text">{draw ? 'Ничья!' : won ? 'Победа!' : 'Поражение'}</h2>
        <p className="text-xs text-tg-hint">{gameOverData.reason === 'surrender' ? 'Соперник сдался' : gameOverData.reason === 'hand_empty' ? 'Карты закончились' : gameOverData.reason === 'disconnect' ? 'Соперник отключился' : gameOverData.reason}</p>
        {betAmount > 0 && !draw && won && <div className="text-amber-400 font-bold text-lg">+{gameOverData.payout} 🪙</div>}
        {betAmount > 0 && !draw && !won && <div className="text-rose-400 font-bold text-lg">-{betAmount} 🪙</div>}
      </div>
    );
  }

  if (!gs) return <div className="flex items-center justify-center h-full text-tg-hint">Загрузка...</div>;

  const trumpSym = SUIT_SYMBOL[gs.trump];
  const canDoneAttacking = isAttacker && gs.phase === 'additional';
  const canTake = isDefender && (gs.phase === 'defense' || gs.phase === 'additional');
  const canPass = isDefender && gs.phase === 'defense' && gs.table.length === 1 && !gs.table[0].defense;

  return (
    <div className="flex flex-col h-full bg-tg-bg touch-none select-none game-viewport-lock" style={{ touchAction: 'none' }}>
      {/* Opponent hand */}
      <div className="flex items-center gap-2 px-3 py-2 bg-tg-secondaryBg border-b border-[var(--tg-theme-section-separator-color)]">
        <div className="flex items-center gap-1">
          <div className="w-7 h-7 rounded-full bg-rose-500/30 flex items-center justify-center text-xs font-bold text-rose-400">{opponent.firstName[0]}</div>
          <span className="text-xs text-tg-hint">{opponent.firstName}</span>
          {!isAttacker && <span className="text-[10px] text-emerald-400 font-semibold ml-1">⚔️ атакует</span>}
          {!isDefender && <span className="text-[10px] text-blue-400 font-semibold ml-1">🛡️ защищается</span>}
        </div>
        <div className="flex gap-0.5 ml-2">
          {Array(gs.opponentCardCount).fill(null).map((_, i) => <CardBack key={i} small />)}
        </div>
        <div className="ml-auto text-xs text-tg-hint">{gs.opponentCardCount} карт</div>
      </div>

      {/* Deck & Trump info */}
      <div className="flex items-center justify-between px-4 py-1 text-xs text-tg-hint bg-tg-bg border-b border-[var(--tg-theme-section-separator-color)]">
        <span>🂠 Колода: {gs.deckCount}</span>
        <span className="font-bold">Козырь: <span className={SUIT_COLOR[gs.trump]}>{trumpSym}</span></span>
        <span>🗑️ Сброс: {gs.discardCount}</span>
      </div>

      {/* Table */}
      <div className="flex-1 flex flex-wrap items-center justify-center gap-2 p-3 min-h-0 overflow-auto">
        {gs.table.length === 0 ? (
          <div className="text-tg-hint text-sm text-center">
            {isAttacker ? '👆 Выберите карту для атаки' : '⏳ Ожидаем атаку...'}
          </div>
        ) : (
          gs.table.map((slot, i) => (
            <div key={i} className="relative flex flex-col items-center gap-1" onClick={() => handleTableSlotClick(slot)}>
              <CardView card={slot.attack} />
              {slot.defense ? (
                <div className="-mt-8 ml-4">
                  <CardView card={slot.defense} />
                </div>
              ) : (
                isDefender && selectedCard && gs.phase === 'defense' && (
                  <div className="w-11 h-16 rounded-lg border-2 border-dashed border-indigo-400/40 flex items-center justify-center text-indigo-400/40 text-xl -mt-8 ml-4">+</div>
                )
              )}
            </div>
          ))
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 px-3 pb-2">
        {canDoneAttacking && (
          <button onClick={onDoneAttacking} className="flex-1 py-2 rounded-xl bg-emerald-500/20 text-emerald-400 font-bold text-sm active:scale-95 transition-transform">
            ✅ Готово
          </button>
        )}
        {canTake && (
          <button onClick={onTake} className="flex-1 py-2 rounded-xl bg-rose-500/20 text-rose-400 font-bold text-sm active:scale-95 transition-transform">
            📥 Взять
          </button>
        )}
        {canPass && (
          <button onClick={() => selectedCard && onPass(selectedCard)} disabled={!selectedCard} className="flex-1 py-2 rounded-xl bg-amber-500/20 text-amber-400 font-bold text-sm active:scale-95 transition-transform disabled:opacity-40">
            🔄 Перевести
          </button>
        )}
        <button onClick={() => setShowSurrender(true)} className="px-3 py-2 rounded-xl bg-tg-secondaryBg text-tg-hint text-sm active:scale-95 transition-transform">🏳️</button>
      </div>

      {/* My hand */}
      <div className="flex items-end justify-center gap-1 px-2 pb-3 bg-tg-secondaryBg border-t border-[var(--tg-theme-section-separator-color)] overflow-x-auto min-h-[80px]">
        {gs.hand.map((card, i) => (
          <CardView
            key={`${card.rank}${card.suit}${i}`}
            card={card}
            selected={selectedCard?.rank === card.rank && selectedCard.suit === card.suit}
            onClick={() => {
              if (isDefender && gs.phase === 'defense') {
                setSelectedCard(prev => prev?.rank === card.rank && prev.suit === card.suit ? null : card);
              } else {
                handleCardClick(card);
              }
            }}
          />
        ))}
        {gs.hand.length === 0 && <div className="text-tg-hint text-xs py-4">Нет карт</div>}
      </div>

      {/* Defend with selected card hint */}
      {isDefender && selectedCard && gs.phase === 'defense' && (
        <div className="px-3 pb-2 bg-tg-secondaryBg">
          <p className="text-xs text-indigo-400 text-center">Теперь нажмите на карту атаки, которую хотите покрыть</p>
        </div>
      )}

      {showSurrender && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-tg-secondaryBg rounded-2xl p-5 mx-4 space-y-3">
            <h3 className="font-bold text-tg-text text-center">Сдаться?</h3>
            <div className="flex gap-3">
              <button onClick={() => setShowSurrender(false)} className="flex-1 py-2 rounded-xl bg-tg-bg text-tg-hint text-sm font-bold">Отмена</button>
              <button onClick={() => { setShowSurrender(false); onSurrender(); }} className="flex-1 py-2 rounded-xl bg-rose-500/20 text-rose-400 text-sm font-bold">Сдаться</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};