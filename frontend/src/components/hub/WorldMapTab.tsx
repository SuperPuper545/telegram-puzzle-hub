import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useGameBridge } from '../../context/GameContext';
import { 
  Globe, Trophy, Shield, Crosshair, Compass, Plus, Minus,
  Flag, Bomb, Crown, Coins, Users, UserPlus, Copy, Check,
  Clock, Sparkles, RefreshCw, X, AlertTriangle, Layers, Loader2, Edit2, LogOut
} from 'lucide-react';
import { haptics, createClanInviteShareUrl, getTelegramWebApp } from '../../telegram/telegram';
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
  const { user, coins, myGroup, fetchMyGroup, createCustomClan, checkClanRename, createRenameInvoice, kickGroupMember, leaveClan, referralsData } = useGameBridge();

  const [activeSubTab, setActiveSubTab] = useState<'map' | 'leaderboard'>('map');
  const [inviteCopied, setInviteCopied] = useState(false);

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

  // Clan Members Modal
  const [isMembersModalOpen, setIsMembersModalOpen] = useState<boolean>(false);
  const [memberActionLoading, setMemberActionLoading] = useState<number | 'leave' | null>(null);
  const [memberActionError, setMemberActionError] = useState<string | null>(null);

  // Clan Creation & Rename State
  const [isCreatingClan, setIsCreatingClan] = useState<boolean>(false);
  const [createClanError, setCreateClanError] = useState<string | null>(null);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState<boolean>(false);
  const [renameInput, setRenameInput] = useState<string>('');
  const [renameLoading, setRenameLoading] = useState<boolean>(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  // Leaderboard state
  const [leaderboard, setLeaderboard] = useState<GroupLeaderboardItem[]>([]);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [cycleNumber, setCycleNumber] = useState<number>(1);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState<boolean>(false);

  // Heraldic badge helper
  const getClanBadgeIcon = (badge: string | null | undefined, name: string) => {
    const badgeMap: Record<string, string> = {
      badge_lion: '🦁',
      badge_wolf: '🐺',
      badge_eagle: '🦅',
      badge_dragon: '🐉',
      badge_crown: '👑',
      badge_sword: '⚔️',
      badge_shield: '🛡️',
      badge_falcon: '🦅',
      badge_bear: '🐻',
      badge_fire: '🔥',
      badge_lightning: '⚡',
      badge_star: '⭐',
    };
    if (badge && badgeMap[badge]) {
      return badgeMap[badge];
    }
    return name ? name.slice(0, 2).toUpperCase() : '🏰';
  };

  // Clan Invite actions (unified with referral link)
  const handleShareClanInvite = () => {
    sound.playUiTap();
    haptics.medium();
    if (!myGroup?.group) return;

    const botUsername = referralsData?.botUsername || 'taptaphub_bot';
    const { shareUrl } = createClanInviteShareUrl(botUsername, myGroup.group.id, myGroup.group.name, user.id);

    const tg = getTelegramWebApp();
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, '_blank');
    }
  };

  const handleCopyClanInvite = async () => {
    sound.playUiTap();
    haptics.selection();
    if (!myGroup?.group) return;

    const botUsername = referralsData?.botUsername || 'taptaphub_bot';
    const { inviteLink } = createClanInviteShareUrl(botUsername, myGroup.group.id, myGroup.group.name, user.id);

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
      setInviteCopied(true);
      setActionNotice('Ссылка-приглашение в клан скопирована!');
      setTimeout(() => {
        setInviteCopied(false);
        setActionNotice(null);
      }, 2500);
    } catch {
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    }
  };

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

  // Fit scale calculation for 80x60 grid
  const getFitScale = useCallback((viewWidth: number, viewHeight: number) => {
    const scaleX = viewWidth / (MAP_COLS * BASE_CELL_SIZE);
    const scaleY = viewHeight / (MAP_ROWS * BASE_CELL_SIZE);
    return Math.min(scaleX, scaleY);
  }, []);

  // Clamps scale & offset strictly inside map bounds (no endless drifting into void)
  const clampTransform = useCallback((
    scale: number,
    offsetX: number,
    offsetY: number,
    viewWidth: number,
    viewHeight: number
  ) => {
    const fitScale = getFitScale(viewWidth, viewHeight);
    const minScale = Math.max(0.2, fitScale * 0.92);
    const maxScale = 4.0;
    const clampedScale = Math.min(maxScale, Math.max(minScale, scale));

    const mapWidth = MAP_COLS * BASE_CELL_SIZE * clampedScale;
    const mapHeight = MAP_ROWS * BASE_CELL_SIZE * clampedScale;

    let clampedX = offsetX;
    let clampedY = offsetY;

    if (mapWidth <= viewWidth) {
      clampedX = (viewWidth - mapWidth) / 2;
    } else {
      const minX = viewWidth - mapWidth - 12;
      const maxX = 12;
      clampedX = Math.min(maxX, Math.max(minX, offsetX));
    }

    if (mapHeight <= viewHeight) {
      clampedY = (viewHeight - mapHeight) / 2;
    } else {
      const minY = viewHeight - mapHeight - 12;
      const maxY = 12;
      clampedY = Math.min(maxY, Math.max(minY, offsetY));
    }

    return { scale: clampedScale, offsetX: clampedX, offsetY: clampedY };
  }, [getFitScale]);

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

    const container = containerRef.current;
    if (!container) return;
    const viewWidth = container.clientWidth;
    const viewHeight = container.clientHeight;

    const fitScale = getFitScale(viewWidth, viewHeight);
    const targetScale = Math.max(1.8, fitScale * 2.5);
    const pixelX = avgX * BASE_CELL_SIZE * targetScale;
    const pixelY = avgY * BASE_CELL_SIZE * targetScale;

    transformRef.current = clampTransform(
      targetScale,
      viewWidth / 2 - pixelX,
      viewHeight / 2 - pixelY,
      viewWidth,
      viewHeight
    );

    renderCanvas();
  };

  const handleResetView = () => {
    sound.playUiTap();
    haptics.selection();
    const container = containerRef.current;
    if (!container) return;
    const viewWidth = container.clientWidth;
    const viewHeight = container.clientHeight;

    const fitScale = getFitScale(viewWidth, viewHeight);
    transformRef.current = clampTransform(
      fitScale,
      (viewWidth - MAP_COLS * BASE_CELL_SIZE * fitScale) / 2,
      (viewHeight - MAP_ROWS * BASE_CELL_SIZE * fitScale) / 2,
      viewWidth,
      viewHeight
    );
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

  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const fitScale = getFitScale(width, height);
    if (transformRef.current.scale === 1 && transformRef.current.offsetX === 0) {
      transformRef.current = clampTransform(
        fitScale,
        (width - MAP_COLS * BASE_CELL_SIZE * fitScale) / 2,
        (height - MAP_ROWS * BASE_CELL_SIZE * fitScale) / 2,
        width,
        height
      );
    } else {
      transformRef.current = clampTransform(
        transformRef.current.scale,
        transformRef.current.offsetX,
        transformRef.current.offsetY,
        width,
        height
      );
    }

    renderCanvas();
  }, [renderCanvas, getFitScale, clampTransform]);

  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  // Re-measure and redraw when returning to map tab
  useEffect(() => {
    if (activeSubTab === 'map') {
      const raf = requestAnimationFrame(() => {
        handleResize();
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [activeSubTab, handleResize]);

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
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    const fitScale = getFitScale(width, height);
    const minScale = Math.max(0.2, fitScale * 0.92);
    const maxScale = 4.0;

    const currentScale = transformRef.current.scale;
    const newScale = Math.min(maxScale, Math.max(minScale, currentScale + delta));

    const cx = width / 2;
    const cy = height / 2;

    const newOffsetX = cx - ((cx - transformRef.current.offsetX) * (newScale / currentScale));
    const newOffsetY = cy - ((cy - transformRef.current.offsetY) * (newScale / currentScale));

    transformRef.current = clampTransform(newScale, newOffsetX, newOffsetY, width, height);
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

  const handleKickMember = async (targetUserId: number, targetName: string) => {
    if (!window.confirm(`Вы уверены, что хотите исключить ${targetName} из клана?`)) return;
    setMemberActionLoading(targetUserId);
    setMemberActionError(null);
    sound.playUiTap();

    try {
      const res = await kickGroupMember(targetUserId);
      if (res.success) {
        sound.playUiTap();
        haptics.success();
        await fetchMyGroup();
      } else {
        haptics.error();
        setMemberActionError(res.error || 'Ошибка исключения участника');
      }
    } catch {
      haptics.error();
      setMemberActionError('Ошибка соединения с сервером');
    } finally {
      setMemberActionLoading(null);
    }
  };

  const handleLeaveClan = async () => {
    const isCommander = myGroup?.isCommander;
    const confirmMsg = isCommander 
      ? 'Вы Командор клана. Если вы покинете клан, лидерство перейдет следующему участнику (или клан распустится, если вы один). Покинуть клан?'
      : 'Вы уверены, что хотите покинуть этот клан?';
    if (!window.confirm(confirmMsg)) return;

    setMemberActionLoading('leave');
    setMemberActionError(null);
    sound.playUiTap();

    try {
      const res = await leaveClan();
      if (res.success) {
        sound.playRecord();
        haptics.success();
        setIsMembersModalOpen(false);
        await fetchMyGroup();
      } else {
        haptics.error();
        setMemberActionError(res.error || 'Ошибка выхода из клана');
      }
    } catch {
      haptics.error();
      setMemberActionError('Ошибка соединения с сервером');
    } finally {
      setMemberActionLoading(null);
    }
  };

  const handleCreateClanClick = async () => {
    sound.playUiTap();
    haptics.medium();
    setIsCreatingClan(true);
    setCreateClanError(null);
    try {
      const res = await createCustomClan();
      if (res.success) {
        sound.playRecord();
        haptics.success();
        await fetchLeaderboardData();
      } else {
        haptics.error();
        setCreateClanError(res.error || 'Не удалось создать клан');
      }
    } catch {
      setCreateClanError('Ошибка соединения с сервером');
    } finally {
      setIsCreatingClan(false);
    }
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    sound.playUiTap();
    haptics.medium();
    const trimmed = renameInput.trim();
    if (trimmed.length < 3) {
      setRenameError('Минимум 3 символа');
      return;
    }
    setRenameLoading(true);
    setRenameError(null);
    try {
      const checkRes = await checkClanRename(trimmed);
      if (!checkRes.valid) {
        setRenameError(checkRes.error || 'Недопустимое название');
        setRenameLoading(false);
        return;
      }

      const invRes = await createRenameInvoice(trimmed);
      if (!invRes.success || !invRes.invoiceLink) {
        setRenameError(invRes.error || 'Не удалось создать счет Stars');
        setRenameLoading(false);
        return;
      }

      const tg = getTelegramWebApp();
      if (tg?.openInvoice) {
        tg.openInvoice(invRes.invoiceLink, async (status: string) => {
          if (status === 'paid') {
            sound.playRecord();
            haptics.success();
            await fetchMyGroup();
            await fetchLeaderboardData();
            setIsRenameModalOpen(false);
          } else if (status === 'cancelled' || status === 'failed') {
            setRenameError('Оплата отменена');
          }
        });
      } else {
        // Fallback / simulation outside Telegram Mini App
        const res = await fetch('/api/stars/webhook', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-mock-user-id': String(user.id),
          },
          body: JSON.stringify({
            productId: 'clan_rename',
            extra: { newName: trimmed },
          }),
        });
        const data = await res.json();
        if (data.success) {
          sound.playRecord();
          haptics.success();
          await fetchMyGroup();
          await fetchLeaderboardData();
          setIsRenameModalOpen(false);
        } else {
          setRenameError(data.error || 'Ошибка смены названия');
        }
      }
    } catch {
      setRenameError('Ошибка соединения с сервером');
    } finally {
      setRenameLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full select-none animate-fade-in text-tg-text overflow-hidden relative">
      {/* Top Navigation Switcher */}
      <div className="shrink-0 z-30 bg-tg-bg/95 backdrop-blur-md px-4 py-2 border-b border-[var(--tg-theme-section-separator-color)]">
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
      <div className={activeSubTab === 'map' ? 'flex-1 flex flex-col relative w-full h-full overflow-hidden' : 'hidden'}>
        {actionNotice && (
          <div
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            className="absolute top-3 left-4 right-4 z-40 p-2.5 rounded-2xl bg-emerald-600 text-white text-xs font-bold text-center shadow-2xl border border-emerald-400/40 animate-pop"
          >
            {actionNotice}
          </div>
        )}

        {selectedAction && (
          <div
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            className="absolute top-3 left-4 right-4 z-40 bg-amber-600 text-white p-2.5 px-4 rounded-2xl flex items-center justify-between text-xs font-bold shadow-2xl border border-amber-400/40 animate-pulse"
          >
            <div className="flex items-center gap-2 truncate">
              <Crosshair className="w-4 h-4 animate-spin shrink-0" />
              <span className="truncate">
                {selectedAction === 'capture' && 'Выберите клетку для захвата (1 🏛️ токен)'}
                {selectedAction === 'fortify' && 'Выберите свою клетку для укрепления (2 🏛️ токена)'}
                {selectedAction === 'sabotage' && 'Выберите клетку врага для диверсии (1 🏛️ токен)'}
                {selectedAction === 'monument' && 'Выберите угол 3x3 для Монумента (5 🏛️ токенов)'}
                {selectedAction === 'emergency' && 'Экстренный захват: выберите клетку (3 000 🪙 монет)'}
              </span>
            </div>
            <button
              onClick={() => setSelectedAction(null)}
              className="px-2.5 py-1 rounded-lg bg-black/60 hover:bg-black/80 text-white text-[10px] shrink-0 active:scale-95 cursor-pointer font-bold"
            >
              Отмена
            </button>
          </div>
        )}

          <div
            ref={containerRef}
            className="w-full h-full flex-1 bg-slate-950 relative overflow-hidden touch-none"
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
              const container = containerRef.current;
              if (!container) return;
              const dx = e.clientX - gestureRef.current.startX;
              const dy = e.clientY - gestureRef.current.startY;
              if (Math.hypot(dx, dy) > 4) gestureRef.current.hasMoved = true;
              const clamped = clampTransform(
                transformRef.current.scale,
                gestureRef.current.startOffsetX + dx,
                gestureRef.current.startOffsetY + dy,
                container.clientWidth,
                container.clientHeight
              );
              transformRef.current.offsetX = clamped.offsetX;
              transformRef.current.offsetY = clamped.offsetY;
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
                gestureRef.current.startOffsetX = transformRef.current.offsetX;
                gestureRef.current.startOffsetY = transformRef.current.offsetY;
              }
            }}
            onTouchMove={(e) => {
              const container = containerRef.current;
              if (!container) return;
              const viewWidth = container.clientWidth;
              const viewHeight = container.clientHeight;

              if (e.touches.length === 1 && gestureRef.current.isDragging) {
                const dx = e.touches[0].clientX - gestureRef.current.startX;
                const dy = e.touches[0].clientY - gestureRef.current.startY;
                if (Math.hypot(dx, dy) > 4) gestureRef.current.hasMoved = true;
                const clamped = clampTransform(
                  transformRef.current.scale,
                  gestureRef.current.startOffsetX + dx,
                  gestureRef.current.startOffsetY + dy,
                  viewWidth,
                  viewHeight
                );
                transformRef.current.offsetX = clamped.offsetX;
                transformRef.current.offsetY = clamped.offsetY;
                renderCanvas();
              } else if (e.touches.length === 2 && gestureRef.current.initialDistance > 0) {
                const dist = Math.hypot(
                  e.touches[0].clientX - e.touches[1].clientX,
                  e.touches[0].clientY - e.touches[1].clientY
                );
                const ratio = dist / gestureRef.current.initialDistance;
                const fitScale = getFitScale(viewWidth, viewHeight);
                const minScale = Math.max(0.2, fitScale * 0.92);
                const maxScale = 4.0;
                const newScale = Math.min(maxScale, Math.max(minScale, gestureRef.current.initialScale * ratio));

                const rect = container.getBoundingClientRect();
                const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
                const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;

                const newOffsetX = midX - ((midX - gestureRef.current.startOffsetX) * (newScale / gestureRef.current.initialScale));
                const newOffsetY = midY - ((midY - gestureRef.current.startOffsetY) * (newScale / gestureRef.current.initialScale));

                transformRef.current = clampTransform(newScale, newOffsetX, newOffsetY, viewWidth, viewHeight);
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

            {/* Top-Left Floating Info Pill */}
            <div
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
              className="absolute left-3 top-3 px-2.5 py-1 rounded-xl bg-slate-900/95 border border-slate-700/80 text-[10px] text-white/90 flex items-center gap-2 shadow-lg pointer-events-none z-10"
            >
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Карта 80×60 • 4 800 кл.{cells.length > 0 ? ` • ${cells.filter(c => c.group_id).length} занято` : ''}</span>
            </div>

            {/* Top-Right Floating Camera Controls */}
            <div
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
              className="absolute right-3 top-3 flex flex-col gap-2 z-10"
            >
              <button
                onClick={() => handleZoom(0.5)}
                className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700 text-white flex items-center justify-center shadow-xl active:scale-95 cursor-pointer hover:bg-slate-800"
                title="Приблизить"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleZoom(-0.5)}
                className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700 text-white flex items-center justify-center shadow-xl active:scale-95 cursor-pointer hover:bg-slate-800"
                title="Отдалить"
              >
                <Minus className="w-4 h-4" />
              </button>
              <button
                onClick={handleResetView}
                className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700 text-white flex items-center justify-center shadow-xl active:scale-95 cursor-pointer hover:bg-slate-800"
                title="Вся карта целиком"
              >
                <Globe className="w-4 h-4" />
              </button>
              <button
                onClick={handleFindMyGroup}
                className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xl shadow-indigo-600/30 active:scale-95 cursor-pointer hover:bg-indigo-500 border border-indigo-400/50"
                title="Найти мой клан"
              >
                <Compass className="w-4 h-4" />
              </button>
            </div>

            {/* FLOATING BOTTOM OVERLAY: SELECTED CELL CARD */}
            {selectedCell && (
              <div
                onMouseDown={(e) => e.stopPropagation()}
                onMouseMove={(e) => e.stopPropagation()}
                onMouseUp={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-3 left-3 right-3 z-30 p-3.5 rounded-2xl bg-slate-900 border border-slate-700/90 shadow-2xl space-y-2.5 animate-pop"
              >
                <div className="flex items-center justify-between gap-2">
                  {selectedCell.is_land === 0 ? (
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xl shrink-0">🌊</span>
                      <div className="min-w-0">
                        <h3 className="text-xs font-black text-white truncate">Нейтральные воды</h3>
                        <p className="text-[10px] text-sky-400 font-medium">Клетка ({selectedCell.x}, {selectedCell.y}) • Не захватывается</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm border border-white/20"
                        style={{ backgroundColor: selectedCell.group_color || '#154228' }}
                      />
                      <div className="min-w-0">
                        <h3 className="text-xs font-black text-white truncate">
                          {selectedCell.group_name ? `Клан «${selectedCell.group_name}»` : 'Свободная земля'}
                        </h3>
                        <p className="text-[10px] text-slate-400 truncate">
                          Клетка ({selectedCell.x}, {selectedCell.y})
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 shrink-0">
                    {selectedCell.is_land !== 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-lg bg-white/10 font-bold shrink-0">
                        {selectedCell.is_monument ? (
                          <span className="text-amber-400">🏛️ Монумент</span>
                        ) : selectedCell.level >= 2 ? (
                          <span className="text-emerald-400">🛡️ Lvl 2</span>
                        ) : selectedCell.level === 1 ? (
                          <span className="text-indigo-400">🚩 Lvl 1</span>
                        ) : (
                          <span className="text-emerald-400">🟢 Свободна</span>
                        )}
                      </span>
                    )}
                    <button
                      onClick={() => setSelectedCell(null)}
                      className="p-1 rounded-lg text-slate-400 hover:text-white active:scale-95 cursor-pointer"
                      title="Закрыть"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {selectedCell.shield_until && new Date(selectedCell.shield_until).getTime() > Date.now() && (
                  <div className="p-1.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-[10px] text-sky-400 font-bold flex items-center gap-1.5">
                    <Shield className="w-3 h-3 shrink-0" />
                    <span>Защищена щитом Звёзд</span>
                  </div>
                )}

                {actionError && (
                  <p className="text-[11px] text-rose-400 font-bold">{actionError}</p>
                )}

                {/* Action Buttons in Cell Card */}
                {selectedCell.is_land !== 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {myGroup?.isCommander && (
                      <>
                        {(!selectedCell.group_id || selectedCell.group_id !== myGroup.group?.id) && (
                          <button
                            disabled={actionLoading}
                            onPointerDown={(e) => e.stopPropagation()}
                            onTouchEnd={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              executeAction('capture', selectedCell.x, selectedCell.y);
                            }}
                            className="flex-1 py-2 px-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-black text-xs flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer disabled:opacity-50 shadow-lg shadow-indigo-600/30 border border-indigo-400/30"
                          >
                            <Flag className="w-3.5 h-3.5" />
                            <span>Захват (1 🏛️)</span>
                          </button>
                        )}
                        {selectedCell.group_id === myGroup.group?.id && selectedCell.level === 1 && (
                          <button
                            disabled={actionLoading}
                            onPointerDown={(e) => e.stopPropagation()}
                            onTouchEnd={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              executeAction('fortify', selectedCell.x, selectedCell.y);
                            }}
                            className="flex-1 py-2 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer disabled:opacity-50 shadow-lg shadow-emerald-600/30 border border-emerald-400/30"
                          >
                            <Shield className="w-3.5 h-3.5" />
                            <span>Укрепить (2 🏛️)</span>
                          </button>
                        )}
                        {selectedCell.group_id && selectedCell.group_id !== myGroup.group?.id && selectedCell.level >= 2 && (
                          <button
                            disabled={actionLoading}
                            onPointerDown={(e) => e.stopPropagation()}
                            onTouchEnd={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              executeAction('sabotage', selectedCell.x, selectedCell.y);
                            }}
                            className="flex-1 py-2 px-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-black text-xs flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer disabled:opacity-50 shadow-lg shadow-rose-600/30 border border-rose-400/30"
                          >
                            <Bomb className="w-3.5 h-3.5" />
                            <span>Диверсия (1 🏛️)</span>
                          </button>
                        )}
                      </>
                    )}

                    {myGroup?.group && (!selectedCell.group_id || selectedCell.group_id !== myGroup.group.id) && (
                      <button
                        disabled={actionLoading || coins < 3000}
                        onPointerDown={(e) => e.stopPropagation()}
                        onTouchEnd={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          executeAction('emergency', selectedCell.x, selectedCell.y);
                        }}
                        className="py-2 px-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:from-amber-600 active:to-amber-700 text-white font-black text-xs flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer disabled:opacity-40 shadow-lg shadow-amber-500/30 border border-amber-400/40"
                      >
                        <Coins className="w-3.5 h-3.5" />
                        <span>Экстренный (3 000 🪙)</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* FLOATING BOTTOM COMMANDER BAR (When NO cell is selected) */}
            {!selectedCell && myGroup?.isCommander && (
              <div
                onMouseDown={(e) => e.stopPropagation()}
                onMouseMove={(e) => e.stopPropagation()}
                onMouseUp={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-3 left-3 right-3 z-20 p-2.5 rounded-2xl bg-slate-900 border border-indigo-500/50 shadow-2xl space-y-1.5 animate-fade-in"
              >
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="text-[11px] font-black text-white truncate">Панель Командора «{myGroup.group?.name}»</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-400/30">
                      {myGroup.group?.treasuryTokens || 0} 🏛️ токенов
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onTouchEnd={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      sound.playUiTap();
                      haptics.selection();
                      setSelectedAction(selectedAction === 'capture' ? null : 'capture');
                    }}
                    className={`py-1.5 px-1 rounded-xl border text-[10px] font-black flex flex-col items-center gap-0.5 transition-all cursor-pointer ${
                      selectedAction === 'capture'
                        ? 'bg-indigo-600 border-indigo-400 text-white shadow-sm'
                        : 'bg-slate-800 border-slate-700 text-slate-200 hover:border-indigo-400'
                    }`}
                  >
                    <Flag className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Захват (1 🏛️)</span>
                  </button>

                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onTouchEnd={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      sound.playUiTap();
                      haptics.selection();
                      setSelectedAction(selectedAction === 'fortify' ? null : 'fortify');
                    }}
                    className={`py-1.5 px-1 rounded-xl border text-[10px] font-black flex flex-col items-center gap-0.5 transition-all cursor-pointer ${
                      selectedAction === 'fortify'
                        ? 'bg-emerald-600 border-emerald-400 text-white shadow-sm'
                        : 'bg-slate-800 border-slate-700 text-slate-200 hover:border-emerald-400'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Защита (2 🏛️)</span>
                  </button>

                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onTouchEnd={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      sound.playUiTap();
                      haptics.selection();
                      setSelectedAction(selectedAction === 'sabotage' ? null : 'sabotage');
                    }}
                    className={`py-1.5 px-1 rounded-xl border text-[10px] font-black flex flex-col items-center gap-0.5 transition-all cursor-pointer ${
                      selectedAction === 'sabotage'
                        ? 'bg-rose-600 border-rose-400 text-white shadow-sm'
                        : 'bg-slate-800 border-slate-700 text-slate-200 hover:border-rose-400'
                    }`}
                  >
                    <Bomb className="w-3.5 h-3.5 text-rose-400" />
                    <span>Диверсия (1 🏛️)</span>
                  </button>

                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onTouchEnd={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      sound.playUiTap();
                      haptics.selection();
                      setSelectedAction(selectedAction === 'monument' ? null : 'monument');
                    }}
                    className={`py-1.5 px-1 rounded-xl border text-[10px] font-black flex flex-col items-center gap-0.5 transition-all cursor-pointer ${
                      selectedAction === 'monument'
                        ? 'bg-amber-600 border-amber-400 text-white shadow-sm'
                        : 'bg-slate-800 border-slate-700 text-slate-200 hover:border-amber-400'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 text-amber-400" />
                    <span>3×3 (5 🏛️)</span>
                  </button>
                </div>
              </div>
            )}

            {/* FLOATING HINT (When NO cell selected & user is not commander) */}
            {!selectedCell && !myGroup?.isCommander && (
              <div
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
                className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 px-3.5 py-1.5 rounded-full bg-slate-900/95 border border-slate-700 text-[10px] text-white/90 pointer-events-none shadow-xl whitespace-nowrap"
              >
                Тапните по клетке для разведки
              </div>
            )}
          </div>
        </div>

      {/* SUB-SCREEN 2: GROUP LEADERBOARD */}
      <div className={activeSubTab === 'leaderboard' ? 'flex-1 overflow-y-auto p-4 space-y-4 pb-20' : 'hidden'}>
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
            <div><span className="text-amber-400 font-black">#1</span>: 12 🏛️</div>
            <div><span className="text-slate-300 font-black">#2</span>: 8 🏛️</div>
            <div><span className="text-amber-600 font-black">#3</span>: 5 🏛️</div>
            <div><span className="text-tg-text font-black">4–10</span>: 2 🏛️</div>
            <div><span className="text-tg-hint font-black">11–50</span>: 1 🏛️</div>
          </div>
        </div>

        {myGroup?.group ? (
          <div className="p-4 rounded-3xl bg-slate-900 border-2 border-indigo-500/40 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-white text-base shadow-sm shrink-0"
                  style={{ backgroundColor: myGroup.group.color }}
                >
                  {getClanBadgeIcon(myGroup.group.photoUrl, myGroup.group.name)}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-tg-text flex items-center gap-1.5 truncate">
                    <span>{myGroup.group.name}</span>
                    {myGroup.isCommander && (
                      <span title="Командор клана">
                        <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      </span>
                    )}
                    {myGroup.isCommander && (
                      <button
                        onClick={() => {
                          sound.playUiTap();
                          haptics.selection();
                          setRenameInput(myGroup.group?.name || '');
                          setRenameError(null);
                          setIsRenameModalOpen(true);
                        }}
                        className="p-1 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-400/10 active:scale-95 transition-all cursor-pointer shrink-0"
                        title="Сменить название клана (50 ⭐)"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </h3>
                  <p className="text-[11px] text-tg-hint truncate">
                    {myGroup.group.username ? `@${myGroup.group.username}` : `${myGroup.group.memberCount} участников`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => {
                    sound.playUiTap();
                    haptics.selection();
                    setIsMembersModalOpen(true);
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-xs font-bold text-indigo-200 hover:text-white active:scale-95 cursor-pointer flex items-center gap-1.5 shadow-sm"
                  title="Участники клана"
                >
                  <Users className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Участники ({myGroup.members?.length || myGroup.group.memberCount || 1})</span>
                </button>
                <button
                  onClick={handleShareClanInvite}
                  className="p-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white active:scale-95 cursor-pointer shadow-sm"
                  title="Пригласить в клан"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleCopyClanInvite}
                  className="p-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white active:scale-95 cursor-pointer"
                  title="Скопировать ссылку"
                >
                  {inviteCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-xs">
              <div>
                <span className="text-[10px] text-tg-hint font-medium">Ваш вклад в цикл:</span>
                <p className="text-sm font-black text-indigo-400">+{myGroup.userCycleScore.toLocaleString()} pts</p>
              </div>
              <div>
                <span className="text-[10px] text-tg-hint font-medium">Казна клана:</span>
                <p className="text-sm font-black text-amber-400">{myGroup.group.treasuryTokens} 🏛️ токенов</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-5 rounded-3xl bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-900 border-2 border-indigo-500/30 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center shrink-0">
                <Users className="w-6 h-6 text-indigo-400" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-black text-tg-text">Вы пока не состоите в клане</h3>
                <p className="text-xs text-tg-hint mt-0.5">
                  Вступите по ссылке друга или создайте собственный клан!
                </p>
              </div>
            </div>

            {/* Referrals requirement to create clan */}
            <div className="p-3.5 rounded-2xl bg-black/30 border border-white/5 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-300 flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5 text-amber-400" />
                  Условие создания клана:
                </span>
                <span className={`font-black px-2 py-0.5 rounded-full text-[11px] ${
                  (referralsData?.invitedCount ?? referralsData?.referrals?.length ?? 0) >= 2
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}>
                  {Math.min(referralsData?.invitedCount ?? referralsData?.referrals?.length ?? 0, 2)} / 2 друзей
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-indigo-500 transition-all duration-500 rounded-full"
                  style={{
                    width: `${Math.min(((referralsData?.invitedCount ?? referralsData?.referrals?.length ?? 0) / 2) * 100, 100)}%`
                  }}
                />
              </div>

              {createClanError && (
                <div className="p-2 rounded-xl bg-rose-500/15 border border-rose-400/30 text-rose-400 text-xs font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{createClanError}</span>
                </div>
              )}

              {(referralsData?.invitedCount ?? referralsData?.referrals?.length ?? 0) >= 2 ? (
                <div className="space-y-2 pt-1">
                  <p className="text-[11px] text-emerald-400 font-medium">
                    🎉 Вы пригласили {referralsData?.invitedCount ?? referralsData?.referrals?.length ?? 0} друзей! Вы можете стать Командором и основать клан прямо сейчас.
                  </p>
                  <button
                    onClick={handleCreateClanClick}
                    disabled={isCreatingClan}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-indigo-600 hover:brightness-110 text-white font-black text-xs shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    <Crown className="w-4 h-4 text-amber-200" />
                    <span>{isCreatingClan ? 'Основание клана...' : 'Основать свой клан!'}</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2 pt-1">
                  <p className="text-[11px] text-tg-hint">
                    Пригласите еще {2 - (referralsData?.invitedCount ?? referralsData?.referrals?.length ?? 0)} друзей, чтобы разблокировать создание клана и получить звание Командора.
                  </p>
                  <button
                    onClick={() => {
                      sound.playUiTap();
                      haptics.medium();
                      const botUsername = referralsData?.botUsername || 'taptaphub_bot';
                      const inviteLink = `https://t.me/${botUsername}?start=ref_${user.id}`;
                      const shareText = `🎮 Залетай в TapTap Hub! Играй в любимые головоломки прямо в Telegram и забирай +500 🪙 стартового бонуса! 🔥`;
                      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(shareText)}`;
                      const tg = getTelegramWebApp();
                      if (tg?.openTelegramLink) tg.openTelegramLink(shareUrl);
                      else window.open(shareUrl, '_blank');
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30 flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Пригласить друга (+500 🪙)</span>
                  </button>
                </div>
              )}
            </div>
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
                        {getClanBadgeIcon(item.photoUrl, item.name)}
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
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      {/* MODAL: Rename Clan for Stars */}
      {isRenameModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-700 p-5 shadow-2xl text-white">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-black text-white">Смена названия клана</h3>
              </div>
              <button
                onClick={() => setIsRenameModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-3">
              Введите новое имя для вашего клана. Стоимость смены — <strong>50 ⭐ Telegram Stars</strong>.
            </p>

            <form onSubmit={handleRenameSubmit} className="space-y-3">
              <div>
                <div className="relative">
                  <input
                    type="text"
                    value={renameInput}
                    onChange={(e) => {
                      setRenameInput(e.target.value);
                      if (renameError) setRenameError(null);
                    }}
                    maxLength={20}
                    placeholder="Новое название (3-20 симв.)"
                    className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-sm font-bold text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  <span className="absolute right-3 top-3 text-[11px] font-mono text-slate-500">
                    {renameInput.length}/20
                  </span>
                </div>
              </div>

              {renameError && (
                <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-400/30 text-rose-400 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{renameError}</span>
                </div>
              )}

              <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700/60 text-[11px] text-slate-400 space-y-1">
                <p className="font-bold text-slate-300">Требования к названию:</p>
                <p>• От 3 до 20 символов (буквы, цифры, дефис, пробел).</p>
                <p>• Запрещены ссылки на сторонние ресурсы и нецензурная лексика.</p>
              </div>

              <button
                type="submit"
                disabled={renameLoading || renameInput.trim().length < 3}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-indigo-600 hover:brightness-110 font-black text-xs text-white shadow-lg shadow-amber-500/20 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>⭐</span>
                <span>{renameLoading ? 'Обработка...' : 'Сменить за 50 Stars'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Clan Members & Management */}
      {isMembersModalOpen && myGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-sm max-h-[85vh] flex flex-col rounded-3xl bg-slate-900 border border-slate-800 p-5 shadow-2xl text-white">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl shrink-0 shadow-md border"
                  style={{
                    backgroundColor: `${myGroup.group?.color || '#6366f1'}20`,
                    borderColor: `${myGroup.group?.color || '#6366f1'}50`,
                  }}
                >
                  {getClanBadgeIcon(myGroup.group?.photoUrl, myGroup.group?.name || '')}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-white truncate">{myGroup.group?.name}</h3>
                  <p className="text-[11px] text-slate-400">
                    Участники ({myGroup.members?.length || myGroup.group?.memberCount || 1})
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  sound.playUiTap();
                  setIsMembersModalOpen(false);
                  setMemberActionError(null);
                }}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error banner if any */}
            {memberActionError && (
              <div className="mt-3 p-2.5 rounded-xl bg-rose-500/15 border border-rose-400/30 text-rose-400 text-xs font-bold flex items-center gap-2 shrink-0">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{memberActionError}</span>
              </div>
            )}

            {/* Members List (Scrollable) */}
            <div className="flex-1 overflow-y-auto my-3 space-y-2 pr-1 custom-scrollbar">
              {(myGroup.members && myGroup.members.length > 0 ? myGroup.members : [
                {
                  id: user.id,
                  telegram_id: String(user.id),
                  first_name: user.first_name || 'Вы',
                  username: user.username || null,
                  photo_url: user.photo_url || null,
                  cycle_score: myGroup.userCycleScore || 0,
                  is_commander: myGroup.isCommander ? 1 : 0,
                }
              ]).map((member) => {
                const isMemberCommander = Boolean(member.is_commander);
                const isMe = member.id === user.id;

                return (
                  <div
                    key={member.id}
                    className="p-2.5 rounded-2xl bg-slate-800/70 border border-slate-700/50 flex items-center justify-between gap-2.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {member.photo_url ? (
                        <img
                          src={member.photo_url}
                          alt={member.first_name}
                          className="w-8 h-8 rounded-xl object-cover shrink-0 border border-slate-600"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-xl bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 flex items-center justify-center text-xs font-bold shrink-0">
                          {(member.first_name || 'U')[0].toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-100 truncate">
                            {member.first_name} {isMe && <span className="text-indigo-400 text-[10px] font-normal">(Вы)</span>}
                          </span>
                          {isMemberCommander && (
                            <span className="px-1.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/40 text-[9px] font-black text-amber-400 flex items-center gap-0.5 shrink-0">
                              <Crown className="w-2.5 h-2.5" />
                              Командор
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-2">
                          {member.username && <span>@{member.username}</span>}
                          <span className="text-indigo-400 font-bold">+{member.cycle_score.toLocaleString()} pts</span>
                        </div>
                      </div>
                    </div>

                    {/* Commander Action: Kick member */}
                    {myGroup.isCommander && !isMe && (
                      <button
                        onClick={() => handleKickMember(Number(member.id), member.first_name)}
                        disabled={memberActionLoading === Number(member.id)}
                        className="px-2 py-1 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-[10px] font-bold text-rose-400 hover:text-rose-300 disabled:opacity-50 cursor-pointer active:scale-95 shrink-0"
                        title="Исключить из клана"
                      >
                        {memberActionLoading === Number(member.id) ? '...' : 'Исключить'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Invite & Share Action Buttons */}
            <div className="pt-3 border-t border-slate-800 space-y-2 shrink-0">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleShareClanInvite}
                  className="py-2.5 px-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/30 active:scale-95 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Пригласить</span>
                </button>
                <button
                  onClick={handleCopyClanInvite}
                  className="py-2.5 px-3 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                >
                  {inviteCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{inviteCopied ? 'Скопировано' : 'Копировать'}</span>
                </button>
              </div>

              {/* Leave clan button */}
              <button
                onClick={handleLeaveClan}
                disabled={memberActionLoading === 'leave'}
                className="w-full py-2 px-3 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 font-bold text-[11px] flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{memberActionLoading === 'leave' ? 'Выход...' : 'Покинуть клан'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
