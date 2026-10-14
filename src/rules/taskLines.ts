// Позиции задания любого типа в одном виде: что за товар, сколько и где (M7d1).
// Нужны развилкам (про какую позицию зовёт сборщик, что подставить в текст) и чеку в окне итога.
import type { GameState } from '../model/game';
import type { Address } from '../model/address';
import type { Task } from '../model/task';

/** Позиция: товар и количество; address — у сборки и выкладки (полка), pallet — у приёмки (номер паллеты с 1). */
export type TaskLine = { productId: string; qty: number; address?: Address; pallet?: number };

/** Позиции задания по порядку. У приёмки — все товары всех паллет поставки подряд. */
export function taskLines(state: GameState, task: Task): TaskLine[] {
  switch (task.type) {
    case 'order':
    case 'putaway':
      return task.payload.lines.map((l) => ({ productId: l.productId, qty: l.qty, address: l.address }));
    case 'receiving': {
      const d = state.deliveries[task.payload.deliveryId];
      if (!d) return [];
      return d.palletIds.flatMap((id, i) =>
        (state.pallets[id]?.items ?? []).map((it) => ({ productId: it.productId, qty: it.qty, pallet: i + 1 })));
    }
    case 'writeoff':
      return []; // списание — M7e
  }
}
