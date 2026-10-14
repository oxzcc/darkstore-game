// Развилки приёмки и выкладки (M7d1; docs/10, раздел 13).
import { describe, expect, it } from 'vitest';
import type { GameState, ShiftEvent } from '../model/game';
import type { PutawayTask, ReceivingTask, WriteoffTask } from '../model/task';
import { WAREHOUSE_LAYOUT } from '../config/warehouse';
import { CALLS, EXPIRY, SITUATIONS, TSD_OPTION_ID } from '../config/calls';
import { WRITEOFF } from '../config/balance';
import { buildWarehouseMap } from './warehouse';
import { createInitialGame } from './game';
import { dispatchTask } from './tasks/lifecycle';
import { advanceWorld } from './advance';
import { buildPutawayJob, buildReceivingJob, buildWriteoffJob } from './jobs';
import { answerCall, callText, fillText, lineContext, planCall } from './calls';
import { taskLines } from './taskLines';
import { acceptDelivery } from './deliveries';
import { createPutawayTasks } from './putaway';
import { createRng } from './random';
import { closeTsdGame } from './tsdGame';
import { tickWriteoffs } from './writeoff';
import { createExpiryUnits, scoreExpiry } from './minigames/expiry';

const map = buildWarehouseMap(WAREHOUSE_LAYOUT);

const receiving = (s: GameState) => Object.values(s.tasks).find((t): t is ReceivingTask => t.type === 'receiving')!;
const putaways = (s: GameState) => Object.values(s.tasks).filter((t): t is PutawayTask => t.type === 'putaway');

function afterReceiving(seed = 1): GameState {
  const g = createInitialGame(map, seed);
  const r = receiving(g);
  return createPutawayTasks(acceptDelivery(g, r.payload.deliveryId), map, r.payload.deliveryId);
}

function runUntil(s: GameState, done: (s: GameState) => boolean, limitSec = 900) {
  const events: ShiftEvent[] = [];
  for (let t = 0; t < limitSec && !done(s); t += 0.1) {
    const r = advanceWorld(s, map, 0.1);
    s = r.state;
    events.push(...r.events);
  }
  return { s, events };
}

describe('где сборщик зовёт', () => {
  it('приёмка — перед работой, про один из товаров поставки', () => {
    const g = createInitialGame(map, 1);
    const r = receiving(g);
    const lines = taskLines(g, r);
    for (let seed = 1; seed <= 20; seed++) {
      const job = planCall(buildReceivingJob(map, g.pickers.lucky, r), r, createRng(seed), 1, lines.length);
      expect(job.call).toBeDefined();
      expect(job.steps[job.call!.stepIndex].kind).toBe('work');
      expect(job.call!.lineIndex).toBeLessThan(lines.length);
      expect(SITUATIONS.find((x) => x.id === job.call!.situationId)!.taskType).toBe('receiving');
    }
  });

  it('выкладка — у полки, перед выкладкой этой позиции', () => {
    const s = afterReceiving();
    const t = putaways(s)[0];
    for (let seed = 1; seed <= 20; seed++) {
      const job = planCall(buildPutawayJob(map, s.pickers.lucky, t), t, createRng(seed), 1);
      const step = job.steps[job.call!.stepIndex];
      expect(step.kind).toBe('place');
      if (step.kind === 'place') expect(job.call!.lineIndex).toBe(step.lineIndex);
      expect(SITUATIONS.find((x) => x.id === job.call!.situationId)!.taskType).toBe('putaway');
    }
  });

  it('шанс 0 — развилки нет', () => {
    const g = createInitialGame(map, 1);
    const r = receiving(g);
    expect(planCall(buildReceivingJob(map, g.pickers.lucky, r), r, createRng(1), 0, 3).call).toBeUndefined();
  });
});

describe('тексты', () => {
  it('у всех ситуаций приёмки и выкладки подстановки заполняются целиком', () => {
    const s = afterReceiving();
    const r = receiving(s);
    const t = putaways(s)[0];
    for (const sit of SITUATIONS.filter((x) => x.taskType === 'receiving' || x.taskType === 'putaway')) {
      const ctx = { ...lineContext(s, sit.taskType === 'receiving' ? r.id : t.id, 0, 'lucky'), seconds: 10 };
      const texts = [sit.speech, ...sit.options.flatMap((o) => [o.description, o.okTitle, o.okText, o.badTitle, o.badText])];
      for (const text of texts) {
        const filled = fillText(text, ctx);
        expect(filled.includes('{')).toBe(false);
        expect(filled.includes('—  ')).toBe(false);
      }
      expect(sit.options.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('у приёмки вместо адреса — номер паллеты, у выкладки — адрес полки', () => {
    const s = afterReceiving();
    const r = receiving(s);
    expect(lineContext(s, r.id, 0, 'lucky').address).toBe('паллете 1');
    const t = putaways(s)[0];
    const l = t.payload.lines[0];
    expect(lineContext(s, t.id, 0, 'lucky').address).toBe(`${l.address.aisle}.${l.address.rack}.${l.address.shelf}`);
  });
});

describe('развилка в работе', () => {
  it('приёмка с развилкой: сборщик зовёт, ответ — задержка и исход от развилки, окно итога', () => {
    const g = createInitialGame(map, 1);
    const r = receiving(g);
    // отправить и гарантировать развилку
    let s = dispatchTask(g, map, r.id, 'lucky');
    const p = s.pickers.lucky;
    const job = planCall({ ...p.job!, call: undefined }, r, createRng(7), 1, taskLines(s, r).length);
    s = { ...s, pickers: { ...s.pickers, lucky: { ...p, job } } };

    ({ s } = runUntil(s, (x) => x.calls.some((c) => c.expiresAt !== null)));
    const call = s.calls[0];
    expect(call.taskId).toBe(r.id);
    expect(callText(s, call).length).toBeGreaterThan(10);

    const option = SITUATIONS.find((x) => x.id === call.situationId)!.options.find((o) => call.optionIds.includes(o.id))!;
    s = answerCall(s, call.id, option.id);
    expect(s.tasks[r.id].callLog).toHaveLength(1);

    const res = runUntil(s, (x) => x.tasks[r.id].status === 'done');
    const done = res.events.find((e) => e.kind === 'taskDone' && e.taskId === r.id);
    expect(done && done.kind === 'taskDone' && done.reveal).toBeTruthy();
    // приёмка закрыта при любом исходе: паллеты приняты, появились выкладки
    expect(res.s.deliveries[r.payload.deliveryId].status).toBe('received');
    expect(putaways(res.s).length).toBeGreaterThan(0);
  });
});

describe('ТСД в развилках выкладки (M7d2)', () => {
  it('у «штрихкода» и «старой партии» выкладки есть игры; у приёмки — нет (решение автора 14.10)', () => {
    const byId = Object.fromEntries(SITUATIONS.map((x) => [x.id, x]));
    expect(byId.p_barcode.tsdGame).toBe('barcode');
    expect(byId.p_oldDeep.tsdGame).toBe('depth');
    expect(SITUATIONS.filter((x) => x.taskType === 'receiving' && x.tsdGame)).toEqual([]);
  });

  it('«Взять ТСД» на выкладке: игра у полки этой позиции, итог — ответ на развилку, сборщик работает дальше', () => {
    const s0 = afterReceiving();
    const t = putaways(s0)[0];
    let s = dispatchTask(s0, map, t.id, 'lucky');
    const p = s.pickers.lucky;
    // развилка «штрихкод» на первой позиции выкладки
    const stepIndex = p.job!.steps.findIndex((x) => x.kind === 'place');
    s = { ...s, pickers: { ...s.pickers, lucky: { ...p, job: { ...p.job!, call: { stepIndex, lineIndex: 0, situationId: 'p_barcode', raised: false } } } } };
    ({ s } = runUntil(s, (x) => x.calls.some((c) => c.expiresAt !== null)));
    const call = s.calls[0];
    if (!CALLS.forceTsd && call.tsd === null) return; // вариант ТСД выпадает с шансом — тут его не было
    expect(call.tsd).toBe('barcode');

    s = answerCall(s, call.id, TSD_OPTION_ID);
    expect(s.tsdGame?.kind).toBe('barcode');
    expect(s.tsdGame?.address).toEqual(t.payload.lines[0].address);
    expect(s.pickers.lucky.state).toBe('playing');

    s = closeTsdGame({ ...s, tsdGame: { ...s.tsdGame!, result: 'perfect' } });
    expect(s.tsdGame).toBeNull();
    expect(s.tasks[t.id].callLog?.at(-1)).toMatchObject({ optionId: TSD_OPTION_ID, tsd: 'perfect' });
    const res = runUntil(s, (x) => x.tasks[t.id].status === 'done');
    expect(res.s.tasks[t.id].outcome).toBe('perfect');
    expect(res.s.pallets[t.payload.palletId].state).toBe('empty');
  });
});

describe('развилки списания (M7e2)', () => {
  const withWriteoff = () => {
    const g = createInitialGame(map, 1);
    const s = tickWriteoffs({ ...g, clock: { ...g.clock, time: WRITEOFF.firstAtSeconds } });
    return { s, t: Object.values(s.tasks).find((x): x is WriteoffTask => x.type === 'writeoff')! };
  };

  it('у полки — перед «Снимает с полки»; «зона брака заставлена» — в зоне брака', () => {
    const { s, t } = withWriteoff();
    const job0 = buildWriteoffJob(map, s.pickers.lucky, t);
    for (let seed = 1; seed <= 30; seed++) {
      const job = planCall(job0, t, createRng(seed), 1, 1);
      const sit = SITUATIONS.find((x) => x.id === job.call!.situationId)!;
      expect(sit.taskType).toBe('writeoff');
      const step = job.steps[job.call!.stepIndex];
      expect(step).toMatchObject({ kind: 'work', label: sit.stopAtEnd ? 'Сдаёт в брак' : 'Снимает с полки' });
    }
  });

  it('тексты всех 5 ситуаций заполняются целиком', () => {
    const { s, t } = withWriteoff();
    const sits = SITUATIONS.filter((x) => x.taskType === 'writeoff');
    expect(sits).toHaveLength(5);
    for (const sit of sits) {
      const ctx = { ...lineContext(s, t.id, 0, 'lucky'), seconds: 10 };
      const texts = [sit.speech, ...sit.options.flatMap((o) => [o.description, o.okTitle, o.okText, o.badTitle, o.badText])];
      if (sit.tsdText) texts.push(sit.tsdText.label, sit.tsdText.description, ...Object.values(sit.tsdText.results).flatMap((r) => [r.title, r.text]));
      for (const text of texts) expect(fillText(text, ctx).includes('{')).toBe(false);
    }
  });

  it('«Срок» наоборот: ровно одна просроченная, только она — успех', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const units = createExpiryUnits(createRng(seed), EXPIRY, 'expired');
      const expired = units.filter((u) => u.days <= 0);
      expect(expired).toHaveLength(1);
      for (const u of units) {
        const r = scoreExpiry(u.days, EXPIRY.need, 1, false, EXPIRY, 'expired');
        expect(r).toBe(u.days <= 0 ? 'perfect' : 'failed');
      }
    }
  });

  it('«Взять ТСД» на списании: «Срок» у полки партии, в режиме «найти просроченную»', () => {
    const { s: s0, t } = withWriteoff();
    let s = dispatchTask(s0, map, t.id, 'lucky');
    const p = s.pickers.lucky;
    s = { ...s, pickers: { ...s.pickers, lucky: { ...p, job: { ...p.job!, call: { stepIndex: 1, lineIndex: 0, situationId: 'w_similar', raised: false } } } } };
    ({ s } = runUntil(s, (x) => x.calls.some((c) => c.expiresAt !== null)));
    const call = s.calls[0];
    if (!CALLS.forceTsd && call.tsd === null) return;
    s = answerCall(s, call.id, TSD_OPTION_ID);
    expect(s.tsdGame).toMatchObject({ kind: 'expiry', mode: 'expired', address: t.payload.address });
  });
});
