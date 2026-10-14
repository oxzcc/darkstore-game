// «Глубина» на сцене (docs/10-minigames-concept.md, раздел 11.3): полка с коробками-пятнашками у стеллажа.
// Полку как будто выдвинули и наклонили к игроку — она висит перед стеллажом, и видны все ряды
// (передний ряд — ближе к игроку, внизу экрана). Клик по коробке — выбрать её (store tapDepthBox), подсвечиваются клетки,
// куда её можно сдвинуть (белым); клик по клетке — ход (moveDepthBox). Что можно, решает rules (решение автора 14.10).
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
import { depthMovesFrom } from '../rules/tsdGame';
import { tsdShelfPose } from './closeupView';
import { productParts } from './models/ProductItem';
import type { ProductLook } from '../model/product';

const V = WAREHOUSE_VIEW.depthShelf;
const TARGET_FRAME = '#7FC743';
const HOVER_FRAME = '#FFFFFF';
const SELECT_FRAME = '#1E1E1E';

/** Центр клетки в координатах полки: x — вдоль (слева направо), z — к игроку (передний ряд — больше z). */
function cellPos(b: DepthBoard, cell: number): [number, number] {
  const r = Math.floor(cell / b.cols);
  const c = cell % b.cols;
  return [(c - (b.cols - 1) / 2) * V.cell, ((b.rows - 1) / 2 - r) * V.cell];
}

const CARTON = PALETTE.box;       // борт лотка
const CARTON_SIDE = '#C9A26B';    // стенки лотка
const CARTON_IN = '#B98F57';      // дно лотка изнутри

/**
 * Лоток: открытая картонная тара с 4 штуками товара внутри (решение автора 14.10 по прототипу).
 * Товар — те же воксельные модели, что на полках склада (models/ProductItem), уменьшенные под лоток.
 * Борт подсвечивается: нужный — зелёный, выбранный — тёмный, под курсором — белый.
 */
function Tray({ look, rim, label, labelTarget, showLabel }: { look: ProductLook | null; rim: string; label: string; labelTarget: boolean; showLabel: boolean }) {
  const s = V.box;
  const h = V.boxHeight;
  const t = 0.014; // толщина стенки
  const walls: { pos: [number, number, number]; size: [number, number, number] }[] = [
    { pos: [0, h / 2, s / 2 - t / 2], size: [s, h, t] },
    { pos: [0, h / 2, -s / 2 + t / 2], size: [s, h, t] },
    { pos: [s / 2 - t / 2, h / 2, 0], size: [t, h, s] },
    { pos: [-s / 2 + t / 2, h / 2, 0], size: [t, h, s] },
  ];
  const rimBars: { pos: [number, number, number]; size: [number, number, number] }[] = [
    { pos: [0, h, s / 2 - t], size: [s, 0.012, t * 2] },
    { pos: [0, h, -s / 2 + t], size: [s, 0.012, t * 2] },
    { pos: [s / 2 - t, h, 0], size: [t * 2, 0.012, s] },
    { pos: [-s / 2 + t, h, 0], size: [t * 2, 0.012, s] },
  ];
  const parts = look ? productParts(look, V.unitWidth) : [];
  const q = (s - 2 * t) / 4; // центры четырёх мест в лотке
  const spots: [number, number][] = [[-q, -q], [q, -q], [-q, q], [q, q]];
  return (
    <group>
      <mesh position={[0, 0.004, 0]}>
        <boxGeometry args={[s, 0.008, s]} />
        <meshStandardMaterial color={CARTON_IN} />
      </mesh>
      {walls.map((w, i) => (
        <mesh key={`w${i}`} position={w.pos}>
          <boxGeometry args={w.size} />
          <meshStandardMaterial color={CARTON_SIDE} />
        </mesh>
      ))}
      {rimBars.map((r, i) => (
        <mesh key={`r${i}`} position={r.pos}>
          <boxGeometry args={r.size} />
          <meshStandardMaterial color={rim} />
        </mesh>
      ))}
      {spots.map(([x, z], i) => (
        <group key={`u${i}`} position={[x, 0.008, z]} scale={V.unitScale}>
          {parts.map((p, k) => (
            <mesh key={k} position={p.pos}>
              <boxGeometry args={p.size} />
              <meshStandardMaterial color={p.color} />
            </mesh>
          ))}
        </group>
      ))}
      {/* подпись товара на переднем борту */}
      {/* подписи — ниже окон интерфейса (zIndexRange), а при итоге не рисуются вовсе, чтобы не лезть поверх окна */}
      {showLabel && (
        <Html position={[0, h, s / 2]} center zIndexRange={[5, 0]} className={`shelf-label depth-tray-label${labelTarget ? ' target' : ''}`}>
          {label}
        </Html>
      )}
    </group>
  );
}

type BoxProps = {
  index: number;      // номер лотка (0 — нужный)
  cell: number;       // в какой клетке сейчас
  board: DepthBoard;
  look: ProductLook | null;
  name: string;
  hover: boolean;
  selected: boolean;
  active: boolean;    // можно кликать (игра идёт, не пауза)
  showLabel: boolean; // подпись товара (нет, пока открыто окно итога)
  onHover: (cell: number | null) => void;
  onTap: (cell: number) => void;
};

function Box({ index, cell, board, look, name, hover, selected, active, showLabel, onHover, onTap }: BoxProps) {
  const ref = useRef<Group>(null);
  const target = useRef(new Vector3());
  const [x, z] = cellPos(board, cell);
  target.current.set(x, 0, z);

  // лоток плавно съезжает в новую клетку
  useFrame((_, delta) => {
    const g = ref.current;
    if (!g) return;
    g.position.lerp(target.current, Math.min(1, delta / V.slideSeconds));
  });

  const isTarget = index === 0;
  const rim = selected ? SELECT_FRAME : hover ? HOVER_FRAME : isTarget ? TARGET_FRAME : CARTON;
  return (
    <group ref={ref} position={[x, 0, z]}>
      {/* невидимый блок по размеру лотка — в него попадает клик */}
      <mesh
        position={[0, V.boxHeight, 0]}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); if (active) onHover(cell); }}
        onPointerOut={() => onHover(null)}
        onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); if (active) onTap(cell); }}
      >
        <boxGeometry args={[V.box, V.boxHeight * 2, V.box]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <Tray look={look} rim={rim} label={name} labelTarget={isTarget} showLabel={showLabel} />
    </group>
  );
}

export default function DepthShelf({ map }: { map: WarehouseMap }) {
  const game = useGameStore((s) => (s.game.tsdGame?.kind === 'depth' ? s.game.tsdGame : null));
  const products = useGameStore((s) => s.game.products);
  const paused = useGameStore((s) => s.game.clock.paused);
  const tap = useGameStore((s) => s.tapDepthBox);
  const move = useGameStore((s) => s.moveDepthBox);
  const selected = useGameStore((s) => s.ui.depthSelected);
  const fullGame = useGameStore((s) => s.game);
  const [hover, setHover] = useState<number | null>(null);

  const active = !!game && !game.result && !paused;
  useEffect(() => {
    document.body.style.cursor = active && hover !== null ? 'pointer' : '';
  }, [active, hover]);
  useEffect(() => () => { document.body.style.cursor = ''; }, []);

  if (!game) return null;
  const targets = selected === null ? [] : depthMovesFrom(fullGame, selected);
  const rack = map.racks.find((r) => r.aisle === game.rack.aisle && r.rack === game.rack.rack);
  if (!rack) return null;

  // полка — на линии взгляда, на distance метров от глаз; «лицом» к игроку
  const { center, yaw } = tsdShelfPose(rack);
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
        {/* клетка выхода: нужная коробка на ней — игра закончена сама (решение автора 14.10) */}
        <mesh position={[cellPos(b, b.exit)[0], 0.002, cellPos(b, b.exit)[1]]}>
          <boxGeometry args={[V.cell, 0.004, V.cell]} />
          <meshBasicMaterial color={TARGET_FRAME} transparent opacity={0.45} depthWrite={false} />
        </mesh>
        {!game.result && (
          <Html position={[cellPos(b, b.exit)[0], 0, d / 2 + 0.07]} center zIndexRange={[5, 0]} className="shelf-label depth-front-label">
            сюда
          </Html>
        )}

        {/* куда можно сдвинуть выбранную коробку — прозрачные белые клетки, клик — ход */}
        {active && targets.map((cell) => {
          const [x, z] = cellPos(b, cell);
          return (
            <mesh
              key={`t${cell}`}
              position={[x, 0.01, z]}
              onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); setHover(cell); }}
              onPointerOut={() => setHover(null)}
              onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); move(cell); }}
            >
              <boxGeometry args={[V.box, 0.01, V.box]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={hover === cell ? 0.9 : 0.6} depthWrite={false} />
            </mesh>
          );
        })}

        {b.cells.map((boxIndex, cell) => {
          if (boxIndex < 0) return null;
          const product = products[b.boxes[boxIndex]];
          return (
            <Box
              key={boxIndex}
              index={boxIndex}
              cell={cell}
              board={b}
              look={product?.look ?? null}
              name={product?.name ?? b.boxes[boxIndex]}
              hover={hover === cell}
              selected={selected === cell}
              active={active}
              showLabel={!game.result}
              onHover={setHover}
              onTap={tap}
            />
          );
        })}
      </group>
    </group>
  );
}
