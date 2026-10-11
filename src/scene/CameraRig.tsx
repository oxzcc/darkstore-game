// Камера (09, раздел 6.4). Одна перспективная камера на всю игру:
// - дома она смотрит издалека с очень узким углом обзора — на глаз это та же изометрия, что в M1;
// - во время мини-игры, когда игрок выбрал стеллаж, камера плавно «влетает» в проход: приближается,
//   угол обзора расширяется до обычного, и она встаёт на уровне глаз сборщика перед стеллажом;
// - «Назад к складу» возвращает её домой.
// Вдали склад растворяется в светлой дымке. Куда смотреть, решает сцена по store; это не игровое состояние.
import { useRef } from 'react';
import { Color, Fog, PerspectiveCamera, Vector3 } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { Rack, WarehouseMap } from '../model/warehouse';
import { WAREHOUSE_VIEW } from '../config/warehouse';
import { TSD } from '../config/balance';
import { PALETTE } from '../config/palette';
import { useGameStore } from '../store/gameStore';
import { closeupEye, closeupLook } from './closeupView';

const ISO_ELEVATION = Math.atan(1 / Math.SQRT2); // ≈35,26° — классическая изометрия
const SCREEN_FILL = 0.95;                         // доля свободного места, которую занимает склад в общем виде
const DEPTH = 60;                                 // сколько метров сцены вокруг цели помещается между near и far
const NO_FOG = 1e5;                               // дымка так далеко, что её нет
const GRASS = new Color(PALETTE.grass);
const FOG = new Color(PALETTE.closeupFog);

type Insets = { left: number; right: number; top: number; bottom: number };
type Size = { width: number; height: number };

/** Куда смотрит камера: цель, направление «от цели к камере», расстояние, угол обзора и поля интерфейса. */
type Pose = { target: Vector3; dir: Vector3; dist: number; fovDeg: number; insets: Insets };

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Общий вид: весь склад «в изометрии» (узкий угол издалека). */
function homePose(map: WarehouseMap, size: Size): Pose {
  const ins = WAREHOUSE_VIEW.screenInsets;
  const freeW = Math.max(100, size.width - ins.left - ins.right);
  const freeH = Math.max(100, size.height - ins.top - ins.bottom);
  const diag = (map.width + map.depth) / Math.SQRT2;
  const spanY = diag * Math.sin(ISO_ELEVATION) + WAREHOUSE_VIEW.wallHeight * Math.cos(ISO_ELEVATION);
  // сколько пикселей на метр (как zoom ортографической камеры в M1) → какая высота мира видна на экране
  const pxPerM = Math.min(freeW / diag, freeH / spanY) * SCREEN_FILL;
  const visibleH = size.height / pxPerM;
  const fovDeg = WAREHOUSE_VIEW.homeFovDeg;
  return {
    target: new Vector3(map.width / 2, WAREHOUSE_VIEW.wallHeight / 2, map.depth / 2),
    dir: new Vector3(1, 1, 1).normalize(),
    dist: visibleH / 2 / Math.tan(rad(fovDeg) / 2),
    fovDeg,
    insets: ins,
  };
}

/** Вид стеллажа «глазами сборщика». */
function closePose(rack: Rack): Pose {
  const eye = closeupEye(rack);
  const look = closeupLook(rack);
  const toEye = eye.clone().sub(look);
  return {
    target: look,
    dir: toEye.clone().normalize(),
    dist: toEye.length(),
    fovDeg: WAREHOUSE_VIEW.closeup.fovDeg,
    insets: WAREHOUSE_VIEW.closeup.screenInsets,
  };
}

/** Плавное начало и конец перелёта. */
const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Для расстояния и угла — равномерно «на глаз» (по логарифму), иначе приближение рывком в конце. */
const logLerp = (a: number, b: number, t: number) => a * Math.pow(b / a, t);

function mix(a: Pose, b: Pose, t: number): Pose {
  return {
    target: a.target.clone().lerp(b.target, t),
    dir: a.dir.clone().lerp(b.dir, t).normalize(),
    dist: logLerp(a.dist, b.dist, t),
    fovDeg: logLerp(a.fovDeg, b.fovDeg, t),
    insets: {
      left: lerp(a.insets.left, b.insets.left, t),
      right: lerp(a.insets.right, b.insets.right, t),
      top: lerp(a.insets.top, b.insets.top, t),
      bottom: lerp(a.insets.bottom, b.insets.bottom, t),
    },
  };
}

function apply(camera: PerspectiveCamera, pose: Pose, size: Size) {
  camera.fov = pose.fovDeg;
  camera.position.copy(pose.target).addScaledVector(pose.dir, pose.dist);
  camera.up.set(0, 1, 0);
  camera.lookAt(pose.target);
  camera.updateMatrixWorld();

  // Сдвиг, чтобы цель оказалась в центре свободного от интерфейса места, а не всего экрана.
  const mPerPx = (2 * pose.dist * Math.tan(rad(pose.fovDeg) / 2)) / size.height; // метров на пиксель у цели
  const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  camera.position
    .addScaledVector(right, (-(pose.insets.left - pose.insets.right) / 2) * mPerPx)
    .addScaledVector(up, (-(pose.insets.bottom - pose.insets.top) / 2) * mPerPx);

  camera.near = Math.max(0.05, pose.dist - DEPTH);
  camera.far = pose.dist + DEPTH;
  camera.updateProjectionMatrix();
}

export default function CameraRig({ map }: { map: WarehouseMap }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const scene = useThree((s) => s.scene);
  const focus = useGameStore((s) => (s.game.minigame?.atFocus ? s.game.minigame.focus : null));

  const progress = useRef(0);                 // 0 — дом, 1 — у стеллажа
  const lastRack = useRef<Rack | null>(null); // к какому стеллажу летим (и от какого возвращаемся)
  const fog = useRef(new Fog(FOG, NO_FOG, NO_FOG * 2));

  useFrame((_, delta) => {
    const rack = focus ? map.racks.find((r) => r.aisle === focus.aisle && r.rack === focus.rack) ?? null : null;
    if (rack) lastRack.current = rack;
    const step = Math.min(delta, 0.1) / TSD.cameraFlySeconds;
    progress.current = rack ? Math.min(1, progress.current + step) : Math.max(0, progress.current - step);
    const t = smooth(progress.current);

    const home = homePose(map, size);
    const close = lastRack.current ? closePose(lastRack.current) : null;
    const pose = close && progress.current > 0 ? mix(home, close, t) : home;
    apply(camera, pose, size);

    // Дымка: дома её нет; у стеллажа близкое чёткое, дальнее растворяется. Расстояния — от глаз.
    const { fogNear, fogFar } = WAREHOUSE_VIEW.closeup;
    const fadeIn = t * t; // проявляется ближе к концу перелёта
    fog.current.near = pose.dist + logLerp(NO_FOG, Math.max(0.1, fogNear - (close?.dist ?? 0)), fadeIn);
    fog.current.far = pose.dist + logLerp(NO_FOG * 2, fogFar - (close?.dist ?? 0), fadeIn);
    // дымка подключена всегда (дома — бесконечно далеко): если её включать и выключать, материалы пересобираются и кадр дёргается
    if (scene.fog !== fog.current) scene.fog = fog.current;

    // Фон: трава в общем виде, цвет дымки у стеллажа.
    if (scene.background instanceof Color) scene.background.copy(GRASS).lerp(FOG, t);
  });

  return null;
}
