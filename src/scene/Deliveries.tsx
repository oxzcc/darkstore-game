// Поставки на сцене (M7b): грузовик у ворот приёмки, пока поставку не приняли, и паллеты в зоне приёмки.
// Только отрисовка: что приехало и где стоит паллета, решают rules (rules/deliveries.ts).
import { useMemo } from 'react';
import type { WarehouseMap } from '../model/warehouse';
import { WAREHOUSE_VIEW } from '../config/warehouse';
import { useGameStore } from '../store/gameStore';
import { palletsOnFloor, trucksAtGate } from '../store/selectors';
import { cellToWorld } from '../rules/warehouse';
import { truckParts } from './models/Truck';
import { palletParts } from './models/Pallet';
import type { VoxelPart } from './models/ProductItem';
import VoxelBatch from './VoxelBatch';

const TRUCK = truckParts(); // модель не меняется — считаем один раз

/** Бруски грузовика, повёрнутые вокруг вертикали на `turn` и поставленные в точку `at`. */
function placedTruck(at: [number, number, number], turn: number): VoxelPart[] {
  const c = Math.cos(turn), s = Math.sin(turn);
  return TRUCK.map((p) => {
    const [x, y, z] = p.pos;
    const [rx, ry, rz] = p.rot ?? [0, 0, 0];
    return { ...p, pos: [at[0] + x * c + z * s, at[1] + y, at[2] - x * s + z * c], rot: [rx, ry + turn, rz] };
  });
}

const QTY_PER_BOX = 6; // сколько штук товара «в одной коробке» — только для вида стопки

/** Где встаёт грузовик: напротив середины ворот, снаружи южной стены. */
function truckPlace(map: WarehouseMap): [number, number, number] | null {
  const gate = map.openings.find((o) => o.kind === 'gate');
  if (!gate) return null;
  const s = WAREHOUSE_VIEW.cellSize;
  const mid = ((gate.from + gate.to + 1) / 2) * s;
  const out = WAREHOUSE_VIEW.wallThickness + WAREHOUSE_VIEW.truck.gap;
  switch (gate.side) {
    case 'south': return [mid, 0, map.depth * s + out];
    case 'north': return [mid, 0, -out];
    case 'west': return [-out, 0, mid];
    case 'east': return [map.width * s + out, 0, mid];
  }
}

/** Поворот, чтобы грузовик стоял задом к воротам (модель смотрит кабиной по +z). */
const SIDE_ROTATION = { south: 0, north: Math.PI, east: Math.PI / 2, west: -Math.PI / 2 };

export default function Deliveries({ map }: { map: WarehouseMap }) {
  const deliveries = useGameStore((s) => s.game.deliveries);
  const pallets = useGameStore((s) => s.game.pallets);
  const trucks = trucksAtGate(deliveries);

  // все паллеты на полу — один пакет брусков (instancing)
  const palletVoxels = useMemo(() => {
    const out: VoxelPart[] = [];
    for (const p of palletsOnFloor(pallets)) {
      const qty = p.items.reduce((sum, it) => sum + it.qty, 0);
      const [cx, , cz] = cellToWorld(p.cell);
      for (const part of palletParts(Math.ceil(qty / QTY_PER_BOX))) {
        out.push({ ...part, pos: [part.pos[0] + cx, part.pos[1], part.pos[2] + cz] });
      }
    }
    return out;
  }, [pallets]);

  // место у ворот не меняется — грузовик собираем один раз на карту
  const truckVoxels = useMemo(() => {
    const place = truckPlace(map);
    const gate = map.openings.find((o) => o.kind === 'gate');
    const rotationY = (gate ? SIDE_ROTATION[gate.side] : 0) + WAREHOUSE_VIEW.truck.rotationY;
    return place ? placedTruck(place, rotationY) : [];
  }, [map]);

  return (
    <group>
      {trucks.length > 0 && <VoxelBatch parts={truckVoxels} />}
      <VoxelBatch parts={palletVoxels} />
    </group>
  );
}
