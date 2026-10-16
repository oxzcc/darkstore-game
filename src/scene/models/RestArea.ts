// Зона отдыха (W7b, решение автора 16.10: на перерыве собаки сидят на диване) — как в концепт-рендере «Даркстор: Moving Out-стиль»:
// зелёный диван (светлое сиденье, спинка и подлокотники темнее), белый кулер с голубой бутылью, растение в глиняном горшке.
// Места дивана, куда он смотрит, клетки кулера и растения — WAREHOUSE_LAYOUT.rest. Бруски — в координатах склада.
import type { RestFurniture } from '../../model/warehouse';
import { PALETTE } from '../../config/palette';
import { WAREHOUSE_VIEW } from '../../config/warehouse';
import type { VoxelPart } from './ProductItem';

export function restAreaParts(rest: RestFurniture): VoxelPart[] {
  const p: VoxelPart[] = [];
  const s = WAREHOUSE_VIEW.cellSize;
  /** Брусок: размеры, цвет, центр по x и z, низ по y. */
  const rb = (w: number, h: number, d: number, color: string, x: number, y: number, z: number) =>
    p.push({ pos: [x, y + h / 2, z], size: [w, h, d], color });

  // диван: места подряд вдоль одной оси, спинка — с противоположной от взгляда стороны
  if (rest.seats.length > 0) {
    const [fx, fz] = [rest.facing.x, rest.facing.z];
    const alongX = fz !== 0; // смотрит по z — значит, вытянут вдоль x
    const xs = rest.seats.map((c) => (c.x + 0.5) * s), zs = rest.seats.map((c) => (c.z + 0.5) * s);
    const [cx, cz] = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2];
    const len = (alongX ? Math.max(...xs) - Math.min(...xs) : Math.max(...zs) - Math.min(...zs)) + s - 0.04; // ровно по своим клеткам, не заходя на соседние
    const D = 0.85, BACK = 0.28, ARM = 0.2;
    // центр сиденья: от задней кромки клетки на половину глубины
    const back = (k: number) => [cx - fx * (s / 2 - k), cz - fz * (s / 2 - k)] as const;
    const box = (along: number, deep: number, h: number, color: string, offAlong: number, offDeep: number, y: number) => {
      const [bx, bz] = back(offDeep);
      if (alongX) rb(along, h, deep, color, bx + offAlong, y, bz);
      else rb(deep, h, along, color, bx, y, bz + offAlong);
    };
    box(len, D, 0.42, PALETTE.sofaSeat, 0, D / 2 + 0.02, 0);            // сиденье
    box(len, BACK, 0.62, PALETTE.sofa, 0, BACK / 2 + 0.02, 0.35);       // спинка
    for (const k of [-1, 1]) box(ARM, D, 0.62, PALETTE.sofa, k * (len - ARM) / 2, D / 2 + 0.02, 0); // подлокотники
  }

  // кулер: белый корпус и голубая бутыль сверху
  const [kx, kz] = [(rest.cooler.x + 0.5) * s, (rest.cooler.z + 0.5) * s];
  rb(0.5, 0.95, 0.5, PALETTE.cooler, kx, 0, kz);
  rb(0.34, 0.42, 0.34, PALETTE.water, kx, 0.95, kz);
  rb(0.12, 0.06, 0.12, PALETTE.water, kx, 1.37, kz);

  // растение: горшок и три кубические кроны
  const [px, pz] = [(rest.plant.x + 0.5) * s, (rest.plant.z + 0.5) * s];
  rb(0.44, 0.36, 0.44, PALETTE.pot, px, 0, pz);
  rb(0.6, 0.5, 0.6, PALETTE.uniform, px, 0.36, pz);
  rb(0.4, 0.35, 0.4, PALETTE.sofaSeat, px + 0.1, 0.75, pz + 0.05);
  return p;
}
