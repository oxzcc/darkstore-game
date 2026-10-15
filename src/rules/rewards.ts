// Итог задания (M6; 09, раздел 5.1): деньги, рейтинг и что ушло со склада.
// Одна функция применяет итог при любом пути — сборщик сам, развилка, игра на ТСД.
// Окно итога (ui_12) показывает ровно эти же числа: оно зовёт rewardFor и pickedQty отсюда.
import type { GameState } from '../model/game';
import type { OutcomeReveal } from '../model/call';
import type { Address } from '../model/address';
import type { Stock } from '../model/stock';
import type { OrderTask, Outcome, Task } from '../model/task';
import { RATING_RANGE } from '../config/balance';
import { RESULT_SHARE, SITUATION_BY_ID, WITH_ERRORS_MONEY_BY_TYPE } from '../config/calls';
import { acceptDelivery } from './deliveries';
import { completePutaway } from './putaway';
import { completeWriteoff } from './writeoff';
import { isTutorial } from './shiftPlan';
import { sameAddress } from './address';
import { isExpiring, removeStock } from './stock';

/**
 * Сколько денег и рейтинга даёт исход: доля от базовой награды задания (RESULT_SHARE).
 * У приёмки и выкладки «неплохо» даёт меньше денег (WITH_ERRORS_MONEY_BY_TYPE, решение автора 14.10).
 */
export function rewardFor(task: Task, outcome: Outcome, noPenalty = false): { money: number; rating: number } {
  if (task.overdue) return { money: 0, rating: 0 }; // просроченная выкладка или списание — без награды (M8b)
  const share = RESULT_SHARE[outcome];
  const moneyShare = outcome === 'withErrors' ? WITH_ERRORS_MONEY_BY_TYPE[task.type] ?? share.money : share.money;
  const r = { money: Math.round(task.reward.money * moneyShare), rating: task.reward.rating * share.rating };
  // обучающая смена (M8d): провал ничего не отнимает, награда за успех остаётся
  return noPenalty ? { money: Math.max(0, r.money), rating: Math.max(0, r.rating) } : r;
}

/**
 * Сколько штук каждой позиции заказа реально собрано (по порядку позиций).
 * По умолчанию — всё. Меньше, если: в развилке пропустили позицию; на ТСД в «Глубине» не достали товар;
 * сборщик ошибся с количеством (reveal.errorLine). ДОПУЩЕНИЕ Claude (M6): провал без развилки — товар собран,
 * но заказ провален (опоздал, помял), поэтому со склада он всё равно уходит.
 */
export function pickedQty(task: OrderTask, reveal?: OutcomeReveal): number[] {
  const c = reveal?.calls[0];
  const situation = c ? SITUATION_BY_ID[c.situationId] : undefined;
  const option = situation?.options.find((o) => o.id === c?.optionId);
  return task.payload.lines.map((l, i) => {
    let picked = l.qty;
    if (c && i === c.lineIndex && option?.cap) picked = 0;                                   // позиция пропущена
    if (c && i === c.lineIndex && c.tsd === 'failed' && situation?.tsdGame === 'depth') picked = 0; // не достали с ТСД
    if (reveal?.errorLine?.lineIndex === i) picked = Math.min(picked, reveal.errorLine.picked);
    return picked;
  });
}

/**
 * Снять товар с полки: сначала партии с ближним сроком (как на настоящем складе). Больше, чем есть, не снимается.
 * Партии «истекает сегодня» не берутся — их снимет списание (M7e1).
 */
export function takeFromShelf(stock: Stock, productId: string, address: Address, qty: number, shift?: number): Stock {
  const batches = Object.values(stock)
    .filter((r) => r.productId === productId && sameAddress(r.address, address) && !isExpiring(r, shift))
    .sort((a, b) => a.expiresAtShift - b.expiresAtShift);
  let s = stock;
  let left = qty;
  for (const r of batches) {
    if (left <= 0) break;
    const take = Math.min(left, r.qty);
    s = removeStock(s, r.id, take);
    left -= take;
  }
  return s;
}

/** Сколько штук на полке уже обещано открытым заказам (ещё не закрытым). Генератор не обещает больше, чем лежит. */
export function reservedQty(state: GameState, productId: string, address: Address): number {
  let sum = 0;
  for (const t of Object.values(state.tasks)) {
    if (t.type !== 'order' || t.status === 'done' || t.status === 'expired') continue;
    for (const l of t.payload.lines) if (l.productId === productId && sameAddress(l.address, address)) sum += l.qty;
  }
  return sum;
}

/** Рейтинг всегда в своих границах (RATING_RANGE). */
export function clampRating(r: number): number {
  return Math.min(RATING_RANGE.max, Math.max(RATING_RANGE.min, r));
}

/**
 * Применить итог закрытого задания: деньги, рейтинг, собранный товар уходит с полок, принятые паллеты ждут выкладки.
 * Зовётся один раз — в момент, когда задание стало «done» (advanceWorld).
 */
export function applyTaskResult(state: GameState, taskId: string, outcome: Outcome, reveal?: OutcomeReveal): GameState {
  const task = state.tasks[taskId];
  if (!task) return state;
  const reward = rewardFor(task, outcome, isTutorial(state));
  let stock = state.stock;
  if (task.type === 'order') {
    const picked = pickedQty(task, reveal);
    task.payload.lines.forEach((l, i) => { stock = takeFromShelf(stock, l.productId, l.address, picked[i], state.campaign.shift); });
  }
  const next: GameState = {
    ...state,
    money: state.money + reward.money,
    rating: clampRating(state.rating + reward.rating),
    stock,
  };
  // приёмка: паллеты приняты при любом исходе, грузовик уезжает; выкладка: товар на полках (10, раздел 11.6).
  // Задания «Выкладка» на принятые паллеты создаёт advanceWorld — ему нужна карта склада.
  if (task.type === 'receiving') return acceptDelivery(next, task.payload.deliveryId);
  if (task.type === 'putaway') return completePutaway(next, task);
  if (task.type === 'writeoff') return completeWriteoff(next, task);
  return next;
}
