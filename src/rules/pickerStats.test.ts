// Сборщики: шансы от покрытия требований, рост уровня и очки, усталость (docs/10, раздел 14; решения автора 20.10).
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
import { canSpendPoint, countOutcome, effectiveAccuracy, effectiveStat, growAfterTask, shiftTally, spendPoint, xpToNext } from './pickerStats';
import { canRest, endRest, sendToRest } from './rest';
import { endShift, startNextShift } from './shift';
import { pickerActivity } from './jobs';

const map = buildWarehouseMap(WAREHOUSE_LAYOUT);
const order = (s: GameState) => Object.values(s.tasks).find((t) => t.type === 'order')!;
const pct = (n: number) => Math.round(n * 100);

/** Заказ с заданными товарами (по одному на позицию), сложность 1. */
const withLines = (t: Task, products: string[]): Task => t.type === 'order'
  ? { ...t, difficulty: 1, payload: { lines: products.map((productId, i) => ({ productId, address: { aisle: 1, rack: 1, shelf: (i % 3) + 1 }, qty: 1 })) } }
  : t;

describe('шансы от покрытия требований (docs/10, раздел 14.5)', () => {
  it('пример из документа: заказ на 4 позиции с водой — Лаки 85/13/2, Коржик ≈59/31/11, Буран 72/22/6', () => {
    const g = createInitialGame(map, 1);
    const t = withLines(order(g), ['water', 'eggs', 'milk', 'chips']);
    const c = (id: string) => outcomeChances(g.pickers[id], t);
    const row = (id: string) => [pct(c(id).perfect), pct(c(id).withErrors), pct(c(id).failed)];
    expect(row('lucky')).toEqual([85, 13, 2]);
    expect(row('korzh')).toEqual([59, 31, 11]); // покрытие 15/19; округление по отдельности даёт 101
    expect(row('buran')).toEqual([72, 22, 6]);
  });

  it('сложное задание требует больше — шансы хуже; сумма всегда 1', () => {
    const g = createInitialGame(map, 1);
    const t = withLines(order(g), ['water', 'eggs', 'milk']);
    const hard = outcomeChances(g.pickers.lucky, { ...t, difficulty: 3 });
    const light = outcomeChances(g.pickers.lucky, t);
    expect(hard.perfect).toBeLessThan(light.perfect);
    for (const c of [hard, light]) expect(c.perfect + c.withErrors + c.failed).toBeCloseTo(1, 9);
  });

  it('усталость снижает все характеристики: шансы хуже, работа медленнее', () => {
    const g = createInitialGame(map, 1);
    const t = withLines(order(g), ['eggs', 'milk']);
    const fresh = g.pickers.lucky;
    const tired: Picker = { ...fresh, stats: { ...fresh.stats, fatigue: 100 } };
    expect(effectiveAccuracy(tired)).toBe(fresh.stats.accuracy - PICKER_GROWTH.fatigue.maxPenalty);
    expect(effectiveStat(tired, 'strength')).toBe(fresh.stats.strength - PICKER_GROWTH.fatigue.maxPenalty);
    expect(outcomeChances(tired, t).perfect).toBeLessThan(outcomeChances(fresh, t).perfect);
    expect(pickSeconds(tired)).toBeGreaterThan(pickSeconds(fresh));
  });
});

describe('опыт, уровень и очки (docs/10, раздел 14.8)', () => {
  it('опыт зависит от исхода: идеально +2, неплохо +1, провал 0; усталость +8%', () => {
    const p = createInitialGame(map, 1).pickers.lucky;
    expect(growAfterTask(p, 'perfect').xp).toBe(2);
    expect(growAfterTask(p, 'withErrors').xp).toBe(1);
    expect(growAfterTask(p, 'failed').xp).toBe(0);
    expect(growAfterTask(p, 'failed').stats.fatigue).toBe(PICKER_GROWTH.fatigue.perTask);
  });

  it('набрал порог — новый уровень и очко; характеристики сами не растут', () => {
    let p = createInitialGame(map, 1).pickers.lucky;
    const before = { ...p.stats };
    p = growAfterTask(p, 'perfect'); // 2 из 3
    expect(p).toMatchObject({ level: 1, xp: 2, points: 0 });
    p = growAfterTask(p, 'perfect'); // 4 → уровень 2, остаток 1
    expect(p).toMatchObject({ level: 2, xp: 4 - xpToNext(1), points: 1 });
    expect(p.stats.speed).toBe(before.speed);
    expect(p.stats.memory).toBe(before.memory);
  });

  it('очко вкладывается в характеристику, потолок — 10', () => {
    const p = { ...createInitialGame(map, 1).pickers.korzh, points: 3 };
    const a = spendPoint(p, 'accuracy');
    expect(a).toMatchObject({ points: 2 });
    expect(a.stats.accuracy).toBe(p.stats.accuracy + 1);
    const maxed = { ...p, stats: { ...p.stats, speed: 10 } };
    expect(canSpendPoint(maxed, 'speed')).toBe(false);
    expect(spendPoint(maxed, 'speed')).toBe(maxed);
    expect(spendPoint({ ...p, points: 0 }, 'memory').stats.memory).toBe(p.stats.memory);
  });

  it('в игре: закрыл заказ — опыт сборщику и усталость', () => {
    let s = createInitialGame(map, 1);
    const t = order(s);
    s = dispatchTask(s, map, t.id, 'lucky');
    s = { ...s, pickers: { ...s.pickers, lucky: { ...s.pickers.lucky, job: { ...s.pickers.lucky.job!, call: undefined } } } };
    for (let i = 0; i < 6000 && s.tasks[t.id].status !== 'done'; i++) s = advanceWorld(s, map, 0.1).state;
    const p = s.pickers.lucky;
    expect(p.stats.fatigue).toBe(PICKER_GROWTH.fatigue.perTask);
    expect(p.xp + (p.level - 1) * 3).toBe(PICKER_GROWTH.xp[s.tasks[t.id].outcome!]);
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
    const lucky = growAfterTask(growAfterTask(s.pickers.lucky, 'perfect'), 'perfect'); // уровень 2, усталость 16
    s = { ...s, pickers: { ...s.pickers, lucky }, shiftLog: [
      { kind: 'taskDone', taskId: 'a', pickerId: 'lucky', outcome: 'perfect', at: 1 },
      { kind: 'taskDone', taskId: 'b', pickerId: 'lucky', outcome: 'perfect', at: 2 },
    ] };
    s = endShift(s);
    const g = s.campaign.history[0].growth.lucky;
    expect(g.xp).toBe(4);
    expect(g).toMatchObject({ fromLevel: 1, level: 2 });
    expect(g.fatigue).toBe(16);
    const n = startNextShift(s, map);
    expect(n.pickers.lucky.stats.fatigue).toBe(8);
    expect(n.campaign.startLevels.lucky).toBe(2);
  });
});

describe('итоги сборщика для профиля (P2)', () => {
  it('закрытое задание добавляется в итоги за кампанию; без поля — считаем с нуля', () => {
    const p = createInitialGame(map, 1).pickers.lucky;
    const a = countOutcome({ ...p, tally: undefined }, 'perfect');
    const b = countOutcome(a, 'failed');
    expect(b.tally).toEqual({ done: 2, perfect: 1, withErrors: 0, failed: 1 });
  });

  it('итоги за смену — только события «задание закрыто» этого сборщика', () => {
    const log = [
      { kind: 'taskDone', pickerId: 'lucky', outcome: 'perfect' as const },
      { kind: 'taskDone', pickerId: 'korzh', outcome: 'failed' as const },
      { kind: 'taskExpired', taskId: 't1' },
      { kind: 'taskDone', pickerId: 'lucky', outcome: 'withErrors' as const },
    ];
    expect(shiftTally(log, 'lucky')).toEqual({ done: 2, perfect: 1, withErrors: 1, failed: 0 });
  });
});
