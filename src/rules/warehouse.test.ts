import { describe, expect, it } from 'vitest';
import { WAREHOUSE_LAYOUT } from '../config/warehouse';
import { buildWarehouseMap, cellToWorld, generateRacks } from './warehouse';

describe('карта склада', () => {
  it('строит 4 × 6 = 24 стеллажа с уникальными номерами', () => {
    const racks = generateRacks(WAREHOUSE_LAYOUT);
    expect(racks).toHaveLength(24);
    const keys = new Set(racks.map((r) => `${r.aisle}.${r.rack}`));
    expect(keys.size).toBe(24);
  });

  it('все стеллажи и клетки подхода внутри склада, подход не занят стеллажом', () => {
    const map = buildWarehouseMap(WAREHOUSE_LAYOUT);
    const occupied = new Set<string>();
    for (const r of map.racks) {
      for (let i = 0; i < r.length; i++) occupied.add(`${r.cell.x + i},${r.cell.z}`);
    }
    for (const r of map.racks) {
      for (const c of [r.cell, r.access]) {
        expect(c.x).toBeGreaterThanOrEqual(0);
        expect(c.x).toBeLessThan(map.width);
        expect(c.z).toBeGreaterThanOrEqual(0);
        expect(c.z).toBeLessThan(map.depth);
      }
      expect(occupied.has(`${r.access.x},${r.access.z}`)).toBe(false);
    }
  });

  it('длина стеллажа 2 сдвигает стеллажи вдоль аллеи', () => {
    const racks = generateRacks({ ...WAREHOUSE_LAYOUT, rackLength: 2 });
    expect(racks[1].cell.x - racks[0].cell.x).toBe(2);
  });

  it('cellToWorld ставит центр клетки', () => {
    expect(cellToWorld({ x: 0, z: 0 })).toEqual([0.5, 0, 0.5]);
    expect(cellToWorld({ x: 3, z: 2 })).toEqual([3.5, 0, 2.5]);
  });
});
