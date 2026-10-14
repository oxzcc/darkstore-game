// Появление заданий (04, раздел 6). В M3 — только заказы на сборку.
// Генератор по весам типов и темп под загрузку сборщиков — M8.
import type { GameState } from '../../model/game';
import type { OrderLine, OrderTask } from '../../model/task';
import type { StockRecord } from '../../model/stock';
import { ORDER, REWARD } from '../../config/balance';
import type { Rng } from '../random';
import { reservedQty } from '../rewards';
import { addressKey } from '../address';
import { sellableQtyAt } from '../stock';

/** Сложность по числу позиций (допущение из 04, раздел 4.2). */
export function orderDifficulty(lines: number): 1 | 2 | 3 {
  const [easy, medium] = ORDER.difficultyByLines;
  return lines <= easy ? 1 : lines <= medium ? 2 : 3;
}

/**
 * Новый заказ клиента. Берёт только товар, который лежит на полке и ещё не обещан другим открытым заказам
 * (04, 5.1: «если товара нет, заказ не создаётся»). Возвращает null, если свободного товара нет.
 */
export function createOrder(state: GameState, rng: Rng, now: number): { state: GameState; task: OrderTask } | null {
  // Свободный товар (лежит на полке и ещё не обещан открытым заказам), сгруппированный по товару.
  // На одной полке один товар (07, 5.3), поэтому свободное считается по полке целиком, а не по партии.
  const byProduct = new Map<string, { address: StockRecord['address']; free: number }[]>();
  const seen = new Set<string>();
  for (const r of Object.values(state.stock)) {
    const shelf = addressKey(r.address);
    if (seen.has(shelf)) continue;
    seen.add(shelf);
    // партии «истекает сегодня» не продаются — их ждёт списание (M7e1)
    const free = sellableQtyAt(state.stock, r.address, r.productId, state.campaign.shift) - reservedQty(state, r.productId, r.address);
    if (free <= 0) continue;
    byProduct.set(r.productId, [...(byProduct.get(r.productId) ?? []), { address: r.address, free }]);
  }
  if (byProduct.size === 0) return null;

  const [minLines, maxLines] = ORDER.linesPerOrder;
  const count = rng.int(Math.min(minLines, byProduct.size), Math.min(maxLines, byProduct.size));
  const products = rng.shuffle([...byProduct.keys()]).slice(0, count);

  const lines: OrderLine[] = products.map((productId) => {
    const rec = rng.pick(byProduct.get(productId)!);
    const [minQty, maxQty] = ORDER.qtyPerLine;
    return { productId, address: rec.address, qty: rng.int(Math.min(minQty, rec.free), Math.min(maxQty, rec.free)) };
  });

  const difficulty = orderDifficulty(lines.length);
  const n = state.nextId;
  const task: OrderTask = {
    id: `task-${n}`,
    number: n,
    type: 'order',
    status: 'new',
    createdAt: now,
    deadline: null, // срок посчитает advanceWorld (rules/deadline.ts, M8b)
    difficulty,
    reward: {
      money: REWARD.moneyPerDifficulty * difficulty * REWARD.typeFactor.order,
      rating: REWARD.ratingPerTask,
    },
    location: { kind: 'address', address: lines[0].address },
    assignedPickerId: null,
    mode: null,
    outcome: null,
    payload: { lines },
  };
  return { state: { ...state, nextId: n + 1, tasks: { ...state.tasks, [task.id]: task } }, task };
}

/** Открытые (ещё не назначенные) задания. */
export function openTasks(state: GameState) {
  return Object.values(state.tasks).filter((t) => t.status === 'new');
}

/** Дополняет очередь заказов до ORDER.openOrdersTarget. ВРЕМЕННО, до генератора смены (M8). */
export function topUpOrders(state: GameState, rng: Rng, now: number): GameState {
  let s = state;
  while (openTasks(s).filter((t) => t.type === 'order').length < ORDER.openOrdersTarget) {
    const made = createOrder(s, rng, now);
    if (!made) break;
    s = made.state;
  }
  return s;
}
