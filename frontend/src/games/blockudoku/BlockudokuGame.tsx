import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useGameBridge } from '../../context/GameContext';
import {
  useBlockudoku,
  canPlacePiece,
  getPredictedClears,
  GRID_SIZE,
} from './useBlockudoku';
import type { Shape, DragState } from './types';
import { haptics } from '../../telegram/telegram';
import { sound } from '../../utils/sound';
import confetti from 'canvas-confetti';
import {
  ArrowLeft,
  RotateCcw,
  Trophy,
  Sparkles,
  Flame,
  Ban,
  Volume2,
  VolumeX,
} from 'lucide-react';

const FINGER_OFFSET_TOUCH = 65; // Lift piece above touch point on mobile screens only

export const BlockudokuGame: React.FC = () => {
  const { closeGame, bestScores, submitScore } = useGameBridge();
  const currentBest = bestScores['blockudoku'] || 0;

  const {
    grid,
    trayPieces,
    trayPlaceable,
    score,
    bestScore,
    streak,
    isStuck,
    isGameOver,
    clearingCells,
    lastScorePopup,
    comboBanner,
    placePiece,
    restartGame,
  } = useBlockudoku(currentBest);

  const [dragState, setDragState] = useState<DragState | null>(null);
  const [selectedTrayIndex, setSelectedTrayIndex] = useState<number | null>(null);
  const [hoverBoardCell, setHoverBoardCell] = useState<{ row: number; col: number } | null>(null);
  const [isNewRecordAchieved, setIsNewRecordAchieved] = useState(false);
  const [isMuted, setIsMuted] = useState(() => sound.isMuted());
  const boardRef = useRef<HTMLDivElement>(null);

  const toggleSound = () => {
    const next = sound.toggleMute();
    setIsMuted(next);
  };

  // Submit score on game over & play game over sound
  useEffect(() => {
    if (isStuck) {
      sound.playGameOver();
    }
  }, [isStuck]);

  useEffect(() => {
    if (isGameOver && score > 0) {
      haptics.warning();
      submitScore('blockudoku', score).then((res) => {
        if (res.isNewRecord) {
          setIsNewRecordAchieved(true);
          sound.playRecord();
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 },
          });
        }
      });
    }
  }, [isGameOver, score, submitScore]);

  // Keyboard shortcuts on PC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedTrayIndex !== null) {
          setSelectedTrayIndex(null);
        } else {
          sound.playUiTap();
          closeGame();
        }
      } else if (e.key === 'r' || e.key === 'R') {
        handleRestart();
      } else if (e.key === 'm' || e.key === 'M') {
        toggleSound();
      } else if (e.key === '1' && trayPieces[0] && trayPlaceable[0]) {
        setSelectedTrayIndex((prev) => (prev === 0 ? null : 0));
        sound.playPickup();
      } else if (e.key === '2' && trayPieces[1] && trayPlaceable[1]) {
        setSelectedTrayIndex((prev) => (prev === 1 ? null : 1));
        sound.playPickup();
      } else if (e.key === '3' && trayPieces[2] && trayPlaceable[2]) {
        setSelectedTrayIndex((prev) => (prev === 2 ? null : 2));
        sound.playPickup();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTrayIndex, trayPieces, trayPlaceable, closeGame]);

  // Handle pointer down on a tray piece (Drag or Click-to-select)
  const handlePiecePointerDown = (
    e: React.PointerEvent,
    piece: Shape,
    pieceIndex: number
  ) => {
    if (!trayPlaceable[pieceIndex]) return; // Block unplaceable piece

    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    haptics.selection();
    sound.playPickup();

    const isTouch = e.pointerType === 'touch';
    const offsetY = isTouch ? FINGER_OFFSET_TOUCH : 0;

    const clientX = e.clientX;
    const clientY = e.clientY - offsetY;

    setSelectedTrayIndex(pieceIndex);

    setDragState({
      piece,
      pieceIndex,
      x: clientX,
      y: clientY,
      targetRow: null,
      targetCol: null,
      canDrop: false,
    });
  };

  // Handle pointer move during drag
  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const isTouch = e.pointerType === 'touch';
      const offsetY = isTouch ? FINGER_OFFSET_TOUCH : 0;
      const clientX = e.clientX;
      const clientY = e.clientY - offsetY;

      if (!boardRef.current) return;
      const boardRect = boardRef.current.getBoundingClientRect();
      const cellSize = boardRect.width / GRID_SIZE;

      const activePiece =
        dragState?.piece ||
        (selectedTrayIndex !== null && trayPlaceable[selectedTrayIndex]
          ? trayPieces[selectedTrayIndex]
          : null);

      if (activePiece) {
        const pieceMatrix = activePiece.matrix;
        const pieceWidth = pieceMatrix[0].length * cellSize;
        const pieceHeight = pieceMatrix.length * cellSize;

        const pieceLeft = clientX - pieceWidth / 2;
        const pieceTop = clientY - pieceHeight / 2;

        const targetCol = Math.round((pieceLeft - boardRect.left) / cellSize);
        const targetRow = Math.round((pieceTop - boardRect.top) / cellSize);

        const isValid = canPlacePiece(grid, pieceMatrix, targetRow, targetCol);

        if (dragState) {
          setDragState((prev) =>
            prev
              ? {
                  ...prev,
                  x: clientX,
                  y: clientY,
                  targetRow: isValid ? targetRow : null,
                  targetCol: isValid ? targetCol : null,
                  canDrop: isValid,
                }
              : null
          );
        } else {
          setHoverBoardCell(isValid ? { row: targetRow, col: targetCol } : null);
        }
      }
    },
    [dragState, selectedTrayIndex, trayPieces, trayPlaceable, grid]
  );

  // Handle pointer up to drop piece
  const handlePointerUp = useCallback(() => {
    if (!dragState) return;

    if (dragState.canDrop && dragState.targetRow !== null && dragState.targetCol !== null) {
      const res = placePiece(
        dragState.pieceIndex,
        dragState.targetRow,
        dragState.targetCol
      );

      if (res.success) {
        setSelectedTrayIndex(null);
        if (res.clearedLines > 0) {
          sound.playClear(res.clearedLines + res.combo);
          if (res.clearedLines > 1) {
            haptics.success();
            confetti({
              particleCount: 50,
              spread: 60,
              origin: { y: 0.5 },
            });
          } else {
            haptics.medium();
          }
        } else {
          sound.playPlace();
          haptics.light();
        }
      }
    }

    setDragState(null);
  }, [dragState, placePiece]);

  // Click on board cell (Click-to-place mode)
  const handleBoardClick = (targetRow: number, targetCol: number) => {
    if (selectedTrayIndex === null) return;
    const piece = trayPieces[selectedTrayIndex];
    if (!piece || !trayPlaceable[selectedTrayIndex]) return;

    if (canPlacePiece(grid, piece.matrix, targetRow, targetCol)) {
      const res = placePiece(selectedTrayIndex, targetRow, targetCol);
      if (res.success) {
        setSelectedTrayIndex(null);
        setHoverBoardCell(null);
        if (res.clearedLines > 0) {
          sound.playClear(res.clearedLines + res.combo);
          if (res.clearedLines > 1) {
            haptics.success();
            confetti({ particleCount: 50, spread: 60, origin: { y: 0.5 } });
          } else {
            haptics.medium();
          }
        } else {
          sound.playPlace();
          haptics.light();
        }
      }
    }
  };

  // Restart handler
  const handleRestart = () => {
    haptics.medium();
    sound.playUiTap();
    setIsNewRecordAchieved(false);
    setSelectedTrayIndex(null);
    setHoverBoardCell(null);
    restartGame();
  };

  // Compute predicted clearing cells (Clear Prediction)
  const predictedClears = useMemo(() => {
    if (dragState && dragState.canDrop && dragState.targetRow !== null && dragState.targetCol !== null) {
      return getPredictedClears(grid, dragState.piece.matrix, dragState.targetRow, dragState.targetCol);
    }
    if (selectedTrayIndex !== null && hoverBoardCell) {
      const piece = trayPieces[selectedTrayIndex];
      if (piece && canPlacePiece(grid, piece.matrix, hoverBoardCell.row, hoverBoardCell.col)) {
        return getPredictedClears(grid, piece.matrix, hoverBoardCell.row, hoverBoardCell.col);
      }
    }
    return [];
  }, [dragState, selectedTrayIndex, hoverBoardCell, grid, trayPieces]);

  const isPredictedClearCell = (r: number, c: number) => {
    return predictedClears.some((cell) => cell.row === r && cell.col === c);
  };

  const isGhostCell = (r: number, c: number) => {
    if (dragState && dragState.targetRow !== null && dragState.targetCol !== null) {
      const piece = dragState.piece;
      const relR = r - dragState.targetRow;
      const relC = c - dragState.targetCol;
      return (
        relR >= 0 &&
        relR < piece.matrix.length &&
        relC >= 0 &&
        relC < piece.matrix[0].length &&
        piece.matrix[relR][relC] === 1
      );
    }
    if (selectedTrayIndex !== null && hoverBoardCell) {
      const piece = trayPieces[selectedTrayIndex];
      if (piece) {
        const relR = r - hoverBoardCell.row;
        const relC = c - hoverBoardCell.col;
        return (
          relR >= 0 &&
          relR < piece.matrix.length &&
          relC >= 0 &&
          relC < piece.matrix[0].length &&
          piece.matrix[relR][relC] === 1
        );
      }
    }
    return false;
  };

  const isClearing = (r: number, c: number) => {
    return clearingCells.some((cell) => cell.row === r && cell.col === c);
  };

  return (
    <div
      className="w-full h-full min-h-[100dvh] max-h-[100dvh] overflow-hidden flex flex-col justify-between bg-tg-bg text-tg-text select-none game-viewport-lock"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => setDragState(null)}
    >
      {/* 1. Fixed Header & Score HUD (h-14) */}
      <header className="h-14 shrink-0 px-4 flex items-center justify-between border-b border-slate-800/60 bg-tg-secondaryBg/80 backdrop-blur-md z-10">
        <button
          onClick={() => {
            sound.playUiTap();
            closeGame();
          }}
          className="p-2 -ml-2 rounded-xl text-slate-400 hover:text-tg-text active:scale-95 transition-transform cursor-pointer"
          title="В меню (Esc)"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>

        {/* Centered Scores */}
        <div className="flex items-center gap-5">
          <div className="text-center relative">
            <span className="text-[10px] uppercase tracking-wider text-tg-hint font-semibold block leading-none mb-1">
              Счет
            </span>
            <span className="text-2xl font-black text-indigo-400 tracking-tight leading-none">
              {score}
            </span>
            {lastScorePopup && (
              <span
                key={lastScorePopup.id}
                className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-black text-amber-300 whitespace-nowrap animate-bounce drop-shadow pointer-events-none"
              >
                {lastScorePopup.text}
              </span>
            )}
          </div>

          <div className="h-6 w-[1px] bg-slate-800" />

          <div className="text-center">
            <span className="text-[10px] uppercase tracking-wider text-tg-hint font-semibold block leading-none mb-1">
              Рекорд
            </span>
            <span className="text-base font-bold text-amber-400 leading-none flex items-center gap-1 justify-center">
              <Trophy className="w-3.5 h-3.5 fill-amber-400/20" />
              {bestScore}
            </span>
          </div>
        </div>

        {/* Right Header Buttons: Sound & Restart */}
        <div className="flex items-center gap-1 -mr-2">
          <button
            onClick={toggleSound}
            className="p-2 rounded-xl text-slate-400 hover:text-tg-text active:scale-95 transition-transform cursor-pointer"
            title={isMuted ? 'Включить звук (M)' : 'Выключить звук (M)'}
          >
            {isMuted ? (
              <VolumeX className="w-5 h-5 text-slate-500" />
            ) : (
              <Volume2 className="w-5 h-5 text-indigo-400" />
            )}
          </button>

          <button
            onClick={handleRestart}
            className="p-2 rounded-xl text-slate-400 hover:text-tg-text active:scale-95 transition-transform cursor-pointer"
            title="Начать заново (R)"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* 2. Fixed Status & Combo Banner (h-7) */}
      <div className="h-7 shrink-0 flex items-center justify-center px-4">
        {isStuck ? (
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-rose-500/20 border border-rose-400/40 text-[11px] font-bold text-rose-300 animate-pulse">
            <Ban className="w-3.5 h-3.5 text-rose-400" />
            Нет места для оставшихся фигур!
          </div>
        ) : comboBanner ? (
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/40 text-[11px] font-bold text-indigo-300 animate-fade-in">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            {comboBanner.text}
          </div>
        ) : streak > 1 ? (
          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/30 text-[11px] font-extrabold text-amber-300 animate-pulse">
            <Flame className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            Серия ходов: x{streak}!
          </div>
        ) : selectedTrayIndex !== null ? (
          <span className="text-[11px] text-indigo-300 font-medium animate-pulse">
            Кликните по доске для установки
          </span>
        ) : null}
      </div>

      {/* 3. Responsive 9x9 Board */}
      <div className="flex-1 flex items-center justify-center p-2 min-h-0">
        <div
          ref={boardRef}
          style={{
            width: 'min(86vw, 44vh, 370px)',
            height: 'min(86vw, 44vh, 370px)',
          }}
          className="aspect-square bg-slate-900/95 rounded-2xl p-2 border-2 border-slate-800/90 shadow-2xl shadow-indigo-950/40 grid grid-cols-9 gap-1"
        >
          {grid.map((row, r) =>
            row.map((cell, c) => {
              const isGhost = isGhostCell(r, c);
              const isClear = isClearing(r, c);
              const isPredicted = isPredictedClearCell(r, c);

              const boxRow = Math.floor(r / 3);
              const boxCol = Math.floor(c / 3);
              const isSubgridEven = (boxRow + boxCol) % 2 === 0;

              return (
                <div
                  key={`${r}-${c}`}
                  onClick={() => handleBoardClick(r, c)}
                  className={`relative rounded-md transition-all duration-100 flex items-center justify-center aspect-square cursor-pointer ${
                    isClear
                      ? 'bg-amber-300 scale-105 shadow-lg shadow-amber-400/60 z-10'
                      : isPredicted
                      ? 'bg-amber-400/80 ring-2 ring-amber-300 shadow-md shadow-amber-400/50 scale-95 animate-pulse z-10'
                      : cell > 0
                      ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 border border-indigo-400/50 shadow-sm shadow-indigo-500/20'
                      : isGhost
                      ? 'bg-indigo-400/50 border-2 border-indigo-300 scale-95 animate-pulse'
                      : isSubgridEven
                      ? 'bg-slate-800/80 border border-slate-700/40'
                      : 'bg-slate-850/60 border border-slate-800/60'
                  }`}
                >
                  {cell > 0 && !isClear && !isPredicted && (
                    <div className="w-full h-full rounded-[4px] bg-white/10 border-t border-l border-white/20" />
                  )}
                  {isPredicted && (
                    <div className="w-2 h-2 rounded-full bg-white animate-ping" />
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 4. Tray of 3 Pieces (h-28) */}
      <div className="h-28 shrink-0 pb-3 px-3 bg-tg-secondaryBg/40 border-t border-slate-800/60">
        <div className="max-w-md mx-auto grid grid-cols-3 gap-2.5 h-full">
          {trayPieces.map((piece, index) => {
            const isBeingDragged = dragState?.pieceIndex === index;
            const isSelected = selectedTrayIndex === index;
            const canPlace = trayPlaceable[index];

            return (
              <div
                key={index}
                onClick={() => {
                  if (piece && canPlace) {
                    setSelectedTrayIndex((prev) => (prev === index ? null : index));
                    sound.playPickup();
                  }
                }}
                className={`relative rounded-2xl border transition-all duration-200 flex items-center justify-center overflow-hidden touch-none ${
                  !piece
                    ? 'bg-slate-900/30 border-slate-800/40'
                    : !canPlace
                    ? 'bg-slate-900/40 border-dashed border-slate-700/60 opacity-30 grayscale cursor-not-allowed'
                    : isSelected
                    ? 'border-indigo-400 ring-2 ring-indigo-500/40 bg-indigo-950/30 cursor-grab active:cursor-grabbing'
                    : 'bg-slate-900/80 border-slate-800/80 hover:border-slate-700 cursor-grab active:cursor-grabbing'
                }`}
              >
                {piece && !isBeingDragged && (
                  <div
                    onPointerDown={(e) => canPlace && handlePiecePointerDown(e, piece, index)}
                    className={`p-2 transition-transform ${
                      canPlace ? 'hover:scale-105 active:scale-95' : ''
                    } ${isSelected ? 'scale-105' : ''}`}
                  >
                    <div
                      className="grid gap-1"
                      style={{
                        gridTemplateColumns: `repeat(${piece.matrix[0].length}, minmax(0, 1fr))`,
                      }}
                    >
                      {piece.matrix.map((row, r) =>
                        row.map((val, c) => (
                          <div
                            key={`${r}-${c}`}
                            className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-sm transition-all ${
                              val === 1
                                ? canPlace
                                  ? `${piece.colorClass} shadow-sm ${piece.glowClass}`
                                  : 'bg-slate-600'
                                : 'opacity-0'
                            }`}
                          />
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Subtitle if unplaceable */}
                {piece && !canPlace && (
                  <span className="absolute bottom-1 text-[9px] font-semibold text-slate-400/80 tracking-tight">
                    нет места
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating Dragged Piece */}
      {dragState && (
        <div
          className="pointer-events-none fixed z-50 transition-opacity"
          style={{
            left: `${dragState.x}px`,
            top: `${dragState.y}px`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div
            className="grid gap-1.5 p-1 rounded-lg"
            style={{
              gridTemplateColumns: `repeat(${dragState.piece.matrix[0].length}, minmax(0, 1fr))`,
            }}
          >
            {dragState.piece.matrix.map((row, r) =>
              row.map((val, c) => (
                <div
                  key={`${r}-${c}`}
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-md transition-all ${
                    val === 1
                      ? `${dragState.piece.colorClass} shadow-xl ${dragState.piece.glowClass} scale-105`
                      : 'opacity-0'
                  }`}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* Game Over Modal */}
      {isGameOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-tg-secondaryBg border border-slate-700/80 p-6 text-center shadow-2xl animate-pop">
            <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 p-[2px] shadow-lg shadow-amber-500/20 flex items-center justify-center">
              <Trophy className="w-8 h-8 text-white fill-white/20" />
            </div>

            <h3 className="text-xl font-black text-tg-text">Игра окончена</h3>
            <p className="text-xs text-tg-hint mt-1">
              Для оставшихся фигур не нашлось места на поле
            </p>

            <div className="my-5 p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
              <span className="text-xs text-tg-hint uppercase font-semibold">
                Итоговый результат
              </span>
              <p className="text-3xl font-black text-indigo-400 mt-1">{score}</p>

              {isNewRecordAchieved && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-extrabold animate-bounce">
                  <Sparkles className="w-3.5 h-3.5" /> Новый личный рекорд!
                </div>
              )}
            </div>

            <div className="space-y-2">
              <button
                onClick={handleRestart}
                className="w-full py-3 px-4 rounded-xl tg-btn-primary font-bold text-sm shadow-lg shadow-indigo-600/30 cursor-pointer"
              >
                Играть снова
              </button>
              <button
                onClick={() => {
                  sound.playUiTap();
                  closeGame();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-tg-hint font-semibold text-xs border border-slate-700 active:scale-95 transition-all cursor-pointer"
              >
                В главное меню
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
