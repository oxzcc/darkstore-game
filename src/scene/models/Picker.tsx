// Сборщик на сцене (W7): собака как в концепт-рендере (модель — Dog.ts), кольцо под ногами
// в цвете сборщика (08, раздел 3.2: цвет сборщика только у кольца и маршрута) и тележка на сборке и выкладке.
// Части тела — отдельные группы со своей точкой поворота; позу по игровому времени ставит dogPose (W7b).
import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, type Group } from 'three';
import type { DogLook } from '../../config/pickers';
import { WAREHOUSE_VIEW } from '../../config/warehouse';
import VoxelBatch from '../VoxelBatch';
import { dogRig, type DogPartName, type DogRig } from './Dog';
import { dogPose, type DogAction } from '../dogAnim';
import { useGameStore } from '../../store/gameStore';
import { cartParts } from './Cart';

type Props = {
  position: [number, number, number];
  facing: number;   // поворот вокруг вертикали, радианы
  hop: number;      // подскок при ходьбе, метры (как в Crossy Road, 08, раздел 9)
  look: DogLook;
  ringColor: string;
  /** Тележка (сборка и выкладка, решение автора 16.10): где стоит и куда повёрнута, в координатах склада; null — без тележки. */
  cart: { pos: [number, number, number]; facing: number } | null;
  action: DogAction;  // что делает — для анимации (W7b, dogAnim.ts)
  walkPhase: number;  // фаза шага от пройденного пути
  phase: number;      // сдвиг фазы у этого сборщика
};

/** Кольцо под ногами — как в концепт-рендере: плоская квадратная рамка светлого оттенка цвета сборщика, без теней. */
function Ring({ color }: { color: string }) {
  const light = useMemo(() => {
    const c = new Color(color);
    const hsl = { h: 0, s: 0, l: 0 };
    c.getHSL(hsl);
    return new Color().setHSL(hsl.h, Math.min(1, hsl.s * 0.95), hsl.l + (1 - hsl.l) * 0.1);
  }, [color]);
  return (
    <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
      <ringGeometry args={[0.5, 0.64, 4, 1]} />
      <meshBasicMaterial color={light} />
    </mesh>
  );
}

const CART = cartParts();
const rigCache = new Map<DogLook, DogRig>();
const rigFor = (look: DogLook) => {
  let r = rigCache.get(look);
  if (!r) rigCache.set(look, (r = dogRig(look)));
  return r;
};

const PARTS: DogPartName[] = ['body', 'head', 'legL', 'legR', 'armL', 'armR', 'tail'];

export default function Picker({ position, facing, hop, look, ringColor, cart, action, walkPhase, phase }: Props) {
  const rig = useMemo(() => rigFor(look), [look]);
  const s = WAREHOUSE_VIEW.picker.scale;
  const root = useRef<Group>(null);   // вся фигурка: место на складе (плавно догоняет, если сдвиг большой)
  const lift = useRef<Group>(null);   // подскок и посадка
  const parts = useRef<Partial<Record<DogPartName, Group>>>({});
  const [start] = useState(() => position);
  const live = useRef({ action, walkPhase, cart: cart !== null, hop, position });
  live.current = { action, walkPhase, cart: cart !== null, hop, position };

  // Каждый кадр: поза по игровому времени, части тела плавно догоняют её (W7b). На паузе время стоит — поза тоже.
  useFrame((_, delta) => {
    const a = WAREHOUSE_VIEW.pickerAnim;
    const k = 1 - Math.exp(-Math.min(delta, 0.1) * a.catchUp);
    const { action: act, walkPhase: wp, cart: c, hop: h, position: target } = live.current;
    const t = useGameStore.getState().game.clock.time;
    const pose = dogPose(act, t, wp, c, phase);
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
      const y = h - pose.drop;
      lift.current.position.y += (y - lift.current.position.y) * k;
    }
    // место: обычный шаг — сразу, большой скачок (появилась или убрана тележка) — плавно
    const r = root.current;
    if (r) {
      const dx = target[0] - r.position.x, dz = target[2] - r.position.z;
      if (Math.hypot(dx, dz) > a.jumpOver) {
        r.position.x += dx * k;
        r.position.z += dz * k;
      } else {
        r.position.set(target[0], target[1], target[2]);
      }
    }
  });

  return (
    <group>
      {/* тележка катится по полу — без подскока; где она стоит, считает pickerPose */}
      {cart && (
        <group position={cart.pos} rotation={[0, cart.facing, 0]} scale={s}>
          <VoxelBatch parts={CART} soft="strong" />
        </group>
      )}
      {/* место ставит useFrame (чтобы большой скачок шёл плавно); здесь — только начальное */}
      <group ref={root} position={start}>
        <Ring color={ringColor} />
        <group rotation={[0, facing, 0]} scale={s}>
          <group ref={lift}>
            {PARTS.map((name) => (
              <group key={name} ref={(el) => { if (el) parts.current[name] = el; }} position={rig[name].pivot}>
                <VoxelBatch parts={rig[name].parts} soft="strong" />
              </group>
            ))}
          </group>
        </group>
      </group>
    </group>
  );
}
