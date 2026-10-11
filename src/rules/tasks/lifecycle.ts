// Жизненный цикл задания (04, раздел 3): назначение и завершение.
// В M3 поручённое задание завершается сразу случайным исходом: ходьбы и времени ещё нет (появятся в M4).
import type { GameState, ShiftEvent } from '../../model/game';
import { createRng } from '../random';
import { outcomeChances, rollOutcome } from '../outcome';
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
 * M3: исход сразу бросается по outcomeChances, сборщик снова свободен, очередь заказов дополняется.
 * Деньги, рейтинг и остатки от исхода пока не меняются — это M6.
 */
export function dispatchTask(
  state: GameState,
  taskId: string,
  pickerId: string,
  now: number,
): { state: GameState; event: ShiftEvent } {
  const check = canAssign(state, taskId, pickerId);
  if (!check.ok) throw new Error(check.reason);

  const rng = createRng(state.rngSeed);
  const task = state.tasks[taskId];
  const picker = state.pickers[pickerId];
  const outcome = rollOutcome(outcomeChances(picker, task), rng);

  const event: ShiftEvent = { kind: 'taskDone', taskId, pickerId, outcome };
  let next: GameState = {
    ...state,
    tasks: {
      ...state.tasks,
      [taskId]: { ...task, status: 'done', assignedPickerId: pickerId, mode: 'delegated', outcome },
    },
    shiftLog: [...state.shiftLog, event],
  };
  next = topUpOrders(next, rng, now);
  return { state: { ...next, rngSeed: rng.seed() }, event };
}
