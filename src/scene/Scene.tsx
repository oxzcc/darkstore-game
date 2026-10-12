// 3D-сцена: камера (CameraRig: изометрия и вид «глазами сборщика»), склад, сборщики и выбор стеллажа в мини-игре.
// Сцена только рисует карту, которую ей передали.
import { Canvas } from '@react-three/fiber';
import type { WarehouseMap } from '../model/warehouse';
import type { Stock } from '../model/stock';
import { PALETTE } from '../config/palette';
import Warehouse from './Warehouse';
import Pickers from './Pickers';
import CameraRig from './CameraRig';
import RackPicking from './RackPicking';

type Props = { map: WarehouseMap; stock: Stock };

// Свет подобран так, чтобы верх объектов был ровно цвета палитры, а бока — темнее.
// Без обработки цветов (flat) Three.js делит свет на π, поэтому умножаем на π.
const AMBIENT_LIGHT = 0.5 * Math.PI;
const SUN_LIGHT = 0.6 * Math.PI;

export default function Scene({ map, stock }: Props) {
  // flat — без «киношной» обработки цветов, чтобы они совпадали с палитрой из 08.
  return (
    // Камера перспективная, но дома смотрит издалека с узким углом — выглядит как изометрия (CameraRig).
    <Canvas flat camera={{ fov: 1.5, near: 1, far: 5000, position: [100, 100, 100] }}>
      <color attach="background" args={[PALETTE.grass]} />
      <ambientLight intensity={AMBIENT_LIGHT} />
      <directionalLight position={[10, 20, 6]} intensity={SUN_LIGHT} />
      <CameraRig map={map} />
      <Warehouse map={map} stock={stock} />
      <Pickers />
      <RackPicking map={map} />
    </Canvas>
  );
}
