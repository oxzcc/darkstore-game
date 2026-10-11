// Собирает экран игры. Карту склада строим здесь один раз и передаём сцене.
// Позже карта будет приходить из store (09, раздел 14), сцена от этого не изменится.
import Scene from './scene/Scene';
import { WAREHOUSE_LAYOUT } from './config/warehouse';
import { buildWarehouseMap } from './rules/warehouse';

const WAREHOUSE_MAP = buildWarehouseMap(WAREHOUSE_LAYOUT);

export default function App() {
  return <Scene map={WAREHOUSE_MAP} />;
}
