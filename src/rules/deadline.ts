// Сроки заданий и просрочка (M8b; docs/02, раздел 4; docs/04, раздел 4.1; решения автора 14.10).
// Срок — до какого времени задание надо **взять** (отправить сборщика): взятое задание уже не просрочивается.
// Просрочка: сборка исчезает; приёмка исчезает, и грузовик уезжает с паллетами; выкладка и списание остаются,
// но без награды. Во всех случаях штраф — доля награды деньгами (не ниже 0) и рейтингом.
import type { GameState, ShiftEvent } from '../model/game';
import type { Picker } from '../model/picker';
import type { Task } from '../model/task';
import type { WarehouseMap } from '../model/warehouse';
import { DEADLINE, TIMING } from '../config/balance';
import { buildJob } from './jobs';
import { findPath, zoneAccess } from './warehouse';
import { secondsPerCell } from './time';
import { clampRating } from './rewards';
import { isTutorial, shiftPlan } from './shiftPlan';

/** Эталонный сборщик (скорость 5), стоит у зоны, откуда задание начинается: заказ — у фасовки, остальное — у приёмки. */
function refPicker(state: GameState, map: WarehouseMap, task: Task): Picker | null {
  const any = Object.values(state.pickers)[0];
  if (!any) return null;
  const start = zoneAccess(map, task.type === 'order' ? 'packing' : 'receiving');
  return { ...any, stats: { ...any.stats, speed: TIMING.refSpeed, fatigue: 0 }, position: start, path: [], pathProgress: 0, job: null };
}

/** Сколько эталонный сборщик делал бы задание: вся дорога по клеткам плюс работа на местах. */
export function estimateSeconds(state: GameState, map: WarehouseMap, task: Task): number {
  const p = refPicker(state, map, task);
  if (!p) return 0;
  let at = p.position;
  let sum = 0;
  for (const step of buildJob(map, p, task).steps) {
    if (step.kind === 'walk') {
      const path = findPath(map, at, step.spots[0] ?? step.to) ?? [];
      sum += path.length * secondsPerCell(p);
      at = step.spots[0] ?? step.to;
    } else {
      sum += step.seconds;
    }
  }
  return sum;
}

/** Срок задания: появилось + ожидание + оценка × запас (жёсткий у сборки, мягкий у остальных). */
export function deadlineFor(state: GameState, map: WarehouseMap, task: Task): number {
  const d = task.type === 'order' ? { ...DEADLINE.order, margin: shiftPlan(state).orderMargin } : DEADLINE.soft; // запас сборки — из плана смены (M8d)
  return task.createdAt + d.waitSeconds + estimateSeconds(state, map, task) * d.margin;
}

/** Посчитать сроки новым заданиям, у которых их ещё нет. */
export function assignDeadlines(state: GameState, map: WarehouseMap): GameState {
  let tasks = state.tasks;
  for (const t of Object.values(state.tasks)) {
    if (t.deadline !== null || t.status !== 'new') continue;
    tasks = { ...tasks, [t.id]: { ...t, deadline: deadlineFor(state, map, t) } };
  }
  return tasks === state.tasks ? state : { ...state, tasks };
}

/** Сколько секунд осталось взять задание. null — срока нет: уже взято, уже просрочено (осталось) или ещё не посчитан. */
export function secondsToTake(state: GameState, task: Task): number | null {
  if (task.status !== 'new' || task.overdue || task.deadline === null) return null;
  return Math.max(0, task.deadline - state.clock.time);
}

/** Штраф за просрочку: доля награды задания (DEADLINE.penalty). Положительные числа — сколько отнимаем. */
export function penaltyFor(task: Task): { money: number; rating: number } {
  return { money: Math.round(task.reward.money * DEADLINE.penalty.money), rating: task.reward.rating * DEADLINE.penalty.rating };
}

/**
 * Просрочить задания, которые не успели взять. Взятые (отправленные сборщику) не просрочиваются (решение автора 14.10).
 * Возвращает новое состояние и события для всплывашек и итогов смены.
 */
export function expireTasks(state: GameState): { state: GameState; events: ShiftEvent[] } {
  const now = state.clock.time;
  let s = state;
  const events: ShiftEvent[] = [];
  for (const t of Object.values(state.tasks)) {
    if (t.status !== 'new' || t.overdue || t.deadline === null || now < t.deadline) continue;
    const pen = isTutorial(s) ? { money: 0, rating: 0 } : penaltyFor(t); // обучающая смена — без штрафов (M8d)
    const money = Math.min(s.money, pen.money); // деньги не уходят ниже 0
    const kept = t.type === 'putaway' || t.type === 'writeoff';
    const tasks = { ...s.tasks, [t.id]: kept ? { ...t, overdue: true } : { ...t, status: 'expired' as const } } as GameState['tasks'];
    let { deliveries, pallets } = s;
    if (t.type === 'receiving') {
      // грузовик уезжает вместе с непринятыми паллетами — поставка потеряна (решение автора 14.10)
      const d = s.deliveries[t.payload.deliveryId];
      if (d) {
        deliveries = { ...deliveries };
        pallets = { ...pallets };
        for (const id of d.palletIds) delete pallets[id];
        delete deliveries[d.id];
      }
    }
    s = { ...s, tasks, deliveries, pallets, money: s.money - money, rating: clampRating(s.rating - pen.rating) };
    events.push({ kind: 'taskExpired', taskId: t.id, at: now, money, rating: pen.rating, kept });
  }
  return { state: s, events };
}
