// Планировка склада — данные, а не код сцены (docs/07-warehouse-map.md).
// Расстановка повторяет макет ui_01: приёмка и ворота слева внизу, стеллажи справа,
// фасовка вдоль нижней стены, дверь выдачи справа внизу, отдых и брак у левой стены.
// Все числа — стартовые; меняются здесь, без правки логики.
import type { Cell, Passage, WallOpening, Zone } from '../model/warehouse';

export type RackLayout = {
  aisles: number;
  racksPerAisle: number;
  shelvesPerRack: number;
  /** Сколько клеток занимает один стеллаж вдоль аллеи (08: 1×2). */
  rackLength: number;
  /** Первая клетка стеллажа 1.1 — у главного прохода, ближе всех к приёмке. */
  firstRack: Cell;
  /** Куда идут следующие стеллажи внутри аллеи (на одну клетку). */
  alongAisle: Cell;
  /** Сдвиг от одной аллеи к следующей. */
  nextAisle: Cell;
  /** С какой стороны стеллажа проход, откуда к нему подходят. */
  accessSide: Cell;
};

export type WarehouseLayout = {
  width: number;
  depth: number;
  racks: RackLayout;
  zones: Zone[];
  passages: Passage[];
  openings: WallOpening[];
};

export const WAREHOUSE_LAYOUT: WarehouseLayout = {
  width: 20,
  depth: 18,
  racks: {
    aisles: 4,
    racksPerAisle: 6,
    shelvesPerRack: 4,
    rackLength: 2,
    firstRack: { x: 8, z: 12 },
    alongAisle: { x: 0, z: -1 }, // вглубь склада, от главного прохода к дальней стене
    nextAisle: { x: 3, z: 0 },   // ряд стеллажей + проход в 2 клетки
    accessSide: { x: 1, z: 0 },
  },
  zones: [
    { type: 'rest',      from: { x: 0, z: 2 },  to: { x: 2, z: 5 },   access: { x: 3, z: 3 } },
    { type: 'scrap',     from: { x: 0, z: 8 },  to: { x: 2, z: 10 },  access: { x: 3, z: 9 } },
    { type: 'receiving', from: { x: 0, z: 14 }, to: { x: 5, z: 17 },  access: { x: 6, z: 15 } },
    { type: 'packing',   from: { x: 9, z: 15 }, to: { x: 16, z: 16 }, access: { x: 12, z: 14 } },
  ],
  passages: [
    { from: { x: 0, z: 13 }, to: { x: 19, z: 13 } }, // главный проход между стеллажами и выдачей
  ],
  openings: [
    { kind: 'gate', side: 'south', from: 1, to: 4 },  // ворота приёмки, 4 м (08, раздел 7)
    { kind: 'door', side: 'east', from: 14, to: 16 }, // дверь выдачи, к курьерам
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

/** Размеры разметки пола (в метрах). */
export const FLOOR_MARKINGS = {
  lineWidth: 0.08,     // ширина линий разметки
  dash: 0.4,           // длина штриха пунктира
  gap: 0.25,           // промежуток пунктира
  inset: 0.12,         // отступ пунктира от края зоны
};
