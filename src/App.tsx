// Собирает экран игры. Карту склада и начальный запас строим здесь один раз и передаём сцене.
// В M3 они переедут в store (09, раздел 14), сцена от этого не изменится.
import Scene from './scene/Scene';
import { WAREHOUSE_LAYOUT } from './config/warehouse';
import { PRODUCTS } from './config/products';
import { CAMPAIGN_START_SHIFT, INITIAL_STOCK } from './config/initialStock';
import { buildWarehouseMap } from './rules/warehouse';
import { buildInitialStock } from './rules/stock';

const WAREHOUSE_MAP = buildWarehouseMap(WAREHOUSE_LAYOUT);
const STOCK = buildInitialStock(INITIAL_STOCK, PRODUCTS, WAREHOUSE_MAP, CAMPAIGN_START_SHIFT);

export default function App() {
  return <Scene map={WAREHOUSE_MAP} stock={STOCK} />;
}
