// Сборщики растут и устают (M8c; решения автора 15.10).
import { describe, expect, it } from 'vitest';
import type { GameState } from '../model/game';
import type { Picker } from '../model/picker';
import type { Task } from '../model/task';
import { WAREHOUSE_LAYOUT } from '../config/warehouse';
import { PICKER_GROWTH } from '../config/balance';
import { buildWarehouseMap } from './warehouse';
import { createInitialGame } from './game';
import { advanceWorld } from './advance';
import { canAssign, dispatchTask } from './tasks/lifecycle';
import { outcomeChances } from './outcome';
import { pickSeconds } from './time';
import { effectiveAccuracy, growAfterTask, xpToNext } from './pickerStats';
import { canRest, endRest, sendToRest } from './rest';
import { endShift, startNextShift } from './shift';
import { pickerActivity } from './jobs';

const map = buildWarehouseMap(WAREHOUSE_LAYOUT);
const order = (s: GameState) => Object.values(s.tasks).find((t) => t.type === 'order')!;
const easy = (t: Task): Task => ({ ...t, difficulty: 1 });
const pct = (n: number) => Math.round(n * 100);

describe('шансы по характеристикам', () => {
  it('стартовые шансы как в утверждённой таблице: Лаки 60/30/10, Коржик 50/36/14, Буран 70/24/6', () => {
    const g = createInitialGame(map, 1);
    const t = easy(order(g));
    const c = (id: string) => outcomeChances(g.pickers[id], t);
    expect([pct(c('lucky').perfect), pct(c('lucky').withErrors), pct(c('lucky').failed)]).toEqual([60, 30, 10]);
    expect([pct(c('korzh').perfect), pct(c('korzh').withErrors), pct(c('korzh').failed)]).toEqual([50, 36, 14]);
    expect([pct(c('buran').perfect), pct(c('buran').withErrors), pct(c('buran').failed)]).toEqual([70, 24, 6]);
  });

  it('сложное задание — шансы хуже; сумма всегда 1', () => {
    const g = createInitialGame(map, 1);
    const t = order(g);
    const hard = outcomeChances(g.pickers.lucky, { ...t, difficulty: 3 });
    const light = outcomeChances(g.pickers.lucky, { ...t, difficulty: 1 });
    expect(hard.perfect).toBeLessThan(light.perfect);
    expect(hard.failed).toBeGreaterThan(light.failed);
    for (const c of [hard, light]) expect(c.perfect + c.withErrors + c.failed).toBeCloseTo(1, 9);
  });

  it('усталость ухудшает шансы и замедляет работу; специализация — наоборот', () => {
    const g = createInitialGame(map, 1);
    const t = easy(order(g));
    const fresh = g.pickers.lucky;
    const tired: Picker = { ...fresh, stats: { ...fresh.stats, fatigue: 100 } };
    const skilled: Picker = { ...fresh, specialization: { ...fresh.specialization, order: { level: 3, xp: 0 } } };
    expect(effectiveAccuracy(tired, 'order')).toBe(fresh.stats.accuracy - PICKER_GROWTH.fatigue.maxPenalty);
    expect(outcomeChances(tired, t).perfect).toBeLessThan(outcomeChances(fresh, t).perfect);
    expect(pickSeconds(tired)).toBeGreaterThan(pickSeconds(fresh));
    expect(outcomeChances(skilled, t).perfect).toBeGreaterThan(outcomeChances(fresh, t).perfect);
    expect(pickSeconds(skilled)).toBeLessThan(pickSeconds(fresh));
    // специализация другого типа на сборку не влияет
    const otherSkill: Picker = { ...fresh, specialization: { ...fresh.specialization, putaway: { level: 5, xp: 0 } } };
    expect(outcomeChances(otherSkill, t)).toEqual(outcomeChances(fresh, t));
  });
});

describe('опыт и усталость после задания', () => {
  it('опыт зависит от исхода: идеально +2, неплохо +1, провал 0; усталость +8%', () => {
    const p = createInitialGame(map, 1).pickers.lucky;
    expect(growAfterTask(p, 'order', 'perfect').specialization.order.xp).toBe(2);
    expect(growAfterTask(p, 'order', 'withErrors').specialization.order.xp).toBe(1);
    expect(growAfterTask(p, 'order', 'failed').specialization.order.xp).toBe(0);
    expect(growAfterTask(p, 'order', 'failed').stats.fatigue).toBe(PICKER_GROWTH.fatigue.perTask);
  });

  it('набрал порог — уровень специализации растёт; потолок — 5; растёт только специализация', () => {
    let p = createInitialGame(map, 1).pickers.lucky;
    const { speed, accuracy } = p.stats;
    p = growAfterTask(p, 'order', 'perfect'); // 2 из 3
    expect(p.specialization.order).toEqual({ level: 1, xp: 2 });
    p = growAfterTask(p, 'order', 'perfect'); // 4 → уровень 2, остаток 1
    expect(p.specialization.order).toEqual({ level: 2, xp: 4 - xpToNext(1) });
    for (let i = 0; i < 40; i++) p = growAfterTask(p, 'order', 'perfect');
    expect(p.specialization.order).toEqual({ level: PICKER_GROWTH.spec.maxLevel, xp: 0 });
    expect(p.stats.speed).toBe(speed);
    expect(p.stats.accuracy).toBe(accuracy);
    expect(p.stats.fatigue).toBe(100); // не выше 100
  });

  it('в игре: закрыл заказ — опыт в «Сборке» и усталость', () => {
    let s = createInitialGame(map, 1);
    const t = order(s);
    s = dispatchTask(s, map, t.id, 'lucky');
    s = { ...s, pickers: { ...s.pickers, lucky: { ...s.pickers.lucky, job: { ...s.pickers.lucky.job!, call: undefined } } } };
    for (let i = 0; i < 6000 && s.tasks[t.id].status !== 'done'; i++) s = advanceWorld(s, map, 0.1).state;
    const p = s.pickers.lucky;
    expect(p.stats.fatigue).toBe(PICKER_GROWTH.fatigue.perTask);
    expect(p.specialization.order.xp + (p.specialization.order.level - 1) * 3).toBe(PICKER_GROWTH.spec.xp[s.tasks[t.id].outcome!]);
  });
});

describe('перерыв', () => {
  const tiredGame = (fatigue: number) => {
    const g = createInitialGame(map, 1);
    return { ...g, pickers: { ...g.pickers, lucky: { ...g.pickers.lucky, stats: { ...g.pickers.lucky.stats, fatigue } } } };
  };

  it('свежего на перерыв не отправить; уставшего — да, и его нельзя назначить', () => {
    expect(canRest(createInitialGame(map, 1).pickers.lucky)).toBe(false);
    const s = sendToRest(tiredGame(50), map, 'lucky');
    expect(s.pickers.lucky.state).toBe('resting');
    expect(canAssign(s, order(s).id, 'lucky').ok).toBe(false);
  });

  it('в зоне отдыха усталость падает на 3% в секунду; отдохнул — сам свободен', () => {
    let s = sendToRest(tiredGame(30), map, 'lucky');
    for (let i = 0; i < 600 && pickerActivity(s, 'lucky').kind !== 'resting'; i++) s = advanceWorld(s, map, 0.1).state;
    expect(pickerActivity(s, 'lucky').kind).toBe('resting');
    const before = s.pickers.lucky.stats.fatigue;
    s = advanceWorld(s, map, 1).state; // кадр обрезается до TIMING.maxFrameSeconds — считаем по факту
    expect(s.pickers.lucky.stats.fatigue).toBeLessThan(before);
    for (let i = 0; i < 2000 && s.pickers.lucky.state === 'resting'; i++) s = advanceWorld(s, map, 0.1).state;
    expect(s.pickers.lucky.state).toBe('idle');
    expect(s.pickers.lucky.stats.fatigue).toBe(0);
  });

  it('«Вернуть» — сразу свободен', () => {
    const s = endRest(sendToRest(tiredGame(50), map, 'lucky'), 'lucky');
    expect(s.pickers.lucky).toMatchObject({ state: 'idle', job: null });
    expect(s.pickers.lucky.stats.fatigue).toBe(50);
  });
});

describe('между сменами и в итогах', () => {
  it('усталость за ночь падает вдвое; в итогах — опыт, рост уровня, усталость', () => {
    let s = createInitialGame(map, 1);
    const lucky = growAfterTask(growAfterTask(s.pickers.lucky, 'order', 'perfect'), 'order', 'perfect'); // уровень 2, усталость 16
    s = { ...s, pickers: { ...s.pickers, lucky }, shiftLog: [
      { kind: 'taskDone', taskId: 'a', pickerId: 'lucky', outcome: 'perfect', at: 1 },
      { kind: 'taskDone', taskId: 'b', pickerId: 'lucky', outcome: 'perfect', at: 2 },
    ] };
    s = endShift(s);
    const g = s.campaign.history[0].growth.lucky;
    expect(g.xp).toBe(4);
    expect(g.levelUps).toEqual([{ type: 'order', level: 2 }]);
    expect(g.fatigue).toBe(16);
    const n = startNextShift(s, map);
    expect(n.pickers.lucky.stats.fatigue).toBe(8);
    expect(n.campaign.startLevels.lucky.order).toBe(2);
  });
});
