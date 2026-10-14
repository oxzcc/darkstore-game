// «Срок» — игра на ТСД в ситуации «срок годности сегодня» (docs/10-minigames-concept.md, раздел 11.3; прототип одобрен автором 14.10).
// В лотке несколько штук товара с разными сроками; этикетка у каждой на своей стороне. Подходит ровно одна.
// Чистые функции: раскладка сроков и сторон, оценка, дата для этикетки.
import type { ExpiryUnit } from '../../model/tsdGame';
import type { Outcome } from '../../model/task';
import { EXPIRY } from '../../config/calls';
import type { Rng } from '../random';

/** Перемешать массив (копию) по генератору. */
function shuffle<T>(rng: Rng, xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Штуки в лотке (rows × cols): ровно одна подходящая (need … need + goodSpread дней) на случайном месте,
 * у остальных — короткий срок из badDays. Стороны этикеток — все 6 по кругу, перемешанные: у соседей они разные.
 */
export function createExpiryUnits(rng: Rng, cfg = EXPIRY): ExpiryUnit[] {
  const n = cfg.rows * cfg.cols;
  const goodAt = Math.floor(rng.next() * n);
  const good = cfg.need + Math.floor(rng.next() * (cfg.goodSpread + 1));
  const sides: number[] = [];
  while (sides.length < n) sides.push(...shuffle(rng, [0, 1, 2, 3, 4, 5]));
  return Array.from({ length: n }, (_, i) => ({
    days: i === goodAt ? good : cfg.badDays[Math.floor(rng.next() * cfg.badDays.length)],
    side: sides[i],
    seen: false,
  }));
}

/** Срок подходит: не раньше нужного. */
export const expiryOk = (days: number, need: number) => days >= need;

/** Исход: не та штука — провал; подходящая быстро — идеально, медленно — с ошибками; время вышло — провал. */
export function scoreExpiry(days: number, need: number, elapsed: number, timedOut: boolean, cfg = EXPIRY): Outcome {
  if (timedOut || !expiryOk(days, need)) return 'failed';
  return elapsed <= cfg.perfectSeconds ? 'perfect' : 'withErrors';
}

/** Дата на этикетке: «16.10». Пока в игре нет календаря, «сегодня» — из config (EXPIRY.today). */
export function expiryDate(days: number, cfg = EXPIRY): string {
  const d = new Date(2026, cfg.today.month - 1, cfg.today.day + days);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}
