// Списание (M7e1; docs/03-warehouse-flow.md, раздел 7; docs/10, раздел 13.4).
// Партии «истекает сегодня» не продаются; по ним по одному появляются задания «Списание»:
// снять с полки и отнести в зону брака. Партия уходит со склада, когда задание закрыто (при любом исходе, 10, раздел 11.6).
import type { GameState } from '../model/game';
import type { StockRecord } from '../model/stock';
import type { WriteoffTask } from '../model/task';
import { REWARD, WRITEOFF } from '../config/balance';
import { isExpiring, removeStock } from './stock';

/** Открытое задание «Списание» уже есть на эту партию. */
function hasOpenWriteoff(state: GameState, recordId: string): boolean {
  return Object.values(state.tasks).some((t) =>
    t.type === 'writeoff' && t.status !== 'done' && t.status !== 'expired' && t.payload.stockRecordId === recordId);
}

/** Партии, которые истекают и ещё ждут задания (по порядку id — чтобы не зависеть от случайностей). */
export function pendingWriteoffs(state: GameState): StockRecord[] {
  return Object.values(state.stock)
    .filter((r) => r.qty > 0 && isExpiring(r) && !hasOpenWriteoff(state, r.id))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** Задание «Списание» на партию. */
export function createWriteoff(state: GameState, record: StockRecord, now: number): GameState {
  const n = state.nextId;
  const difficulty = 1 as const; // одна позиция (04, раздел 4.2: по числу снимаемых позиций)
  const task: WriteoffTask = {
    id: `task-${n}`,
    number: n,
    type: 'writeoff',
    status: 'new',
    createdAt: now,
    deadline: now, // ВРЕМЕННО: сроков ещё нет (M8)
    difficulty,
    reward: {
      money: REWARD.moneyPerDifficulty * difficulty * REWARD.typeFactor.writeoff,
      rating: REWARD.ratingPerTask,
    },
    location: { kind: 'address', address: record.address },
    assignedPickerId: null,
    mode: null,
    outcome: null,
    payload: { stockRecordId: record.id, productId: record.productId, address: record.address, qty: record.qty },
  };
  return { ...state, nextId: n + 1, tasks: { ...state.tasks, [task.id]: task } };
}

/**
 * Шаг мира для списаний: пришло время — задание на следующую истекающую партию.
 * Нечего списывать — время следующего не сдвигается: задание появится, как только найдётся партия.
 */
export function tickWriteoffs(state: GameState): GameState {
  const now = state.clock.time;
  if (now < state.nextWriteoffAt) return state;
  const [record] = pendingWriteoffs(state);
  if (!record) return state;
  return { ...createWriteoff(state, record, now), nextWriteoffAt: now + WRITEOFF.everySeconds };
}

/** Списание закрыто: партия ушла со склада в брак. Сколько снимать — сколько было в задании, но не больше, чем лежит. */
export function completeWriteoff(state: GameState, task: WriteoffTask): GameState {
  const rec = state.stock[task.payload.stockRecordId];
  if (!rec) return state;
  return { ...state, stock: removeStock(state.stock, rec.id, task.payload.qty) };
}
