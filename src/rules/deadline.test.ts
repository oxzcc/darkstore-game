// Сроки заданий и просрочка (M8b; решения автора 14.10).
import { describe, expect, it } from 'vitest';
import type { GameState } from '../model/game';
import type { Task } from '../model/task';
import { WAREHOUSE_LAYOUT } from '../config/warehouse';
import { DEADLINE, SHIFT, WRITEOFF } from '../config/balance';
import { buildWarehouseMap } from './warehouse';
import { gameWithDelivery as createInitialGame } from './testing'; // первая поставка уже у ворот (W8b)
import { advanceWorld } from './advance';
import { dispatchTask } from './tasks/lifecycle';
import { acceptDelivery } from './deliveries';
import { createPutawayTasks } from './putaway';
import { tickWriteoffs } from './writeoff';
import { rewardFor } from './rewards';
import { assignDeadlines, deadlineFor, estimateSeconds, expireTasks, penaltyFor, secondsToTake } from './deadline';
import { endShift, finishCampaign, startNextShift } from './shift';
import { shiftPlan } from './shiftPlan';

const map = buildWarehouseMap(WAREHOUSE_LAYOUT);
const ofType = <T extends Task['type']>(s: GameState, type: T) =>
  Object.values(s.tasks).filter((t): t is Extract<Task, { type: T }> => t.type === type);
const at = (s: GameState, time: number): GameState => ({ ...s, clock: { ...s.clock, time } });

describe('сроки', () => {
  it('у новых заданий есть срок: появилось + ожидание + оценка × запас', () => {
    const g = createInitialGame(map, 1);
    for (const t of Object.values(g.tasks)) {
      expect(t.deadline).not.toBeNull();
      const d = t.type === 'order' ? { ...DEADLINE.order, margin: shiftPlan(g).orderMargin } : DEADLINE.soft; // запас сборки — из плана смены (M8d)
      expect(t.deadline!).toBeCloseTo(t.createdAt + d.waitSeconds + estimateSeconds(g, map, t) * d.margin, 5);
    }
  });

  it('заказ побольше даёт больше времени', () => {
    const g = createInitialGame(map, 1);
    const orders = ofType(g, 'order').sort((a, b) => a.payload.lines.length - b.payload.lines.length);
    const small = orders[0], big = orders[orders.length - 1];
    if (small.payload.lines.length === big.payload.lines.length) return;
    expect(deadlineFor(g, map, big) - big.createdAt).toBeGreaterThan(deadlineFor(g, map, small) - small.createdAt);
  });

  it('у мягких заданий запаса больше, чем у сборки', () => {
    expect(DEADLINE.soft.margin).toBeGreaterThan(Math.max(DEADLINE.order.margin, shiftPlan(createInitialGame(map, 1)).orderMargin));
    expect(DEADLINE.soft.waitSeconds).toBeGreaterThan(DEADLINE.order.waitSeconds);
  });
});

describe('просрочка', () => {
  it('сборка: исчезает, штраф деньгами (не ниже 0) и рейтингом', () => {
    const g0 = createInitialGame(map, 1);
    const g = { ...g0, money: 1000, campaign: { ...g0.campaign, shift: 2 } }; // обучающая 1-я смена — без штрафов (M8d)
    const o = ofType(g, 'order')[0];
    const { state, events } = expireTasks(at(g, o.deadline!));
    expect(state.tasks[o.id].status).toBe('expired');
    const pen = penaltyFor(o);
    expect(events.find((e) => e.kind === 'taskExpired' && e.taskId === o.id)).toBeTruthy();
    expect(state.money).toBeLessThanOrEqual(1000 - pen.money);
    expect(state.rating).toBeLessThan(g.rating);
  });

  it('денег нет — ниже 0 не уходит', () => {
    const g = { ...createInitialGame(map, 1), money: 0 };
    const { state } = expireTasks(at(g, 10_000));
    expect(state.money).toBe(0);
  });

  it('взятое задание не просрочивается (решение автора 14.10)', () => {
    let s = createInitialGame(map, 1);
    const o = ofType(s, 'order')[0];
    s = dispatchTask(s, map, o.id, 'lucky');
    const { state } = expireTasks(at(s, o.deadline! + 1000));
    expect(state.tasks[o.id].status).not.toBe('expired');
    expect(secondsToTake(state, state.tasks[o.id])).toBeNull();
  });

  it('приёмка: грузовик уезжает вместе с непринятыми паллетами', () => {
    const g = createInitialGame(map, 1);
    const r = ofType(g, 'receiving')[0];
    const d = g.deliveries[r.payload.deliveryId];
    const { state } = expireTasks(at(g, r.deadline!));
    expect(state.tasks[r.id].status).toBe('expired');
    expect(state.deliveries[d.id]).toBeUndefined();
    for (const id of d.palletIds) expect(state.pallets[id]).toBeUndefined();
  });

  it('выкладка и списание: штраф один раз, задание остаётся, но без награды', () => {
    const g = createInitialGame(map, 1);
    const r = ofType(g, 'receiving')[0];
    let s = createPutawayTasks(acceptDelivery(g, r.payload.deliveryId), map, r.payload.deliveryId);
    s = tickWriteoffs(at(s, WRITEOFF.firstAtSeconds));
    s = assignDeadlines(s, map);
    s = { ...s, tasks: Object.fromEntries(Object.entries(s.tasks).filter(([, t]) => t.type === 'putaway' || t.type === 'writeoff')) };
    const late = Math.max(...Object.values(s.tasks).map((t) => t.deadline!));
    const first = expireTasks(at(s, late));
    for (const t of Object.values(first.state.tasks)) {
      expect(t.status).toBe('new');
      expect(t.overdue).toBe(true);
      expect(rewardFor(t, 'perfect')).toEqual({ money: 0, rating: 0 });
    }
    expect(first.events).toHaveLength(Object.keys(s.tasks).length);
    // второй раз не штрафуется
    expect(expireTasks(at(first.state, late + 100)).events).toHaveLength(0);
  });

  it('в шаге мира: просрочка попадает в журнал смены и в итог', () => {
    const g = createInitialGame(map, 1);
    const o = ofType(g, 'order')[0];
    const { state, events } = advanceWorld(at(g, o.deadline! - 0.05), map, 0.1);
    expect(events.some((e) => e.kind === 'taskExpired' && e.taskId === o.id)).toBe(true);
    expect(state.shiftLog.some((e) => e.kind === 'taskExpired')).toBe(true);
  });
});

describe('порог рейтинга', () => {
  it('рейтинг ниже порога в конце смены — кампания проиграна, новой смены нет', () => {
    const g = createInitialGame(map, 1);
    const s = endShift({ ...g, rating: SHIFT.loseRating - 0.01 });
    expect(s.campaign.lost).toBe(true);
    expect(startNextShift(s, map)).toBe(s);
    expect(finishCampaign(s).campaign.phase).toBe('over');
  });

  it('рейтинг не ниже порога — играем дальше', () => {
    const g = createInitialGame(map, 1);
    const s = endShift({ ...g, rating: SHIFT.loseRating });
    expect(s.campaign.lost).toBe(false);
    expect(startNextShift(s, map).campaign.shift).toBe(2);
  });
});
