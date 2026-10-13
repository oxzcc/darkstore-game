// Игра на ТСД из развилки (docs/10-minigames-concept.md, раздел 11; решение автора 14.10).
// Игрок выбрал «Взять ТСД» — сборщик стоит у полки, камера у стеллажа, мир идёт ×0,5 (rules/tsd.ts: worldSpeed).
// Игра закончилась — итог записывается в задание как ответ на развилку, и сборщик дособирает заказ сам.
import type { GameState } from '../model/game';
import type { DepthGame } from '../model/tsdGame';
import type { CallAnswer } from '../model/call';
import { DEPTH, TSD_OPTION_ID } from '../config/calls';
import { createRng } from './random';
import { createDepthBoard, freeNeighbours, scoreDepth, slideBox, targetAtExit, targetCell, tooManyMoves, rowOf } from './minigames/depth';

/** Начать игру по вызову: вызов уходит, сборщик «играете за него». null-ход (state без изменений) — нельзя. */
export function startTsdGame(state: GameState, callId: string): GameState {
  const call = state.calls.find((c) => c.id === callId);
  if (!call || call.expiresAt === null || call.tsd !== 'depth' || state.tsdGame || state.minigame) return state;
  const task = state.tasks[call.taskId];
  const picker = state.pickers[call.pickerId];
  if (task?.type !== 'order' || !picker?.job) return state;
  const line = task.payload.lines[call.lineIndex];
  if (!line) return state;

  const rng = createRng(state.rngSeed);
  const fillers = Object.keys(state.products).filter((id) => id !== line.productId);
  const { board, best } = createDepthBoard(rng, line.productId, fillers);
  const game: DepthGame = {
    kind: 'depth',
    callId: call.id,
    taskId: task.id,
    pickerId: picker.id,
    situationId: call.situationId,
    lineIndex: call.lineIndex,
    address: line.address,
    rack: { aisle: line.address.aisle, rack: line.address.rack },
    elapsed: 0,
    timeLimit: DEPTH.timeLimit,
    board,
    best,
    moves: 0,
    note: null,
    noteAt: 0,
    result: null,
  };
  return {
    ...state,
    rngSeed: rng.seed(),
    tsdGame: game,
    calls: state.calls.filter((c) => c.id !== callId),
    pickers: { ...state.pickers, [picker.id]: { ...picker, state: 'playing' } },
  };
}

const withNote = (state: GameState, g: DepthGame, n: DepthGame['note'], patch: Partial<DepthGame> = {}): GameState =>
  ({ ...state, tsdGame: { ...g, ...patch, note: n, noteAt: g.elapsed } });

/** Куда можно сдвинуть коробку из клетки (сцена подсвечивает эти клетки после выбора коробки). */
export function depthMovesFrom(state: GameState, cell: number): number[] {
  const g = state.tsdGame;
  if (!g || g.kind !== 'depth' || g.result) return [];
  return freeNeighbours(g.board, cell);
}

/** Клик по коробке — только выбор (его хранит интерфейс); если сдвинуть некуда, ТСД об этом скажет. */
export function tapDepthBox(state: GameState, cell: number): GameState {
  const g = state.tsdGame;
  if (!g || g.kind !== 'depth' || g.result || g.board.cells[cell] === undefined || g.board.cells[cell] < 0) return state;
  if (freeNeighbours(g.board, cell).length === 0) return withNote(state, g, 'stuck');
  return state;
}

/**
 * Ход: коробка из `from` в соседнюю пустую `to`. Нужная встала на выход — игра закончена сразу, исход по ходам;
 * ходов больше, чем допускает «с ошибками», — сразу провал (решения автора 14.10).
 */
export function moveDepthBox(state: GameState, from: number, to: number): GameState {
  const g = state.tsdGame;
  if (!g || g.kind !== 'depth' || g.result) return state;
  const board = slideBox(g.board, from, to);
  if (!board) return state;
  const moves = g.moves + 1;
  if (targetAtExit(board)) return withNote(state, g, 'taken', { board, moves, result: scoreDepth(moves, g.best, false) });
  if (tooManyMoves(moves, g.best)) return withNote(state, g, 'tooMany', { board, moves, result: 'failed' });
  return withNote(state, g, 'moved', { board, moves });
}

/** Время игры идёт в обычном темпе; вышло — провал. */
export function tickTsdGame(state: GameState, dt: number): GameState {
  const g = state.tsdGame;
  if (!g || g.result) return state;
  const elapsed = g.elapsed + dt;
  if (elapsed >= g.timeLimit) {
    return { ...state, tsdGame: { ...g, elapsed: g.timeLimit, result: 'failed', note: 'timeout', noteAt: g.timeLimit } };
  }
  return { ...state, tsdGame: { ...g, elapsed } };
}

/** «К складу»: итог игры — ответ на развилку в задании, сборщик работает дальше, камера возвращается. */
export function closeTsdGame(state: GameState): GameState {
  const g = state.tsdGame;
  if (!g || !g.result) return state;
  const task = state.tasks[g.taskId];
  const picker = state.pickers[g.pickerId];
  const answer: CallAnswer = {
    situationId: g.situationId,
    lineIndex: g.lineIndex,
    optionId: TSD_OPTION_ID,
    risk: 'low', // у игры риска нет — исход решает итог (10, раздел 11.4)
    auto: false,
    tsd: g.result,
  };
  const step = picker?.job?.steps[picker.job.stepIndex];
  return {
    ...state,
    tsdGame: null,
    tasks: task ? { ...state.tasks, [task.id]: { ...task, callLog: [...(task.callLog ?? []), answer] } } : state.tasks,
    pickers: picker
      ? { ...state.pickers, [picker.id]: { ...picker, state: step?.kind === 'walk' ? 'walking' : 'working' } }
      : state.pickers,
  };
}

/** Для экрана: в каком ряду нужная коробка (0 — передний). */
export function depthTargetRow(g: DepthGame): number {
  return rowOf(g.board, targetCell(g.board));
}
