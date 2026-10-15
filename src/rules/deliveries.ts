// Поставки и приёмка (M7b; docs/03-warehouse-flow.md, раздел 4; docs/10, раздел 13.2).
// Грузовик приезжает по таймеру, паллеты сразу встают в зону приёмки, появляется задание «Приёмка».
// Принятые паллеты ждут выкладки (M7c). Что на паллете, то и принимается при любом исходе (10, раздел 11.6).
import type { GameState } from '../model/game';
import type { Address } from '../model/address';
import type { Delivery, Pallet, PalletItem } from '../model/delivery';
import type { ReceivingTask } from '../model/task';
import type { Cell } from '../model/warehouse';
import { DELIVERY, REWARD } from '../config/balance';
import type { Rng } from './random';
import { createRng } from './random';
import { reservedQty } from './rewards';
import { addressKey } from './address';
import { isExpiring } from './stock';

/** Паллета ещё на складе (не разобрана до конца) — её товар «уже едет» на полки. */
const palletPending = (p: Pallet) => p.state !== 'empty';

/**
 * Сколько каждого товара свободно: на полках − обещано открытым заказам + уже на паллетах в зоне приёмки.
 * По этому числу поставка выбирает, что везти (решение автора 14.10: «чего меньше всего»).
 */
export function freeByProduct(state: GameState): Record<string, number> {
  const free: Record<string, number> = {};
  for (const id of Object.keys(state.products)) free[id] = 0;
  const shelves = new Map<string, { productId: string; address: Address }>();
  for (const r of Object.values(state.stock)) {
    if (!isExpiring(r, state.campaign.shift)) free[r.productId] = (free[r.productId] ?? 0) + r.qty; // истекающее не продаётся — его как будто нет
    shelves.set(`${r.productId}|${addressKey(r.address)}`, { productId: r.productId, address: r.address });
  }
  // обещанное заказам считается по полке, один раз на полку (партий на полке может быть несколько)
  for (const { productId, address } of shelves.values()) free[productId] -= reservedQty(state, productId, address);
  for (const p of Object.values(state.pallets)) {
    if (!palletPending(p)) continue;
    for (const it of p.items) free[it.productId] = (free[it.productId] ?? 0) + it.qty;
  }
  return free;
}

/** Свободные места для паллет в зоне приёмки (по порядку из config). */
export function freePalletSlots(state: GameState): Cell[] {
  const taken = new Set(Object.values(state.pallets).filter(palletPending).map((p) => `${p.cell.x},${p.cell.z}`));
  return DELIVERY.palletSlots.filter((c) => !taken.has(`${c.x},${c.z}`));
}

/** Сложность приёмки — по числу паллет: 1, 2, 3 (04, раздел 4.2). */
export function receivingDifficulty(pallets: number): 1 | 2 | 3 {
  return pallets <= 1 ? 1 : pallets === 2 ? 2 : 3;
}

/** Грузовик у ворот — значит, новая поставка подождёт (не больше одной у ворот). */
export function truckAtGate(state: GameState): boolean {
  return Object.values(state.deliveries).some((d) => d.status === 'atGate');
}

/**
 * Новая поставка: паллеты в зоне приёмки и задание «Приёмка».
 * Состав: товары по возрастанию свободного количества (одинаковые — в случайном порядке), без повторов внутри паллеты.
 * null — у ворот уже стоит грузовик или в зоне приёмки нет места даже под одну паллету.
 */
export function createDelivery(state: GameState, rng: Rng, now: number): GameState | null {
  if (truckAtGate(state)) return null;
  const slots = freePalletSlots(state);
  if (slots.length === 0) return null;

  const free = freeByProduct(state);
  const queue = rng.shuffle(Object.keys(state.products)).sort((a, b) => free[a] - free[b]);
  if (queue.length === 0) return null;

  const palletCount = Math.min(rng.int(...DELIVERY.pallets), slots.length);
  const n = state.nextId;
  const deliveryId = `delivery-${n}`;
  const pallets: Pallet[] = [];
  let cursor = 0; // идём по очереди «чего меньше всего» через все паллеты поставки
  for (let i = 0; i < palletCount; i++) {
    const kinds = Math.min(rng.int(...DELIVERY.productsPerPallet), queue.length);
    const items: PalletItem[] = [];
    while (items.length < kinds) {
      const productId = queue[cursor % queue.length];
      cursor++;
      if (items.some((it) => it.productId === productId)) continue;
      items.push({ productId, qty: rng.int(...DELIVERY.qtyPerProduct) });
    }
    pallets.push({ id: `pallet-${n}-${i + 1}`, deliveryId, state: 'inReceiving', items, cell: slots[i] });
  }

  const delivery: Delivery = { id: deliveryId, number: n, status: 'atGate', palletIds: pallets.map((p) => p.id), arrivedAt: now };
  const difficulty = receivingDifficulty(palletCount);
  const task: ReceivingTask = {
    id: `task-${n}`,
    number: n,
    type: 'receiving',
    status: 'new',
    createdAt: now,
    deadline: null, // срок посчитает advanceWorld (rules/deadline.ts, M8b)
    difficulty,
    reward: {
      money: REWARD.moneyPerDifficulty * difficulty * REWARD.typeFactor.receiving,
      rating: REWARD.ratingPerTask,
    },
    location: { kind: 'zone', zone: 'receiving' },
    assignedPickerId: null,
    mode: null,
    outcome: null,
    payload: { deliveryId, palletCount },
  };

  return {
    ...state,
    nextId: n + 1,
    deliveries: { ...state.deliveries, [deliveryId]: delivery },
    pallets: { ...state.pallets, ...Object.fromEntries(pallets.map((p) => [p.id, p])) },
    tasks: { ...state.tasks, [task.id]: task },
  };
}

/**
 * Шаг мира для поставок: пришло время — приезжает грузовик. Если у ворот занято или нет мест под паллеты,
 * поставка ждёт и приедет, как только станет можно; следующая — через интервал после приезда этой.
 */
export function tickDeliveries(state: GameState): GameState {
  const now = state.clock.time;
  if (now < state.nextDeliveryAt) return state;
  const rng = createRng(state.rngSeed);
  const next = createDelivery(state, rng, now);
  if (!next) return state;
  return { ...next, rngSeed: rng.seed(), nextDeliveryAt: now + DELIVERY.intervalSeconds };
}

/** Приёмка закрыта: паллеты приняты (ждут выкладки), грузовик уезжает. Не зависит от исхода (10, раздел 11.6). */
export function acceptDelivery(state: GameState, deliveryId: string): GameState {
  const d = state.deliveries[deliveryId];
  if (!d) return state;
  const pallets = { ...state.pallets };
  for (const id of d.palletIds) if (pallets[id]) pallets[id] = { ...pallets[id], state: 'accepted' };
  return { ...state, deliveries: { ...state.deliveries, [d.id]: { ...d, status: 'received' } }, pallets };
}
