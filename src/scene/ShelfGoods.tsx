// Товар на полках: коробки-заглушки там, где по ФАКТУ что-то лежит.
// Сцена показывает реальность, а не учёт: расхождения игрок узнаёт только через последствия (08, раздел 6).
import type { Stock } from '../model/stock';
import type { Rack, WarehouseMap } from '../model/warehouse';
import { PALETTE } from '../config/palette';
import { cellToWorld } from '../rules/warehouse';
import { RACK_BOARD, rackWidth, shelfY } from './rackGeometry';

type Props = { map: WarehouseMap; stock: Stock };

const BOX = { w: 0.42, h: 0.3, d: 0.4 };
const UNITS_PER_BOX = 4; // одна коробка на каждые 4 штуки
const MAX_BOXES = 3;     // больше трёх на полке 1×2 не помещается

/** Центр основания стеллажа и поворот — так же, как ставится сам стеллаж. */
function rackPlacement(r: Rack): { pos: [number, number, number]; rotY: number } {
  const pts = r.cells.map(cellToWorld);
  const x = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const z = pts.reduce((s, p) => s + p[2], 0) / pts.length;
  return { pos: [x, 0, z], rotY: r.axis === 'z' ? Math.PI / 2 : 0 };
}

export default function ShelfGoods({ map, stock }: Props) {
  // Простой поиск стеллажа по номеру аллеи и стеллажа — это данные карты, не правило игры.
  const racks = new Map(map.racks.map((r) => [`${r.aisle}.${r.rack}`, r]));

  // Сколько штук фактически лежит на каждой полке.
  const perShelf = new Map<string, { rack: Rack; shelf: number; qty: number }>();
  for (const rec of Object.values(stock)) {
    if (rec.actualQty <= 0) continue;
    const rack = racks.get(`${rec.address.aisle}.${rec.address.rack}`);
    if (!rack) continue;
    const key = `${rec.address.aisle}.${rec.address.rack}.${rec.address.shelf}`;
    const prev = perShelf.get(key);
    perShelf.set(key, { rack, shelf: rec.address.shelf, qty: (prev?.qty ?? 0) + rec.actualQty });
  }

  return (
    <group>
      {[...perShelf.entries()].map(([key, { rack, shelf, qty }]) => {
        const { pos, rotY } = rackPlacement(rack);
        const boxes = Math.min(MAX_BOXES, Math.ceil(qty / UNITS_PER_BOX));
        const step = rackWidth(rack.cells.length) / MAX_BOXES;
        const y = shelfY(shelf, rack.shelves) + RACK_BOARD / 2 + BOX.h / 2;
        return (
          <group key={key} position={pos} rotation={[0, rotY, 0]}>
            {Array.from({ length: boxes }, (_, i) => (
              <mesh key={i} position={[(i - (MAX_BOXES - 1) / 2) * step, y, 0]}>
                <boxGeometry args={[BOX.w, BOX.h, BOX.d]} />
                <meshStandardMaterial color={PALETTE.box} />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}
