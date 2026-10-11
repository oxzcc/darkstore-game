// Планировка склада — данные, а не код сцены (docs/07-warehouse-map.md).
// Все числа — стартовые допущения из 07, разделы 3, 4 и 9. Меняются здесь, без правки логики.
import type { Cell, WallOpening, Zone } from '../model/warehouse';

export type WarehouseLayout = {
  width: number;
  depth: number;
  aisles: number;
  racksPerAisle: number;
  shelvesPerRack: number;
  /** Сколько клеток занимает один стеллаж вдоль аллеи. Сейчас 1 (07), позже можно 2 (08). */
  rackLength: number;
  /** Клетка первого стеллажа первой аллеи. */
  firstRack: Cell;
  /** Шаг между аллеями по z: ряд стеллажей + проход. */
  aisleStep: number;
  zones: Zone[];
  openings: WallOpening[];
};

export const WAREHOUSE_LAYOUT: WarehouseLayout = {
  width: 16,
  depth: 13,
  aisles: 4,
  racksPerAisle: 6,
  shelvesPerRack: 4,
  rackLength: 1,
  firstRack: { x: 1, z: 3 },
  aisleStep: 2,
  zones: [
    { type: 'receiving', from: { x: 0, z: 0 },  to: { x: 3, z: 1 },  access: { x: 2, z: 2 } },
    { type: 'scrap',     from: { x: 12, z: 0 }, to: { x: 13, z: 1 }, access: { x: 12, z: 2 } },
    { type: 'rest',      from: { x: 10, z: 6 }, to: { x: 11, z: 7 }, access: { x: 10, z: 8 } },
    { type: 'packing',   from: { x: 7, z: 11 }, to: { x: 10, z: 12 }, access: { x: 8, z: 10 } },
  ],
  openings: [
    { kind: 'gate', side: 'north', from: 0, to: 3 },  // ворота приёмки, 4 м (08, раздел 7)
    { kind: 'door', side: 'south', from: 7, to: 10 }, // дверь выдачи
  ],
};

/** Размеры для отрисовки склада (в метрах). */
export const WAREHOUSE_VIEW = {
  cellSize: 1,         // 1 клетка = 1 метр
  wallHeight: 3,       // дальние стены (08, раздел 2)
  frontWallHeight: 0.4,// ближние к камере стены низкие, чтобы не закрывать склад (как на макете ui_01)
  wallThickness: 0.25,
  rackHeight: 2,       // стеллаж выше сборщика (~1,5 м)
  rackDepth: 0.6,
  floorThickness: 0.1,
};
