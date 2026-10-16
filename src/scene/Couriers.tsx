// Пакеты заказов на столах и курьеры (W8a; 08, раздел 0). Только отображение: расписание — scene/couriers.ts,
// данные — закрытые заказы смены (selectors.packedOrders) и игровое время. На паузе всё замирает вместе с миром.
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, type Group } from 'three';
import type { WarehouseMap } from '../model/warehouse';
import type { DogLook } from '../config/pickers';
import { DECOR } from '../config/decor';
import { WAREHOUSE_VIEW } from '../config/warehouse';
import { useGameStore } from '../store/gameStore';
import { packedOrders } from '../store/selectors';
import VoxelBatch from './VoxelBatch';
import OrderBag from './models/OrderBag';
import { bikeParts } from './models/Bike';
import { dogRig, type DogPartName, type DogRig } from './models/Dog';
import { dogPose, phaseOffset } from './dogAnim';
import { bagOnTable, courierAt, planCouriers, type CourierPlan } from './couriers';

const BIKE = bikeParts();
const PARTS: DogPartName[] = ['body', 'head', 'legL', 'legR', 'armL', 'armR', 'tail'];
const rigs = new Map<DogLook, DogRig>();
const rigFor = (look: DogLook) => {
  let r = rigs.get(look);
  if (!r) rigs.set(look, (r = dogRig(look, 'courier')));
  return r;
};
const TMP = new Vector3();
const now = () => useGameStore.getState().game.clock.time;

/** Пакеты одного заказа на столе: появляются, «впрыгнув», исчезают, когда курьер берёт. */
function TableBags({ plan }: { plan: CourierPlan }) {
  const refs = useRef<(Group | null)[]>([]);
  useFrame(() => {
    const k = bagOnTable(plan, now());
    refs.current.forEach((g) => {
      if (!g) return;
      g.visible = k > 0;
      g.scale.setScalar(Math.max(0.001, k));
    });
  });
  return (
    <>
      {plan.bags.map((b, i) => (
        <group key={i} ref={(el) => { refs.current[i] = el; }} position={b.pos} visible={false}>
          <OrderBag look={b.look} rotationY={b.slot % 2 ? 0.12 : -0.08} />
        </group>
      ))}
    </>
  );
}

/** Курьер-собака и его велосипед. */
function Courier({ plan }: { plan: CourierPlan }) {
  const rig = rigFor(plan.look);
  const phase = useMemo(() => phaseOffset(plan.taskId), [plan.taskId]);
  const root = useRef<Group>(null);   // место и поворот собаки
  const lift = useRef<Group>(null);   // подскок
  const bike = useRef<Group>(null);
  const hands = useRef<Group>(null);  // пакеты в лапах
  const parts = useRef<Partial<Record<DogPartName, Group>>>({});
  const placed = useRef(false);

  useFrame((_, delta) => {
    const t = now();
    const f = courierAt(plan, t);
    const r = root.current, b = bike.current;
    if (!r || !b) return;
    r.visible = b.visible = f !== null;
    if (!f) { placed.current = false; return; }
    const k = 1 - Math.exp(-Math.min(delta, 0.1) * WAREHOUSE_VIEW.pickerAnim.catchUp);

    // велосипед
    b.position.set(...f.bike.pos);
    b.rotation.y = f.bike.heading - Math.PI / 2; // модель вытянута вдоль x, руль — к +x

    // собака: верхом — на седле, иначе — по своему месту; большой скачок (слез, сел) — плавно
    const d = f.dog;
    const fx = Math.sin(d.heading), fz = Math.cos(d.heading);
    const target: [number, number, number] = d.action === 'ride'
      ? [d.pos[0] - fx * 0.05, d.pos[1] + 0.43, d.pos[2] - fz * 0.05]
      : d.pos;
    const jump = Math.hypot(target[0] - r.position.x, target[1] - r.position.y, target[2] - r.position.z);
    if (!placed.current || jump < 0.3) r.position.set(...target);
    else r.position.lerp(TMP.set(...target), k);
    let turn = d.heading - r.rotation.y;
    while (turn > Math.PI) turn -= Math.PI * 2;
    while (turn < -Math.PI) turn += Math.PI * 2;
    r.rotation.y = placed.current ? r.rotation.y + turn * Math.min(1, k * 2) : d.heading;
    placed.current = true;

    // поза: идёт и стоит — как сборщики (dogAnim), верхом — ноги вперёд, лапы на руле; у стола — тянется к пакету
    const walkPhase = d.walked * Math.PI * 2;
    const pose = dogPose(d.action === 'walk' ? 'walk' : 'idle', t, walkPhase, false, phase);
    if (d.action === 'ride') {
      pose.legL = pose.legR = -1.15;
      pose.armL = pose.armR = [-1.05, 0];
      pose.head = [0, 0];
      pose.bob = 0;
    } else if (d.action === 'take') {
      const s = Math.sin((t + phase) * 6);
      pose.armL = [-1.2 + s * 0.1, 0];
      pose.armR = [-1.2 - s * 0.1, 0];
      pose.head = [0.25, 0];
    }
    if (d.carrying && d.action !== 'take') {
      pose.armL = [-1.0, 0];
      pose.armR = [-1.0, 0];
    }
    const g = parts.current;
    const to = (obj: Group | undefined, x: number, y = 0, z = 0) => {
      if (!obj) return;
      obj.rotation.x += (x - obj.rotation.x) * k;
      obj.rotation.y += (y - obj.rotation.y) * k;
      obj.rotation.z += (z - obj.rotation.z) * k;
    };
    to(g.legL, pose.legL);
    to(g.legR, pose.legR);
    to(g.armL, pose.armL[0], 0, pose.armL[1]);
    to(g.armR, pose.armR[0], 0, pose.armR[1]);
    to(g.head, pose.head[0], pose.head[1]);
    to(g.tail, 0, pose.tail);
    to(g.body, 0, 0, pose.roll);
    if (lift.current) {
      const hop = d.action === 'walk' ? Math.abs(Math.sin(walkPhase)) * 0.06 : 0;
      lift.current.position.y = hop + pose.bob;
    }
    if (hands.current) hands.current.visible = d.carrying;
  });

  const two = plan.bags.length > 1;
  return (
    <>
      <group ref={bike} visible={false}>
        <VoxelBatch parts={BIKE} />
      </group>
      <group ref={root} visible={false}>
        <group ref={lift}>
          {PARTS.map((name) => (
            <group key={name} ref={(el) => { if (el) parts.current[name] = el; }} position={rig[name].pivot}>
              <VoxelBatch parts={rig[name].parts} soft="strong" />
            </group>
          ))}
          {/* пакеты в вытянутых вперёд лапах */}
          <group ref={hands} position={[0, 0.32, 0.5]} visible={false}>
            {plan.bags.map((b, i) => (
              <OrderBag key={i} look={b.look} position={[two ? (i ? 0.17 : -0.17) : 0, 0, 0]} scale={two ? 0.8 : 0.95} />
            ))}
          </group>
        </group>
      </group>
    </>
  );
}

export default function Couriers({ map }: { map: WarehouseMap }) {
  const shiftLog = useGameStore((s) => s.game.shiftLog);
  // перерисовка 4 раза в секунду игрового времени — чтобы вовремя добавлять и убирать курьеров; движение — в useFrame
  const tick = useGameStore((s) => Math.floor(s.game.clock.time * 4));
  const plans = useMemo(() => planCouriers(packedOrders(useGameStore.getState().game), map), [shiftLog, map]);
  const t = tick / 4;
  const live = plans.filter((p) => t >= p.at - 0.5 && t < p.tEnd + 0.5);
  const riders = live.filter((p) => t >= p.tStart - 0.5).slice(-DECOR.couriers.maxShown);
  return (
    <group>
      {live.map((p) => <TableBags key={`b${p.taskId}`} plan={p} />)}
      {riders.map((p) => <Courier key={`c${p.taskId}`} plan={p} />)}
    </group>
  );
}
