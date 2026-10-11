// Склад: пол, зоны, стены, стеллажи. Только отрисовка карты, никаких решений (09, раздел 9).
import type { WallOpening, WallSide, WarehouseMap } from '../model/warehouse';
import type { Stock } from '../model/stock';
import { WAREHOUSE_VIEW } from '../config/warehouse';
import { PALETTE } from '../config/palette';
import { cellToWorld } from '../rules/warehouse';
import Rack from './models/Rack';
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

export default function Warehouse({ map, stock }: Props) {
  const { floorThickness: ft } = WAREHOUSE_VIEW;

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

      {map.racks.map((r) => {
        // Центр стеллажа — середина его клеток; длинная сторона вдоль оси аллеи.
        const pts = r.cells.map(cellToWorld);
        const cx = pts.reduce((sum, p) => sum + p[0], 0) / pts.length;
        const cz = pts.reduce((sum, p) => sum + p[2], 0) / pts.length;
        return (
          <Rack
            key={`${r.aisle}.${r.rack}`}
            position={[cx, 0, cz]}
            rotationY={r.axis === 'z' ? Math.PI / 2 : 0}
            length={r.cells.length}
            shelves={r.shelves}
          />
        );
      })}

      <ShelfGoods map={map} stock={stock} />
    </group>
  );
}
