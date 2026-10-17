// Сценки-иллюстрации для окон развилки и итога (V1, набор V2a): маленькая отдельная 3D-сцена с собакой из игры
// (models/Dog.ts), эмоцией на морде и реквизитом по рецепту из config/vignettes.ts. Только отображение.
// Свой <Canvas> на окно: мир в это время на паузе, а сценка живёт по реальному времени (машет лапой, виляет хвостом).
import { useLayoutEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, type Group } from 'three';
import type { DogLook } from '../../config/pickers';
import type { ProductLook } from '../../model/product';
import { BACKDROP, PORTRAIT, VIGNETTE, type VignetteActor, type VignetteCamera, type VignetteRecipe } from '../../config/vignettes';
import { PALETTE } from '../../config/palette';
import { WAREHOUSE_VIEW } from '../../config/warehouse';
import VoxelBatch from '../VoxelBatch';
import { dogRig, type DogOutfit, type DogPartName } from '../models/Dog';
import Truck from '../models/Truck';
import OrderBag from '../models/OrderBag';
import type { BagLook } from '../couriers';
import { planksTexture, TEXTURE_METERS, tiled, tilesTexture } from '../textures';
import Backdrop from './Backdrop';
import { boxParts, faceParts, productPiece, propParts, STILL_PROPS, vignettePose } from './vignetteParts';

const L = WAREHOUSE_VIEW.light;
/** Где коробка в лапах (низ коробки, координаты собаки): между кистями, их держит vignettePose (BOX_GRIP). */
const HELD_BOX: [number, number, number] = [0, 0.57, 0.62];
const PARTS: DogPartName[] = ['body', 'head', 'legL', 'legR', 'armL', 'armR', 'tail'];
const deg = (d: number) => (d * Math.PI) / 180;

/** Камера: смотрит на цель с заданной стороны и высоты. */
function Aim({ cam }: { cam: VignetteCamera }) {
  const camera = useThree((s) => s.camera);
  useLayoutEffect(() => {
    const [tx, ty, tz] = cam.target;
    const az = deg(cam.azimuthDeg), el = deg(cam.elevationDeg);
    camera.position.set(
      tx + Math.sin(az) * Math.cos(el) * cam.distance,
      ty + Math.sin(el) * cam.distance,
      tz + Math.cos(az) * Math.cos(el) * cam.distance,
    );
    camera.lookAt(tx, ty, tz);
    if (camera instanceof PerspectiveCamera) {
      camera.fov = cam.fovDeg;
      camera.updateProjectionMatrix();
    }
  }, [camera, cam]);
  return null;
}

/** ТСД в лапе; экран красный, когда что-то не так, и зелёный, когда всё хорошо. */
function Tsd({ ok }: { ok: boolean }) {
  return (
    <group position={[0, -0.6, 0.16]}>
      <mesh castShadow>
        <boxGeometry args={[0.13, 0.24, 0.05]} />
        <meshStandardMaterial color={PALETTE.tsdBody} />
      </mesh>
      <mesh position={[0, 0.03, 0.03]}>
        <boxGeometry args={[0.08, 0.12, 0.01]} />
        <meshBasicMaterial color={ok ? PALETTE.tsdScreen : '#F0373B'} />
      </mesh>
    </group>
  );
}

/** Планшет с накладной в лапе: коричневая доска, белый лист, тёмный зажим. */
function Clipboard() {
  return (
    <group position={[0, -0.62, 0.2]} rotation={[-0.5, 0, 0]}>
      <mesh castShadow>
        <boxGeometry args={[0.26, 0.34, 0.02]} />
        <meshStandardMaterial color={PALETTE.clipboard} />
      </mesh>
      <mesh position={[0, -0.02, 0.016]}>
        <boxGeometry args={[0.22, 0.26, 0.01]} />
        <meshStandardMaterial color={PALETTE.paper} />
      </mesh>
      {[0.06, 0.0, -0.06].map((y) => (
        <mesh key={y} position={[0, y - 0.02, 0.024]}>
          <boxGeometry args={[0.16, 0.015, 0.005]} />
          <meshBasicMaterial color={PALETTE.cartFrame} />
        </mesh>
      ))}
      <mesh position={[0, 0.16, 0.02]}>
        <boxGeometry args={[0.1, 0.04, 0.03]} />
        <meshStandardMaterial color={PALETTE.fence} />
      </mesh>
    </group>
  );
}

const RIGS = new Map<string, ReturnType<typeof dogRig>>();
function rigFor(look: DogLook, outfit: DogOutfit) {
  const key = `${outfit}|${look.fur}|${look.ear}|${look.ears}`;
  let r = RIGS.get(key);
  if (!r) RIGS.set(key, (r = dogRig(look, outfit)));
  return r;
}

/**
 * Персонаж сценки: собака по позе и эмоции, с предметами в лапах. Штуки товара в лапах каждый кадр поворачиваются
 * обратно на угол лапы — так они стоят ровно, а не наклоняются вместе с ней.
 */
function ActorFigure({ look, outfit, actor, product }: { look: DogLook; outfit: DogOutfit; actor: VignetteActor; product: ProductLook | null }) {
  const rig = rigFor(look, outfit);
  const face = useMemo(() => faceParts(actor.mood), [actor.mood]);
  const piece = useMemo(() => (product ? productPiece(product, 0.24) : []), [product]);
  const held = useMemo(() => (product ? productPiece(product, 0.28) : []), [product]);
  const openBox = useMemo(() => boxParts(true), []);
  const closedBox = useMemo(() => boxParts(false), []);
  const parts = useRef<Partial<Record<DogPartName, Group>>>({});
  const lift = useRef<Group>(null);
  const holdL = useRef<Group>(null);
  const holdR = useRef<Group>(null);
  // свой сдвиг времени — чтобы два персонажа в одной сценке не двигались синхронно
  const phase = useMemo(() => (actor.at[0] * 1.7 + actor.at[2] * 2.3) % 6, [actor.at]);

  useFrame((state) => {
    const p = vignettePose(actor.pose, state.clock.elapsedTime + phase, actor.hold);
    const g = parts.current;
    const set = (obj: Group | undefined, x: number, y = 0, z = 0) => obj?.rotation.set(x, y, z);
    set(g.legL, p.legL);
    set(g.legR, p.legR);
    set(g.armL, p.armL[0], 0, p.armL[1]);
    set(g.armR, p.armR[0], 0, p.armR[1]);
    set(g.head, p.head[0], p.head[1]);
    set(g.tail, 0, p.tail);
    set(g.body, 0, 0, p.roll);
    holdL.current?.rotation.set(-p.armL[0], 0, -p.armL[1], 'ZYX');
    holdR.current?.rotation.set(-p.armR[0], 0, -p.armR[1], 'ZYX');
    if (lift.current) {
      lift.current.position.y = p.bob;
      lift.current.rotation.x = p.lean;
    }
  });

  const pieceInR = actor.hold === 'product' || actor.hold === 'twoProducts';
  const pieceInL = actor.hold === 'twoProducts';
  return (
    <group position={actor.at} rotation={[0, actor.turn, 0]} scale={WAREHOUSE_VIEW.picker.scale}>
      <group ref={lift}>
        {PARTS.map((name) => (
          <group key={name} ref={(el) => { if (el) parts.current[name] = el; }} position={rig[name].pivot}>
            <VoxelBatch parts={rig[name].parts} soft="strong" />
            {name === 'head' && <VoxelBatch parts={face} />}
            {name === 'armL' && actor.hold === 'tsd' && <Tsd ok={actor.mood === 'happy'} />}
            {name === 'armL' && actor.hold === 'clipboard' && <Clipboard />}
            {/* штука товара в лапе: точка — у кисти, сама штука стоит ровно (поворот назад в useFrame) */}
            {name === 'armL' && (
              <group position={[0, -0.8, 0.05]}>
                <group ref={holdL}>{pieceInL && <VoxelBatch parts={piece} />}</group>
              </group>
            )}
            {name === 'armR' && (
              <group position={[0, -0.8, 0.05]}>
                <group ref={holdR}>{pieceInR && <VoxelBatch parts={piece} />}</group>
              </group>
            )}
          </group>
        ))}
        {/* перед собой: вскрытая коробка со штукой товара сверху или закрытая коробка */}
        {(actor.hold === 'productBox' || actor.hold === 'box') && (
          <group position={HELD_BOX}>
            <VoxelBatch parts={actor.hold === 'box' ? closedBox : openBox} />
            {actor.hold === 'productBox' && (
              <group position={[0, 0.37, 0]}>
                <VoxelBatch parts={held} />
              </group>
            )}
          </group>
        )}
      </group>
    </group>
  );
}

/** Пакет заказа с товаром задания внутри (вид — как у пакетов на столах фасовки). */
function bagLookFor(product: ProductLook | null): BagLook {
  const color = product?.color ?? '#C9C2B4', accent = product?.accent ?? '#FFFFFF';
  return {
    items: [
      { color, accent, size: [0.12, 0.18, 0.1], pos: [-0.07, 0.105, -0.03] },
      { color, accent, size: [0.11, 0.14, 0.09], pos: [0.08, 0.085, -0.03] },
      { color: PALETTE.box, accent: PALETTE.boxTape, size: [0.12, 0.1, 0.08], pos: [0, 0.065, 0.05] },
    ],
  };
}

function Stage({ recipe, look, product }: { recipe: VignetteRecipe; look: DogLook; product: ProductLook | null }) {
  // реквизит, который стоит ровно, — одним пакетом брусков; остальное — каждый своей группой
  const still = useMemo(
    () => recipe.props.filter((p) => STILL_PROPS.includes(p.kind)).flatMap((p) => propParts(p, product)),
    [recipe, product],
  );
  const bag = useMemo(() => bagLookFor(product), [product]);
  const backdrop = recipe.background ? recipe.backdrop ?? 'hall' : null;
  const home = backdrop === 'home';
  const floorMap = useMemo(
    () => (home ? tiled(planksTexture(), 30, 30, TEXTURE_METERS.planks) : tiled(tilesTexture(), 30, 30, TEXTURE_METERS.tiles)),
    [home],
  );
  const [tx, , tz] = recipe.camera.target;
  return (
    <>
    {/* фон — прямо у сцены (attach="background" цепляется к родителю), остальное в группе, которую не «утилизировать»:
        бруски и текстуры общие со складом */}
    {recipe.background && <color attach="background" args={[recipe.background]} />}
    {/* лёгкая дымка цвета фона: задник не спорит с героем сцены */}
    {recipe.background && (
      <fog attach="fog" args={[recipe.background, recipe.camera.distance + BACKDROP.fogFrom, recipe.camera.distance + BACKDROP.fogTo]} />
    )}
    <group dispose={null}>
      <Aim cam={recipe.camera} />
      <hemisphereLight args={[L.skyColor, L.groundColor, L.sky * Math.PI]} />
      <directionalLight
        castShadow
        position={[tx - 3, 7, tz + 5]}
        color={L.sunColor}
        intensity={L.sun * Math.PI}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-camera-near={1}
        shadow-camera-far={30}
        shadow-bias={L.shadowBias}
        shadow-normalBias={L.shadowNormalBias}
        shadow-intensity={L.shadowStrength}
      />
      {recipe.background && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[30, 30]} />
          <meshStandardMaterial color={home ? BACKDROP.homeFloor : PALETTE.floor} map={floorMap} />
        </mesh>
      )}
      {backdrop && <Backdrop kind={backdrop} />}
      {still.length > 0 && <VoxelBatch parts={still} soft="strong" />}
      {recipe.props.map((p, i) => {
        switch (p.kind) {
          case 'product':
          case 'box':
            return (
              <group key={i} position={p.at} rotation={p.rot ?? [0, 0, 0]}>
                <VoxelBatch parts={propParts(p, product)} />
              </group>
            );
          case 'phone':
          case 'icon':
            return (
              <group key={i} position={p.at} rotation={[0, p.kind === 'phone' ? p.turn ?? 0 : 0, 0]} scale={p.kind === 'icon' ? p.size ?? 1 : 1}>
                <VoxelBatch parts={propParts(p, product)} />
              </group>
            );
          case 'truck':
            return <Truck key={i} position={p.at} rotationY={p.turn ?? 0} />;
          case 'bag':
            return <OrderBag key={i} look={bag} position={p.at} rotationY={p.turn ?? 0} scale={1.6} />;
          case 'npc':
            return (
              <ActorFigure
                key={i}
                look={p.role === 'driver' ? VIGNETTE.driverLook : VIGNETTE.otherPickerLook}
                outfit={p.role === 'driver' ? 'driver' : 'picker'}
                actor={p}
                product={product}
              />
            );
          default:
            return null;
        }
      })}
      <ActorFigure look={look} outfit="picker" actor={recipe.dog} product={product} />
    </group>
    </>
  );
}

function VignetteCanvas({ recipe, look, product }: { recipe: VignetteRecipe; look: DogLook; product: ProductLook | null }) {
  // flat — цвета как в палитре, без «киношной» обработки (как на складе)
  return (
    <Canvas flat shadows dpr={[1, 2]} gl={{ alpha: true, antialias: true }} camera={{ fov: recipe.camera.fovDeg, near: 0.1, far: 100 }}>
      <Stage recipe={recipe} look={look} product={product} />
    </Canvas>
  );
}

/** Портрет сборщика в окне развилки: по пояс, машет лапой, в другой — ТСД. Фон — подложка окна. */
export function PickerPortrait({ look }: { look: DogLook }) {
  return <VignetteCanvas recipe={PORTRAIT} look={look} product={null} />;
}

/** Сценка по рецепту; `product` — товар позиции задания (им заставлены полки, он в лапах, в тележке и в пакете). */
export function ResultVignette({ recipe, look, product }: { recipe: VignetteRecipe; look: DogLook; product: ProductLook | null }) {
  return <VignetteCanvas recipe={recipe} look={look} product={product} />;
}
