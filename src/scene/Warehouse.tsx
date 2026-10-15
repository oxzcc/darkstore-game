// Склад: пол, зоны, стены, стеллажи. Только отрисовка карты, никаких решений (09, раздел 9).
import { useMemo } from 'react';
import type { WallOpening, WallSide, WarehouseMap } from '../model/warehouse';
import type { Stock } from '../model/stock';
import { WAREHOUSE_VIEW } from '../config/warehouse';
import { PALETTE } from '../config/palette';
import { rackParts } from './models/Rack';
import type { VoxelPart } from './models/ProductItem';
import { rackLocalToWorld } from './rackGeometry';
import VoxelBatch from './VoxelBatch';
import FloorMarkings from './FloorMarkings';
import ShelfGoods from './ShelfGoods';

type Props = { map: WarehouseMap; stock: Stock };

// Дальние от камеры стены высокие, ближние — низкие, чтобы не закрывать склад (как на ui_01).
const FAR_SIDES: WallSide[] = ['north', 'west'];
const PILLAR_STEP = 3; // модуль стены 3 м, на стыках зелёные пилястры (08, раздел 2)

/** Делит стену длиной `length` на куски между проёмами. */
function wallSegments(length: number, openings: WallOpening[]): [number, number][] {
  const gaps = [...openings].sort((a, b) => a.from - b.from);
  const segments: [number, number][] = [];
  let start = 0;
  for (const g of gaps) {
    if (g.from > start) segments.push([start, g.from]);
    start = Math.max(start, g.to + 1);
  }
  if (start < length) segments.push([start, length]);
  return segments;
}

function Wall({ side, map }: { side: WallSide; map: WarehouseMap }) {
  const { wallThickness: t, wallHeight, frontWallHeight } = WAREHOUSE_VIEW;
  const far = FAR_SIDES.includes(side);
  const h = far ? wallHeight : frontWallHeight;
  const alongX = side === 'north' || side === 'south';
  const length = alongX ? map.width : map.depth;
  // Координата стены поперёк: снаружи от пола.
  const across =
    side === 'north' ? -t / 2 : side === 'west' ? -t / 2 : side === 'south' ? map.depth + t / 2 : map.width + t / 2;
  const openings = map.openings.filter((o) => o.side === side);
  const segments = wallSegments(length, openings);

  // Пилястры только на высоких стенах и не внутри проёмов.
  const pillars: number[] = [];
  if (far) {
    for (let p = 0; p <= length; p += PILLAR_STEP) {
      if (!openings.some((o) => p > o.from && p < o.to + 1)) pillars.push(p);
    }
  }

  const place = (along: number, y: number): [number, number, number] =>
    alongX ? [along, y, across] : [across, y, along];

  return (
    <group>
      {segments.map(([a, b]) => (
        <mesh key={`w${a}`} position={place((a + b) / 2, h / 2)}>
          <boxGeometry args={alongX ? [b - a, h, t] : [t, h, b - a]} />
          <meshStandardMaterial color={PALETTE.wall} />
        </mesh>
      ))}
      {pillars.map((p) => (
        <mesh key={`p${p}`} position={place(p, h / 2)}>
          <boxGeometry args={[t * 1.6, h + 0.02, t * 1.6]} />
          <meshStandardMaterial color={PALETTE.wallPillar} />
        </mesh>
      ))}
    </group>
  );
}

/** Кубики всех стеллажей в координатах сцены — один пакет на весь склад (instancing, 08, раздел 11). */
function allRackParts(map: WarehouseMap): VoxelPart[] {
  const out: VoxelPart[] = [];
  const cache = new Map<string, VoxelPart[]>(); // одинаковые стеллажи считаем один раз
  for (const r of map.racks) {
    const key = `${r.cells.length}x${r.shelves}`;
    let local = cache.get(key);
    if (!local) {
      local = rackParts(r.cells.length, r.shelves);
      cache.set(key, local);
    }
    const across = r.axis === 'z'; // стеллаж повёрнут на 90°: размеры по x и z меняются местами
    for (const p of local) {
      out.push({
        pos: rackLocalToWorld(r, p.pos),
        size: across ? [p.size[2], p.size[1], p.size[0]] : p.size,
        color: p.color,
      });
    }
  }
  return out;
}

export default function Warehouse({ map, stock }: Props) {
  const { floorThickness: ft } = WAREHOUSE_VIEW;
  const racks = useMemo(() => allRackParts(map), [map]);

  return (
    <group>
      {/* Трава вокруг склада */}
      <mesh position={[map.width / 2, -ft - 0.01, map.depth / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[map.width * 4, map.depth * 4]} />
        <meshStandardMaterial color={PALETTE.grass} />
      </mesh>

      {/* Пол склада */}
      <mesh position={[map.width / 2, -ft / 2, map.depth / 2]}>
        <boxGeometry args={[map.width, ft, map.depth]} />
        <meshStandardMaterial color={PALETTE.floor} />
      </mesh>

      <FloorMarkings map={map} />

      {(['north', 'south', 'west', 'east'] as WallSide[]).map((side) => (
        <Wall key={side} side={side} map={map} />
      ))}

      <VoxelBatch parts={racks} />

      <ShelfGoods map={map} stock={stock} />
    </group>
  );
}
