// Фон (W8c; 08, раздел 0): машины по дороге, ветер в деревьях, птицы, бабочки. Только декорация:
// где кто находится, считают чистые функции времени (scene/life.ts), числа — DECOR.life. Время — игровое: на паузе всё стоит.
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import type { WarehouseMap } from '../model/warehouse';
import { DECOR } from '../config/decor';
import { useGameStore } from '../store/gameStore';
import VoxelBatch, { setWindTime } from './VoxelBatch';
import { carParts } from './models/Car';
import { birdsAt, butterfliesAt, carsAt } from './life';

const now = () => useGameStore.getState().game.clock.time;

/** Каждый кадр отдаёт деревьям игровое время — по нему качаются кроны. */
function WindClock() {
  useFrame(() => setWindTime(now()));
  return null;
}

const carCache = new Map<string, ReturnType<typeof carParts>>();
const carOf = (color: string) => {
  let c = carCache.get(color);
  if (!c) carCache.set(color, (c = carParts(color)));
  return c;
};

/** Одна машина: место берёт из расписания каждый кадр. */
function Car({ id, color }: { id: string; color: string }) {
  const g = useRef<Group>(null);
  useFrame(() => {
    const el = g.current;
    if (!el) return;
    const car = carsAt(now()).find((c) => c.id === id);
    el.visible = !!car;
    if (!car) return;
    el.position.set(...car.pos);
    el.rotation.y = car.yaw - Math.PI / 2; // модель смотрит носом на +x
  });
  return (
    <group ref={g} visible={false}>
      <VoxelBatch parts={carOf(color)} />
    </group>
  );
}

function Traffic() {
  // 4 раза в секунду — добавить выехавшие машины и убрать уехавшие (они в это время за краем экрана)
  const tick = useGameStore((s) => Math.floor(s.game.clock.time * 4));
  const cars = carsAt(tick / 4 + 0.25);
  const prev = carsAt(tick / 4);
  const all = new Map([...prev, ...cars].map((c) => [c.id, c.color]));
  return <>{[...all].map(([id, color]) => <Car key={id} id={id} color={color} />)}</>;
}

const MAX_BIRDS = DECOR.life.birds.count[1];
const BIRD = '#3A3F4A';

/** Стая птиц: клин высоко над складом, крылья машут. */
function Birds({ center }: { center: [number, number] }) {
  const birds = useRef<(Group | null)[]>([]);
  const wings = useRef<(Group | null)[][]>([]);
  useFrame(() => {
    const list = birdsAt(now(), center);
    for (let i = 0; i < MAX_BIRDS; i++) {
      const g = birds.current[i];
      if (!g) continue;
      const b = list[i];
      g.visible = !!b;
      if (!b) continue;
      g.position.set(...b.pos);
      g.rotation.y = b.yaw;
      const [l, r] = wings.current[i] ?? [];
      if (l) l.rotation.z = b.flap * 0.6;
      if (r) r.rotation.z = -b.flap * 0.6;
    }
  });
  return (
    <>
      {Array.from({ length: MAX_BIRDS }, (_, i) => (
        <group key={i} ref={(el) => { birds.current[i] = el; }} visible={false}>
          <mesh castShadow>
            <boxGeometry args={[0.18, 0.12, 0.42]} />
            <meshStandardMaterial color={BIRD} />
          </mesh>
          {[-1, 1].map((s, k) => (
            <group key={s} position={[s * 0.09, 0.03, 0]} ref={(el) => { (wings.current[i] ??= [])[k] = el; }}>
              <mesh position={[s * 0.24, 0, 0]} castShadow>
                <boxGeometry args={[0.48, 0.025, 0.2]} />
                <meshStandardMaterial color={BIRD} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
    </>
  );
}

/** Бабочки у травы возле склада. */
function Butterflies() {
  const list = DECOR.life.butterflies;
  const bodies = useRef<(Group | null)[]>([]);
  const wings = useRef<(Group | null)[][]>([]);
  useFrame(() => {
    butterfliesAt(now()).forEach((b, i) => {
      const g = bodies.current[i];
      if (!g) return;
      g.position.set(...b.pos);
      g.rotation.y = b.yaw;
      const [l, r] = wings.current[i] ?? [];
      if (l) l.rotation.z = 0.2 + b.flap * 1.0;
      if (r) r.rotation.z = -0.2 - b.flap * 1.0;
    });
  });
  return (
    <>
      {list.map((b, i) => (
        <group key={i} ref={(el) => { bodies.current[i] = el; }}>
          <mesh>
            <boxGeometry args={[0.03, 0.03, 0.12]} />
            <meshStandardMaterial color="#3A2E2A" />
          </mesh>
          {[-1, 1].map((s, k) => (
            <group key={s} ref={(el) => { (wings.current[i] ??= [])[k] = el; }}>
              <mesh position={[s * 0.07, 0, 0]}>
                <boxGeometry args={[0.13, 0.008, 0.12]} />
                <meshStandardMaterial color={b.color} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
    </>
  );
}

export default function Life({ map }: { map: WarehouseMap }) {
  const center = useMemo<[number, number]>(() => [map.width / 2, map.depth / 2], [map]);
  return (
    <group>
      <WindClock />
      <Traffic />
      <Birds center={center} />
      <Butterflies />
    </group>
  );
}
