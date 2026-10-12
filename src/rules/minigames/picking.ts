// Шаги мини-игры «Сборка» (docs/06-minigames.md, раздел 5; docs/09-architecture.md, раздел 6.2).
// M5c: выбор стеллажа и «Назад к складу». M5d: клик по товару на полке (пока только «посмотреть»).
// Ходьба сборщика к стеллажу, сканы и ошибки — M5e.
import type { GameState } from '../../model/game';
import type { Address } from '../../model/address';
import type { WarehouseMap } from '../../model/warehouse';
import { isValidAddress } from '../address';
import { shelfContents } from '../stock';

/**
 * Игрок выбрал стеллаж на складе. Принимается только во время мини-игры, не на паузе
 * и не когда камера уже у стеллажа (сначала «Назад к складу»).
 * M5c: камера сразу летит к стеллажу; в M5e сначала туда дойдёт сборщик.
 */
export function chooseRack(state: GameState, map: WarehouseMap, aisle: number, rack: number): GameState {
  const session = state.minigame;
  if (!session || state.clock.paused || session.atFocus) return state;
  if (!map.racks.some((r) => r.aisle === aisle && r.rack === rack)) return state;
  return { ...state, minigame: { ...session, focus: { aisle, rack }, atFocus: true, inspected: null } };
}

/** «Назад к складу»: камера отлетает в общий вид, стеллаж остаётся выбранным, выбор товара сбрасывается. */
export function leaveRack(state: GameState): GameState {
  const session = state.minigame;
  if (!session || !session.atFocus) return state;
  return { ...state, minigame: { ...session, atFocus: false, inspected: null } };
}

/**
 * Клик по товару на полке (06, раздел 2.3). Принимается только у выбранного стеллажа, не на паузе
 * и только если на полке по факту что-то лежит. M5d: просто запоминаем полку — внизу появится карточка товара.
 * В M5e этот клик станет сканом одной штуки.
 */
export function inspectShelf(state: GameState, map: WarehouseMap, address: Address): GameState {
  const session = state.minigame;
  if (!session || state.clock.paused || !session.atFocus || !session.focus) return state;
  if (address.aisle !== session.focus.aisle || address.rack !== session.focus.rack) return state;
  if (!isValidAddress(map, address)) return state;
  if (shelfContents(state.stock, address).length === 0) return state;
  return { ...state, minigame: { ...session, inspected: address } };
}
