// Склад: пол, зоны, стены и ворота, стеллажи, столы фасовки. Только отрисовка карты, никаких решений (09, раздел 9).
// Стены (W1, W3): у каждой высокий и низкий вид; та, что оказалась между камерой и складом, показывается низкой.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { BoxGeometry, BufferAttribute, CanvasTexture, Color, Vector3, type Group } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { WallOpening, WallSide, WarehouseMap } from '../model/warehouse';
import type { Stock } from '../model/stock';
import { WAREHOUSE_VIEW } from '../config/warehouse';
import { PALETTE } from '../config/palette';
import { rackParts } from './models/Rack';
import { packingTableParts } from './models/PackingTable';
import { doorParts, doorSignPose, wallBox, wallGradientBoxes, wallHeight, wallSideParts } from './models/Wall';
import { gateParts } from './models/Gate';
import type { VoxelPart } from './models/ProductItem';
import { rackLocalToWorld, rackRotY } from './rackGeometry';
import VoxelBatch, { softRadius } from './VoxelBatch';
import { tiled, tilesTexture, TEXTURE_METERS } from './textures';
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

/** Панель и рёбра стены одним куском с вертикальным градиентом цвета (W3): внизу wallBottom, вверху wallTop. */
function GradientWall({ map, side, tall }: { map: WarehouseMap; side: WallSide; tall: boolean }) {
  const geometry = useMemo(() => {
    const h = wallHeight(tall);
    const bottom = new Color(PALETTE.wallBottom), top = new Color(PALETTE.wallTop), c = new Color();
    const pieces = wallGradientBoxes(map, side, tall).map((b) => {
      const { pos, size } = wallBox(map, side, b.a0, b.a1, b.y0, b.y1, b.i0, b.i1, '');
      // мягкие рёбра, как у остальных моделей (W6)
      const g = new RoundedBoxGeometry(size[0], size[1], size[2], WAREHOUSE_VIEW.softCubes.segments, softRadius(size)).translate(pos[0], pos[1], pos[2]);
      const p = g.attributes.position;
      const colors = new Float32Array(p.count * 3);
      for (let k = 0; k < p.count; k++) {
        c.copy(bottom).lerp(top, Math.min(1, Math.max(0, p.getY(k) / h)));
        colors.set([c.r, c.g, c.b], k * 3);
      }
      g.setAttribute('color', new BufferAttribute(colors, 3));
      return g;
    });
    return mergeGeometries(pieces) ?? new BoxGeometry(0, 0, 0);
  }, [map, side, tall]);
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial vertexColors />
    </mesh>
  );
}

/** Табличка «КУРЬЕРЫ» над дверью выдачи (08, раздел 0). Текст рисуется на холсте шрифтом X5 Sans. */
function DoorSign({ map, door }: { map: WarehouseMap; door: WallOpening }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 96;
    return new CanvasTexture(c);
  }, []);
  useEffect(() => {
    const draw = () => {
      const c = tex.image as HTMLCanvasElement;
      const g = c.getContext('2d')!;
      g.clearRect(0, 0, c.width, c.height);
      g.fillStyle = '#FFF9EC';
      g.font = "700 64px 'X5 Sans', system-ui, sans-serif";
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('КУРЬЕРЫ', c.width / 2, c.height / 2 + 4);
      tex.needsUpdate = true;
    };
    draw();
    document.fonts?.ready.then(draw); // перерисовать, когда шрифт загрузится
  }, [tex]);
  const { pos, rotY } = doorSignPose(map, door);
  return (
    <mesh position={pos} rotation={[0, rotY, 0]}>
      <planeGeometry args={[1.5, 0.28]} />
      <meshBasicMaterial map={tex} transparent toneMapped={false} />
    </mesh>
  );
}

/**
 * Четыре стены (W1, W3). Каждая — в двух видах: высокая и низкая. Та, что между камерой и складом, показывается низкой
 * («срез», как в Moving Out и The Sims): высокая плавно уходит в землю, низкая поднимается.
 */
function Walls({ map }: { map: WarehouseMap }) {
  const sides = useMemo(
    () => SIDES.map((side) => ({ side, tall: wallSideParts(map, side, true), low: wallSideParts(map, side, false) })),
    [map],
  );
  const tallGroups = useRef<(Group | null)[]>([]);
  const lowGroups = useRef<(Group | null)[]>([]);
  const camera = useThree((s) => s.camera);
  const look = useMemo(() => new Vector3(), []);
  const first = useRef(true);
  const tallDrop = -wallHeight(true) - 0.05, lowDrop = -wallHeight(false) - 0.05; // «под землёй» — совсем не видно
  useFrame((_, delta) => {
    camera.getWorldDirection(look); // от камеры в сцену
    // в первый кадр — сразу на место, чтобы ближние стены не «съезжали» при загрузке
    const k = first.current ? 1 : 1 - Math.exp(-Math.min(delta, 0.1) * WAREHOUSE_VIEW.homeCamera.wallFollow);
    first.current = false;
    sides.forEach(({ side }, i) => {
      const [nx, nz] = OUTWARD[side];
      const nearCamera = -(nx * look.x + nz * look.z) > 0.1; // камера по ту сторону стены
      const tg = tallGroups.current[i], lg = lowGroups.current[i];
      if (tg) tg.position.y += ((nearCamera ? tallDrop : 0) - tg.position.y) * k;
      if (lg) lg.position.y += ((nearCamera ? 0 : lowDrop) - lg.position.y) * k;
    });
  });
  return (
    <>
      {sides.map(({ side, tall, low }, i) => (
        <group key={side}>
          <group ref={(el) => { tallGroups.current[i] = el; }}>
            <GradientWall map={map} side={side} tall />
            <VoxelBatch parts={tall} />
          </group>
          <group ref={(el) => { lowGroups.current[i] = el; }}>
            <GradientWall map={map} side={side} tall={false} />
            <VoxelBatch parts={low} />
          </group>
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
  // рисованная плитка (W4): узор повторяется по метрам, цвет — из палитры; трава — в World.tsx (W5)
  const floorMap = useMemo(() => tiled(tilesTexture(), map.width, map.depth, TEXTURE_METERS.tiles), [map]);
  const furniture = useMemo(() => [...allRackParts(map), ...allTableParts()], [map]);
  // ворота и дверь выдачи не опускаются вместе со стеной
  const gates = useMemo(
    () => map.openings.flatMap((o) => (o.kind === 'gate' ? gateParts(map, o) : doorParts(map, o))),
    [map],
  );
  const doors = map.openings.filter((o) => o.kind === 'door');

  return (
    <group>
      {/* Пол склада */}
      <mesh position={[map.width / 2, -ft / 2, map.depth / 2]} receiveShadow>
        <boxGeometry args={[map.width, ft, map.depth]} />
        <meshStandardMaterial color={PALETTE.floor} map={floorMap} />
      </mesh>

      <FloorMarkings map={map} />
      <WallShade map={map} />

      <Walls map={map} />
      <VoxelBatch parts={gates} />
      {doors.map((d, i) => <DoorSign key={i} map={map} door={d} />)}

      <VoxelBatch parts={furniture} />

      <ShelfGoods map={map} stock={stock} />
    </group>
  );
}
