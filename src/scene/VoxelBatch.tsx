// Много одинаковых кубиков за один вызов отрисовки (instancing, встроен в Three.js; 08, раздел 11).
// Кубики группируются по цвету: один InstancedMesh на цвет.
import { useLayoutEffect, useMemo, useRef } from 'react';
import { Matrix4, Quaternion, Vector3, type InstancedMesh } from 'three';
import type { VoxelPart } from './models/ProductItem';

function ColorBatch({ color, parts }: { color: string; parts: VoxelPart[] }) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new Matrix4();
    const q = new Quaternion();
    parts.forEach((p, i) => {
      m.compose(new Vector3(...p.pos), q, new Vector3(...p.size));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [parts]);
  return (
    // key по числу кубиков: при изменении количества InstancedMesh создаётся заново
    <instancedMesh key={parts.length} ref={ref} args={[undefined, undefined, parts.length]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={color} />
    </instancedMesh>
  );
}

export default function VoxelBatch({ parts }: { parts: VoxelPart[] }) {
  const byColor = useMemo(() => {
    const map = new Map<string, VoxelPart[]>();
    for (const p of parts) {
      const list = map.get(p.color);
      if (list) list.push(p);
      else map.set(p.color, [p]);
    }
    return [...map.entries()];
  }, [parts]);
  return (
    <group>
      {byColor.map(([color, list]) => <ColorBatch key={color} color={color} parts={list} />)}
    </group>
  );
}
