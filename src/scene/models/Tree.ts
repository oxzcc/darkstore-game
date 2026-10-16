// Дерево и куст по art/reference/world_tree.png и world_bush.png (W5): кубические кроны из нескольких блоков,
// цвета крон — как в Moving Out 2 (08, раздел 0). Возвращают бруски в своих координатах (низ ствола — y = 0);
// все деревья и кусты вокруг склада рисует один VoxelBatch (scene/World.tsx).
import { PALETTE } from '../../config/palette';
import type { VoxelPart } from './ProductItem';

/** Дерево: ствол и крона из пяти блоков разного оттенка. `size` — масштаб, `turn` — поворот, `rnd` — для разброса. */
export function treeParts(size: number, turn: number, rnd: () => number): VoxelPart[] {
  const k = size;
  const rot: VoxelPart['rot'] = [0, turn, 0];
  const parts: VoxelPart[] = [
    { pos: [0, 0.6 * k, 0], size: [0.32 * k, 1.2 * k, 0.32 * k], color: PALETTE.trunk, rot },
    { pos: [0, 1.6 * k, 0], size: [1.6 * k, 1.1 * k, 1.6 * k], color: PALETTE.treeMid, rot },
    { pos: [0, 2.35 * k, 0], size: [1.0 * k, 0.8 * k, 1.0 * k], color: PALETTE.treeLight, rot },
  ];
  // боковые «пухлые» блоки кроны — немного в разные стороны
  for (let i = 0; i < 3; i++) {
    const a = turn + i * 2.1 + rnd() * 0.6;
    const r = 0.55 * k;
    parts.push({
      pos: [Math.cos(a) * r, (1.45 + rnd() * 0.5) * k, Math.sin(a) * r],
      size: [(0.93 + i * 0.02) * k, (0.78 + i * 0.02) * k, (0.93 + i * 0.02) * k], // чуть разные: грани соседних блоков не совпадают
      color: i === 0 ? PALETTE.treeDark : i === 1 ? PALETTE.treeLight : PALETTE.treeMid,
      rot,
    });
  }
  return parts;
}

/** Куст: три-четыре блока у земли. */
export function bushParts(size: number, turn: number, rnd: () => number): VoxelPart[] {
  const k = size;
  const rot: VoxelPart['rot'] = [0, turn, 0];
  const parts: VoxelPart[] = [{ pos: [0, 0.3 * k, 0], size: [0.85 * k, 0.6 * k, 0.85 * k], color: PALETTE.treeMid, rot }];
  const n = 2 + Math.floor(rnd() * 2);
  for (let i = 0; i < n; i++) {
    const a = turn + i * 2.4;
    parts.push({
      pos: [Math.cos(a) * 0.32 * k, (0.25 + rnd() * 0.25) * k, Math.sin(a) * 0.32 * k],
      size: [0.55 * k, 0.5 * k, 0.55 * k],
      color: i % 2 ? PALETTE.treeLight : PALETTE.treeDark,
      rot,
    });
  }
  return parts;
}
