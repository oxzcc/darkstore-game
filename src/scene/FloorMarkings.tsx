// Разметка пола (08, раздел 6): швы плитки, заливка зон, пунктирные рамки,
// штриховка брака и жёлтые линии главных проходов. Только отрисовка карты.
import { useMemo } from 'react';
import type { Passage, WarehouseMap, Zone } from '../model/warehouse';
import { FLOOR_MARKINGS } from '../config/warehouse';
import { PALETTE, PASSAGE_LINE_COLOR, ZONE_LOOK } from '../config/palette';

type Props = { map: WarehouseMap };

// Высоты слоёв над полом, чтобы слои не мерцали друг сквозь друга.
const Y_FILL = 0.004;
const Y_GRID = 0.009;
const Y_MARK = 0.014;
const MARK_THICK = 0.004;

type Strip = { pos: [number, number, number]; size: [number, number, number]; rotY?: number };

/** Пунктирная линия от a до b вдоль одной оси. */
function dashes(a: number, b: number, fixed: number, alongX: boolean): Strip[] {
  const { dash, gap, lineWidth } = FLOOR_MARKINGS;
  const out: Strip[] = [];
  for (let s = a; s < b; s += dash + gap) {
    const len = Math.min(dash, b - s);
    const mid = s + len / 2;
    out.push(
      alongX
        ? { pos: [mid, Y_MARK, fixed], size: [len, MARK_THICK, lineWidth] }
        : { pos: [fixed, Y_MARK, mid], size: [lineWidth, MARK_THICK, len] },
    );
  }
  return out;
}

/** Пунктирная рамка по периметру зоны, с отступом внутрь. */
function dashedFrame(z: Zone): Strip[] {
  const i = FLOOR_MARKINGS.inset;
  const x0 = z.from.x + i, x1 = z.to.x + 1 - i;
  const z0 = z.from.z + i, z1 = z.to.z + 1 - i;
  return [
    ...dashes(x0, x1, z0, true),
    ...dashes(x0, x1, z1, true),
    ...dashes(z0, z1, x0, false),
    ...dashes(z0, z1, x1, false),
  ];
}

/** Штриховка брака: частые полосы вдоль x. В изометрии они идут наискосок, параллельно стене (как на ui_01). */
function hatch(z: Zone): Strip[] {
  const { hatchStep, inset, lineWidth } = FLOOR_MARKINGS;
  const x0 = z.from.x + inset, x1 = z.to.x + 1 - inset;
  const out: Strip[] = [];
  for (let zz = z.from.z + hatchStep / 2; zz < z.to.z + 1; zz += hatchStep) {
    out.push({ pos: [(x0 + x1) / 2, Y_MARK, zz], size: [x1 - x0, MARK_THICK, lineWidth] });
  }
  return out;
}

/** Две жёлтые сплошные линии по краям полосы главного прохода. */
function passageLines(p: Passage): Strip[] {
  const w = FLOOR_MARKINGS.lineWidth;
  const alongX = p.from.z === p.to.z;
  if (alongX) {
    const len = p.to.x - p.from.x + 1;
    const cx = p.from.x + len / 2;
    return [
      { pos: [cx, Y_MARK, p.from.z + w], size: [len, MARK_THICK, w] },
      { pos: [cx, Y_MARK, p.to.z + 1 - w], size: [len, MARK_THICK, w] },
    ];
  }
  const len = p.to.z - p.from.z + 1;
  const cz = p.from.z + len / 2;
  return [
    { pos: [p.from.x + w, Y_MARK, cz], size: [w, MARK_THICK, len] },
    { pos: [p.to.x + 1 - w, Y_MARK, cz], size: [w, MARK_THICK, len] },
  ];
}

/** Швы плитки: тонкие линии по границам клеток. */
function GridLines({ map }: Props) {
  const positions = useMemo(() => {
    const pts: number[] = [];
    for (let x = 0; x <= map.width; x++) pts.push(x, Y_GRID, 0, x, Y_GRID, map.depth);
    for (let z = 0; z <= map.depth; z++) pts.push(0, Y_GRID, z, map.width, Y_GRID, z);
    return new Float32Array(pts);
  }, [map]);

  return (
    <lineSegments>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color={PALETTE.floorGrid} />
    </lineSegments>
  );
}

function Strips({ strips, color }: { strips: Strip[]; color: string }) {
  return (
    <>
      {strips.map((s, i) => (
        <mesh key={i} position={s.pos} rotation={[0, s.rotY ?? 0, 0]}>
          <boxGeometry args={s.size} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
    </>
  );
}

export default function FloorMarkings({ map }: Props) {
  return (
    <group>
      {map.zones.map((z) => {
        const look = ZONE_LOOK[z.type];
        const w = z.to.x - z.from.x + 1;
        const d = z.to.z - z.from.z + 1;
        return (
          <group key={z.type}>
            {look.fill && (
              <mesh position={[z.from.x + w / 2, Y_FILL, z.from.z + d / 2]}>
                <boxGeometry args={[w, 0.008, d]} />
                <meshStandardMaterial color={look.fill} />
              </mesh>
            )}
            {look.outline === 'dashed' && <Strips strips={dashedFrame(z)} color={look.markColor} />}
            {look.hatch && <Strips strips={hatch(z)} color={look.markColor} />}
          </group>
        );
      })}

      <GridLines map={map} />

      {map.passages.map((p, i) => (
        <Strips key={i} strips={passageLines(p)} color={PASSAGE_LINE_COLOR} />
      ))}
    </group>
  );
}
