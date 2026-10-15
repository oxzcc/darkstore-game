// Новая игра: стартовое состояние из данных config.
import type { GameState } from '../model/game';
import type { WarehouseMap } from '../model/warehouse';
import { DELIVERY, GAME_STATE_VERSION, START_MONEY, START_RATING, WRITEOFF } from '../config/balance';
import { PRODUCTS } from '../config/products';
import { CAMPAIGN_START_SHIFT, EXPIRING_STOCK, INITIAL_STOCK } from '../config/initialStock';
import { STARTING_PICKERS } from '../config/pickers';
import { addStock, buildInitialStock } from './stock';
import { parseAddress } from './address';
import { createPickers } from './pickers';
import { createRng } from './random';
import { fillOrders } from './pace';
import { shiftPlan } from './shiftPlan';
import { tickDeliveries } from './deliveries';
import { newCampaign } from './shift';
import { assignDeadlines } from './deadline';

/** Доложить на полки партии «истекает сегодня» (M7e1, решение автора 14.10): срок — текущая (первая) смена. */
function withExpiring(stock: GameState['stock']): GameState['stock'] {
  let s = stock;
  for (const e of EXPIRING_STOCK) {
    s = addStock(s, { productId: e.productId, address: parseAddress(e.address), expiresAtShift: CAMPAIGN_START_SHIFT }, e.qty);
  }
  return s;
}

/** Стартовое состояние. Зерно передаётся снаружи: store берёт случайное, тесты — фиксированное. */
export function createInitialGame(map: WarehouseMap, seed: number): GameState {
  const pickers = createPickers(STARTING_PICKERS, map);
  const campaign = newCampaign(START_MONEY, START_RATING, pickers);
  const base: GameState = {
    version: GAME_STATE_VERSION,
    rngSeed: seed,
    nextId: 1,
    campaign,
    clock: { time: 0, paused: false, playerSpeed: 1 },
    money: START_MONEY,
    rating: START_RATING,
    products: PRODUCTS,
    stock: withExpiring(buildInitialStock(INITIAL_STOCK, PRODUCTS, map, CAMPAIGN_START_SHIFT)),
    tasks: {},
    deliveries: {},
    pallets: {},
    // для проверки первая поставка может приехать сразу (DELIVERY.firstAtStart)
    nextDeliveryAt: DELIVERY.firstAtStart ? 0 : shiftPlan({ campaign }).deliveryEvery,
    nextOrderAt: 0,
    nextWriteoffAt: WRITEOFF.firstAtSeconds,
    pickers,
    tsdOffer: null,
    minigame: null,
    tsdGame: null,
    calls: [],
    shiftLog: [],
  };
  // сначала поставка (она тоже нагрузка), потом заказы под загрузку смены (M8d)
  const withDelivery = tickDeliveries(base);
  const rng = createRng(withDelivery.rngSeed);
  const withOrders = fillOrders(withDelivery, rng, 0);
  return assignDeadlines({ ...withOrders, rngSeed: rng.seed() }, map);
}
