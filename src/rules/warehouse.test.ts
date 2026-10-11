import { describe, expect, it } from 'vitest';
import type { Cell, WarehouseMap } from '../model/warehouse';
import { WAREHOUSE_LAYOUT } from '../config/warehouse';
import { buildWarehouseMap, cellToWorld, generateRacks } from './warehouse';

const key = (c: Cell) => `${c.x},${c.z}`;
const inside = (map: WarehouseMap, c: Cell) => c.x >= 0 && c.x < map.width && c.z >= 0 && c.z < map.depth;

describe('карта склада', () => {
  const map = buildWarehouseMap(WAREHOUSE_LAYOUT);
  const rackCells = new Set(map.racks.flatMap((r) => r.cells.map(key)));

  it('строит 4 × 6 = 24 стеллажа с уникальными номерами', () => {
    expect(map.racks).toHaveLength(24);
    expect(new Set(map.racks.map((r) => `${r.aisle}.${r.rack}`)).size).toBe(24);
  });

  it('стеллажи не налезают друг на друга и стоят внутри склада', () => {
    const all = map.racks.flatMap((r) => r.cells);
    expect(new Set(all.map(key)).size).toBe(all.length);
    for (const c of all) expect(inside(map, c)).toBe(true);
  });

  it('клетки подхода внутри склада и свободны', () => {
    const accesses = [...map.racks.map((r) => r.access), ...map.zones.map((z) => z.access)];
    for (const c of accesses) {
      expect(inside(map, c)).toBe(true);
      expect(rackCells.has(key(c))).toBe(false);
    }
  });

  it('зоны не пересекаются со стеллажами', () => {
    for (const z of map.zones) {
      for (let x = z.from.x; x <= z.to.x; x++) {
        for (let zz = z.from.z; zz <= z.to.z; zz++) expect(rackCells.has(`${x},${zz}`)).toBe(false);
      }
    }
  });

  it('длина стеллажа — одна настройка', () => {
    const racks = generateRacks({ ...WAREHOUSE_LAYOUT.racks, rackLength: 1 });
    expect(racks[0].cells).toHaveLength(1);
    expect(racks[1].cell.z - racks[0].cell.z).toBe(-1);
  });

  it('cellToWorld ставит центр клетки', () => {
    expect(cellToWorld({ x: 0, z: 0 })).toEqual([0.5, 0, 0.5]);
    expect(cellToWorld({ x: 3, z: 2 })).toEqual([3.5, 0, 2.5]);
  });
});
