// Шаги мини-игры «Сборка» (docs/06-minigames.md, раздел 5; docs/09-architecture.md, раздел 6.2).
// M5c: только выбор стеллажа и «Назад к складу». Ходьба сборщика к стеллажу, сканы и ошибки — M5e.
import type { GameState } from '../../model/game';
import type { WarehouseMap } from '../../model/warehouse';

/**
 * Игрок выбрал стеллаж на складе. Принимается только во время мини-игры, не на паузе
 * и не когда камера уже у стеллажа (сначала «Назад к складу»).
 * M5c: камера сразу летит к стеллажу; в M5e сначала туда дойдёт сборщик.
 */
export function chooseRack(state: GameState, map: WarehouseMap, aisle: number, rack: number): GameState {
  const session = state.minigame;
  if (!session || state.clock.paused || session.atFocus) return state;
  if (!map.racks.some((r) => r.aisle === aisle && r.rack === rack)) return state;
  return { ...state, minigame: { ...session, focus: { aisle, rack }, atFocus: true } };
}

/** «Назад к складу»: камера отлетает в общий вид, стеллаж остаётся выбранным. */
export function leaveRack(state: GameState): GameState {
  const session = state.minigame;
  if (!session || !session.atFocus) return state;
  return { ...state, minigame: { ...session, atFocus: false } };
}
