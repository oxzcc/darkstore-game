import { describe, expect, it } from 'vitest';
import type { GameState } from '../../model/game';
import { WAREHOUSE_LAYOUT } from '../../config/warehouse';
import { workload, targetLoad } from '../pace';
import { ORDER } from '../../config/balance';
import { buildWarehouseMap } from '../warehouse';
import { createInitialGame } from '../game';
import { createRng } from '../random';
import { qtyAt } from '../stock';
import { createOrder, openOrders, openTasks, orderDifficulty } from './generator';
import { canAssign, dispatchTask } from './lifecycle';

const map = buildWarehouseMap(WAREHOUSE_LAYOUT);
const newGame = (seed = 1) => createInitialGame(map, seed);

describe('заказы', () => {
  it('на старте заказов столько, чтобы набрать загрузку смены (M8d)', () => {
    const g = newGame();
    expect(openTasks(g).filter((t) => t.type === 'order').length).toBeGreaterThan(0);
    expect(workload(g)).toBeGreaterThanOrEqual(targetLoad(g));
    expect(workload(g) - 1).toBeLessThan(targetLoad(g)); // и не больше, чем нужно
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
          const have = qtyAt(g.stock, l.address, l.productId);
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
    const task = openOrders(g)[0];
    expect(canAssign(g, task.id, 'lucky').ok).toBe(true);
  });

  it('нельзя назначить занятого сборщика или на уже назначенное задание', () => {
    const g = newGame();
    const [t1, t2] = openTasks(g);
    const after = dispatchTask(g, map, t1.id, 'korzh');
    expect(canAssign(after, t1.id, 'buran').ok).toBe(false); // задание уже назначено
    expect(canAssign(after, t2.id, 'korzh').ok).toBe(false); // Коржик занят
    expect(() => dispatchTask(after, map, t1.id, 'buran')).toThrow();
  });

  it('«Отправить»: сборщик получает маршрут и идёт, исхода ещё нет; новые заказы — по темпу, не сразу', () => {
    const g = newGame();
    const task = openOrders(g)[0];
    const s = dispatchTask(g, map, task.id, 'buran');
    const t = s.tasks[task.id];
    expect(t.status).toBe('pickerEnRoute');
    expect(t.assignedPickerId).toBe('buran');
    expect(t.outcome).toBe(null);
    const p = s.pickers.buran;
    expect(p.state).toBe('walking');
    expect(p.taskId).toBe(task.id);
    const lines = task.type === 'order' ? task.payload.lines.length : 0;
    expect(p.job!.steps).toHaveLength(lines * 2 + 2); // к каждому адресу + сбор, потом фасовка
    expect(Object.keys(s.tasks)).toEqual(Object.keys(g.tasks)); // заказ не появился мгновенно (M8d)
  });

  it('назначение не меняет остатки, деньги и рейтинг и не портит исходное состояние', () => {
    const g = newGame();
    const before = JSON.stringify(g);
    const s = dispatchTask(g, map, openOrders(g)[0].id, 'lucky');
    expect(JSON.stringify(g)).toBe(before);
    expect(s.stock).toEqual(g.stock);
    expect(s.money).toBe(g.money);
    expect(s.rating).toBe(g.rating);
  });
});
