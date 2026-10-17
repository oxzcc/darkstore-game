// Сценки-иллюстрации (config/vignettes.ts): позы собаки, эмоции на морде и бруски реквизита.
// Чистые функции без React: поза по времени и списки брусков (VoxelPart) для VoxelBatch.
import type { ProductLook } from '../../model/product';
import type { VignetteMood, VignettePose, VignetteProp } from '../../config/vignettes';
import { VIGNETTE } from '../../config/vignettes';
import { PALETTE } from '../../config/palette';
import { WAREHOUSE_VIEW } from '../../config/warehouse';
import { productParts, type VoxelPart } from '../models/ProductItem';
import { rackParts } from '../models/Rack';
import { ladderParts } from '../models/Ladder';
import { RACK_BOARD, shelfY } from '../rackGeometry';

/** Поза: повороты частей тела (радианы, оси — как в dogAnim.ts) и подскок всей фигурки. */
export type VignetteDogPose = {
  legL: number; legR: number;
  armL: [number, number]; armR: [number, number]; // вокруг x (вперёд-вверх — минус) и z (в сторону)
  head: [number, number];                         // кивок (плюс — вниз) и поворот
  tail: number;
  roll: number;
  lean: number;
  bob: number;
};

/** Поза в момент `t` (секунды реального времени: окно открыто, а мир на паузе). */
export function vignettePose(pose: VignettePose, t: number): VignetteDogPose {
  const p: VignetteDogPose = {
    legL: 0, legR: 0, armL: [0, 0], armR: [0, 0], head: [0, Math.sin(t * 0.9) * 0.1],
    tail: Math.sin(t * 4) * 0.35, roll: 0, lean: 0, bob: Math.abs(Math.sin(t * 2.2)) * 0.02,
  };
  switch (pose) {
    case 'call': {
      // машет правой лапой над головой, в левой — ТСД перед собой (как «зовёт» на складе)
      const w = Math.sin(t * WAREHOUSE_VIEW.pickerAnim.waveSpeed);
      // лапа машет снаружи от головы и ушей: отведена в сторону (вокруг z) не меньше чем на raisedArmOut (config/warehouse.ts)
      p.armR = [-2.55 + w * 0.12, WAREHOUSE_VIEW.pickerAnim.raisedArmOut + 0.18 + w * 0.18];
      p.armL = [-1.05, -0.1];
      p.head = [-0.08, Math.sin(t * 1.3) * 0.12];
      p.tail = Math.sin(t * 12) * 0.5;
      break;
    }
    case 'oops': {
      // «ой»: растерянно разводит лапами в стороны (не к голове — иначе лапа уходит в голову), смотрит вниз на упавшее
      const k = Math.sin(t * 2.4) * 0.06;
      p.armR = [-0.55 + k, 0.75];
      p.armL = [-0.55 - k, -0.75];
      p.head = [0.22, 0.25 + Math.sin(t * 1.1) * 0.06];
      p.roll = Math.sin(t * 1.6) * 0.03;
      p.tail = Math.sin(t * 2) * 0.12;
      p.bob = 0;
      break;
    }
    case 'carry': {
      // несёт упаковку перед собой и радостно подпрыгивает
      p.armL = [-1.15, 0];
      p.armR = [-1.15, 0];
      p.head = [-0.12, Math.sin(t * 1.4) * 0.1];
      p.tail = Math.sin(t * 14) * 0.6;
      p.bob = Math.abs(Math.sin(t * 3.2)) * 0.06;
      break;
    }
    case 'cheer': {
      // обе лапы вверх, прыгает
      const k = Math.sin(t * 7);
      p.armL = [-2.75, -(WAREHOUSE_VIEW.pickerAnim.raisedArmOut + 0.1) + k * 0.08];
      p.armR = [-2.75, WAREHOUSE_VIEW.pickerAnim.raisedArmOut + 0.1 - k * 0.08];
      p.head = [-0.15, 0];
      p.tail = Math.sin(t * 16) * 0.6;
      p.bob = Math.abs(Math.sin(t * 4)) * 0.12;
      break;
    }
  }
  return p;
}

/**
 * Эмоция: брови, рот и капля пота — бруски в координатах головы (точка поворота — шея, как в models/Dog.ts).
 * Морда спереди на z ≈ 0,53, глаза на y 0,38–0,49; бруски чуть выступают, чтобы грани не совпадали с мордой.
 */
export function faceParts(mood: VignetteMood): VoxelPart[] {
  const out: VoxelPart[] = [];
  const brow = (x: number, y: number, rotZ: number) =>
    out.push({ pos: [x, y, 0.39], size: [0.15, 0.04, 0.03], color: VIGNETTE.brow, rot: [0, 0, rotZ] });
  switch (mood) {
    case 'call':
      // брови домиком: внутренние концы выше
      brow(-0.18, 0.56, 0.3);
      brow(0.18, 0.56, -0.3);
      out.push({ pos: [0, 0.095, 0.549], size: [0.1, 0.03, 0.02], color: VIGNETTE.mouth });
      break;
    case 'oops':
      brow(-0.18, 0.565, 0.42);
      brow(0.18, 0.565, -0.42);
      out.push({ pos: [0, 0.1, 0.549], size: [0.08, 0.07, 0.02], color: VIGNETTE.mouth }); // «о»
      out.push({ pos: [0.5, 0.68, 0.16], size: [0.07, 0.11, 0.06], color: VIGNETTE.sweat });
      break;
    case 'happy':
      // брови подняты и ровные, широкая улыбка
      brow(-0.18, 0.58, 0);
      brow(0.18, 0.58, 0);
      out.push({ pos: [0, 0.1, 0.549], size: [0.18, 0.04, 0.02], color: VIGNETTE.mouth });
      out.push({ pos: [-0.1, 0.125, 0.549], size: [0.04, 0.04, 0.02], color: VIGNETTE.mouth });
      out.push({ pos: [0.1, 0.125, 0.549], size: [0.04, 0.04, 0.02], color: VIGNETTE.mouth });
      break;
  }
  return out;
}

/** Сдвинуть и повернуть бруски модели вокруг вертикали (поворот прибавляется к rot[1], порядок YXZ — см. VoxelPart). */
function placed(parts: VoxelPart[], at: [number, number, number], turn = 0): VoxelPart[] {
  const c = Math.cos(turn), s = Math.sin(turn);
  return parts.map((p): VoxelPart => {
    const [x, y, z] = p.pos;
    const r = p.rot ?? [0, 0, 0];
    return {
      ...p,
      pos: [at[0] + x * c + z * s, at[1] + y, at[2] - x * s + z * c],
      rot: [r[0], r[1] + turn, r[2]],
    };
  });
}

const PRODUCT_W = 0.32;
const PRODUCT_HS = 1.3;

/** Штука товара (крупнее, чем на полке склада, — сценка смотрится издалека). */
export function productPiece(look: ProductLook, size = PRODUCT_W): VoxelPart[] {
  return productParts(look, size, size, PRODUCT_HS);
}

/** Картонная коробка; `open` — без крышки, внутри видно тёмное дно. Низ на y = 0. */
export function boxParts(open: boolean): VoxelPart[] {
  const out: VoxelPart[] = [{ pos: [0, 0.18, 0], size: [0.5, 0.36, 0.4], color: PALETTE.box }];
  if (open) out.push({ pos: [0, 0.365, 0], size: [0.42, 0.02, 0.32], color: PALETTE.boxDark });
  else out.push({ pos: [0, 0.365, 0], size: [0.52, 0.02, 0.1], color: PALETTE.boxTape });
  return out;
}

/** Бруски реквизита, кроме тех, что надо поворачивать целиком (товар и коробка на боку — отдельными группами). */
export function propParts(prop: VignetteProp, look: ProductLook | null): VoxelPart[] {
  switch (prop.kind) {
    case 'rack': {
      const shelves = 3;
      const out = rackParts(2, shelves);
      const top = (s: number) => shelfY(s, shelves) + RACK_BOARD / 2;
      // нижняя полка — коробки, средняя и верхняя — товар задания; на верхней посередине пусто, если gapTop
      for (const x of [-0.55, 0, 0.55]) out.push(...placed(boxParts(false), [x, top(1), 0.05]));
      if (look) {
        for (const x of [-0.6, -0.2, 0.2, 0.6]) out.push(...placed(productPiece(look), [x, top(2), 0.12]));
        for (const x of [-0.6, -0.2, 0.2, 0.6]) {
          if (prop.gapTop && Math.abs(x) < 0.3) continue;
          out.push(...placed(productPiece(look), [x, top(3), 0.12]));
        }
      }
      return placed(out, prop.at, prop.turn);
    }
    case 'ladder':
      return placed(ladderParts(), prop.at, prop.turn);
    case 'product':
      return look ? productPiece(look, prop.size) : [];
    case 'box':
      return boxParts(prop.open ?? false);
  }
}
