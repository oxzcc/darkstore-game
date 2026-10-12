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
import { answerCall, applyCalls, callText, optionsFor, planCall, raiseRisk } from './calls';

const map = buildWarehouseMap(WAREHOUSE_LAYOUT);

/** Отправить сборщика и поставить ему развилку на первую позицию заказа. */
function sentWithCall(pickerId = 'lucky', situationId = 'notVisible', g: GameState = createInitialGame(map, 1)) {
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
    const sit = SITUATION_BY_ID.notVisible;
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
    expect(a.tasks[taskId].callLog).toEqual([{ situationId: 'notVisible', optionId: 'search', risk: 'medium', auto: false }]);
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

  it('не ответил — сборщик решает сам, риск на ступень выше', () => {
    const { s, taskId } = sentWithCall();
    const at = runUntil(s, (x) => x.calls.length > 0);
    const after = runUntil(at, (x) => x.calls.length === 0);
    const log = after.tasks[taskId].callLog!;
    expect(log).toHaveLength(1);
    expect(log[0].auto).toBe(true);
    const base = SITUATION_BY_ID.notVisible.options.find((o) => o.id === log[0].optionId)!.risk;
    expect(log[0].risk).toBe(raiseRisk(base));
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
  const ans = (optionId: string, risk: CallAnswer['risk']): CallAnswer => ({ situationId: 'notVisible', optionId, risk, auto: false });

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
});
