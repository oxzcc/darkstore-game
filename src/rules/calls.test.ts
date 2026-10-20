import { describe, expect, it } from 'vitest';
import type { GameState } from '../model/game';
import type { CallAnswer } from '../model/call';
import { WAREHOUSE_LAYOUT } from '../config/warehouse';
import { CALLS, SITUATION_BY_ID, type CallOption } from '../config/calls';
import { buildWarehouseMap } from './warehouse';
import { createInitialGame } from './game';
import { openOrders } from './tasks/generator';
import { dispatchTask } from './tasks/lifecycle';
import { advanceWorld } from './advance';
import { pickerActivity } from './jobs';
import { createRng, type Rng } from './random';
import { answerCall, autoChoice, callText, optionChances, optionsFor, planCall, revealCalls } from './calls';

const map = buildWarehouseMap(WAREHOUSE_LAYOUT);

/** Отправить сборщика и поставить ему развилку на первую позицию заказа. */
function sentWithCall(pickerId = 'lucky', situationId = 'missing', g: GameState = createInitialGame(map, 1)) {
  const task = openOrders(g)[0];
  const s = dispatchTask(g, map, task.id, pickerId);
  const job = s.pickers[pickerId].job!;
  const stepIndex = job.steps.findIndex((st) => st.kind === 'pick');
  const withCall = {
    ...s,
    pickers: { ...s.pickers, [pickerId]: { ...s.pickers[pickerId], job: { ...job, call: { stepIndex, lineIndex: 0, situationId, raised: false } } } },
  };
  return { s: withCall, taskId: task.id };
}

/** Крутить мир, пока условие не выполнится. */
function runUntil(s: GameState, done: (s: GameState) => boolean, step = 0.1, max = 5000): GameState {
  for (let i = 0; i < max && !done(s); i++) s = advanceWorld(s, map, step).state;
  return s;
}

/** Генератор с заранее заданными числами — для проверки бросков. */
const fixed = (...xs: number[]): Rng => {
  let i = 0;
  return { next: () => xs[i++ % xs.length], seed: () => 0 } as unknown as Rng;
};

describe('развилки: план и вызов', () => {
  it('при отправке развилка планируется с шансом: 1 — на шаге сбора, 0 — нет', () => {
    const g = createInitialGame(map, 1);
    const task = openOrders(g)[0];
    const job = dispatchTask(g, map, task.id, 'lucky').pickers.lucky.job!;
    const plain = { ...job, call: undefined };
    const yes = planCall(plain, task, createRng(3), 1);
    expect(yes.call).toBeDefined();
    expect(yes.steps[yes.call!.stepIndex].kind).toBe('pick');
    expect(planCall(plain, task, createRng(3), 0).call).toBeUndefined();
  });

  it('дошёл до позиции — останавливается, зовёт диспетчера; вызов с таймером на экране', () => {
    const { s, taskId } = sentWithCall();
    const at = runUntil(s, (x) => x.calls.length > 0);
    expect(at.pickers.lucky.state).toBe('calling');
    expect(at.calls).toHaveLength(1);
    expect(at.calls[0].taskId).toBe(taskId);
    expect(at.calls[0].expiresAt).toBeCloseTo(at.clock.time + CALLS.answerSeconds, 0);
    expect(pickerActivity(at, 'lucky').kind).toBe('calling');
    // стоит, пока не ответили
    const later = advanceWorld(at, map, 2).state;
    expect(later.pickers.lucky.position).toEqual(at.pickers.lucky.position);
    expect(later.pickers.lucky.state).toBe('calling');
  });

  it('варианты зависят от сборщика: «проверить соседние полки» есть у Бурана (точность 7), у Лаки нет', () => {
    const sit = SITUATION_BY_ID.missing;
    const g = createInitialGame(map, 1);
    expect(optionsFor(sit, g.pickers.buran).map((o) => o.id)).toContain('checkNear');
    expect(optionsFor(sit, g.pickers.lucky).map((o) => o.id)).not.toContain('checkNear');
    expect(optionsFor(SITUATION_BY_ID.jam, g.pickers.korzh).map((o) => o.id)).toContain('slip');
  });

  it('текст ситуации — с адресом и товаром позиции', () => {
    const at = runUntil(sentWithCall().s, (x) => x.calls.length > 0);
    const text = callText(at, at.calls[0]);
    expect(text).not.toContain('{');
    expect(text).toMatch(/\d\.\d\.\d/);
  });
});

describe('развилки: ответ', () => {
  it('игрок выбрал вариант — вызов уходит, ответ в задании, время варианта добавлено, работа продолжается', () => {
    const { s, taskId } = sentWithCall();
    const at = runUntil(s, (x) => x.calls.length > 0);
    const a = answerCall(at, at.calls[0].id, 'search');
    expect(a.calls).toHaveLength(0);
    // шансы — те, что были на карточке: «Поискать рядом» — обычно, Нюх; у Лаки Нюх 5 → 60 / 30 / 10
    expect(a.tasks[taskId].callLog).toEqual([{ situationId: 'missing', lineIndex: 0, optionId: 'search', auto: false,
      chances: CALLS.levels.normal, check: { stat: 'accuracy', value: 5 } }]);
    const job = a.pickers.lucky.job!;
    expect(job.steps[job.stepIndex]).toMatchObject({ kind: 'delay', seconds: 15 });
    expect(pickerActivity(a, 'lucky').kind).toBe('busy');
    const done = runUntil(a, (x) => x.tasks[taskId].status === 'done');
    expect(done.tasks[taskId].status).toBe('done');
  });

  it('недоступный вариант или вызов в очереди не принимается', () => {
    const at = runUntil(sentWithCall().s, (x) => x.calls.length > 0);
    expect(answerCall(at, at.calls[0].id, 'checkNear')).toBe(at); // у Лаки его нет
    const queued = { ...at, calls: [{ ...at.calls[0], expiresAt: null }] };
    expect(answerCall(queued, queued.calls[0].id, 'search')).toBe(queued);
  });

  it('не ответил — сборщик решает сам, характеристика −2; событие говорит, что он выбрал', () => {
    const { s, taskId } = sentWithCall();
    const at = runUntil(s, (x) => x.calls.length > 0);
    let after = at;
    const answered: string[] = [];
    for (let i = 0; i < 500 && after.calls.length > 0; i++) {
      const r = advanceWorld(after, map, 0.1);
      after = r.state;
      for (const e of r.events) if (e.kind === 'callAnswered') answered.push(e.optionId);
    }
    const log = after.tasks[taskId].callLog!;
    expect(log).toHaveLength(1);
    expect(log[0].auto).toBe(true);
    const option = SITUATION_BY_ID.missing.options.find((o) => o.id === log[0].optionId)!;
    expect(log[0].chances).toEqual(optionChances(option, after.pickers.lucky, CALLS.autoPenalty));
    expect(log[0].chances!.perfect).toBeLessThan(optionChances(option, after.pickers.lucky).perfect);
    expect(answered).toEqual([log[0].optionId]);
    // выбрал ровно то, что окно обещало заранее («Лаки выберет вариант …»)
    expect(log[0].optionId).toBe(at.calls[0].autoOptionId);
  });

  it('на экране не больше трёх вызовов: четвёртый ждёт в очереди без таймера', () => {
    const at = runUntil(sentWithCall().s, (x) => x.calls.length > 0);
    const c = at.calls[0];
    const many = { ...at, calls: [c, { ...c, id: 'b' }, { ...c, id: 'c' }, { ...c, id: 'd', expiresAt: null }] };
    const next = advanceWorld(many, map, 0.1).state;
    expect(next.calls.filter((x) => x.expiresAt !== null)).toHaveLength(CALLS.maxVisible);
    expect(next.calls[3].expiresAt).toBe(null);
  });
});

describe('шансы варианта (docs/10, раздел 14.6)', () => {
  const g = createInitialGame(map, 1);
  const opt = (sit: string, id: string) => SITUATION_BY_ID[sit].options.find((o) => o.id === id)!;
  const pct = (o: CallOption, pickerId: string, penalty = 0) => {
    const c = optionChances(o, g.pickers[pickerId], penalty);
    return [Math.round(c.perfect * 100), Math.round(c.withErrors * 100), Math.round(c.failed * 100)];
  };

  it('пример «Пробка в аллее»: протиснуться — Лапы, попросить — Дружелюбие, подождать — надёжно', () => {
    expect(pct(opt('jam', 'squeeze'), 'korzh')).toEqual([58, 26, 16]); // Лапы 8
    expect(pct(opt('jam', 'squeeze'), 'buran')).toEqual([28, 41, 31]); // Лапы 3
    expect(pct(opt('jam', 'askMove'), 'korzh')).toEqual([66, 27, 7]);  // Дружелюбие 6
    expect(pct(opt('jam', 'askMove'), 'buran')).toEqual([42, 39, 19]); // Дружелюбие 2
    for (const id of ['lucky', 'korzh', 'buran']) expect(pct(opt('jam', 'wait'), id)).toEqual([80, 17, 3]);
  });

  it('вариант с потолком: «Идеально» не выпадает — 0 / 97 / 3', () => {
    expect(pct(opt('missing', 'skip'), 'lucky')).toEqual([0, 97, 3]);
  });

  it('усталость и «решил сам» снижают характеристику; шансы в границах и в сумме 1', () => {
    const korzh = g.pickers.korzh;
    const tired = { ...korzh, stats: { ...korzh.stats, fatigue: 100 } };
    const o = opt('jam', 'squeeze');
    expect(optionChances(o, tired).perfect).toBeLessThan(optionChances(o, korzh).perfect);
    expect(pct(o, 'korzh', CALLS.autoPenalty)).toEqual([46, 32, 22]); // Лапы 8 − 2
    const best = { ...korzh, stats: { ...korzh.stats, speed: 10, accuracy: 10, strength: 10, memory: 10, friendly: 10 } };
    for (const s of Object.values(SITUATION_BY_ID)) for (const x of s.options) {
      for (const p of [best, { ...korzh, stats: { ...korzh.stats, speed: 1, accuracy: 1, strength: 1, memory: 1, friendly: 1 } }]) {
        const c = optionChances(x, p, 2);
        for (const v of [c.perfect, c.withErrors, c.failed]) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
        expect(c.perfect + c.withErrors + c.failed).toBeCloseTo(1, 9);
      }
    }
  });

  it('сам сборщик выбирает лучший для себя вариант (с характеристикой −2)', () => {
    // Коржик в пробке: Дружелюбие 6 − 2 = 4 → «попросить» 54%, а «подождать» — 80% у всех
    expect(autoChoice(optionsFor(SITUATION_BY_ID.jam, g.pickers.korzh), g.pickers.korzh).id).toBe('wait');
  });

  it('у каждого варианта, кроме «надёжно», есть характеристика', () => {
    for (const s of Object.values(SITUATION_BY_ID)) for (const o of s.options) {
      if (o.level !== 'safe') expect(o.stat).toBeDefined();
    }
  });
});

describe('развилки: один бросок в конце задания', () => {
  const ans = (optionId: string, chances = CALLS.levels.normal): CallAnswer => ({ situationId: 'missing', lineIndex: 0, optionId, auto: false, chances });

  it('исход — бросок по шансам варианта; маркер — куда упало', () => {
    expect(revealCalls([ans('search')], fixed(0.3), 0, 'off')!.final).toBe('perfect');    // < 0,6
    expect(revealCalls([ans('search')], fixed(0.7), 0, 'off')!.final).toBe('withErrors'); // 0,6…0,9
    const r = revealCalls([ans('search')], fixed(0.95), 0, 'off')!;
    expect(r).toMatchObject({ final: 'failed', roll: 0.95, chances: CALLS.levels.normal });
    expect(r.calls[0]).toMatchObject({ after: 'failed', capped: false });
    expect(revealCalls(undefined, fixed(0))).toBe(null);
  });

  it('подпорки работают и тут: маленький провал не выпадает, у потолка подарка нет', () => {
    const tiny = { perfect: 0.6, withErrors: 0.36, failed: 0.04 }; // провал 4%
    expect(revealCalls([ans('search', tiny)], fixed(0.99), 0, 'on')!.final).toBe('withErrors');
    const capped = { perfect: 0, withErrors: 0.97, failed: 0.03 };
    const r = revealCalls([ans('skip', capped)], fixed(0.01), 0, 'on')!;
    expect(r.final).toBe('withErrors');
    expect(r.calls[0].capped).toBe(true);
  });
});

describe('развилка заменяет бросок по характеристикам (решение автора 14.10)', () => {
  it('заказ с развилкой: исход — от броска по шансам ответа', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const { s, taskId } = sentWithCall('lucky', 'missing', createInitialGame(map, seed));
      const at = runUntil(s, (x) => x.calls.length > 0);
      let x = answerCall(at, at.calls[0].id, 'search');
      for (let i = 0; i < 5000 && x.tasks[taskId].status !== 'done'; i++) x = advanceWorld(x, map, 0.1).state;
      const done = x.shiftLog.find((e) => e.kind === 'taskDone' && e.taskId === taskId);
      const reveal = done && done.kind === 'taskDone' ? done.reveal! : null;
      expect(reveal!.chances).toEqual(x.tasks[taskId].callLog![0].chances);
      expect(x.tasks[taskId].outcome).toBe(reveal!.calls[0].after);
    }
  });
});

describe('развилки: окно результата', () => {
  it('заказ с развилкой заканчивается событием с раскрытием исхода; без развилки — без него', () => {
    const { s, taskId } = sentWithCall();
    const at = runUntil(s, (x) => x.calls.length > 0);
    let x = answerCall(at, at.calls[0].id, 'search');
    let reveal: unknown = null;
    for (let i = 0; i < 5000 && x.tasks[taskId].status !== 'done'; i++) {
      const r = advanceWorld(x, map, 0.1);
      x = r.state;
      for (const e of r.events) if (e.kind === 'taskDone' && e.taskId === taskId) reveal = e.reveal;
    }
    expect(reveal).toMatchObject({ final: x.tasks[taskId].outcome });

    const g = createInitialGame(map, 1);
    const t = openOrders(g)[0];
    const sent = dispatchTask(g, map, t.id, 'lucky');
    let y: GameState = { ...sent, pickers: { ...sent.pickers, lucky: { ...sent.pickers.lucky, job: { ...sent.pickers.lucky.job!, call: undefined } } } };
    let plain: unknown = 'нет события';
    for (let i = 0; i < 5000 && y.tasks[t.id].status !== 'done'; i++) {
      const r = advanceWorld(y, map, 0.1);
      y = r.state;
      for (const e of r.events) if (e.kind === 'taskDone') plain = e.reveal;
    }
    expect(plain).toBeUndefined();
  });
});
