// Сборщик на сцене (W7): собака как в концепт-рендере (модель — Dog.ts), кольцо под ногами
// в цвете сборщика (08, раздел 3.2: цвет сборщика только у кольца и маршрута) и тележка на сборке и выкладке.
// Части тела — отдельные группы со своей точкой поворота; позу по игровому времени ставит dogPose (W7b).
import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { CanvasTexture, Color, type Group, type Mesh, type MeshLambertMaterial, type Sprite, type SpriteMaterial } from 'three';
import type { DogLook } from '../../config/pickers';
import { WAREHOUSE_VIEW } from '../../config/warehouse';
import { PALETTE } from '../../config/palette';
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
  moving: boolean;    // идёт (тележка дребезжит и пылит)
  action: DogAction;  // что делает — для анимации (W7b, dogAnim.ts)
  walkPhase: number;  // фаза шага от пройденного пути
  phase: number;      // сдвиг фазы у этого сборщика
  /** Приёмка: верх паллеты, куда летят коробки (W7b); null — не бросает. */
  throwTarget: [number, number, number] | null;
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
const DUST_COUNT = 10;

/** «z z» над спящим — как на рендере: белые буквы с тёмной обводкой, шрифт игры. Одна текстура на всех. */
let snoreTexture: CanvasTexture | null = null;
function snoreTex(): CanvasTexture {
  if (snoreTexture) return snoreTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d')!;
  x.lineWidth = 14;
  x.strokeStyle = '#3a342a';
  x.fillStyle = '#fff9ec';
  x.font = '700 96px "X5 Sans", sans-serif';
  x.strokeText('z', 256 * 0.3, 256 * 0.75);
  x.fillText('z', 256 * 0.3, 256 * 0.75);
  x.font = '700 64px "X5 Sans", sans-serif';
  x.strokeText('z', 256 * 0.68, 256 * 0.38);
  x.fillText('z', 256 * 0.68, 256 * 0.38);
  snoreTexture = new CanvasTexture(c);
  return snoreTexture;
}

export default function Picker({ position, facing, hop, look, ringColor, cart, moving, action, walkPhase, phase, throwTarget }: Props) {
  const rig = useMemo(() => rigFor(look), [look]);
  const s = WAREHOUSE_VIEW.picker.scale;
  const root = useRef<Group>(null);   // вся фигурка: место на складе (плавно догоняет, если сдвиг большой)
  const lift = useRef<Group>(null);   // подскок, посадка, наклон, дыхание
  const parts = useRef<Partial<Record<DogPartName, Group>>>({});
  const tsd = useRef<Group>(null);    // ТСД в правой лапе
  const box = useRef<Group>(null);    // коробка в броске (приёмка)
  const cartRef = useRef<Group>(null);
  const snore = useRef<Sprite>(null);
  const dust = useRef<(Mesh | null)[]>([]);
  const dustLife = useRef<number[]>(Array(DUST_COUNT).fill(0));
  const dustState = useRef({ lastT: -1, timer: 0, next: 0 });
  const [start] = useState(() => position);
  const face = useRef<Group>(null);       // поворот собаки
  const cartPlace = useRef<Group>(null);  // место и поворот тележки
  const live = useRef({ action, walkPhase, cart, moving, hop, position, facing, throwTarget });
  live.current = { action, walkPhase, cart, moving, hop, position, facing, throwTarget };

  // Каждый кадр: поза по игровому времени, части тела плавно догоняют её (W7b). На паузе время стоит — поза тоже.
  useFrame((_, delta) => {
    const a = WAREHOUSE_VIEW.pickerAnim;
    const k = 1 - Math.exp(-Math.min(delta, 0.1) * a.catchUp);
    const { action: act, walkPhase: wp, cart: c, moving: mv, hop: h, position: target, throwTarget: tgt } = live.current;
    const t = useGameStore.getState().game.clock.time;
    const ds = dustState.current;
    const gameDt = ds.lastT < 0 ? 0 : Math.max(0, Math.min(0.2, t - ds.lastT));
    ds.lastT = t;
    const tt = t + phase;
    const pose = dogPose(act, t, wp, c !== null, phase);
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
    const L = lift.current;
    if (L) {
      const y = h + pose.bob - pose.drop;
      L.position.y += (y - L.position.y) * k;
      L.rotation.x += (pose.lean - L.rotation.x) * k;
      L.scale.set(1 + pose.breath, 1 - pose.breath, 1);
    }
    if (tsd.current) tsd.current.visible = pose.tsd;
    // «z z» над спящим: всплывает и тает
    if (snore.current) {
      const on = act === 'sit';
      snore.current.visible = on;
      if (on) {
        const zp = ((tt * a.snoreRise) % 1 + 1) % 1;
        snore.current.position.set(0.2 + zp * 0.3, 2.2 + zp * 0.6, 0);
        (snore.current.material as SpriteMaterial).opacity = 1 - zp;
      }
    }
    // тележка дребезжит на ходу
    if (cartRef.current) cartRef.current.rotation.z = mv ? Math.sin(tt * a.cartRattleSpeed) * a.cartRattle : 0;
    // пыль из-под колёс: облачко сзади тележки, растёт, поднимается, тает
    if (c && mv && gameDt > 0) {
      ds.timer += gameDt;
      if (ds.timer > a.dustEvery) {
        ds.timer = 0;
        const i = ds.next++ % DUST_COUNT;
        const m = dust.current[i];
        if (m) {
          const [fx, fz] = [Math.sin(c.facing), Math.cos(c.facing)];
          m.position.set(c.pos[0] - fx * 0.5 + (Math.random() - 0.5) * 0.4, 0.1, c.pos[2] - fz * 0.5 + (Math.random() - 0.5) * 0.4);
          dustLife.current[i] = 1;
        }
      }
    }
    dust.current.forEach((m, i) => {
      if (!m) return;
      const life = dustLife.current[i];
      m.visible = life > 0;
      if (life <= 0) return;
      const nl = Math.max(0, life - gameDt * a.dustFade);
      dustLife.current[i] = nl;
      m.scale.setScalar(1 + (1 - nl) * 1.6);
      m.position.y += gameDt * 0.25;
      (m.material as MeshLambertMaterial).opacity = nl * 0.7;
    });
    // место: обычный шаг — сразу, большой скачок (появилась или убрана тележка, развернулся назад) — плавно.
    // С тележкой собака при этом обходит её по дуге вокруг тележки, а не проходит насквозь (правка автора 16.10).
    const r = root.current;
    if (r) {
      const dx = target[0] - r.position.x, dz = target[2] - r.position.z;
      if (Math.hypot(dx, dz) <= a.jumpOver) {
        r.position.set(target[0], target[1], target[2]);
      } else if (c) {
        const [cx, , cz] = c.pos;
        const from = Math.atan2(r.position.x - cx, r.position.z - cz), to = Math.atan2(target[0] - cx, target[2] - cz);
        let turn = to - from;
        while (turn > Math.PI) turn -= Math.PI * 2;
        while (turn < -Math.PI) turn += Math.PI * 2;
        const ang = from + turn * k;
        const rad0 = Math.hypot(r.position.x - cx, r.position.z - cz), rad1 = Math.hypot(target[0] - cx, target[2] - cz);
        const rad = Math.max(rad0 + (rad1 - rad0) * k, Math.min(rad1, 0.75)); // не ближе к тележке, чем нужно
        r.position.set(cx + Math.sin(ang) * rad, target[1], cz + Math.cos(ang) * rad);
      } else {
        r.position.x += dx * k;
        r.position.z += dz * k;
      }
    }
    // куда смотрит собака и тележка: с тележкой — собака на тележку, тележка — от собаки (как прицеп); бросает — на паллету
    const rp = r ? r.position : null;
    if (face.current && rp) {
      let ang = live.current.facing;
      if (tgt) ang = Math.atan2(tgt[0] - rp.x, tgt[2] - rp.z);
      else if (c) ang = Math.atan2(c.pos[0] - rp.x, c.pos[2] - rp.z);
      face.current.rotation.y = ang;
    }
    if (cartPlace.current && c && rp) {
      cartPlace.current.position.set(c.pos[0], c.pos[1], c.pos[2]);
      const ax = c.pos[0] - rp.x, az = c.pos[2] - rp.z;
      cartPlace.current.rotation.y = Math.hypot(ax, az) > 0.05 ? Math.atan2(ax, az) : c.facing;
    }
    // коробка в броске (приёмка): из лап над головой по дуге на паллету, вращаясь
    if (box.current) {
      box.current.visible = pose.box !== null && tgt !== null && rp !== null;
      if (pose.box && tgt && rp) {
        const sx = rp.x, sy = 1.75 * s, sz = rp.z;
        const ex = tgt[0], ey = tgt[1] + 0.2, ez = tgt[2];
        const q = pose.box.k;
        box.current.position.set(sx + (ex - sx) * q, sy + (ey - sy) * q + Math.sin(q * Math.PI) * a.throwArc, sz + (ez - sz) * q);
        box.current.rotation.set(pose.box.spin, pose.box.spin * 0.4, 0);
      }
    }
  });

  return (
    <group>
      {/* тележка катится по полу — без подскока; где она стоит, считает pickerPose */}
      {cart && (
        <group ref={cartPlace} position={cart.pos} rotation={[0, cart.facing, 0]} scale={s}>
          <group ref={cartRef}>
            <VoxelBatch parts={CART} soft="strong" />
          </group>
        </group>
      )}
      {/* коробка в броске (приёмка) — в координатах склада: летит из лап на паллету по дуге, вращаясь */}
      <group ref={box} visible={false}>
        <mesh castShadow>
          <boxGeometry args={[0.5, 0.4, 0.5]} />
          <meshStandardMaterial color={PALETTE.box} />
        </mesh>
        <mesh position={[0, 0.205, 0]}>
          <boxGeometry args={[0.5, 0.02, 0.12]} />
          <meshStandardMaterial color={PALETTE.boxTape} />
        </mesh>
      </group>
      {/* пыль — в координатах склада, чтобы оставалась позади */}
      {Array.from({ length: DUST_COUNT }, (_, i) => (
        <mesh key={i} ref={(el) => { dust.current[i] = el; }} visible={false}>
          <sphereGeometry args={[0.12, 8, 6]} />
          <meshLambertMaterial color={PALETTE.dust} transparent opacity={0.7} depthWrite={false} />
        </mesh>
      ))}
      {/* место ставит useFrame (чтобы большой скачок шёл плавно); здесь — только начальное */}
      <group ref={root} position={start}>
        <Ring color={ringColor} />
        <group ref={face} rotation={[0, facing, 0]} scale={s}>
          <group ref={lift}>
            {PARTS.map((name) => (
              <group key={name} ref={(el) => { if (el) parts.current[name] = el; }} position={rig[name].pivot}>
                <VoxelBatch parts={rig[name].parts} soft="strong" />
                {name === 'armR' && (
                  // ТСД в правой лапе, как у Були на рендере; экран на лицевой стороне — при поднятой лапе смотрит вверх, его видно
                  <group ref={tsd} position={[0, -0.6, 0.16]} visible={false}>
                    <mesh castShadow>
                      <boxGeometry args={[0.12, 0.22, 0.05]} />
                      <meshStandardMaterial color={PALETTE.tsdBody} />
                    </mesh>
                    <mesh position={[0, 0.02, 0.03]}>
                      <boxGeometry args={[0.07, 0.12, 0.01]} />
                      <meshBasicMaterial color={PALETTE.tsdScreen} />
                    </mesh>
                  </group>
                )}
              </group>
            ))}
          </group>
          <sprite ref={snore} scale={[0.6, 0.6, 1]} visible={false}>
            <spriteMaterial map={snoreTex()} transparent depthWrite={false} />
          </sprite>
        </group>
      </group>
    </group>
  );
}
