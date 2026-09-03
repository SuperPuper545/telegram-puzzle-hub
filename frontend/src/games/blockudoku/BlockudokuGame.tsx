import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useGameBridge } from '../../context/GameContext';
import { useBlockudoku, canPlacePiece, GRID_SIZE } from './useBlockudoku';
import type { Shape, DragState } from './types';
import { haptics } from '../../telegram/telegram';
import confetti from 'canvas-confetti';
import { ArrowLeft, RotateCcw, Trophy, Sparkles, Flame } from 'lucide-react';

const FINGER_OFFSET_Y = 70; // Lift piece above touch point so finger does not obscure the board

export const BlockudokuGame: React.FC = () => {
  const { closeGame, bestScores, submitScore } = useGameBridge();
  const currentBest = bestScores['blockudoku'] || 0;

  const {
    grid,
    trayPieces,
    score,
    bestScore,
    streak,
    isGameOver,
    clearingCells,
    lastScorePopup,
    placePiece,
    restartGame,
  } = useBlockudoku(currentBest);

  const [dragState, setDragState] = useState<DragState | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const [isNewRecordAchieved, setIsNewRecordAchieved] = useState(false);

  // Submit score on game over
  useEffect(() => {
    if (isGameOver && score > 0) {
      haptics.warning();
      submitScore('blockudoku', score).then((res) => {
        if (res.isNewRecord) {
          setIsNewRecordAchieved(true);
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 },
          });
        }
      });
    }
  }, [isGameOver, score, submitScore]);

  // Handle pointer down on a tray piece
  const handlePiecePointerDown = (
    e: React.PointerEvent,
    piece: Shape,
    pieceIndex: number
  ) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    haptics.selection();

    // Initial drag state
    const clientX = e.clientX;
    const clientY = e.clientY - FINGER_OFFSET_Y;

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
      if (!dragState || !boardRef.current) return;

      const clientX = e.clientX;
      const clientY = e.clientY - FINGER_OFFSET_Y;

      const boardRect = boardRef.current.getBoundingClientRect();
      const cellSize = boardRect.width / GRID_SIZE;

      // Calculate candidate top-left cell on board
      const pieceMatrix = dragState.piece.matrix;
      const pieceWidth = pieceMatrix[0].length * cellSize;
      const pieceHeight = pieceMatrix.length * cellSize;

      // Center piece at pointer position
      const pieceLeft = clientX - pieceWidth / 2;
      const pieceTop = clientY - pieceHeight / 2;

      // Round to nearest board grid coordinates
      const targetCol = Math.round((pieceLeft - boardRect.left) / cellSize);
      const targetRow = Math.round((pieceTop - boardRect.top) / cellSize);

      const isValid = canPlacePiece(grid, pieceMatrix, targetRow, targetCol);

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
    },
    [dragState, grid]
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
        if (res.clearedLines > 1) {
          haptics.success();
          confetti({
            particleCount: 40,
            spread: 60,
            origin: { y: 0.5 },
          });
        } else if (res.clearedLines === 1) {
          haptics.medium();
        } else {
          haptics.light();
        }
      }
    }

    setDragState(null);
  }, [dragState, placePiece]);

  // Restart handler
  const handleRestart = () => {
    haptics.medium();
    setIsNewRecordAchieved(false);
    restartGame();
  };

  // Determine if a cell is part of the ghost preview
  const isGhostCell = (r: number, c: number) => {
    if (!dragState || dragState.targetRow === null || dragState.targetCol === null) {
      return false;
    }
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
  };

  // Determine if cell is being cleared
  const isClearing = (r: number, c: number) => {
    return clearingCells.some((cell) => cell.row === r && cell.col === c);
  };

  return (
    <div
      className="flex flex-col h-full min-h-[100dvh] bg-slate-950 text-slate-100 select-none game-touch-surface"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => setDragState(null)}
    >
      {/* Top Header & Score HUD */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-sm">
        <button
          onClick={closeGame}
          className="p-2 -ml-2 rounded-xl text-slate-400 hover:text-slate-100 active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>

        {/* Scores */}
        <div className="flex items-center gap-4">
          <div className="text-center">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">
              Счет
            </span>
            <div className="relative">
              <span className="text-2xl font-black text-indigo-300 tracking-tight leading-none">
                {score}
              </span>
              {/* Score popup animation */}
              {lastScorePopup && (
                <span
                  key={lastScorePopup.id}
                  className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs font-black text-amber-300 whitespace-nowrap animate-bounce drop-shadow"
                >
                  {lastScorePopup.text}
                </span>
              )}
            </div>
          </div>

          <div className="h-7 w-[1px] bg-slate-800" />

          <div className="text-center">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">
              Рекорд
            </span>
            <span className="text-base font-bold text-amber-400 leading-none flex items-center gap-1 justify-center">
              <Trophy className="w-3.5 h-3.5 fill-amber-400/20" />
              {bestScore}
            </span>
          </div>
        </div>

        <button
          onClick={handleRestart}
          className="p-2 -mr-2 rounded-xl text-slate-400 hover:text-slate-100 active:scale-95 transition-transform"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
      </div>

      {/* Streak / Combo Banner */}
      <div className="h-6 flex items-center justify-center">
        {streak > 1 && (
          <div className="flex items-center gap-1 text-[11px] font-extrabold text-amber-400 animate-pulse">
            <Flame className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            Серия ходов: x{streak}!
          </div>
        )}
      </div>

      {/* 9x9 Board */}
      <div className="flex-1 flex items-center justify-center p-3 max-w-md mx-auto w-full">
        <div
          ref={boardRef}
          className="w-full aspect-square max-w-[360px] bg-slate-900/90 rounded-2xl p-2 border-2 border-slate-800 shadow-2xl shadow-indigo-950/40 grid grid-cols-9 gap-1"
        >
          {grid.map((row, r) =>
            row.map((cell, c) => {
              const isGhost = isGhostCell(r, c);
              const isClear = isClearing(r, c);

              // 3x3 block visual alternation (checkerboard pattern of 3x3 zones)
              const boxRow = Math.floor(r / 3);
              const boxCol = Math.floor(c / 3);
              const isSubgridEven = (boxRow + boxCol) % 2 === 0;

              return (
                <div
                  key={`${r}-${c}`}
                  className={`relative rounded-md transition-colors duration-150 flex items-center justify-center aspect-square ${
                    isClear
                      ? 'bg-amber-300 scale-110 shadow-lg shadow-amber-400/50 z-10 transition-transform duration-200'
                      : cell > 0
                      ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 border border-indigo-400/60 shadow-sm shadow-indigo-500/20'
                      : isGhost
                      ? 'bg-indigo-400/40 border border-indigo-300 scale-95 animate-pulse'
                      : isSubgridEven
                      ? 'bg-slate-800/80 border border-slate-700/40'
                      : 'bg-slate-850/60 border border-slate-800/60'
                  }`}
                >
                  {/* Subtle inner bevel for filled blocks */}
                  {cell > 0 && !isClear && (
                    <div className="w-full h-full rounded-[4px] bg-white/10 border-t border-l border-white/20" />
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Tray of 3 pieces */}
      <div className="pb-6 pt-2 px-3 bg-slate-900/40 border-t border-slate-800/60">
        <div className="max-w-md mx-auto grid grid-cols-3 gap-2.5 h-28">
          {trayPieces.map((piece, index) => {
            const isBeingDragged = dragState?.pieceIndex === index;

            return (
              <div
                key={index}
                className="relative rounded-2xl bg-slate-900/80 border border-slate-800/80 flex items-center justify-center overflow-hidden touch-none"
              >
                {piece && !isBeingDragged && (
                  <div
                    onPointerDown={(e) => handlePiecePointerDown(e, piece, index)}
                    className="cursor-grab active:cursor-grabbing p-2 transition-transform hover:scale-105 active:scale-95"
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
                            className={`w-4 h-4 sm:w-5 sm:h-5 rounded-sm transition-all ${
                              val === 1
                                ? `${piece.colorClass} shadow-sm ${piece.glowClass}`
                                : 'opacity-0'
                            }`}
                          />
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating Dragged Piece following finger */}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 border-2 border-indigo-500/40 p-6 text-center shadow-2xl animate-pop">
            <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 p-[2px] shadow-lg shadow-amber-500/20 flex items-center justify-center">
              <Trophy className="w-8 h-8 text-white fill-white/20" />
            </div>

            <h3 className="text-xl font-black text-white">Игра окончена</h3>
            <p className="text-xs text-slate-400 mt-1">Больше нет доступных ходов</p>

            {/* Score presentation */}
            <div className="my-5 p-4 rounded-2xl bg-slate-800/80 border border-slate-700/60">
              <span className="text-xs text-slate-400 uppercase font-semibold">
                Итоговый результат
              </span>
              <p className="text-3xl font-black text-indigo-300 mt-1">{score}</p>

              {isNewRecordAchieved && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-extrabold animate-bounce">
                  <Sparkles className="w-3.5 h-3.5" /> Новый личный рекорд!
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <button
                onClick={handleRestart}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 active:scale-95 transition-all"
              >
                Играть снова
              </button>
              <button
                onClick={closeGame}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 active:scale-95 transition-all"
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
