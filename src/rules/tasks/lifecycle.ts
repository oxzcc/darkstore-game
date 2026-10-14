// Жизненный цикл задания (04, раздел 3): назначение. Дальше задание живёт в advanceWorld:
// сборщик идёт, работает, и только по окончании работы бросается исход (rules/advance.ts).
import type { GameState } from '../../model/game';
import type { WarehouseMap } from '../../model/warehouse';
import { createRng } from '../random';
import { buildJob, canBuildJob } from '../jobs';
import { planCall } from '../calls';
import { topUpOrders } from './generator';

export type AssignCheck = { ok: true } | { ok: false; reason: string };

/** Можно ли назначить сборщика на задание. Причина отказа — для подсказки игроку. */
export function canAssign(state: GameState, taskId: string, pickerId: string): AssignCheck {
  const task = state.tasks[taskId];
  const picker = state.pickers[pickerId];
  if (!task) return { ok: false, reason: 'Задание не найдено' };
  if (!picker) return { ok: false, reason: 'Сборщик не найден' };
  if (task.status !== 'new') return { ok: false, reason: 'Задание уже назначено' };
  if (picker.state !== 'idle') return { ok: false, reason: `${picker.name} занят` };
  return { ok: true };
}

/**
 * «Отправить»: назначить сборщика и поручить ему задание.
 * Назначение окончательное — отменить или передать нельзя (02, раздел 5).
 * Сборщик получает маршрут и сразу начинает идти; очередь заказов дополняется.
 * Дойдя, сборщик работает сам; с шансом по пути случится развилка (N1).
 */
export function dispatchTask(state: GameState, map: WarehouseMap, taskId: string, pickerId: string): GameState {
  const check = canAssign(state, taskId, pickerId);
  if (!check.ok) throw new Error(check.reason);
  const task = state.tasks[taskId];
  if (!canBuildJob(task)) throw new Error(`Задания «${task.type}» пока не поддерживаются`);
  const picker = state.pickers[pickerId];
  // развилка планируется сразу при отправке (10, раздел 3); при «Взять ТСД» работа заменится и развилки не будет
  const callRng = createRng(state.rngSeed);
  const job = planCall(buildJob(map, picker, task), task, callRng); // развилки пока только у сборки (у приёмки — M7d)

  let next: GameState = {
    ...state,
    rngSeed: callRng.seed(),
    tasks: {
      ...state.tasks,
      [taskId]: { ...task, status: 'pickerEnRoute', assignedPickerId: pickerId, mode: 'delegated' },
    },
    pickers: {
      ...state.pickers,
      [pickerId]: {
        ...picker,
        state: 'walking',
        taskId,
        job,
        path: [],
        pathProgress: 0,
      },
    },
  };
  const rng = createRng(next.rngSeed);
  next = topUpOrders(next, rng, state.clock.time);
  return { ...next, rngSeed: rng.seed() };
}
