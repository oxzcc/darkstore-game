// Кампания и смены (M8a; docs/02-gameplay-loop.md, разделы 1, 3, 11).
import type { Outcome } from './task';

/** running — смена идёт; summary — время вышло, открыт экран итогов; over — 5 смен пройдено, итоги кампании. */
export type ShiftPhase = 'running' | 'summary' | 'over';

/** Итог одной смены — для экрана итогов и истории кампании. */
export type ShiftResult = {
  shift: number;
  appeared: number;                    // сколько заданий было за смену (закрытые + незакрытые к концу)
  closed: number;                      // сколько закрыто
  byOutcome: Record<Outcome, number>;  // закрытые по исходам
  stars: 0 | 1 | 2 | 3;                // оценка смены (решение автора 14.10: звёзды по доле закрытых)
  money: number;                       // сколько денег прибавилось за смену (может быть меньше нуля)
  rating: number;                      // как изменился рейтинг
  pickers: Record<string, number>;     // сколько заданий закрыл каждый сборщик
};

export type Campaign = {
  shift: number;          // номер текущей смены, с 1 — это и «календарь» сроков годности
  totalShifts: number;    // сколько смен в кампании (решение автора 14.10: 5)
  phase: ShiftPhase;
  startMoney: number;     // деньги и рейтинг в начале смены — чтобы показать, сколько прибавилось
  startRating: number;
  history: ShiftResult[]; // итоги закончившихся смен
};
