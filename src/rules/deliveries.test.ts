import { describe, expect, it } from 'vitest';
import type { GameState } from '../model/game';
import type { ReceivingTask } from '../model/task';
import { WAREHOUSE_LAYOUT } from '../config/warehouse';
import { DELIVERY, REWARD } from '../config/balance';
import { RESULT_SHARE } from '../config/calls';
import { buildWarehouseMap } from './warehouse';
import { createInitialGame } from './game';
import { dispatchTask } from './tasks/lifecycle';
import { advanceWorld } from './advance';
import { buildReceivingJob, etaToTask, pickerActivity } from './jobs';
import { createRng } from './random';
import { receiveSeconds } from './time';
import { acceptDelivery, createDelivery, freeByProduct, freePalletSlots, tickDeliveries, truckAtGate } from './deliveries';
import { rewardFor } from './rewards';
import { shiftPlan } from './shiftPlan';

const map = buildWarehouseMap(WAREHOUSE_LAYOUT);
/** Интервал поставок первой смены (M8d: из плана смены). */
const EVERY = shiftPlan(createInitialGame(map, 1)).deliveryEvery;

function runUntil(s: GameState, done: (s: GameState) => boolean, limitSec = 600) {
  for (let t = 0; t < limitSec && !done(s); t += 0.1) s = advanceWorld(s, map, 0.1).state;
  return s;
}

const receivingTasks = (s: GameState) =>
  Object.values(s.tasks).filter((t): t is ReceivingTask => t.type === 'receiving');

/** Новая игра без поставки на старте — чтобы проверять приезд вручную. */
function noDeliveryGame(seed = 1): GameState {
  const g = createInitialGame(map, seed);
  const tasks = Object.fromEntries(Object.entries(g.tasks).filter(([, t]) => t.type !== 'receiving'));
  return { ...g, tasks, deliveries: {}, pallets: {}, nextDeliveryAt: EVERY };
}

describe('поставка', () => {
  it('на старте (firstAtStart) у ворот грузовик, паллеты в зоне приёмки и задание «Приёмка»', () => {
    const g = createInitialGame(map, 1);
    const deliveries = Object.values(g.deliveries);
    expect(deliveries).toHaveLength(DELIVERY.firstAtStart ? 1 : 0);
    if (!DELIVERY.firstAtStart) return;
    const d = deliveries[0];
    expect(d.status).toBe('atGate');
    expect(d.palletIds.length).toBeGreaterThanOrEqual(DELIVERY.pallets[0]);
    expect(d.palletIds.length).toBeLessThanOrEqual(DELIVERY.pallets[1]);
    const [task] = receivingTasks(g);
    expect(task.status).toBe('new');
    expect(task.payload).toEqual({ deliveryId: d.id, palletCount: d.palletIds.length });
    expect(task.location).toEqual({ kind: 'zone', zone: 'receiving' });
    expect(task.reward.money).toBe(REWARD.moneyPerDifficulty * task.difficulty * REWARD.typeFactor.receiving);
    for (const id of d.palletIds) {
      const p = g.pallets[id];
      expect(p.state).toBe('inReceiving');
      expect(DELIVERY.palletSlots.some((c) => c.x === p.cell.x && c.z === p.cell.z)).toBe(true);
      expect(p.items.length).toBeGreaterThanOrEqual(1);
      expect(new Set(p.items.map((it) => it.productId)).size).toBe(p.items.length); // без повторов на паллете
      for (const it of p.items) {
        expect(it.qty).toBeGreaterThanOrEqual(DELIVERY.qtyPerProduct[0]);
        expect(it.qty).toBeLessThanOrEqual(DELIVERY.qtyPerProduct[1]);
      }
    }
  });

  it('везёт то, чего на складе свободно меньше всего', () => {
    const g = noDeliveryGame(3);
    // молока и хлеба не осталось совсем — они должны приехать первыми
    const stock = Object.fromEntries(Object.entries(g.stock).filter(([, r]) => r.productId !== 'milk' && r.productId !== 'bread'));
    const s = { ...g, stock, tasks: {} };
    const next = createDelivery(s, createRng(5), 0)!;
    const products = Object.values(next.pallets).flatMap((p) => p.items.map((it) => it.productId));
    expect(products[0] === 'milk' || products[0] === 'bread').toBe(true);
    expect(products).toContain('milk');
    expect(products).toContain('bread');
  });

  it('товар на паллетах в зоне приёмки считается «уже едет»', () => {
    const g = createInitialGame(map, 2);
    const without = freeByProduct({ ...g, pallets: {} });
    const withP = freeByProduct(g);
    const onPallets: Record<string, number> = {};
    for (const p of Object.values(g.pallets)) for (const it of p.items) onPallets[it.productId] = (onPallets[it.productId] ?? 0) + it.qty;
    for (const [id, qty] of Object.entries(onPallets)) expect(withP[id]).toBe(without[id] + qty);
  });

  it('приезжает по таймеру; пока грузовик у ворот, следующая ждёт', () => {
    let s = noDeliveryGame();
    expect(tickDeliveries({ ...s, clock: { ...s.clock, time: EVERY - 1 } })).toEqual({ ...s, clock: { ...s.clock, time: EVERY - 1 } });
    s = tickDeliveries({ ...s, clock: { ...s.clock, time: EVERY } });
    expect(truckAtGate(s)).toBe(true);
    expect(s.nextDeliveryAt).toBe(EVERY * 2);
    // время следующей пришло, но грузовик ещё у ворот — новой поставки нет
    const late = tickDeliveries({ ...s, clock: { ...s.clock, time: EVERY * 2 } });
    expect(Object.keys(late.deliveries)).toHaveLength(1);
    // приняли — у ворот свободно, приезжает следующая
    const d = Object.values(s.deliveries)[0];
    const after = tickDeliveries(acceptDelivery({ ...s, clock: { ...s.clock, time: EVERY * 2 } }, d.id));
    expect(Object.keys(after.deliveries)).toHaveLength(2);
  });

  it('нет мест под паллеты — поставка не приезжает', () => {
    const g = noDeliveryGame();
    const pallets = Object.fromEntries(DELIVERY.palletSlots.map((cell, i) => [
      `p${i}`, { id: `p${i}`, deliveryId: 'old', state: 'accepted' as const, items: [{ productId: 'milk', qty: 1 }], cell },
    ]));
    const s = { ...g, pallets };
    expect(freePalletSlots(s)).toHaveLength(0);
    expect(createDelivery(s, createRng(1), 0)).toBeNull();
  });
});

describe('приёмка', () => {
  it('маршрут: в зону приёмки, но не на клетки паллет; время растёт с числом паллет', () => {
    const g = createInitialGame(map, 1);
    const [task] = receivingTasks(g);
    const job = buildReceivingJob(map, g.pickers.lucky, task);
    const walk = job.steps[0];
    expect(walk.kind).toBe('walk');
    if (walk.kind !== 'walk') return;
    const slots = new Set(DELIVERY.palletSlots.map((c) => `${c.x},${c.z}`));
    expect(walk.spots.length).toBeGreaterThan(0);
    expect(walk.spots.some((c) => slots.has(`${c.x},${c.z}`))).toBe(false);
    expect(receiveSeconds(g.pickers.lucky, 3)).toBeGreaterThan(receiveSeconds(g.pickers.lucky, 1));
    expect(etaToTask(map, g.pickers.lucky, task)).toBeGreaterThan(0);
  });

  it('сборщик идёт, принимает, паллеты приняты, грузовик уехал, деньги начислены, полки не меняются', () => {
    const g = createInitialGame(map, 1);
    const [task] = receivingTasks(g);
    let s = dispatchTask(g, map, task.id, 'lucky');
    s = { ...s, pickers: { ...s.pickers, lucky: { ...s.pickers.lucky, job: { ...s.pickers.lucky.job!, call: undefined } } } }; // без развилки: в 1-й смене она гарантирована (M8d)
    s = runUntil(s, (x) => pickerActivity(x, 'lucky').kind === 'busy');
    expect(pickerActivity(s, 'lucky')).toMatchObject({ kind: 'busy', label: 'Принимает поставку' });
    s = runUntil(s, (x) => x.tasks[task.id].status === 'done');
    const done = s.tasks[task.id];
    expect(done.status).toBe('done');
    const d = s.deliveries[task.payload.deliveryId];
    expect(d.status).toBe('received');
    for (const id of d.palletIds) expect(s.pallets[id].state).toBe('accepted');
    expect(s.money).toBe(g.money + rewardFor(done, done.outcome!).money);
    expect(s.pickers.lucky.state).toBe('idle');
  });

  it('приёмка не трогает полки', () => {
    const g = createInitialGame(map, 1);
    const [task] = receivingTasks(g);
    const s = acceptDelivery(g, task.payload.deliveryId);
    expect(s.stock).toBe(g.stock);
  });

  it('«неплохо» у приёмки — 40% денег (решение автора 14.10), у сборки — как в RESULT_SHARE', () => {
    const g = createInitialGame(map, 1);
    const [task] = receivingTasks(g);
    expect(rewardFor(task, 'withErrors').money).toBe(Math.round(task.reward.money * 0.4));
    expect(rewardFor(task, 'withErrors').rating).toBe(task.reward.rating * RESULT_SHARE.withErrors.rating);
    const order = Object.values(g.tasks).find((t) => t.type === 'order')!;
    expect(rewardFor(order, 'withErrors').money).toBe(Math.round(order.reward.money * RESULT_SHARE.withErrors.money));
  });
});
