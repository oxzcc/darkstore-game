// Стены склада (W3; 08, раздел 0): сплошные, без колонн и зелёных вставок — сэндвич-панель с вертикальными рёбрами,
// светлый бетонный цоколь, серый отлив сверху; у высоких стен под крышей — лента окон. Панель и рёбра — вертикальный
// градиент (внизу PALETTE.wallBottom, вверху PALETTE.wallTop); он рисуется отдельно (`wallGradientBoxes`), остальное —
// обычные бруски для VoxelBatch (`wallSideParts`). Каждая стена строится в двух видах — высокая и низкая:
// та, что между камерой и складом, показывается низкой (Warehouse.tsx). В проёмах (ворота, дверь) стены нет.
// У двери выдачи — тёмная рама с зелёной полосой (табличка «КУРЬЕРЫ» — в Warehouse.tsx) и коврик внутри.
import type { WallOpening, WallSide, WarehouseMap } from '../../model/warehouse';
import { WAREHOUSE_VIEW } from '../../config/warehouse';
import { PALETTE } from '../../config/palette';
import type { VoxelPart } from './ProductItem';

const PLINTH = 0.3;        // высота цоколя
const PLINTH_PROUD = 0.04; // насколько цоколь толще стены с каждой стороны
const CAP = 0.1;           // отлив сверху
const RIB_STEP = 0.42;     // шаг рёбер профлиста вдоль стены
const RIB_W = 0.1;         // ширина ребра
const RIB_PROUD = 0.05;    // насколько ребро выступает из панели
const WIN_W = 1.5, WIN_H = 0.46, WIN_FROM_TOP = 0.62; // окно: ширина, высота, низ рамы — на столько ниже верха стены
const WIN_STEP = 2.6;      // примерно одно окно на столько метров стены
const DOOR_FRAME = 0.16;   // толщина рамы двери выдачи
const DOOR_H = 1.45;       // высота проёма двери (с перекладиной — вровень с высокой стеной 1,75 м)

/** Брусок в собственных мерах стены (см. `wallBox`). */
export type WallBox = { a0: number; a1: number; y0: number; y1: number; i0: number; i1: number };

/**
 * Брусок у стены в её собственных мерах: `a0`–`a1` — вдоль стены (м от её начала), `y0`–`y1` — высота,
 * `i0`–`i1` — поперёк, от оси стены, плюс — внутрь склада.
 */
export function wallBox(
  map: WarehouseMap, side: WallSide,
  a0: number, a1: number, y0: number, y1: number, i0: number, i1: number, color: string,
): VoxelPart {
  const t = WAREHOUSE_VIEW.wallThickness;
  const s = WAREHOUSE_VIEW.cellSize;
  const along = (a0 + a1) / 2;
  const inner = (i0 + i1) / 2;
  const y = (y0 + y1) / 2;
  const la = a1 - a0, li = i1 - i0, ly = y1 - y0;
  switch (side) {
    case 'north': return { pos: [along, y, -t / 2 + inner], size: [la, ly, li], color };
    case 'south': return { pos: [along, y, map.depth * s + t / 2 - inner], size: [la, ly, li], color };
    case 'west': return { pos: [-t / 2 + inner, y, along], size: [li, ly, la], color };
    case 'east': return { pos: [map.width * s + t / 2 - inner, y, along], size: [li, ly, la], color };
  }
}

/** Делит стену длиной `length` на куски между проёмами. */
export function wallSegments(length: number, openings: WallOpening[]): [number, number][] {
  const gaps = [...openings].sort((a, b) => a.from - b.from);
  const segments: [number, number][] = [];
  let start = 0;
  for (const g of gaps) {
    if (g.from > start) segments.push([start, g.from]);
    start = Math.max(start, g.to + 1);
  }
  if (start < length) segments.push([start, length]);
  return segments;
}

/** Высота стены: высокая или низкая (ближняя к камере). */
export const wallHeight = (tall: boolean) => (tall ? WAREHOUSE_VIEW.wallHeight : WAREHOUSE_VIEW.frontWallHeight);

function layout(map: WarehouseMap, side: WallSide) {
  const t = WAREHOUSE_VIEW.wallThickness;
  const s = WAREHOUSE_VIEW.cellSize;
  const length = (side === 'north' || side === 'south' ? map.width : map.depth) * s;
  const openings = map.openings.filter((o) => o.side === side);
  const segments = wallSegments(length / s, openings).map(([a, b]) => [a * s, b * s] as [number, number]);
  // стена продлевается за угол на толщину, чтобы углы были закрыты
  const ext = (a: number) => (a <= 0 ? -t : a >= length ? length + t : a);
  return { t, segments, ext };
}

/** Середины окон на куске стены от `a` до `b`: равномерно, примерно одно на WIN_STEP метров. */
function windowCenters(a: number, b: number): number[] {
  const n = Math.floor((b - a) / WIN_STEP);
  return Array.from({ length: n }, (_, i) => a + ((i + 0.5) * (b - a)) / n);
}

/** Бруски с градиентом (панель и рёбра) в мерах стены. Градиент — по высоте стены, от пола до верха. */
export function wallGradientBoxes(map: WarehouseMap, side: WallSide, tall: boolean): WallBox[] {
  const { t, segments, ext } = layout(map, side);
  const h = wallHeight(tall);
  const out: WallBox[] = [];
  // рёбра — от цоколя до окон, у низкой стены — до отлива
  const ribTop = tall ? h - WIN_FROM_TOP - 0.06 : h - CAP;
  for (const [a, b] of segments) {
    out.push({ a0: ext(a), a1: ext(b), y0: 0, y1: h - CAP, i0: -t / 2, i1: t / 2 }); // панель (низ закрыт цоколем)
    if (ribTop <= PLINTH + 0.05) continue;
    for (let p = a + RIB_STEP / 2; p < b - RIB_STEP / 4; p += RIB_STEP) {
      out.push({ a0: p - RIB_W / 2, a1: p + RIB_W / 2, y0: PLINTH, y1: ribTop, i0: t / 2, i1: t / 2 + RIB_PROUD });
      out.push({ a0: p - RIB_W / 2, a1: p + RIB_W / 2, y0: PLINTH, y1: ribTop, i0: -t / 2 - RIB_PROUD, i1: -t / 2 });
    }
  }
  return out;
}

/** Бруски одной стены без градиента: цоколь, отлив, у высокой — окна. Координаты сцены. */
export function wallSideParts(map: WarehouseMap, side: WallSide, tall: boolean): VoxelPart[] {
  const { t, segments, ext } = layout(map, side);
  const h = wallHeight(tall);
  const out: VoxelPart[] = [];
  const box = (a0: number, a1: number, y0: number, y1: number, i0: number, i1: number, color: string) =>
    out.push(wallBox(map, side, a0, a1, y0, y1, i0, i1, color));

  for (const [a, b] of segments) {
    const a0 = ext(a), a1 = ext(b);
    box(a0, a1, 0, Math.min(PLINTH, h - CAP), -t / 2 - PLINTH_PROUD, t / 2 + PLINTH_PROUD, PALETTE.wallPlinth); // цоколь
    box(a0 - 0.02, a1 + 0.02, h - CAP, h, -t / 2 - 0.06, t / 2 + 0.06, PALETTE.wallCap);                          // отлив
    if (!tall) continue;
    // лента окон под крышей: рама толще стены, стекло ещё чуть толще — видно с обеих сторон
    for (const c of windowCenters(a, b)) {
      const y0 = h - WIN_FROM_TOP, y1 = y0 + WIN_H;
      box(c - WIN_W / 2, c + WIN_W / 2, y0, y1, -t / 2 - 0.02, t / 2 + 0.02, PALETTE.windowFrame);
      box(c - WIN_W / 2 + 0.08, c + WIN_W / 2 - 0.08, y0 + 0.07, y1 - 0.07, -t / 2 - 0.035, t / 2 + 0.035, PALETTE.windowGlass);
      box(c - 0.03, c + 0.03, y0 + 0.07, y1 - 0.07, -t / 2 - 0.045, t / 2 + 0.045, PALETTE.windowFrame); // перемычка
    }
  }
  return out;
}

/** Рама двери выдачи, зелёная полоса над ней и коврик внутри. Не опускается вместе со стеной. Координаты сцены. */
export function doorParts(map: WarehouseMap, door: WallOpening): VoxelPart[] {
  const t = WAREHOUSE_VIEW.wallThickness;
  const s = WAREHOUSE_VIEW.cellSize;
  const a0 = door.from * s, a1 = (door.to + 1) * s;
  const out: VoxelPart[] = [];
  const box = (b0: number, b1: number, y0: number, y1: number, i0: number, i1: number, color: string) =>
    out.push(wallBox(map, door.side, b0, b1, y0, y1, i0, i1, color));
  const d0 = -t / 2 - 0.05, d1 = t / 2 + 0.05;
  box(a0, a0 + DOOR_FRAME, 0, DOOR_H, d0, d1, PALETTE.metal);                         // левая стойка
  box(a1 - DOOR_FRAME, a1, 0, DOOR_H, d0, d1, PALETTE.metal);                         // правая стойка
  box(a0, a1, DOOR_H, DOOR_H + 0.26, d0, d1, PALETTE.metal);                          // перекладина
  box(a0 + 0.3, a1 - 0.3, DOOR_H + 0.05, DOOR_H + 0.21, d0 - 0.01, d1 + 0.01, PALETTE.wallAccent); // зелёная полоса под табличку
  box(a0 + 0.25, a1 - 0.25, 0, 0.02, t / 2 + 0.1, t / 2 + 1.1, PALETTE.doorMat);      // коврик у выхода
  return out;
}

/** Табличка «КУРЬЕРЫ» над дверью: центр на зелёной полосе, чуть снаружи, и поворот лицом наружу. */
export function doorSignPose(map: WarehouseMap, door: WallOpening): { pos: [number, number, number]; rotY: number } {
  const t = WAREHOUSE_VIEW.wallThickness;
  const s = WAREHOUSE_VIEW.cellSize;
  const mid = ((door.from + door.to + 1) / 2) * s;
  const out = -t / 2 - 0.08; // снаружи стены
  const pos = wallBox(map, door.side, mid, mid, DOOR_H + 0.13, DOOR_H + 0.13, out, out, '').pos;
  const rotY = { north: Math.PI, south: 0, west: -Math.PI / 2, east: Math.PI / 2 }[door.side];
  return { pos, rotY };
}
