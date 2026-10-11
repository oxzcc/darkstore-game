// Правила карты склада. Чистый TypeScript: без React и без 3D (docs/09-architecture.md, раздел 5).
import type { Cell, Rack, WarehouseMap } from '../model/warehouse';
import type { WarehouseLayout } from '../config/warehouse';
import { WAREHOUSE_VIEW } from '../config/warehouse';

/**
 * Строит список стеллажей из чисел планировки.
 * Стеллажи аллеи стоят в один ряд вдоль x, проход — сразу перед ними (z + 1).
 * Нумерация с 1: аллея 1 ближе всех к воротам, стеллаж 1 — от главного прохода у приёмки (07, раздел 5.1).
 */
export function generateRacks(layout: WarehouseLayout): Rack[] {
  const racks: Rack[] = [];
  for (let a = 0; a < layout.aisles; a++) {
    for (let r = 0; r < layout.racksPerAisle; r++) {
      const cell: Cell = {
        x: layout.firstRack.x + r * layout.rackLength,
        z: layout.firstRack.z + a * layout.aisleStep,
      };
      racks.push({
        aisle: a + 1,
        rack: r + 1,
        shelves: layout.shelvesPerRack,
        cell,
        length: layout.rackLength,
        access: { x: cell.x, z: cell.z + 1 },
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
    racks: generateRacks(layout),
    zones: layout.zones,
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
