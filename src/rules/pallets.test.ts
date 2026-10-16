// Паллеты на полу непроходимы (просьба автора 16.10): путь их обходит, встать рядом можно, на паллету — нельзя.
import { describe, expect, it } from 'vitest';
import type { GameState } from '../model/game';
import { WAREHOUSE_LAYOUT } from '../config/warehouse';
import { DELIVERY } from '../config/balance';
import { blockedWithPallets, buildWarehouseMap, findPath } from './warehouse';
import { createInitialGame } from './game';
import { dispatchTask } from './tasks/lifecycle';
import { advanceWorld } from './advance';

const map = buildWarehouseMap(WAREHOUSE_LAYOUT);
const key = (c: { x: number; z: number }) => `${c.x},${c.z}`;

describe('паллеты непроходимы', () => {
  it('путь обходит клетку паллеты', () => {
    const [a, b] = [{ x: 3, z: 11 }, { x: 5, z: 11 }];
    const pallet = { x: 4, z: 11 };
    const path = findPath(map, a, b, blockedWithPallets(map, [pallet]))!;
    expect(path).not.toBeNull();
    expect(path.some((c) => key(c) === key(pallet))).toBe(false);
  });

  it('сборщик по пути на приёмку ни разу не наступает на паллету', () => {
    let s: GameState = createInitialGame(map, 1);
    const task = Object.values(s.tasks).find((t) => t.type === 'receiving')!;
    s = dispatchTask(s, map, task.id, 'lucky');
    s = { ...s, pickers: { ...s.pickers, lucky: { ...s.pickers.lucky, job: { ...s.pickers.lucky.job!, call: undefined } } } }; // без развилки
    const slots = new Set(DELIVERY.palletSlots.map(key));
    for (let i = 0; i < 3000 && s.tasks[task.id]?.status !== 'done'; i++) {
      const onFloor = new Set(Object.values(s.pallets).filter((p) => p.state !== 'empty').map((p) => key(p.cell)));
      for (const c of s.pickers.lucky.path) {
        if (slots.has(key(c))) expect(onFloor.has(key(c))).toBe(false);
      }
      s = advanceWorld(s, map, 0.1).state;
    }
    expect(s.tasks[task.id].status).toBe('done');
  });
});
