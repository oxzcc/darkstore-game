// Кампания и смены (M8a; docs/02-gameplay-loop.md, разделы 1, 3, 11).
import type { Outcome, TaskType } from './task';

/** running — смена идёт; summary — время вышло, открыт экран итогов; over — 5 смен пройдено, итоги кампании. */
export type ShiftPhase = 'running' | 'summary' | 'over';

/** Итог одной смены — для экрана итогов и истории кампании. */
export type ShiftResult = {
  shift: number;
  appeared: number;                    // сколько заданий было за смену (закрытые + просроченные + незакрытые к концу)
  closed: number;                      // сколько закрыто
  expired: number;                     // сколько заданий просрочено (M8b)
  byOutcome: Record<Outcome, number>;  // закрытые по исходам
  stars: 0 | 1 | 2 | 3;                // оценка смены (решение автора 14.10: звёзды по доле закрытых)
  money: number;                       // сколько денег прибавилось за смену (может быть меньше нуля)
  rating: number;                      // как изменился рейтинг
  pickers: Record<string, number>;     // сколько заданий закрыл каждый сборщик
  /** Рост за смену (M8c): опыт, какие специализации поднялись (тип → новый уровень), усталость в конце смены. */
  growth: Record<string, { xp: number; levelUps: { type: TaskType; level: number }[]; fatigue: number }>;
};

export type Campaign = {
  shift: number;          // номер текущей смены, с 1 — это и «календарь» сроков годности
  totalShifts: number;    // сколько смен в кампании (решение автора 14.10: 5)
  phase: ShiftPhase;
  startMoney: number;     // деньги и рейтинг в начале смены — чтобы показать, сколько прибавилось
  startRating: number;
  history: ShiftResult[]; // итоги закончившихся смен
  /** Рейтинг в конце смены упал ниже SHIFT.loseRating — кампания проиграна (M8b, решение автора 14.10). */
  lost: boolean;
  /** Уровни специализаций в начале смены — чтобы в итогах показать, что выросло (M8c). */
  startLevels: Record<string, Record<TaskType, number>>;
  /** Обучающая смена (M8d): у каких типов заданий гарантированная развилка уже была; какие подсказки уже показаны. */
  tutorialForks: TaskType[];
  hintsSeen: string[];
};
