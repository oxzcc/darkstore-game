// Характеристики сборщика в работе (M8c; docs/05, разделы 4–6; решения автора 15.10).
// Рабочая точность и скорость = характеристика + бонус специализации по типу задания − штраф за усталость.
// Отсюда считаются шансы исходов (outcome.ts) и время работы (time.ts) — в одном месте, чтобы карточка и бросок совпадали.
import type { Picker } from '../model/picker';
import type { Outcome, TaskType } from '../model/task';
import { PICKER_GROWTH } from '../config/balance';
import { STAT_SCALE } from '../config/pickers';

const clampStat = (v: number) => Math.min(STAT_SCALE.max, Math.max(STAT_SCALE.min, v));

/** Бонус специализации по типу задания: 0 на первом уровне, дальше +bonusPerLevel за уровень. */
export function specBonus(picker: Picker, type: TaskType | undefined): number {
  if (!type) return 0;
  const level = picker.specialization[type]?.level ?? 1;
  return (level - 1) * PICKER_GROWTH.spec.bonusPerLevel;
}

/** Штраф за усталость: от 0 (свежий) до maxPenalty (100%). */
export function fatiguePenalty(picker: Picker): number {
  return (Math.min(100, Math.max(0, picker.stats.fatigue)) / 100) * PICKER_GROWTH.fatigue.maxPenalty;
}

/** Рабочая точность на задании этого типа. */
export function effectiveAccuracy(picker: Picker, type?: TaskType): number {
  return clampStat(picker.stats.accuracy + specBonus(picker, type) - fatiguePenalty(picker));
}

/** Рабочая скорость на задании этого типа (без типа — только усталость: так считается ходьба). */
export function effectiveSpeed(picker: Picker, type?: TaskType): number {
  return clampStat(picker.stats.speed + specBonus(picker, type) - fatiguePenalty(picker));
}

/** Сколько опыта до следующего уровня специализации. */
export function xpToNext(level: number): number {
  return PICKER_GROWTH.spec.xpToNext * level;
}

/**
 * Задание закрыто: опыт в специализации по его типу (зависит от исхода) и усталость.
 * Уровень растёт, пока хватает опыта, но не выше maxLevel; на максимуме опыт больше не копится.
 */
export function growAfterTask(picker: Picker, type: TaskType, outcome: Outcome): Picker {
  const { maxLevel, xp: xpByOutcome } = PICKER_GROWTH.spec;
  const cur = picker.specialization[type] ?? { level: 1, xp: 0 };
  let level = cur.level;
  let xp = level >= maxLevel ? 0 : cur.xp + xpByOutcome[outcome];
  while (level < maxLevel && xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level++;
  }
  if (level >= maxLevel) xp = 0;
  return {
    ...picker,
    specialization: { ...picker.specialization, [type]: { level, xp } },
    stats: { ...picker.stats, fatigue: Math.min(100, picker.stats.fatigue + PICKER_GROWTH.fatigue.perTask) },
  };
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

/** Уровни специализации всех сборщиков — запоминаются в начале смены, чтобы в итогах показать рост. */
export function levelsOf(pickers: Record<string, Picker>): Record<string, Record<TaskType, number>> {
  return Object.fromEntries(Object.values(pickers).map((p) => [
    p.id,
    Object.fromEntries(Object.entries(p.specialization).map(([t, s]) => [t, s.level])) as Record<TaskType, number>,
  ]));
}
