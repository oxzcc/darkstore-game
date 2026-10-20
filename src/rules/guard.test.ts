// Скрытые подпорки бросков (docs/10, раздел 14.7).
import { describe, expect, it } from 'vitest';
import type { OutcomeChances } from '../model/task';
import { GUARD } from '../config/balance';
import { guardedRoll } from './guard';
import { outcomeAt } from './outcome';

const sure: OutcomeChances = { perfect: 0.85, withErrors: 0.13, failed: 0.02 };
const low: OutcomeChances = { perfect: 0.1, withErrors: 0.4, failed: 0.5 };
const mid: OutcomeChances = { perfect: 0.5, withErrors: 0.3, failed: 0.2 };

describe('подпорки', () => {
  it('высокий шанс: промах превращается в «идеально», маркер — в зоне «идеально»', () => {
    const g = guardedRoll(sure, 0.95, 0, 'on');
    expect(g).toMatchObject({ outcome: 'perfect', streak: 1 });
    expect(outcomeAt(sure, g.value)).toBe('perfect');
  });

  it('подарков подряд не больше maxStreak; честный промах сбрасывает серию', () => {
    const g = guardedRoll(sure, 0.95, GUARD.maxStreak, 'on');
    expect(g).toMatchObject({ outcome: 'withErrors', streak: 0 });
    expect(guardedRoll(sure, 0.1, 2, 'on')).toMatchObject({ outcome: 'perfect', streak: 2 }); // честное «идеально» серию не трогает
  });

  it('в обучении серия без ограничения, в последней смене подпорок нет', () => {
    expect(guardedRoll(sure, 0.95, 99, 'tutorial').outcome).toBe('perfect');
    expect(guardedRoll(sure, 0.995, 0, 'off')).toEqual({ outcome: 'failed', value: 0.995, streak: 0 });
    expect(guardedRoll(low, 0.12, 0, 'off').outcome).toBe('withErrors');
  });

  it('низкий шанс «идеально» бросается как floor', () => {
    expect(guardedRoll(low, GUARD.floor - 0.01, 0, 'on').outcome).toBe('perfect');
    expect(guardedRoll(low, GUARD.floor + 0.01, 0, 'on').outcome).toBe('withErrors');
  });

  it('маленький провал не выпадает; обычные шансы бросаются честно', () => {
    const tiny: OutcomeChances = { perfect: 0.6, withErrors: 0.36, failed: 0.04 };
    expect(guardedRoll(tiny, 0.99, 0, 'on').outcome).toBe('withErrors');
    for (const r of [0.1, 0.6, 0.9]) expect(guardedRoll(mid, r, 0, 'on')).toEqual({ outcome: outcomeAt(mid, r), value: r, streak: 0 });
  });
});
