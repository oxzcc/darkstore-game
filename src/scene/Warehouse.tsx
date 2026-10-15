// Склад: пол, зоны, стены и ворота, стеллажи, столы фасовки. Только отрисовка карты, никаких решений (09, раздел 9).
import { useMemo } from 'react';
import type { WarehouseMap } from '../model/warehouse';
import type { Stock } from '../model/stock';
import { WAREHOUSE_VIEW } from '../config/warehouse';
import { PALETTE } from '../config/palette';
import { rackParts } from './models/Rack';
import { packingTableParts } from './models/PackingTable';
import { wallParts } from './models/Wall';
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

export default function Warehouse({ map, stock }: Props) {
  const { floorThickness: ft } = WAREHOUSE_VIEW;
  const furniture = useMemo(() => [...allRackParts(map), ...allTableParts()], [map]);
  const walls = useMemo(
    () => [...wallParts(map), ...map.openings.filter((o) => o.kind === 'gate').flatMap((g) => gateParts(map, g))],
    [map],
  );

  return (
    <group>
      {/* Трава вокруг склада */}
      <mesh position={[map.width / 2, -ft - 0.01, map.depth / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[map.width * 4, map.depth * 4]} />
        <meshStandardMaterial color={PALETTE.grass} />
      </mesh>

      {/* Пол склада */}
      <mesh position={[map.width / 2, -ft / 2, map.depth / 2]}>
        <boxGeometry args={[map.width, ft, map.depth]} />
        <meshStandardMaterial color={PALETTE.floor} />
      </mesh>

      <FloorMarkings map={map} />

      <VoxelBatch parts={walls} />

      <VoxelBatch parts={furniture} />

      <ShelfGoods map={map} stock={stock} />
    </group>
  );
}
