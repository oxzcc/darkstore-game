// 3D-сцена: ортографическая изометрическая камера и склад (этап M1).
// Сцена только рисует карту, которую ей передали.
import { useLayoutEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import type { WarehouseMap } from '../model/warehouse';
import { WAREHOUSE_VIEW } from '../config/warehouse';
import { PALETTE } from '../config/palette';
import Warehouse from './Warehouse';

type Props = { map: WarehouseMap };

const ISO_ELEVATION = Math.atan(1 / Math.SQRT2); // ≈35,26° — классическая изометрия
const SCREEN_FILL = 0.9;                          // склад занимает ~90% экрана (08, раздел 4)

/** Ставит камеру в изометрию и подбирает приближение, чтобы весь склад влез в окно. */
function IsoCamera({ map }: Props) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  useLayoutEffect(() => {
    const cx = map.width / 2;
    const cz = map.depth / 2;
    const dist = 50;
    camera.position.set(cx + dist, dist, cz + dist);
    camera.lookAt(cx, 0, cz);

    // Сколько метров склада видно по горизонтали и вертикали под этим углом.
    const diag = (map.width + map.depth) / Math.SQRT2;
    const spanX = diag;
    const spanY = diag * Math.sin(ISO_ELEVATION) + WAREHOUSE_VIEW.wallHeight * Math.cos(ISO_ELEVATION);
    camera.zoom = Math.min(size.width / spanX, size.height / spanY) * SCREEN_FILL;
    camera.updateProjectionMatrix();
  }, [camera, size, map]);

  return null;
}

export default function Scene({ map }: Props) {
  return (
    <Canvas orthographic camera={{ near: 0.1, far: 500 }}>
      <color attach="background" args={[PALETTE.grass]} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[10, 20, 6]} intensity={1.4} />
      <IsoCamera map={map} />
      <Warehouse map={map} />
    </Canvas>
  );
}
