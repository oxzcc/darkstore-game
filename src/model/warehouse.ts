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
  cell: Cell;      // первая клетка стеллажа (со стороны главного прохода)
  cells: Cell[];   // все клетки, которые стеллаж занимает (их число — настройка rackLength)
  axis: 'x' | 'z'; // вдоль какой оси вытянут стеллаж
  access: Cell;    // клетка прохода перед стеллажом, куда подходит сборщик
};

/** Главный проход: полоса клеток, размечается жёлтыми линиями (08, раздел 6). */
export type Passage = { from: Cell; to: Cell };

/** Сторона склада, на которой стоит стена. */
export type WallSide = 'north' | 'south' | 'west' | 'east';

/** Проём в стене: ворота приёмки или дверь выдачи. `from`–`to` — клетки вдоль стены. */
export type WallOpening = { kind: 'gate' | 'door'; side: WallSide; from: number; to: number };

export type WarehouseMap = {
  width: number;   // клеток по x
  depth: number;   // клеток по z
  racks: Rack[];
  zones: Zone[];
  passages: Passage[];
  openings: WallOpening[];
  /** Столы фасовки: левая клетка стола, стол 2×1 занимает её и соседнюю справа (+x). По ним не ходят. */
  tables: Cell[];
  /** Зона отдыха (W7b): места на диване, куда садятся на перерыве, куда сидящие смотрят, и клетки кулера и растения (по ним не ходят). */
  rest: RestFurniture;
  /** Зона брака: клетка красного контейнера и клетки с накопленным браком (паллета, бак). По ним не ходят. */
  scrap: ScrapFurniture;
};

/** Мебель зоны брака. Зона обнесена ограждением, войти можно только с клетки подхода (`Zone.access`). */
export type ScrapFurniture = { bin: Cell; junk: Cell[] };

export type RestFurniture = { seats: Cell[]; facing: Cell; cooler: Cell; plant: Cell };
