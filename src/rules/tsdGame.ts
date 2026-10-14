// Игра на ТСД из развилки (docs/10-minigames-concept.md, раздел 11; решение автора 14.10).
// Игрок выбрал «Взять ТСД» — сборщик стоит у полки, камера у стеллажа, мир идёт ×0,5 (rules/tsd.ts: worldSpeed).
// Игра закончилась — итог записывается в задание как ответ на развилку, и сборщик доделывает задание сам (сборку или выкладку).
import type { GameState } from '../model/game';
import type { BarcodeGame, DepthGame, ExpiryGame, TsdGame } from '../model/tsdGame';
import type { CallAnswer } from '../model/call';
import { BARCODE, DEPTH, EXPIRY, TSD_OPTION_ID } from '../config/calls';
import { createRng } from './random';
import { taskLines } from './taskLines';
import { createExpiryUnits, scoreExpiry } from './minigames/expiry';
import { createBarcode, hiddenDigits, markGuess, scoreBarcode } from './minigames/barcode';
import { createDepthBoard, freeNeighbours, scoreDepth, slideBox, targetAtExit, targetCell, tooManyMoves, rowOf } from './minigames/depth';

/** Начать игру по вызову: вызов уходит, сборщик «играете за него». Нельзя — state без изменений. */
export function startTsdGame(state: GameState, callId: string): GameState {
  const call = state.calls.find((c) => c.id === callId);
  if (!call || call.expiresAt === null || !call.tsd || state.tsdGame || state.minigame) return state;
  const task = state.tasks[call.taskId];
  const picker = state.pickers[call.pickerId];
  // игра у полки: сборка и выкладка (M7d2); у приёмки полки нет — там ТСД-игр нет (решение автора 14.10)
  if (!task || !picker?.job) return state;
  const line = taskLines(state, task)[call.lineIndex];
  if (!line?.address) return state;
  const address = line.address;

  const rng = createRng(state.rngSeed);
  const common = {
    callId: call.id,
    taskId: task.id,
    pickerId: picker.id,
    situationId: call.situationId,
    lineIndex: call.lineIndex,
    address,
    rack: { aisle: address.aisle, rack: address.rack },
    elapsed: 0,
    noteAt: 0,
    result: null,
  };
  let game: TsdGame;
  if (call.tsd === 'depth') {
    const fillers = Object.keys(state.products).filter((id) => id !== line.productId);
    const { board, best } = createDepthBoard(rng, line.productId, fillers);
    game = { ...common, kind: 'depth', timeLimit: DEPTH.timeLimit, board, best, moves: 0, note: null };
  } else if (call.tsd === 'expiry') {
    const mode = task.type === 'writeoff' ? 'expired' : 'fresh'; // списание: найти просроченную (M7e2)
    const expired = mode === 'expired';
    game = { ...common, kind: 'expiry', productId: line.productId, need: EXPIRY.need, mode,
      timeLimit: expired ? EXPIRY.expiredTimeLimit : EXPIRY.timeLimit,
      perfectSeconds: expired ? EXPIRY.expiredPerfectSeconds : EXPIRY.perfectSeconds,
      units: createExpiryUnits(rng, EXPIRY, mode), open: null, taken: null, note: null };
  } else if (call.tsd === 'barcode') {
    const { code, side } = createBarcode(rng);
    game = { ...common, kind: 'barcode', timeLimit: BARCODE.timeLimit, startDelay: BARCODE.introSeconds, productId: line.productId,
      code, side, hiddenFrom: BARCODE.hiddenFrom, hiddenCount: BARCODE.hiddenCount, attempts: BARCODE.attempts,
      perfectWithin: BARCODE.perfectWithin, guesses: [], note: null };
  } else {
    return state;
  }
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

// ---------- «Срок» ----------

/** Поднять штуку крупно (её крутят и читают этикетку). Посмотренные помечаются. */
export function openExpiryUnit(state: GameState, index: number): GameState {
  const g = state.tsdGame;
  if (!g || g.kind !== 'expiry' || g.result || !g.units[index]) return state;
  const units = g.units.map((u, i) => (i === index ? { ...u, seen: true } : u));
  return { ...state, tsdGame: { ...g, units, open: index } };
}

/** «Положить обратно». */
export function closeExpiryUnit(state: GameState): GameState {
  const g = state.tsdGame;
  if (!g || g.kind !== 'expiry' || g.result || g.open === null) return state;
  return { ...state, tsdGame: { ...g, open: null } };
}

/** «Взять» поднятую штуку — игра закончена: не тот срок — провал, подходящий — по времени. */
export function takeExpiryUnit(state: GameState): GameState {
  const g = state.tsdGame;
  if (!g || g.kind !== 'expiry' || g.result || g.open === null) return state;
  const unit = g.units[g.open];
  const result = scoreExpiry(unit.days, g.need, g.elapsed, false, { ...EXPIRY, perfectSeconds: g.perfectSeconds ?? EXPIRY.perfectSeconds }, g.mode ?? 'fresh');
  const next: ExpiryGame = { ...g, taken: g.open, result, note: 'taken', noteAt: g.elapsed };
  return { ...state, tsdGame: next };
}

// ---------- «Штрихкод» ----------

/** Вступление (подлёт, подъём, поворот) закончилось — можно вводить. */
export const barcodeReady = (g: BarcodeGame) => g.elapsed >= g.startDelay;

/**
 * Попытка: стёртые цифры, которые ввёл игрок. Все на месте — угадано (исход по числу попыток);
 * попытки кончились — провал. Неполная попытка или вступление ещё идёт — не принимается.
 */
export function submitBarcodeGuess(state: GameState, digits: number[]): GameState {
  const g = state.tsdGame;
  if (!g || g.kind !== 'barcode' || g.result || !barcodeReady(g)) return state;
  if (digits.length !== g.hiddenCount || digits.some((d) => !Number.isInteger(d) || d < 0 || d > 9)) return state;
  const marks = markGuess(hiddenDigits(g.code, g.hiddenFrom, g.hiddenCount), digits);
  const guesses = [...g.guesses, { digits: [...digits], marks }];
  const tries = guesses.length;
  let next: BarcodeGame = { ...g, guesses };
  if (marks.every((m) => m === 'hit')) next = { ...next, result: scoreBarcode(tries, g.perfectWithin), note: 'solved', noteAt: g.elapsed };
  else if (tries >= g.attempts) next = { ...next, result: 'failed', note: 'outOfTries', noteAt: g.elapsed };
  return { ...state, tsdGame: next };
}

/** Время игры идёт в обычном темпе; вышло — провал. */
export function tickTsdGame(state: GameState, dt: number): GameState {
  const g = state.tsdGame;
  if (!g || g.result) return state;
  const elapsed = g.elapsed + dt;
  const limit = g.timeLimit + (g.kind === 'barcode' ? g.startDelay : 0); // у «Штрихкода» вступление не считается
  if (elapsed >= limit) {
    const done = { elapsed: limit, result: 'failed' as const, note: 'timeout' as const, noteAt: limit };
    if (g.kind === 'depth') return { ...state, tsdGame: { ...g, ...done } };
    if (g.kind === 'expiry') return { ...state, tsdGame: { ...g, ...done, open: null } };
    return { ...state, tsdGame: { ...g, ...done } };
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
