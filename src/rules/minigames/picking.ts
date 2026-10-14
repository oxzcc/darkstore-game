// Шаги мини-игры «Сборка» (docs/06-minigames.md, раздел 5; docs/09-architecture.md, раздел 6.2).
// M5e1: сборщик идёт к выбранному стеллажу, клик по товару — скан одной штуки, «товар не из заказа».
// «−1», «Не найдено», «На фасовку» и результат — M5e2. Пока последний скан сам отправляет сборщика на фасовку.
import type { GameState } from '../../model/game';
import type { Address } from '../../model/address';
import type { MinigameSession, PickingAction, ScanFeedback } from '../../model/minigame';
import type { Stock } from '../../model/stock';
import type { OrderLine } from '../../model/task';
import type { WarehouseMap } from '../../model/warehouse';
import { isValidAddress, sameAddress } from '../address';
import { accessSpotsForAddress } from '../warehouse';
import { packSteps } from '../jobs';
import { shelfContents } from '../stock';

/** Позиции заказа, который собирается в сессии. */
function orderLines(state: GameState, session: MinigameSession): OrderLine[] {
  const task = state.tasks[session.taskId];
  return task?.type === 'order' ? task.payload.lines : [];
}

/** Сколько штук взято в каждую позицию заказа (по порядку позиций). ТСД показывает «взято 1 из 2» отсюда. */
export function takenPerLine(session: MinigameSession, lineCount: number): number[] {
  const taken = Array.from({ length: lineCount }, () => 0);
  for (const a of session.actions) if (a.lineIndex < lineCount) taken[a.lineIndex] += 1;
  return taken;
}

/** Сколько штук товара взято в сессии с этой полки. */
function takenFrom(session: MinigameSession, address: Address, productId: string): number {
  return session.actions.filter((a) => a.productId === productId && sameAddress(a.address, address)).length;
}

/**
 * Склад, каким его видно во время сессии: остатки минус уже взятое в тележку.
 * Сам склад не меняется (это сделает M6 по итогу задания) — меняется только то, что рисуется на полках.
 */
export function seenStock(stock: Stock, actions: PickingAction[] | undefined): Stock {
  if (!actions || actions.length === 0) return stock;
  const out: Stock = { ...stock };
  for (const a of actions) {
    const rec = Object.values(out).find(
      (r) => r.productId === a.productId && sameAddress(r.address, a.address) && r.qty > 0,
    );
    if (rec) out[rec.id] = { ...rec, qty: rec.qty - 1 };
  }
  return out;
}

/**
 * Игрок выбрал стеллаж на складе (06, раздел 2.2): сборщик идёт к нему в обычном темпе.
 * Пока идёт, клик по другому стеллажу меняет цель — не ошибка, только потерянное время.
 * Не принимается без мини-игры, на паузе и когда камера уже у стеллажа (сначала «Назад к складу»).
 * Дошёл — advanceWorld ставит atFocus, и камера подлетает.
 */
export function chooseRack(state: GameState, map: WarehouseMap, aisle: number, rack: number): GameState {
  const session = state.minigame;
  if (!session || state.clock.paused || session.atFocus) return state;
  if (!map.racks.some((r) => r.aisle === aisle && r.rack === rack)) return state;
  const picker = state.pickers[session.pickerId];
  if (!picker?.job) return state;

  // если шёл — встаёт на ближайшую пройденную клетку и строит путь оттуда
  const done = Math.floor(picker.pathProgress);
  const position = done > 0 && picker.path[done - 1] ? picker.path[done - 1] : picker.position;
  const spots = accessSpotsForAddress(map, { aisle, rack, shelf: 1 });

  return {
    ...state,
    minigame: { ...session, focus: { aisle, rack }, atFocus: false },
    pickers: {
      ...state.pickers,
      [picker.id]: {
        ...picker,
        position,
        path: [],
        pathProgress: 0,
        job: {
          ...picker.job,
          steps: [{ kind: 'walk', to: spots[0], spots, label: `к ${aisle}.${rack}` }],
          stepIndex: 0,
          stepElapsed: 0,
        },
      },
    },
  };
}

/** «Назад к складу»: камера отлетает в общий вид, сборщик стоит у стеллажа, стеллаж остаётся выбранным. */
export function leaveRack(state: GameState): GameState {
  const session = state.minigame;
  if (!session || !session.atFocus) return state;
  return { ...state, minigame: { ...session, atFocus: false } };
}

/**
 * Скан одной штуки товара на полке выбранного стеллажа (06, раздел 5, шаг 3).
 * ТСД сверяет только товар: есть в заказе — +1 к позиции, нет — «Товар не из заказа» (мелкая ошибка, только время).
 * Взять можно только то, что реально лежит на полке (остаток минус уже взятое).
 * Лишнюю штуку сверх заказа взять можно — убрать её «−1» можно будет в M5e2.
 */
export function scanShelf(state: GameState, map: WarehouseMap, address: Address, productId: string): GameState {
  const session = state.minigame;
  if (!session || state.clock.paused || !session.atFocus || !session.focus) return state;
  if (address.aisle !== session.focus.aisle || address.rack !== session.focus.rack) return state;
  if (!isValidAddress(map, address)) return state;
  const onShelf = shelfContents(state.stock, address).find((c) => c.productId === productId)?.qty ?? 0;
  if (onShelf === 0) return state; // этого товара здесь и не было — кликать не по чему

  const feedback = (result: ScanFeedback['result'], lineIndex: number | null): ScanFeedback =>
    ({ result, productId, address, lineIndex, at: session.elapsed });

  if (onShelf - takenFrom(session, address, productId) <= 0) {
    return { ...state, minigame: { ...session, lastScan: feedback('shelfEmpty', null) } };
  }

  const lines = orderLines(state, session);
  const taken = takenPerLine(session, lines.length);
  const candidates = lines.map((_, i) => i).filter((i) => lines[i].productId === productId);
  if (candidates.length === 0) {
    return {
      ...state,
      minigame: {
        ...session,
        errors: [...session.errors, { kind: 'wrong_product', severity: 'minor', address }],
        lastScan: feedback('notInOrder', null),
      },
    };
  }

  // в первую недобранную позицию с этим товаром; если все добраны — лишняя штука в первую
  const lineIndex = candidates.find((i) => taken[i] < lines[i].qty) ?? candidates[0];
  const next: MinigameSession = {
    ...session,
    actions: [...session.actions, { kind: 'take', lineIndex, productId, address }],
    lastScan: feedback('taken', lineIndex),
  };
  const after = { ...state, minigame: next };

  // ВРЕМЕННО (M5e1): всё собрано — сборщик сам идёт на фасовку. В M5e2 это сделает кнопка «На фасовку».
  const all = takenPerLine(next, lines.length).every((n, i) => n >= lines[i].qty);
  return all ? finishPicking(after, map) : after;
}

/** Сборка закончена: сессия закрывается, сборщик идёт на фасовку и фасует обычными шагами работы. */
function finishPicking(state: GameState, map: WarehouseMap): GameState {
  const session = state.minigame!;
  const picker = state.pickers[session.pickerId];
  return {
    ...state,
    minigame: null,
    pickers: {
      ...state.pickers,
      [picker.id]: {
        ...picker,
        state: 'walking',
        path: [],
        pathProgress: 0,
        job: { taskId: session.taskId, steps: packSteps(map), stepIndex: 0, stepElapsed: 0 },
      },
    },
  };
}
