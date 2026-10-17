// Задник сценок итога (правка автора 17.10: «стены и наполнение сзади»). Только отображение.
// hall — стена склада как в игре (сэндвич-панель с градиентом PALETTE.wallBottom → wallTop, рёбра, цоколь, лента окон),
//        перед ней стеллажи с товаром, коробки, паллета и жёлтая линия прохода;
// dock — та же стена с проёмом ворот (сквозь него виден грузовик поставки), бетон снаружи, жёлтый пунктир зоны приёмки;
// home — у клиента: тёплая стена дома с панелью снизу, окном, картиной и растением, деревянный пол.
import { useMemo } from 'react';
import { BoxGeometry, BufferAttribute, Color, type BufferGeometry } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { VignetteBackdrop } from '../../config/vignettes';
import { BACKDROP } from '../../config/vignettes';
import { PALETTE } from '../../config/palette';
import { PRODUCTS } from '../../config/products';
import VoxelBatch from '../VoxelBatch';
import type { VoxelPart } from '../models/ProductItem';
import { rackParts } from '../models/Rack';
import { palletParts } from '../models/Pallet';
import { RACK_BOARD, shelfY } from '../rackGeometry';
import { boxParts, placed, productPiece } from './vignetteParts';

const B = BACKDROP;
type Box = { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number };

/** Сэндвич-панель: бруски со скруглёнными рёбрами и вертикальным градиентом цвета (как GradientWall на складе). */
function gradientGeometry(boxes: Box[], height: number): BufferGeometry {
  const bottom = new Color(PALETTE.wallBottom), top = new Color(PALETTE.wallTop), c = new Color();
  const pieces = boxes.map((b) => {
    const w = b.x1 - b.x0, h = b.y1 - b.y0, d = b.z1 - b.z0;
    const g = new RoundedBoxGeometry(w, h, d, 2, Math.min(0.04, Math.min(w, h, d) * 0.45))
      .translate((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2);
    const p = g.attributes.position;
    const colors = new Float32Array(p.count * 3);
    for (let k = 0; k < p.count; k++) {
      c.copy(bottom).lerp(top, Math.min(1, Math.max(0, p.getY(k) / height)));
      colors.set([c.r, c.g, c.b], k * 3);
    }
    g.setAttribute('color', new BufferAttribute(colors, 3));
    return g;
  });
  return mergeGeometries(pieces) ?? new BoxGeometry(0, 0, 0);
}

/** Стена склада вдоль x на z = B.wallZ (передняя грань); `gate` — проём [x0, x1] от пола до B.gateHeight. */
function WarehouseWall({ gate }: { gate: [number, number] | null }) {
  const { geometry, parts } = useMemo(() => {
    const z1 = B.wallZ, z0 = z1 - B.wallThickness, H = B.wallHeight;
    // куски панели вдоль x (с проёмом — слева, справа и перемычка над воротами)
    const spans: [number, number][] = gate ? [[-B.wallHalfWidth, gate[0]], [gate[1], B.wallHalfWidth]] : [[-B.wallHalfWidth, B.wallHalfWidth]];
    const boxes: Box[] = spans.map(([x0, x1]) => ({ x0, x1, y0: B.plinth, y1: H, z0, z1 }));
    if (gate) boxes.push({ x0: gate[0], x1: gate[1], y0: B.gateHeight, y1: H, z0, z1 });
    // рёбра профлиста на лицевой стороне — кроме проёма и ленты окон
    for (let x = -B.wallHalfWidth + 0.2; x < B.wallHalfWidth; x += B.ribStep) {
      if (gate && x > gate[0] - 0.05 && x < gate[1] + 0.05) continue;
      boxes.push({ x0: x - 0.04, x1: x + 0.04, y0: B.plinth, y1: B.windowY0 - 0.02, z0: z1 - 0.01, z1: z1 + 0.05 });
    }
    const out: VoxelPart[] = [];
    // светлый бетонный цоколь (кроме проёма) и серый отлив сверху
    for (const [x0, x1] of spans) {
      out.push({ pos: [(x0 + x1) / 2, B.plinth / 2, z1 - B.wallThickness / 2 + 0.02], size: [x1 - x0, B.plinth, B.wallThickness + 0.04], color: PALETTE.wallPlinth });
    }
    out.push({ pos: [0, H + 0.04, z1 - B.wallThickness / 2], size: [B.wallHalfWidth * 2 + 0.1, 0.08, B.wallThickness + 0.1], color: PALETTE.wallCap });
    // лента окон под крышей: рамы и стёкла кусками по 2,4 м
    for (let x = -B.wallHalfWidth + 1.4; x < B.wallHalfWidth - 1; x += 2.6) {
      if (gate && x + 1.2 > gate[0] && x - 1.2 < gate[1] && B.windowY0 < B.gateHeight) continue;
      out.push({ pos: [x, (B.windowY0 + B.windowY1) / 2, z1 + 0.02], size: [2.3, B.windowY1 - B.windowY0, 0.06], color: PALETTE.windowFrame });
      out.push({ pos: [x, (B.windowY0 + B.windowY1) / 2, z1 + 0.04], size: [2.1, B.windowY1 - B.windowY0 - 0.12, 0.05], color: PALETTE.windowGlass });
    }
    if (gate) {
      // тёмная рама ворот и бетонная площадка снаружи
      for (const x of gate) out.push({ pos: [x, B.gateHeight / 2, z1 - B.wallThickness / 2], size: [0.16, B.gateHeight, B.wallThickness + 0.08], color: PALETTE.doorFrame });
      out.push({ pos: [(gate[0] + gate[1]) / 2, B.gateHeight + 0.08, z1 - B.wallThickness / 2], size: [gate[1] - gate[0] + 0.16, 0.16, B.wallThickness + 0.08], color: PALETTE.doorFrame });
    }
    return { geometry: gradientGeometry(boxes, H), parts: out };
  }, [gate]);
  return (
    <>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial vertexColors />
      </mesh>
      <VoxelBatch parts={parts} soft="strong" />
    </>
  );
}

/** Повторяемый «случайный» выбор: одинаковый при каждой загрузке. */
const pick = <T,>(list: T[], i: number) => list[(i * 7 + 3) % list.length];
const LOOKS = Object.values(PRODUCTS).map((p) => p.look);

/** Стеллаж у стены, заставленный разным товаром (не товаром задания — чтобы не путать с героем сцены). */
function backRack(x: number, seed: number): VoxelPart[] {
  const shelves = 3;
  const out = rackParts(2, shelves);
  const top = (s: number) => shelfY(s, shelves) + RACK_BOARD / 2;
  for (const bx of [-0.55, 0, 0.55]) out.push(...placed(boxParts(false), [bx, top(1), 0.05]));
  for (const s of [2, 3]) {
    [-0.6, -0.2, 0.2, 0.6].forEach((px, i) => {
      if ((seed + s + i) % 5 === 0) return; // кое-где пусто
      out.push(...placed(productPiece(pick(LOOKS, seed * 3 + s * 4 + i)), [px, top(s), 0.12]));
    });
  }
  return placed(out, [x, 0, B.wallZ + 0.6]);
}

/** Стопка коробок у стены. */
function boxStack(x: number, z: number): VoxelPart[] {
  return [
    ...placed(boxParts(false), [x, 0, z], 0.1),
    ...placed(boxParts(false), [x + 0.55, 0, z + 0.05], -0.12),
    ...placed(boxParts(false), [x + 0.25, 0.38, z], 0.2),
  ];
}

function hallParts(dock: boolean): VoxelPart[] {
  const out: VoxelPart[] = [];
  out.push(...backRack(-3.6, 1));
  if (!dock) out.push(...backRack(3.2, 2));
  out.push(...boxStack(dock ? -2.4 : -1.75, B.wallZ + 0.45));
  if (!dock) out.push(...placed(palletParts(5), [1.25, 0, B.wallZ + 0.65], 0.1));
  // разметка пола: сплошная жёлтая линия прохода или пунктир зоны приёмки
  if (dock) {
    // пунктир зоны приёмки: передний край перед собакой и левый край за паллетой
    for (let x = -2.6; x < 1.2; x += 0.5) out.push({ pos: [x, 0.006, 1.1], size: [0.3, 0.012, 0.07], color: B.lineColor });
    for (let z = -1.6; z < 1.0; z += 0.5) out.push({ pos: [-2.75, 0.006, z], size: [0.07, 0.012, 0.3], color: B.lineColor });
  } else {
    out.push({ pos: [0, 0.006, B.wallZ + 1.25], size: [B.wallHalfWidth * 2, 0.012, 0.08], color: B.lineColor });
  }
  return out;
}

/** У клиента: стена дома, панель снизу, окно, картина, растение. Дверь ставит сама сцена (реквизит `door`). */
function homeParts(): VoxelPart[] {
  const z1 = B.wallZ, t = B.wallThickness, H = B.wallHeight, W = B.wallHalfWidth;
  const out: VoxelPart[] = [
    { pos: [0, H / 2, z1 - t / 2], size: [W * 2, H, t], color: B.homeWall },
    { pos: [0, 0.45, z1 + 0.02], size: [W * 2, 0.9, 0.05], color: B.homePanel },        // панель снизу
    { pos: [0, 0.93, z1 + 0.04], size: [W * 2, 0.06, 0.07], color: B.homeTrim },       // планка над панелью
    // окно: рама, стекло, переплёт, подоконник
    { pos: [1.1, 1.75, z1 + 0.03], size: [1.5, 1.2, 0.06], color: B.homeTrim },
    { pos: [1.1, 1.75, z1 + 0.05], size: [1.3, 1.0, 0.05], color: PALETTE.windowGlass },
    { pos: [1.1, 1.75, z1 + 0.07], size: [0.06, 1.0, 0.03], color: B.homeTrim },
    { pos: [1.1, 1.75, z1 + 0.07], size: [1.3, 0.06, 0.03], color: B.homeTrim },
    { pos: [1.1, 1.13, z1 + 0.1], size: [1.7, 0.06, 0.2], color: B.homeTrim },
    // картина
    { pos: [-3.0, 1.75, z1 + 0.03], size: [0.8, 0.6, 0.05], color: PALETTE.clipboard },
    { pos: [-3.0, 1.75, z1 + 0.05], size: [0.66, 0.46, 0.04], color: B.picture },
    // растение в горшке
    { pos: [2.6, 0.22, z1 + 0.45], size: [0.4, 0.44, 0.4], color: B.pot },
    { pos: [2.6, 0.7, z1 + 0.45], size: [0.56, 0.5, 0.56], color: PALETTE.treeMid },
    { pos: [2.55, 1.05, z1 + 0.42], size: [0.38, 0.36, 0.38], color: PALETTE.treeLight },
  ];
  return out;
}

export default function Backdrop({ kind }: { kind: VignetteBackdrop }) {
  const parts = useMemo(() => (kind === 'home' ? homeParts() : hallParts(kind === 'dock')), [kind]);
  return (
    <group>
      {kind !== 'home' && <WarehouseWall gate={kind === 'dock' ? B.gate : null} />}
      {kind === 'dock' && (
        // бетон снаружи ворот (чуть выше пола, чтобы не мерцал)
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, B.wallZ - 8]} receiveShadow>
          <planeGeometry args={[30, 16]} />
          <meshStandardMaterial color={PALETTE.concrete} />
        </mesh>
      )}
      <VoxelBatch parts={parts} soft="strong" />
    </group>
  );
}
