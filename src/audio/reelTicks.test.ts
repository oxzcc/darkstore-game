import { describe, expect, it } from 'vitest';
import { reelTickTimes } from './reelTicks';

const CURVE: [number, number, number, number] = [0.12, 0.75, 0.18, 1];

describe('reelTickTimes', () => {
  it('щелчки идут по порядку и укладываются во время прокрутки', () => {
    const t = reelTickTimes(20, 2, CURVE, 40);
    expect(t).toHaveLength(19);
    for (let i = 1; i < t.length; i++) expect(t[i]).toBeGreaterThan(t[i - 1]);
    expect(t[t.length - 1]).toBeLessThan(2);
  });

  it('к остановке щелчки реже', () => {
    const t = reelTickTimes(20, 2, CURVE, 40);
    expect(t[t.length - 1] - t[t.length - 2]).toBeGreaterThan(t[1] - t[0]);
  });

  it('на длинной ленте щелчков не больше лимита', () => {
    expect(reelTickTimes(200, 2, CURVE, 30).length).toBeLessThanOrEqual(30);
  });

  it('пустая лента — без щелчков', () => {
    expect(reelTickTimes(0, 2, CURVE, 30)).toEqual([]);
  });
});
