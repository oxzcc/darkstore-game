// Правила карты склада. Чистый TypeScript: без React и без 3D (docs/09-architecture.md, раздел 5).
import type { Cell, Rack, WarehouseMap } from '../model/warehouse';
import type { RackLayout, WarehouseLayout } from '../config/warehouse';
import { WAREHOUSE_VIEW } from '../config/warehouse';

const add = (a: Cell, b: Cell, k = 1): Cell => ({ x: a.x + b.x * k, z: a.z + b.z * k });

/**
 * Строит список стеллажей из чисел планировки.
 * Нумерация с 1: аллея 1 ближе всех к воротам, стеллаж 1 — у главного прохода (07, раздел 5.1).
 */
export function generateRacks(layout: RackLayout): Rack[] {
  const racks: Rack[] = [];
  const axis = layout.alongAisle.x !== 0 ? 'x' : 'z';
  for (let a = 0; a < layout.aisles; a++) {
    const aisleStart = add(layout.firstRack, layout.nextAisle, a);
    for (let r = 0; r < layout.racksPerAisle; r++) {
      const first = add(aisleStart, layout.alongAisle, r * layout.rackLength);
      const cells = Array.from({ length: layout.rackLength }, (_, i) => add(first, layout.alongAisle, i));
      racks.push({
        aisle: a + 1,
        rack: r + 1,
        shelves: layout.shelvesPerRack,
        cell: first,
        cells,
        axis,
        access: add(first, layout.accessSide),
      });
    }
  }
  return racks;
}

/** Собирает полную карту склада из планировки. */
export function buildWarehouseMap(layout: WarehouseLayout): WarehouseMap {
  return {
    width: layout.width,
    depth: layout.depth,
    racks: generateRacks(layout.racks),
    zones: layout.zones,
    passages: layout.passages,
    openings: layout.openings,
  };
}

/**
 * Клетка → координаты 3D-сцены (центр клетки на уровне пола).
 * Единственное место, где известен размер клетки в 3D (07, раздел 6).
 */
export function cellToWorld(cell: Cell): [number, number, number] {
  const s = WAREHOUSE_VIEW.cellSize;
  return [(cell.x + 0.5) * s, 0, (cell.z + 0.5) * s];
}
