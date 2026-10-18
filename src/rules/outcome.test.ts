import { describe, expect, it } from 'vitest';
import type { OutcomeChances } from '../model/task';
import { WAREHOUSE_LAYOUT } from '../config/warehouse';
import { buildWarehouseMap } from './warehouse';
import { createInitialGame } from './game';
import { createRng } from './random';
import { OUTCOMES, outcomeBreakdown, outcomeChances, rollOutcome } from './outcome';
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

  it('раскладка шанса «идеально» складывается ровно в шанс', () => {
    for (const task of Object.values(game.tasks)) {
      for (const p of Object.values(game.pickers)) {
        for (const fatigue of [0, 40, 100]) {
          for (const level of [1, 3, 5]) {
            const picker = { ...p, stats: { ...p.stats, fatigue }, specialization: { ...p.specialization, [task.type]: { level, xp: 0 } } };
            const { chances, parts } = outcomeBreakdown(picker, task);
            expect(chances).toEqual(outcomeChances(picker, task));
            const sum = parts.reduce((s, x) => s + x.value, 0);
            expect(Math.abs(sum - chances.perfect) < 1e-9).toBe(true);
          }
        }
      }
    }
  });

  it('свежий сборщик без опыта: усталость и опыт дают 0, предела нет', () => {
    const task = { ...Object.values(game.tasks)[0], difficulty: 1 as const };
    const p = Object.values(game.pickers)[0];
    const fresh = { ...p, stats: { ...p.stats, fatigue: 0 }, specialization: { ...p.specialization, [task.type]: { level: 1, xp: 0 } } };
    const parts = outcomeBreakdown(fresh, task).parts;
    expect(parts.map((x) => x.kind)).toEqual(['base', 'accuracy', 'spec', 'fatigue']);
    expect(Math.abs(parts[2].value)).toBeLessThan(1e-9);
    expect(Math.abs(parts[3].value)).toBeLessThan(1e-9);
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
