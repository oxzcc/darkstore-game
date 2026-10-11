// 3D-сцена: ортографическая изометрическая камера, склад и сборщики.
// Сцена только рисует карту, которую ей передали.
import { useLayoutEffect } from 'react';
import { Vector3 } from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import type { WarehouseMap } from '../model/warehouse';
import type { Stock } from '../model/stock';
import { WAREHOUSE_VIEW } from '../config/warehouse';
import { PALETTE } from '../config/palette';
import Warehouse from './Warehouse';
import Pickers from './Pickers';

type Props = { map: WarehouseMap; stock: Stock };

const ISO_ELEVATION = Math.atan(1 / Math.SQRT2); // ≈35,26° — классическая изометрия
const SCREEN_FILL = 0.95;                         // доля свободного от интерфейса места, которую занимает склад

// Свет подобран так, чтобы верх объектов был ровно цвета палитры, а бока — темнее.
// Без обработки цветов (flat) Three.js делит свет на π, поэтому умножаем на π.
const AMBIENT_LIGHT = 0.5 * Math.PI;
const SUN_LIGHT = 0.6 * Math.PI;

/** Ставит камеру в изометрию и подбирает приближение, чтобы весь склад влез в окно. */
function IsoCamera({ map }: { map: WarehouseMap }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  useLayoutEffect(() => {
    const cx = map.width / 2;
    const cz = map.depth / 2;
    const dist = 50;
    // Смотрим в середину между полом у ближнего угла и верхом дальних стен — так стены не обрезаются.
    const cy = WAREHOUSE_VIEW.wallHeight / 2;
    camera.position.set(cx + dist, cy + dist, cz + dist);
    camera.lookAt(cx, cy, cz);
    camera.updateMatrixWorld();

    // Место на экране без панелей интерфейса (08, раздел 4: склад — большая часть экрана, UI по краям).
    const ins = WAREHOUSE_VIEW.screenInsets;
    const freeW = Math.max(100, size.width - ins.left - ins.right);
    const freeH = Math.max(100, size.height - ins.top - ins.bottom);

    // Сколько метров склада видно по горизонтали и вертикали под этим углом.
    const diag = (map.width + map.depth) / Math.SQRT2;
    const spanX = diag;
    const spanY = diag * Math.sin(ISO_ELEVATION) + WAREHOUSE_VIEW.wallHeight * Math.cos(ISO_ELEVATION);
    const zoom = Math.min(freeW / spanX, freeH / spanY) * SCREEN_FILL;
    camera.zoom = zoom;

    // Сдвигаем камеру, чтобы центр склада оказался в центре свободного места, а не всего экрана.
    const shiftRight = (ins.left - ins.right) / 2 / zoom;
    const shiftUp = (ins.bottom - ins.top) / 2 / zoom;
    const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    camera.position.addScaledVector(right, -shiftRight).addScaledVector(up, -shiftUp);
    camera.updateProjectionMatrix();
  }, [camera, size, map]);

  return null;
}

export default function Scene({ map, stock }: Props) {
  // flat — без «киношной» обработки цветов, чтобы они совпадали с палитрой из 08.
  return (
    <Canvas flat orthographic camera={{ near: 0.1, far: 500 }}>
      <color attach="background" args={[PALETTE.grass]} />
      <ambientLight intensity={AMBIENT_LIGHT} />
      <directionalLight position={[10, 20, 6]} intensity={SUN_LIGHT} />
      <IsoCamera map={map} />
      <Warehouse map={map} stock={stock} />
      <Pickers />
    </Canvas>
  );
}
