// Сборщик на сцене (W7): собака как в концепт-рендере (модель — Dog.ts), кольцо под ногами
// в цвете сборщика (08, раздел 3.2: цвет сборщика только у кольца и маршрута) и тележка на сборке и выкладке.
// Части тела — отдельные группы со своей точкой поворота: в W7b они будут качаться при ходьбе и работе.
import { useMemo } from 'react';
import { Color } from 'three';
import type { DogLook } from '../../config/pickers';
import { WAREHOUSE_VIEW } from '../../config/warehouse';
import VoxelBatch from '../VoxelBatch';
import { dogRig, ARMS_ON_CART, CART_AHEAD, type DogPartName, type DogRig } from './Dog';
import { cartParts } from './Cart';

type Props = {
  position: [number, number, number];
  facing: number;   // поворот вокруг вертикали, радианы
  hop: number;      // подскок при ходьбе, метры (как в Crossy Road, 08, раздел 9)
  look: DogLook;
  ringColor: string;
  withCart: boolean; // катит тележку (сборка и выкладка, решение автора 16.10)
};

/** Кольцо под ногами — как в концепт-рендере: плоская квадратная рамка светлого оттенка цвета сборщика, без теней. */
function Ring({ color }: { color: string }) {
  const light = useMemo(() => {
    const c = new Color(color);
    const hsl = { h: 0, s: 0, l: 0 };
    c.getHSL(hsl);
    return new Color().setHSL(hsl.h, Math.min(1, hsl.s * 0.95), hsl.l + (1 - hsl.l) * 0.1);
  }, [color]);
  return (
    <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
      <ringGeometry args={[0.5, 0.64, 4, 1]} />
      <meshBasicMaterial color={light} />
    </mesh>
  );
}

/** Одна часть тела: группа в точке поворота, внутри — бруски части. */
function RigPart({ rig, name, rotX = 0 }: { rig: DogRig; name: DogPartName; rotX?: number }) {
  const { pivot, parts } = rig[name];
  return (
    <group position={pivot} rotation={[rotX, 0, 0]}>
      <VoxelBatch parts={parts} soft="strong" />
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
        {withCart && (
          <group position={[0, 0, CART_AHEAD]}>
            <VoxelBatch parts={CART} soft="strong" />
          </group>
        )}
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
