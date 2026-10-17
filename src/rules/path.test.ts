import { describe, expect, it } from 'vitest';
import type { Cell } from '../model/warehouse';
import { WAREHOUSE_LAYOUT } from '../config/warehouse';
import { accessForAddress, blockedCells, buildWarehouseMap, crossesFence, distancesFrom, findPath, zoneAccess, zoneCells } from './warehouse';
import { allAddresses } from './address';

const map = buildWarehouseMap(WAREHOUSE_LAYOUT);
const blocked = blockedCells(map);
const key = (c: Cell) => `${c.x},${c.z}`;

describe('путь по складу', () => {
  it('стоя на месте — пустой путь', () => {
    expect(findPath(map, { x: 3, z: 3 }, { x: 3, z: 3 })).toEqual([]);
  });

  it('по прямой без препятствий — кратчайший путь', () => {
    const p = findPath(map, { x: 0, z: 9 }, { x: 5, z: 9 })!; // главный проход
    expect(p).toHaveLength(5);
    expect(p[4]).toEqual({ x: 5, z: 9 });
  });

  it('шаги только на соседнюю клетку, без диагоналей, не через стеллажи', () => {
    const from = zoneAccess(map, 'rest');
    const to = accessForAddress(map, { aisle: 3, rack: 4, shelf: 1 });
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

describe('ограждение зоны брака', () => {
  const zone = map.zones.find((z) => z.type === 'scrap')!;
  const inside = (c: Cell) => c.x >= zone.from.x && c.x <= zone.to.x && c.z >= zone.from.z && c.z <= zone.to.z;

  it('контейнер и накопленный брак заняты, остальные клетки зоны — нет', () => {
    expect(blocked.has(key(map.scrap.bin))).toBe(true);
    for (const c of map.scrap.junk) expect(blocked.has(key(c))).toBe(true);
    expect(zoneCells(map, 'scrap').length).toBeGreaterThan(0);
  });

  it('войти можно только с клетки подхода', () => {
    const a = zone.access;
    const door = { x: a.x - 1, z: a.z }; // клетка зоны рядом с подходом (подход — с востока)
    expect(crossesFence(map, a, door)).toBe(false);
    expect(crossesFence(map, { x: a.x, z: a.z - 1 }, { x: door.x, z: door.z - 1 })).toBe(true);
    expect(crossesFence(map, { x: 1, z: zone.from.z - 1 }, { x: 1, z: zone.from.z })).toBe(true);
  });

  it('путь к любой свободной клетке зоны идёт через вход, а не сквозь сетку', () => {
    const from = zoneAccess(map, 'rest');
    for (const to of zoneCells(map, 'scrap')) {
      const p = findPath(map, from, to)!;
      expect(p).not.toBe(null);
      let prev = from;
      for (const c of p) {
        if (inside(c) !== inside(prev)) {
          const out = inside(c) ? prev : c;
          expect(out).toEqual(zone.access);
        }
        prev = c;
      }
    }
  });

  it('из зоны брака можно выйти к любому адресу', () => {
    const dist = distancesFrom(map, zoneCells(map, 'scrap')[0]);
    for (const a of allAddresses(map)) expect(dist.has(key(accessForAddress(map, a)))).toBe(true);
  });
});
