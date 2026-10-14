// «Срок» на сцене (docs/10-minigames-concept.md, раздел 11.3; прототип и правки автора 14.10).
// Полка у стеллажа (выдвинута и наклонена к игроку, как в «Глубине»), на ней лоток: 4 ряда по 3 штуки товара (low poly, models/ProductLowPoly).
// Клик по штуке — store openExpiryUnit: штука одним плавным движением поднимается с полки к камере (вид осмотра), её можно
// свободно крутить, перетаскивая мышью. Клик мимо штуки — store closeExpiryUnit: она так же плавно возвращается на своё место.
// Пока штука в лотке, на наклейке нет даты — срок читается только в руках. Сцена только рисует; сроки и исход решает rules.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Group, Quaternion, Raycaster, Vector2, Vector3 } from 'three';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type { WarehouseMap } from '../model/warehouse';
import { WAREHOUSE_VIEW } from '../config/warehouse';
import { PALETTE } from '../config/palette';
import { useGameStore } from '../store/gameStore';
import { expiryDate } from '../rules/minigames/expiry';
import { tsdShelfPose } from './closeupView';
import ProductLowPoly, { lowPolySize } from './models/ProductLowPoly';

const V = WAREHOUSE_VIEW.expiryShelf;
const CARTON_SIDE = '#C9A26B';
const CARTON_IN = '#B98F57';
const smooth = (t: number) => t * t * (3 - 2 * t);

export default function ExpiryShelf({ map }: { map: WarehouseMap }) {
  const game = useGameStore((s) => (s.game.tsdGame?.kind === 'expiry' ? s.game.tsdGame : null));
  const products = useGameStore((s) => s.game.products);
  const paused = useGameStore((s) => s.game.clock.paused);
  const openUnit = useGameStore((s) => s.openExpiryUnit);
  const closeUnit = useGameStore((s) => s.closeExpiryUnit);
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const [hover, setHover] = useState<number | null>(null);

  // штука «в руках»: какая (в том числе пока возвращается), насколько поднята (0 — в лотке, 1 — у глаз), как повёрнута игроком
  const [held, setHeld] = useState<number | null>(null);
  const lift = useRef(0);
  const spin = useRef(new Quaternion());
  const heldRef = useRef<Group>(null);
  const slotRefs = useRef<(Group | null)[]>([]);

  const open = game?.open ?? null;
  const finished = !!game?.result;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const active = !!game && !game.result && open === null && held === null && !paused;

  // взяли новую штуку — она «в руках», повёрнута лицом к игроку
  useEffect(() => {
    if (open !== null) { setHeld(open); spin.current.identity(); }
  }, [open]);

  useEffect(() => {
    document.body.style.cursor = active && hover !== null ? 'pointer' : '';
  }, [active, hover]);
  useEffect(() => () => { document.body.style.cursor = ''; }, []);

  // крутить мышью: тянем — штука вращается вокруг осей экрана; короткий клик мимо штуки — положить обратно
  useEffect(() => {
    if (open === null || finished) return;
    const el = gl.domElement;
    let drag: { x: number; y: number; moved: number } | null = null;
    const down = (e: PointerEvent) => { drag = { x: e.clientX, y: e.clientY, moved: 0 }; };
    const move = (e: PointerEvent) => {
      if (!drag || pausedRef.current) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      drag = { x: e.clientX, y: e.clientY, moved: drag.moved + Math.abs(dx) + Math.abs(dy) };
      const k = V.dragRadPerPx;
      const q = new Quaternion()
        .setFromAxisAngle(new Vector3(0, 1, 0), dx * k)
        .multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), dy * k));
      spin.current.premultiply(q); // вращение в осях экрана (камеры)
    };
    const up = (e: PointerEvent) => {
      if (!drag) return;
      const clicked = drag.moved < 6;
      drag = null;
      if (!clicked || pausedRef.current || !heldRef.current) return;
      const rect = el.getBoundingClientRect();
      const ndc = new Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      const ray = new Raycaster();
      ray.setFromCamera(ndc, camera);
      if (ray.intersectObject(heldRef.current, true).length === 0) closeUnit(); // мимо штуки — на полку
    };
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [open, finished, gl, camera, closeUnit]); // без game: он меняется каждый кадр, а перетаскивание сбрасывать нельзя

  // подъём и возврат: штука летит между своим местом в лотке и точкой перед камерой, поворот и размер — плавно
  const tmp = useMemo(() => ({ pos: new Vector3(), q: new Quaternion(), s: new Vector3(), eyePos: new Vector3(), eyeQ: new Quaternion() }), []);
  useFrame((_, delta) => {
    const g = heldRef.current;
    if (held === null || !g) return;
    const step = Math.min(delta, 0.1) / V.liftSeconds;
    lift.current = open !== null ? Math.min(1, lift.current + step) : Math.max(0, lift.current - step);
    if (lift.current === 0 && open === null) { setHeld(null); return; }

    const slot = slotRefs.current[held];
    if (!slot) return;
    slot.matrixWorld.decompose(tmp.pos, tmp.q, tmp.s);
    // у глаз: на inspectDistance перед камерой, чуть ниже центра; повёрнута как камера, плюс поворот игрока
    tmp.eyePos.set(0, -V.inspectDrop, -V.inspectDistance).applyQuaternion(camera.quaternion).add(camera.position);
    tmp.eyeQ.copy(camera.quaternion).multiply(spin.current);
    const t = smooth(lift.current);
    // модель стоит на y = 0 — у глаз её поднимаем на половину высоты, чтобы вращалась вокруг середины
    const parent = g.parent!;
    parent.updateMatrixWorld();
    const worldPos = tmp.pos.clone().lerp(tmp.eyePos, t);
    const worldQ = tmp.q.clone().slerp(tmp.eyeQ, t);
    const scale = 1 + (V.inspectScale - 1) * t;
    g.position.copy(parent.worldToLocal(worldPos));
    const parentQ = new Quaternion();
    parent.getWorldQuaternion(parentQ);
    g.quaternion.copy(parentQ.invert().multiply(worldQ));
    g.scale.setScalar(scale);
    const inner = g.children[0] as Group | undefined;
    if (inner) inner.position.y = -heightOf(held) * 0.5 * t;
  });

  const look = game ? products[game.productId]?.look : undefined;
  const name = game ? products[game.productId]?.name ?? game.productId : '';
  const heightOf = (_i: number) => (look ? lowPolySize(look.shape).h : 0.2);

  if (!game || !look) return null;
  const rack = map.racks.find((r) => r.aisle === game.rack.aisle && r.rack === game.rack.rack);
  if (!rack) return null;
  const { center, yaw } = tsdShelfPose(rack);
  const size = lowPolySize(look.shape);
  const stepX = Math.max(size.w, size.d) + V.gap;
  const stepZ = Math.max(size.w, size.d) + V.gap;
  const cols = 3;
  const rows = Math.ceil(game.units.length / cols);
  const w = cols * stepX + 0.04;
  const d = rows * stepZ + 0.04;
  const h = V.trayHeight;
  const t = 0.012;
  const slot = (i: number): [number, number, number] => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    return [(c - (cols - 1) / 2) * stepX, 0.008, ((rows - 1) / 2 - r) * stepZ];
  };
  const heldUnit = held !== null ? game.units[held] : null;

  return (
    <group position={center} rotation={[0, yaw, 0]}>
      <group rotation={[(WAREHOUSE_VIEW.depthShelf.tiltDeg * Math.PI) / 180, 0, 0]}>
        {/* доска полки */}
        <mesh position={[0, -0.02, 0]}>
          <boxGeometry args={[w + 0.12, 0.04, d + 0.12]} />
          <meshStandardMaterial color={PALETTE.wood} />
        </mesh>
        {/* открытый лоток */}
        <mesh position={[0, 0.004, 0]}>
          <boxGeometry args={[w, 0.008, d]} />
          <meshStandardMaterial color={CARTON_IN} />
        </mesh>
        {[
          { pos: [0, h / 2, d / 2 - t / 2], size: [w, h, t] },
          { pos: [0, h / 2, -d / 2 + t / 2], size: [w, h, t] },
          { pos: [w / 2 - t / 2, h / 2, 0], size: [t, h, d] },
          { pos: [-w / 2 + t / 2, h / 2, 0], size: [t, h, d] },
        ].map((wall, i) => (
          <mesh key={i} position={wall.pos as [number, number, number]}>
            <boxGeometry args={wall.size as [number, number, number]} />
            <meshStandardMaterial color={i === 0 ? CARTON_SIDE : PALETTE.box} />
          </mesh>
        ))}

        {game.units.map((u, i) => {
          const lifted = held === i;
          const up = active && hover === i ? 0.02 : 0;
          return (
            <group key={i} position={slot(i)} ref={(el: Group | null) => { slotRefs.current[i] = el; }}>
              {!lifted && (
                <group position={[0, up, 0]}>
                  <ProductLowPoly look={look} name={name} side={u.side} date={null} />
                  {/* зона клика по габариту штуки */}
                  <mesh
                    position={[0, size.h / 2, 0]}
                    onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); setHover(i); }}
                    onPointerOut={() => setHover((k) => (k === i ? null : k))}
                    onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); if (active) openUnit(i); }}
                  >
                    <boxGeometry args={[stepX * 0.95, size.h, stepZ * 0.95]} />
                    <meshBasicMaterial transparent opacity={0} depthWrite={false} />
                  </mesh>
                  {/* посмотренные — с галочкой; ниже окон интерфейса, при итоге не рисуется */}
                  {u.seen && !game.result && (
                    <Html position={[0, size.h + 0.02, 0]} center zIndexRange={[5, 0]} className="expiry-seen">✓</Html>
                  )}
                </group>
              )}
            </group>
          );
        })}

        {/* штука в руках: летит от своего места к камере и обратно (позиция — в useFrame) */}
        {heldUnit && (
          <group ref={heldRef}>
            <group>
              <ProductLowPoly look={look} name={name} side={heldUnit.side} date={expiryDate(heldUnit.days)} />
            </group>
          </group>
        )}
      </group>
    </group>
  );
}
