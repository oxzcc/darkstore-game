// Камера (09, раздел 6.4). Одна перспективная камера на всю игру:
// - дома она смотрит сверху на склад с перспективой (угол обзора WAREHOUSE_VIEW.homeFovDeg, как в концепт-рендере, W6);
// - во время мини-игры, когда игрок выбрал стеллаж, камера плавно «влетает» в проход: приближается,
//   угол обзора расширяется до обычного, и она встаёт на уровне глаз сборщика перед стеллажом;
// - «Назад к складу» возвращает её домой.
// Дома камеру можно крутить вокруг склада и приближать (W1; 08, раздел 0): перетаскивание мышью, колесо,
// двойной клик — исходный вид; кнопки ⟲ ⟳ + − — в ui/CameraControls. Поворот и зум лежат в store.ui.camera.
// Вдали склад растворяется в светлой дымке. Куда смотреть, решает сцена по store; это не игровое состояние.
import { useEffect, useRef } from 'react';
import { Color, Fog, PerspectiveCamera, Vector3 } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { Rack, WarehouseMap } from '../model/warehouse';
import { WAREHOUSE_VIEW } from '../config/warehouse';
import { TSD } from '../config/balance';
import { PALETTE } from '../config/palette';
import { useGameStore } from '../store/gameStore';
import { closeupEye, closeupLook } from './closeupView';
import { closeupFocus } from '../store/selectors';
import { PHONE } from '../config/phone';
import { usePhone } from '../app/usePhone';

const SCREEN_FILL = 0.95;                         // доля свободного места, которую занимает склад в общем виде
const DEPTH = 60;                                 // сколько метров сцены вокруг цели помещается между near и far
/** Ближняя граница в общем виде — доля расстояния до цели. Чем ближе near к камере, тем грубее буфер глубины: при 5 см
 *  поверхности в миллиметрах друг от друга (пол и разметка, стекло и рама) «дерутся» и мерцают полосами. В общем виде ближе
 *  ~30% расстояния ничего нет (камера высоко над складом, даже при самом крупном зуме); у стеллажа (вид вблизи) доля 0 — там работает clipNear. */
const HOME_NEAR_SHARE = 0.3;
const NO_FOG = 1e5;                               // дымка так далеко, что её нет
const GRASS = new Color(PALETTE.grass);
const FOG = new Color(PALETTE.closeupFog);

type Insets = { left: number; right: number; top: number; bottom: number };
type Size = { width: number; height: number };

/** Куда смотрит камера: цель, направление «от цели к камере», расстояние, угол обзора, поля интерфейса
 *  и сколько метров перед камерой не рисовать. */
type Pose = { target: Vector3; dir: Vector3; dist: number; fovDeg: number; insets: Insets; clipNear: number; nearShare: number };

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Общий вид: весь склад «в изометрии» (узкий угол издалека). */
function homePose(map: WarehouseMap, size: Size, panel: number, yaw: number, zoom: number, phone: boolean): Pose {
  // panel — 0…1: насколько выдвинута панель ТСД справа (склад сдвигается влево, чтобы она его не закрывала)
  // телефон (R1): свои поля интерфейса, склад шире экрана — края видно поворотом
  const base = phone ? PHONE.screenInsets : WAREHOUSE_VIEW.screenInsets;
  const ins = { ...base, right: lerp(base.right, WAREHOUSE_VIEW.tsdPanelInset, panel) };
  const freeW = Math.max(100, size.width - ins.left - ins.right);
  const freeH = Math.max(100, size.height - ins.top - ins.bottom);
  const elev = rad(WAREHOUSE_VIEW.homeCamera.elevationDeg);
  const az = rad(WAREHOUSE_VIEW.homeCamera.azimuthDeg);
  // размер склада на экране считаем для исходного угла (45°), чтобы при повороте он не «дышал»
  const diag = (map.width + map.depth) / Math.SQRT2;
  const spanY = diag * Math.sin(elev) + WAREHOUSE_VIEW.wallHeight * Math.cos(elev);
  // сколько пикселей на метр (как zoom ортографической камеры в M1) → какая высота мира видна на экране
  const pxPerM = Math.min((freeW / diag) * (phone ? PHONE.widthFill : 1), freeH / spanY) * SCREEN_FILL * zoom;
  const visibleH = size.height / pxPerM;
  const fovDeg = WAREHOUSE_VIEW.homeFovDeg;
  return {
    target: new Vector3(map.width / 2, WAREHOUSE_VIEW.wallHeight / 2, map.depth / 2),
    // исходный угол — с юго-востока, ближе к югу (azimuthDeg), yaw поворачивает вокруг склада
    dir: new Vector3(Math.sin(az + yaw) * Math.cos(elev), Math.sin(elev), Math.cos(az + yaw) * Math.cos(elev)),
    dist: visibleH / 2 / Math.tan(rad(fovDeg) / 2),
    fovDeg,
    insets: ins,
    clipNear: 0,
    nearShare: HOME_NEAR_SHARE,
  };
}

/** Вид стеллажа «глазами сборщика». insets — сколько места занимает интерфейс (у «Глубины» он свой). */
function closePose(rack: Rack, insets: Insets): Pose {
  const eye = closeupEye(rack);
  const look = closeupLook(rack);
  const toEye = eye.clone().sub(look);
  return {
    target: look,
    dir: toEye.clone().normalize(),
    dist: toEye.length(),
    fovDeg: WAREHOUSE_VIEW.closeup.fovDeg,
    insets,
    clipNear: WAREHOUSE_VIEW.closeup.clipNear,
    nearShare: 0,
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
    // отсечение растёт к концу перелёта — противоположный ряд пропадает, когда камера «проходит» сквозь него
    clipNear: lerp(a.clipNear, b.clipNear, Math.pow(t, 3)),
    nearShare: lerp(a.nearShare, b.nearShare, t),
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

  camera.near = Math.max(0.05, pose.dist - DEPTH, pose.clipNear, pose.dist * pose.nearShare);
  camera.far = pose.dist + DEPTH;
  camera.updateProjectionMatrix();
}

export default function CameraRig({ map }: { map: WarehouseMap }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const scene = useThree((s) => s.scene);
  const focus = useGameStore((s) => closeupFocus(s.game));
  // панель ТСД справа — только у личной «Сборки» (M5e1); у игры из развилки интерфейс сверху по центру
  const session = useGameStore((s) => s.game.minigame !== null);
  const depth = useGameStore((s) => s.game.tsdGame !== null);
  const lastInsets = useRef<Insets>(WAREHOUSE_VIEW.closeup.screenInsets);
  const panel = useRef(0); // плавно 0 → 1, когда появляется панель ТСД

  const progress = useRef(0);                 // 0 — дом, 1 — у стеллажа
  const lastRack = useRef<Rack | null>(null); // к какому стеллажу летим (и от какого возвращаемся)
  const fog = useRef(new Fog(FOG, NO_FOG, NO_FOG * 2));
  const yaw = useRef(0);   // поворот и зум, которые сейчас на экране: плавно догоняют store.ui.camera
  const zoom = useRef(WAREHOUSE_VIEW.homeCamera.zoom);
  const gl = useThree((s) => s.gl);
  const phone = usePhone();

  // Мышь над сценой: перетаскивание — поворот, колесо — зум, двойной клик — исходный вид.
  // Пока камера у стеллажа (игра на ТСД), вращать нельзя.
  useEffect(() => {
    const el = gl.domElement;
    const { dragRadPerPx, dragThresholdPx } = WAREHOUSE_VIEW.homeCamera;
    const busy = () => { const g = useGameStore.getState().game; return closeupFocus(g) !== null || g.tsdGame !== null; };
    let down: { x: number; lastX: number; dragging: boolean } | null = null;
    // два пальца — зум (R4 по плану, но без него на телефоне не приблизить): шаг на каждые PHONE.pinchStep изменения расстояния
    const touches = new Map<number, { x: number; y: number }>();
    let pinchFrom = 0;
    const spread = () => { const [a, b] = [...touches.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
    // после перетаскивания браузер всё равно пришлёт «клик» — гасим его, чтобы не выбрать что-то случайно
    const eatClick = (e: MouseEvent) => { e.stopPropagation(); e.preventDefault(); };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (touches.size === 2) { pinchFrom = spread(); down = null; return; } // второй палец — уже не поворот
      }
      if (e.button === 0 && !busy() && touches.size < 2) down = { x: e.clientX, lastX: e.clientX, dragging: false };
    };
    const onMove = (e: PointerEvent) => {
      if (touches.has(e.pointerId)) {
        touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (touches.size === 2 && pinchFrom > 0 && !busy()) {
          const now = spread();
          const ratio = now / pinchFrom;
          if (Math.abs(ratio - 1) >= PHONE.pinchStep) { useGameStore.getState().zoomCamera(ratio > 1 ? 1 : -1); pinchFrom = now; }
          return;
        }
      }
      if (!down) return;
      if (!down.dragging && Math.abs(e.clientX - down.x) < dragThresholdPx) return;
      if (!down.dragging) { down.dragging = true; el.style.cursor = 'grabbing'; }
      useGameStore.getState().dragCamera(-(e.clientX - down.lastX) * dragRadPerPx);
      down.lastX = e.clientX;
    };
    const onUp = (e: PointerEvent) => {
      touches.delete(e.pointerId);
      if (touches.size < 2) pinchFrom = 0;
      if (down?.dragging) {
        window.addEventListener('click', eatClick, { capture: true, once: true });
        setTimeout(() => window.removeEventListener('click', eatClick, { capture: true }), 0);
        el.style.cursor = '';
      }
      down = null;
    };
    const onWheel = (e: WheelEvent) => {
      if (busy()) return;
      e.preventDefault();
      useGameStore.getState().zoomCamera(e.deltaY < 0 ? 1 : -1);
    };
    const onDouble = () => { if (!busy()) useGameStore.getState().resetCamera(); };
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('dblclick', onDouble);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('dblclick', onDouble);
    };
  }, [gl]);

  useFrame((_, delta) => {
    const rack = focus ? map.racks.find((r) => r.aisle === focus.aisle && r.rack === focus.rack) ?? null : null;
    if (rack) {
      lastRack.current = rack;
      lastInsets.current = depth ? WAREHOUSE_VIEW.depthShelf.screenInsets : WAREHOUSE_VIEW.closeup.screenInsets;
    }
    const step = Math.min(delta, 0.1) / TSD.cameraFlySeconds;
    progress.current = rack ? Math.min(1, progress.current + step) : Math.max(0, progress.current - step);
    const t = smooth(progress.current);

    panel.current = session ? Math.min(1, panel.current + step) : Math.max(0, panel.current - step);
    const want = useGameStore.getState().ui.camera;
    const k = 1 - Math.exp(-Math.min(delta, 0.1) * WAREHOUSE_VIEW.homeCamera.follow);
    yaw.current += (want.yaw - yaw.current) * k;
    zoom.current += (want.zoom - zoom.current) * k;
    const home = homePose(map, size, smooth(panel.current), yaw.current, zoom.current, phone);
    const close = lastRack.current ? closePose(lastRack.current, lastInsets.current) : null;
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
