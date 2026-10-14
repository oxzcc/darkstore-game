// Развилки (docs/10-minigames-concept.md, раздел 3; 09, раздел 6).
// Сборщик работает сам, но на одной из позиций заказа может остановиться и позвать диспетчера.
// Всё здесь — чистые функции: план развилки при отправке, вызов, ответ игрока, ответ сборщика по таймеру, влияние на исход.
import type { GameState } from '../model/game';
import type { Call, CallAnswer, CallReveal, RiskLevel } from '../model/call';
import type { Picker, PickerJob } from '../model/picker';
import type { Outcome, Task } from '../model/task';
import { CALLS, SITUATION_BY_ID, SITUATIONS, TSD_GAMES_READY, TSD_OPTION_ID, type CallOption, type Situation } from '../config/calls';
import { startTsdGame } from './tsdGame';
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
  // для проверки (CALLS.forceTsd) — только ситуации с готовой игрой на ТСД
  const situations = SITUATIONS.filter((s) => s.taskType === task.type && (!CALLS.forceTsd || hasReadyGame(s)));
  const picks = job.steps.map((s, i) => ({ s, i })).filter(({ s }) => s.kind === 'pick');
  if (situations.length === 0 || picks.length === 0) return job;
  const situation = situations[Math.floor(rng.next() * situations.length)];
  const { s, i } = picks[Math.floor(rng.next() * picks.length)];
  const lineIndex = s.kind === 'pick' ? s.lineIndex : 0;
  return { ...job, call: { stepIndex: i, lineIndex, situationId: situation.id, raised: false } };
}

/** У ситуации есть игра на ТСД, и она уже сделана. */
function hasReadyGame(s: Situation): boolean {
  return !!s.tsdGame && TSD_GAMES_READY.includes(s.tsdGame);
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
  const options = optionsFor(situation, picker);
  // что выберет сборщик сам, решается сразу (окно показывает это): чем точнее, тем чаще самый безопасный вариант
  const rng = createRng(state.rngSeed);
  const safest = [...options].sort((a, b) =>
    RISK_ORDER.indexOf(a.risk) - RISK_ORDER.indexOf(b.risk) || a.seconds - b.seconds)[0];
  const careful = rng.next() < picker.stats.accuracy / 10;
  const auto = careful ? safest : options[Math.floor(rng.next() * options.length)];
  // вариант «Взять ТСД» — с шансом, у ситуаций с готовой игрой (10, раздел 11.1); сборщик сам его не выбирает
  const tsd = hasReadyGame(situation) && (CALLS.forceTsd || rng.next() < CALLS.tsdChance) ? situation.tsdGame! : null;
  const call: Call = {
    id: `call-${state.nextId}`,
    taskId: picker.job!.taskId,
    pickerId,
    situationId: situation.id,
    lineIndex: plan.lineIndex,
    optionIds: options.map((o) => o.id),
    autoOptionId: auto.id,
    expiresAt: null,
    tsd,
  };
  return { ...state, rngSeed: rng.seed(), nextId: state.nextId + 1, calls: [...state.calls, call] };
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
    lineIndex: call.lineIndex,
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
  if (!call || call.expiresAt === null) return state;
  if (optionId === TSD_OPTION_ID) return startTsdGame(state, callId); // игрок берёт ТСД: игра у стеллажа (rules/tsdGame.ts)
  if (!call.optionIds.includes(optionId)) return state;
  const option = SITUATION_BY_ID[call.situationId]?.options.find((o) => o.id === optionId);
  if (!option) return state;
  return resolve(state, call, option, false);
}

/** Игрок не ответил — сборщик решает сам, и хуже (10, раздел 3): выбор решён заранее (raiseCall), риск — на ступень выше. */
export function autoAnswer(state: GameState, callId: string): GameState {
  const call = state.calls.find((c) => c.id === callId);
  if (!call) return state;
  const option = SITUATION_BY_ID[call.situationId]?.options.find((o) => o.id === call.autoOptionId);
  if (!option) return { ...state, calls: state.calls.filter((c) => c.id !== callId) };
  return resolve(state, call, option, true);
}

/** Вызовы, у которых вышло время, решает сборщик. */
export function expireCalls(state: GameState): GameState {
  const due = state.calls.filter((c) => c.expiresAt !== null && state.clock.time >= c.expiresAt);
  let next = state;
  for (const c of due) next = autoAnswer(next, c.id);
  return next;
}

/**
 * Раскрытие развилок в конце заказа: по каждому ответу — бросок осложнения по риску (CALLS.complication),
 * осложнение ухудшает исход на ступень; потом ограничение варианта (cap), например «не выше с ошибками».
 * Всё, что выпало, записывается — окно результата показывает это игроку (решение автора 13.10).
 */
/** Шанс осложнения для ответа с этим риском у сборщика с этой точностью (CALLS.riskByAccuracy). */
export function complicationChance(risk: RiskLevel, accuracy: number = CALLS.riskByAccuracy.ref): number {
  const { ref, perPoint, min, max } = CALLS.riskByAccuracy;
  const factor = Math.min(max, Math.max(min, 1 - (accuracy - ref) * perPoint));
  return CALLS.complication[risk] * factor;
}

/**
 * Раскрыть развилки заказа. `accuracy` — точность сборщика: от неё зависит шанс осложнения.
 * С 14.10 (решение автора) у заказа с развилкой броска по характеристикам нет: advanceWorld передаёт сюда «идеально»,
 * и исход зависит только от развилок.
 */
export function revealCalls(outcome: Outcome, log: CallAnswer[] | undefined, rng: Rng, accuracy?: number): { calls: CallReveal[]; final: Outcome } {
  let idx = OUTCOME_ORDER.indexOf(outcome);
  const calls: CallReveal[] = [];
  for (const a of log ?? []) {
    if (a.tsd) {
      // игрок взял ТСД: броска нет, итог игры сразу двигает исход (10, раздел 11.4): с ошибками — на ступень, провал — на две
      idx = Math.min(OUTCOME_ORDER.length - 1, idx + OUTCOME_ORDER.indexOf(a.tsd));
      calls.push({ ...a, chance: 0, roll: 1, complication: a.tsd !== 'perfect', capped: false, after: OUTCOME_ORDER[idx] });
      continue;
    }
    const chance = complicationChance(a.risk, accuracy);
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

/** Что подставить в тексты развилки: {picker}, {product}, {address}, {aisle}, {seconds}. */
export type TextContext = { picker?: string; product?: string; address?: string; aisle?: string; seconds?: number };

export function fillText(template: string, ctx: TextContext): string {
  return template
    .split('{picker}').join(ctx.picker ?? 'Сборщик')
    .split('{product}').join(ctx.product ?? 'товар')
    .split('{address}').join(ctx.address ?? '—')
    .split('{aisle}').join(ctx.aisle ?? '—')
    .split('{seconds}').join(String(ctx.seconds ?? 0));
}

/** Подстановки для позиции заказа, к которой относится развилка. */
export function lineContext(state: GameState, taskId: string, lineIndex: number, pickerId: string): TextContext {
  const task = state.tasks[taskId];
  const line = task?.type === 'order' ? task.payload.lines[lineIndex] : undefined;
  return {
    picker: state.pickers[pickerId]?.name,
    product: line ? state.products[line.productId]?.name ?? line.productId : undefined,
    address: line ? formatAddress(line.address) : undefined,
    aisle: line ? String(line.address.aisle) : undefined,
  };
}

/** Реплика сборщика для окна развилки. */
export function callText(state: GameState, call: Call): string {
  const situation = SITUATION_BY_ID[call.situationId];
  return situation ? fillText(situation.speech, lineContext(state, call.taskId, call.lineIndex, call.pickerId)) : '';
}
