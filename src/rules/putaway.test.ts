import { describe, expect, it } from 'vitest';
import type { GameState } from '../model/game';
import type { PutawayTask, ReceivingTask } from '../model/task';
import { WAREHOUSE_LAYOUT } from '../config/warehouse';
import { PUTAWAY, REWARD } from '../config/balance';
import { buildWarehouseMap } from './warehouse';
import { gameWithDelivery as createInitialGame } from './testing'; // первая поставка уже у ворот (W8b)
import { dispatchTask } from './tasks/lifecycle';
import { advanceWorld } from './advance';
import { buildPutawayJob, pickerActivity } from './jobs';
import { addressKey, parseAddress } from './address';
import { qtyAt } from './stock';
import { acceptDelivery } from './deliveries';
import { completePutaway, createPutawayTasks, planPutaway } from './putaway';
import { createOrder } from './tasks/generator';
import { createRng } from './random';

const map = buildWarehouseMap(WAREHOUSE_LAYOUT);

function runUntil(s: GameState, done: (s: GameState) => boolean, limitSec = 900) {
  for (let t = 0; t < limitSec && !done(s); t += 0.1) s = advanceWorld(s, map, 0.1).state;
  return s;
}

const putaways = (s: GameState) => Object.values(s.tasks).filter((t): t is PutawayTask => t.type === 'putaway');
const receiving = (s: GameState) => Object.values(s.tasks).find((t): t is ReceivingTask => t.type === 'receiving')!;

/** Игра, где поставка уже принята и на её паллеты созданы выкладки. */
function afterReceiving(seed = 1): GameState {
  const g = createInitialGame(map, seed);
  const r = receiving(g);
  return createPutawayTasks(acceptDelivery(g, r.payload.deliveryId), map, r.payload.deliveryId);
}

describe('выбор полок', () => {
  it('товар целиком на свою полку, если там хватает места на всё', () => {
    const g = createInitialGame(map, 1);
    // молоко лежит на 1.1.1 (8 шт.), 2.3.2 (6) и 4.5.1 (10): 2 штуки влезают целиком на свою полку
    const plan = planPutaway(g, map, [{ productId: 'milk', qty: 2 }]);
    expect(plan.lines).toHaveLength(1);
    expect(qtyAt(g.stock, plan.lines[0].address, 'milk')).toBeGreaterThan(0);
    expect(qtyAt(g.stock, plan.lines[0].address) + 2).toBeLessThanOrEqual(PUTAWAY.shelfCapacity);
  });

  it('на своих полках не хватает места на всё — одной позицией на пустую полку, без дробления', () => {
    const g = createInitialGame(map, 1);
    const plan = planPutaway(g, map, [{ productId: 'milk', qty: 5 }]); // свободно максимум 4 (на 2.3.2)
    expect(plan.lines).toHaveLength(1);
    expect(plan.lines[0].qty).toBe(5);
    expect(qtyAt(g.stock, plan.lines[0].address)).toBe(0);
  });

  it('новый товар — на пустую полку; больше вместимости — делится на несколько полок', () => {
    const g = { ...createInitialGame(map, 1), tasks: {} };
    const plan = planPutaway(g, map, [{ productId: 'cheese', qty: PUTAWAY.shelfCapacity * 2 + 3 }]);
    expect(plan.leftover).toEqual([]);
    expect(plan.lines.reduce((s, l) => s + l.qty, 0)).toBe(PUTAWAY.shelfCapacity * 2 + 3);
    expect(plan.lines.length).toBeGreaterThanOrEqual(3);
    const keys = plan.lines.map((l) => addressKey(l.address));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('два товара одной паллеты не попадают на одну пустую полку', () => {
    const g = { ...createInitialGame(map, 1), stock: {}, tasks: {} };
    const plan = planPutaway(g, map, [{ productId: 'cheese', qty: 3 }, { productId: 'juice', qty: 3 }]);
    expect(addressKey(plan.lines[0].address)).not.toBe(addressKey(plan.lines[1].address));
  });

  it('полки, обещанные одной выкладкой, не обещаются другой', () => {
    const s = afterReceiving(2);
    const all = putaways(s).flatMap((t) => t.payload.lines);
    for (const l of all) {
      const sameShelf = all.filter((x) => addressKey(x.address) === addressKey(l.address));
      expect(new Set(sameShelf.map((x) => x.productId)).size).toBe(1); // один товар на полку
      const planned = sameShelf.reduce((sum, x) => sum + x.qty, 0);
      expect(qtyAt(s.stock, l.address) + planned).toBeLessThanOrEqual(PUTAWAY.shelfCapacity);
    }
  });

  it('места нет совсем — остаток остаётся на паллете', () => {
    const g = createInitialGame(map, 1);
    const shelves = map.racks.flatMap((r) => Array.from({ length: r.shelves }, (_, i) => `${r.aisle}.${r.rack}.${i + 1}`));
    const stock = Object.fromEntries(shelves.map((a) => [a, { id: a, productId: 'water', address: parseAddress(a), qty: PUTAWAY.shelfCapacity, expiresAtShift: 9 }]));
    const plan = planPutaway({ ...g, stock, tasks: {} }, map, [{ productId: 'milk', qty: 4 }]);
    expect(plan.lines).toEqual([]); // пустых полок нет, своих с местом тоже
    expect(plan.leftover).toEqual([{ productId: 'milk', qty: 4 }]);
  });
});

describe('задание «Выкладка»', () => {
  it('после приёмки — по заданию на каждую паллету, с наградой ×0,8 и адресами', () => {
    const s = afterReceiving();
    const d = Object.values(s.deliveries)[0];
    const tasks = putaways(s);
    expect(tasks.map((t) => t.payload.palletId)).toEqual(d.palletIds);
    for (const t of tasks) {
      expect(t.status).toBe('new');
      expect(t.reward.money).toBe(REWARD.moneyPerDifficulty * t.difficulty * REWARD.typeFactor.putaway);
      const onPallet = s.pallets[t.payload.palletId].items.reduce((sum, it) => sum + it.qty, 0);
      expect(t.payload.lines.reduce((sum, l) => sum + l.qty, 0)).toBe(onPallet);
    }
  });

  it('маршрут: к паллете, «Грузит тележку», потом по адресам с выкладкой на каждом', () => {
    const s = afterReceiving();
    const t = putaways(s)[0];
    const job = buildPutawayJob(map, s.pickers.lucky, t);
    expect(job.steps[0]).toMatchObject({ kind: 'walk', label: 'к паллете' });
    expect(job.steps[1]).toMatchObject({ kind: 'work', label: 'Грузит тележку' });
    expect(job.steps).toHaveLength(2 + t.payload.lines.length * 2);
    expect(job.steps.filter((x) => x.kind === 'place')).toHaveLength(t.payload.lines.length);
  });

  it('закрыта — товар на полках, паллета пустая; исход на полки не влияет', () => {
    const s = afterReceiving();
    const t = putaways(s)[0];
    const done = completePutaway(s, t);
    for (const l of t.payload.lines) {
      expect(qtyAt(done.stock, l.address, l.productId)).toBe(qtyAt(s.stock, l.address, l.productId) + l.qty);
    }
    expect(done.pallets[t.payload.palletId]).toMatchObject({ state: 'empty', items: [] });
  });
});

describe('полный круг', () => {
  it('поставка → приёмка → выкладка → товар на полке → на него можно сделать заказ', () => {
    let s = createInitialGame(map, 4);
    // склад пуст: заказы делать не из чего
    s = { ...s, stock: {}, tasks: Object.fromEntries(Object.entries(s.tasks).filter(([, t]) => t.type === 'receiving')) };
    expect(createOrder(s, createRng(1), 0)).toBeNull();

    const r = receiving(s);
    s = dispatchTask(s, map, r.id, 'lucky');
    s = runUntil(s, (x) => x.tasks[r.id].status === 'done');
    const tasks = putaways(s);
    expect(tasks.length).toBe(s.deliveries[r.payload.deliveryId].palletIds.length);

    const t = tasks[0];
    s = dispatchTask(s, map, t.id, 'korzh');
    s = runUntil(s, (x) => pickerActivity(x, 'korzh').kind === 'placing');
    expect(pickerActivity(s, 'korzh')).toMatchObject({ kind: 'placing', line: 1, lines: t.payload.lines.length });
    s = runUntil(s, (x) => x.tasks[t.id].status === 'done');
    for (const l of t.payload.lines) expect(qtyAt(s.stock, l.address, l.productId)).toBeGreaterThanOrEqual(l.qty);
    expect(s.pallets[t.payload.palletId].state).toBe('empty');

    const order = createOrder(s, createRng(1), s.clock.time);
    expect(order).not.toBeNull();
  });
});

describe('короткая выкладка (правка автора 14.10)', () => {
  it('позиций не больше, чем товаров на паллете, если товар влезает на полку', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const s = afterReceiving(seed);
      for (const t of putaways(s)) {
        const kinds = s.pallets[t.payload.palletId].items.length;
        expect(t.payload.lines.length).toBe(kinds); // на паллете до 8 штук товара — влезает на одну полку
      }
    }
  });
});
