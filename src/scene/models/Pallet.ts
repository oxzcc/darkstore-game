// Паллета с коробками по art/reference/world_palete.png (M9b2; 08, раздел 7: 1×1 клетка). Стиль — low poly.
// Поддон: нижние доски, бруски-шашки, верхний настил из досок со щелями. Сверху стопка картонных коробок
// со скотчем по крышке и вниз по лицу; коробки чуть повёрнуты, чтобы стопка не выглядела «по линейке».
// Чем больше товара — тем выше стопка (сколько коробок, решает Deliveries).
// Возвращает список брусков: все паллеты рисует один VoxelBatch (08, раздел 11).
import { PALETTE } from '../../config/palette';
import type { VoxelPart } from './ProductItem';

const LEN = 0.9;     // вдоль x
const WID = 0.74;    // вдоль z
const BOTTOM = 0.025; // нижние доски
const BLOCK = 0.08;  // высота брусков-шашек
const DECK = 0.03;   // верхний настил

/** Где стоят коробки: x, z, слой (0 — нижний), размер по x и z, высота, поворот вокруг вертикали. */
const SPOTS: { x: number; z: number; layer: 0 | 1; sx: number; sz: number; h: number; turn: number }[] = [
  { x: -0.21, z: -0.17, layer: 0, sx: 0.4, sz: 0.34, h: 0.34, turn: 0.03 },
  { x: 0.22, z: -0.16, layer: 0, sx: 0.38, sz: 0.34, h: 0.4, turn: -0.04 },
  { x: -0.2, z: 0.18, layer: 0, sx: 0.4, sz: 0.32, h: 0.36, turn: -0.02 },
  { x: 0.21, z: 0.17, layer: 0, sx: 0.38, sz: 0.34, h: 0.34, turn: 0.05 },
  { x: -0.12, z: 0.02, layer: 1, sx: 0.38, sz: 0.3, h: 0.28, turn: 0.08 },
  { x: 0.16, z: -0.06, layer: 1, sx: 0.34, sz: 0.3, h: 0.26, turn: -0.06 },
];

export function palletParts(boxes: number): VoxelPart[] {
  const out: VoxelPart[] = [];
  const add = (pos: VoxelPart['pos'], size: VoxelPart['size'], color: string, turn = 0) =>
    out.push(turn ? { pos, size, color, rot: [0, turn, 0] } : { pos, size, color });

  // нижние доски вдоль x
  for (const z of [-1, 0, 1]) add([0, BOTTOM / 2, z * (WID / 2 - 0.07)], [LEN, BOTTOM, 0.14], PALETTE.palletWood);
  // бруски-шашки 3 × 3 (между ними — проёмы под вилы)
  for (const x of [-1, 0, 1]) {
    for (const z of [-1, 0, 1]) {
      add([x * (LEN / 2 - 0.07), BOTTOM + BLOCK / 2, z * (WID / 2 - 0.07)], [0.14, BLOCK, 0.14], PALETTE.wood);
    }
  }
  // верхний настил: 5 досок вдоль z со щелями
  const deckY = BOTTOM + BLOCK + DECK / 2;
  const slat = 0.14;
  for (let i = 0; i < 5; i++) {
    const x = -LEN / 2 + slat / 2 + (i * (LEN - slat)) / 4;
    add([x, deckY, 0], [slat, DECK, WID], PALETTE.palletWood);
  }

  // коробки
  const base = BOTTOM + BLOCK + DECK;
  const lowTop = Math.max(...SPOTS.filter((s) => s.layer === 0).map((s) => s.h));
  for (const s of SPOTS.slice(0, Math.max(1, Math.min(SPOTS.length, boxes)))) {
    const bottom = s.layer === 0 ? base : base + lowTop;
    const y = bottom + s.h / 2;
    add([s.x, y, s.z], [s.sx, s.h, s.sz], PALETTE.box, s.turn);
    // скотч по крышке поперёк и вниз по лицевым граням (как на образце)
    const tape = 0.09;
    add([s.x, bottom + s.h + 0.004, s.z], [tape, 0.008, s.sz + 0.008], PALETTE.boxTape, s.turn);
    const down = s.h * 0.35;
    for (const side of [-1, 1]) {
      const dz = side * (s.sz / 2 + 0.004);
      add(
        [s.x + Math.sin(s.turn) * dz, bottom + s.h - down / 2, s.z + Math.cos(s.turn) * dz],
        [tape, down, 0.008],
        PALETTE.boxTape,
        s.turn,
      );
    }
  }
  return out;
}
