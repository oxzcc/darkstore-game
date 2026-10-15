// Темп заданий и план смен (M8d; docs/02, раздел 3; docs/04, раздел 6; решения автора 15.10).
// Заказы приходят под загрузку: пока «занятые сборщики + открытые задания» меньше, чем «сборщики × загрузка смены»,
// приходит новый заказ (не чаще ORDER.minGapSeconds). Выкладки и списания тоже входят в нагрузку.
// Поставки — по своему таймеру (это и есть «приёмка редко»), с интервалом из плана смены.
import type { GameState } from '../model/game';
import type { TaskType } from '../model/task';
import { ORDER } from '../config/balance';
import { shiftPlan } from './shiftPlan';
import type { Rng } from './random';
import { createRng } from './random';
import { createOrder } from './tasks/generator';

export { isTutorial, shiftPlan } from './shiftPlan';

/** Сколько «работы» сейчас: сборщики с заданием (не на перерыве) + задания, которые ещё никто не взял. */
export function workload(state: GameState): number {
  const busy = Object.values(state.pickers).filter((p) => p.taskId !== null).length;
  const open = Object.values(state.tasks).filter((t) => t.status === 'new').length;
  return busy + open;
}

/** Сколько «работы» хочет смена: сборщики × целевая загрузка. */
export function targetLoad(state: GameState): number {
  return Object.keys(state.pickers).length * shiftPlan(state).load;
}

/** Нужен ли ещё один заказ, чтобы сборщики были заняты впритык (без учёта паузы между заказами). */
export function wantsOrder(state: GameState): boolean {
  return workload(state) < targetLoad(state);
}

/**
 * Начало смены: сразу набрать заказы под загрузку (без пауз между ними), дальше — по одному.
 * Свободного товара нет — заказов меньше (createOrder вернёт null).
 */
export function fillOrders(state: GameState, rng: Rng, now: number): GameState {
  let s = state;
  while (wantsOrder(s)) {
    const made = createOrder(s, rng, now);
    if (!made) break;
    s = made.state;
  }
  return { ...s, nextOrderAt: now + ORDER.minGapSeconds };
}

/** Шаг мира: пришло время и сборщикам мало работы — новый заказ. */
export function tickOrders(state: GameState): GameState {
  const now = state.clock.time;
  if (now < state.nextOrderAt || !wantsOrder(state)) return state;
  const rng = createRng(state.rngSeed);
  const made = createOrder(state, rng, now);
  if (!made) return state;
  return { ...made.state, rngSeed: rng.seed(), nextOrderAt: now + ORDER.minGapSeconds };
}

/**
 * Шанс развилки для этого задания: из плана смены; в обучающей смене первая развилка каждого типа задания
 * гарантирована (решение автора 15.10), и в ней по возможности выпадает ситуация с игрой на ТСД.
 */
export function forkPlanFor(state: GameState, type: TaskType): { chance: number; guaranteed: boolean } {
  const plan = shiftPlan(state);
  const guaranteed = plan.tutorial && !(state.campaign.tutorialForks ?? []).includes(type);
  return { chance: guaranteed ? 1 : plan.forkChance, guaranteed };
}
