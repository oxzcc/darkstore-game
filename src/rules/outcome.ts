// Исходы заданий (09, раздел 5.1). outcomeChances — ЕДИНСТВЕННОЕ место, где считаются шансы:
// карточка сборщика в интерфейсе показывает ровно те шансы, по которым потом бросается исход.
import type { Picker } from '../model/picker';
import type { Outcome, OutcomeChances, Task } from '../model/task';
import { PICKER_GROWTH } from '../config/balance';
import { effectiveAccuracy } from './pickerStats';
import type { Rng } from './random';

export const OUTCOMES: Outcome[] = ['perfect', 'withErrors', 'failed'];

/**
 * Шансы трёх исходов, если поручить задание сборщику (M8c; формула утверждена автором 15.10).
 * От рабочей точности (характеристика + специализация − усталость) и сложности задания (PICKER_GROWTH.chances).
 */
export function outcomeChances(picker: Picker, task: Task): OutcomeChances {
  const c = PICKER_GROWTH.chances;
  const acc = effectiveAccuracy(picker, task.type);
  const harder = Math.max(0, task.difficulty - 1);
  const perfect = Math.min(c.maxPerfect, Math.max(0, c.base + c.perPoint * acc - c.perDifficulty.perfect * harder));
  const failed = Math.min(1 - perfect, Math.max(c.minFail, c.failBase - c.failPerPoint * acc + c.perDifficulty.failed * harder));
  return { perfect, withErrors: Math.max(0, 1 - perfect - failed), failed };
}

/** Бросок исхода по шансам. */
export function rollOutcome(chances: OutcomeChances, rng: Rng): Outcome {
  return outcomeAt(chances, rng.next());
}

/** Исход по числу 0…1: зоны «идеально / с ошибками / провал» идут подряд по ширине шансов. Это же — место маркера в окне результата. */
export function outcomeAt(chances: OutcomeChances, r: number): Outcome {
  let acc = 0;
  for (const o of OUTCOMES) {
    acc += chances[o];
    if (r < acc) return o;
  }
  return 'failed'; // на случай погрешности округления
}
