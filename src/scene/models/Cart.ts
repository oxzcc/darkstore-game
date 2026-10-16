// Тележка сборщика по art/reference/character_picker_*.png (W7, решение автора 16.10, вариант «а»):
// серый каркас на четырёх колёсиках, нижняя полка, сверху зелёная корзина, зелёная ручка у сборщика.
// Пустая: что в ней лежит, пока не показываем. Координаты — как у собаки (Dog.ts): +z — вперёд,
// тележка стоит перед сборщиком, ручка — на уровне его кистей в позе ARMS_ON_CART.
import { PALETTE } from '../../config/palette';
import type { VoxelPart } from './ProductItem';

const FRAME = PALETTE.truckTrim;  // светло-серый металл
const WHEEL = PALETTE.truckDark;

export function cartParts(): VoxelPart[] {
  const p: VoxelPart[] = [];
  const add = (pos: VoxelPart['pos'], size: VoxelPart['size'], color: string) => p.push({ pos, size, color });
  const [near, far] = [0.47, 1.07]; // ближний к сборщику и дальний края, м
  const mid = (near + far) / 2;
  const len = far - near;
  const half = 0.24;
  for (const x of [-half, half]) {
    for (const z of [near, far]) add([x, 0.05, z], [0.07, 0.1, 0.1], WHEEL);    // колёсики
    add([x, 0.45, near], [0.04, 0.7, 0.04], FRAME);                             // задняя стойка — до ручки
    add([x, 0.36, far], [0.04, 0.52, 0.04], FRAME);                             // передняя стойка
    add([x, 0.13, mid], [0.04, 0.04, len], FRAME);                              // нижняя рама
  }
  add([0, 0.2, mid], [2 * half, 0.03, len], FRAME);                             // нижняя полка
  // корзина: дно и четыре стенки
  add([0, 0.47, mid], [2 * half + 0.04, 0.04, len + 0.02], PALETTE.primary);
  for (const x of [-half - 0.01, half + 0.01]) add([x, 0.58, mid], [0.04, 0.2, len + 0.02], PALETTE.primary);
  for (const z of [near, far]) add([0, 0.58, z], [2 * half + 0.04, 0.2, 0.04], PALETTE.primary);
  add([0, 0.8, near - 0.02], [2 * half + 0.06, 0.05, 0.05], PALETTE.primary);   // ручка
  return p;
}
