// Грузовик по art/reference/world_transport_truck.png (M9b4; 08, раздел 7: 2×5 клеток). Стиль — low poly.
// Зелёная кабина со скошенным лобовым стеклом, зеркала на кронштейнах, тёмная решётка, белые фары и бампер
// с зелёными уголками; белый фургон с серыми уголками; круглые колёса с серыми дисками,
// зелёная юбка и серая подножка под фургоном.
// Начало координат — середина заднего края (тем краем грузовик встаёт к воротам), длина идёт по +z, кабина спереди.
// Возвращает список брусков: рисует VoxelBatch (Deliveries поворачивает и ставит его к воротам).
import { PALETTE } from '../../config/palette';
import type { VoxelPart } from './ProductItem';

const W = 1.9;          // ширина
const BOX_L = 3.4;      // фургон
const CAB_L = 1.3;      // кабина
const WHEEL = 0.72;     // диаметр колеса
const TIRE = 0.3;       // ширина шины
const RAIL_Y = 0.45;    // низ рамы
const BOX_Y = 0.74;     // низ фургона (над колёсами)
const BOX_H = 1.75;
const CAB_Y = 0.6;      // низ кабины
const CAB_MID = 1.28;   // где начинается скос лобового стекла
const CAB_TOP = 2.1;
const SLOPE = 0.3;      // насколько верх кабины отступает назад от бампера

export function truckParts(): VoxelPart[] {
  const out: VoxelPart[] = [];
  const add = (pos: VoxelPart['pos'], size: VoxelPart['size'], color: string, rot?: VoxelPart['rot']) =>
    out.push(rot ? { pos, size, color, rot } : { pos, size, color });

  // рама
  add([0, (RAIL_Y + BOX_Y) / 2, (BOX_L + CAB_L) / 2], [W * 0.7, BOX_Y - RAIL_Y, BOX_L + CAB_L - 0.1], PALETTE.truckDark);

  // фургон: белый ящик, серые уголки на всех восьми углах, шов под крышей, задние двери
  const boxMidY = BOX_Y + BOX_H / 2;
  add([0, boxMidY, BOX_L / 2], [W, BOX_H, BOX_L], PALETTE.truckBody);
  const c = 0.16;
  for (const x of [-1, 1]) for (const y of [BOX_Y + c / 2 - 0.01, BOX_Y + BOX_H - c / 2 + 0.01]) for (const z of [0, BOX_L]) {
    add([x * (W / 2 - c / 2 + 0.01), y, z + (z === 0 ? c / 2 - 0.01 : -c / 2 + 0.01)], [c, c, c], PALETTE.truckTrim);
  }
  for (const x of [-1, 1]) add([x * (W / 2 + 0.004), BOX_Y + BOX_H - 0.22, BOX_L / 2], [0.01, 0.02, BOX_L - 0.4], PALETTE.truckTrim);
  add([0, boxMidY, -0.006], [0.03, BOX_H * 0.85, 0.012], PALETTE.truckTrim);

  // под фургоном: зелёная юбка и серая подножка между колёсами
  for (const x of [-1, 1]) {
    add([x * (W / 2 - 0.06), BOX_Y - 0.08, 2.1], [0.1, 0.14, 1.6], PALETTE.truckCab);
    add([x * (W / 2 - 0.1), RAIL_Y + 0.05, 2.1], [0.14, 0.06, 1.3], PALETTE.truckTrim);
  }

  // кабина: низ, верх с отступом и скошенный лоб
  const z0 = BOX_L + 0.06;          // задняя стенка кабины
  const front = BOX_L + CAB_L;      // передний край
  add([0, (CAB_Y + CAB_MID) / 2, (z0 + front) / 2], [W, CAB_MID - CAB_Y, front - z0], PALETTE.truckCab);
  add([0, (CAB_MID + CAB_TOP) / 2, (z0 + front - SLOPE) / 2], [W, CAB_TOP - CAB_MID, front - SLOPE - z0], PALETTE.truckCab);
  // скос: брусок по линии от (front, CAB_MID) до (front - SLOPE, CAB_TOP), наружная грань — линия скоса
  const dy = CAB_TOP - CAB_MID, dz = SLOPE;
  const len = Math.hypot(dy, dz);
  const tilt = Math.atan2(-dz, dy);           // наклон вершиной назад
  const nY = dz / len, nZ = dy / len;         // наружу (вперёд и вверх)
  const th = 0.26;
  const midY = (CAB_MID + CAB_TOP) / 2, midZ = front - SLOPE / 2;
  add([0, midY - nY * th / 2, midZ - nZ * th / 2], [W, len, th], PALETTE.truckCab, [tilt, 0, 0]);
  // лобовое стекло на скосе
  add([0, midY + nY * 0.006, midZ + nZ * 0.006], [W * 0.8, len * 0.72, 0.012], PALETTE.truckDark, [tilt, 0, 0]);
  // боковые окна и шов двери
  for (const x of [-1, 1]) {
    add([x * (W / 2 + 0.005), (CAB_MID + CAB_TOP) / 2 + 0.02, front - SLOPE - 0.32], [0.01, (CAB_TOP - CAB_MID) * 0.68, 0.42], PALETTE.truckDark);
    add([x * (W / 2 + 0.005), (CAB_Y + CAB_TOP) / 2, z0 + 0.12], [0.01, CAB_TOP - CAB_Y - 0.2, 0.02], PALETTE.truckCabDark);
    add([x * (W / 2 + 0.008), CAB_MID - 0.05, front - SLOPE - 0.6], [0.01, 0.04, 0.12], PALETTE.truckDark); // ручка
  }
  // зеркала: кронштейн и зеркало чуть впереди кабины
  for (const x of [-1, 1]) {
    add([x * (W / 2 + 0.07), CAB_MID + 0.32, front - 0.12], [0.14, 0.04, 0.04], PALETTE.truckDark);
    add([x * (W / 2 + 0.16), CAB_MID + 0.24, front - 0.12], [0.08, 0.3, 0.12], PALETTE.truckDark);
  }
  // крыша кабины: светлая полоса-козырёк
  add([0, CAB_TOP + 0.015, (z0 + front - SLOPE) / 2], [W - 0.1, 0.03, front - SLOPE - z0 - 0.1], PALETTE.truckCabLight);

  // перед: решётка с полосами, фары, белый бампер с зелёными уголками
  add([0, CAB_Y + 0.38, front + 0.015], [W * 0.42, 0.3, 0.03], PALETTE.truckDark);
  for (const y of [CAB_Y + 0.3, CAB_Y + 0.42]) add([0, y, front + 0.032], [W * 0.38, 0.03, 0.006], PALETTE.truckCabDark);
  for (const x of [-1, 1]) add([x * (W / 2 - 0.2), CAB_Y + 0.4, front + 0.02], [0.24, 0.18, 0.04], PALETTE.truckLight);
  const bumperY = CAB_Y - 0.02;
  add([0, bumperY, front + 0.08], [W + 0.06, 0.22, 0.16], PALETTE.truckBody);
  for (const x of [-1, 1]) {
    add([x * (W / 2 - 0.02), bumperY, front + 0.165], [0.12, 0.12, 0.012], PALETTE.truckCab);
    add([x * (W / 2 + 0.035), bumperY, front + 0.08], [0.012, 0.12, 0.12], PALETTE.truckCab);
  }

  // колёса круглые (просьба автора 15.10): «круг» из брусков — n полос одной ширины, повёрнутых вокруг оси колеса
  // с шагом π/n, вместе дают правильный 2n-угольник; при 16 гранях на экране он выглядит как круг.
  // Серый диск снаружи и тёмная ступица — такие же круги поменьше.
  const disc = (cx: number, cy: number, cz: number, width: number, d: number, n: number, color: string) => {
    const strip = d * Math.tan(Math.PI / (2 * n)); // ширина полосы = сторона 2n-угольника
    for (let k = 0; k < n; k++) add([cx, cy, cz], [width, d, strip], color, [(k * Math.PI) / n, 0, 0]);
  };
  for (const z of [0.85, BOX_L + CAB_L * 0.5]) {
    for (const x of [-1, 1]) {
      const cx = x * (W / 2 - TIRE / 2 + 0.02);
      const cy = WHEEL / 2;
      disc(cx, cy, z, TIRE, WHEEL, 8, PALETTE.truckDark);                                        // шина
      disc(cx + x * (TIRE / 2 + 0.006), cy, z, 0.012, WHEEL * 0.52, 8, PALETTE.truckTrim);        // диск
      disc(cx + x * (TIRE / 2 + 0.014), cy, z, 0.012, WHEEL * 0.18, 4, PALETTE.truckDark); // ступица
    }
  }
  return out;
}
