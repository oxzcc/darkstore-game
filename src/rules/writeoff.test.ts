// Списание (M7e1; docs/10, раздел 13.4).
import { describe, expect, it } from 'vitest';
import type { GameState } from '../model/game';
import type { WriteoffTask } from '../model/task';
import { WAREHOUSE_LAYOUT } from '../config/warehouse';
import { REWARD, WRITEOFF } from '../config/balance';
import { EXPIRING_STOCK } from '../config/initialStock';
import { buildWarehouseMap } from './warehouse';
import { createInitialGame } from './game';
import { dispatchTask } from './tasks/lifecycle';
import { advanceWorld } from './advance';
import { buildWriteoffJob, pickerActivity } from './jobs';
import { parseAddress } from './address';
import { isExpiring, qtyAt, sellableQtyAt } from './stock';
import { takeFromShelf } from './rewards';
import { createOrder } from './tasks/generator';
import { createRng } from './random';
import { pendingWriteoffs, tickWriteoffs } from './writeoff';

const map = buildWarehouseMap(WAREHOUSE_LAYOUT);
const writeoffs = (s: GameState) => Object.values(s.tasks).filter((t): t is WriteoffTask => t.type === 'writeoff');

function runUntil(s: GameState, done: (s: GameState) => boolean, limitSec = 900) {
  for (let t = 0; t < limitSec && !done(s); t += 0.1) s = advanceWorld(s, map, 0.1).state;
  return s;
}

/** Время смены переставлено, ничего больше не происходит. */
const at = (s: GameState, time: number): GameState => ({ ...s, clock: { ...s.clock, time } });

describe('партии «истекает сегодня»', () => {
  it('на старте лежат на полках рядом с обычными партиями того же товара', () => {
    const g = createInitialGame(map, 1);
    const expiring = Object.values(g.stock).filter((r) => isExpiring(r));
    expect(expiring).toHaveLength(EXPIRING_STOCK.length);
    for (const e of EXPIRING_STOCK) {
      const a = parseAddress(e.address);
      expect(qtyAt(g.stock, a, e.productId) - sellableQtyAt(g.stock, a, e.productId)).toBe(e.qty);
    }
  });

  it('не продаются: заказ их не обещает, сборщик их не берёт', () => {
    const g = createInitialGame(map, 1);
    const e = EXPIRING_STOCK[0];
    const a = parseAddress(e.address);
    // со всей полки берём больше, чем есть продаваемого: истекающая партия остаётся
    const after = takeFromShelf(g.stock, e.productId, a, 100);
    expect(qtyAt(after, a, e.productId)).toBe(e.qty);
    // заказы: на всём складе осталась только истекающая партия — заказ не создаётся
    const only = Object.fromEntries(Object.entries(g.stock).filter(([, r]) => isExpiring(r)));
    expect(createOrder({ ...g, stock: only, tasks: {} }, createRng(1), 0)).toBeNull();
  });
});

describe('задание «Списание»', () => {
  it('появляются по одному: первое через firstAtSeconds, следующее — через everySeconds', () => {
    const g = createInitialGame(map, 1);
    expect(writeoffs(g)).toHaveLength(0);
    expect(writeoffs(tickWriteoffs(at(g, WRITEOFF.firstAtSeconds - 1)))).toHaveLength(0);
    let s = tickWriteoffs(at(g, WRITEOFF.firstAtSeconds));
    expect(writeoffs(s)).toHaveLength(1);
    s = tickWriteoffs(at(s, WRITEOFF.firstAtSeconds + 1));
    expect(writeoffs(s)).toHaveLength(1); // рано
    s = tickWriteoffs(at(s, WRITEOFF.firstAtSeconds + WRITEOFF.everySeconds));
    expect(writeoffs(s)).toHaveLength(2);
    // на одну партию — одно задание
    const ids = writeoffs(s).map((t) => t.payload.stockRecordId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('все партии получили задания — новых нет', () => {
    let s = createInitialGame(map, 1);
    for (let i = 0; i < EXPIRING_STOCK.length + 2; i++) s = tickWriteoffs(at(s, WRITEOFF.firstAtSeconds + i * WRITEOFF.everySeconds));
    expect(writeoffs(s)).toHaveLength(EXPIRING_STOCK.length);
    expect(pendingWriteoffs(s)).toEqual([]);
  });

  it('содержимое: товар, адрес, количество, награда ×0,6', () => {
    const s = tickWriteoffs(at(createInitialGame(map, 1), WRITEOFF.firstAtSeconds));
    const [t] = writeoffs(s);
    const rec = s.stock[t.payload.stockRecordId];
    expect(t.payload).toMatchObject({ productId: rec.productId, address: rec.address, qty: rec.qty });
    expect(t.reward.money).toBe(REWARD.moneyPerDifficulty * REWARD.typeFactor.writeoff);
  });

  it('маршрут: к полке → «Снимает с полки» → в брак → «Сдаёт в брак»', () => {
    const s = tickWriteoffs(at(createInitialGame(map, 1), WRITEOFF.firstAtSeconds));
    const job = buildWriteoffJob(map, s.pickers.lucky, writeoffs(s)[0]);
    expect(job.steps.map((x) => x.kind)).toEqual(['walk', 'work', 'walk', 'work']);
    expect(job.steps[1]).toMatchObject({ label: 'Снимает с полки' });
    expect(job.steps[2]).toMatchObject({ label: 'в брак' });
    expect(job.steps[3]).toMatchObject({ label: 'Сдаёт в брак' });
  });

  it('сборщик снимает партию и сдаёт в брак: она уходит со склада, обычные партии на полке остаются', () => {
    let s = tickWriteoffs(at(createInitialGame(map, 1), WRITEOFF.firstAtSeconds));
    const [t] = writeoffs(s);
    const before = sellableQtyAt(s.stock, t.payload.address, t.payload.productId);
    // без развилки — проверяем само задание (развилки у списания — M7e2)
    s = dispatchTask(s, map, t.id, 'lucky');
    s = { ...s, pickers: { ...s.pickers, lucky: { ...s.pickers.lucky, job: { ...s.pickers.lucky.job!, call: undefined } } } };
    s = runUntil(s, (x) => pickerActivity(x, 'lucky').kind === 'busy');
    expect(pickerActivity(s, 'lucky')).toMatchObject({ kind: 'busy', label: 'Снимает с полки' });
    s = runUntil(s, (x) => x.tasks[t.id].status === 'done');
    expect(s.stock[t.payload.stockRecordId]).toBeUndefined();
    expect(sellableQtyAt(s.stock, t.payload.address, t.payload.productId)).toBeLessThanOrEqual(before); // заказы могли что-то забрать
    expect(s.money).toBeGreaterThanOrEqual(0);
  });
});
