// Электровелосипед курьера по art/reference/world_transport_bike.png (W5): тёмные колёса, светлая рама с зелёными
// деталями, седло и зелёный кофр на багажнике. Декорация на парковке. Бруски в своих координатах:
// низ колёс — y = 0, велосипед вытянут вдоль x (руль — к +x).
import { PALETTE } from '../../config/palette';
import type { VoxelPart } from './ProductItem';

export function bikeParts(): VoxelPart[] {
  const p: VoxelPart[] = [];
  const add = (pos: VoxelPart['pos'], size: VoxelPart['size'], color: string, rot?: VoxelPart['rot']) => p.push({ pos, size, color, rot });
  for (const x of [-0.55, 0.55]) {
    add([x, 0.32, 0], [0.62, 0.62, 0.1], PALETTE.truckDark);   // колесо (квадрат, как воксели)
    add([x, 0.32, 0], [0.24, 0.24, 0.12], PALETTE.truckTrim);  // втулка
  }
  add([0, 0.46, 0], [1.0, 0.1, 0.1], PALETTE.bikeFrame);                          // рама
  add([-0.12, 0.62, 0], [0.1, 0.36, 0.1], PALETTE.bikeFrame, [0, 0, 0.25]);       // подседельная труба
  add([0.45, 0.68, 0], [0.1, 0.5, 0.1], PALETTE.accentGreen, [0, 0, -0.2]);       // вилка руля
  add([0.52, 0.95, 0], [0.08, 0.06, 0.5], PALETTE.truckDark);                     // руль
  add([-0.2, 0.84, 0], [0.3, 0.07, 0.14], PALETTE.truckDark);                     // седло
  add([-0.55, 0.7, 0], [0.44, 0.06, 0.34], PALETTE.truckDark);                    // багажник
  add([-0.55, 0.97, 0], [0.46, 0.46, 0.44], PALETTE.accentGreen);                 // кофр
  add([-0.55, 1.2, 0], [0.4, 0.03, 0.38], PALETTE.primary);                       // крышка кофра
  return p;
}
