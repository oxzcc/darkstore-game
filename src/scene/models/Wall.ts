// Стены склада по art/reference/world_wall.png (M9b3; 08, раздел 2: высота 3 м, модуль 3 м). Стиль — low poly.
// Белые панели со швом, серый цоколь, белые пилястры каждые 3 м, верхний карниз, зелёные вставки по краям стены.
// Дальние от камеры стены (север, запад) высокие, ближние — низкие, чтобы не закрывать склад (как на ui_01):
// у низких только цоколь, панель, карниз и короткие пилястры. В проёмах (ворота, дверь) стены нет.
// Возвращает список брусков в координатах сцены: все стены рисует один VoxelBatch (08, раздел 11).
import type { WallOpening, WallSide, WarehouseMap } from '../../model/warehouse';
import { WAREHOUSE_VIEW } from '../../config/warehouse';
import { PALETTE } from '../../config/palette';
import type { VoxelPart } from './ProductItem';

/** Дальние от камеры стены — высокие. */
export const FAR_SIDES: WallSide[] = ['north', 'west'];
const MODULE = 3;       // шаг пилястр, м
const PLINTH = 0.3;     // высота цоколя высокой стены
const LOW_PLINTH = 0.15;
const CAP = 0.06;       // карниз сверху
const PILASTER = 0.22;  // ширина пилястры вдоль стены
const PROUD = 0.05;     // насколько пилястра и цоколь выступают внутрь склада
const ACCENT = 0.45;    // ширина зелёной вставки

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

/** Одна стена. `tall` — высокая (по умолчанию высокие только дальние); с вращением камеры (W1) все стены строятся высокими,
 *  а ближняя к камере опускается в землю до высоты низкой стены (Warehouse.tsx). */
export function wallSideParts(map: WarehouseMap, side: WallSide, tall = FAR_SIDES.includes(side)): VoxelPart[] {
  const t = WAREHOUSE_VIEW.wallThickness;
  const s = WAREHOUSE_VIEW.cellSize;
  const far = tall;
  const h = far ? WAREHOUSE_VIEW.wallHeight : WAREHOUSE_VIEW.frontWallHeight;
  const plinth = far ? PLINTH : LOW_PLINTH;
  const length = (side === 'north' || side === 'south' ? map.width : map.depth) * s;
  const openings = map.openings.filter((o) => o.side === side);
  const segments = wallSegments(length / s, openings).map(([a, b]) => [a * s, b * s] as [number, number]);
  const out: VoxelPart[] = [];
  const box = (a0: number, a1: number, y0: number, y1: number, i0: number, i1: number, color: string) =>
    out.push(wallBox(map, side, a0, a1, y0, y1, i0, i1, color));
  // Стена продлевается за угол на толщину, чтобы углы были закрыты.
  const ext = (a: number) => (a <= 0 ? -t : a >= length ? length + t : a);

  for (const [a, b] of segments) {
    const a0 = ext(a), a1 = ext(b);
    box(a0, a1, 0, plinth, -t / 2, t / 2 + PROUD / 2, PALETTE.wallPlinth);       // цоколь
    box(a0, a1, plinth, h - CAP, -t / 2, t / 2, PALETTE.wallPanel);               // панель
    box(a0, a1, h - CAP, h, -t / 2 - 0.02, t / 2 + 0.03, PALETTE.wallPilaster);   // карниз
    if (far) box(a0, a1, h * 0.72, h * 0.72 + 0.04, t / 2, t / 2 + 0.01, PALETTE.wallSeam); // шов панели
  }

  // Пилястры: каждые 3 м и по краям двери; не в проёмах и не у ворот (у ворот свои стойки рамы, models/Gate.ts).
  const nearGap = (p: number) =>
    openings.some((o) => (o.kind === 'gate' ? p > o.from * s - 0.3 && p < (o.to + 1) * s + 0.3 : p > o.from * s && p < (o.to + 1) * s));
  const posts = new Set<number>();
  for (let p = 0; p <= length + 1e-6; p += MODULE) if (!nearGap(p)) posts.add(Math.min(p, length));
  if (!nearGap(length)) posts.add(length);
  for (const o of openings.filter((o) => o.kind !== 'gate')) { posts.add(o.from * s); posts.add((o.to + 1) * s); }
  for (const p of posts) {
    const half = PILASTER / 2;
    const a0 = Math.max(-t, p - half), a1 = Math.min(length + t, p + half);
    box(a0, a1, 0, plinth, -t / 2 - 0.02, t / 2 + PROUD + 0.02, PALETTE.wallPlinth);
    box(a0, a1, plinth, h + 0.04, -t / 2 - 0.02, t / 2 + PROUD, PALETTE.wallPilaster);
  }

  // Зелёные вставки у концов каждого куска высокой стены — рядом с пилястрой, как на образце.
  if (far) {
    for (const [a, b] of segments) {
      if (b - a < ACCENT * 3) continue;
      for (const [x0, x1] of [[a + PILASTER / 2, a + PILASTER / 2 + ACCENT], [b - PILASTER / 2 - ACCENT, b - PILASTER / 2]]) {
        box(x0, x1, plinth, h - CAP, t / 2, t / 2 + 0.02, PALETTE.wallAccent);
        box(x0, x1, h * 0.72, h * 0.72 + 0.04, t / 2 + 0.02, t / 2 + 0.03, PALETTE.wallAccentSeam);
      }
    }
  }
  return out;
}

/** Все стены склада. */
export function wallParts(map: WarehouseMap): VoxelPart[] {
  return (['north', 'south', 'west', 'east'] as WallSide[]).flatMap((side) => wallSideParts(map, side));
}
