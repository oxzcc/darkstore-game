// Сценки-иллюстрации (config/vignettes.ts): позы собаки, эмоции на морде и бруски реквизита.
// Чистые функции без React: поза по времени и списки брусков (VoxelPart) для VoxelBatch.
// Правило для новых брусков (как во всех моделях): грани брусков разного цвета не должны лежать в одной плоскости.
import type { ProductLook } from '../../model/product';
import type { ShelfFill, VignetteHold, VignetteIcon, VignetteMood, VignettePose, VignetteProp } from '../../config/vignettes';
import { VIGNETTE } from '../../config/vignettes';
import { PALETTE } from '../../config/palette';
import { WAREHOUSE_VIEW } from '../../config/warehouse';
import { PRODUCTS } from '../../config/products';
import { productParts, type VoxelPart } from '../models/ProductItem';
import { rackParts } from '../models/Rack';
import { ladderParts } from '../models/Ladder';
import { cartParts } from '../models/Cart';
import { palletParts } from '../models/Pallet';
import { packingTableParts } from '../models/PackingTable';
import { ARMS_ON_CART, DOG_ARM } from '../models/Dog';
import { RACK_BOARD, shelfY } from '../rackGeometry';

/** Поза: повороты частей тела (радианы, оси — как в dogAnim.ts) и подскок всей фигурки. */
export type VignetteDogPose = {
  legL: number; legR: number;
  armL: [number, number]; armR: [number, number]; // вокруг x (вперёд-вверх — минус) и z (правая наружу — плюс, левая — минус)
  head: [number, number];                         // кивок (плюс — вниз) и поворот
  tail: number;
  roll: number;
  lean: number;
  bob: number;                                    // подскок (минус — присел)
};

type V3 = [number, number, number];

/**
 * Углы руки, при которых кисть смотрит в точку `target` (координаты собаки: x вбок, y вверх, z вперёд).
 * У модели рука — один брусок без локтя, поэтому углы на глаз дают кисть мимо коробки; здесь они считаются.
 * Порядок поворотов — как у группы руки (Euler XYZ): сначала вбок (z), потом вперёд-назад (x).
 * Если точка ближе длины руки, кисть встаёт чуть дальше по тому же направлению.
 */
export function armTo(target: V3): [number, number] {
  const sx = Math.sign(target[0]) * DOG_ARM.shoulderX;
  const dx = target[0] - sx, dy = target[1] - DOG_ARM.shoulderY, dz = target[2];
  const len = Math.hypot(dx, dy, dz) || 1;
  const z = Math.asin(Math.max(-1, Math.min(1, dx / len)));
  const x = Math.atan2(-dz / len, -dy / len);
  return [x, z];
}

/** Где кисти держат коробку: по бокам коробки (коробка 0,5 м шириной — в Vignette.tsx, `HELD_BOX`). */
const BOX_GRIP: V3 = [0.33, 0.76, 0.66];
/** Где кисти держат по штуке товара (поза «сравнивает» и предмет «два товара»). */
const TWO_GRIP: V3 = [0.34, 0.74, 0.62];
/** Где правая кисть держит одну штуку товара. */
const ONE_GRIP: V3 = [0.34, 0.82, 0.62];

/**
 * Поднятая лапа — вверх-вперёд, перед ушами, а не в сторону (правка автора 17.10: в стороны руки торчали далеко от тела).
 * `out` — немного наружу, чтобы не задеть голову и висячие уши; `x` — насколько вверх (−2,2 — вверх-вперёд, −2,6 — почти вертикально).
 * Проверено расчётом: при x ≈ −2,2…−2,3 и out ≈ 0,45…0,5 рука проходит мимо головы и ушей лабрадора.
 */
const RAISED = (x: number, out: number): [number, number] => [x, out];

/** Поза в момент `t` (секунды реального времени: окно открыто, а мир на паузе). `hold` — что в лапах: руки тянутся к предмету. */
export function vignettePose(pose: VignettePose, t: number, hold: VignetteHold = null): VignetteDogPose {
  const p: VignetteDogPose = {
    legL: 0, legR: 0, armL: [0, 0], armR: [0, 0], head: [0, Math.sin(t * 0.9) * 0.1],
    tail: Math.sin(t * 4) * 0.35, roll: 0, lean: 0, bob: Math.abs(Math.sin(t * 2.2)) * 0.02,
  };
  const mirror = ([x, z]: [number, number]): [number, number] => [x, -z];
  switch (pose) {
    case 'idle':
      break;
    case 'call': {
      // машет правой лапой вверх-вперёд перед ухом, в левой — ТСД перед собой
      const w = Math.sin(t * WAREHOUSE_VIEW.pickerAnim.waveSpeed);
      p.armR = RAISED(-2.2 + w * 0.08, 0.47 + w * 0.08);
      p.armL = [-1.05, -0.1];
      p.head = [-0.08, Math.sin(t * 1.3) * 0.12];
      p.tail = Math.sin(t * 12) * 0.5;
      break;
    }
    case 'oops': {
      // «ой»: лапы чуть вперёд и в стороны ладонями вверх, смотрит вниз на упавшее
      const k = Math.sin(t * 2.4) * 0.05;
      p.armR = [-0.75 + k, 0.4];
      p.armL = [-0.75 - k, -0.4];
      p.head = [0.22, 0.25 + Math.sin(t * 1.1) * 0.06];
      p.roll = Math.sin(t * 1.6) * 0.03;
      p.tail = Math.sin(t * 2) * 0.12;
      p.bob = 0;
      break;
    }
    case 'carry': {
      // несёт перед собой и радостно подпрыгивает (кисти — на боках коробки, см. ниже)
      p.armR = armTo(BOX_GRIP);
      p.armL = mirror(p.armR);
      p.head = [-0.12, Math.sin(t * 1.4) * 0.1];
      p.tail = Math.sin(t * 14) * 0.6;
      p.bob = Math.abs(Math.sin(t * 3.2)) * 0.06;
      break;
    }
    case 'cheer': {
      // обе лапы вверх-вперёд перед ушами, прыгает
      const k = Math.sin(t * 7) * 0.08;
      p.armR = RAISED(-2.2 + k, 0.47);
      p.armL = mirror(RAISED(-2.2 - k, 0.47));
      p.head = [-0.15, 0];
      p.tail = Math.sin(t * 16) * 0.6;
      p.bob = Math.abs(Math.sin(t * 4)) * 0.12;
      break;
    }
    case 'walk': {
      const s = Math.sin(t * 6);
      p.legL = s * 0.5;
      p.legR = -s * 0.5;
      p.armL = [-s * 0.4, -0.05];
      p.armR = [s * 0.4, 0.05];
      p.roll = s * 0.04;
      p.tail = Math.sin(t * 12) * 0.5;
      p.bob = Math.abs(s) * 0.05;
      break;
    }
    case 'reach': {
      // тянется правой лапой вверх-вперёд к полке, на цыпочках, смотрит вверх
      const k = Math.sin(t * 3) * 0.05;
      p.armR = RAISED(-2.3 + k, 0.5);
      p.armL = [-0.2, -0.08];
      p.head = [-0.35, 0];
      p.lean = -0.04;
      p.bob = 0.05 + Math.abs(Math.sin(t * 3)) * 0.03;
      p.tail = Math.sin(t * 6) * 0.3;
      break;
    }
    case 'kneel': {
      // сидит на полу у нижней полки: ноги вперёд, лапы тянутся вперёд, голова чуть вниз
      const k = Math.sin(t * 2.5) * 0.08;
      p.legL = p.legR = -1.45;
      p.armR = [-1.25 + k, 0.04];
      p.armL = [-1.25 - k, -0.04];
      p.head = [0.18, Math.sin(t * 1.2) * 0.1];
      p.lean = 0.08;
      p.bob = -0.4;
      break;
    }
    case 'push': {
      // толкает тележку: лапы на ручке, шагает, наклонился вперёд
      const s = Math.sin(t * 5);
      p.legL = s * 0.4;
      p.legR = -s * 0.4;
      p.armL = p.armR = [ARMS_ON_CART, 0];
      p.lean = 0.1;
      p.bob = Math.abs(s) * 0.03;
      p.tail = Math.sin(t * 10) * 0.4;
      break;
    }
    case 'impatient': {
      // нетерпеливо ждёт: лапы чуть назад и в стороны (сложить их на груди без локтя нельзя), притопывает, качает головой
      p.armR = [0.2, 0.18];
      p.armL = [0.2, -0.18];
      p.head = [-0.05, Math.sin(t * 2.2) * 0.2];
      p.legR = Math.max(0, Math.sin(t * 7)) * -0.25;
      p.tail = Math.sin(t * 2) * 0.15;
      p.bob = 0;
      break;
    }
    case 'squeeze': {
      // протискивается боком: лапы прижаты, тело наклонено, мелкие шажки
      const s = Math.sin(t * 8);
      p.armR = [-0.15, -0.02];
      p.armL = [-0.15, 0.02];
      p.legL = s * 0.2;
      p.legR = -s * 0.2;
      p.roll = 0.09;
      p.head = [0, 0.5];
      p.bob = Math.abs(s) * 0.02;
      break;
    }
    case 'think': {
      // правая лапа вперёд под мордой (ниже головы — без локтя выше не поднять, не задев голову), левая опущена; голова набок
      p.armR = armTo([0.36, 0.98, 0.72]);
      p.armL = [0.05, -0.05];
      p.head = [0.05, 0.2 + Math.sin(t * 0.7) * 0.05];
      p.tail = Math.sin(t * 1.5) * 0.15;
      p.bob = 0;
      break;
    }
    case 'tired': {
      // сутулится: наклон вперёд, голова вниз, лапы висят вдоль тела, тяжело дышит
      p.lean = 0.14;
      p.head = [0.32, 0];
      p.armR = [0.05, 0.04];
      p.armL = [0.05, -0.04];
      p.roll = Math.sin(t * 1.4) * 0.03;
      p.tail = 0;
      p.bob = -Math.abs(Math.sin(t * 1.4)) * 0.03;
      break;
    }
    case 'point': {
      // показывает правой лапой вперёд, смотрит туда же
      p.armR = [-1.55 + Math.sin(t * 3) * 0.05, 0.08];
      p.armL = [-0.1, -0.04];
      p.head = [-0.05, 0.2];
      p.tail = Math.sin(t * 8) * 0.4;
      break;
    }
    case 'compare': {
      // держит по штуке в каждой лапе перед собой и переводит взгляд с одной на другую
      p.armR = armTo(TWO_GRIP);
      p.armL = mirror(p.armR);
      p.head = [0.15, Math.sin(t * 1.5) * 0.35];
      p.tail = Math.sin(t * 2) * 0.15;
      break;
    }
  }
  // предмет в лапах сильнее позы: коробку держат обе кисти по бокам, два товара — обе перед собой,
  // одну штуку — правая (если правая не занята: машет, тянется, показывает)
  const breath = Math.sin(t * 2) * 0.02;
  if (hold === 'box' || hold === 'productBox') {
    p.armR = armTo(BOX_GRIP);
    p.armL = mirror(p.armR);
  } else if (hold === 'twoProducts') {
    p.armR = armTo(TWO_GRIP);
    p.armL = mirror(p.armR);
  } else if (hold === 'product' && !['call', 'cheer', 'reach', 'point'].includes(pose)) {
    p.armR = armTo(ONE_GRIP);
  }
  if (hold === 'box' || hold === 'productBox' || hold === 'twoProducts') {
    p.armR = [p.armR[0] + breath, p.armR[1]];
    p.armL = [p.armL[0] + breath, p.armL[1]];
  }
  return p;
}

/**
 * Эмоция: брови, рот, капля пота — бруски в координатах головы (точка поворота — шея, как в models/Dog.ts).
 * Морда спереди на z ≈ 0,53, глаза на y 0,38–0,49 (передняя грань глаз — z 0,38); бруски чуть выступают, чтобы грани не совпадали.
 */
export function faceParts(mood: VignetteMood): VoxelPart[] {
  const out: VoxelPart[] = [];
  const brow = (x: number, y: number, rotZ: number, h = 0.04) =>
    out.push({ pos: [x, y, 0.39], size: [0.15, h, 0.03], color: VIGNETTE.brow, rot: [0, 0, rotZ] });
  const mouth = (x: number, y: number, w: number, h: number) =>
    out.push({ pos: [x, y, 0.549], size: [w, h, 0.02], color: VIGNETTE.mouth });
  switch (mood) {
    case 'call':
      // брови домиком: внутренние концы выше
      brow(-0.18, 0.56, 0.3);
      brow(0.18, 0.56, -0.3);
      mouth(0, 0.095, 0.1, 0.03);
      break;
    case 'oops':
      brow(-0.18, 0.565, 0.42);
      brow(0.18, 0.565, -0.42);
      mouth(0, 0.1, 0.08, 0.07); // «о»
      out.push({ pos: [0.5, 0.68, 0.16], size: [0.07, 0.11, 0.06], color: VIGNETTE.sweat });
      break;
    case 'happy':
      // брови подняты и ровные, широкая улыбка с поднятыми уголками
      brow(-0.18, 0.58, 0);
      brow(0.18, 0.58, 0);
      mouth(0, 0.1, 0.18, 0.04);
      mouth(-0.1, 0.125, 0.04, 0.04);
      mouth(0.1, 0.125, 0.04, 0.04);
      break;
    case 'think':
      // одна бровь поднята, рот сдвинут в сторону
      brow(-0.18, 0.6, 0.12);
      brow(0.18, 0.54, -0.05);
      mouth(0.06, 0.1, 0.08, 0.03);
      break;
    case 'tired':
      // тяжёлые «веки»: широкие брови опущены на верх глаз; рот ровный
      brow(-0.18, 0.47, 0, 0.06);
      brow(0.18, 0.47, 0, 0.06);
      mouth(0, 0.095, 0.12, 0.025);
      out.push({ pos: [-0.5, 0.6, 0.12], size: [0.07, 0.11, 0.06], color: VIGNETTE.sweat });
      break;
    case 'angry':
      // брови «галочкой»: внутренние концы ниже; уголки рта вниз
      brow(-0.18, 0.55, -0.38);
      brow(0.18, 0.55, 0.38);
      mouth(0, 0.11, 0.14, 0.035);
      mouth(-0.075, 0.085, 0.04, 0.04);
      mouth(0.075, 0.085, 0.04, 0.04);
      break;
  }
  return out;
}

/** Сдвинуть и повернуть бруски модели вокруг вертикали (поворот прибавляется к rot[1], порядок YXZ — см. VoxelPart). */
export function placed(parts: VoxelPart[], at: [number, number, number], turn = 0): VoxelPart[] {
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

/** Чужой товар для полок «занято чужим» и «вперемешку»: чипсы, а если товар задания сам чипсы — печенье. */
function otherLook(look: ProductLook | null): ProductLook {
  const chips = PRODUCTS.chips.look;
  return look && look.color === chips.color ? PRODUCTS.cookies.look : chips;
}

/** Картонная коробка; `open` — без крышки, внутри видно тёмное дно; `dented` — вмятина и трещина. Низ на y = 0. */
export function boxParts(open: boolean, dented = false): VoxelPart[] {
  const out: VoxelPart[] = [{ pos: [0, 0.18, 0], size: [0.5, 0.36, 0.4], color: PALETTE.box }];
  if (open) out.push({ pos: [0, 0.365, 0], size: [0.42, 0.02, 0.32], color: PALETTE.boxDark });
  else out.push({ pos: [0, 0.365, 0], size: [0.52, 0.02, 0.1], color: PALETTE.boxTape });
  if (dented) {
    // вмятина — тёмный косой скол на углу и трещина на лицевой стороне
    out.push({ pos: [0.18, 0.3, 0.17], size: [0.18, 0.14, 0.1], color: PALETTE.boxDark, rot: [0.3, 0.4, 0.2] });
    out.push({ pos: [-0.06, 0.2, 0.205], size: [0.02, 0.2, 0.012], color: VIGNETTE.brow, rot: [0, 0, 0.5] });
    out.push({ pos: [0.02, 0.12, 0.205], size: [0.02, 0.12, 0.012], color: VIGNETTE.brow, rot: [0, 0, -0.4] });
  }
  return out;
}

/** Товар на одной полке стеллажа по способу заполнения. `y` — верх доски, x — от −0,6 до 0,6. */
function shelfGoods(fill: ShelfFill, look: ProductLook | null, y: number): VoxelPart[] {
  const out: VoxelPart[] = [];
  const xs = [-0.6, -0.2, 0.2, 0.6];
  const put = (l: ProductLook, x: number, z = 0.12, turn = 0) => out.push(...placed(productPiece(l), [x, y, z], turn));
  const mine = look ?? otherLook(null);
  switch (fill) {
    case 'empty':
      break;
    case 'product':
      for (const x of xs) put(mine, x);
      break;
    case 'gap':
      for (const x of xs) if (Math.abs(x) > 0.3) put(mine, x);
      break;
    case 'other':
      for (const x of xs) put(otherLook(look), x);
      break;
    case 'deep':
      // товар задания у задней стенки, перед ним три коробки
      for (const x of xs) put(mine, x, -0.25);
      for (const x of [-0.5, 0, 0.5]) out.push(...placed(boxParts(false), [x, y, 0.2]));
      break;
    case 'messy':
      xs.forEach((x, i) => put(i % 2 ? otherLook(look) : mine, x + (i % 2 ? 0.04 : -0.03), 0.12, (i - 1.5) * 0.35));
      break;
  }
  return out;
}

/** Зона брака: штриховка на полу, низкое ограждение с трёх сторон, красный контейнер; `full` — горка коробок. Центр — (0, 0, 0). */
function scrapZoneParts(full: boolean): VoxelPart[] {
  const out: VoxelPart[] = [];
  const W = 1.8, D = 1.4;
  out.push({ pos: [0, 0.005, 0], size: [W, 0.01, D], color: PALETTE.scrapFloor });
  for (let i = 0; i < 7; i++) {
    out.push({ pos: [-W / 2 + 0.15 + i * 0.25, 0.008, 0], size: [0.07, 0.012, D * 1.1], color: PALETTE.scrapRed, rot: [0, 0.6, 0] });
  }
  // ограждение: столбики и две перекладины — сзади и по бокам
  const post = (x: number, z: number) => out.push({ pos: [x, 0.35, z], size: [0.07, 0.7, 0.07], color: PALETTE.fence });
  for (const x of [-W / 2, 0, W / 2]) post(x, -D / 2);
  post(-W / 2, 0);
  post(W / 2, 0);
  for (const y of [0.3, 0.62]) {
    out.push({ pos: [0, y, -D / 2], size: [W + 0.05, 0.05, 0.05], color: PALETTE.fence });
    for (const x of [-W / 2, W / 2]) out.push({ pos: [x, y, -D / 4], size: [0.05, 0.05, D / 2 + 0.05], color: PALETTE.fence });
  }
  // контейнер: красный ящик с тёмным бортом
  out.push({ pos: [0.35, 0.28, -0.25], size: [0.7, 0.56, 0.5], color: PALETTE.scrapRed });
  out.push({ pos: [0.35, 0.57, -0.25], size: [0.74, 0.04, 0.54], color: PALETTE.fence });
  if (full) {
    // коробки повсюду: на контейнере, рядом и одна на боку
    const boxes: [number, number, number, number][] = [
      [0.35, 0.59, -0.25, 0.1], [-0.4, 0, -0.3, -0.2], [-0.4, 0.36, -0.3, 0.15], [-0.45, 0, 0.25, 0.4], [0.3, 0.95, -0.25, -0.3], [0.5, 0, 0.35, 0.7],
    ];
    for (const [x, y, z, turn] of boxes) out.push(...placed(boxParts(false), [x, y, z], turn));
  }
  return out;
}

/** Дверь клиента: тёмная рама, приоткрытая светлая створка, коврик. Проём смотрит на +z, центр низа — (0, 0, 0). */
function doorParts(): VoxelPart[] {
  const out: VoxelPart[] = [];
  const H = 2.0, W = 1.0;
  for (const x of [-W / 2 - 0.06, W / 2 + 0.06]) out.push({ pos: [x, H / 2, 0], size: [0.12, H, 0.2], color: PALETTE.doorFrame });
  out.push({ pos: [0, H + 0.06, 0], size: [W + 0.24, 0.12, 0.2], color: PALETTE.doorFrame });
  out.push({ pos: [0, H / 2, -0.12], size: [W, H, 0.02], color: VIGNETTE.brow });                       // тёмный проём
  out.push({ pos: [-W / 2 + 0.15, H / 2, 0.38], size: [0.05, H - 0.04, 0.8], color: PALETTE.doorLeaf, rot: [0, 0.35, 0] }); // створка
  out.push({ pos: [0, 0.01, 0.45], size: [0.9, 0.02, 0.5], color: PALETTE.doorMat });
  return out;
}

/** Телефон клиента с реакцией: доволен — улыбка, недоволен — нахмурен и «одна звезда». Центр — (0, 0, 0), экран на +z. */
function phoneParts(reaction: 'good' | 'bad'): VoxelPart[] {
  const out: VoxelPart[] = [];
  const good = reaction === 'good';
  const ink = good ? PALETTE.iconOk : PALETTE.iconBad;
  out.push({ pos: [0, 0, 0], size: [0.5, 0.86, 0.07], color: PALETTE.phone });
  out.push({ pos: [0, 0.01, 0.04], size: [0.42, 0.72, 0.02], color: good ? PALETTE.phoneGood : PALETTE.phoneBad });
  const z = 0.06;
  // глаза
  for (const x of [-0.08, 0.08]) out.push({ pos: [x, 0.1, z], size: [0.06, 0.07, 0.02], color: PALETTE.iconInk });
  if (good) {
    out.push({ pos: [0, -0.07, z], size: [0.18, 0.04, 0.02], color: ink });
    for (const x of [-0.1, 0.1]) out.push({ pos: [x, -0.04, z], size: [0.04, 0.05, 0.02], color: ink });
    // сердечко сверху: два наклонных квадрата
    for (const x of [-0.035, 0.035]) out.push({ pos: [x, 0.25, z], size: [0.07, 0.07, 0.02], color: ink, rot: [0, 0, x > 0 ? -0.78 : 0.78] });
  } else {
    out.push({ pos: [0, -0.06, z], size: [0.18, 0.04, 0.02], color: ink });
    for (const x of [-0.1, 0.1]) out.push({ pos: [x, -0.09, z], size: [0.04, 0.05, 0.02], color: ink });
    for (const x of [-0.08, 0.08]) out.push({ pos: [x, 0.17, z], size: [0.08, 0.02, 0.02], color: PALETTE.iconInk, rot: [0, 0, x < 0 ? -0.4 : 0.4] });
    // одна звезда из пяти: жёлтая и четыре серые точки
    out.push({ pos: [-0.14, 0.27, z], size: [0.06, 0.06, 0.02], color: PALETTE.iconStar, rot: [0, 0, 0.78] });
    for (let i = 1; i < 5; i++) out.push({ pos: [-0.14 + i * 0.07, 0.27, z], size: [0.035, 0.035, 0.02], color: PALETTE.cartFrame });
  }
  return out;
}

/** Значок на белой плашке; центр плашки — (0, 0, 0), символ на +z. */
function iconParts(symbol: VignetteIcon): VoxelPart[] {
  const out: VoxelPart[] = [{ pos: [0, 0, 0], size: [0.5, 0.5, 0.05], color: PALETTE.iconBadge }];
  const z = 0.035;
  const bar = (x: number, y: number, w: number, h: number, color: string, rotZ = 0) =>
    out.push({ pos: [x, y, z], size: [w, h, 0.03], color, rot: rotZ ? [0, 0, rotZ] : undefined });
  switch (symbol) {
    case 'clock':
      // циферблат-восьмиугольник из двух повёрнутых квадратов, стрелки
      bar(0, 0, 0.36, 0.36, PALETTE.iconInk);
      bar(0, 0, 0.36, 0.36, PALETTE.iconInk, Math.PI / 4);
      out.push({ pos: [0, 0, z + 0.012], size: [0.28, 0.28, 0.02], color: PALETTE.iconBadge });
      out.push({ pos: [0, 0, z + 0.012], size: [0.28, 0.28, 0.02], color: PALETTE.iconBadge, rot: [0, 0, Math.PI / 4] });
      out.push({ pos: [0, 0.05, z + 0.025], size: [0.035, 0.12, 0.02], color: PALETTE.iconInk });
      out.push({ pos: [0.04, 0, z + 0.025], size: [0.1, 0.035, 0.02], color: PALETTE.iconInk });
      break;
    case 'question':
      bar(0, 0.1, 0.18, 0.05, PALETTE.iconInk);
      bar(0.08, 0.05, 0.05, 0.1, PALETTE.iconInk);
      bar(0.03, -0.01, 0.1, 0.05, PALETTE.iconInk);
      bar(0, -0.06, 0.05, 0.07, PALETTE.iconInk);
      bar(0, -0.15, 0.06, 0.06, PALETTE.iconInk);
      break;
    case 'exclaim':
      bar(0, 0.04, 0.07, 0.22, PALETTE.iconBad);
      bar(0, -0.15, 0.07, 0.07, PALETTE.iconBad);
      break;
    case 'check':
      bar(-0.07, -0.03, 0.06, 0.16, PALETTE.iconOk, 0.7);
      bar(0.05, 0.02, 0.06, 0.3, PALETTE.iconOk, -0.6);
      break;
    case 'cross':
      bar(0, 0, 0.06, 0.32, PALETTE.iconBad, 0.78);
      bar(0, 0, 0.06, 0.32, PALETTE.iconBad, -0.78);
      break;
    case 'star':
      bar(0, 0, 0.24, 0.24, PALETTE.iconStar);
      bar(0, 0, 0.24, 0.24, PALETTE.iconStar, Math.PI / 4);
      break;
  }
  return out;
}

/**
 * Бруски реквизита, который рисуется брусками. Грузовик, пакет и другие персонажи — отдельными компонентами (Vignette.tsx).
 * Товар, коробка, телефон и значок — в своих координатах (группу ставит Vignette.tsx); остальное — уже на месте.
 */
export function propParts(prop: VignetteProp, look: ProductLook | null): VoxelPart[] {
  switch (prop.kind) {
    case 'rack': {
      const shelves = 3;
      const out = rackParts(2, shelves);
      const top = (s: number) => shelfY(s, shelves) + RACK_BOARD / 2;
      for (const x of [-0.55, 0, 0.55]) out.push(...placed(boxParts(false), [x, top(1), 0.05]));
      out.push(...shelfGoods(prop.mid ?? 'product', look, top(2)));
      out.push(...shelfGoods(prop.top ?? 'product', look, top(3)));
      return placed(out, prop.at, prop.turn);
    }
    case 'ladder':
      return placed(ladderParts(), prop.at, prop.turn);
    case 'cart': {
      const out = cartParts();
      if (prop.full && look) for (const x of [-0.18, 0.18]) out.push(...placed(productPiece(look, 0.26), [x, 0.66, 0.05]));
      return placed(out, prop.at, prop.turn);
    }
    case 'pallet':
      return placed(palletParts(prop.boxes), prop.at, prop.turn);
    case 'table':
      return placed(packingTableParts(2), prop.at, prop.turn);
    case 'scrapZone':
      return placed(scrapZoneParts(prop.full ?? false), prop.at, prop.turn);
    case 'door':
      return placed(doorParts(), prop.at, prop.turn);
    case 'product':
      return look ? productPiece(look, prop.size) : [];
    case 'box':
      return boxParts(prop.open ?? false, prop.dented ?? false);
    case 'phone':
      return phoneParts(prop.reaction);
    case 'icon':
      return iconParts(prop.symbol);
    case 'truck':
    case 'bag':
    case 'npc':
      return [];
  }
}

/** Реквизит, который стоит ровно и рисуется одним пакетом брусков (остальное — своими группами). */
export const STILL_PROPS: VignetteProp['kind'][] = ['rack', 'ladder', 'cart', 'pallet', 'table', 'scrapZone', 'door'];
