// Выкладка (M7c; docs/03-warehouse-flow.md, раздел 5; docs/10, раздел 13.3).
// После приёмки на каждую паллету — задание «Выкладка». Куда класть, система решает сразу при появлении задания:
// товар целиком на одну полку — свою, если влезает всё, иначе ближайшую к зоне приёмки пустую (planPutaway).
// Товар появляется на полках разом, когда задание закрыто (склад меняется только при завершении задания).
import type { GameState } from '../model/game';
import type { Address } from '../model/address';
import type { Pallet, PalletItem } from '../model/delivery';
import type { PutawayLine, PutawayTask } from '../model/task';
import type { WarehouseMap } from '../model/warehouse';
import { PUTAWAY, REWARD } from '../config/balance';
import { addressKey } from './address';
import { addStock, productOnShelf, qtyAt } from './stock';
import { accessSpotsForAddress, distancesFrom, zoneAccess } from './warehouse';

/** Открытая выкладка — её полки уже «обещаны» и для других выкладок заняты. */
const isOpenPutaway = (t: GameState['tasks'][string]): t is PutawayTask =>
  t.type === 'putaway' && t.status !== 'done' && t.status !== 'expired';

/** Что обещано полкам открытыми выкладками: какой товар и сколько штук ещё приедет. */
function plannedByShelf(state: GameState): Map<string, { productId: string; qty: number }> {
  const out = new Map<string, { productId: string; qty: number }>();
  for (const t of Object.values(state.tasks)) {
    if (!isOpenPutaway(t)) continue;
    for (const l of t.payload.lines) {
      const k = addressKey(l.address);
      const prev = out.get(k);
      out.set(k, { productId: l.productId, qty: (prev?.qty ?? 0) + l.qty });
    }
  }
  return out;
}

/** Все полки склада, от ближней к зоне приёмки до дальней (расстояние — по клеткам прохода). */
function shelvesByDistance(map: WarehouseMap): Address[] {
  const dist = distancesFrom(map, zoneAccess(map, 'receiving'));
  const list: { address: Address; d: number }[] = [];
  for (const rack of map.racks) {
    for (let shelf = 1; shelf <= rack.shelves; shelf++) {
      const address = { aisle: rack.aisle, rack: rack.rack, shelf };
      const ds = accessSpotsForAddress(map, address).map((c) => dist.get(`${c.x},${c.z}`) ?? Infinity);
      list.push({ address, d: Math.min(...ds) });
    }
  }
  // при равном расстоянии — по адресу, чтобы порядок не зависел от случайностей
  return list.sort((a, b) => a.d - b.d || addressKey(a.address).localeCompare(addressKey(b.address))).map((x) => x.address);
}

export type PutawayPlan = { lines: PutawayLine[]; leftover: PalletItem[] };

/**
 * Куда разложить товар паллеты (правка автора 14.10: поменьше остановок).
 * Каждый товар — целиком на одну полку: на полку с этим же товаром, если там хватает места на всё, иначе на ближайшую пустую.
 * Больше вместимости полки — несколько пустых полок подряд. Пустых нет — доложить на полки с этим товаром, сколько влезет.
 * Места не хватило совсем — остаток в leftover. Позиции идут от ближней к зоне приёмки полки к дальней — так сборщик и обходит их.
 */
export function planPutaway(state: GameState, map: WarehouseMap, items: PalletItem[]): PutawayPlan {
  const shelves = shelvesByDistance(map);
  const order = new Map(shelves.map((a, i) => [addressKey(a), i]));
  const planned = plannedByShelf(state);
  const lines: PutawayLine[] = [];
  const leftover: PalletItem[] = [];

  // что на полке будет после всех обещаний (включая уже разложенное из этой паллеты)
  const productAt = (a: Address) => productOnShelf(state.stock, a) ?? planned.get(addressKey(a))?.productId ?? null;
  const roomAt = (a: Address) => PUTAWAY.shelfCapacity - qtyAt(state.stock, a) - (planned.get(addressKey(a))?.qty ?? 0);
  const put = (a: Address, productId: string, qty: number) => {
    const k = addressKey(a);
    planned.set(k, { productId, qty: (planned.get(k)?.qty ?? 0) + qty });
    lines.push({ productId, address: a, qty });
  };

  for (const item of items) {
    let left = item.qty;
    // 1) своя полка, куда влезает всё сразу
    const whole = shelves.find((a) => productAt(a) === item.productId && roomAt(a) >= left);
    if (whole) { put(whole, item.productId, left); continue; }
    // 2) пустые полки, от ближней
    for (const a of shelves) {
      if (left <= 0) break;
      if (productAt(a) !== null) continue;
      const q = Math.min(left, roomAt(a));
      if (q <= 0) continue;
      put(a, item.productId, q);
      left -= q;
    }
    // 3) пустых не хватило — доложить на свои полки, сколько влезет
    for (const a of shelves) {
      if (left <= 0) break;
      if (productAt(a) !== item.productId) continue;
      const q = Math.min(left, roomAt(a));
      if (q <= 0) continue;
      put(a, item.productId, q);
      left -= q;
    }
    if (left > 0) leftover.push({ productId: item.productId, qty: left });
  }

  lines.sort((x, y) => order.get(addressKey(x.address))! - order.get(addressKey(y.address))!);
  return { lines, leftover };
}

/** Сложность выкладки по числу позиций (PUTAWAY.difficultyByLines). */
export function putawayDifficulty(lines: number): 1 | 2 | 3 {
  const [easy, medium] = PUTAWAY.difficultyByLines;
  return lines <= easy ? 1 : lines <= medium ? 2 : 3;
}

/** Задание «Выкладка» на одну принятую паллету. Разложить некуда совсем — задания нет, паллета стоит. */
function createPutaway(state: GameState, map: WarehouseMap, pallet: Pallet, now: number): GameState {
  const { lines } = planPutaway(state, map, pallet.items);
  if (lines.length === 0) return state;
  const n = state.nextId;
  const difficulty = putawayDifficulty(lines.length);
  const task: PutawayTask = {
    id: `task-${n}`,
    number: n,
    type: 'putaway',
    status: 'new',
    createdAt: now,
    deadline: null, // срок посчитает advanceWorld (rules/deadline.ts, M8b)
    difficulty,
    reward: {
      money: REWARD.moneyPerDifficulty * difficulty * REWARD.typeFactor.putaway,
      rating: REWARD.ratingPerTask,
    },
    location: { kind: 'zone', zone: 'receiving' },
    assignedPickerId: null,
    mode: null,
    outcome: null,
    payload: { palletId: pallet.id, palletCell: pallet.cell, lines },
  };
  return { ...state, nextId: n + 1, tasks: { ...state.tasks, [task.id]: task } };
}

/** Приёмка закрыта — на каждую её паллету появляется «Выкладка» (по порядку паллет). */
export function createPutawayTasks(state: GameState, map: WarehouseMap, deliveryId: string): GameState {
  const d = state.deliveries[deliveryId];
  if (!d) return state;
  let s = state;
  for (const id of d.palletIds) {
    const p = s.pallets[id];
    if (p?.state === 'accepted') s = createPutaway(s, map, p, s.clock.time);
  }
  return s;
}

/**
 * Выкладка закрыта: товар на полках (новыми партиями), паллета пустая и исчезает.
 * Не зависит от исхода (10, раздел 11.6). Что не влезло при планировании, остаётся на паллете.
 * Срок годности — от текущей смены (M8a: календарь — номер смены).
 */
export function completePutaway(state: GameState, task: PutawayTask): GameState {
  let stock = state.stock;
  for (const l of task.payload.lines) {
    const product = state.products[l.productId];
    const expiresAtShift = state.campaign.shift + (product?.shelfLifeShifts ?? 0);
    stock = addStock(stock, { productId: l.productId, address: l.address, expiresAtShift }, l.qty);
  }
  const pallet = state.pallets[task.payload.palletId];
  if (!pallet) return { ...state, stock };
  // остаток: что было на паллете минус разложенное
  const placed = new Map<string, number>();
  for (const l of task.payload.lines) placed.set(l.productId, (placed.get(l.productId) ?? 0) + l.qty);
  const rest = pallet.items
    .map((it) => ({ productId: it.productId, qty: it.qty - (placed.get(it.productId) ?? 0) }))
    .filter((it) => it.qty > 0);
  const next: Pallet = rest.length > 0 ? { ...pallet, state: 'unpacked', items: rest } : { ...pallet, state: 'empty', items: [] };
  return { ...state, stock, pallets: { ...state.pallets, [pallet.id]: next } };
}
