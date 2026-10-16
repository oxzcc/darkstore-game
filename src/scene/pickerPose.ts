// Где рисовать сборщика и его тележку (W7a). Только отображение: логика хранит клетку, маршрут и дробный прогресс по нему,
// здесь из этого считаются точки на сцене.
//
// Без тележки собака стоит ровно в точке логики. С тележкой (сборка и выкладка) в точке логики стоит ТЕЛЕЖКА, а собака —
// на CART_AHEAD метров позади неё по пройденному пути. Так обе фигуры всегда на клетках, по которым сборщик уже прошёл:
// тележка не заезжает в стеллаж или стол, на поворотах обе идут по проходу (правка автора 16.10).
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

const dirOf = (angle: number): [number, number] => [Math.sin(angle), Math.cos(angle)];
const angleOf = (dx: number, dz: number) => Math.atan2(dx, dz);

/**
 * Точка на ломаной `pts` в `d` метрах от начала и направление в ней. Отрицательное `d` — позади начала,
 * в сторону, откуда сборщик пришёл (против `backAngle` — куда он смотрел, когда стоял). Дальше конца — конец.
 */
function along(pts: V3[], d: number, backAngle: number): { pos: V3; angle: number } {
  if (d <= 0 || pts.length === 1) {
    const [bx, bz] = dirOf(backAngle);
    const k = Math.min(0, d);
    return { pos: [pts[0][0] + bx * k, 0, pts[0][2] + bz * k], angle: backAngle };
  }
  let left = d;
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, b] = [pts[i], pts[i + 1]];
    const len = Math.hypot(b[0] - a[0], b[2] - a[2]);
    const angle = angleOf(b[0] - a[0], b[2] - a[2]);
    if (left <= len || i === pts.length - 2) {
      const t = len > 0 ? Math.min(1, left / len) : 0;
      return { pos: [a[0] + (b[0] - a[0]) * t, 0, a[2] + (b[2] - a[2]) * t], angle };
    }
    left -= len;
  }
  return { pos: pts[pts.length - 1], angle: backAngle };
}

/**
 * Поза сборщика. `standAngle` — куда он смотрел, когда последний раз стоял (для точки «позади» в начале пути);
 * `lastAngle` — последнее направление движения (куда смотрит стоящий).
 */
export function pickerPose(p: Picker, withCart: boolean, standAngle: number, lastAngle: number): PickerPose {
  const s = cellToWorld({ x: 1, z: 0 })[0] - cellToWorld({ x: 0, z: 0 })[0]; // метров в клетке
  const pts: V3[] = [p.position, ...p.path].map((c: Cell) => cellToWorld(c));
  const moving = p.path.length > 0;
  const dist = moving ? p.pathProgress * s : 0;
  const hop = moving ? Math.abs(Math.sin(p.pathProgress * Math.PI * HOPS_PER_CELL)) * HOP_HEIGHT : 0;
  const back = moving ? standAngle : lastAngle;

  const front = along(pts, dist, back);
  if (!withCart) return { dog: front.pos, facing: front.angle, hop, cart: null, moving };

  const rear = along(pts, dist - CART_AHEAD, back);
  const dx = front.pos[0] - rear.pos[0], dz = front.pos[2] - rear.pos[2];
  const facing = Math.hypot(dx, dz) > 0.01 ? angleOf(dx, dz) : front.angle;
  return { dog: rear.pos, facing, hop, cart: { pos: front.pos, facing: front.angle }, moving };
}
