// Мир вокруг склада (W5; 08, раздел 0): трава до горизонта, дорога с бордюрами и разметкой, бетонная площадка у ворот,
// парковка курьеров с велосипедами, пандус от двери выдачи, кольцо деревьев и кустов. Только декорация:
// данные — config/decor.ts, правила игры это не читают.
import { useMemo } from 'react';
import type { Texture } from 'three';
import type { WarehouseMap } from '../model/warehouse';
import { DECOR, type Rect } from '../config/decor';
import { PALETTE } from '../config/palette';
import { WAREHOUSE_VIEW } from '../config/warehouse';
import type { VoxelPart } from './models/ProductItem';
import { treeParts, bushParts } from './models/Tree';
import { bikeParts } from './models/Bike';
import VoxelBatch from './VoxelBatch';
import { asphaltTexture, grassTexture, seeded, slabsTexture, tiled, TEXTURE_METERS } from './textures';

/** Уровень травы — чуть ниже пола склада. */
const GROUND_Y = -WAREHOUSE_VIEW.floorThickness - 0.01;

/** Плоская плита на земле: прямоугольник `r`, толщина `h`, цвет и (если есть) узор. */
function Slab({ r, h, color, map, y = GROUND_Y }: { r: Rect; h: number; color: string; map?: Texture; y?: number }) {
  const w = r.x1 - r.x0, d = r.z1 - r.z0;
  return (
    <mesh position={[(r.x0 + r.x1) / 2, y + h / 2, (r.z0 + r.z1) / 2]} receiveShadow castShadow={h > 0.1}>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial color={color} map={map ?? null} />
    </mesh>
  );
}

/** Прямоугольник, раздутый на `m` метров во все стороны. */
const grow = (r: Rect, m: number): Rect => ({ x0: r.x0 - m, z0: r.z0 - m, x1: r.x1 + m, z1: r.z1 + m });
const inside = (r: Rect, x: number, z: number) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;

/** Где стоят деревья и кусты: случайно в кольце вокруг склада, мимо дороги, площадок и друг друга. */
function decorParts(map: WarehouseMap): VoxelPart[] {
  const T = DECOR.trees;
  const rnd = seeded(T.seed);
  const cx = map.width / 2, cz = map.depth / 2;
  const m = T.clearMargin;
  const blocked: Rect[] = [
    grow({ x0: -0.5, z0: -0.5, x1: map.width + 0.5, z1: map.depth + 0.5 }, m),
    { x0: -1e3, z0: DECOR.road.z0 - m, x1: 1e3, z1: DECOR.road.z1 + m },
    grow(DECOR.apron, m),
    grow(DECOR.parking, m),
    grow(DECOR.parkingPath, m),
  ];
  const placed: { x: number; z: number }[] = [];
  const out: VoxelPart[] = [];
  for (let tries = 0; placed.length < T.count && tries < T.count * 40; tries++) {
    const a = rnd() * Math.PI * 2;
    const r = T.ringFrom + rnd() * (T.ringTo - T.ringFrom);
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    if (blocked.some((b) => inside(b, x, z))) continue;
    if (placed.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < T.minGap ** 2)) continue;
    placed.push({ x, z });
    const bush = rnd() < T.bushShare;
    // размер — одна из нескольких ступеней: одинаковые блоки рисуются одним пакетом (мягкие кубы, W6)
    const steps = bush ? [0.8, 1, 1.2, 1.4] : [0.85, 1, 1.15, 1.3];
    const size = steps[Math.floor(rnd() * steps.length)];
    const parts = bush ? bushParts(size, rnd() * Math.PI, rnd) : treeParts(size, rnd() * Math.PI, rnd);
    for (const p of parts) out.push({ ...p, pos: [p.pos[0] + x, p.pos[1] + GROUND_Y, p.pos[2] + z] });
  }
  return out;
}

/** Разметка парковки, бордюры и штрихи по оси дороги, велосипеды — бруски одним пакетом. */
function streetParts(): VoxelPart[] {
  const out: VoxelPart[] = [];
  const R = DECOR.road;
  const top = GROUND_Y + 0.03;
  // бордюры вдоль дороги
  for (const z of [R.z0, R.z1]) out.push({ pos: [0, GROUND_Y + 0.07, z], size: [R.length, 0.14, R.curb], color: PALETTE.curb });
  // штрихи по оси
  for (let x = -R.length / 2; x < R.length / 2; x += R.dash + R.gap) {
    out.push({ pos: [x + R.dash / 2, top + 0.005, (R.z0 + R.z1) / 2], size: [R.dash, 0.01, 0.14], color: PALETTE.roadMark });
  }
  // разметка мест на парковке
  const P = DECOR.parking;
  const stallHalf = 0.55;
  for (const z of DECOR.bikeStalls) {
    for (const dz of [-stallHalf, stallHalf]) {
      out.push({ pos: [(P.x0 + 1 + P.x1) / 2, GROUND_Y + 0.045, z + dz], size: [P.x1 - P.x0 - 1.2, 0.01, 0.06], color: PALETTE.parkingLine });
    }
  }
  out.push({ pos: [P.x1 - 0.15, GROUND_Y + 0.045, (P.z0 + P.z1) / 2], size: [0.1, 0.01, P.z1 - P.z0 - 0.3], color: PALETTE.accentGreen });
  // велосипеды
  const bike = bikeParts();
  for (const b of DECOR.bikes) for (const p of bike) out.push({ ...p, pos: [p.pos[0] + b.x, p.pos[1] + GROUND_Y + 0.04, p.pos[2] + b.z] });
  return out;
}

export default function World({ map }: { map: WarehouseMap }) {
  const G = DECOR.groundSize;
  const cx = map.width / 2, cz = map.depth / 2;
  const grassMap = useMemo(() => tiled(grassTexture(), G, G, TEXTURE_METERS.grass), [G]);
  const roadMap = useMemo(() => tiled(asphaltTexture(), DECOR.road.length, DECOR.road.z1 - DECOR.road.z0, TEXTURE_METERS.asphalt), []);
  const slab = (r: Rect) => tiled(slabsTexture(), r.x1 - r.x0, r.z1 - r.z0, TEXTURE_METERS.slabs);
  const slabMaps = useMemo(() => ({ apron: slab(DECOR.apron), parking: slab(DECOR.parking), path: slab(DECOR.parkingPath) }), []);
  const decor = useMemo(() => decorParts(map), [map]);
  const street = useMemo(() => streetParts(), []);
  const R = DECOR.road;
  const ramp = DECOR.ramp;

  return (
    <group>
      {/* трава до горизонта */}
      <mesh position={[cx, GROUND_Y, cz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[G, G]} />
        <meshStandardMaterial color={PALETTE.grass} map={grassMap} />
      </mesh>

      {/* дорога, площадка у ворот, парковка курьеров и дорожка к дороге */}
      <Slab r={{ x0: cx - R.length / 2, z0: R.z0, x1: cx + R.length / 2, z1: R.z1 }} h={0.03} color={PALETTE.road} map={roadMap} />
      {/* площадка у ворот — вровень с полом склада: на ней стоит грузовик */}
      <Slab r={DECOR.apron} h={-GROUND_Y} color={PALETTE.slab} map={slabMaps.apron} />
      <Slab r={DECOR.parking} h={0.04} color={PALETTE.slab} map={slabMaps.parking} />
      <Slab r={DECOR.parkingPath} h={0.04} color={PALETTE.slab} map={slabMaps.path} />

      {/* пандус: от пола склада у двери вниз к парковке */}
      <mesh
        position={[(ramp.x0 + ramp.x1) / 2, (GROUND_Y + 0.04) / 2, (ramp.z0 + ramp.z1) / 2]}
        rotation={[0, 0, -Math.atan2(-GROUND_Y, ramp.x1 - ramp.x0)]}
        receiveShadow
      >
        <boxGeometry args={[Math.hypot(ramp.x1 - ramp.x0, GROUND_Y), 0.05, ramp.z1 - ramp.z0]} />
        <meshStandardMaterial color={PALETTE.slab} />
      </mesh>

      <VoxelBatch parts={street} />
      <VoxelBatch parts={decor} />
    </group>
  );
}
