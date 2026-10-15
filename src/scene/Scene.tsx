// 3D-сцена: камера (CameraRig: изометрия и вид «глазами сборщика»), склад, грузовик и паллеты поставок, сборщики,
// выбор стеллажа в мини-игре (RackPicking) и клик по товару у стеллажа (RackCloseup), полка-пятнашки «Глубины» (DepthShelf).
// Сцена только рисует карту, которую ей передали.
import { useLayoutEffect, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import type { DirectionalLight } from 'three';
import type { WarehouseMap } from '../model/warehouse';
import type { Stock } from '../model/stock';
import { PALETTE } from '../config/palette';
import { WAREHOUSE_VIEW } from '../config/warehouse';
import Warehouse from './Warehouse';
import Pickers from './Pickers';
import CameraRig from './CameraRig';
import RackPicking from './RackPicking';
import RackCloseup from './RackCloseup';
import DepthShelf from './DepthShelf';
import ExpiryShelf from './ExpiryShelf';
import BarcodeShelf from './BarcodeShelf';
import Deliveries from './Deliveries';
import World from './World';

type Props = { map: WarehouseMap; stock: Stock };

// Свет подобран так, чтобы верх объектов был ровно цвета палитры, а бока — темнее (числа — WAREHOUSE_VIEW.light).
// Без обработки цветов (flat) Three.js делит свет на π, поэтому умножаем на π.
const L = WAREHOUSE_VIEW.light;

/** Солнце с тенями (W2): светит на центр склада, «коробка» теней накрывает склад с запасом. */
function Sun({ map }: { map: WarehouseMap }) {
  const light = useRef<DirectionalLight>(null);
  const scene = useThree((s) => s.scene);
  const cx = map.width / 2, cz = map.depth / 2;
  const r = L.shadowRadius; // полуразмер области теней, м
  useLayoutEffect(() => {
    const l = light.current;
    if (!l) return;
    l.target.position.set(cx, 0, cz);
    scene.add(l.target);
    return () => { scene.remove(l.target); };
  }, [scene, cx, cz]);
  const [fx, fy, fz] = L.sunFrom;
  return (
    <directionalLight
      ref={light}
      castShadow
      position={[cx + fx, fy, cz + fz]}
      color={L.sunColor}
      intensity={L.sun * Math.PI}
      shadow-mapSize={[L.shadowMapSize, L.shadowMapSize]}
      shadow-camera-left={-r}
      shadow-camera-right={r}
      shadow-camera-top={r}
      shadow-camera-bottom={-r}
      shadow-camera-near={1}
      shadow-camera-far={80}
      shadow-bias={L.shadowBias}
      shadow-normalBias={L.shadowNormalBias}
      shadow-intensity={L.shadowStrength}
    />
  );
}

export default function Scene({ map, stock }: Props) {
  // flat — без «киношной» обработки цветов, чтобы они совпадали с палитрой из 08.
  return (
    // Камера перспективная, но дома смотрит издалека с узким углом — выглядит как изометрия (CameraRig).
    <Canvas flat shadows camera={{ fov: 1.5, near: 1, far: 5000, position: [100, 100, 100] }}>
      <color attach="background" args={[PALETTE.grass]} />
      <hemisphereLight args={[L.skyColor, L.groundColor, L.sky * Math.PI]} />
      <Sun map={map} />
      <CameraRig map={map} />
      <World map={map} />
      <Warehouse map={map} stock={stock} />
      <Deliveries map={map} />
      <Pickers />
      <RackPicking map={map} />
      <RackCloseup map={map} stock={stock} />
      <DepthShelf map={map} />
      <ExpiryShelf map={map} />
      <BarcodeShelf map={map} />
    </Canvas>
  );
}
