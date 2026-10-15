// Много одинаковых кубиков за один вызов отрисовки (instancing, встроен в Three.js; 08, раздел 11).
// Кубики группируются по цвету: один InstancedMesh на цвет. Бруски могут стоять под наклоном (VoxelPart.rot).
import { useLayoutEffect, useMemo, useRef } from 'react';
import { Euler, Matrix4, Quaternion, Vector3, type InstancedMesh } from 'three';
import type { VoxelPart } from './models/ProductItem';
import { textureForColor } from './textures';

function ColorBatch({ color, parts }: { color: string; parts: VoxelPart[] }) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new Matrix4();
    const q = new Quaternion();
    const e = new Euler();
    parts.forEach((p, i) => {
      if (p.rot) q.setFromEuler(e.set(p.rot[0], p.rot[1], p.rot[2], 'YXZ'));
      else q.identity();
      m.compose(new Vector3(...p.pos), q, new Vector3(...p.size));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [parts]);
  return (
    // key по числу кубиков: при изменении количества InstancedMesh создаётся заново
    <instancedMesh key={parts.length} ref={ref} args={[undefined, undefined, parts.length]} frustumCulled={false} castShadow receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      {/* дерево и картон — с рисованным узором (W4), остальное — ровным цветом */}
      <meshStandardMaterial color={color} map={textureForColor(color)} />
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
