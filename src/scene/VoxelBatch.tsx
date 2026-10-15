// Много одинаковых кубиков за один вызов отрисовки (instancing, встроен в Three.js; 08, раздел 11).
// «Мягкие кубы» (W6; 08, раздел 0): крупные бруски — со скруглёнными рёбрами (RoundedBoxGeometry, встроен в three.js),
// мелкие детали (прорези, швы, тонкие планки) — острые. Острые группируются по цвету: один кубик 1 × 1 × 1, растянутый
// под каждый брусок. У скруглённых растягивать нельзя (скругление вытянется в овал), поэтому они группируются
// по цвету и размеру (с шагом WAREHOUSE_VIEW.softCubes.sizeStep) — одна геометрия ровно нужного размера на группу.
// Бруски могут стоять под наклоном (VoxelPart.rot).
import { useLayoutEffect, useMemo, useRef } from 'react';
import { BoxGeometry, Euler, Matrix4, Quaternion, Vector3, type BufferGeometry, type InstancedMesh } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { VoxelPart } from './models/ProductItem';
import { WAREHOUSE_VIEW } from '../config/warehouse';
import { textureForColor } from './textures';

const SOFT = WAREHOUSE_VIEW.softCubes;
const UNIT = new BoxGeometry(1, 1, 1);
const ONE = new Vector3(1, 1, 1);

/** Радиус скругления бруска такого размера (W6): доля короткой стороны, но не больше предела. */
/** Насколько скруглять: «strong» — стены, стеллажи, столы; «light» — мелкие предметы (08, раздел 0; WAREHOUSE_VIEW.softCubes). */
export type Softness = 'strong' | 'light';
export const softRadius = (size: [number, number, number], soft: Softness) =>
  Math.min(Math.min(...size) * SOFT[soft].radiusShare, SOFT[soft].maxRadius);

/** Скруглённые геометрии нужных размеров — общие для всех пакетов. */
const roundedCache = new Map<string, BufferGeometry>();
function roundedGeometry(size: [number, number, number], soft: Softness): BufferGeometry {
  const key = `${soft}|${size.join('x')}`;
  let g = roundedCache.get(key);
  if (!g) {
    g = new RoundedBoxGeometry(size[0], size[1], size[2], SOFT.segments, softRadius(size, soft));
    roundedCache.set(key, g);
  }
  return g;
}

const isSoft = (p: VoxelPart, soft: Softness) => Math.min(...p.size) >= SOFT[soft].minSize;
const step = (v: number) => Math.max(SOFT.sizeStep, Math.round(v / SOFT.sizeStep) * SOFT.sizeStep);

type Group = { key: string; color: string; parts: VoxelPart[]; geometry: BufferGeometry; stretch: boolean };

function Batch({ group }: { group: Group }) {
  const ref = useRef<InstancedMesh>(null);
  const { parts, stretch } = group;
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new Matrix4();
    const q = new Quaternion();
    const e = new Euler();
    parts.forEach((p, i) => {
      if (p.rot) q.setFromEuler(e.set(p.rot[0], p.rot[1], p.rot[2], 'YXZ'));
      else q.identity();
      m.compose(new Vector3(...p.pos), q, stretch ? new Vector3(...p.size) : ONE);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [parts, stretch]);
  return (
    // key по числу кубиков: при изменении количества InstancedMesh создаётся заново
    <instancedMesh key={parts.length} ref={ref} args={[group.geometry, undefined, parts.length]} frustumCulled={false} castShadow receiveShadow>
      {/* дерево и картон — с рисованным узором (W4), остальное — ровным цветом */}
      <meshStandardMaterial color={group.color} map={textureForColor(group.color)} />
    </instancedMesh>
  );
}

export default function VoxelBatch({ parts, soft = 'light' }: { parts: VoxelPart[]; soft?: Softness }) {
  const groups = useMemo(() => {
    const map = new Map<string, Group>();
    for (const p of parts) {
      let key: string, size: [number, number, number] | null = null;
      if (isSoft(p, soft)) {
        size = [step(p.size[0]), step(p.size[1]), step(p.size[2])];
        key = `${p.color}|${size.join('x')}`;
      } else {
        key = `${p.color}|sharp`;
      }
      let g = map.get(key);
      if (!g) {
        g = size
          ? { key, color: p.color, parts: [], geometry: roundedGeometry(size, soft), stretch: false }
          : { key, color: p.color, parts: [], geometry: UNIT, stretch: true };
        map.set(key, g);
      }
      g.parts.push(p);
    }
    return [...map.values()];
  }, [parts, soft]);
  return (
    <group>
      {groups.map((g) => <Batch key={g.key} group={g} />)}
    </group>
  );
}
