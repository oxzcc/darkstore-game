import { describe, expect, it } from 'vitest';
import type { GameState } from '../model/game';
import type { CallAnswer } from '../model/call';
import { WAREHOUSE_LAYOUT } from '../config/warehouse';
import { CALLS, SITUATION_BY_ID } from '../config/calls';
import { buildWarehouseMap } from './warehouse';
import { createInitialGame } from './game';
import { openTasks } from './tasks/generator';
import { dispatchTask } from './tasks/lifecycle';
import { advanceWorld } from './advance';
import { pickerActivity } from './jobs';
import { createRng, type Rng } from './random';
import { answerCall, applyCalls, callText, complicationChance, optionsFor, planCall, raiseRisk, revealCalls } from './calls';

const map = buildWarehouseMap(WAREHOUSE_LAYOUT);

/** Отправить сборщика и поставить ему развилку на первую позицию заказа. */
function sentWithCall(pickerId = 'lucky', situationId = 'missing', g: GameState = createInitialGame(map, 1)) {
  const task = openTasks(g)[0];
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
    const task = openTasks(g)[0];
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
    expect(a.tasks[taskId].callLog).toEqual([{ situationId: 'missing', lineIndex: 0, optionId: 'search', risk: 'medium', auto: false }]);
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

  it('не ответил — сборщик решает сам, риск на ступень выше; событие говорит, что он выбрал', () => {
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
    const base = SITUATION_BY_ID.missing.options.find((o) => o.id === log[0].optionId)!.risk;
    expect(log[0].risk).toBe(raiseRisk(base));
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

describe('развилки: влияние на исход', () => {
  const ans = (optionId: string, risk: CallAnswer['risk']): CallAnswer => ({ situationId: 'missing', lineIndex: 0, optionId, risk, auto: false });

  it('осложнение ухудшает исход на ступень, без осложнения исход тот же', () => {
    expect(applyCalls('perfect', [ans('search', 'medium')], fixed(0.1))).toBe('withErrors'); // 0,1 < 0,35
    expect(applyCalls('perfect', [ans('search', 'medium')], fixed(0.9))).toBe('perfect');
    expect(applyCalls('failed', [ans('search', 'high')], fixed(0))).toBe('failed');
    expect(applyCalls('perfect', undefined, fixed(0))).toBe('perfect');
  });

  it('«пропустить позицию» — исход не выше «с ошибками»', () => {
    expect(applyCalls('perfect', [ans('skip', 'low')], fixed(0.9))).toBe('withErrors');
  });

  it('риск на ступень выше не выходит за «высокий»', () => {
    expect(raiseRisk('low')).toBe('medium');
    expect(raiseRisk('high')).toBe('high');
  });

  it('раскрытие: что выпало по каждой развилке и каким стал исход', () => {
    const r = revealCalls('perfect', [ans('search', 'medium'), ans('skip', 'low')], fixed(0.1, 0.9));
    expect(r.calls.map((c) => [c.complication, c.capped, c.after])).toEqual([[true, false, 'withErrors'], [false, false, 'withErrors']]);
    expect(r.final).toBe('withErrors');
    expect(r.calls[0].chance).toBe(CALLS.complication.medium);
  });
});

describe('развилка заменяет бросок по характеристикам (решение автора 14.10)', () => {
  it('риск ответа зависит от точности: точный реже ошибается, неточный чаще, в границах', () => {
    const { ref, min, max } = CALLS.riskByAccuracy;
    expect(complicationChance('low', ref)).toBeCloseTo(CALLS.complication.low);
    expect(complicationChance('low', 10)).toBeLessThan(CALLS.complication.low);
    expect(complicationChance('low', 1)).toBeGreaterThan(CALLS.complication.low);
    expect(complicationChance('high', 100)).toBeCloseTo(CALLS.complication.high * min);
    expect(complicationChance('high', -100)).toBeCloseTo(CALLS.complication.high * max);
  });

  it('заказ с развилкой: исход только от неё — без осложнения всегда «идеально»', () => {
    // много разных зёрен: если бы бросок по характеристикам остался, часть заказов вышла бы хуже «идеально»
    for (let seed = 1; seed <= 12; seed++) {
      const { s, taskId } = sentWithCall('lucky', 'missing', createInitialGame(map, seed));
      const at = runUntil(s, (x) => x.calls.length > 0);
      let x = answerCall(at, at.calls[0].id, 'search');
      for (let i = 0; i < 5000 && x.tasks[taskId].status !== 'done'; i++) x = advanceWorld(x, map, 0.1).state;
      const done = x.shiftLog.find((e) => e.kind === 'taskDone' && e.taskId === taskId);
      expect(done && done.kind === 'taskDone' && done.reveal?.base).toBe('perfect');
      const call = done && done.kind === 'taskDone' ? done.reveal!.calls[0] : null;
      expect(x.tasks[taskId].outcome).toBe(call!.complication ? 'withErrors' : 'perfect');
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
    const t = openTasks(g)[0];
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
