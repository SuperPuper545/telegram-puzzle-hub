import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useGameBridge } from '../../context/GameContext';
import { 
  Globe, Trophy, Shield, Crosshair, Compass, Plus, Minus,
  Flag, Bomb, Crown, Coins, Users,
  Clock, Sparkles, RefreshCw, X, AlertTriangle, Layers, Loader2
} from 'lucide-react';
import { haptics } from '../../telegram/telegram';
import { sound } from '../../utils/sound';
import landmaskData from './world_landmask.json';

export interface MapCell {
  x: number;
  y: number;
  group_id: number | null;
  level: number;
  is_monument: number;
  monument_id: number | null;
  captured_at: string | null;
  shield_until: string | null;
  updated_at: string;
  is_land?: number;
  region_name?: string | null;
  group_name: string | null;
  group_color: string | null;
  group_photo: string | null;
}

interface GroupLeaderboardItem {
  id: number;
  name: string;
  username: string | null;
  photoUrl: string | null;
  color: string;
  treasuryTokens: number;
  commanderUserId: number | null;
  commanderName: string | null;
  memberCount: number;
  cycleScore: number;
  rank: number | null;
  isEligible: boolean;
}

export const WorldMapTab: React.FC = () => {
  const { user, coins, myGroup, fetchMyGroup, joinGroup } = useGameBridge();

  const [activeSubTab, setActiveSubTab] = useState<'map' | 'leaderboard'>('map');

  // Map Data State
  const [cells, setCells] = useState<MapCell[]>([]);
  const [isLoadingMap, setIsLoadingMap] = useState<boolean>(true);
  const [selectedCell, setSelectedCell] = useState<MapCell | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string>(new Date().toISOString());

  // Commander / Action mode
  const [selectedAction, setSelectedAction] = useState<'capture' | 'fortify' | 'sabotage' | 'monument' | 'emergency' | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Group Join / Switch Modal
  const [isJoinModalOpen, setIsJoinModalOpen] = useState<boolean>(false);
  const [chatInput, setChatInput] = useState<string>('');
  const [joinLoading, setJoinLoading] = useState<boolean>(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Leaderboard state
  const [leaderboard, setLeaderboard] = useState<GroupLeaderboardItem[]>([]);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [cycleNumber, setCycleNumber] = useState<number>(1);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState<boolean>(false);

  // Canvas refs & transform
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cellsMapRef = useRef<Map<string, MapCell>>(new Map());

  // Transform: scale and offset (camera)
  const transformRef = useRef({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  });

  // Touch gesture state
  const gestureRef = useRef<{
    isDragging: boolean;
    startX: number;
    startY: number;
    startOffsetX: number;
    startOffsetY: number;
    initialDistance: number;
    initialScale: number;
    hasMoved: boolean;
  }>({
    isDragging: false,
    startX: 0,
    startY: 0,
    startOffsetX: 0,
    startOffsetY: 0,
    initialDistance: 0,
    initialScale: 1,
    hasMoved: false,
  });

  const MAP_COLS = 80;
  const MAP_ROWS = 60;
  const BASE_CELL_SIZE = 12;

  // Format countdown
  const formatCountdown = (seconds: number) => {
    if (seconds <= 0) return 'Расчёт цикла...';
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (d > 0) return `${d}д ${h.toString().padStart(2, '0')}ч ${m.toString().padStart(2, '0')}м`;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // 1. Fetch Full Map
  const fetchFullMap = useCallback(async () => {
    try {
      const res = await fetch('/api/world-map');
      if (res.ok) {
        const data = await res.json();
        const mapList: MapCell[] = data.cells || [];
        setCells(mapList);

        const newMap = new Map<string, MapCell>();
        for (const c of mapList) {
          newMap.set(`${c.x},${c.y}`, c);
        }
        cellsMapRef.current = newMap;
        setLastSyncTime(new Date().toISOString());
        renderCanvas();
      }
    } catch (err) {
      console.warn('Failed to fetch world map:', err);
    } finally {
      setIsLoadingMap(false);
    }
  }, []);

  // 2. Fetch Leaderboard
  const fetchLeaderboardData = useCallback(async () => {
    setIsLoadingLeaderboard(true);
    try {
      const res = await fetch('/api/groups/leaderboard');
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data.leaderboard || []);
        setRemainingSeconds(data.remainingSeconds || 0);
        setCycleNumber(data.cycleNumber || 1);
      }
    } catch (err) {
      console.warn('Failed to fetch group leaderboard:', err);
    } finally {
      setIsLoadingLeaderboard(false);
    }
  }, []);

  // Cycle countdown timer
  useEffect(() => {
    if (remainingSeconds <= 0) return;
    const interval = setInterval(() => {
      setRemainingSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [remainingSeconds]);

  // Initial loads
  useEffect(() => {
    fetchFullMap();
    fetchLeaderboardData();
    fetchMyGroup();
  }, [fetchFullMap, fetchLeaderboardData, fetchMyGroup]);

  // Periodic diff polling fallback (every 30 seconds)
  useEffect(() => {
    const diffTimer = setInterval(async () => {
      try {
        const res = await fetch(`/api/world-map/diff?since=${encodeURIComponent(lastSyncTime)}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.diff) && data.diff.length > 0) {
            updateCellsInMap(data.diff);
            setLastSyncTime(new Date().toISOString());
          }
        }
      } catch (_) {}
    }, 30000);
    return () => clearInterval(diffTimer);
  }, [lastSyncTime]);

  // WebSocket Live Updates
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws`;
    let ws: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    const connectWs = () => {
      try {
        ws = new WebSocket(wsUrl);
        ws.onopen = () => {
          try { ws?.send(JSON.stringify({ type: 'ping' })); } catch (_) {}
        };
        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'map_update' && Array.isArray(msg.cells)) {
              updateCellsInMap(msg.cells);
              renderCanvas();
            }
          } catch (_) {}
        };
        ws.onclose = () => {
          reconnectTimeout = setTimeout(connectWs, 5000);
        };
      } catch (_) {
        reconnectTimeout = setTimeout(connectWs, 5000);
      }
    };

    connectWs();
    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, []);

  const updateCellsInMap = (updated: MapCell[]) => {
    for (const c of updated) {
      cellsMapRef.current.set(`${c.x},${c.y}`, c);
    }
    setCells(Array.from(cellsMapRef.current.values()));
    renderCanvas();
  };

  // Center camera on my group
  const handleFindMyGroup = () => {
    sound.playUiTap();
    haptics.selection();
    if (!myGroup?.group) {
      setActionNotice('Вы не состоите в группе');
      setTimeout(() => setActionNotice(null), 3000);
      return;
    }

    const myGroupId = myGroup.group.id;
    const myCells: MapCell[] = [];
    cellsMapRef.current.forEach((c) => {
      if (c.group_id === myGroupId) myCells.push(c);
    });

    if (myCells.length === 0) {
      setActionNotice('У вашей группы пока нет захваченных клеток');
      setTimeout(() => setActionNotice(null), 3000);
      return;
    }

    const avgX = myCells.reduce((sum, c) => sum + c.x, 0) / myCells.length;
    const avgY = myCells.reduce((sum, c) => sum + c.y, 0) / myCells.length;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const targetScale = 2.5;
    const pixelX = avgX * BASE_CELL_SIZE * targetScale;
    const pixelY = avgY * BASE_CELL_SIZE * targetScale;

    transformRef.current = {
      scale: targetScale,
      offsetX: canvas.width / (2 * (window.devicePixelRatio || 1)) - pixelX,
      offsetY: canvas.height / (2 * (window.devicePixelRatio || 1)) - pixelY,
    };

    renderCanvas();
  };

  const handleResetView = () => {
    sound.playUiTap();
    haptics.selection();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    const fitScale = width / (MAP_COLS * BASE_CELL_SIZE);
    const scale = Math.max(fitScale, 0.8);
    transformRef.current = {
      scale,
      offsetX: (width - (MAP_COLS * BASE_CELL_SIZE * scale)) / 2,
      offsetY: (height - (MAP_ROWS * BASE_CELL_SIZE * scale)) / 2,
    };
    renderCanvas();
  };

  // Render Canvas
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const { scale, offsetX, offsetY } = transformRef.current;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.scale(dpr, dpr);
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    const cellSize = BASE_CELL_SIZE;
    const mapWidth = MAP_COLS * cellSize;
    const mapHeight = MAP_ROWS * cellSize;

    // Deep Ocean Background
    ctx.fillStyle = '#061325';
    ctx.fillRect(0, 0, mapWidth, mapHeight);

    // Subtle Geographical Guide Lines
    // Equator (y = 30)
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(0, 30 * cellSize);
    ctx.lineTo(mapWidth, 30 * cellSize);
    ctx.stroke();

    // Prime Meridian (x = 40)
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
    ctx.beginPath();
    ctx.moveTo(40 * cellSize, 0);
    ctx.lineTo(40 * cellSize, mapHeight);
    ctx.stroke();
    ctx.setLineDash([]); // Reset line dash

    // Render cells (80 x 60)
    for (let x = 0; x < MAP_COLS; x++) {
      for (let y = 0; y < MAP_ROWS; y++) {
        const cell = cellsMapRef.current.get(`${x},${y}`);
        const isLand = (cell?.is_land !== undefined) ? (cell.is_land === 1) : (landmaskData.grid?.[y]?.[x] === 1);
        const px = x * cellSize;
        const py = y * cellSize;

        if (!isLand) {
          // Ocean cell
          ctx.fillStyle = '#0a1d3b';
          ctx.fillRect(px, py, cellSize, cellSize);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(px, py, cellSize, cellSize);
        } else {
          // Land cell
          if (cell && cell.group_id) {
            ctx.fillStyle = cell.group_color || '#6366f1';
            ctx.fillRect(px, py, cellSize, cellSize);

            if (cell.level >= 2 && !cell.is_monument) {
              ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
              ctx.fillRect(px + 2, py + 2, cellSize - 4, cellSize - 4);
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 1;
              ctx.strokeRect(px + 2, py + 2, cellSize - 4, cellSize - 4);
            }

            if (cell.shield_until && new Date(cell.shield_until).getTime() > Date.now()) {
              ctx.strokeStyle = '#38bdf8';
              ctx.lineWidth = 1.5;
              ctx.strokeRect(px + 1, py + 1, cellSize - 2, cellSize - 2);
            }

            ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(px, py, cellSize, cellSize);
          } else {
            // Neutral continent landmass
            ctx.fillStyle = '#154228';
            ctx.fillRect(px, py, cellSize, cellSize);

            ctx.strokeStyle = '#275c3b';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(px, py, cellSize, cellSize);
          }
        }
      }
    }

    // Monuments
    const drawnMonuments = new Set<number>();
    for (const cell of cellsMapRef.current.values()) {
      if (cell.is_monument && cell.monument_id && !drawnMonuments.has(cell.monument_id)) {
        drawnMonuments.add(cell.monument_id);
        let minX = cell.x, minY = cell.y, maxX = cell.x, maxY = cell.y;
        for (const c of cellsMapRef.current.values()) {
          if (c.monument_id === cell.monument_id) {
            minX = Math.min(minX, c.x);
            minY = Math.min(minY, c.y);
            maxX = Math.max(maxX, c.x);
            maxY = Math.max(maxY, c.y);
          }
        }

        const mpx = minX * cellSize;
        const mpy = minY * cellSize;
        const mw = (maxX - minX + 1) * cellSize;
        const mh = (maxY - minY + 1) * cellSize;

        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(mpx + 1, mpy + 1, mw - 2, mh - 2);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(mpx + mw / 2 - 8, mpy + mh / 2 - 8, 16, 16);
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🏛️', mpx + mw / 2, mpy + mh / 2);
      }
    }

    // Selected Cell Reticle
    if (selectedCell) {
      const spx = selectedCell.x * cellSize;
      const spy = selectedCell.y * cellSize;
      if (!selectedCell.is_land) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.strokeRect(spx - 1, spy - 1, cellSize + 2, cellSize + 2);
      } else {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(spx - 1, spy - 1, cellSize + 2, cellSize + 2);
      }
    }

    ctx.restore();
  }, [selectedCell]);

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const dpr = window.devicePixelRatio || 1;
      const width = container.clientWidth;
      const height = container.clientHeight || 450;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      if (transformRef.current.scale === 1 && transformRef.current.offsetX === 0) {
        const fitScale = width / (MAP_COLS * BASE_CELL_SIZE);
        transformRef.current.scale = Math.max(fitScale, 0.8);
        transformRef.current.offsetX = (width - (MAP_COLS * BASE_CELL_SIZE * transformRef.current.scale)) / 2;
        transformRef.current.offsetY = (height - (MAP_ROWS * BASE_CELL_SIZE * transformRef.current.scale)) / 2;
      }

      renderCanvas();
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [renderCanvas]);

  const handleCanvasClick = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const xRel = clientX - rect.left;
    const yRel = clientY - rect.top;

    const { scale, offsetX, offsetY } = transformRef.current;
    const virtualX = (xRel - offsetX) / scale;
    const virtualY = (yRel - offsetY) / scale;

    const cellX = Math.floor(virtualX / BASE_CELL_SIZE);
    const cellY = Math.floor(virtualY / BASE_CELL_SIZE);

    if (cellX >= 0 && cellX < MAP_COLS && cellY >= 0 && cellY < MAP_ROWS) {
      haptics.selection();
      sound.playUiTap();

      const key = `${cellX},${cellY}`;
      const rawCell = cellsMapRef.current.get(key);
      const isLand = (rawCell?.is_land !== undefined) ? (rawCell.is_land === 1) : (landmaskData.grid?.[cellY]?.[cellX] === 1);

      const cell: MapCell = {
        x: cellX,
        y: cellY,
        group_id: rawCell?.group_id ?? null,
        level: rawCell?.level ?? 0,
        is_monument: rawCell?.is_monument ?? 0,
        monument_id: rawCell?.monument_id ?? null,
        captured_at: rawCell?.captured_at ?? null,
        shield_until: rawCell?.shield_until ?? null,
        updated_at: rawCell?.updated_at ?? new Date().toISOString(),
        group_name: rawCell?.group_name ?? null,
        group_color: rawCell?.group_color ?? null,
        group_photo: rawCell?.group_photo ?? null,
        is_land: isLand ? 1 : 0,
        region_name: null,
      };

      setSelectedCell(cell);

      if (selectedAction) {
        if (!isLand) {
          setActionNotice('Океан нейтрален и не подлежит захвату. Выберите территорию на суше!');
          setTimeout(() => setActionNotice(null), 3500);
        } else {
          executeAction(selectedAction, cellX, cellY);
        }
      }
    }
  };

  const handleZoom = (delta: number) => {
    sound.playUiTap();
    haptics.selection();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const currentScale = transformRef.current.scale;
    const newScale = Math.min(8, Math.max(0.8, currentScale + delta));

    const cx = canvas.width / (2 * (window.devicePixelRatio || 1));
    const cy = canvas.height / (2 * (window.devicePixelRatio || 1));

    transformRef.current.offsetX = cx - ((cx - transformRef.current.offsetX) * (newScale / currentScale));
    transformRef.current.offsetY = cy - ((cy - transformRef.current.offsetY) * (newScale / currentScale));
    transformRef.current.scale = newScale;

    renderCanvas();
  };

  const executeAction = async (action: string, x: number, y: number) => {
    setActionLoading(true);
    setActionError(null);
    try {
      const isEmergency = action === 'emergency';
      const actualAction = isEmergency ? 'capture' : action;

      const res = await fetch('/api/world-map/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `tma ${user.id}`,
          'x-mock-user-id': String(user.id),
        },
        body: JSON.stringify({
          action: actualAction,
          x,
          y,
          size: actualAction === 'monument' ? 3 : undefined,
          isEmergency,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        sound.playRecord();
        haptics.success();
        updateCellsInMap(data.updatedCells || []);
        fetchMyGroup();
        setSelectedAction(null);
        setActionNotice('Приказ успешно выполнен!');
        setTimeout(() => setActionNotice(null), 3000);
      } else {
        haptics.error();
        setActionError(data.error || 'Не удалось выполнить действие');
      }
    } catch {
      haptics.error();
      setActionError('Ошибка соединения с сервером');
    } finally {
      setActionLoading(false);
    }
  };

  const handleJoinGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    setJoinLoading(true);
    setJoinError(null);
    sound.playUiTap();

    try {
      const res = await joinGroup(chatInput.trim());
      if (res.success) {
        sound.playRecord();
        haptics.success();
        setIsJoinModalOpen(false);
        setChatInput('');
        fetchLeaderboardData();
      } else {
        haptics.error();
        setJoinError(res.error || 'Ошибка при вступлении в группу');
      }
    } catch {
      setJoinError('Ошибка соединения с сервером');
    } finally {
      setJoinLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full pb-20 select-none animate-fade-in text-tg-text">
      {/* Top Navigation Switcher */}
      <div className="sticky top-0 z-20 bg-tg-bg/95 backdrop-blur-md px-4 py-2 border-b border-[var(--tg-theme-section-separator-color)]">
        <div className="flex p-1 rounded-2xl bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)]">
          <button
            onClick={() => {
              sound.playUiTap();
              haptics.selection();
              setActiveSubTab('map');
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeSubTab === 'map'
                ? 'bg-[var(--tg-theme-button-color)] text-white shadow-md'
                : 'text-tg-hint hover:text-tg-text'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            Карта мира
          </button>
          <button
            onClick={() => {
              sound.playUiTap();
              haptics.selection();
              setActiveSubTab('leaderboard');
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeSubTab === 'leaderboard'
                ? 'bg-[var(--tg-theme-button-color)] text-white shadow-md'
                : 'text-tg-hint hover:text-tg-text'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            Рейтинг групп
          </button>
        </div>
      </div>

      {/* SUB-SCREEN 1: WORLD MAP */}
      {activeSubTab === 'map' && (
        <div className="flex-1 flex flex-col relative">
          {actionNotice && (
            <div className="absolute top-3 left-4 right-4 z-30 p-3 rounded-2xl bg-emerald-500/90 text-white text-xs font-bold text-center shadow-lg animate-pop">
              {actionNotice}
            </div>
          )}

          {selectedAction && (
            <div className="bg-amber-500/20 border-b border-amber-400/30 p-2.5 px-4 flex items-center justify-between text-xs font-bold text-amber-400 animate-pulse">
              <div className="flex items-center gap-2">
                <Crosshair className="w-4 h-4 animate-spin" />
                <span>
                  {selectedAction === 'capture' && 'Выберите клетку для захвата (1 токен)'}
                  {selectedAction === 'fortify' && 'Выберите свою клетку для укрепления (2 токена)'}
                  {selectedAction === 'sabotage' && 'Выберите клетку врага для диверсии (1 токен)'}
                  {selectedAction === 'monument' && 'Выберите угол 3x3 для Монумента (5 токенов)'}
                  {selectedAction === 'emergency' && 'Экстренный захват: выберите клетку (3000 🪙)'}
                </span>
              </div>
              <button
                onClick={() => setSelectedAction(null)}
                className="px-2 py-1 rounded-lg bg-black/40 text-white text-[10px] cursor-pointer"
              >
                Отмена
              </button>
            </div>
          )}

          <div
            ref={containerRef}
            className="w-full h-[54dvh] min-h-[380px] bg-slate-950 relative overflow-hidden touch-none"
            onMouseDown={(e) => {
              gestureRef.current.isDragging = true;
              gestureRef.current.startX = e.clientX;
              gestureRef.current.startY = e.clientY;
              gestureRef.current.startOffsetX = transformRef.current.offsetX;
              gestureRef.current.startOffsetY = transformRef.current.offsetY;
              gestureRef.current.hasMoved = false;
            }}
            onMouseMove={(e) => {
              if (!gestureRef.current.isDragging) return;
              const dx = e.clientX - gestureRef.current.startX;
              const dy = e.clientY - gestureRef.current.startY;
              if (Math.hypot(dx, dy) > 4) gestureRef.current.hasMoved = true;
              transformRef.current.offsetX = gestureRef.current.startOffsetX + dx;
              transformRef.current.offsetY = gestureRef.current.startOffsetY + dy;
              renderCanvas();
            }}
            onMouseUp={(e) => {
              if (gestureRef.current.isDragging && !gestureRef.current.hasMoved) {
                handleCanvasClick(e.clientX, e.clientY);
              }
              gestureRef.current.isDragging = false;
            }}
            onTouchStart={(e) => {
              if (e.touches.length === 1) {
                gestureRef.current.isDragging = true;
                gestureRef.current.startX = e.touches[0].clientX;
                gestureRef.current.startY = e.touches[0].clientY;
                gestureRef.current.startOffsetX = transformRef.current.offsetX;
                gestureRef.current.startOffsetY = transformRef.current.offsetY;
                gestureRef.current.hasMoved = false;
              } else if (e.touches.length === 2) {
                gestureRef.current.isDragging = false;
                const dist = Math.hypot(
                  e.touches[0].clientX - e.touches[1].clientX,
                  e.touches[0].clientY - e.touches[1].clientY
                );
                gestureRef.current.initialDistance = dist;
                gestureRef.current.initialScale = transformRef.current.scale;
              }
            }}
            onTouchMove={(e) => {
              if (e.touches.length === 1 && gestureRef.current.isDragging) {
                const dx = e.touches[0].clientX - gestureRef.current.startX;
                const dy = e.touches[0].clientY - gestureRef.current.startY;
                if (Math.hypot(dx, dy) > 4) gestureRef.current.hasMoved = true;
                transformRef.current.offsetX = gestureRef.current.startOffsetX + dx;
                transformRef.current.offsetY = gestureRef.current.startOffsetY + dy;
                renderCanvas();
              } else if (e.touches.length === 2 && gestureRef.current.initialDistance > 0) {
                const dist = Math.hypot(
                  e.touches[0].clientX - e.touches[1].clientX,
                  e.touches[0].clientY - e.touches[1].clientY
                );
                const ratio = dist / gestureRef.current.initialDistance;
                const newScale = Math.min(8, Math.max(0.8, gestureRef.current.initialScale * ratio));
                transformRef.current.scale = newScale;
                renderCanvas();
              }
            }}
            onTouchEnd={(e) => {
              if (gestureRef.current.isDragging && !gestureRef.current.hasMoved && e.changedTouches.length > 0) {
                handleCanvasClick(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
              }
              gestureRef.current.isDragging = false;
            }}
          >
            <canvas ref={canvasRef} className="block w-full h-full" />

            {isLoadingMap && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-20">
                <Loader2 className="w-7 h-7 text-indigo-400 animate-spin" />
                <span className="text-xs font-medium text-white/80">Загрузка карты мира...</span>
              </div>
            )}

            <div className="absolute right-3 top-3 flex flex-col gap-2 z-10">
              <button
                onClick={() => handleZoom(0.6)}
                className="w-10 h-10 rounded-2xl bg-black/70 backdrop-blur-md border border-white/10 text-white flex items-center justify-center shadow-lg active:scale-95 cursor-pointer"
                title="Приблизить"
              >
                <Plus className="w-5 h-5" />
              </button>
              <button
                onClick={() => handleZoom(-0.6)}
                className="w-10 h-10 rounded-2xl bg-black/70 backdrop-blur-md border border-white/10 text-white flex items-center justify-center shadow-lg active:scale-95 cursor-pointer"
                title="Отдалить"
              >
                <Minus className="w-5 h-5" />
              </button>
              <button
                onClick={handleResetView}
                className="w-10 h-10 rounded-2xl bg-black/70 backdrop-blur-md border border-white/10 text-white flex items-center justify-center shadow-lg active:scale-95 cursor-pointer"
                title="Вся карта"
              >
                <Globe className="w-5 h-5" />
              </button>
              <button
                onClick={handleFindMyGroup}
                className="w-10 h-10 rounded-2xl bg-indigo-600/90 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 active:scale-95 cursor-pointer"
                title="Найти мою группу"
              >
                <Compass className="w-5 h-5" />
              </button>
            </div>

            <div className="absolute left-3 bottom-3 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-[10px] text-white/80 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              <span>Карта 80×60 • 4 800 клеток{cells.length > 0 ? ` • ${cells.filter(c => c.group_id).length} занято` : ''}</span>
            </div>
          </div>

          <div className="p-4 space-y-3">
            {selectedCell ? (
              selectedCell.is_land === 0 ? (
                /* Water Cell Card */
                <div className="p-3.5 rounded-2xl bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] shadow-sm animate-pop">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">🌊</span>
                      <div>
                        <h3 className="text-xs font-black text-tg-text">
                          Нейтральные воды
                        </h3>
                        <p className="text-[11px] text-sky-400 font-medium">
                          Клетка ({selectedCell.x}, {selectedCell.y})
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] px-2.5 py-1 rounded-xl bg-sky-500/15 text-sky-400 font-bold border border-sky-500/20">
                      Не захватывается
                    </span>
                  </div>
                </div>
              ) : (
                /* Land Cell Card: Only Group & Status */
                <div className="p-4 rounded-2xl bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] shadow-sm animate-pop space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    {/* Occupying Group Name instead of country */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-4 h-4 rounded-full shrink-0 shadow-sm border border-black/10 dark:border-white/20"
                        style={{ backgroundColor: selectedCell.group_color || '#154228' }}
                      />
                      <div className="min-w-0">
                        <h3 className="text-sm font-black text-tg-text truncate">
                          {selectedCell.group_name ? `Клан «${selectedCell.group_name}»` : 'Свободная клетка'}
                        </h3>
                        <p className="text-[11px] text-tg-hint">
                          Клетка ({selectedCell.x}, {selectedCell.y})
                        </p>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <span className="text-[11px] px-2.5 py-1 rounded-xl bg-black/5 dark:bg-white/10 font-bold shrink-0">
                      {selectedCell.is_monument ? (
                        <span className="text-amber-400">🏛️ Монумент</span>
                      ) : selectedCell.level >= 2 ? (
                        <span className="text-emerald-400">🛡️ Укреплена (Lvl 2)</span>
                      ) : selectedCell.level === 1 ? (
                        <span className="text-indigo-400">🚩 Захвачена (Lvl 1)</span>
                      ) : (
                        <span className="text-emerald-500">🟢 Свободна</span>
                      )}
                    </span>
                  </div>

                  {selectedCell.shield_until && new Date(selectedCell.shield_until).getTime() > Date.now() && (
                    <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-xs text-sky-400 font-bold flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5" />
                      <span>Защищена щитом Звёзд</span>
                    </div>
                  )}

                  {actionError && (
                    <p className="text-xs text-rose-500 font-bold">{actionError}</p>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {myGroup?.isCommander && (
                      <>
                        {(!selectedCell.group_id || selectedCell.group_id !== myGroup.group?.id) && (
                          <button
                            disabled={actionLoading}
                            onClick={() => executeAction('capture', selectedCell.x, selectedCell.y)}
                            className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer disabled:opacity-50 shadow-md shadow-indigo-600/20"
                          >
                            <Flag className="w-3.5 h-3.5" />
                            <span>Захват (1 🪙)</span>
                          </button>
                        )}
                        {selectedCell.group_id === myGroup.group?.id && selectedCell.level === 1 && (
                          <button
                            disabled={actionLoading}
                            onClick={() => executeAction('fortify', selectedCell.x, selectedCell.y)}
                            className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer disabled:opacity-50 shadow-md shadow-emerald-600/20"
                          >
                            <Shield className="w-3.5 h-3.5" />
                            <span>Укрепить (2 🪙)</span>
                          </button>
                        )}
                        {selectedCell.group_id && selectedCell.group_id !== myGroup.group?.id && selectedCell.level >= 2 && (
                          <button
                            disabled={actionLoading}
                            onClick={() => executeAction('sabotage', selectedCell.x, selectedCell.y)}
                            className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer disabled:opacity-50 shadow-md shadow-rose-600/20"
                          >
                            <Bomb className="w-3.5 h-3.5" />
                            <span>Диверсия (1 🪙)</span>
                          </button>
                        )}
                      </>
                    )}

                    {myGroup?.group && (!selectedCell.group_id || selectedCell.group_id !== myGroup.group.id) && (
                      <button
                        disabled={actionLoading || coins < 3000}
                        onClick={() => executeAction('emergency', selectedCell.x, selectedCell.y)}
                        className="py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white font-black text-xs flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer disabled:opacity-40 shadow-md shadow-amber-500/20"
                      >
                        <Coins className="w-3.5 h-3.5" />
                        <span>Экстренный захват (3 000 🪙)</span>
                      </button>
                    )}
                  </div>
                </div>
              )
            ) : (
              <div className="p-3.5 rounded-2xl bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] flex items-center gap-3 text-xs text-tg-hint">
                <Crosshair className="w-5 h-5 text-indigo-400 shrink-0" />
                <span>Нажмите на клетку карты, чтобы увидеть статус и клан-владелец</span>
              </div>
            )}

            {myGroup?.isCommander && (
              <div className="p-4 rounded-3xl bg-gradient-to-br from-indigo-950/40 via-purple-950/20 to-transparent border border-indigo-500/30 shadow-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Crown className="w-5 h-5 text-amber-400" />
                    <div>
                      <h4 className="text-xs font-black text-tg-text">Панель Командора</h4>
                      <p className="text-[10px] text-tg-hint">Группа «{myGroup.group?.name}»</p>
                    </div>
                  </div>
                  <div className="px-3 py-1 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-400 font-black text-xs">
                    {myGroup.group?.treasuryTokens || 0} 🪙 токенов
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      sound.playUiTap();
                      haptics.selection();
                      setSelectedAction('capture');
                    }}
                    className={`p-2.5 rounded-2xl border text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      selectedAction === 'capture'
                        ? 'bg-indigo-600 border-indigo-400 text-white'
                        : 'bg-tg-secondaryBg border-[var(--tg-theme-section-separator-color)] hover:border-indigo-400 text-tg-text'
                    }`}
                  >
                    <Flag className="w-4 h-4 text-indigo-400" />
                    Захват (1 🪙)
                  </button>

                  <button
                    onClick={() => {
                      sound.playUiTap();
                      haptics.selection();
                      setSelectedAction('fortify');
                    }}
                    className={`p-2.5 rounded-2xl border text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      selectedAction === 'fortify'
                        ? 'bg-emerald-600 border-emerald-400 text-white'
                        : 'bg-tg-secondaryBg border-[var(--tg-theme-section-separator-color)] hover:border-emerald-400 text-tg-text'
                    }`}
                  >
                    <Shield className="w-4 h-4 text-emerald-400" />
                    Укрепление (2 🪙)
                  </button>

                  <button
                    onClick={() => {
                      sound.playUiTap();
                      haptics.selection();
                      setSelectedAction('sabotage');
                    }}
                    className={`p-2.5 rounded-2xl border text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      selectedAction === 'sabotage'
                        ? 'bg-rose-600 border-rose-400 text-white'
                        : 'bg-tg-secondaryBg border-[var(--tg-theme-section-separator-color)] hover:border-rose-400 text-tg-text'
                    }`}
                  >
                    <Bomb className="w-4 h-4 text-rose-400" />
                    Диверсия (1 🪙)
                  </button>

                  <button
                    onClick={() => {
                      sound.playUiTap();
                      haptics.selection();
                      setSelectedAction('monument');
                    }}
                    className={`p-2.5 rounded-2xl border text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      selectedAction === 'monument'
                        ? 'bg-amber-600 border-amber-400 text-white'
                        : 'bg-tg-secondaryBg border-[var(--tg-theme-section-separator-color)] hover:border-amber-400 text-tg-text'
                    }`}
                  >
                    <Layers className="w-4 h-4 text-amber-400" />
                    Монумент 3×3 (5 🪙)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-SCREEN 2: GROUP LEADERBOARD */}
      {activeSubTab === 'leaderboard' && (
        <div className="p-4 space-y-4">
          <div className="p-4 rounded-3xl bg-gradient-to-r from-indigo-900/40 via-purple-900/30 to-slate-900/50 border border-indigo-500/30 shadow-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-400">
                <Clock className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <span className="text-[10px] text-tg-hint uppercase font-extrabold tracking-wider">
                  Цикл #{cycleNumber} (72 часа)
                </span>
                <p className="text-lg font-black text-indigo-400">
                  {formatCountdown(remainingSeconds)}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                sound.playUiTap();
                fetchLeaderboardData();
              }}
              className="p-2 rounded-xl bg-black/20 hover:bg-black/40 text-tg-hint active:scale-95 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingLeaderboard ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="p-3.5 rounded-2xl bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] text-[11px] text-tg-hint">
            <div className="flex items-center gap-1.5 font-black text-tg-text mb-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Награды в казну группы по итогам 72ч:</span>
            </div>
            <div className="flex items-center justify-between text-center font-bold">
              <div><span className="text-amber-400 font-black">#1</span>: 12 🪙</div>
              <div><span className="text-slate-300 font-black">#2</span>: 8 🪙</div>
              <div><span className="text-amber-600 font-black">#3</span>: 5 🪙</div>
              <div><span className="text-tg-text font-black">4–10</span>: 2 🪙</div>
              <div><span className="text-tg-hint font-black">11–50</span>: 1 🪙</div>
            </div>
          </div>

          {myGroup?.group ? (
            <div className="p-4 rounded-3xl bg-tg-secondaryBg border-2 border-indigo-500/40 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-white text-base shadow-sm"
                    style={{ backgroundColor: myGroup.group.color }}
                  >
                    {myGroup.group.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-tg-text flex items-center gap-1.5">
                      {myGroup.group.name}
                      {myGroup.isCommander && <Crown className="w-3.5 h-3.5 text-amber-400" />}
                    </h3>
                    <p className="text-[11px] text-tg-hint">
                      {myGroup.group.username ? `@${myGroup.group.username}` : `${myGroup.group.memberCount} участников`}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    sound.playUiTap();
                    haptics.selection();
                    setIsJoinModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-black/10 dark:bg-white/10 text-xs font-bold text-tg-text hover:bg-black/20 active:scale-95 cursor-pointer"
                >
                  Сменить
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--tg-theme-section-separator-color)] text-xs">
                <div>
                  <span className="text-[10px] text-tg-hint font-medium">Ваш вклад в цикл:</span>
                  <p className="text-sm font-black text-indigo-400">+{myGroup.userCycleScore.toLocaleString()} pts</p>
                </div>
                <div>
                  <span className="text-[10px] text-tg-hint font-medium">Казна группы:</span>
                  <p className="text-sm font-black text-amber-400">{myGroup.group.treasuryTokens} 🪙 токенов</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-5 rounded-3xl bg-gradient-to-br from-indigo-600/20 via-purple-600/10 to-transparent border border-indigo-500/30 text-center space-y-3">
              <Users className="w-10 h-10 mx-auto text-indigo-400" />
              <div>
                <h3 className="text-sm font-black text-tg-text">Вы пока не состоите в группе</h3>
                <p className="text-xs text-tg-hint mt-1">
                  Привяжите свой Telegram-чат, суммируйте очки с друзьями и боритесь за господство на Карте Мира!
                </p>
              </div>
              <button
                onClick={() => {
                  sound.playUiTap();
                  haptics.selection();
                  setIsJoinModalOpen(true);
                }}
                className="w-full py-3 px-4 rounded-xl tg-btn-primary font-bold text-xs shadow-md cursor-pointer"
              >
                Привязать Telegram-группу
              </button>
            </div>
          )}

          <div className="space-y-2">
            <h4 className="text-xs font-black text-tg-hint uppercase tracking-wider px-1">
              Рейтинг групп текущего цикла
            </h4>

            {leaderboard.length === 0 ? (
              <div className="p-6 text-center text-xs text-tg-hint rounded-2xl bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)]">
                Пока нет данных рейтинга в этом цикле. Играйте в игры, чтобы вывести группу на первое место!
              </div>
            ) : (
              leaderboard.map((item) => {
                const isMyGroup = myGroup?.group?.id === item.id;
                return (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all ${
                      isMyGroup
                        ? 'bg-indigo-500/15 border-indigo-400/50 shadow-sm'
                        : 'bg-tg-secondaryBg border-[var(--tg-theme-section-separator-color)]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-7 text-center font-black text-sm">
                        {item.rank === 1 && '🥇'}
                        {item.rank === 2 && '🥈'}
                        {item.rank === 3 && '🥉'}
                        {item.rank && item.rank > 3 && `#${item.rank}`}
                        {!item.rank && '—'}
                      </div>

                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-white text-xs shrink-0 shadow-sm"
                        style={{ backgroundColor: item.color }}
                      >
                        {item.name.slice(0, 2).toUpperCase()}
                      </div>

                      <div className="min-w-0">
                        <h4 className="text-xs font-black text-tg-text truncate flex items-center gap-1.5">
                          {item.name}
                          {isMyGroup && <span className="text-[10px] text-indigo-400 font-bold">(Вы)</span>}
                        </h4>
                        <p className="text-[10px] text-tg-hint truncate">
                          {item.memberCount} уч. • Командор: {item.commanderName || 'Не назначен'}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-xs font-black text-indigo-400">
                        {item.cycleScore.toLocaleString()} pts
                      </p>
                      {!item.isEligible && (
                        <span className="text-[9px] text-amber-500 font-bold">
                          Нужно 3+ игрока
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* MODAL: Join / Create Group */}
      {isJoinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-sm rounded-3xl bg-white dark:bg-tg-secondaryBg border border-[var(--tg-theme-section-separator-color)] p-5 shadow-2xl text-tg-text">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-extrabold text-tg-text">Привязать группу</h3>
              <button
                onClick={() => setIsJoinModalOpen(false)}
                className="p-1 text-tg-hint hover:text-tg-text cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-tg-hint mb-4">
              Введите <strong>@username</strong> публичного Telegram-чата или вставьте ссылку на канал/группу:
            </p>

            <form onSubmit={handleJoinGroupSubmit} className="space-y-3">
              <div>
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="@my_telegram_chat"
                  className="w-full px-4 py-3 rounded-xl bg-black/[0.04] dark:bg-tg-bg border border-[var(--tg-theme-section-separator-color)] text-sm font-medium focus:outline-none focus:border-indigo-500"
                />
              </div>

              {joinError && (
                <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-400/30 text-rose-500 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{joinError}</span>
                </div>
              )}

              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-400/20 text-[11px] text-amber-500 space-y-1">
                <p className="font-bold">⚠️ Правила групп:</p>
                <p>• Сменить группу можно не чаще 1 раза в 7 дней.</p>
                <p>• Для участия в рейтинге требуется от 3 участников.</p>
              </div>

              <button
                type="submit"
                disabled={joinLoading || !chatInput.trim()}
                className="w-full py-3 px-4 rounded-xl tg-btn-primary font-bold text-xs shadow-md disabled:opacity-50 cursor-pointer"
              >
                {joinLoading ? 'Проверка чата...' : 'Подтвердить вступление'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
