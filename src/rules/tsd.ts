// «Взять ТСД» (docs/02-gameplay-loop.md, раздел 6; docs/06-minigames.md, разделы 2 и 13).
// По умолчанию задание выполняет сборщик сам. При «Отправить» с шансом выпадает предложение:
// сборщик стоит и ждёт; «Взять ТСД» — начинается личная мини-игра, «Пусть работает» или таймер — работает сам.
import type { GameState } from '../model/game';
import type { WarehouseMap } from '../model/warehouse';
import { TSD } from '../config/balance';
import type { Rng } from './random';
import { createRng } from './random';
import { dispatchTask } from './tasks/lifecycle';

/**
 * Бросок шанса ТСД для только что отправленного сборщика.
 * Предложение одно за раз, и его не бывает, пока идёт мини-игра (06, раздел 13).
 * `chance` — по умолчанию из config; тесты передают 0 или 1, чтобы не зависеть от случайности.
 */
export function rollTsdOffer(state: GameState, taskId: string, rng: Rng, chance?: number): GameState {
  const task = state.tasks[taskId];
  const pickerId = task?.assignedPickerId;
  if (!task || !pickerId || state.tsdOffer || state.minigame) return state;
  if (rng.next() >= (chance ?? TSD.chance[task.type])) return state;

  return {
    ...state,
    tsdOffer: { taskId, pickerId, expiresAt: state.clock.time + TSD.offerSeconds },
    tasks: { ...state.tasks, [taskId]: { ...task, status: 'assigned', mode: null } },
    pickers: { ...state.pickers, [pickerId]: { ...state.pickers[pickerId], state: 'waiting' } },
  };
}

/**
 * «Отправить» целиком: назначить сборщика (как в M4) и бросить шанс ТСД.
 * Это то, что вызывает кнопка «Отправить» в окне «Кого отправить?».
 */
export function sendPicker(state: GameState, map: WarehouseMap, taskId: string, pickerId: string): GameState {
  const dispatched = dispatchTask(state, map, taskId, pickerId);
  if (!TSD.offerOnDispatch) return dispatched; // выключено: ТСД — вариант в развилке (10, раздел 11)
  const rng = createRng(dispatched.rngSeed);
  const next = rollTsdOffer(dispatched, taskId, rng);
  return { ...next, rngSeed: rng.seed() };
}

/** Сколько игровых секунд осталось на ответ. null — предложения нет. */
export function tsdOfferSecondsLeft(state: GameState): number | null {
  return state.tsdOffer ? Math.max(0, state.tsdOffer.expiresAt - state.clock.time) : null;
}

/** «Пусть работает» (или таймер истёк): сборщик идёт выполнять задание сам, как в M4. */
export function declineTsd(state: GameState): GameState {
  const offer = state.tsdOffer;
  if (!offer) return state;
  const task = state.tasks[offer.taskId];
  const picker = state.pickers[offer.pickerId];
  return {
    ...state,
    tsdOffer: null,
    tasks: { ...state.tasks, [task.id]: { ...task, status: 'pickerEnRoute', mode: 'delegated' } },
    pickers: { ...state.pickers, [picker.id]: { ...picker, state: 'walking' } },
  };
}

/**
 * «Взять ТСД»: начинается личная мини-игра «Сборка». Отменить её уже нельзя (06, раздел 13).
 * Сборщик бросает свой маршрут и стоит, пока игрок не выберет стеллаж (rules/minigames/picking.ts).
 * Остальной мир замедлен (advanceWorld).
 */
export function acceptTsd(state: GameState): GameState {
  const offer = state.tsdOffer;
  if (!offer) return state;
  const task = state.tasks[offer.taskId];
  const picker = state.pickers[offer.pickerId];
  return {
    ...state,
    tsdOffer: null,
    minigame: {
      taskId: task.id, pickerId: picker.id, startedAt: state.clock.time, elapsed: 0,
      focus: null, atFocus: false, actions: [], errors: [], lastScan: null,
    },
    tasks: { ...state.tasks, [task.id]: { ...task, status: 'pickerEnRoute', mode: 'personal' } },
    pickers: {
      ...state.pickers,
      [picker.id]: {
        ...picker, state: 'playing', path: [], pathProgress: 0,
        job: { taskId: task.id, steps: [], stepIndex: 0, stepElapsed: 0 }, // шагов нет: ждёт, куда отправит игрок
      },
    },
  };
}

/** Во сколько раз замедлен мир для сборщика: свой сборщик в мини-игре — 1, остальные — TSD.worldSpeedDuringGame. */
export function worldSpeedFor(state: GameState, pickerId: string): number {
  if (state.tsdGame) return state.tsdGame.pickerId === pickerId ? 1 : TSD.worldSpeedDuringGame;
  if (!state.minigame) return 1;
  return state.minigame.pickerId === pickerId ? 1 : TSD.worldSpeedDuringGame;
}

/** Множитель для часов смены и всего остального мира. */
export function worldSpeed(state: GameState): number {
  return state.minigame || state.tsdGame ? TSD.worldSpeedDuringGame : 1;
}
