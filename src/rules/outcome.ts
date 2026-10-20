// Исходы заданий (09, раздел 5.1; docs/10, раздел 14.5). outcomeChances — ЕДИНСТВЕННОЕ место, где считаются шансы:
// окно назначения показывает ровно те шансы, по которым потом бросается исход (подпорки — скрытые, guard.ts).
import { STAT_KEYS, type Picker, type StatBlock, type StatKey } from '../model/picker';
import type { Outcome, OutcomeChances, Task } from '../model/task';
import { COVERAGE_CHANCES } from '../config/balance';
import { effectiveStats } from './pickerStats';
import { taskRequirements } from './requirements';
import type { Rng } from './random';

export const OUTCOMES: Outcome[] = ['perfect', 'withErrors', 'failed'];

/** Покрытие требований: сумма min(есть, нужно) / сумма нужно. Запас сверх нужного ничего не даёт. Ничего не нужно — 1. */
export function coverage(stats: StatBlock, req: StatBlock): number {
  let need = 0;
  let got = 0;
  for (const k of STAT_KEYS) { need += req[k]; got += Math.min(stats[k], req[k]); }
  return need > 0 ? got / need : 1;
}

/** Шансы трёх исходов по покрытию: между точками COVERAGE_CHANCES — по прямой. */
export function chancesForCoverage(c: number): OutcomeChances {
  const t = COVERAGE_CHANCES;
  if (c <= t[0].coverage) return pick(t[0]);
  for (let i = 1; i < t.length; i++) {
    if (c <= t[i].coverage) {
      const a = t[i - 1];
      const b = t[i];
      const k = (c - a.coverage) / (b.coverage - a.coverage);
      const perfect = a.perfect + (b.perfect - a.perfect) * k;
      const failed = a.failed + (b.failed - a.failed) * k;
      return { perfect, withErrors: Math.max(0, 1 - perfect - failed), failed };
    }
  }
  return pick(t[t.length - 1]);
}
const pick = (p: OutcomeChances): OutcomeChances => ({ perfect: p.perfect, withErrors: p.withErrors, failed: p.failed });

/** Шансы трёх исходов, если поручить задание сборщику: рабочие характеристики (− усталость) против требований задания. */
export function outcomeChances(picker: Picker, task: Task): OutcomeChances {
  return chancesForCoverage(coverage(effectiveStats(picker), taskRequirements(task)));
}

/** Строка раскладки для «Почему такие шансы?»: характеристика, сколько есть (с усталостью), сколько нужно. */
export type StatNeed = { stat: StatKey; have: number; need: number };

export type OutcomeBreakdown = { chances: OutcomeChances; coverage: number; needs: StatNeed[]; fatigue: number };

/** Шансы и их раскладка для окна назначения: только нужные заданию характеристики. */
export function outcomeBreakdown(picker: Picker, task: Task): OutcomeBreakdown {
  const have = effectiveStats(picker);
  const req = taskRequirements(task);
  const cov = coverage(have, req);
  return {
    chances: chancesForCoverage(cov),
    coverage: cov,
    needs: STAT_KEYS.filter((k) => req[k] > 0).map((k) => ({ stat: k, have: have[k], need: req[k] })),
    fatigue: picker.stats.fatigue,
  };
}

/** Бросок исхода по шансам (честный, без подпорок; с подпорками — guard.ts). */
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
