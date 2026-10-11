import { describe, expect, it } from 'vitest';
import { createRng } from './random';

describe('генератор случайностей', () => {
  it('одно зерно — одна и та же последовательность', () => {
    const a = createRng(42), b = createRng(42);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('продолжение с сохранённого зерна даёт то же, что без остановки', () => {
    const a = createRng(7);
    a.next(); a.next();
    const resumed = createRng(a.seed());
    expect(resumed.next()).toBe(a.next());
  });

  it('числа в нужных пределах', () => {
    const r = createRng(1);
    for (let i = 0; i < 1000; i++) {
      const x = r.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      const n = r.int(2, 5);
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(5);
    }
  });

  it('shuffle не теряет и не дублирует элементы', () => {
    const r = createRng(3);
    expect([...r.shuffle([1, 2, 3, 4, 5])].sort()).toEqual([1, 2, 3, 4, 5]);
  });
});
