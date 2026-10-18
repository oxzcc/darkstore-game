// Исходы заданий (09, раздел 5.1). outcomeChances — ЕДИНСТВЕННОЕ место, где считаются шансы:
// карточка сборщика в интерфейсе показывает ровно те шансы, по которым потом бросается исход.
import type { Picker } from '../model/picker';
import type { Outcome, OutcomeChances, Task } from '../model/task';
import { PICKER_GROWTH } from '../config/balance';
import { effectiveAccuracy, fatiguePenalty, specBonus } from './pickerStats';
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

/** Из чего сложился шанс «идеально»: каждое слагаемое — доля 0…1 (со знаком). Сумма частей = outcomeChances().perfect. */
export type ChancePart =
  | { kind: 'base'; value: number }                      // база
  | { kind: 'accuracy'; points: number; value: number }  // Нюх (точность)
  | { kind: 'spec'; level: number; value: number }       // опыт по типу задания
  | { kind: 'fatigue'; fatigue: number; value: number }  // усталость
  | { kind: 'difficulty'; difficulty: number; value: number } // сложность задания
  | { kind: 'limit'; value: number };                    // упёрлись в предел шкалы или шансов

export type OutcomeBreakdown = { chances: OutcomeChances; parts: ChancePart[] };

/**
 * Шансы и их раскладка для окна назначения («Почему такие шансы?»).
 * Считается по тем же числам, что outcomeChances; части складываются ровно в шанс «идеально».
 */
export function outcomeBreakdown(picker: Picker, task: Task): OutcomeBreakdown {
  const c = PICKER_GROWTH.chances;
  const chances = outcomeChances(picker, task);
  const spec = specBonus(picker, task.type);
  const tired = fatiguePenalty(picker);
  const harder = Math.max(0, task.difficulty - 1);
  const parts: ChancePart[] = [
    { kind: 'base', value: c.base },
    { kind: 'accuracy', points: picker.stats.accuracy, value: c.perPoint * picker.stats.accuracy },
    { kind: 'spec', level: picker.specialization[task.type]?.level ?? 1, value: c.perPoint * spec },
    { kind: 'fatigue', fatigue: picker.stats.fatigue, value: -c.perPoint * tired },
  ];
  if (harder > 0) parts.push({ kind: 'difficulty', difficulty: task.difficulty, value: -c.perDifficulty.perfect * harder });
  // всё, что срезали пределы (шкала 1–10 у рабочей точности, maxPerfect и 0 у шанса), — отдельной строкой
  const sum = parts.reduce((s, x) => s + x.value, 0);
  const limit = chances.perfect - sum;
  if (Math.abs(limit) > 1e-9) parts.push({ kind: 'limit', value: limit });
  return { chances, parts };
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
