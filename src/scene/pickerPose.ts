// Где рисовать сборщика и его тележку (W7a, W7b). Только отображение: логика хранит клетку, маршрут и дробный прогресс по нему,
// здесь из этого считаются точки на сцене.
//
// Без тележки собака стоит ровно в точке логики. С тележкой (сборка и выкладка) в точке логики стоит ТЕЛЕЖКА, а собака —
// позади неё на пройденном пути, ровно в CART_AHEAD метрах ПО ПРЯМОЙ (правка автора 16.10: на углах, когда считалось по длине пути,
// тележка налезала на собаку). Тележка смотрит от собаки, как прицеп, поэтому на углу встаёт по диагонали.
// Обе фигуры — только на пройденных клетках: в стеллаж и стол тележка не заезжает.
import type { Picker } from '../model/picker';
import type { Cell } from '../model/warehouse';
import { cellToWorld } from '../rules/warehouse';
import { CART_AHEAD } from './models/Dog';

export type V3 = [number, number, number];
export type PickerPose = {
  dog: V3;          // где стоит собака
  facing: number;   // куда она смотрит, радианы вокруг вертикали
  hop: number;      // подскок при ходьбе, м
  cart: { pos: V3; facing: number } | null;
  moving: boolean;
};

const HOP_HEIGHT = 0.06;  // высота подскока при ходьбе
const HOPS_PER_CELL = 2;  // два шажка на клетку

const angleOf = (dx: number, dz: number) => Math.atan2(dx, dz);

/** Точка на ломаной `pts` в `d` метрах от начала (дальше конца — конец) и номер отрезка, на котором она лежит. */
function along(pts: V3[], d: number): { pos: V3; seg: number } {
  let left = Math.max(0, d);
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, b] = [pts[i], pts[i + 1]];
    const len = Math.hypot(b[0] - a[0], b[2] - a[2]);
    if (left <= len || i === pts.length - 2) {
      const t = len > 0 ? Math.min(1, left / len) : 0;
      return { pos: [a[0] + (b[0] - a[0]) * t, 0, a[2] + (b[2] - a[2]) * t], seg: i };
    }
    left -= len;
  }
  return { pos: pts[pts.length - 1], seg: 0 };
}

/** Идём от `from` назад по ломаной `back` (первая точка — ближайшая) и находим точку ровно в `dist` метрах по прямой от `from`. */
function pointBehind(from: V3, back: V3[], dist: number): V3 {
  for (let i = 0; i < back.length - 1; i++) {
    const [a, b] = [back[i], back[i + 1]];
    if (Math.hypot(b[0] - from[0], b[2] - from[2]) < dist) continue;
    // на отрезке a→b: |a + t(b − a) − from| = dist
    const dx = b[0] - a[0], dz = b[2] - a[2];
    const ax = a[0] - from[0], az = a[2] - from[2];
    const qa = dx * dx + dz * dz, qb = 2 * (ax * dx + az * dz), qc = ax * ax + az * az - dist * dist;
    const t = qa > 0 ? (-qb + Math.sqrt(Math.max(0, qb * qb - 4 * qa * qc))) / (2 * qa) : 0;
    return [a[0] + dx * t, 0, a[2] + dz * t];
  }
  return back[back.length - 1];
}

/** Поза сборщика. `lastAngle` — последнее направление движения (куда смотрит стоящий; позади него стоит собака с тележкой). */
export function pickerPose(p: Picker, withCart: boolean, lastAngle: number): PickerPose {
  const s = cellToWorld({ x: 1, z: 0 })[0] - cellToWorld({ x: 0, z: 0 })[0]; // метров в клетке
  const pts: V3[] = [p.position, ...p.path].map((c: Cell) => cellToWorld(c));
  const moving = p.path.length > 0;
  const hop = moving ? Math.abs(Math.sin(p.pathProgress * Math.PI * HOPS_PER_CELL)) * HOP_HEIGHT : 0;

  const front = moving ? along(pts, p.pathProgress * s) : { pos: pts[0], seg: 0 };
  const seg = moving ? angleOf(pts[front.seg + 1][0] - pts[front.seg][0], pts[front.seg + 1][2] - pts[front.seg][2]) : lastAngle;
  if (!withCart) return { dog: front.pos, facing: seg, hop, cart: null, moving };

  // назад: текущая точка → начала пройденных отрезков → старт → продолжение за старт
  // (стоит — против последнего движения; идёт — против первого отрезка пути: при развороте собака обойдёт тележку, Picker.tsx)
  const start = pts[0];
  const firstAngle = moving ? angleOf(pts[1][0] - start[0], pts[1][2] - start[2]) : lastAngle;
  const far: V3 = [start[0] - Math.sin(firstAngle) * 10, 0, start[2] - Math.cos(firstAngle) * 10];
  const back: V3[] = [front.pos];
  if (moving) for (let i = front.seg; i >= 0; i--) back.push(pts[i]);
  back.push(far);
  const dog = pointBehind(front.pos, back, CART_AHEAD);

  const dx = front.pos[0] - dog[0], dz = front.pos[2] - dog[2];
  const facing = Math.hypot(dx, dz) > 0.01 ? angleOf(dx, dz) : seg;
  return { dog, facing, hop, cart: { pos: front.pos, facing }, moving };
}
