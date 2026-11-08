// Товар на полках: штуки там, где по ФАКТУ что-то лежит (M5d). Сцена показывает остатки склада как есть; считает их rules (shelfContents).
// G1a (решение автора 07.11, вариант «а»): каждая штука отдельно, сколько лежит — столько видно (до 10),
// в настоящих пропорциях своей формы (та же таблица, что у моделей игр на ТСД — models/productShapes.ts), увеличенная в shelfItems.scale раз.
// Где стоит каждая штука и как повёрнута — shelfLayout. Все товары склада — один VoxelBatch (instancing).
import { useMemo } from 'react';
import type { Stock } from '../model/stock';
import type { WarehouseMap } from '../model/warehouse';
import { WAREHOUSE_VIEW } from '../config/warehouse';
import { useGameStore } from '../store/gameStore';
import { goodsOnShelves } from '../store/selectors';
import type { VoxelPart } from './models/ProductItem';
import { lowPolySize, productShapeParts } from './models/productShapes';
import { rackLocalToWorld, rackRotY } from './rackGeometry';
import { shelfLayout } from './shelfLayout';
import VoxelBatch from './VoxelBatch';

/** Товар стоит на 2 мм выше доски: его дно не совпадает с верхом полки (иначе грани «дерутся»). */
const LIFT = 0.002;

type Props = { map: WarehouseMap; stock: Stock };

export default function ShelfGoods({ map, stock }: Props) {
  const products = useGameStore((s) => s.game.products);

  const parts = useMemo(() => {
    // Простой поиск стеллажа по номеру аллеи и стеллажа — это данные карты, не правило игры.
    const racks = new Map(map.racks.map((r) => [`${r.aisle}.${r.rack}`, r]));
    const shapes = new Map<string, VoxelPart[]>(); // детали одной штуки — один раз на товар
    const out: VoxelPart[] = [];
    for (const { address, contents } of goodsOnShelves(stock)) {
      const rack = racks.get(`${address.aisle}.${address.rack}`);
      if (!rack) continue;
      const layout = shelfLayout(rack, address, contents);
      const rackTurn = rackRotY(rack);
      const facing = layout.front > 0 ? 0 : Math.PI; // лицом товар смотрит туда же, куда лицо стеллажа
      for (const g of layout.groups) {
        const look = products[g.productId]?.look;
        if (!look) continue;
        let item = shapes.get(g.productId);
        if (!item) {
          // широкий товар (хлеб) уменьшается, чтобы штуки не сливались в одну полосу: не шире 90% своего места
          const fit = (layout.slotWidth * 0.9) / lowPolySize(look.shape).w;
          item = productShapeParts(look, Math.min(WAREHOUSE_VIEW.shelfItems.scale, fit));
          shapes.set(g.productId, item);
        }
        g.xs.forEach((x, k) => {
          const a = facing + g.turns[k];
          const cos = Math.cos(a);
          const sin = Math.sin(a);
          for (const p of item) {
            // деталь поворачивается вместе со штукой вокруг её центра (как Three.js вокруг оси y)
            const dx = p.pos[0] * cos + p.pos[2] * sin;
            const dz = -p.pos[0] * sin + p.pos[2] * cos;
            const r = p.rot ?? [0, 0, 0];
            out.push({
              ...p,
              pos: rackLocalToWorld(rack, [x + dx, layout.y + LIFT + p.pos[1], g.zs[k] + dz]),
              rot: [r[0], r[1] + rackTurn + a, r[2]],
            });
          }
        });
      }
    }
    return out;
  }, [map, stock, products]);

  return <VoxelBatch parts={parts} />;
}
