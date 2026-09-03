import { useEffect, useRef, useCallback, useState } from 'react';
import { getTelegramInitData, getTelegramUser } from '../../telegram/telegram';
import type { Card, TableSlot, ShipCell, ShotCell, DuelGameType, GameOverPayload } from './types';

const WS_BASE = (() => {
  if (typeof window === 'undefined') return 'ws://localhost:3002/api/ws';
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/api/ws`;
})();

export interface DuelEventMap {
  queued: { gameType: string; betAmount: number };
  queue_left: Record<string, never>;
  room_created: { roomId: string; gameType: string; betAmount: number; deepLink: string };
  room_rejoined: { roomId: string; role: string; status: string };
  game_start: {
    roomId: string;
    gameType: DuelGameType;
    betAmount: number;
    role: string;
    myUserId: number;
    opponent: { firstName: string; username: string | null; userId: number };
    myColor?: 'white' | 'black';
    opponentColor?: 'white' | 'black';
    fen?: string;
    timerMode?: string;
    whiteTimeMs?: number;
    blackTimeMs?: number;
    hand?: Card[];
    trump?: 's' | 'h' | 'd' | 'c';
    deckCount?: number;
    attackerId?: number;
    defenderId?: number;
    mode?: string;
    phase?: string;
  };
  game_over: GameOverPayload;
  chess_move: {
    from: string;
    to: string;
    promotion?: string;
    fen: string;
    currentTurn: string;
    whiteTimeMs: number;
    blackTimeMs: number;
    status: string;
  };
  chess_tick: { whiteTimeMs: number; blackTimeMs: number };
  chess_draw_offered: { fromUserId: number };
  chess_draw_declined: Record<string, never>;
  durak_state: {
    hand: Card[];
    opponentCardCount: number;
    table: TableSlot[];
    phase: string;
    deckCount: number;
    trump: 's' | 'h' | 'd' | 'c';
    attackerId: number;
    defenderId: number;
    discardCount: number;
  };
  battleship_placed: Record<string, never>;
  battleship_battle_start: { currentAttackerId: number };
  battleship_shot_result: {
    r: number;
    c: number;
    hit: boolean;
    sunk: ShipCell[] | null;
    autoMisses?: ShotCell[];
    myShots: ShotCell[];
    nextAttackerId: number;
  };
  battleship_opponent_shot: {
    r: number;
    c: number;
    hit: boolean;
    sunk: ShipCell[] | null;
    autoMisses?: ShotCell[];
    allShots?: ShotCell[];
    nextAttackerId: number;
  };
  opponent_disconnected: { reconnectSeconds: number };
  opponent_reconnected: Record<string, never>;
  reconnected: {
    roomId: string;
    gameType: string;
    betAmount: number;
    role: string;
    myUserId: number;
    fen?: string;
    myColor?: 'white' | 'black';
    currentTurn?: string;
    whiteTimeMs?: number;
    blackTimeMs?: number;
    timerMode?: string;
    hand?: Card[];
    table?: TableSlot[];
    phase?: string;
    deckCount?: number;
    trump?: string;
    attackerId?: number;
    myShots?: ShotCell[];
    currentAttackerId?: number;
  };
  pong: { ts: number };
  error: { message: string };
}

type EventHandler<T extends keyof DuelEventMap> = (data: DuelEventMap[T]) => void;
type HandlerMap = { [K in keyof DuelEventMap]?: EventHandler<K>[] };

export function useDuelWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<HandlerMap>({});
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [connected, setConnected] = useState(false);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const initData = getTelegramInitData();
    const user = getTelegramUser();
    const uid = encodeURIComponent(String(user.id || ''));
    const uname = encodeURIComponent(user.first_name || 'Player');
    const url = `${WS_BASE}?initData=${encodeURIComponent(initData)}&devUserId=${uid}&devUserName=${uname}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      reconnectAttempts.current = 0;
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 25000);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as { type: keyof DuelEventMap } & Record<string, unknown>;
        const handlers = handlersRef.current[data.type] as EventHandler<typeof data.type>[] | undefined;
        if (handlers) handlers.forEach((h) => h(data as never));
      } catch (e) {
        console.error('[WS] Parse error:', e);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (reconnectAttempts.current < 5) {
        const delay = Math.min(1000 * (reconnectAttempts.current + 1), 5000);
        reconnectTimer.current = setTimeout(() => {
          reconnectAttempts.current++;
          connect();
        }, delay);
      }
    };

    ws.onerror = (e) => {
      console.warn('[WS] Error:', e);
    };
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    reconnectAttempts.current = 999;
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
  }, []);

  const send = useCallback((data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  const on = useCallback(<T extends keyof DuelEventMap>(event: T, handler: EventHandler<T>) => {
    if (!handlersRef.current[event]) handlersRef.current[event] = [];
    (handlersRef.current[event] as EventHandler<T>[]).push(handler);
    return () => {
      handlersRef.current[event] = (handlersRef.current[event] as EventHandler<T>[]).filter((h) => h !== handler) as never;
    };
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return { send, on, connected, connect, disconnect };
}
