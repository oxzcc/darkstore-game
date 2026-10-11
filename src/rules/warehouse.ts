// Правила карты склада. Чистый TypeScript: без React и без 3D (docs/09-architecture.md, раздел 5).
import type { Cell, Rack, WarehouseMap, ZoneType } from '../model/warehouse';
import type { Address } from '../model/address';
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

// ---------- путь по складу (07, раздел 7) ----------

const cellKey = (c: Cell) => `${c.x},${c.z}`;

/** Клетки, по которым ходить нельзя: стеллажи. Зоны и проходы проходимы. */
export function blockedCells(map: WarehouseMap): Set<string> {
  return new Set(map.racks.flatMap((r) => r.cells.map(cellKey)));
}

/**
 * Кратчайший путь по клеткам без диагоналей (поиск в ширину, без библиотек).
 * Возвращает клетки ПОСЛЕ стартовой (пустой массив — уже на месте) или null, если дойти нельзя.
 */
export function findPath(map: WarehouseMap, from: Cell, to: Cell, blocked = blockedCells(map)): Cell[] | null {
  const inside = (c: Cell) => c.x >= 0 && c.z >= 0 && c.x < map.width && c.z < map.depth;
  if (!inside(to) || blocked.has(cellKey(to))) return null;
  const start = cellKey(from), goal = cellKey(to);
  if (start === goal) return [];
  const cameFrom = new Map<string, Cell | null>([[start, null]]);
  const queue: Cell[] = [from];
  const steps: Cell[] = [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const d of steps) {
      const next = { x: cur.x + d.x, z: cur.z + d.z };
      const k = cellKey(next);
      if (!inside(next) || blocked.has(k) || cameFrom.has(k)) continue;
      cameFrom.set(k, cur);
      if (k === goal) {
        const path: Cell[] = [];
        for (let c: Cell | null = next; c && cellKey(c) !== start; c = cameFrom.get(cellKey(c)) ?? null) path.unshift(c);
        return path;
      }
      queue.push(next);
    }
  }
  return null;
}

/** Стеллаж по адресу (аллея и номер стеллажа; полка на ходьбу не влияет — 07, раздел 5.2). */
export function rackAt(map: WarehouseMap, address: Address): Rack | undefined {
  return map.racks.find((r) => r.aisle === address.aisle && r.rack === address.rack);
}

/** Куда подходит сборщик, чтобы достать товар по адресу: клетка прохода перед стеллажом. */
export function accessForAddress(map: WarehouseMap, address: Address): Cell {
  const rack = rackAt(map, address);
  if (!rack) throw new Error(`Нет стеллажа для адреса ${address.aisle}.${address.rack}.${address.shelf}`);
  return rack.access;
}

/** Все клетки прохода вдоль стеллажа: к стеллажу 1×2 можно подойти с любой из двух клеток. Первая — основная. */
export function accessSpotsForAddress(map: WarehouseMap, address: Address): Cell[] {
  const rack = rackAt(map, address);
  if (!rack) throw new Error(`Нет стеллажа для адреса ${address.aisle}.${address.rack}.${address.shelf}`);
  const dx = rack.access.x - rack.cell.x, dz = rack.access.z - rack.cell.z;
  return rack.cells.map((c) => ({ x: c.x + dx, z: c.z + dz }));
}

/** Все клетки зоны, где можно стоять (например, места за столами фасовки). */
export function zoneCells(map: WarehouseMap, type: ZoneType, blocked = blockedCells(map)): Cell[] {
  const zone = map.zones.find((z) => z.type === type);
  if (!zone) throw new Error(`На карте нет зоны ${type}`);
  const cells: Cell[] = [];
  for (let z = zone.from.z; z <= zone.to.z; z++) {
    for (let x = zone.from.x; x <= zone.to.x; x++) if (!blocked.has(`${x},${z}`)) cells.push({ x, z });
  }
  return cells;
}

/** Расстояние в шагах от клетки до всех достижимых клеток (поиск в ширину). */
export function distancesFrom(map: WarehouseMap, from: Cell, blocked = blockedCells(map)): Map<string, number> {
  const dist = new Map<string, number>([[cellKey(from), 0]]);
  const queue: Cell[] = [from];
  const steps: Cell[] = [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }];
  while (queue.length) {
    const cur = queue.shift()!;
    const d = dist.get(cellKey(cur))!;
    for (const s of steps) {
      const n = { x: cur.x + s.x, z: cur.z + s.z };
      const k = cellKey(n);
      if (n.x < 0 || n.z < 0 || n.x >= map.width || n.z >= map.depth || blocked.has(k) || dist.has(k)) continue;
      dist.set(k, d + 1);
      queue.push(n);
    }
  }
  return dist;
}

/** Клетка подхода к зоне. */
export function zoneAccess(map: WarehouseMap, type: ZoneType): Cell {
  const zone = map.zones.find((z) => z.type === type);
  if (!zone) throw new Error(`На карте нет зоны ${type}`);
  return zone.access;
}
