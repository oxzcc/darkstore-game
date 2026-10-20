import { describe, expect, it } from 'vitest';
import type { OutcomeChances } from '../model/task';
import { WAREHOUSE_LAYOUT } from '../config/warehouse';
import { buildWarehouseMap } from './warehouse';
import { createInitialGame } from './game';
import { createRng } from './random';
import { OUTCOMES, chancesForCoverage, coverage, outcomeBreakdown, outcomeChances, rollOutcome } from './outcome';
import { taskRequirements } from './requirements';
import { jobSecondsEstimate, etaToTask } from './jobs';

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

  it('раскладка: те же шансы, покрытие от 0 до 1, нужды — из требований задания', () => {
    for (const task of Object.values(game.tasks)) {
      const req = taskRequirements(task);
      for (const p of Object.values(game.pickers)) {
        for (const fatigue of [0, 40, 100]) {
          const picker = { ...p, stats: { ...p.stats, fatigue } };
          const b = outcomeBreakdown(picker, task);
          expect(b.chances).toEqual(outcomeChances(picker, task));
          expect(b.coverage).toBeGreaterThanOrEqual(0);
          expect(b.coverage).toBeLessThanOrEqual(1);
          for (const n of b.needs) expect(n.need).toBe(req[n.stat]);
        }
      }
    }
  });

  it('покрытие: всё закрыто — 1; не хватает — доля; шансы растут с покрытием', () => {
    const req = { speed: 4, accuracy: 4, strength: 0, memory: 2, friendly: 0 };
    expect(coverage({ speed: 9, accuracy: 9, strength: 1, memory: 9, friendly: 1 }, req)).toBe(1);
    expect(coverage({ speed: 2, accuracy: 4, strength: 1, memory: 1, friendly: 1 }, req)).toBeCloseTo(7 / 10, 9);
    expect(chancesForCoverage(0.5).perfect).toBeLessThan(chancesForCoverage(0.9).perfect);
    expect(chancesForCoverage(1).perfect).toBeCloseTo(0.85, 9);
  });

  it('оценка времени задания: не меньше дороги до места', () => {
    const map = buildWarehouseMap(WAREHOUSE_LAYOUT);
    for (const task of Object.values(game.tasks)) {
      for (const p of Object.values(game.pickers)) {
        const total = jobSecondsEstimate(map, p, task);
        const eta = etaToTask(map, p, task);
        expect(total).not.toBeNull();
        expect(total!).toBeGreaterThan(eta ?? 0);
      }
    }
  });
});
