// Помощники только для тестов (W8b). В игре не используются.
import type { GameState } from '../model/game';
import type { WarehouseMap } from '../model/warehouse';
import { DELIVERY } from '../config/balance';
import { tickDeliveries } from './deliveries';
import { assignDeadlines } from './deadline';
import { createInitialGame } from './game';

/**
 * Грузовик, который едет к воротам, приезжает прямо сейчас: поставка и «Приёмка» появляются в текущий момент.
 * Нужен тестам, которые проверяют приёмку и выкладку и не хотят ждать DELIVERY.driveInSeconds.
 */
export function arriveTruckNow(state: GameState, map: WarehouseMap): GameState {
  if ((state.truckComing ?? null) === null) return state;
  const arrived = tickDeliveries({ ...state, truckComing: state.clock.time - DELIVERY.driveInSeconds });
  return assignDeadlines(arrived, map);
}

/** Новая игра, где первая поставка уже стоит у ворот (как было до W8b). */
export function gameWithDelivery(map: WarehouseMap, seed: number): GameState {
  return arriveTruckNow(createInitialGame(map, seed), map);
}
