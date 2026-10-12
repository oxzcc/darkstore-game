// Развилки (docs/10-minigames-concept.md, раздел 3; 09, раздел 6).
// Сборщик работает сам, но на одной из позиций заказа может остановиться и позвать диспетчера.
// Всё здесь — чистые функции: план развилки при отправке, вызов, ответ игрока, ответ сборщика по таймеру, влияние на исход.
import type { GameState } from '../model/game';
import type { Call, CallAnswer, CallReveal, RiskLevel } from '../model/call';
import type { Picker, PickerJob } from '../model/picker';
import type { Outcome, Task } from '../model/task';
import { CALLS, SITUATION_BY_ID, SITUATIONS, type CallOption, type Situation } from '../config/calls';
import { formatAddress } from './address';
import type { Rng } from './random';
import { createRng } from './random';

const RISK_ORDER: RiskLevel[] = ['low', 'medium', 'high'];
const OUTCOME_ORDER: Outcome[] = ['perfect', 'withErrors', 'failed'];

/** Риск на ступень выше (когда сборщик решил сам). */
export function raiseRisk(r: RiskLevel): RiskLevel {
  return RISK_ORDER[Math.min(RISK_ORDER.length - 1, RISK_ORDER.indexOf(r) + 1)];
}

/**
 * При отправке сборщика: будет ли развилка и где (10, раздел 3: шанс на задание, не больше одной).
 * Развилка встаёт на шаг сбора случайной позиции заказа. `chance` — тесты передают 0 или 1.
 */
export function planCall(job: PickerJob, task: Task, rng: Rng, chance = CALLS.chance): PickerJob {
  if (task.type !== 'order' || rng.next() >= chance) return job;
  const situations = SITUATIONS.filter((s) => s.taskType === task.type);
  const picks = job.steps.map((s, i) => ({ s, i })).filter(({ s }) => s.kind === 'pick');
  if (situations.length === 0 || picks.length === 0) return job;
  const situation = situations[Math.floor(rng.next() * situations.length)];
  const { s, i } = picks[Math.floor(rng.next() * picks.length)];
  const lineIndex = s.kind === 'pick' ? s.lineIndex : 0;
  return { ...job, call: { stepIndex: i, lineIndex, situationId: situation.id, raised: false } };
}

/** Какие варианты ситуации есть у этого сборщика (часть открывают характеристики). */
export function optionsFor(situation: Situation, picker: Picker): CallOption[] {
  return situation.options.filter((o) => !o.requires || picker.stats[o.requires.stat] >= o.requires.min);
}

/** Сборщик дошёл до шага с развилкой: появляется вызов (пока в очереди — таймер назначит showQueuedCalls). */
export function raiseCall(state: GameState, pickerId: string): GameState {
  const picker = state.pickers[pickerId];
  const plan = picker?.job?.call;
  if (!picker || !plan) return state;
  const situation = SITUATION_BY_ID[plan.situationId];
  if (!situation) return state;
  const call: Call = {
    id: `call-${state.nextId}`,
    taskId: picker.job!.taskId,
    pickerId,
    situationId: situation.id,
    lineIndex: plan.lineIndex,
    optionIds: optionsFor(situation, picker).map((o) => o.id),
    expiresAt: null,
  };
  return { ...state, nextId: state.nextId + 1, calls: [...state.calls, call] };
}

/** Первые CALLS.maxVisible вызовов на экране: у показанных впервые запускается таймер. */
export function showQueuedCalls(state: GameState): GameState {
  let changed = false;
  const calls = state.calls.map((c, i) => {
    if (i >= CALLS.maxVisible || c.expiresAt !== null) return c;
    changed = true;
    return { ...c, expiresAt: state.clock.time + CALLS.answerSeconds };
  });
  return changed ? { ...state, calls } : state;
}

/** Применить выбранный вариант: вызов уходит, ответ пишется в задание, сборщик делает выбранное и работает дальше. */
function resolve(state: GameState, call: Call, option: CallOption, auto: boolean): GameState {
  const picker = state.pickers[call.pickerId];
  const task = state.tasks[call.taskId];
  if (!picker?.job || !task) return { ...state, calls: state.calls.filter((c) => c.id !== call.id) };

  const answer: CallAnswer = {
    situationId: call.situationId,
    optionId: option.id,
    risk: auto ? raiseRisk(option.risk) : option.risk,
    auto,
  };
  const job = picker.job;
  // время варианта — отдельным шагом перед текущим (сбором позиции)
  const steps = option.seconds > 0
    ? [...job.steps.slice(0, job.stepIndex), { kind: 'delay' as const, seconds: option.seconds, label: option.busyLabel }, ...job.steps.slice(job.stepIndex)]
    : job.steps;
  const nextStep = steps[job.stepIndex];

  return {
    ...state,
    calls: state.calls.filter((c) => c.id !== call.id),
    tasks: { ...state.tasks, [task.id]: { ...task, callLog: [...(task.callLog ?? []), answer] } },
    pickers: {
      ...state.pickers,
      [picker.id]: {
        ...picker,
        state: nextStep?.kind === 'walk' ? 'walking' : 'working',
        job: { ...job, steps, stepElapsed: 0, call: job.call ? { ...job.call, raised: true } : undefined },
      },
    },
  };
}

/** Игрок выбрал вариант. Принимается только у вызова на экране (не в очереди) и только из доступных вариантов. */
export function answerCall(state: GameState, callId: string, optionId: string): GameState {
  const call = state.calls.find((c) => c.id === callId);
  if (!call || call.expiresAt === null || !call.optionIds.includes(optionId)) return state;
  const option = SITUATION_BY_ID[call.situationId]?.options.find((o) => o.id === optionId);
  if (!option) return state;
  return resolve(state, call, option, false);
}

/**
 * Игрок не ответил — сборщик решает сам, и хуже (10, раздел 3): чем точнее сборщик, тем чаще он выбирает
 * самый безопасный вариант; риск выбранного — на ступень выше.
 */
export function autoAnswer(state: GameState, callId: string, rng: Rng): GameState {
  const call = state.calls.find((c) => c.id === callId);
  if (!call) return state;
  const picker = state.pickers[call.pickerId];
  const situation = SITUATION_BY_ID[call.situationId];
  const options = situation.options.filter((o) => call.optionIds.includes(o.id));
  const safest = [...options].sort((a, b) =>
    RISK_ORDER.indexOf(a.risk) - RISK_ORDER.indexOf(b.risk) || a.seconds - b.seconds)[0];
  const careful = rng.next() < (picker?.stats.accuracy ?? 5) / 10;
  const option = careful ? safest : options[Math.floor(rng.next() * options.length)];
  return resolve(state, call, option, true);
}

/** Вызовы, у которых вышло время, решает сборщик. */
export function expireCalls(state: GameState): GameState {
  const due = state.calls.filter((c) => c.expiresAt !== null && state.clock.time >= c.expiresAt);
  if (due.length === 0) return state;
  const rng = createRng(state.rngSeed);
  let next = state;
  for (const c of due) next = autoAnswer(next, c.id, rng);
  return { ...next, rngSeed: rng.seed() };
}

/**
 * Раскрытие развилок в конце заказа: по каждому ответу — бросок осложнения по риску (CALLS.complication),
 * осложнение ухудшает исход на ступень; потом ограничение варианта (cap), например «не выше с ошибками».
 * Всё, что выпало, записывается — окно результата показывает это игроку (решение автора 13.10).
 */
export function revealCalls(outcome: Outcome, log: CallAnswer[] | undefined, rng: Rng): { calls: CallReveal[]; final: Outcome } {
  let idx = OUTCOME_ORDER.indexOf(outcome);
  const calls: CallReveal[] = [];
  for (const a of log ?? []) {
    const chance = CALLS.complication[a.risk];
    const roll = rng.next();
    const complication = roll < chance;
    if (complication) idx = Math.min(OUTCOME_ORDER.length - 1, idx + 1);
    const cap = SITUATION_BY_ID[a.situationId]?.options.find((o) => o.id === a.optionId)?.cap;
    const capIdx = cap ? OUTCOME_ORDER.indexOf(cap) : -1;
    const capped = capIdx > idx;
    if (capped) idx = capIdx;
    calls.push({ ...a, chance, roll, complication, capped, after: OUTCOME_ORDER[idx] });
  }
  return { calls, final: OUTCOME_ORDER[idx] };
}

/** Только итоговый исход с учётом развилок. */
export function applyCalls(outcome: Outcome, log: CallAnswer[] | undefined, rng: Rng): Outcome {
  return revealCalls(outcome, log, rng).final;
}

/** Текст ситуации для экрана: подставить адрес, товар и аллею позиции. */
export function callText(state: GameState, call: Call): string {
  const situation = SITUATION_BY_ID[call.situationId];
  const task = state.tasks[call.taskId];
  const line = task?.type === 'order' ? task.payload.lines[call.lineIndex] : undefined;
  if (!situation) return '';
  return situation.text
    .replace('{address}', line ? formatAddress(line.address) : '—')
    .replace('{product}', line ? state.products[line.productId]?.name ?? line.productId : 'товар')
    .replace('{aisle}', line ? String(line.address.aisle) : '—');
}
