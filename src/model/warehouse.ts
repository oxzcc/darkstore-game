// Типы карты склада (docs/07-warehouse-map.md, раздел 9; docs/09-architecture.md, раздел 4.1а).
// Здесь только описание формы данных, без логики.

/** Клетка сетки склада. 1 клетка = 1 метр. x — вдоль ширины, z — вдоль глубины. */
export type Cell = { x: number; z: number };

export type ZoneType = 'receiving' | 'storage' | 'packing' | 'scrap' | 'rest';

/** Зона склада: прямоугольник клеток от `from` до `to` (включительно) и клетка подхода. */
export type Zone = { type: ZoneType; from: Cell; to: Cell; access: Cell };

export type Rack = {
  aisle: number;   // номер аллеи
  rack: number;    // номер стеллажа в аллее
  shelves: number; // сколько полок
  cell: Cell;      // первая клетка, где стоит стеллаж
  length: number;  // сколько клеток стеллаж занимает вдоль аллеи (настройка из config)
  access: Cell;    // клетка прохода перед стеллажом, куда подходит сборщик
};

/** Сторона склада, на которой стоит стена. */
export type WallSide = 'north' | 'south' | 'west' | 'east';

/** Проём в стене: ворота приёмки или дверь выдачи. `from`–`to` — клетки вдоль стены. */
export type WallOpening = { kind: 'gate' | 'door'; side: WallSide; from: number; to: number };

export type WarehouseMap = {
  width: number;   // клеток по x
  depth: number;   // клеток по z
  racks: Rack[];
  zones: Zone[];
  openings: WallOpening[];
};
