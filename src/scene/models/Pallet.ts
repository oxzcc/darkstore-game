// Паллета с коробками — по образцу концепт-рендера «Даркстор: Moving Out-стиль» (W7b; было по art/reference/world_palete.png, M9b2).
// Правки автора 16.10: коробки крупные, по 2 × 2 в слое, как в рендере, но поддон — в одну клетку (0,96 × 0,96 м), чтобы паллеты стояли вплотную.
// Три бруска снизу, четыре доски настила; до 3 слоёв коробок (чем больше товара — тем выше стопка, сколько коробок — решает Deliveries).
// Коробки чуть повёрнуты и двух оттенков картона, на крышке — полоса скотча. Все паллеты рисует один VoxelBatch (08, раздел 11).
import { PALETTE } from '../../config/palette';
import type { VoxelPart } from './ProductItem';

export const PALLET_SIZE = 0.96;   // сторона поддона, м — в одну клетку с зазором
const RUNNER = 0.1;                // высота нижних брусков
const DECK = 0.06;                 // доски настила
const BOX = 0.44;                  // коробка: сторона… (2 × 2 с поворотом влезают в поддон)
const BOX_H = 0.34;                // …и высота
const PER_LAYER = 4;
export const PALLET_MAX_BOXES = 12;
const SPOTS: [number, number][] = [[-0.23, -0.23], [0.23, -0.23], [-0.23, 0.23], [0.23, 0.23]];
const TURNS = [0.06, -0.08, 0.03, -0.04, -0.07, 0.09, 0.02, -0.05, 0.08, -0.03, 0.05, -0.09];

const QTY_PER_BOX = 3; // сколько штук товара «в одной коробке» — только для вида стопки

/** Сколько коробок рисовать на паллете с таким количеством товара. */
export function palletBoxes(qty: number): number {
  return Math.ceil(qty / QTY_PER_BOX);
}

/** Высота верха стопки: куда «падает» коробка, брошенная на паллету (приёмка, W7b). */
export function palletTopY(boxes: number): number {
  const n = Math.max(1, Math.min(PALLET_MAX_BOXES, boxes));
  return RUNNER + DECK + Math.ceil(n / PER_LAYER) * BOX_H;
}

export function palletParts(boxes: number): VoxelPart[] {
  const out: VoxelPart[] = [];
  const add = (pos: VoxelPart['pos'], size: VoxelPart['size'], color: string, turn = 0) =>
    out.push(turn ? { pos, size, color, rot: [0, turn, 0] } : { pos, size, color });

  // поддон: бруски вдоль x и доски настила поперёк
  for (const z of [-0.38, 0, 0.38]) add([0, RUNNER / 2, z], [PALLET_SIZE, RUNNER, 0.16], PALETTE.wood);
  for (const x of [-0.385, -0.13, 0.13, 0.385]) add([x, RUNNER + DECK / 2, 0], [0.19, DECK, PALLET_SIZE], PALETTE.palletWood);

  // коробки слоями по 2 × 2; в неполном верхнем слое — сколько осталось
  const n = Math.max(1, Math.min(PALLET_MAX_BOXES, boxes));
  for (let i = 0; i < n; i++) {
    const layer = Math.floor(i / PER_LAYER);
    const [dx, dz] = SPOTS[i % PER_LAYER];
    const bottom = RUNNER + DECK + layer * BOX_H;
    const turn = TURNS[i];
    add([dx, bottom + BOX_H / 2, dz], [BOX, BOX_H, BOX], i % 3 === 1 ? PALETTE.boxDark : PALETTE.box, turn);
    add([dx, bottom + BOX_H + 0.01, dz], [BOX, 0.02, 0.1], PALETTE.boxTape, turn); // скотч по крышке
  }
  return out;
}
