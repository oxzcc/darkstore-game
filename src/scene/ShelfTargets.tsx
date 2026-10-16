// Подсветка нужной полки (W7b; 08, раздел 6: «нужная полка подсвечивается цветом сборщика, который туда идёт»; решение автора 16.10 —
// в цвете сборщика, а не красным, как на рендере). Пульсирующая полоса по лицевой кромке полки, пока сборщик идёт к ней или работает у неё.
// Какая полка — считает selectors.pickerShelfTargets; пульс — по игровому времени (на паузе замирает).
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { MeshBasicMaterial } from 'three';
import type { WarehouseMap } from '../model/warehouse';
import { WAREHOUSE_VIEW } from '../config/warehouse';
import { useGameStore } from '../store/gameStore';
import { pickerShelfTargets } from '../store/selectors';
import { RACK_BOARD, rackFrontSign, rackLocalToWorld, rackRotY, rackWidth, shelfY } from './rackGeometry';

const PULSE_SPEED = 4;   // как на рендере: прозрачность 0,5 ± 0,3
const BAR = { height: 0.07, depth: 0.08 };

function Glow({ position, rotY, width, color }: { position: [number, number, number]; rotY: number; width: number; color: string }) {
  const mat = useRef<MeshBasicMaterial>(null);
  useFrame(() => {
    const t = useGameStore.getState().game.clock.time;
    if (mat.current) mat.current.opacity = 0.5 + Math.sin(t * PULSE_SPEED) * 0.3;
  });
  return (
    <mesh position={position} rotation={[0, rotY, 0]}>
      <boxGeometry args={[width, BAR.height, BAR.depth]} />
      <meshBasicMaterial ref={mat} color={color} transparent opacity={0.8} depthWrite={false} />
    </mesh>
  );
}

export default function ShelfTargets({ map }: { map: WarehouseMap }) {
  const pickers = useGameStore((s) => s.game.pickers);
  const tasks = useGameStore((s) => s.game.tasks);
  const targets = useMemo(() => pickerShelfTargets(pickers, tasks), [pickers, tasks]);
  return (
    <group>
      {targets.map((tg) => {
        const rack = map.racks.find((r) => r.aisle === tg.address.aisle && r.rack === tg.address.rack);
        if (!rack) return null;
        const y = shelfY(tg.address.shelf, rack.shelves) + RACK_BOARD / 2 + BAR.height / 2;
        const z = rackFrontSign(rack) * (WAREHOUSE_VIEW.rackDepth / 2 + BAR.depth / 2);
        return (
          <Glow
            key={tg.pickerId}
            position={rackLocalToWorld(rack, [0, y, z])}
            rotY={rackRotY(rack)}
            width={rackWidth(rack.cells.length)}
            color={tg.color}
          />
        );
      })}
    </group>
  );
}
