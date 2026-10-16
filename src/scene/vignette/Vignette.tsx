// Сценки-иллюстрации для окон развилки и итога (прототип 16.10): маленькая отдельная 3D-сцена с собакой из игры
// (models/Dog.ts), эмоцией на морде и реквизитом по рецепту из config/vignettes.ts. Только отображение.
// Свой <Canvas> на окно: мир в это время на паузе, а сценка живёт по реальному времени (машет лапой, виляет хвостом).
import { useLayoutEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, type Group } from 'three';
import type { DogLook } from '../../config/pickers';
import type { ProductLook } from '../../model/product';
import { PORTRAIT, type VignetteCamera, type VignetteRecipe } from '../../config/vignettes';
import { PALETTE } from '../../config/palette';
import { WAREHOUSE_VIEW } from '../../config/warehouse';
import VoxelBatch from '../VoxelBatch';
import { dogRig, type DogPartName } from '../models/Dog';
import { TEXTURE_METERS, tiled, tilesTexture } from '../textures';
import { boxParts, faceParts, productPiece, propParts, vignettePose } from './vignetteParts';

const L = WAREHOUSE_VIEW.light;
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

function DogFigure({ look, dog, product }: { look: DogLook; dog: VignetteRecipe['dog']; product: ProductLook | null }) {
  const rig = useMemo(() => dogRig(look), [look]);
  const face = useMemo(() => faceParts(dog.mood), [dog.mood]);
  const held = useMemo(() => (product ? productPiece(product, 0.28) : []), [product]);
  const heldBox = useMemo(() => boxParts(true), []);
  const parts = useRef<Partial<Record<DogPartName, Group>>>({});
  const lift = useRef<Group>(null);

  useFrame((state) => {
    const p = vignettePose(dog.pose, state.clock.elapsedTime);
    const g = parts.current;
    const set = (obj: Group | undefined, x: number, y = 0, z = 0) => obj?.rotation.set(x, y, z);
    set(g.legL, p.legL);
    set(g.legR, p.legR);
    set(g.armL, p.armL[0], 0, p.armL[1]);
    set(g.armR, p.armR[0], 0, p.armR[1]);
    set(g.head, p.head[0], p.head[1]);
    set(g.tail, 0, p.tail);
    set(g.body, 0, 0, p.roll);
    if (lift.current) {
      lift.current.position.y = p.bob;
      lift.current.rotation.x = p.lean;
    }
  });

  return (
    <group position={dog.at} rotation={[0, dog.turn, 0]} scale={WAREHOUSE_VIEW.picker.scale}>
      <group ref={lift}>
        {PARTS.map((name) => (
          <group key={name} ref={(el) => { if (el) parts.current[name] = el; }} position={rig[name].pivot}>
            <VoxelBatch parts={rig[name].parts} soft="strong" />
            {name === 'head' && <VoxelBatch parts={face} />}
            {name === 'armL' && dog.hold === 'tsd' && <Tsd ok={dog.mood === 'happy'} />}
          </group>
        ))}
        {/* упаковка в лапах: вскрытая коробка, сверху штука товара задания */}
        {dog.hold === 'productBox' && (
          <group position={[0, 0.6, 0.5]}>
            <VoxelBatch parts={heldBox} />
            <group position={[0, 0.37, 0]}>
              <VoxelBatch parts={held} />
            </group>
          </group>
        )}
      </group>
    </group>
  );
}

function Stage({ recipe, look, product }: { recipe: VignetteRecipe; look: DogLook; product: ProductLook | null }) {
  // реквизит, который стоит ровно, — одним пакетом; товар и коробки (лежат на боку) — каждый своей группой
  const still = useMemo(
    () => recipe.props.filter((p) => p.kind === 'rack' || p.kind === 'ladder').flatMap((p) => propParts(p, product)),
    [recipe, product],
  );
  const loose = recipe.props.filter((p) => p.kind === 'product' || p.kind === 'box');
  const floorMap = useMemo(() => tiled(tilesTexture(), 30, 30, TEXTURE_METERS.tiles), []);
  const [tx, , tz] = recipe.camera.target;
  return (
    <>
    {/* фон — прямо у сцены (attach="background" цепляется к родителю), остальное в группе, которую не «утилизировать»:
        бруски и текстуры общие со складом */}
    {recipe.background && <color attach="background" args={[recipe.background]} />}
    <group dispose={null}>
      <Aim cam={recipe.camera} />
      <hemisphereLight args={[L.skyColor, L.groundColor, L.sky * Math.PI]} />
      <directionalLight
        castShadow
        position={[tx - 3, 7, tz + 5]}
        color={L.sunColor}
        intensity={L.sun * Math.PI}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
        shadow-camera-near={1}
        shadow-camera-far={30}
        shadow-bias={L.shadowBias}
        shadow-normalBias={L.shadowNormalBias}
        shadow-intensity={L.shadowStrength}
      />
      {recipe.background && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[30, 30]} />
          <meshStandardMaterial color={PALETTE.floor} map={floorMap} />
        </mesh>
      )}
      {still.length > 0 && <VoxelBatch parts={still} soft="strong" />}
      {loose.map((p, i) => (
        <group key={i} position={p.at} rotation={p.kind === 'product' || p.kind === 'box' ? p.rot ?? [0, 0, 0] : [0, 0, 0]}>
          <VoxelBatch parts={propParts(p, product)} />
        </group>
      ))}
      <DogFigure look={look} dog={recipe.dog} product={product} />
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

/** Сценка итога развилки по рецепту; `product` — товар позиции задания (им заставлены полки и он же падает). */
export function ResultVignette({ recipe, look, product }: { recipe: VignetteRecipe; look: DogLook; product: ProductLook | null }) {
  return <VignetteCanvas recipe={recipe} look={look} product={product} />;
}
