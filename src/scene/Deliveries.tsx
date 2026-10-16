// Поставки на сцене (M7b): грузовик у ворот приёмки, пока поставку не приняли, и паллеты в зоне приёмки.
// Только отрисовка: что приехало и где стоит паллета, решают rules (rules/deliveries.ts).
// W8b: грузовик подъезжает и уезжает по дороге (путь — scene/truckDrive.ts). Подъезд — пока в правилах «грузовик едет»
// (GameState.truckComing, DELIVERY.driveInSeconds): поставка, паллеты и «Приёмка» появляются, когда он встал.
// Отъезд правила не запоминают (поставка просто перестаёт ждать у ворот), поэтому момент отъезда сцена отмечает сама.
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import type { WarehouseMap } from '../model/warehouse';
import { WAREHOUSE_VIEW } from '../config/warehouse';
import { DELIVERY } from '../config/balance';
import { useGameStore } from '../store/gameStore';
import { palletsOnFloor, trucksAtGate } from '../store/selectors';
import { cellToWorld } from '../rules/warehouse';
import Truck from './models/Truck';
import { palletBoxes, palletParts } from './models/Pallet';
import type { VoxelPart } from './models/ProductItem';
import VoxelBatch from './VoxelBatch';
import { arrivalPose, arrivalSeconds, departurePose, departureSeconds } from './truckDrive';

const now = () => useGameStore.getState().game.clock.time;

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

/** Едущий грузовик: подъезд (от момента, когда выехал) или отъезд (от момента, когда перестал ждать у ворот). */
function DrivingTruck({ kind, parked, from }: { kind: 'in' | 'out'; parked: [number, number]; from: number }) {
  const g = useRef<Group>(null);
  useFrame(() => {
    const el = g.current;
    if (!el) return;
    const s = Math.max(0, now() - from);
    // подъезд растянут или сжат ровно под DELIVERY.driveInSeconds: встаёт у ворот в тот момент, когда правила создают поставку
    const inScale = DELIVERY.driveInSeconds > 0 ? arrivalSeconds(parked) / DELIVERY.driveInSeconds : 1;
    const pose = kind === 'in' ? arrivalPose(parked, s * inScale) : departurePose(parked, s);
    el.visible = pose !== null;
    if (!pose) return;
    el.position.set(...pose.pos);
    el.rotation.y = pose.yaw;
  });
  return (
    <group ref={g} visible={false}>
      <Truck position={[0, 0, 0]} rotationY={0} />
    </group>
  );
}

export default function Deliveries({ map }: { map: WarehouseMap }) {
  const deliveries = useGameStore((s) => s.game.deliveries);
  const pallets = useGameStore((s) => s.game.pallets);
  const coming = useGameStore((s) => s.game.truckComing ?? null);
  // раз в секунду игрового времени — чтобы убрать уехавший грузовик
  useGameStore((s) => Math.floor(s.game.clock.time));
  const trucks = trucksAtGate(deliveries);

  const place = truckPlace(map);
  const gate = map.openings.find((o) => o.kind === 'gate');
  const rotationY = (gate ? SIDE_ROTATION[gate.side] : 0) + WAREHOUSE_VIEW.truck.rotationY;
  // ехать умеем к воротам на южной стене (как сейчас); иначе — как раньше, стоит у ворот
  const parked: [number, number] | null = place && gate?.side === 'south' && WAREHOUSE_VIEW.truck.rotationY === 0 ? [place[0], place[2]] : null;

  // отъезды: грузовик был у ворот, а теперь нет — запоминаем, когда это заметили (на паузе время стоит, поэтому это и есть момент отъезда)
  const atGateBefore = useRef<Set<string>>(new Set());
  const leaving = useRef<Map<string, number>>(new Map());
  const t = now();
  const ids = new Set(trucks.map((d) => d.id));
  for (const id of atGateBefore.current) if (!ids.has(id) && !leaving.current.has(id)) leaving.current.set(id, t);
  atGateBefore.current = ids;
  if (parked) {
    const outSec = departureSeconds(parked);
    for (const [id, at] of leaving.current) if (t < at || t > at + outSec + 1) leaving.current.delete(id); // уехал или время пошло заново (новая смена)
  } else leaving.current.clear();

  // все паллеты на полу — один пакет брусков (instancing)
  const palletVoxels = useMemo(() => {
    const out: VoxelPart[] = [];
    for (const p of palletsOnFloor(pallets)) {
      const qty = p.items.reduce((sum, it) => sum + it.qty, 0);
      const [cx, , cz] = cellToWorld(p.cell);
      for (const part of palletParts(palletBoxes(qty))) {
        out.push({ ...part, pos: [part.pos[0] + cx, part.pos[1], part.pos[2] + cz] });
      }
    }
    return out;
  }, [pallets]);

  return (
    <group>
      {/* у ворот — стоит; едет к воротам — подъезд (поставки ещё нет); ворота не на юге — просто стоит, как раньше */}
      {place && trucks.length > 0 && <Truck position={place} rotationY={rotationY} />}
      {parked && coming !== null && <DrivingTruck key={`in${coming}`} kind="in" parked={parked} from={coming} />}
      {parked && [...leaving.current].map(([id, at]) => <DrivingTruck key={`out${id}`} kind="out" parked={parked} from={at} />)}
      <VoxelBatch parts={palletVoxels} />
    </group>
  );
}
