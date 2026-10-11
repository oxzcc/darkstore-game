// Камера (09, раздел 6.4). Дома — изометрия на весь склад (как в M1).
// Во время мини-игры, когда игрок выбрал стеллаж, камера плавно летит к нему и встаёт спереди,
// а «Назад к складу» возвращает её домой. Куда смотреть, решает сцена по store; это не игровое состояние.
// У стеллажа: ближний ряд и проход постепенно отсекаются (камера будто проходит сквозь них),
// а склад за рядом стеллажа остаётся виден, но приглушён тёплой дымкой — чтобы выбранный ряд читался сразу.
import { useRef } from 'react';
import { Color, Mesh, MeshBasicMaterial, OrthographicCamera, Vector3 } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { Rack, WarehouseMap } from '../model/warehouse';
import { WAREHOUSE_VIEW } from '../config/warehouse';
import { TSD } from '../config/balance';
import { PALETTE } from '../config/palette';
import { useGameStore } from '../store/gameStore';
import { rackCenter, rackFront, rackWidth } from './rackGeometry';

const ISO_ELEVATION = Math.atan(1 / Math.SQRT2); // ≈35,26° — классическая изометрия
const SCREEN_FILL = 0.95;                         // доля свободного места, которую занимает склад в общем виде
const DIST = 50;                                  // камера ортографическая: расстояние влияет только на отсечение
const VEIL_SIZE = 400;                            // дымка заведомо больше любого экрана
const GRASS = new Color(PALETTE.grass);
const VEIL = new Color(PALETTE.closeupVeil);

/** Куда смотрит камера: точка, направление «от точки к камере», приближение и сколько видно перед целью. */
type Pose = { target: Vector3; dir: Vector3; zoom: number; clipAhead: number };

type Size = { width: number; height: number };

/** Свободное от панелей интерфейса место на экране, в пикселях. */
function freeArea(size: Size) {
  const ins = WAREHOUSE_VIEW.screenInsets;
  return {
    w: Math.max(100, size.width - ins.left - ins.right),
    h: Math.max(100, size.height - ins.top - ins.bottom),
  };
}

/** Общий вид: весь склад в изометрии (то же, что было в M1). */
function homePose(map: WarehouseMap, size: Size): Pose {
  const { w, h } = freeArea(size);
  const diag = (map.width + map.depth) / Math.SQRT2;
  const spanY = diag * Math.sin(ISO_ELEVATION) + WAREHOUSE_VIEW.wallHeight * Math.cos(ISO_ELEVATION);
  return {
    target: new Vector3(map.width / 2, WAREHOUSE_VIEW.wallHeight / 2, map.depth / 2),
    dir: new Vector3(1, 1, 1).normalize(),
    zoom: Math.min(w / diag, h / spanY) * SCREEN_FILL,
    clipAhead: DIST, // ничего не отсекаем
  };
}

/** Вид стеллажа спереди (06, раздел 2.3). */
function closePose(rack: Rack, size: Size): Pose {
  const { w, h } = freeArea(size);
  const { elevationDeg, fill, clipAhead } = WAREHOUSE_VIEW.closeup;
  const [cx, , cz] = rackCenter(rack);
  const [fx, fz] = rackFront(rack);
  const el = (elevationDeg * Math.PI) / 180;
  const spanX = rackWidth(rack.cells.length) / fill;
  const spanY = WAREHOUSE_VIEW.rackHeight / fill;
  return {
    target: new Vector3(cx, WAREHOUSE_VIEW.rackHeight / 2, cz),
    dir: new Vector3(fx * Math.cos(el), Math.sin(el), fz * Math.cos(el)).normalize(),
    zoom: Math.min(w / spanX, h / spanY),
    clipAhead,
  };
}

/** Плавное начало и конец перелёта. */
const smooth = (t: number) => t * t * (3 - 2 * t);

/** Промежуточная поза между домом и стеллажом: t = 0 — дом, 1 — стеллаж. */
function mix(a: Pose, b: Pose, t: number): Pose {
  return {
    target: a.target.clone().lerp(b.target, t),
    dir: a.dir.clone().lerp(b.dir, t).normalize(),
    zoom: a.zoom * Math.pow(b.zoom / a.zoom, t), // приближение растёт равномерно на глаз
    // отсечение растёт постепенно: ближние ряды пропадают по одному, пока камера «проходит» к стеллажу
    clipAhead: a.clipAhead + (b.clipAhead - a.clipAhead) * Math.pow(t, 2),
  };
}

function apply(camera: OrthographicCamera, pose: Pose) {
  camera.position.copy(pose.target).addScaledVector(pose.dir, DIST);
  camera.up.set(0, 1, 0);
  camera.lookAt(pose.target);
  camera.zoom = pose.zoom;
  camera.updateMatrixWorld();

  // Сдвиг, чтобы цель оказалась в центре свободного от интерфейса места, а не всего экрана.
  const ins = WAREHOUSE_VIEW.screenInsets;
  const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  camera.position
    .addScaledVector(right, -(ins.left - ins.right) / 2 / pose.zoom)
    .addScaledVector(up, -(ins.bottom - ins.top) / 2 / pose.zoom);

  // Всё, что ближе к камере, чем clipAhead перед целью, не рисуется (ближний ряд и проход со сборщиками).
  camera.near = Math.max(0.1, DIST - pose.clipAhead);
  camera.far = 500;
  camera.updateProjectionMatrix();
}

export default function CameraRig({ map }: { map: WarehouseMap }) {
  const camera = useThree((s) => s.camera) as OrthographicCamera;
  const size = useThree((s) => s.size);
  const scene = useThree((s) => s.scene);
  const focus = useGameStore((s) => (s.game.minigame?.atFocus ? s.game.minigame.focus : null));

  const progress = useRef(0);                 // 0 — дом, 1 — у стеллажа
  const lastRack = useRef<Rack | null>(null); // к какому стеллажу летим (и от какого возвращаемся)
  const veil = useRef<Mesh>(null);
  const veilMat = useRef<MeshBasicMaterial>(null);

  useFrame((_, delta) => {
    const rack = focus ? map.racks.find((r) => r.aisle === focus.aisle && r.rack === focus.rack) ?? null : null;
    if (rack) lastRack.current = rack;
    const step = Math.min(delta, 0.1) / TSD.cameraFlySeconds;
    progress.current = rack ? Math.min(1, progress.current + step) : Math.max(0, progress.current - step);
    const t = smooth(progress.current);

    const home = homePose(map, size);
    const close = lastRack.current ? closePose(lastRack.current, size) : null;
    apply(camera, close && progress.current > 0 ? mix(home, close, t) : home);

    // Дымка стоит сразу за рядом выбранного стеллажа и смотрит на камеру; проявляется вместе с перелётом.
    if (veil.current && veilMat.current) {
      veil.current.visible = !!close && progress.current > 0;
      if (close) {
        veil.current.position.copy(close.target).addScaledVector(close.dir, -WAREHOUSE_VIEW.closeup.veilBehind);
        veil.current.lookAt(veil.current.position.clone().add(close.dir));
      }
      veilMat.current.opacity = WAREHOUSE_VIEW.closeup.veilOpacity * t;
    }
    // Фон (там, где за дымкой ничего нет, например под отсечённым краем пола) — того же тёплого цвета.
    if (scene.background instanceof Color) scene.background.copy(GRASS).lerp(VEIL, t);
  });

  return (
    <mesh ref={veil} visible={false} renderOrder={1}>
      <planeGeometry args={[VEIL_SIZE, VEIL_SIZE]} />
      <meshBasicMaterial ref={veilMat} color={PALETTE.closeupVeil} transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}
