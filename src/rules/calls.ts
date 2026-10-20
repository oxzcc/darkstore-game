// Развилки (docs/10-minigames-concept.md, раздел 3; 09, раздел 6).
// Сборщик работает сам, но на одной из позиций задания может остановиться и позвать диспетчера.
// Сборка — у полки перед сбором позиции, выкладка — у полки перед выкладкой, приёмка — перед приёмкой поставки (M7d1),
// списание — у полки перед тем, как снять партию, или в зоне брака (M7e2).
// Всё здесь — чистые функции: план развилки при отправке, вызов, ответ игрока, ответ сборщика по таймеру, влияние на исход.
import type { GameState } from '../model/game';
import type { Call, CallAnswer, CallReveal } from '../model/call';
import type { Picker, PickerJob } from '../model/picker';
import type { Outcome, OutcomeChances, Task } from '../model/task';
import { CALLS, SITUATION_BY_ID, SITUATIONS, TSD_GAMES_READY, TSD_OPTION_ID, type CallOption, type Situation } from '../config/calls';
import { startTsdGame } from './tsdGame';
import { formatAddress } from './address';
import { taskLines } from './taskLines';
import type { Rng } from './random';
import { createRng } from './random';
import { effectiveStat } from './pickerStats';
import { guardedRoll, type GuardMode } from './guard';

/**
 * Шансы варианта у этого сборщика (docs/10, раздел 14.6; X2). «Надёжно» — у всех одни; иначе от характеристики варианта
 * с учётом усталости: каждое очко выше 5 — +6% «Идеально» и −3% «Провала», ниже — наоборот (CALLS.perStat).
 * `penalty` — на сколько ниже считать характеристику (сборщик решил сам — CALLS.autoPenalty).
 * Ограничение «не выше неплохо» (cap) — доля «Идеально» переходит в «Неплохо».
 */
export function optionChances(option: CallOption, picker: Picker, penalty = 0): OutcomeChances {
  const base = CALLS.levels[option.level];
  let perfect = base.perfect;
  let failed = base.failed;
  if (option.level !== 'safe' && option.stat) {
    const d = effectiveStat(picker, option.stat) - penalty - CALLS.perStat.ref;
    perfect = Math.min(1, Math.max(0, perfect + d * CALLS.perStat.perfect));
    failed = Math.min(1 - perfect, Math.max(0, failed - d * CALLS.perStat.failed));
  }
  if (option.cap === 'withErrors' || option.cap === 'failed') perfect = 0;
  if (option.cap === 'failed') failed = 1;
  const r = (x: number) => Math.round(x * 1e6) / 1e6; // без хвостов вроде 0,30000000000000004
  return { perfect: r(perfect), withErrors: r(Math.max(0, 1 - perfect - failed)), failed: r(failed) };
}

/** Что проверял вариант и сколько было у сборщика — для окна итога; у «надёжно» — ничего. */
function checkOf(option: CallOption, picker: Picker, penalty: number): CallAnswer['check'] {
  if (option.level === 'safe' || !option.stat) return undefined;
  return { stat: option.stat, value: Math.max(0, effectiveStat(picker, option.stat) - penalty) };
}

/**
 * При отправке сборщика: будет ли развилка и где (10, раздел 3: шанс на задание, не больше одной).
 * Сборка — на шаге сбора случайной позиции, выкладка — на шаге выкладки, приёмка — перед работой
 * (про случайный товар поставки; сколько их — `lineCount`). `chance` — тесты передают 0 или 1.
 */
export function planCall(job: PickerJob, task: Task, rng: Rng, chance = CALLS.chance, lineCount = 1, preferGame = false): PickerJob {
  if (rng.next() >= chance) return job;
  const ofType = SITUATIONS.filter((s) => s.taskType === task.type);
  // для проверки (CALLS.forceTsd) и в обучающей смене (preferGame, M8d) — ситуации с готовой игрой на ТСД, если у этого типа такие есть
  const withGame = ofType.filter(hasReadyGame);
  const wantGame = (CALLS.forceTsd || preferGame) && withGame.length > 0;
  const situations = wantGame ? withGame : ofType;
  const stops = job.steps.map((s, i) => ({ s, i })).filter(({ s }) =>
    task.type === 'order' ? s.kind === 'pick' : task.type === 'putaway' ? s.kind === 'place' : s.kind === 'work');
  if (situations.length === 0 || stops.length === 0) return job;
  const situation = situations[Math.floor(rng.next() * situations.length)];
  // списание: у полки (первая работа) или, если ситуация про зону брака, — в ней (последняя работа)
  const pickStop = rng.next();
  const { s, i } = task.type === 'writeoff'
    ? stops[situation.stopAtEnd ? stops.length - 1 : 0]
    : stops[Math.floor(pickStop * stops.length)];
  const lineIndex = s.kind === 'pick' || s.kind === 'place' ? s.lineIndex : Math.floor(rng.next() * Math.max(1, lineCount));
  return { ...job, call: { stepIndex: i, lineIndex, situationId: situation.id, raised: false, ...(preferGame && wantGame ? { forceTsd: true } : {}) } };
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
  // что выберет сборщик сам, решается сразу (окно показывает это): лучший для себя по «Идеально» с характеристикой −2 (X2),
  // при равенстве — где меньше провала, потом быстрее
  const rng = createRng(state.rngSeed);
  const auto = autoChoice(options, picker);
  // вариант «Взять ТСД» — с шансом, у ситуаций с готовой игрой (10, раздел 11.1); сборщик сам его не выбирает
  const tsd = hasReadyGame(situation) && (CALLS.forceTsd || plan.forceTsd || rng.next() < CALLS.tsdChance) ? situation.tsdGame! : null;
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

/** Что выберет сборщик сам: лучший «Идеально» с характеристикой −2, потом меньше провала, потом быстрее. */
export function autoChoice(options: CallOption[], picker: Picker): CallOption {
  const score = (o: CallOption) => optionChances(o, picker, CALLS.autoPenalty);
  return [...options].sort((a, b) => {
    const ca = score(a);
    const cb = score(b);
    return cb.perfect - ca.perfect || ca.failed - cb.failed || a.seconds - b.seconds;
  })[0];
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
    auto,
    // шансы — в момент ответа, ровно те, что были на карточке (сам — с характеристикой −2)
    chances: optionChances(option, picker, auto ? CALLS.autoPenalty : 0),
  };
  const check = checkOf(option, picker, auto ? CALLS.autoPenalty : 0);
  if (check) answer.check = check;
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

/** Игрок не ответил — сборщик решает сам, и хуже (10, раздел 14.6): выбор решён заранее (raiseCall), характеристика −2. */
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
 * Раскрыть развилку в конце задания (X2, docs/10 раздел 14.6): один бросок по шансам выбранного варианта
 * со скрытыми подпорками (14.7). Игрок брал ТСД — броска нет, итог игры и есть исход (11.4).
 * Развилки не было — null (тогда бросок по характеристикам делает advanceWorld).
 * `streak` — подарков подряд (campaign.guardStreak); возвращается новый.
 */
export function revealCalls(log: CallAnswer[] | undefined, rng: Rng, streak = 0, mode: GuardMode = 'on'):
  { calls: CallReveal[]; final: Outcome; chances: OutcomeChances; roll: number; streak: number } | null {
  const a = log?.[log.length - 1]; // развилка на задание одна
  if (!a) return null;
  const capped = !!SITUATION_BY_ID[a.situationId]?.options.find((o) => o.id === a.optionId)?.cap;
  if (a.tsd) {
    const chances: OutcomeChances = { perfect: 0, withErrors: 0, failed: 0, [a.tsd]: 1 };
    return { calls: [{ ...a, roll: 0, capped: false, after: a.tsd }], final: a.tsd, chances, roll: 0, streak };
  }
  const chances = a.chances ?? CALLS.levels.normal; // в старых записях шансов нет
  const g = guardedRoll(chances, rng.next(), streak, mode);
  return { calls: [{ ...a, roll: g.value, capped, after: g.outcome }], final: g.outcome, chances, roll: g.value, streak: g.streak };
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

/** Подстановки для позиции задания, к которой относится развилка. У приёмки адреса нет — {address} это «паллете 2» («на паллете 2»). */
export function lineContext(state: GameState, taskId: string, lineIndex: number, pickerId: string): TextContext {
  const task = state.tasks[taskId];
  const line = task ? taskLines(state, task)[lineIndex] : undefined;
  return {
    picker: state.pickers[pickerId]?.name,
    product: line ? state.products[line.productId]?.name ?? line.productId : undefined,
    address: line?.address ? formatAddress(line.address) : line?.pallet ? `паллете ${line.pallet}` : undefined,
    aisle: line?.address ? String(line.address.aisle) : undefined,
  };
}

/** Реплика сборщика для окна развилки. */
export function callText(state: GameState, call: Call): string {
  const situation = SITUATION_BY_ID[call.situationId];
  return situation ? fillText(situation.speech, lineContext(state, call.taskId, call.lineIndex, call.pickerId)) : '';
}
