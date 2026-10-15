// Выбор стеллажа во время мини-игры (06, раздел 2.2): наведение — подпись «2.3», клик — действие store.
// Выбранный стеллаж обведён на полу основным зелёным (синий занят Лаки, 08, раздел 3.2).
// Сцена ничего не решает: можно ли выбрать стеллаж, проверяет rules (chooseRack).
import { useState } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import SceneHtml from './SceneHtml';
import type { Rack, WarehouseMap } from '../model/warehouse';
import { WAREHOUSE_VIEW } from '../config/warehouse';
import { PALETTE } from '../config/palette';
import { useGameStore } from '../store/gameStore';
import { rackCenter, rackWidth } from './rackGeometry';

const OUTLINE = 0.08;  // ширина рамки на полу
const MARGIN = 0.12;   // насколько рамка шире стеллажа
const HOVER_COLOR = '#7FC743'; // светлый основной (08, раздел 3.1: «подсветка»)

/** Прямоугольная рамка на полу вокруг стеллажа. */
function FloorFrame({ rack, color }: { rack: Rack; color: string }) {
  const [x, , z] = rackCenter(rack);
  const len = rackWidth(rack.cells.length) + MARGIN * 2;
  const dep = WAREHOUSE_VIEW.rackDepth + MARGIN * 2;
  // вдоль оси стеллажа — длина, поперёк — глубина
  const [sx, sz] = rack.axis === 'z' ? [dep, len] : [len, dep];
  const bars: { pos: [number, number, number]; size: [number, number, number] }[] = [
    { pos: [x, 0.02, z - sz / 2], size: [sx, 0.02, OUTLINE] },
    { pos: [x, 0.02, z + sz / 2], size: [sx, 0.02, OUTLINE] },
    { pos: [x - sx / 2, 0.02, z], size: [OUTLINE, 0.02, sz] },
    { pos: [x + sx / 2, 0.02, z], size: [OUTLINE, 0.02, sz] },
  ];
  return (
    <group>
      {bars.map((b, i) => (
        <mesh key={i} position={b.pos}>
          <boxGeometry args={b.size} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
    </group>
  );
}

export default function RackPicking({ map }: { map: WarehouseMap }) {
  const session = useGameStore((s) => s.game.minigame);
  const paused = useGameStore((s) => s.game.clock.paused);
  const chooseRack = useGameStore((s) => s.chooseRack);
  const [hover, setHover] = useState<string | null>(null);

  if (!session) return null;
  // клики принимаются в общем виде склада и не на паузе (06, раздел 3)
  const clickable = !session.atFocus && !paused;
  const focusKey = session.focus ? `${session.focus.aisle}.${session.focus.rack}` : null;

  const setCursor = (c: string) => { document.body.style.cursor = c; };

  return (
    <group>
      {map.racks.map((r) => {
        const key = `${r.aisle}.${r.rack}`;
        const [x, , z] = rackCenter(r);
        const len = rackWidth(r.cells.length);
        const dep = WAREHOUSE_VIEW.rackDepth;
        const h = WAREHOUSE_VIEW.rackHeight;
        const isHover = clickable && hover === key;
        return (
          <group key={key}>
            {/* невидимый блок по размеру стеллажа — в него попадает клик */}
            {clickable && (
              <mesh
                position={[x, h / 2, z]}
                onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); setHover(key); setCursor('pointer'); }}
                onPointerOut={() => { setHover((k) => (k === key ? null : k)); setCursor(''); }}
                onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); setHover(null); setCursor(''); chooseRack(r.aisle, r.rack); }}
              >
                <boxGeometry args={r.axis === 'z' ? [dep, h, len] : [len, h, dep]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              </mesh>
            )}
            {key === focusKey && <FloorFrame rack={r} color={PALETTE.primary} />}
            {isHover && key !== focusKey && <FloorFrame rack={r} color={HOVER_COLOR} />}
            {isHover && (
              <SceneHtml position={[x, h + 0.35, z]} center className="rack-label">{key}</SceneHtml>
            )}
          </group>
        );
      })}
    </group>
  );
}
