// Зона отдыха с диваном (W7b; правки автора 16.10): через диван не ходят, отдохнувшие не встают друг в друга.
import { describe, expect, it } from 'vitest';
import type { GameState } from '../model/game';
import { WAREHOUSE_LAYOUT } from '../config/warehouse';
import { buildWarehouseMap, findPath, isRestSeat } from './warehouse';
import { createInitialGame } from './game';
import { endRest } from './rest';

const map = buildWarehouseMap(WAREHOUSE_LAYOUT);
const key = (c: { x: number; z: number }) => `${c.x},${c.z}`;

describe('диван', () => {
  it('на место дивана можно прийти, но путь через диван не идёт', () => {
    const [a, , c] = map.rest.seats;
    const path = findPath(map, a, c)!;
    expect(path).not.toBeNull();
    // между первым и последним местом — только не-диванные клетки
    expect(path.slice(0, -1).some((p) => isRestSeat(map, p))).toBe(false);
    expect(key(path[path.length - 1])).toBe(key(c));
  });

  it('на старте сборщики не на диване и не в мебели, все на разных клетках', () => {
    const g = createInitialGame(map, 1);
    const cells = Object.values(g.pickers).map((p) => p.position);
    expect(cells.some((c) => isRestSeat(map, c))).toBe(false);
    expect(cells.some((c) => key(c) === key(map.rest.cooler) || key(c) === key(map.rest.plant))).toBe(false);
    expect(new Set(cells.map(key)).size).toBe(cells.length);
  });

  it('встав с дивана, сборщики не оказываются на одной клетке', () => {
    const g = createInitialGame(map, 1);
    // все трое сидят на диване на перерыве, остальные клетки зоны свободны
    let s: GameState = {
      ...g,
      pickers: Object.fromEntries(Object.values(g.pickers).map((p, i) => [
        p.id,
        { ...p, state: 'resting' as const, position: map.rest.seats[i], path: [], pathProgress: 0, job: { taskId: '', steps: [], stepIndex: 0, stepElapsed: 0 } },
      ])),
    };
    for (const id of Object.keys(s.pickers)) s = endRest(s, id, map);
    const cells = Object.values(s.pickers).map((p) => p.position);
    expect(cells.some((c) => isRestSeat(map, c))).toBe(false);
    expect(new Set(cells.map(key)).size).toBe(cells.length);
  });
});
