// Легковая машина на дороге (W8c) — фон, как в Moving Out: короткий мультяшный хэтчбек из мягких брусков.
// Кузов цветной, крыша и стойки того же цвета, тёмные стёкла, круглые колёса (как у велосипедов), белые фары, красные фонари.
// Координаты своей машины: низ колёс — y = 0, нос — к +x.
import { PALETTE } from '../../config/palette';
import type { VoxelPart } from './ProductItem';
import { roundParts } from './Bike';

const GLASS = '#3B4A5C';
const TAIL = '#E23B3B';

export function carParts(color: string): VoxelPart[] {
  const p: VoxelPart[] = [];
  const add = (pos: VoxelPart['pos'], size: VoxelPart['size'], c: string, rot?: VoxelPart['rot']) => p.push(rot ? { pos, size, color: c, rot } : { pos, size, color: c });
  const L = 2.6, W = 1.36;
  // колёса: круглые, торчат из-под кузова
  for (const x of [-0.82, 0.82]) for (const z of [-W / 2 + 0.1, W / 2 - 0.1]) {
    for (const b of roundParts(0.3)) add([x, 0.3, z], [b.size[0], b.size[1], 0.24], PALETTE.truckDark, [0, 0, b.angle]);
    for (const b of roundParts(0.14)) add([x, 0.3, z + Math.sign(z) * 0.125], [b.size[0], b.size[1], 0.02], PALETTE.truckTrim, [0, 0, b.angle]);
  }
  add([0, 0.62, 0], [L, 0.5, W], color);                         // нижняя часть кузова
  for (const s of [-1, 1]) add([s * (L / 2 + 0.03), 0.48, 0], [0.1, 0.14, W - 0.04], PALETTE.truckTrim); // бамперы спереди и сзади
  for (const s of [-1, 1]) add([0, 0.44, s * (W / 2 + 0.01)], [0.92, 0.1, 0.04], PALETTE.truckTrim);  // пороги между колёсами
  add([-0.2, 1.1, 0], [1.5, 0.5, W - 0.12], color);              // салон
  add([-0.2, 1.37, 0], [1.4, 0.06, W - 0.2], color);             // крыша
  // стёкла: лобовое, заднее, боковые — чуть выступают из салона
  add([0.56, 1.1, 0], [0.04, 0.36, W - 0.26], GLASS);
  add([-0.96, 1.1, 0], [0.04, 0.34, W - 0.26], GLASS);
  for (const s of [-1, 1]) add([-0.2, 1.1, s * ((W - 0.12) / 2 + 0.01)], [1.3, 0.34, 0.02], GLASS);
  // фары и фонари
  for (const s of [-1, 1]) {
    add([L / 2 + 0.01, 0.7, s * 0.45], [0.04, 0.14, 0.24], PALETTE.truckLight);
    add([-L / 2 - 0.01, 0.7, s * 0.47], [0.04, 0.14, 0.18], TAIL);
  }
  return p;
}
