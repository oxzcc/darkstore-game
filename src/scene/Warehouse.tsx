// Склад: пол, зоны, стены и ворота, стеллажи, столы фасовки. Только отрисовка карты, никаких решений (09, раздел 9).
// Стены (W1): все четыре высокие; та, что оказалась между камерой и складом, плавно уходит в землю до высоты низкой стены.
import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CanvasTexture, Vector3, type Group } from 'three';
import type { WallSide, WarehouseMap } from '../model/warehouse';
import type { Stock } from '../model/stock';
import { WAREHOUSE_VIEW } from '../config/warehouse';
import { PALETTE } from '../config/palette';
import { rackParts } from './models/Rack';
import { packingTableParts } from './models/PackingTable';
import { wallSideParts } from './models/Wall';
import { gateParts } from './models/Gate';
import type { VoxelPart } from './models/ProductItem';
import { rackLocalToWorld, rackRotY } from './rackGeometry';
import VoxelBatch from './VoxelBatch';
import FloorMarkings from './FloorMarkings';
import ShelfGoods from './ShelfGoods';

type Props = { map: WarehouseMap; stock: Stock };

/** Кубики всех стеллажей в координатах сцены — один пакет на весь склад (instancing, 08, раздел 11). */
function allRackParts(map: WarehouseMap): VoxelPart[] {
  const out: VoxelPart[] = [];
  const cache = new Map<string, VoxelPart[]>(); // одинаковые стеллажи считаем один раз
  for (const r of map.racks) {
    const key = `${r.cells.length}x${r.shelves}`;
    let local = cache.get(key);
    if (!local) {
      local = rackParts(r.cells.length, r.shelves);
      cache.set(key, local);
    }
    const turn = rackRotY(r); // поворот стеллажа вокруг вертикали прибавляется к наклону бруска (см. VoxelPart.rot)
    for (const p of local) {
      const [rx, ry, rz] = p.rot ?? [0, 0, 0];
      out.push({
        pos: rackLocalToWorld(r, p.pos),
        size: p.size,
        color: p.color,
        rot: turn || p.rot ? [rx, ry + turn, rz] : undefined,
      });
    }
  }
  return out;
}

/** Столы фасовки (декорация, места — WAREHOUSE_VIEW.packingTables): стол 2×1 вдоль x, лицом к проходу (−z). */
function allTableParts(): VoxelPart[] {
  const s = WAREHOUSE_VIEW.cellSize;
  const local = packingTableParts(2);
  return WAREHOUSE_VIEW.packingTables.flatMap((c) =>
    local.map((p) => ({ ...p, pos: [p.pos[0] + (c.x + 1) * s, p.pos[1], p.pos[2] + (c.z + 0.5) * s] as VoxelPart['pos'] })),
  );
}

const SIDES: WallSide[] = ['north', 'south', 'west', 'east'];
/** Куда смотрит стена наружу (x, z). */
const OUTWARD: Record<WallSide, [number, number]> = { north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0] };

/** Четыре стены; ближняя к камере опускается («срез», как в Moving Out и The Sims). */
function Walls({ map }: { map: WarehouseMap }) {
  const sides = useMemo(() => SIDES.map((side) => ({ side, parts: wallSideParts(map, side, true) })), [map]);
  const groups = useRef<(Group | null)[]>([]);
  const camera = useThree((s) => s.camera);
  const look = useMemo(() => new Vector3(), []);
  const first = useRef(true);
  const drop = WAREHOUSE_VIEW.wallHeight - WAREHOUSE_VIEW.frontWallHeight;
  useFrame((_, delta) => {
    camera.getWorldDirection(look); // от камеры в сцену
    // в первый кадр — сразу на место, чтобы ближние стены не «съезжали» при загрузке
    const k = first.current ? 1 : 1 - Math.exp(-Math.min(delta, 0.1) * WAREHOUSE_VIEW.homeCamera.wallFollow);
    first.current = false;
    sides.forEach(({ side }, i) => {
      const g = groups.current[i];
      if (!g) return;
      const [nx, nz] = OUTWARD[side];
      const nearCamera = -(nx * look.x + nz * look.z) > 0.1; // камера по ту сторону стены
      const target = nearCamera ? -drop : 0;
      g.position.y += (target - g.position.y) * k;
    });
  });
  return (
    <>
      {sides.map(({ side, parts }, i) => (
        <group key={side} ref={(el) => { groups.current[i] = el; }}>
          <VoxelBatch parts={parts} />
        </group>
      ))}
    </>
  );
}

/** Нарисованная мягкая тень на полу вдоль стен (W2; 08, раздел 0): полоса, тёмная у стены и прозрачная к центру. */
function WallShade({ map }: { map: WarehouseMap }) {
  const { width, opacity } = WAREHOUSE_VIEW.light.wallShade;
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 4; c.height = 64;
    const g = c.getContext('2d')!;
    const grad = g.createLinearGradient(0, 0, 0, 64);
    grad.addColorStop(0, 'rgba(70,55,30,1)');
    grad.addColorStop(1, 'rgba(70,55,30,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 4, 64);
    return new CanvasTexture(c);
  }, []);
  const s = WAREHOUSE_VIEW.cellSize, W = map.width * s, D = map.depth * s, y = 0.006;
  // полоса вдоль стены: центр, длина, поворот (тёмный край текстуры — к стене)
  const strips: { pos: [number, number, number]; len: number; rotZ: number }[] = [
    { pos: [W / 2, y, width / 2], len: W, rotZ: 0 },             // север
    { pos: [W / 2, y, D - width / 2], len: W, rotZ: Math.PI },   // юг
    { pos: [width / 2, y, D / 2], len: D, rotZ: Math.PI / 2 },   // запад
    { pos: [W - width / 2, y, D / 2], len: D, rotZ: -Math.PI / 2 }, // восток
  ];
  return (
    <>
      {strips.map((st, i) => (
        <mesh key={i} position={st.pos} rotation={[-Math.PI / 2, 0, st.rotZ]} renderOrder={1}>
          <planeGeometry args={[st.len, width]} />
          <meshBasicMaterial map={tex} transparent opacity={opacity} depthWrite={false} />
        </mesh>
      ))}
    </>
  );
}

export default function Warehouse({ map, stock }: Props) {
  const { floorThickness: ft } = WAREHOUSE_VIEW;
  const furniture = useMemo(() => [...allRackParts(map), ...allTableParts()], [map]);
  const gates = useMemo(() => map.openings.filter((o) => o.kind === 'gate').flatMap((g) => gateParts(map, g)), [map]);

  return (
    <group>
      {/* Трава вокруг склада */}
      <mesh position={[map.width / 2, -ft - 0.01, map.depth / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[map.width * 4, map.depth * 4]} />
        <meshStandardMaterial color={PALETTE.grass} />
      </mesh>

      {/* Пол склада */}
      <mesh position={[map.width / 2, -ft / 2, map.depth / 2]} receiveShadow>
        <boxGeometry args={[map.width, ft, map.depth]} />
        <meshStandardMaterial color={PALETTE.floor} />
      </mesh>

      <FloorMarkings map={map} />
      <WallShade map={map} />

      <Walls map={map} />
      <VoxelBatch parts={gates} />

      <VoxelBatch parts={furniture} />

      <ShelfGoods map={map} stock={stock} />
    </group>
  );
}
