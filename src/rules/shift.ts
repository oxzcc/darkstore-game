// Смена и кампания (M8a; docs/02-gameplay-loop.md, разделы 1, 3, 11; решения автора 14.10).
// Смена идёт SHIFT.durationSeconds игрового времени; вышло — мир останавливается и открываются итоги.
// «Следующая смена»: номер +1 (это и календарь сроков годности), время с нуля, склад и деньги переходят дальше,
// незакрытые задания исчезают без штрафа. После последней смены — итоги кампании.
import type { GameState } from '../model/game';
import type { Campaign, ShiftResult } from '../model/campaign';
import type { Outcome } from '../model/task';
import type { WarehouseMap } from '../model/warehouse';
import { DELIVERY, SHIFT, WRITEOFF } from '../config/balance';
import { createRng } from './random';
import { fillOrders } from './pace';
import { shiftPlan } from './shiftPlan';
import { tickDeliveries } from './deliveries';
import { createPutawayTasks } from './putaway';
import { assignDeadlines } from './deadline';
import { levelsOf, restBetweenShifts, spendPoint } from './pickerStats';
import type { StatKey } from '../model/picker';
import type { Picker } from '../model/picker';
import { PICKER_GROWTH } from '../config/balance';

/** Кампания на старте. */
export function newCampaign(money: number, rating: number, pickers: Record<string, Picker> = {}): Campaign {
  return { shift: 1, totalShifts: SHIFT.totalShifts, phase: 'running', startMoney: money, startRating: rating, history: [], lost: false,
    startLevels: levelsOf(pickers), tutorialForks: [], hintsSeen: [] };
}

/** Сколько игровых секунд осталось до конца смены. */
export function shiftSecondsLeft(state: GameState): number {
  return Math.max(0, SHIFT.durationSeconds - state.clock.time);
}

/** Звёзды по доле закрытых заданий (SHIFT.starThresholds). Заданий не было — 0. */
export function starsFor(closed: number, appeared: number): 0 | 1 | 2 | 3 {
  if (appeared <= 0) return 0;
  const share = closed / appeared;
  const [one, two, three] = SHIFT.starThresholds;
  return share >= three ? 3 : share >= two ? 2 : share >= one ? 1 : 0;
}

/** Задание ещё открыто (не закрыто и не просрочено). */
const isOpen = (t: GameState['tasks'][string]) => t.status !== 'done' && t.status !== 'expired';

/** Итог текущей смены: по журналу закрытых заданий этой смены и по тому, что осталось открытым. */
export function shiftResult(state: GameState): ShiftResult {
  const byOutcome: Record<Outcome, number> = { perfect: 0, withErrors: 0, failed: 0 };
  const pickers: Record<string, number> = {};
  let closed = 0;
  let expired = 0;
  for (const e of state.shiftLog) {
    if (e.kind === 'taskExpired') expired++;
    if (e.kind !== 'taskDone') continue;
    closed++;
    byOutcome[e.outcome]++;
    pickers[e.pickerId] = (pickers[e.pickerId] ?? 0) + 1;
  }
  // просроченные выкладки и списания остаются открытыми — их считаем один раз (среди открытых или закрытых)
  const keptOverdue = Object.values(state.tasks).filter((t) => t.overdue).length;
  const open = Object.values(state.tasks).filter(isOpen).length;
  const appeared = closed + open + expired - keptOverdue;
  // рост сборщиков за смену: опыт по исходам, уровень в начале и в конце смены, усталость сейчас (docs/10, раздел 14.8)
  const growth: ShiftResult['growth'] = {};
  for (const p of Object.values(state.pickers)) {
    growth[p.id] = { xp: 0, fromLevel: state.campaign.startLevels?.[p.id] ?? p.level, level: p.level, fatigue: Math.round(p.stats.fatigue) };
  }
  for (const e of state.shiftLog) {
    if (e.kind === 'taskDone' && growth[e.pickerId]) growth[e.pickerId].xp += PICKER_GROWTH.xp[e.outcome];
  }
  return {
    shift: state.campaign.shift,
    appeared,
    growth,
    closed,
    expired,
    byOutcome,
    stars: starsFor(closed, appeared),
    money: state.money - state.campaign.startMoney,
    rating: state.rating - state.campaign.startRating,
    pickers,
  };
}

/** Время смены вышло: мир стоит, итог смены записан в историю, открывается экран итогов. */
export function endShift(state: GameState): GameState {
  if (state.campaign.phase !== 'running') return state;
  const result = shiftResult(state);
  return {
    ...state,
    clock: { ...state.clock, time: Math.min(state.clock.time, SHIFT.durationSeconds) },
    // рейтинг ниже порога — кампания проиграна (решение автора 14.10: проверка в конце смены)
    campaign: { ...state.campaign, phase: 'summary', history: [...state.campaign.history, result], lost: state.rating < SHIFT.loseRating },
  };
}

/** Смена последняя — после итогов идут итоги кампании, а не новая смена. */
export function isLastShift(state: GameState): boolean {
  return state.campaign.shift >= state.campaign.totalShifts;
}

/**
 * «Следующая смена». Незакрытые задания исчезают без штрафа (решение автора 14.10), сборщики свободны и стоят, где стояли.
 * Грузовик, который не успели принять, уезжает вместе с паллетами; уже принятые паллеты остаются — на них снова «Выкладки».
 * Истекающие партии дадут «Списания» сами (по новому номеру смены). Заказы набираются заново, поставка — как в начале смены.
 */
export function startNextShift(state: GameState, map: WarehouseMap): GameState {
  if (state.campaign.phase !== 'summary' || isLastShift(state) || state.campaign.lost) return state;

  // поставки у ворот уезжают вместе с непринятыми паллетами
  const deliveries = { ...state.deliveries };
  const pallets = { ...state.pallets };
  for (const d of Object.values(state.deliveries)) {
    if (d.status !== 'atGate') continue;
    for (const id of d.palletIds) delete pallets[id];
    delete deliveries[d.id];
  }

  // сборщики свободны; усталость за ночь падает (M8c)
  const pickers = Object.fromEntries(Object.entries(state.pickers).map(([id, p]) => [id, {
    ...restBetweenShifts(p), state: 'idle' as const, taskId: null, job: null, path: [], pathProgress: 0,
  }]));

  let next: GameState = {
    ...state,
    campaign: { ...state.campaign, shift: state.campaign.shift + 1, phase: 'running', startMoney: state.money, startRating: state.rating,
      startLevels: levelsOf(pickers) },
    clock: { ...state.clock, time: 0, paused: false },
    tasks: {},
    calls: [],
    tsdOffer: null,
    minigame: null,
    tsdGame: null,
    shiftLog: [],
    pickers,
    deliveries,
    pallets,
    nextDeliveryAt: 0, // поставку задаём ниже, по плану новой смены
    truckComing: null, // ехавший к воротам грузовик в новую смену не приезжает — поставка выедет заново
    nextOrderAt: 0,
    nextWriteoffAt: WRITEOFF.firstAtSeconds,
  };
  // принятые, но не выложенные паллеты — снова «Выкладки»
  for (const d of Object.values(next.deliveries)) next = createPutawayTasks(next, map, d.id);
  next = { ...next, nextDeliveryAt: DELIVERY.firstAtStart ? 0 : shiftPlan(next).deliveryEvery };
  next = tickDeliveries(next);
  const rng = createRng(next.rngSeed);
  next = fillOrders(next, rng, 0); // заказы под загрузку новой смены (M8d)
  return assignDeadlines({ ...next, rngSeed: rng.seed() }, map);
}

/** После итогов последней смены (или если кампания проиграна) — итоги кампании. */
export function finishCampaign(state: GameState): GameState {
  if (state.campaign.phase !== 'summary' || (!isLastShift(state) && !state.campaign.lost)) return state;
  return { ...state, campaign: { ...state.campaign, phase: 'over' } };
}

/**
 * Вложить очко сборщика в характеристику (X3, docs/10 раздел 14.8): только на экране итогов смены.
 * Нет очков, потолок 10 или смена ещё идёт — состояние не меняется.
 */
export function spendPointInSummary(state: GameState, pickerId: string, stat: StatKey): GameState {
  if (state.campaign.phase !== 'summary') return state;
  const picker = state.pickers[pickerId];
  if (!picker) return state;
  const next = spendPoint(picker, stat);
  return next === picker ? state : { ...state, pickers: { ...state.pickers, [pickerId]: next } };
}
