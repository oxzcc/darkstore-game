// «Штрихкод» на сцене (docs/10-minigames-concept.md, раздел 11.3; прототип и правки автора 14.10).
// Порядок вступления (решение автора): 1) камера подлетает к стеллажу (CameraRig), 2) нужную штуку достают с полки,
// 3) она сама поворачивается к игроку стороной со штрихкодом. Дальше штука висит перед камерой слева, справа — ТСД.
// Сцена только рисует: время вступления — game.elapsed, код и сторона наклейки — из store (rules/minigames/barcode.ts).
import { useMemo, useRef } from 'react';
import { Group, PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { WarehouseMap } from '../model/warehouse';
import { WAREHOUSE_VIEW } from '../config/warehouse';
import { PALETTE } from '../config/palette';
import { useGameStore } from '../store/gameStore';
import { tsdShelfPose } from './closeupView';
import ProductLowPoly, { lowPolySize } from './models/ProductLowPoly';
import { PHONE } from '../config/phone';
import { isPhone } from '../app/usePhone';

const V = WAREHOUSE_VIEW.barcodeShelf;
const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const Y = new Vector3(0, 1, 0);
const X = new Vector3(1, 0, 0);

/** Поворот, который ставит сторону с наклейкой лицом к игроку (0 перед, 1 право, 2 зад, 3 лево, 5 низ). */
function faceTurn(side: number): Quaternion {
  const q = new Quaternion();
  if (side === 1) return q.setFromAxisAngle(Y, -Math.PI / 2);
  if (side === 2) return q.setFromAxisAngle(Y, Math.PI);
  if (side === 3) return q.setFromAxisAngle(Y, Math.PI / 2);
  if (side === 5) return q.setFromAxisAngle(X, -Math.PI / 2);
  return q;
}

export default function BarcodeShelf({ map }: { map: WarehouseMap }) {
  const game = useGameStore((s) => (s.game.tsdGame?.kind === 'barcode' ? s.game.tsdGame : null));
  const products = useGameStore((s) => s.game.products);
  const camera = useThree((s) => s.camera);
  const heldRef = useRef<Group>(null);
  const slotRef = useRef<Group>(null);
  const tmp = useMemo(() => ({
    slotPos: new Vector3(), slotQ: new Quaternion(), slotS: new Vector3(),
    eyePos: new Vector3(), front: new Quaternion(), turned: new Quaternion(), tilt: new Quaternion(), q: new Quaternion(), parentQ: new Quaternion(),
  }), []);

  const look = game ? products[game.productId]?.look : undefined;
  const height = look ? lowPolySize(look.shape).h : 0.2;
  const side = game?.side ?? 0;

  useFrame(() => {
    const g = heldRef.current;
    const slot = slotRef.current;
    const tsd = useGameStore.getState().game.tsdGame;
    if (!g || !slot || tsd?.kind !== 'barcode') return;
    const e = tsd.elapsed;
    const lift = smooth(clamp01((e - V.liftAt) / V.liftSeconds));
    const turn = smooth(clamp01((e - V.liftAt - V.liftSeconds) / V.turnSeconds));

    slot.updateMatrixWorld();
    slot.matrixWorld.decompose(tmp.slotPos, tmp.slotQ, tmp.slotS);
    // у глаз: левее центра (справа — ТСД), на inspectDistance перед камерой.
    // На телефоне (R3) терминал снизу: штука по центру и выше — на долю barcodeRaise половины высоты кадра
    const phone = isPhone();
    const halfH = V.inspectDistance * Math.tan(((camera as PerspectiveCamera).fov * Math.PI) / 360);
    const x = phone ? 0 : V.inspectOffsetX;
    const y = phone ? halfH * PHONE.closeup.barcodeRaise : -V.inspectDrop;
    tmp.eyePos.set(x, y, -V.inspectDistance).applyQuaternion(camera.quaternion).add(camera.position);
    // лицом к игроку и чуть наискосок — чтобы было видно, что это объёмная упаковка
    tmp.tilt.setFromAxisAngle(Y, V.tiltYaw).multiply(new Quaternion().setFromAxisAngle(X, V.tiltPitch));
    tmp.front.copy(camera.quaternion).multiply(tmp.tilt);
    tmp.turned.copy(tmp.front).multiply(faceTurn(side));

    const worldPos = tmp.slotPos.clone().lerp(tmp.eyePos, lift);
    if (turn > 0) tmp.q.copy(tmp.front).slerp(tmp.turned, turn);
    else tmp.q.copy(tmp.slotQ).slerp(tmp.front, lift);

    const parent = g.parent!;
    parent.updateMatrixWorld();
    g.position.copy(parent.worldToLocal(worldPos));
    parent.getWorldQuaternion(tmp.parentQ);
    g.quaternion.copy(tmp.parentQ.invert().multiply(tmp.q));
    g.scale.setScalar(1 + (V.inspectScale - 1) * lift);
    // вращение вокруг середины штуки, а не её дна
    const inner = g.children[0] as Group | undefined;
    if (inner) inner.position.y = -height * 0.5 * lift;
  });

  if (!game || !look) return null;
  const rack = map.racks.find((r) => r.aisle === game.rack.aisle && r.rack === game.rack.rack);
  if (!rack) return null;
  const { center, yaw } = tsdShelfPose(rack);
  const size = lowPolySize(look.shape);
  const step = Math.max(size.w, size.d) + 0.04;
  const name = products[game.productId]?.name ?? game.productId;
  const sticker = { kind: 'barcode' as const, code: game.code, hiddenFrom: game.hiddenFrom, hiddenCount: game.hiddenCount };

  return (
    <group position={center} rotation={[0, yaw, 0]}>
      <group rotation={[(WAREHOUSE_VIEW.depthShelf.tiltDeg * Math.PI) / 180, 0, 0]}>
        {/* полка: доска и две соседние штуки того же товара (наклейкой назад) */}
        <mesh position={[0, -0.02, 0]}>
          <boxGeometry args={[step * 3 + 0.12, 0.04, size.d + 0.16]} />
          <meshStandardMaterial color={PALETTE.wood} />
        </mesh>
        {[-1, 1].map((k) => (
          <group key={k} position={[k * step, 0, 0]}>
            <ProductLowPoly look={look} name={name} side={2} sticker={sticker} />
          </group>
        ))}
        {/* место нужной штуки на полке — от него она летит к глазам */}
        <group ref={slotRef} position={[0, 0, 0]} />
        <group ref={heldRef}>
          <group>
            <ProductLowPoly look={look} name={name} side={game.side} sticker={sticker} />
          </group>
        </group>
      </group>
    </group>
  );
}
