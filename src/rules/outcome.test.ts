import { describe, expect, it } from 'vitest';
import type { OutcomeChances } from '../model/task';
import { WAREHOUSE_LAYOUT } from '../config/warehouse';
import { buildWarehouseMap } from './warehouse';
import { createInitialGame } from './game';
import { createRng } from './random';
import { OUTCOMES, outcomeChances, rollOutcome } from './outcome';

describe('исходы', () => {
  const game = createInitialGame(buildWarehouseMap(WAREHOUSE_LAYOUT), 123);

  it('шансы трёх исходов в сумме дают 1', () => {
    const task = Object.values(game.tasks)[0];
    for (const p of Object.values(game.pickers)) {
      const c = outcomeChances(p, task);
      const sum = OUTCOMES.reduce((s, o) => s + c[o], 0);
      expect(Math.abs(sum - 1) < 1e-9).toBe(true);
    }
  });

  it('бросок следует шансам', () => {
    const always: OutcomeChances = { perfect: 0, withErrors: 1, failed: 0 };
    const rng = createRng(5);
    for (let i = 0; i < 50; i++) expect(rollOutcome(always, rng)).toBe('withErrors');
  });

  it('на большом числе бросков частоты близки к шансам', () => {
    const chances: OutcomeChances = { perfect: 0.6, withErrors: 0.3, failed: 0.1 };
    const rng = createRng(99);
    const n = 20000;
    const counts = { perfect: 0, withErrors: 0, failed: 0 };
    for (let i = 0; i < n; i++) counts[rollOutcome(chances, rng)]++;
    for (const o of OUTCOMES) expect(Math.abs(counts[o] / n - chances[o]) < 0.02).toBe(true);
  });
});
