// Смена и кампания (M8a).
import { describe, expect, it } from 'vitest';
import type { GameState } from '../model/game';
import { WAREHOUSE_LAYOUT } from '../config/warehouse';
import { SHIFT, WRITEOFF } from '../config/balance';
import { PRODUCTS } from '../config/products';
import { buildWarehouseMap } from './warehouse';
import { gameWithDelivery as createInitialGame } from './testing'; // первая поставка уже у ворот (W8b)
import { advanceWorld } from './advance';
import { dispatchTask } from './tasks/lifecycle';
import { openOrders } from './tasks/generator';
import { acceptDelivery } from './deliveries';
import { isExpiring } from './stock';
import { endShift, finishCampaign, shiftResult, shiftSecondsLeft, spendPointInSummary, starsFor, startNextShift } from './shift';

const map = buildWarehouseMap(WAREHOUSE_LAYOUT);

const atTime = (s: GameState, time: number): GameState => ({ ...s, clock: { ...s.clock, time } });

describe('таймер смены', () => {
  it('новая игра — смена 1 из 5, идёт, до конца 10 минут', () => {
    const g = createInitialGame(map, 1);
    expect(g.campaign).toMatchObject({ shift: 1, totalShifts: SHIFT.totalShifts, phase: 'running', history: [] });
    expect(shiftSecondsLeft(g)).toBe(SHIFT.durationSeconds);
  });

  it('время вышло — итоги, мир дальше не идёт', () => {
    const g = atTime(createInitialGame(map, 1), SHIFT.durationSeconds - 0.05);
    const s = advanceWorld(g, map, 0.1).state;
    expect(s.campaign.phase).toBe('summary');
    expect(s.clock.time).toBe(SHIFT.durationSeconds);
    expect(s.campaign.history).toHaveLength(1);
    expect(advanceWorld(s, map, 0.1).state).toBe(s); // на итогах ничего не меняется
  });
});

describe('итоги смены', () => {
  it('звёзды по доле закрытых: от 40% — 1, от 60% — 2, от 80% — 3', () => {
    expect(starsFor(0, 0)).toBe(0);
    expect(starsFor(3, 10)).toBe(0);
    expect(starsFor(4, 10)).toBe(1);
    expect(starsFor(6, 10)).toBe(2);
    expect(starsFor(8, 10)).toBe(3);
  });

  it('считает закрытые по исходам, открытые, деньги и сборщиков', () => {
    let s = createInitialGame(map, 1);
    const t = openOrders(s)[0];
    s = dispatchTask(s, map, t.id, 'lucky');
    s = { ...s, pickers: { ...s.pickers, lucky: { ...s.pickers.lucky, job: { ...s.pickers.lucky.job!, call: undefined } } } };
    for (let i = 0; i < 6000 && s.tasks[t.id]?.status !== 'done'; i++) s = advanceWorld(s, map, 0.1).state;
    const r = shiftResult(s);
    expect(r.closed).toBe(1);
    expect(r.byOutcome[s.tasks[t.id].outcome!]).toBe(1);
    expect(r.pickers.lucky).toBe(1);
    expect(r.appeared).toBe(1 + Object.values(s.tasks).filter((x) => x.status !== 'done').length);
    expect(r.money).toBe(s.money - s.campaign.startMoney);
  });
});

describe('следующая смена', () => {
  it('номер +1, время с нуля, незакрытые задания исчезли, сборщики свободны, деньги остались', () => {
    let s = createInitialGame(map, 1);
    s = dispatchTask(s, map, openOrders(s)[0].id, 'lucky');
    s = endShift({ ...s, money: 500 });
    const n = startNextShift(s, map);
    expect(n.campaign).toMatchObject({ shift: 2, phase: 'running', startMoney: 500 });
    expect(n.clock.time).toBe(0);
    expect(n.money).toBe(500);
    expect(Object.values(n.pickers).every((p) => p.state === 'idle' && p.job === null)).toBe(true);
    expect(n.shiftLog).toEqual([]);
    // старых заданий нет — только новые заказы и поставка новой смены
    expect(Object.values(n.tasks).every((t) => t.status === 'new')).toBe(true);
    expect(Object.keys(n.tasks).some((id) => s.tasks[id])).toBe(false);
  });

  it('непринятый грузовик уезжает с паллетами, принятые паллеты получают «Выкладки» заново', () => {
    const g = createInitialGame(map, 1);
    // поставка 1 принята (паллеты ждут выкладки), а потом приехала ещё одна и стоит у ворот
    const first = Object.values(g.deliveries)[0];
    let s = acceptDelivery(g, first.id);
    s = endShift(s);
    const n = startNextShift(s, map);
    for (const id of first.palletIds) expect(n.pallets[id]?.state).toBe('accepted');
    const putaways = Object.values(n.tasks).filter((t) => t.type === 'putaway');
    expect(putaways.map((t) => t.type === 'putaway' && t.payload.palletId)).toEqual(first.palletIds);
  });

  it('у ворот был грузовик — уехал вместе с непринятыми паллетами', () => {
    const g = createInitialGame(map, 1);
    const d = Object.values(g.deliveries)[0];
    const n = startNextShift(endShift(g), map);
    expect(n.deliveries[d.id]).toBeUndefined();
    for (const id of d.palletIds) expect(n.pallets[id]).toBeUndefined();
  });

  it('календарь: в новой смене истекает то, у чего срок — эта смена', () => {
    const g = createInitialGame(map, 1);
    const bread = Object.values(g.stock).find((r) => r.productId === 'bread' && r.expiresAtShift === 1 + PRODUCTS.bread.shelfLifeShifts)!;
    expect(isExpiring(bread, g.campaign.shift)).toBe(false);
    let s = g;
    for (let i = 1; i < 1 + PRODUCTS.bread.shelfLifeShifts; i++) s = startNextShift(endShift(s), map);
    expect(isExpiring(bread, s.campaign.shift)).toBe(true);
    // истекающий хлеб даёт «Списание» в своё время
    s = advanceWorld(atTime(s, WRITEOFF.firstAtSeconds - 0.05), map, 0.1).state;
    expect(Object.values(s.tasks).some((t) => t.type === 'writeoff')).toBe(true);
  });

  it('после последней смены — не новая смена, а итоги кампании', () => {
    let s = createInitialGame(map, 1);
    for (let i = 1; i < SHIFT.totalShifts; i++) s = startNextShift(endShift(s), map);
    s = endShift(s);
    expect(s.campaign.shift).toBe(SHIFT.totalShifts);
    expect(startNextShift(s, map)).toBe(s);
    const over = finishCampaign(s);
    expect(over.campaign.phase).toBe('over');
    expect(over.campaign.history).toHaveLength(SHIFT.totalShifts);
  });
});

describe('очки в итогах смены (X3)', () => {
  it('вкладываются только на экране итогов; невложенные переходят в следующую смену', () => {
    const g0 = createInitialGame(map, 1);
    const g = { ...g0, pickers: { ...g0.pickers, lucky: { ...g0.pickers.lucky, points: 2 } } };
    expect(spendPointInSummary(g, 'lucky', 'memory')).toBe(g); // смена идёт — нельзя
    const s = endShift(g);
    const a = spendPointInSummary(s, 'lucky', 'memory');
    expect(a.pickers.lucky).toMatchObject({ points: 1 });
    expect(a.pickers.lucky.stats.memory).toBe(g.pickers.lucky.stats.memory + 1);
    expect(spendPointInSummary(a, 'nobody', 'memory')).toBe(a);
    const next = startNextShift(a, map);
    expect(next.pickers.lucky.points).toBe(1);
    expect(next.pickers.lucky.stats.memory).toBe(g.pickers.lucky.stats.memory + 1);
  });
});
