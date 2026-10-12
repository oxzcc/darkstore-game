// Новая игра: стартовое состояние из данных config.
import type { GameState } from '../model/game';
import type { WarehouseMap } from '../model/warehouse';
import { GAME_STATE_VERSION, START_MONEY, START_RATING } from '../config/balance';
import { PRODUCTS } from '../config/products';
import { CAMPAIGN_START_SHIFT, INITIAL_STOCK } from '../config/initialStock';
import { STARTING_PICKERS } from '../config/pickers';
import { buildInitialStock } from './stock';
import { createPickers } from './pickers';
import { createRng } from './random';
import { topUpOrders } from './tasks/generator';

/** Стартовое состояние. Зерно передаётся снаружи: store берёт случайное, тесты — фиксированное. */
export function createInitialGame(map: WarehouseMap, seed: number): GameState {
  const base: GameState = {
    version: GAME_STATE_VERSION,
    rngSeed: seed,
    nextId: 1,
    clock: { time: 0, paused: false, playerSpeed: 1 },
    money: START_MONEY,
    rating: START_RATING,
    products: PRODUCTS,
    stock: buildInitialStock(INITIAL_STOCK, PRODUCTS, map, CAMPAIGN_START_SHIFT),
    tasks: {},
    pickers: createPickers(STARTING_PICKERS, map),
    tsdOffer: null,
    minigame: null,
    calls: [],
    shiftLog: [],
  };
  const rng = createRng(seed);
  const withOrders = topUpOrders(base, rng, 0);
  return { ...withOrders, rngSeed: rng.seed() };
}
