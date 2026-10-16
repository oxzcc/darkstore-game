// Электровелосипед курьера по art/reference/world_transport_bike.png (W5): тёмные колёса, светлая рама с зелёными
// деталями, седло и зелёный кофр на багажнике. Декорация на парковке. Бруски в своих координатах:
// низ колёс — y = 0, велосипед вытянут вдоль x (руль — к +x).
import { PALETTE } from '../../config/palette';
import type { VoxelPart } from './ProductItem';

/** Где сидит курьер: сдвиг вперёд от середины велосипеда и высота бёдер над землёй, м (W8a). Кофр — позади, его не закрывает. */
export const BIKE_SEAT = { ahead: 0.1, hip: 0.43 };

/** Круглое колесо (правка автора 16.10): шина и обод — 12-угольники из трёх брусков, повёрнутых на 30°, со скруглёнными рёбрами. */
function wheel(add: (pos: VoxelPart['pos'], size: VoxelPart['size'], color: string, rot?: VoxelPart['rot']) => void, x: number) {
  for (let i = 0; i < 3; i++) {
    const r: VoxelPart['rot'] = [0, 0, (i * Math.PI) / 6];
    add([x, 0.32, 0], [0.64, 0.64, 0.1], PALETTE.truckDark, r);   // шина
    add([x, 0.32, 0], [0.4, 0.4, 0.11], PALETTE.truckTrim, r);    // обод
    add([x, 0.32, 0], [0.13, 0.13, 0.13], PALETTE.truckDark, r);  // втулка
  }
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
