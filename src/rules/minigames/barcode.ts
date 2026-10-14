// «Штрихкод» — игра на ТСД в ситуации «штрихкод не читается» (docs/10-minigames-concept.md, раздел 11.3;
// прототип одобрен автором 14.10). Середина кода на наклейке затёрта; стёртые цифры подбирают за несколько попыток,
// после каждой — отметки как в играх с угадыванием слов. Чистые функции: код, отметки, исход.
import type { BarcodeMark } from '../../model/tsdGame';
import type { Outcome } from '../../model/task';
import { BARCODE } from '../../config/calls';
import type { Rng } from '../random';
import { EXPIRY_SIDES } from './expiry';

/** Новый код: начало — prefix, остальное — случайные цифры; сторона наклейки — любая, кроме верха. */
export function createBarcode(rng: Rng, cfg = BARCODE): { code: number[]; side: number } {
  const code = Array.from({ length: cfg.length }, (_, i) => cfg.prefix[i] ?? Math.floor(rng.next() * 10));
  const side = EXPIRY_SIDES[Math.floor(rng.next() * EXPIRY_SIDES.length)];
  return { code, side };
}

/** Стёртые цифры — то, что нужно угадать. */
export const hiddenDigits = (code: number[], from: number, count: number) => code.slice(from, from + count);

/**
 * Отметки попытки: сначала зелёные (цифра на своём месте), потом жёлтые — цифра есть среди стёртых, но в другом месте;
 * повторы считаются как в играх с угадыванием слов: жёлтых для цифры не больше, чем её осталось неугаданной.
 */
export function markGuess(secret: number[], guess: number[]): BarcodeMark[] {
  const marks: BarcodeMark[] = guess.map(() => 'miss');
  const left = new Map<number, number>();
  guess.forEach((d, i) => {
    if (d === secret[i]) marks[i] = 'hit';
    else left.set(secret[i], (left.get(secret[i]) ?? 0) + 1);
  });
  guess.forEach((d, i) => {
    if (marks[i] === 'hit') return;
    const n = left.get(d) ?? 0;
    if (n > 0) { marks[i] = 'near'; left.set(d, n - 1); }
  });
  return marks;
}

/** Исход по числу попыток: угадал за perfectWithin — идеально, позже — неплохо. */
export function scoreBarcode(tries: number, perfectWithin: number): Outcome {
  return tries <= perfectWithin ? 'perfect' : 'withErrors';
}
