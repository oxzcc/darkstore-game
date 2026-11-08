// Электровелосипед курьера по art/reference/world_transport_bike.png (W5): тёмные колёса, светлая рама с зелёными
// деталями, седло и зелёный кофр на багажнике. Декорация на парковке. Бруски в своих координатах:
// низ колёс — y = 0, велосипед вытянут вдоль x (руль — к +x).
import { PALETTE } from '../../config/palette';
import type { VoxelPart } from './ProductItem';

/** Где сидит курьер: сдвиг вперёд от середины велосипеда и высота бёдер над землёй, м (W8a). Кофр — позади, его не закрывает. */
export const BIKE_SEAT = { ahead: 0.1, hip: 0.43 };

/**
 * Круглое колесо (правка автора 16.10): правильный 12-угольник из 6 планок, повёрнутых на 30°. Каждая планка длиной
 * с два «внутренних радиуса» и шириной со сторону многоугольника — её углы ложатся ровно на окружность, поэтому без зубцов.
 */
export function roundParts(r: number): { size: [number, number]; angle: number }[] {
  const n = 6;
  const apothem = r * Math.cos(Math.PI / (2 * n));
  const side = 2 * r * Math.sin(Math.PI / (2 * n));
  return Array.from({ length: n }, (_, i) => ({ size: [2 * apothem, side], angle: (i * Math.PI) / n }));
}

// G3 (08.11): велосипед переделан ближе к референсу — объёмные круглые колёса со спицами (цилиндры, VoxelPart.cyl),
// рама «с низкой посадкой» из толстых труб с зелёной вставкой, зелёная вилка, фара, руль с дисплеем, мотор с педалями,
// зелёный багажник и кофр с ремнями. Размеры колёс, место седла и кофра — прежние: курьер садится как раньше (BIKE_SEAT).
const WHEEL_R = 0.32;
const AXLE_Y = 0.32;
const WHEEL_X = 0.55;

/** Ось колеса — поперёк велосипеда (z): цилиндр повёрнут на 90° вокруг x. */
const ACROSS: [number, number, number] = [Math.PI / 2, 0, 0];

type Add = (pos: VoxelPart['pos'], size: VoxelPart['size'], color: string, rot?: VoxelPart['rot'], cyl?: VoxelPart['cyl']) => void;

function wheel(add: Add, x: number) {
  const round = (r: number, depth: number, color: string) => add([x, AXLE_Y, 0], [2 * r, depth, 2 * r], color, ACROSS, { top: 1, bottom: 1 });
  round(WHEEL_R, 0.13, PALETTE.truckDark);         // шина
  round(WHEEL_R * 0.72, 0.135, PALETTE.truckTrim); // обод
  for (let i = 0; i < 3; i++) {                     // спицы — три тёмные планки через центр
    add([x, AXLE_Y, 0], [WHEEL_R * 1.38, 0.018, 0.142], PALETTE.truckDark, [0, 0, (i * Math.PI) / 3 + 0.3]);
  }
  round(0.065, 0.16, PALETTE.truckDark);            // втулка
}

/** Труба от точки a к точке b (в плоскости x–y) толщиной t и глубиной d. */
function tube(add: Add, a: [number, number], b: [number, number], t: number, d: number, color: string, z = 0) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  add([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z], [Math.hypot(dx, dy), t, d], color, [0, 0, Math.atan2(dy, dx)]);
}

export function bikeParts(): VoxelPart[] {
  const p: VoxelPart[] = [];
  const add: Add = (pos, size, color, rot, cyl) => p.push({ pos, size, color, rot, ...(cyl ? { cyl } : {}) });
  wheel(add, -WHEEL_X);
  wheel(add, WHEEL_X);

  // вилка: два зелёных пера по бокам переднего колеса
  for (const z of [-0.09, 0.09]) tube(add, [WHEEL_X, AXLE_Y], [0.46, 0.72], 0.06, 0.035, PALETTE.accentGreen, z);
  add([0.47, 0.72, 0], [0.08, 0.06, 0.22], PALETTE.accentGreen);                      // коронка вилки
  // рама: рулевая труба, наклонная нижняя труба с зелёной вставкой, подседельная, задние перья
  tube(add, [0.46, 0.7], [0.42, 0.96], 0.12, 0.12, PALETTE.bikeFrame);
  tube(add, [0.44, 0.8], [0.06, 0.3], 0.13, 0.13, PALETTE.bikeFrame);
  tube(add, [0.39, 0.72], [0.12, 0.37], 0.06, 0.145, PALETTE.accentGreen);            // зелёная вставка — видна с обеих сторон
  tube(add, [0.02, 0.3], [-0.04, 0.76], 0.1, 0.1, PALETTE.bikeFrame);
  for (const z of [-0.075, 0.075]) tube(add, [0.04, 0.3], [-WHEEL_X, AXLE_Y], 0.06, 0.04, PALETTE.bikeFrame, z);
  // мотор у педалей, шатуны и педали с оранжевыми катафотами
  add([0.04, 0.3, 0], [0.26, 0.17, 0.17], PALETTE.truckDark);
  for (const [s, x] of [[1, 0.14], [-1, -0.06]] as const) {
    add([x, s > 0 ? 0.24 : 0.36, s * 0.11], [0.13, 0.04, 0.03], PALETTE.truckDark, [0, 0, s * 0.5]);
    add([x + s * 0.05, s > 0 ? 0.2 : 0.4, s * 0.16], [0.12, 0.035, 0.08], PALETTE.truckDark);
    add([x + s * 0.05, s > 0 ? 0.2 : 0.4, s * 0.2], [0.07, 0.022, 0.005], PALETTE.bikeReflector);
  }
  // подседельный штырь и седло (под курьером, впереди кофра)
  add([-0.03, 0.79, 0], [0.05, 0.08, 0.05], PALETTE.truckDark);
  add([0.02, 0.84, 0], [0.34, 0.08, 0.2], PALETTE.truckDark);
  // руль: вынос, поперечина с ручками и рычагами, зелёный дисплей; фара на рулевой трубе
  tube(add, [0.42, 0.95], [0.5, 1.08], 0.06, 0.06, PALETTE.truckDark);
  add([0.5, 1.08, 0], [0.06, 0.06, 0.56], PALETTE.truckDark);
  for (const z of [-0.2, 0.2]) add([0.45, 1.08, z], [0.1, 0.02, 0.025], PALETTE.truckDark, [0, 0, -0.35]);
  add([0.48, 1.125, 0], [0.09, 0.03, 0.09], PALETTE.accentGreen);
  add([0.5, 0.86, 0], [0.07, 0.11, 0.11], PALETTE.truckDark);
  add([0.536, 0.86, 0], [0.01, 0.075, 0.075], PALETTE.bikeLamp);
  // подножка (велосипед стоит, чуть наклонён на неё — не рисуем, только сама подножка)
  tube(add, [-0.1, 0.3], [-0.2, 0.02], 0.03, 0.03, PALETTE.truckDark, -0.12);

  // багажник и кофр вынесены назад за колесо, чтобы сидящего курьера не закрывал кофр, а курьер — кофр (правка автора 16.10)
  for (const z of [-0.1, 0.1]) tube(add, [-WHEEL_X, AXLE_Y], [-0.5, 0.76], 0.045, 0.035, PALETTE.accentGreen, z); // стойки от оси
  for (const z of [-0.22, 0.22]) add([-0.78, 0.76, z], [0.66, 0.035, 0.035], PALETTE.accentGreen);                // рамка багажника
  for (const x of [-0.46, -1.1]) add([x, 0.76, 0], [0.035, 0.035, 0.475], PALETTE.accentGreen);
  const box: [number, number, number] = [-0.8, 1.035, 0];
  add(box, [0.52, 0.52, 0.48], PALETTE.accentGreen);                                 // кофр
  add([box[0], 1.285, 0], [0.5, 0.04, 0.46], PALETTE.bikeBoxTop);                       // крышка
  for (const dx of [-0.15, 0.15]) add([box[0] + dx, box[1], 0], [0.045, 0.535, 0.495], PALETTE.truckDark); // ремни
  add([box[0], 1.13, 0], [0.535, 0.04, 0.495], PALETTE.truckDark);
  add([box[0] + 0.12, 1.13, 0.255], [0.08, 0.06, 0.02], PALETTE.accentGreen);        // застёжка
  return p;
}
