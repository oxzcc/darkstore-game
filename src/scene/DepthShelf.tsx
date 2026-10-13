// «Глубина» на сцене (docs/10-minigames-concept.md, раздел 11.3): полка с коробками-пятнашками у стеллажа.
// Полку как будто выдвинули и наклонили к игроку — она висит перед стеллажом, и видны все ряды
// (передний ряд — ближе к игроку, внизу экрана). Клик по коробке — действие store tapDepthCell; что можно, решает rules.
// Сцена только рисует доску из store и плавно двигает коробки к их клеткам.
import { useEffect, useRef, useState } from 'react';
import { Group, Vector3 } from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type { WarehouseMap } from '../model/warehouse';
import type { DepthBoard } from '../model/tsdGame';
import { WAREHOUSE_VIEW } from '../config/warehouse';
import { PALETTE } from '../config/palette';
import { useGameStore } from '../store/gameStore';
import { closeupEye, closeupLook } from './closeupView';
import { rackFront } from './rackGeometry';

const V = WAREHOUSE_VIEW.depthShelf;
const TARGET_FRAME = '#7FC743';
const HOVER_FRAME = '#FFFFFF';
const FRAME = 0.018;

/** Центр клетки в координатах полки: x — вдоль (слева направо), z — к игроку (передний ряд — больше z). */
function cellPos(b: DepthBoard, cell: number): [number, number] {
  const r = Math.floor(cell / b.cols);
  const c = cell % b.cols;
  return [(c - (b.cols - 1) / 2) * V.cell, ((b.rows - 1) / 2 - r) * V.cell];
}

/** Рамка вокруг коробки сверху. */
function Frame({ color }: { color: string }) {
  const s = V.box + 0.03;
  const y = V.boxHeight + 0.005;
  const bars: { pos: [number, number, number]; size: [number, number, number] }[] = [
    { pos: [0, y, s / 2], size: [s, FRAME, FRAME] },
    { pos: [0, y, -s / 2], size: [s, FRAME, FRAME] },
    { pos: [s / 2, y, 0], size: [FRAME, FRAME, s] },
    { pos: [-s / 2, y, 0], size: [FRAME, FRAME, s] },
  ];
  return (
    <group>
      {bars.map((b, i) => (
        <mesh key={i} position={b.pos}>
          <boxGeometry args={b.size} />
          <meshBasicMaterial color={color} />
        </mesh>
      ))}
    </group>
  );
}

type BoxProps = {
  index: number;      // номер коробки (0 — нужная)
  cell: number;       // в какой клетке сейчас
  board: DepthBoard;
  color: string;      // цвет товара — наклейка сверху
  accent: string;
  hover: boolean;
  active: boolean;    // можно кликать (игра идёт, не пауза)
  onHover: (cell: number | null) => void;
  onTap: (cell: number) => void;
};

function Box({ index, cell, board, color, accent, hover, active, onHover, onTap }: BoxProps) {
  const ref = useRef<Group>(null);
  const target = useRef(new Vector3());
  const [x, z] = cellPos(board, cell);
  target.current.set(x, 0, z);

  // коробка плавно съезжает в новую клетку
  useFrame((_, delta) => {
    const g = ref.current;
    if (!g) return;
    const k = Math.min(1, delta / V.slideSeconds);
    g.position.lerp(target.current, k);
  });

  const isTarget = index === 0;
  const h = V.boxHeight;
  return (
    <group ref={ref} position={[x, 0, z]}>
      <mesh
        position={[0, h / 2, 0]}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); if (active) onHover(cell); }}
        onPointerOut={() => onHover(null)}
        onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); if (active) onTap(cell); }}
      >
        <boxGeometry args={[V.box, h, V.box]} />
        <meshStandardMaterial color={isTarget ? color : PALETTE.box} />
      </mesh>
      {/* наклейка сверху: у нужной — светлая полоса, у остальных — цвет их товара */}
      <mesh position={[0, h + 0.002, 0]}>
        <boxGeometry args={[V.box * 0.62, 0.004, V.box * 0.62]} />
        <meshStandardMaterial color={isTarget ? accent : color} />
      </mesh>
      {isTarget && <Frame color={TARGET_FRAME} />}
      {!isTarget && hover && <Frame color={HOVER_FRAME} />}
      {isTarget && hover && <Frame color={HOVER_FRAME} />}
    </group>
  );
}

export default function DepthShelf({ map }: { map: WarehouseMap }) {
  const game = useGameStore((s) => (s.game.tsdGame?.kind === 'depth' ? s.game.tsdGame : null));
  const products = useGameStore((s) => s.game.products);
  const paused = useGameStore((s) => s.game.clock.paused);
  const tap = useGameStore((s) => s.tapDepthCell);
  const [hover, setHover] = useState<number | null>(null);

  const active = !!game && !game.result && !paused;
  useEffect(() => {
    document.body.style.cursor = active && hover !== null ? 'pointer' : '';
  }, [active, hover]);
  useEffect(() => () => { document.body.style.cursor = ''; }, []);

  if (!game) return null;
  const rack = map.racks.find((r) => r.aisle === game.rack.aisle && r.rack === game.rack.rack);
  if (!rack) return null;

  // полка — на линии взгляда, на distance метров от глаз; «лицом» к игроку
  const eye = closeupEye(rack);
  const look = closeupLook(rack);
  const center = eye.clone().add(look.clone().sub(eye).normalize().multiplyScalar(V.distance));
  const [fx, fz] = rackFront(rack);
  const yaw = Math.atan2(fx, fz);
  const b = game.board;
  const w = b.cols * V.cell;
  const d = b.rows * V.cell;

  return (
    <group position={center} rotation={[0, yaw, 0]}>
      <group rotation={[(V.tiltDeg * Math.PI) / 180, 0, 0]}>
        {/* доска полки и бортики по бокам и сзади */}
        <mesh position={[0, -0.02, 0]}>
          <boxGeometry args={[w + 0.06, 0.04, d + 0.06]} />
          <meshStandardMaterial color={PALETTE.wood} />
        </mesh>
        <mesh position={[0, 0.06, -d / 2 - 0.02]}>
          <boxGeometry args={[w + 0.06, 0.12, 0.02]} />
          <meshStandardMaterial color={PALETTE.metal} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * (w / 2 + 0.02), 0.03, 0]}>
            <boxGeometry args={[0.02, 0.06, d + 0.06]} />
            <meshStandardMaterial color={PALETTE.metal} />
          </mesh>
        ))}
        {/* передний ряд подсвечен: отсюда товар можно взять */}
        <mesh position={[0, 0.002, (d - V.cell) / 2]}>
          <boxGeometry args={[w, 0.004, V.cell]} />
          <meshBasicMaterial color={TARGET_FRAME} transparent opacity={0.25} depthWrite={false} />
        </mesh>
        <Html position={[0, 0, d / 2 + 0.07]} center className="shelf-label depth-front-label">
          передний ряд · отсюда берём
        </Html>

        {b.cells.map((boxIndex, cell) => {
          if (boxIndex < 0) return null;
          const look = products[b.boxes[boxIndex]]?.look;
          return (
            <Box
              key={boxIndex}
              index={boxIndex}
              cell={cell}
              board={b}
              color={look?.color ?? PALETTE.box}
              accent={look?.accent ?? '#ffffff'}
              hover={hover === cell}
              active={active}
              onHover={setHover}
              onTap={tap}
            />
          );
        })}
      </group>
    </group>
  );
}
