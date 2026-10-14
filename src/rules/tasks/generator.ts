// Появление заданий (04, раздел 6). В M3 — только заказы на сборку.
// Генератор по весам типов и темп под загрузку сборщиков — M8.
import type { GameState } from '../../model/game';
import type { OrderLine, OrderTask } from '../../model/task';
import type { StockRecord } from '../../model/stock';
import { ORDER, REWARD } from '../../config/balance';
import type { Rng } from '../random';

/** Сложность по числу позиций (допущение из 04, раздел 4.2). */
export function orderDifficulty(lines: number): 1 | 2 | 3 {
  const [easy, medium] = ORDER.difficultyByLines;
  return lines <= easy ? 1 : lines <= medium ? 2 : 3;
}

/**
 * Новый заказ клиента. Берёт только товары, которые ЕСТЬ ПО УЧЁТУ (04, 5.1: «если товара в учёте нет,
 * заказ не создаётся»). Фактического наличия генератор не знает — как и настоящая система.
 * Возвращает null, если на складе по учёту пусто.
 */
export function createOrder(state: GameState, rng: Rng, now: number): { state: GameState; task: OrderTask } | null {
  // Записи с товаром по учёту, сгруппированные по товару.
  const byProduct = new Map<string, StockRecord[]>();
  for (const r of Object.values(state.stock)) {
    if (r.qty <= 0) continue;
    byProduct.set(r.productId, [...(byProduct.get(r.productId) ?? []), r]);
  }
  if (byProduct.size === 0) return null;

  const [minLines, maxLines] = ORDER.linesPerOrder;
  const count = rng.int(Math.min(minLines, byProduct.size), Math.min(maxLines, byProduct.size));
  const products = rng.shuffle([...byProduct.keys()]).slice(0, count);

  const lines: OrderLine[] = products.map((productId) => {
    const rec = rng.pick(byProduct.get(productId)!);
    const [minQty, maxQty] = ORDER.qtyPerLine;
    return { productId, address: rec.address, qty: rng.int(minQty, Math.min(maxQty, rec.qty)) };
  });

  const difficulty = orderDifficulty(lines.length);
  const n = state.nextId;
  const task: OrderTask = {
    id: `task-${n}`,
    number: n,
    type: 'order',
    status: 'new',
    createdAt: now,
    deadline: now, // ВРЕМЕННО: сроков ещё нет, появятся с ходом времени (M4)
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
