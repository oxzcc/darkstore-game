import { describe, expect, it } from 'vitest';
import type { GameState } from '../model/game';
import type { OrderTask } from '../model/task';
import type { OutcomeReveal } from '../model/call';
import { WAREHOUSE_LAYOUT } from '../config/warehouse';
import { RATING_RANGE } from '../config/balance';
import { RESULT_SHARE } from '../config/calls';
import { buildWarehouseMap } from './warehouse';
import { createInitialGame } from './game';
import { openTasks } from './tasks/generator';
import { dispatchTask } from './tasks/lifecycle';
import { advanceWorld } from './advance';
import { applyTaskResult, pickedQty, reservedQty, rewardFor, takeFromShelf } from './rewards';
import { addStock, qtyAt } from './stock';
import { parseAddress } from './address';

const map = buildWarehouseMap(WAREHOUSE_LAYOUT);
const A = parseAddress('1.1.1');

const firstOrder = (g: GameState) => openTasks(g).find((t) => t.type === 'order') as OrderTask;
const onShelves = (g: GameState, t: OrderTask) => t.payload.lines.map((l) => qtyAt(g.stock, l.address, l.productId));

describe('награда за задание (M6)', () => {
  it('доли по исходу: идеально — всё, провал — 0 ₽ и минус рейтинг', () => {
    const t = firstOrder(createInitialGame(map, 1));
    expect(rewardFor(t, 'perfect')).toEqual({ money: t.reward.money, rating: t.reward.rating });
    expect(rewardFor(t, 'withErrors').money).toBe(Math.round(t.reward.money * RESULT_SHARE.withErrors.money));
    expect(rewardFor(t, 'failed').money).toBe(0);
    expect(rewardFor(t, 'failed').rating).toBeLessThan(0);
  });

  it('итог прибавляет деньги и рейтинг и снимает собранное с полок', () => {
    const g = createInitialGame(map, 1);
    const t = firstOrder(g);
    const before = onShelves(g, t);
    const s = applyTaskResult(g, t.id, 'perfect');
    expect(s.money).toBe(g.money + t.reward.money);
    expect(s.rating).toBeCloseTo(Math.min(RATING_RANGE.max, g.rating + t.reward.rating));
    // если две позиции на одной полке — не бывает: в заказе товары разные, а на полке один товар
    expect(onShelves(s, t)).toEqual(before.map((q, i) => q - t.payload.lines[i].qty));
  });

  it('рейтинг не выходит за границы', () => {
    const g = createInitialGame(map, 1);
    const t = firstOrder(g);
    expect(applyTaskResult({ ...g, rating: RATING_RANGE.max }, t.id, 'perfect').rating).toBe(RATING_RANGE.max);
    expect(applyTaskResult({ ...g, rating: RATING_RANGE.min }, t.id, 'failed').rating).toBe(RATING_RANGE.min);
  });

  it('ошибка с количеством: снимается столько, сколько собрано', () => {
    const t = firstOrder(createInitialGame(map, 1));
    const reveal: OutcomeReveal = {
      chances: { perfect: 0.6, withErrors: 0.3, failed: 0.1 }, roll: 0.7, base: 'withErrors', calls: [], final: 'withErrors',
      errorLine: { lineIndex: 0, picked: 0 },
    };
    const picked = pickedQty(t, reveal);
    expect(picked[0]).toBe(0);
    expect(picked.slice(1)).toEqual(t.payload.lines.slice(1).map((l) => l.qty));
  });

  it('с полки сначала уходит партия с ближним сроком; больше, чем лежит, не снимается', () => {
    let s = addStock({}, { productId: 'milk', address: A, expiresAtShift: 6 }, 3);
    s = addStock(s, { productId: 'milk', address: A, expiresAtShift: 4 }, 2);
    s = takeFromShelf(s, 'milk', A, 3);
    expect(Object.values(s)).toEqual([expect.objectContaining({ expiresAtShift: 6, qty: 2 })]);
    s = takeFromShelf(s, 'milk', A, 10);
    expect(qtyAt(s, A)).toBe(0);
  });

  it('открытые заказы не обещают больше, чем лежит на полке', () => {
    const g = createInitialGame(map, 3);
    const seen = new Set<string>();
    for (const r of Object.values(g.stock)) {
      const k = `${r.productId}|${r.address.aisle}|${r.address.rack}|${r.address.shelf}`;
      if (seen.has(k)) continue;
      seen.add(k);
      expect(reservedQty(g, r.productId, r.address)).toBeLessThanOrEqual(qtyAt(g.stock, r.address, r.productId));
    }
  });

  it('целиком: заказ выполнен — деньги изменились, товар ушёл с полок', () => {
    const g = createInitialGame(map, 1);
    const t = firstOrder(g);
    let s = dispatchTask(g, map, t.id, 'lucky');
    const p = s.pickers.lucky;
    s = { ...s, pickers: { ...s.pickers, lucky: { ...p, job: p.job && { ...p.job, call: undefined } } } }; // без развилки
    const before = onShelves(g, t);
    let done = false;
    for (let i = 0; i < 6000 && !done; i++) {
      const r = advanceWorld(s, map, 0.1);
      s = r.state;
      done = r.events.some((e) => e.kind === 'taskDone' && e.taskId === t.id);
    }
    expect(done).toBe(true);
    const outcome = s.tasks[t.id].outcome!;
    expect(s.money).toBe(g.money + rewardFor(t, outcome).money);
    expect(onShelves(s, t)).toEqual(before.map((q, i) => q - t.payload.lines[i].qty));
  });
});
