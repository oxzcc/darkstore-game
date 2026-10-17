// Зона брака (просьба автора 18.10) — по рендеру «Зона брака», одобренному автором, и листу ассетов ui_06:
// тёмное сетчатое ограждение 1,1 м по краю зоны (у стен склада его нет, у клетки подхода — вход), красная табличка у входа,
// красный контейнер на колёсиках с откинутой крышкой и списанным товаром сверху, серый бак под упаковку, паллета с мятыми коробками.
// Где что стоит — WarehouseMap.scrap и зона `scrap` на карте; через ограждение не ходят (rules/warehouse.ts, `crossesFence`).
// Бруски — в координатах склада. Крупное (ограждение, контейнер) — `frame`, мелкое (коробки, товар) — `clutter`, у них разное скругление.
import type { Cell, WarehouseMap, Zone } from '../../model/warehouse';
import { PALETTE } from '../../config/palette';
import { PRODUCTS } from '../../config/products';
import { WAREHOUSE_VIEW } from '../../config/warehouse';
import { palletParts } from './Pallet';
import { productParts, type VoxelPart } from './ProductItem';

const FENCE_H = 1.1;      // высота ограждения, м (ui_06)
const POST = 0.09;        // столбик
const RAIL = 0.05;        // перекладина
const BAR = 0.022;        // пруток сетки
const BAR_STEP = 0.14;    // шаг прутков
const WALL_GAP = 0.1;     // ограждение не упирается в стену: у стены рёбра профлиста выступают на 5 см

/** Повернуть бруски вокруг вертикали на `turn` и поставить в точку `at` (как `placed` в сценках). */
function placed(parts: VoxelPart[], at: [number, number, number], turn = 0): VoxelPart[] {
  const c = Math.cos(turn), s = Math.sin(turn);
  return parts.map((p): VoxelPart => {
    const [x, y, z] = p.pos;
    const r = p.rot ?? [0, 0, 0];
    return { ...p, pos: [at[0] + x * c + z * s, at[1] + y, at[2] - x * s + z * c], rot: [r[0], r[1] + turn, r[2]] };
  });
}

/** Брусок по низу: центр по x и z, низ по y. */
const block = (w: number, h: number, d: number, color: string, x: number, y: number, z: number, rot?: VoxelPart['rot']): VoxelPart =>
  (rot ? { pos: [x, y + h / 2, z], size: [w, h, d], color, rot } : { pos: [x, y + h / 2, z], size: [w, h, d], color });

/** Прямой отрезок ограждения от (x0, z0) до (x1, z1) вдоль одной оси: столбики через ~1 м, три перекладины, частые прутки. */
function fenceRun(x0: number, z0: number, x1: number, z1: number): VoxelPart[] {
  const out: VoxelPart[] = [];
  const len = Math.hypot(x1 - x0, z1 - z0);
  if (len < 0.2) return out;
  const alongX = z0 === z1;
  const at = (t: number): [number, number] => [x0 + (x1 - x0) * t, z0 + (z1 - z0) * t];
  const posts = Math.max(1, Math.round(len));
  for (let i = 0; i <= posts; i++) {
    const [px, pz] = at(i / posts);
    out.push(block(POST, FENCE_H, POST, PALETTE.fence, px, 0, pz));
    out.push(block(0.2, 0.04, 0.2, PALETTE.fenceLight, px, 0, pz));            // пятка
    out.push(block(0.13, 0.05, 0.13, PALETTE.fenceLight, px, FENCE_H, pz));    // колпачок
  }
  const [mx, mz] = at(0.5);
  for (const y of [0.12, 0.62, FENCE_H - 0.08]) {
    out.push(block(alongX ? len : RAIL, RAIL, alongX ? RAIL : len, PALETTE.fence, mx, y, mz));
  }
  const bars = Math.round(len / BAR_STEP);
  for (let i = 1; i < bars; i++) {
    const [bx, bz] = at(i / bars);
    out.push(block(BAR, FENCE_H - 0.2, BAR, PALETTE.fenceLight, bx, 0.12, bz));
  }
  return out;
}

/** Края зоны с ограждением (в метрах), кроме сторон у стен склада; на стороне подхода — проём в клетку подхода. */
function fenceRuns(map: WarehouseMap, zone: Zone): [number, number, number, number][] {
  const s = WAREHOUSE_VIEW.cellSize;
  const x0 = zone.from.x * s, x1 = (zone.to.x + 1) * s, z0 = zone.from.z * s, z1 = (zone.to.z + 1) * s;
  const atWall = { west: zone.from.x === 0, east: zone.to.x === map.width - 1, north: zone.from.z === 0, south: zone.to.z === map.depth - 1 };
  // ограждение вдоль стены не нужно, а у стены отступаем, чтобы не врезаться в неё
  const ax0 = atWall.west ? x0 + WALL_GAP : x0, ax1 = atWall.east ? x1 - WALL_GAP : x1;
  const az0 = atWall.north ? z0 + WALL_GAP : z0, az1 = atWall.south ? z1 - WALL_GAP : z1;
  const a = zone.access;
  const runs: [number, number, number, number][] = [];
  /** Сторона вдоль оси с проёмом там, где к ней примыкает клетка подхода. */
  const side = (fixed: number, from: number, to: number, alongX: boolean, gap: number | null) => {
    const pieces: [number, number][] = gap === null ? [[from, to]] : [[from, gap * s], [(gap + 1) * s, to]];
    for (const [p, q] of pieces) runs.push(alongX ? [p, fixed, q, fixed] : [fixed, p, fixed, q]);
  };
  if (!atWall.north) side(z0, ax0, ax1, true, a.z === zone.from.z - 1 ? a.x : null);
  if (!atWall.south) side(z1, ax0, ax1, true, a.z === zone.to.z + 1 ? a.x : null);
  if (!atWall.west) side(x0, az0, az1, false, a.x === zone.from.x - 1 ? a.z : null);
  if (!atWall.east) side(x1, az0, az1, false, a.x === zone.to.x + 1 ? a.z : null);
  return runs;
}

/** Красный контейнер на колёсиках, лицом к +z; крышка откинута назад. Центр низа — (0, 0, 0). */
function binParts(): VoxelPart[] {
  const out: VoxelPart[] = [];
  const W = 0.86, D = 0.74, H = 0.84, LIFT = 0.12;
  out.push(block(W, H - LIFT, D, PALETTE.scrapRed, 0, LIFT, 0));
  out.push(block(W + 0.06, 0.09, D + 0.06, PALETTE.scrapRedDark, 0, H - 0.06, 0));        // борт
  for (const x of [-0.26, 0.26]) out.push(block(0.04, 0.48, D + 0.02, PALETTE.scrapRedDark, x, 0.24, 0)); // рёбра
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    out.push(block(0.11, 0.11, 0.05, PALETTE.wheel, sx * (W / 2 - 0.12), 0, sz * (D / 2 - 0.1)));
    out.push(block(0.07, 0.05, 0.07, PALETTE.metalDark, sx * (W / 2 - 0.12), 0.08, sz * (D / 2 - 0.1)));
  }
  // табличка «списание» на лице: белая плашка с красным крестом
  out.push(block(0.32, 0.32, 0.02, PALETTE.paper, 0, 0.36, D / 2 + 0.01));
  for (const t of [0.785, -0.785]) out.push(block(0.05, 0.22, 0.012, PALETTE.scrapRed, 0, 0.41, D / 2 + 0.024, [0, 0, t]));
  // крышка: петля у задней кромки, откинута на 66°
  const a = 1.15, L = D + 0.04;
  const hz = -D / 2 - 0.02, hy = H + 0.03;
  out.push({ pos: [0, hy + Math.sin(a) * L / 2, hz + Math.cos(a) * L / 2], size: [W + 0.04, 0.06, L], color: PALETTE.fence, rot: [-a, 0, 0] });
  out.push({ pos: [0, hy + Math.sin(a) * L + 0.02, hz + Math.cos(a) * L + 0.04], size: [0.36, 0.05, 0.07], color: PALETTE.fenceLight, rot: [-a, 0, 0] });
  // внутри — тёмное «дно» вровень с бортом, на нём товар
  out.push(block(W - 0.1, 0.04, D - 0.1, PALETTE.scrapRedDark, 0, H - 0.08, 0));
  return out;
}

/** Списанный товар горкой сверху контейнера (высота борта — 0,8 м). */
function binContents(): VoxelPart[] {
  const y = 0.8;
  return [
    ...placed(productParts(PRODUCTS.bananas.look, 0.3), [-0.18, y, 0.08], 0.4),
    ...placed(productParts(PRODUCTS.milk.look, 0.16), [0.2, y, -0.12], -0.3),
    ...placed(productParts(PRODUCTS.bread.look, 0.28), [0.12, y, 0.16], 0.5),
    block(0.26, 0.2, 0.22, PALETTE.box, -0.18, y, -0.16, [0.15, 0.4, 0]),
  ];
}

/** Серый бак под упаковку. Центр низа — (0, 0, 0). */
function wasteBinParts(): VoxelPart[] {
  return [
    block(0.6, 0.06, 0.6, PALETTE.binDark, 0, 0, 0),
    block(0.54, 0.62, 0.54, PALETTE.bin, 0, 0.05, 0),
    block(0.62, 0.07, 0.62, PALETTE.binDark, 0, 0.66, 0),
    block(0.26, 0.2, 0.02, PALETTE.paper, 0, 0.3, 0.28),
    block(0.18, 0.12, 0.012, PALETTE.box, 0, 0.33, 0.295),
  ];
}

/** Мятая коробка: светлая с вмятиной на боку. Центр низа — (0, 0, 0). */
function dentedBox(s: number): VoxelPart[] {
  return [
    block(s, s * 0.8, s, PALETTE.boxDark, 0, 0, 0, [0.05, 0, -0.06]),
    block(s + 0.006, 0.03, s * 0.24, PALETTE.boxTape, 0, s * 0.8 - 0.01, 0),
    block(s * 0.5, s * 0.16, 0.02, PALETTE.box, -s * 0.1, s * 0.34, s / 2 + 0.01, [0, 0, 0.3]),
  ];
}

const centerOf = (c: Cell): [number, number] => {
  const s = WAREHOUSE_VIEW.cellSize;
  return [(c.x + 0.5) * s, (c.z + 0.5) * s];
};

/** Поворот, при котором лицо предмета (+z) смотрит от стены склада внутрь зоны. */
function faceAwayFromWall(map: WarehouseMap, c: Cell): number {
  if (c.x === 0) return Math.PI / 2;
  if (c.x === map.width - 1) return -Math.PI / 2;
  if (c.z === map.depth - 1) return Math.PI;
  return 0;
}

export type ScrapAreaParts = {
  frame: VoxelPart[];
  clutter: VoxelPart[];
  /** Где висит табличка «БРАК»: центр и поворот (лицо смотрит наружу, к клетке подхода). */
  sign: { pos: [number, number, number]; rotY: number } | null;
};

export function scrapAreaParts(map: WarehouseMap): ScrapAreaParts {
  const zone = map.zones.find((z) => z.type === 'scrap');
  if (!zone) return { frame: [], clutter: [], sign: null };
  const frame: VoxelPart[] = [];
  const clutter: VoxelPart[] = [];

  const runs = fenceRuns(map, zone);
  for (const r of runs) frame.push(...fenceRun(...r));

  // табличка: на отрезке, ближнем к клетке подхода, на высоте 0,82 м, снаружи
  let sign: ScrapAreaParts['sign'] = null;
  const s = WAREHOUSE_VIEW.cellSize;
  const [ax, az] = centerOf(zone.access);
  const best = runs
    .map(([x0, z0, x1, z1]) => ({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, alongX: z0 === z1, len: Math.hypot(x1 - x0, z1 - z0) }))
    .filter((r) => r.len >= 0.8)
    .sort((p, q) => Math.hypot(p.x - ax, p.z - az) - Math.hypot(q.x - ax, q.z - az))[0];
  if (best) {
    const out = best.alongX ? Math.sign(az - best.z) : Math.sign(ax - best.x); // наружу — в сторону подхода
    const [px, pz] = best.alongX ? [best.x, best.z + out * 0.04] : [best.x + out * 0.04, best.z];
    const rotY = best.alongX ? (out > 0 ? 0 : Math.PI) : (out > 0 ? Math.PI / 2 : -Math.PI / 2);
    frame.push(...placed([block(0.66, 0.34, 0.04, PALETTE.scrapRedDark, 0, 0.66, 0)], [px, 0, pz], rotY));
    sign = { pos: [px + (best.alongX ? 0 : out * 0.025), 0.83, pz + (best.alongX ? out * 0.025 : 0)], rotY };
  }

  // контейнер — в своей клетке, прижат к стене, лицом в зону
  const [bx, bz] = centerOf(map.scrap.bin);
  const turn = faceAwayFromWall(map, map.scrap.bin);
  const push = 0.03 * s; // чуть к стене, но не в рёбра профлиста
  const toWall: [number, number] = [-Math.sin(turn) * push, -Math.cos(turn) * push];
  frame.push(...placed(binParts(), [bx + toWall[0], 0, bz + toWall[1]], turn));
  clutter.push(...placed(binContents(), [bx + toWall[0], 0, bz + toWall[1]], turn));

  // накопленный брак: первая клетка — бак под упаковку, остальные — паллеты с мятыми коробками
  map.scrap.junk.forEach((c, i) => {
    const [jx, jz] = centerOf(c);
    if (i === 0) {
      clutter.push(...placed(wasteBinParts(), [jx - 0.1, 0, jz], faceAwayFromWall(map, c) + 0.15));
      return;
    }
    const t = -0.08 * i;
    clutter.push(...placed(palletParts(4), [jx, 0, jz], t));
    clutter.push(...placed(dentedBox(0.4), [jx + 0.02, 0.5, jz - 0.05], t + 0.35));
  });

  // плоские картонки у стены — в проходе зоны, тонкие, по ним можно ходить
  const wallCell = { x: zone.from.x, z: map.scrap.bin.z + 1 };
  if (zone.from.x === 0 && wallCell.z <= zone.to.z) {
    const [, cz] = centerOf(wallCell);
    clutter.push(block(0.04, 0.5, 0.56, PALETTE.box, 0.12, 0, cz - 0.1, [0, 0, 0.18]));
    clutter.push(block(0.04, 0.44, 0.5, PALETTE.boxDark, 0.17, 0, cz + 0.18, [0, 0.1, 0.24]));
  }

  return { frame, clutter, sign };
}
