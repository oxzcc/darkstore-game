// Товар на полках: воксельные заглушки там, где по ФАКТУ что-то лежит (M5d).
// Сцена показывает реальность, а не учёт: расхождения игрок узнаёт только через последствия (08, раздел 6).
// Штук нарисовано столько, сколько лежит (до shelfItems.max на полку) — решение автора 12.10.
import { useMemo } from 'react';
import type { Stock } from '../model/stock';
import type { WarehouseMap } from '../model/warehouse';
import { WAREHOUSE_VIEW } from '../config/warehouse';
import { useGameStore } from '../store/gameStore';
import { goodsOnShelves } from '../store/selectors';
import { productParts, type VoxelPart } from './models/ProductItem';
import { rackLocalToWorld } from './rackGeometry';
import { shelfLayout } from './shelfLayout';
import VoxelBatch from './VoxelBatch';

type Props = { map: WarehouseMap; stock: Stock };

export default function ShelfGoods({ map, stock }: Props) {
  const products = useGameStore((s) => s.game.products);

  const parts = useMemo(() => {
    // Простой поиск стеллажа по номеру аллеи и стеллажа — это данные карты, не правило игры.
    const racks = new Map(map.racks.map((r) => [`${r.aisle}.${r.rack}`, r]));
    const size = WAREHOUSE_VIEW.shelfItems.size;
    const out: VoxelPart[] = [];
    for (const { address, contents } of goodsOnShelves(stock)) {
      const rack = racks.get(`${address.aisle}.${address.rack}`);
      if (!rack) continue;
      const layout = shelfLayout(rack, address.shelf, contents);
      const across = rack.axis === 'z'; // стеллаж повёрнут на 90°: размеры по x и z меняются местами
      for (const g of layout.groups) {
        const look = products[g.productId]?.look;
        if (!look) continue;
        const item = productParts(look, size);
        for (const x of g.xs) {
          for (const p of item) {
            const local: [number, number, number] = [x + p.pos[0], layout.y + p.pos[1], layout.z + layout.front * p.pos[2]];
            out.push({
              pos: rackLocalToWorld(rack, local),
              size: across ? [p.size[2], p.size[1], p.size[0]] : p.size,
              color: p.color,
            });
          }
        }
      }
    }
    return out;
  }, [map, stock, products]);

  return <VoxelBatch parts={parts} />;
}
