import { describe, expect, it } from 'vitest';
import type { Cell } from '../model/warehouse';
import { WAREHOUSE_LAYOUT } from '../config/warehouse';
import { accessForAddress, blockedCells, buildWarehouseMap, findPath, zoneAccess } from './warehouse';
import { allAddresses } from './address';

const map = buildWarehouseMap(WAREHOUSE_LAYOUT);
const blocked = blockedCells(map);
const key = (c: Cell) => `${c.x},${c.z}`;

describe('путь по складу', () => {
  it('стоя на месте — пустой путь', () => {
    expect(findPath(map, { x: 3, z: 3 }, { x: 3, z: 3 })).toEqual([]);
  });

  it('по прямой без препятствий — кратчайший путь', () => {
    const p = findPath(map, { x: 0, z: 13 }, { x: 5, z: 13 })!;
    expect(p).toHaveLength(5);
    expect(p[4]).toEqual({ x: 5, z: 13 });
  });

  it('шаги только на соседнюю клетку, без диагоналей, не через стеллажи', () => {
    const from = zoneAccess(map, 'rest');
    const to = accessForAddress(map, { aisle: 4, rack: 6, shelf: 1 });
    const p = findPath(map, from, to)!;
    let prev = from;
    for (const c of p) {
      expect(Math.abs(c.x - prev.x) + Math.abs(c.z - prev.z)).toBe(1);
      expect(blocked.has(key(c))).toBe(false);
      prev = c;
    }
    expect(prev).toEqual(to);
  });

  it('из зоны отдыха можно дойти до любого адреса и до фасовки', () => {
    const from = zoneAccess(map, 'rest');
    for (const a of allAddresses(map)) expect(findPath(map, from, accessForAddress(map, a)) === null).toBe(false);
    expect(findPath(map, from, zoneAccess(map, 'packing')) === null).toBe(false);
  });

  it('в стеллаж или за пределы склада дойти нельзя', () => {
    expect(findPath(map, { x: 0, z: 0 }, map.racks[0].cell)).toBe(null);
    expect(findPath(map, { x: 0, z: 0 }, { x: -1, z: 0 })).toBe(null);
  });
});
