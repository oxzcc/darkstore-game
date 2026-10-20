// Характеристики сборщика в работе (docs/10, раздел 14; решения автора 20.10).
// Рабочая характеристика = своя − штраф за усталость. Опыта по типам заданий нет: опыт копит сборщик, уровень даёт очко.
// Отсюда считаются шансы исходов (outcome.ts) и время работы (time.ts) — в одном месте, чтобы окно и бросок совпадали.
import { STAT_KEYS, type Picker, type PickerTally, type StatBlock, type StatKey } from '../model/picker';
import type { Outcome } from '../model/task';
import { PICKER_GROWTH } from '../config/balance';
import { STAT_SCALE } from '../config/pickers';

const clampStat = (v: number) => Math.min(STAT_SCALE.max, Math.max(STAT_SCALE.min, v));

/** Штраф за усталость: от 0 (свежий) до maxPenalty (100%) — ко всем пяти характеристикам. */
export function fatiguePenalty(picker: Picker): number {
  return (Math.min(100, Math.max(0, picker.stats.fatigue)) / 100) * PICKER_GROWTH.fatigue.maxPenalty;
}

/** Рабочая характеристика: своя − усталость, в границах шкалы. */
export function effectiveStat(picker: Picker, key: StatKey): number {
  return clampStat(picker.stats[key] - fatiguePenalty(picker));
}

/** Все пять рабочих характеристик (для шансов и пятиугольника). */
export function effectiveStats(picker: Picker): StatBlock {
  return Object.fromEntries(STAT_KEYS.map((k) => [k, effectiveStat(picker, k)])) as StatBlock;
}

/** Рабочий Нюх (точность) — для развилок (до X2 они опираются на него). */
export function effectiveAccuracy(picker: Picker): number {
  return effectiveStat(picker, 'accuracy');
}

/** Рабочие Лапы (скорость): время ходьбы и работы. */
export function effectiveSpeed(picker: Picker): number {
  return effectiveStat(picker, 'speed');
}

/** Сколько опыта до следующего уровня. */
export function xpToNext(level: number): number {
  return PICKER_GROWTH.xpToNext * level;
}

/**
 * Задание закрыто: опыт сборщику (зависит от исхода) и усталость. Новый уровень — +pointsPerLevel очков
 * (вкладывает игрок на экране итогов смены, docs/10, раздел 14.8).
 */
export function growAfterTask(picker: Picker, outcome: Outcome): Picker {
  let level = picker.level;
  let xp = picker.xp + PICKER_GROWTH.xp[outcome];
  let points = picker.points;
  while (xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level++;
    points += PICKER_GROWTH.pointsPerLevel;
  }
  return {
    ...picker,
    level, xp, points,
    stats: { ...picker.stats, fatigue: Math.min(100, picker.stats.fatigue + PICKER_GROWTH.fatigue.perTask) },
  };
}

/** Можно ли вложить очко в характеристику: есть очки и не упёрлись в потолок шкалы. */
export function canSpendPoint(picker: Picker, key: StatKey): boolean {
  return picker.points > 0 && picker.stats[key] < STAT_SCALE.max;
}

/** Вложить очко: +1 к характеристике (только на экране итогов смены — это проверяет вызывающий). */
export function spendPoint(picker: Picker, key: StatKey): Picker {
  if (!canSpendPoint(picker, key)) return picker;
  return { ...picker, points: picker.points - 1, stats: { ...picker.stats, [key]: picker.stats[key] + 1 } };
}

export const EMPTY_TALLY: PickerTally = { done: 0, perfect: 0, withErrors: 0, failed: 0 };

/** Закрытое задание в итоги сборщика за кампанию (профиль, P2). */
export function countOutcome(picker: Picker, outcome: Outcome): Picker {
  const t = picker.tally ?? EMPTY_TALLY;
  return { ...picker, tally: { ...t, done: t.done + 1, [outcome]: t[outcome] + 1 } };
}

/** Итоги за текущую смену — по журналу смены (события «задание закрыто» этого сборщика). */
export function shiftTally(log: { kind: string; pickerId?: string; outcome?: Outcome }[], pickerId: string): PickerTally {
  const t = { ...EMPTY_TALLY };
  for (const e of log) {
    if (e.kind !== 'taskDone' || e.pickerId !== pickerId || !e.outcome) continue;
    t.done++;
    t[e.outcome]++;
  }
  return t;
}

/** Перерыв: усталость падает на restPerSecond % в секунду, не ниже 0. */
export function restFor(picker: Picker, dt: number): Picker {
  const fatigue = Math.max(0, picker.stats.fatigue - PICKER_GROWTH.fatigue.restPerSecond * dt);
  return { ...picker, stats: { ...picker.stats, fatigue } };
}

/** Между сменами усталость падает (betweenShifts — какая доля остаётся). */
export function restBetweenShifts(picker: Picker): Picker {
  return { ...picker, stats: { ...picker.stats, fatigue: picker.stats.fatigue * PICKER_GROWTH.fatigue.betweenShifts } };
}

/** Уровни всех сборщиков — запоминаются в начале смены, чтобы в итогах показать рост. */
export function levelsOf(pickers: Record<string, Picker>): Record<string, number> {
  return Object.fromEntries(Object.values(pickers).map((p) => [p.id, p.level]));
}
