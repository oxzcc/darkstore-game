// «Срок» на сцене (docs/10-minigames-concept.md, раздел 11.3; прототип одобрен автором 14.10):
// полка у стеллажа (выдвинута и наклонена к игроку, как в «Глубине»), на ней лоток с несколькими штуками товара.
// Клик по штуке — store openExpiryUnit: она поднимается крупно на экране ТСД (minigames/expiry/ExpiryTsd.tsx), её крутят и читают срок.
// Сцена только рисует; какой срок у какой штуки, решает rules.
import { useEffect, useState } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type { WarehouseMap } from '../model/warehouse';
import { WAREHOUSE_VIEW } from '../config/warehouse';
import { PALETTE } from '../config/palette';
import { useGameStore } from '../store/gameStore';
import { tsdShelfPose } from './closeupView';
import { productParts } from './models/ProductItem';

const V = WAREHOUSE_VIEW.expiryShelf;
const CARTON_SIDE = '#C9A26B';
const CARTON_IN = '#B98F57';

export default function ExpiryShelf({ map }: { map: WarehouseMap }) {
  const game = useGameStore((s) => (s.game.tsdGame?.kind === 'expiry' ? s.game.tsdGame : null));
  const products = useGameStore((s) => s.game.products);
  const paused = useGameStore((s) => s.game.clock.paused);
  const open = useGameStore((s) => s.openExpiryUnit);
  const [hover, setHover] = useState<number | null>(null);

  const active = !!game && !game.result && game.open === null && !paused;
  useEffect(() => {
    document.body.style.cursor = active && hover !== null ? 'pointer' : '';
  }, [active, hover]);
  useEffect(() => () => { document.body.style.cursor = ''; }, []);

  if (!game) return null;
  const rack = map.racks.find((r) => r.aisle === game.rack.aisle && r.rack === game.rack.rack);
  if (!rack) return null;
  const { center, yaw } = tsdShelfPose(rack);
  const look = products[game.productId]?.look;
  const parts = look ? productParts(look, 0.15) : [];
  const n = game.units.length;
  const w = n * V.spacing + 0.08; // лоток
  const d = V.trayDepth;
  const h = V.trayHeight;
  const t = 0.016;

  return (
    <group position={center} rotation={[0, yaw, 0]}>
      <group rotation={[(WAREHOUSE_VIEW.depthShelf.tiltDeg * Math.PI) / 180, 0, 0]}>
        {/* доска полки */}
        <mesh position={[0, -0.02, 0]}>
          <boxGeometry args={[w + 0.16, 0.04, d + 0.16]} />
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
          if (game.open === i) return null; // поднята крупно на экране
          const x = (i - (n - 1) / 2) * V.spacing;
          const lift = active && hover === i ? 0.03 : 0;
          return (
            <group key={i} position={[x, 0.008 + lift, 0]}>
              <group scale={V.unitScale}>
                {parts.map((p, k) => (
                  <mesh key={k} position={p.pos}>
                    <boxGeometry args={p.size} />
                    <meshStandardMaterial color={p.color} />
                  </mesh>
                ))}
              </group>
              {/* зона клика по размеру штуки */}
              <mesh
                position={[0, V.unitHeight / 2, 0]}
                onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); setHover(i); }}
                onPointerOut={() => setHover((k) => (k === i ? null : k))}
                onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); if (active) open(i); }}
              >
                <boxGeometry args={[V.spacing * 0.9, V.unitHeight, d]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              </mesh>
              {/* номер штуки; посмотренные — серым (как в прототипе). Ниже окон интерфейса, при итоге не рисуется */}
              {!game.result && (
                <Html position={[0, V.unitHeight + 0.03, 0]} center zIndexRange={[5, 0]}
                  className={`expiry-num${u.seen ? ' seen' : ''}`}>
                  {i + 1}
                </Html>
              )}
            </group>
          );
        })}
      </group>
    </group>
  );
}
