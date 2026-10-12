// Вид стеллажа вблизи «глазами сборщика»: где глаза и куда смотрим.
// Общее для камеры (CameraRig) и сборщиков (Pickers прячет тех, кто загораживает полки). Только геометрия отрисовки.
import { Vector3 } from 'three';
import type { Rack } from '../model/warehouse';
import { WAREHOUSE_VIEW } from '../config/warehouse';
import { rackCenter, rackFront } from './rackGeometry';

/** Точка на стеллаже, куда смотрит камера. */
export function closeupLook(rack: Rack): Vector3 {
  const [x, , z] = rackCenter(rack);
  return new Vector3(x, WAREHOUSE_VIEW.closeup.lookHeight, z);
}

/** Где глаза: в проходе перед стеллажом. */
export function closeupEye(rack: Rack): Vector3 {
  const [x, , z] = rackCenter(rack);
  const [fx, fz] = rackFront(rack);
  const { eyeDistance, eyeHeight } = WAREHOUSE_VIEW.closeup;
  return new Vector3(x + fx * eyeDistance, eyeHeight, z + fz * eyeDistance);
}

/** Стоит ли сборщик между глазами и стеллажом (тогда в виде вблизи его прячем). pos — точка на полу. */
export function blocksCloseup(rack: Rack, pos: [number, number, number]): boolean {
  const [x, , z] = rackCenter(rack);
  const [fx, fz] = rackFront(rack);
  const dx = pos[0] - x;
  const dz = pos[2] - z;
  const ahead = dx * fx + dz * fz;          // насколько впереди стеллажа (в сторону прохода)
  const aside = Math.abs(dx * fz - dz * fx); // насколько в стороне вдоль ряда
  const { eyeDistance, hideRadius } = WAREHOUSE_VIEW.closeup;
  return ahead > 0 && ahead < eyeDistance + hideRadius && aside < hideRadius;
}
