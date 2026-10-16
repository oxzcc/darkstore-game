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

function wheel(add: (pos: VoxelPart['pos'], size: VoxelPart['size'], color: string, rot?: VoxelPart['rot']) => void, x: number) {
  const disc = (r: number, depth: number, color: string) => {
    for (const b of roundParts(r)) add([x, 0.32, 0], [b.size[0], b.size[1], depth], color, [0, 0, b.angle]);
  };
  disc(0.32, 0.1, PALETTE.truckDark);   // шина
  disc(0.2, 0.11, PALETTE.truckTrim);   // обод
  disc(0.07, 0.13, PALETTE.truckDark);  // втулка
}

export function bikeParts(): VoxelPart[] {
  const p: VoxelPart[] = [];
  const add = (pos: VoxelPart['pos'], size: VoxelPart['size'], color: string, rot?: VoxelPart['rot']) => p.push({ pos, size, color, rot });
  wheel(add, -0.55);
  wheel(add, 0.55);
  add([0, 0.46, 0], [1.0, 0.1, 0.1], PALETTE.bikeFrame);                          // рама
  add([0.08, 0.62, 0], [0.1, 0.36, 0.1], PALETTE.bikeFrame, [0, 0, 0.25]);        // подседельная труба
  add([0.45, 0.68, 0], [0.1, 0.5, 0.1], PALETTE.accentGreen, [0, 0, -0.2]);       // вилка руля
  add([0.52, 0.95, 0], [0.08, 0.06, 0.5], PALETTE.truckDark);                     // руль
  add([0.02, 0.84, 0], [0.3, 0.07, 0.14], PALETTE.truckDark);                     // седло (под курьером, впереди кофра)
  // багажник и кофр вынесены назад за колесо, чтобы сидящего курьера не закрывал кофр, а курьер — кофр (правка автора 16.10)
  add([-0.68, 0.7, 0], [0.6, 0.06, 0.34], PALETTE.truckDark);                     // багажник
  add([-0.5, 0.58, 0], [0.06, 0.24, 0.06], PALETTE.truckDark, [0, 0, -0.5]);      // стойка багажника
  add([-0.84, 1.0, 0], [0.5, 0.52, 0.48], PALETTE.accentGreen);                   // кофр
  add([-0.84, 1.27, 0], [0.44, 0.03, 0.42], PALETTE.primary);                     // крышка кофра
  return p;
}
