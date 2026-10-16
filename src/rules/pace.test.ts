// Темп заданий, план смен, обучающая смена (M8d; решения автора 15.10).
import { describe, expect, it } from 'vitest';
import type { GameState } from '../model/game';
import { WAREHOUSE_LAYOUT } from '../config/warehouse';
import { ORDER, SHIFT_PLAN } from '../config/balance';
import { HINTS } from '../config/tutorial';
import { buildWarehouseMap } from './warehouse';
import { createInitialGame } from './game';
import { arriveTruckNow } from './testing';
import { advanceWorld } from './advance';
import { dispatchTask } from './tasks/lifecycle';
import { openOrders } from './tasks/generator';
import { expireTasks } from './deadline';
import { rewardFor, applyTaskResult } from './rewards';
import { endShift, startNextShift } from './shift';
import { forkPlanFor, shiftPlan, targetLoad, tickOrders, wantsOrder, workload } from './pace';
import { currentHint, markHintSeen } from './tutorial';

const map = buildWarehouseMap(WAREHOUSE_LAYOUT);
const at = (s: GameState, time: number): GameState => ({ ...s, clock: { ...s.clock, time } });
const inShift = (s: GameState, shift: number): GameState => ({ ...s, campaign: { ...s.campaign, shift } });

describe('план смен', () => {
  it('у каждой смены своя строка; дальше последней — последняя', () => {
    const g = createInitialGame(map, 1);
    SHIFT_PLAN.forEach((p, i) => expect(shiftPlan(inShift(g, i + 1))).toEqual(p));
    expect(shiftPlan(inShift(g, 99))).toEqual(SHIFT_PLAN[SHIFT_PLAN.length - 1]);
    expect(shiftPlan(g).tutorial).toBe(true);
    expect(SHIFT_PLAN.slice(1).every((p) => !p.tutorial)).toBe(true);
  });

  it('сложность растёт: загрузка и развилки больше, запас срока меньше', () => {
    for (let i = 1; i < SHIFT_PLAN.length; i++) {
      expect(SHIFT_PLAN[i].load).toBeGreaterThanOrEqual(SHIFT_PLAN[i - 1].load);
      expect(SHIFT_PLAN[i].forkChance).toBeGreaterThanOrEqual(SHIFT_PLAN[i - 1].forkChance);
      expect(SHIFT_PLAN[i].orderMargin).toBeLessThanOrEqual(SHIFT_PLAN[i - 1].orderMargin);
    }
  });

  it('вторая смена: поставка по своему интервалу, загрузка выше', () => {
    const s = startNextShift(endShift(createInitialGame(map, 1)), map);
    expect(shiftPlan(s)).toEqual(SHIFT_PLAN[1]);
    expect(targetLoad(s)).toBeCloseTo(3 * SHIFT_PLAN[1].load, 9);
    expect(workload(s)).toBeGreaterThanOrEqual(targetLoad(s));
  });
});

describe('заказы под загрузку', () => {
  it('на старте набрано ровно до загрузки', () => {
    const g = createInitialGame(map, 1);
    expect(wantsOrder(g)).toBe(false);
    expect(workload(g) - 1).toBeLessThan(targetLoad(g));
  });

  it('взяли задание — новый заказ придёт не сразу, а после паузы и только если работы мало', () => {
    let s = createInitialGame(map, 1);
    const ids = Object.keys(s.tasks);
    s = dispatchTask(s, map, openOrders(s)[0].id, 'lucky');
    // сборщик занят: «работа» не уменьшилась — заказ не нужен
    expect(wantsOrder(s)).toBe(false);
    expect(Object.keys(tickOrders(at(s, 100)).tasks)).toEqual(ids);
  });

  it('работы мало — заказ приходит, но не чаще раза в minGapSeconds', () => {
    const g = createInitialGame(map, 1);
    // убрали все задания — работы нет
    let s: GameState = { ...g, tasks: {}, deliveries: {}, pallets: {}, nextOrderAt: 10 };
    expect(Object.keys(tickOrders(at(s, 9)).tasks)).toHaveLength(0);
    s = tickOrders(at(s, 10));
    expect(Object.keys(s.tasks)).toHaveLength(1);
    expect(s.nextOrderAt).toBe(10 + ORDER.minGapSeconds);
    expect(Object.keys(tickOrders(at(s, 11)).tasks)).toHaveLength(1);
    expect(Object.keys(tickOrders(at(s, 10 + ORDER.minGapSeconds)).tasks)).toHaveLength(2);
  });

  it('в шаге мира поток не превышает загрузку', () => {
    let s = createInitialGame(map, 3);
    for (let i = 0; i < 600; i++) {
      s = advanceWorld(s, map, 0.1).state;
      expect(workload(s)).toBeLessThanOrEqual(Math.ceil(targetLoad(s)) + 2); // + задания-следствия (выкладки, списания)
    }
  });
});

describe('обучающая смена', () => {
  it('просрочка — без штрафа; во 2-й смене — со штрафом', () => {
    const g = { ...createInitialGame(map, 1), money: 1000 };
    const free = expireTasks(at(g, 10_000)).state;
    expect(free.money).toBe(1000);
    expect(free.rating).toBe(g.rating);
    const paid = expireTasks(at(inShift(g, 2), 10_000)).state;
    expect(paid.money).toBeLessThan(1000);
  });

  it('провал — ничего не отнимает, успех — даёт награду', () => {
    const g = createInitialGame(map, 1);
    const t = openOrders(g)[0];
    expect(rewardFor(t, 'failed', true)).toEqual({ money: 0, rating: 0 });
    expect(rewardFor(t, 'perfect', true)).toEqual(rewardFor(t, 'perfect'));
    const after = applyTaskResult(g, t.id, 'failed');
    expect(after.rating).toBe(g.rating);
    expect(applyTaskResult(inShift(g, 2), t.id, 'failed').rating).toBeLessThan(g.rating);
  });

  it('первая развилка каждого типа гарантирована (и с игрой на ТСД, если есть), потом — по шансу смены', () => {
    let s = createInitialGame(map, 1);
    expect(forkPlanFor(s, 'order')).toEqual({ chance: 1, guaranteed: true });
    s = dispatchTask(s, map, openOrders(s)[0].id, 'lucky');
    expect(s.pickers.lucky.job!.call).toBeDefined();
    expect(s.pickers.lucky.job!.call!.forceTsd).toBe(true);
    expect(s.campaign.tutorialForks).toEqual(['order']);
    expect(forkPlanFor(s, 'order')).toEqual({ chance: SHIFT_PLAN[0].forkChance, guaranteed: false });
    expect(forkPlanFor(inShift(createInitialGame(map, 1), 2), 'order').guaranteed).toBe(false);
  });

  it('подсказки: по одной, по порядку, каждая один раз; только в 1-й смене', () => {
    let s = createInitialGame(map, 1);
    expect(currentHint(s)).toBe('start');
    s = markHintSeen(s, 'start');
    expect(currentHint(s)).toBe('order'); // заказы есть с самого начала
    s = markHintSeen(s, 'order');
    expect(currentHint(s)).toBeNull(); // грузовик ещё едет — приёмки пока нет (W8b)
    s = arriveTruckNow(s, map);
    expect(currentHint(s)).toBe('receiving'); // встал у ворот — приёмка
    s = markHintSeen(s, 'receiving');
    expect(currentHint(s)).toBeNull(); // выкладок, списаний и развилок пока нет
    expect(markHintSeen(s, 'receiving')).toBe(s);
    expect(currentHint(inShift(createInitialGame(map, 1), 2))).toBeNull();
    expect(HINTS.map((h) => h.id)[0]).toBe('start');
  });
});
