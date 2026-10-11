// Исходы заданий (09, раздел 5.1). outcomeChances — ЕДИНСТВЕННОЕ место, где считаются шансы:
// карточка сборщика в интерфейсе показывает ровно те шансы, по которым потом бросается исход.
import type { Picker } from '../model/picker';
import type { Outcome, OutcomeChances, Task } from '../model/task';
import { PLACEHOLDER_CHANCES } from '../config/balance';
import type { Rng } from './random';

export const OUTCOMES: Outcome[] = ['perfect', 'withErrors', 'failed'];

/**
 * Шансы трёх исходов, если поручить задание сборщику.
 * Пока временные и одинаковые для всех (config/balance.ts); формула — ОТКРЫТО (05, раздел 4).
 * Параметры уже принимаются, чтобы при появлении формулы не менять места вызова.
 */
export function outcomeChances(_picker: Picker, _task: Task): OutcomeChances {
  return { ...PLACEHOLDER_CHANCES };
}

/** Бросок исхода по шансам. */
export function rollOutcome(chances: OutcomeChances, rng: Rng): Outcome {
  const r = rng.next();
  let acc = 0;
  for (const o of OUTCOMES) {
    acc += chances[o];
    if (r < acc) return o;
  }
  return 'failed'; // на случай погрешности округления
}
