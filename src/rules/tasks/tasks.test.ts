import { describe, expect, it } from 'vitest';
import type { GameState } from '../../model/game';
import { WAREHOUSE_LAYOUT } from '../../config/warehouse';
import { ORDER } from '../../config/balance';
import { buildWarehouseMap } from '../warehouse';
import { createInitialGame } from '../game';
import { createRng } from '../random';
import { bookQtyAt } from '../stock';
import { createOrder, openTasks, orderDifficulty } from './generator';
import { canAssign, dispatchTask } from './lifecycle';

const map = buildWarehouseMap(WAREHOUSE_LAYOUT);
const newGame = (seed = 1) => createInitialGame(map, seed);

describe('заказы', () => {
  it('на старте в очереди нужное число заказов', () => {
    const g = newGame();
    expect(openTasks(g)).toHaveLength(ORDER.openOrdersTarget);
  });

  it('заказ только из товаров, которые есть по учёту, в пределах остатка', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const g = newGame(seed);
      for (const t of Object.values(g.tasks)) {
        if (t.type !== 'order') continue;
        const [minL, maxL] = ORDER.linesPerOrder;
        expect(t.payload.lines.length).toBeGreaterThanOrEqual(minL);
        expect(t.payload.lines.length).toBeLessThanOrEqual(maxL);
        expect(new Set(t.payload.lines.map((l) => l.productId)).size).toBe(t.payload.lines.length);
        for (const l of t.payload.lines) {
          const have = bookQtyAt(g.stock, l.address, l.productId);
          expect(have).toBeGreaterThanOrEqual(l.qty);
          expect(l.qty).toBeGreaterThanOrEqual(1);
        }
        expect(t.difficulty).toBe(orderDifficulty(t.payload.lines.length));
      }
    }
  });

  it('на пустом складе заказ не создаётся', () => {
    const empty: GameState = { ...newGame(), stock: {}, tasks: {} };
    expect(createOrder(empty, createRng(1), 0)).toBe(null);
  });

  it('номера заданий не повторяются', () => {
    const g = newGame();
    const nums = Object.values(g.tasks).map((t) => t.number);
    expect(new Set(nums).size).toBe(nums.length);
  });
});

describe('назначение', () => {
  it('свободного сборщика можно назначить на новое задание', () => {
    const g = newGame();
    const task = openTasks(g)[0];
    expect(canAssign(g, task.id, 'lucky').ok).toBe(true);
  });

  it('нельзя назначить занятого сборщика или на уже выполненное задание', () => {
    const g = newGame();
    const task = openTasks(g)[0];
    const busy: GameState = { ...g, pickers: { ...g.pickers, lucky: { ...g.pickers.lucky, state: 'working' } } };
    expect(canAssign(busy, task.id, 'lucky').ok).toBe(false);
    const after = dispatchTask(g, task.id, 'korzh', 0).state;
    expect(canAssign(after, task.id, 'buran').ok).toBe(false);
    expect(() => dispatchTask(after, task.id, 'buran', 0)).toThrow();
  });

  it('«Отправить»: задание выполнено с исходом, сборщик свободен, очередь дополнена', () => {
    const g = newGame();
    const task = openTasks(g)[0];
    const { state, event } = dispatchTask(g, task.id, 'buran', 0);
    const done = state.tasks[task.id];
    expect(done.status).toBe('done');
    expect(done.assignedPickerId).toBe('buran');
    expect(done.mode).toBe('delegated');
    expect(['perfect', 'withErrors', 'failed'].includes(done.outcome!)).toBe(true);
    expect(event.outcome).toBe(done.outcome);
    expect(state.pickers.buran.state).toBe('idle');
    expect(openTasks(state)).toHaveLength(ORDER.openOrdersTarget);
    expect(state.shiftLog).toHaveLength(1);
    expect(state.rngSeed === g.rngSeed).toBe(false);
  });

  it('остатки, деньги и рейтинг в M3 не меняются, исходное состояние не портится', () => {
    const g = newGame();
    const before = JSON.stringify(g);
    const task = openTasks(g)[0];
    const { state } = dispatchTask(g, task.id, 'lucky', 0);
    expect(JSON.stringify(g)).toBe(before);
    expect(state.stock).toEqual(g.stock);
    expect(state.money).toBe(g.money);
    expect(state.rating).toBe(g.rating);
  });

  it('одно зерно — один и тот же исход', () => {
    const a = newGame(77), b = newGame(77);
    const t = openTasks(a)[0];
    expect(dispatchTask(a, t.id, 'lucky', 0).event.outcome).toBe(dispatchTask(b, t.id, 'lucky', 0).event.outcome);
  });
});
