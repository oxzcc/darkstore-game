// Сборщик на сцене (W7): собака по art/reference/character_picker_*.png (модель — Dog.ts), кольцо под ногами
// в цвете сборщика (08, раздел 3.2: цвет сборщика только у кольца и маршрута) и тележка на сборке и выкладке.
// Части тела — отдельные группы со своей точкой поворота: в W7b они будут качаться при ходьбе и работе.
import { useMemo } from 'react';
import type { DogLook } from '../../config/pickers';
import { WAREHOUSE_VIEW } from '../../config/warehouse';
import VoxelBatch from '../VoxelBatch';
import { dogRig, ARMS_ON_CART, type DogPartName, type DogRig } from './Dog';
import { cartParts } from './Cart';

type Props = {
  position: [number, number, number];
  facing: number;   // поворот вокруг вертикали, радианы
  hop: number;      // подскок при ходьбе, метры (как в Crossy Road, 08, раздел 9)
  look: DogLook;
  ringColor: string;
  withCart: boolean; // катит тележку (сборка и выкладка, решение автора 16.10)
};

/** Квадратное кольцо под ногами (ui_06): четыре плоские полоски. */
function Ring({ color }: { color: string }) {
  const r = 0.42, w = 0.07, y = 0.02;
  const strips: { p: [number, number, number]; s: [number, number, number] }[] = [
    { p: [0, y, -r], s: [2 * r + w, 0.02, w] },
    { p: [0, y, r], s: [2 * r + w, 0.02, w] },
    { p: [-r, y, 0], s: [w, 0.02, 2 * r] },
    { p: [r, y, 0], s: [w, 0.02, 2 * r] },
  ];
  return (
    <group>
      {strips.map((b, i) => (
        <mesh key={i} position={b.p} receiveShadow>
          <boxGeometry args={b.s} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
    </group>
  );
}

/** Одна часть тела: группа в точке поворота, внутри — бруски части. */
function RigPart({ rig, name, rotX = 0 }: { rig: DogRig; name: DogPartName; rotX?: number }) {
  const { pivot, parts } = rig[name];
  return (
    <group position={pivot} rotation={[rotX, 0, 0]}>
      <VoxelBatch parts={parts} />
    </group>
  );
}

const CART = cartParts();
const rigCache = new Map<DogLook, DogRig>();
const rigFor = (look: DogLook) => {
  let r = rigCache.get(look);
  if (!r) rigCache.set(look, (r = dogRig(look)));
  return r;
};

export default function Picker({ position, facing, hop, look, ringColor, withCart }: Props) {
  const rig = useMemo(() => rigFor(look), [look]);
  const arms = withCart ? ARMS_ON_CART : 0;
  const s = WAREHOUSE_VIEW.picker.scale;
  return (
    <group position={position}>
      <Ring color={ringColor} />
      <group rotation={[0, facing, 0]} scale={s}>
        {/* тележка катится по полу — без подскока */}
        {withCart && <VoxelBatch parts={CART} />}
        <group position={[0, hop, 0]}>
          <RigPart rig={rig} name="body" />
          <RigPart rig={rig} name="head" />
          <RigPart rig={rig} name="legL" />
          <RigPart rig={rig} name="legR" />
          <RigPart rig={rig} name="armL" rotX={arms} />
          <RigPart rig={rig} name="armR" rotX={arms} />
          <RigPart rig={rig} name="tail" />
        </group>
      </group>
    </group>
  );
}
