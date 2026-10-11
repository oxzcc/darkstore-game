// 3D-сцена. Этап M0: проверяем, что React Three Fiber работает, — один вращающийся куб.
// На M1 здесь появятся изометрическая камера и склад.
import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import type { Mesh } from 'three';

const PRIMARY = '#428C00'; // основной цвет игры (docs/08-art-style.md, раздел 3)

function SpinningCube() {
  const ref = useRef<Mesh>(null);

  // Вращение — только украшение для проверки, игровой логики тут нет.
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.8;
  });

  return (
    <mesh ref={ref} rotation={[0.4, 0, 0]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={PRIMARY} />
    </mesh>
  );
}

export default function Scene() {
  return (
    <Canvas camera={{ position: [3, 3, 3], fov: 50 }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 3]} intensity={1.2} />
      <SpinningCube />
    </Canvas>
  );
}
