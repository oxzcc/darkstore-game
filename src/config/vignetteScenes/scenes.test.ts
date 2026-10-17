// Сценки итога (V2b): у каждого варианта развилки готового типа задания есть обе сцены — «сработало» и «не сработало»,
// и в таблице нет лишних ключей (например, после переименования варианта в config/calls.ts).
import { describe, expect, it } from 'vitest';
import { SITUATIONS } from '../calls';
import { RESULT_VIGNETTES, vignetteKey } from '../vignettes';

/** Типы заданий, для которых сцены уже нарисованы. */
const DONE: string[] = ['order', 'receiving'];

describe('сценки итога', () => {
  it('у каждого варианта готовых типов есть сцены ok и bad', () => {
    const missing: string[] = [];
    for (const s of SITUATIONS.filter((x) => DONE.includes(x.taskType))) {
      for (const o of s.options) {
        for (const worked of [true, false]) {
          const key = vignetteKey(s.id, o.id, worked);
          if (!RESULT_VIGNETTES[key]) missing.push(key);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('каждый ключ таблицы — существующий вариант ситуации', () => {
    const known = new Set(SITUATIONS.flatMap((s) => s.options.flatMap((o) => [vignetteKey(s.id, o.id, true), vignetteKey(s.id, o.id, false)])));
    expect(Object.keys(RESULT_VIGNETTES).filter((k) => !known.has(k))).toEqual([]);
  });
});
