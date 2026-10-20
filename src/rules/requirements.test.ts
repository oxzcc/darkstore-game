// Требования заданий (docs/10, раздел 14.4).
import { describe, expect, it } from 'vitest';
import type { Task } from '../model/task';
import { WAREHOUSE_LAYOUT } from '../config/warehouse';
import { REQUIREMENTS } from '../config/balance';
import { buildWarehouseMap } from './warehouse';
import { createInitialGame } from './game';
import { taskRequirements } from './requirements';

const g = createInitialGame(buildWarehouseMap(WAREHOUSE_LAYOUT), 1);
const base = Object.values(g.tasks).find((t) => t.type === 'order')!;
const order = (products: string[], difficulty: 1 | 2 | 3 = 1): Task => base.type === 'order'
  ? { ...base, difficulty, payload: { lines: products.map((productId, i) => ({ productId, address: { aisle: 1, rack: 1, shelf: (i % 3) + 1 }, qty: 1 })) } }
  : base;

describe('требования задания', () => {
  it('короткий заказ: Лапы и Нюх, Память не нужна, Сила — нет', () => {
    const r = taskRequirements(order(['eggs', 'milk']));
    expect(r).toEqual({ speed: 5, accuracy: 5, strength: 0, memory: 0, friendly: 0 });
  });

  it('длинный заказ требует Память, тяжёлый товар — Силу', () => {
    const r = taskRequirements(order(['water', 'eggs', 'milk', 'chips']));
    expect(r.memory).toBe((4 - REQUIREMENTS.order.memoryPerLineFrom) * REQUIREMENTS.order.memoryPerLine);
    expect(r.strength).toBe(REQUIREMENTS.order.heavyStrength);
  });

  it('Память не выше потолка, сложность поднимает всё, но не выше 10', () => {
    const long = taskRequirements(order(['eggs', 'milk', 'chips', 'bread', 'pasta', 'coffee', 'cookies', 'cheese']));
    expect(long.memory).toBe(REQUIREMENTS.maxMemory);
    const hard = taskRequirements(order(['eggs', 'milk'], 3));
    expect(hard.speed).toBeGreaterThan(5);
    for (const v of Object.values(taskRequirements(order(['water', 'eggs', 'milk', 'chips', 'bread'], 3)))) expect(v).toBeLessThanOrEqual(REQUIREMENTS.max);
  });
});
