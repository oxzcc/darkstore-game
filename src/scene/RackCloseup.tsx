// Вид стеллажа вблизи во время мини-игры (06, раздел 2.3): этикетки полок «3.2.1»,
// наведение на товар — светлая рамка, клик — скан одной штуки (действие store scanShelf, M5e1).
// Сцена ничего не решает: можно ли сканировать, проверяет rules; что лежит на полке — остатки склада
// минус уже взятое в сессии (их передаёт App).
import { useEffect, useMemo, useState } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type { Rack, WarehouseMap } from '../model/warehouse';
import type { Stock } from '../model/stock';
import { WAREHOUSE_VIEW } from '../config/warehouse';
import { useGameStore } from '../store/gameStore';
import { addressText, goodsOnShelves } from '../store/selectors';
import { rackFrontSign, rackLocalToWorld, rackRotY, rackWidth, shelfY } from './rackGeometry';
import { shelfLayout, type ShelfGroup } from './shelfLayout';

const HOVER_COLOR = '#7FC743'; // светлый основной — как подсветка стеллажа в RackPicking
const FRAME = 0.02;            // толщина рамки
const ITEM_HEIGHT = 0.3;       // высота зоны клика и рамки над полкой

/** Рамка вокруг товара на лицевой стороне полки (в координатах стеллажа). */
function ItemFrame({ x0, x1, y, z, color }: { x0: number; x1: number; y: number; z: number; color: string }) {
  const w = x1 - x0;
  const cx = (x0 + x1) / 2;
  const bars: { pos: [number, number, number]; size: [number, number, number] }[] = [
    { pos: [cx, y, z], size: [w, FRAME, FRAME] },
    { pos: [cx, y + ITEM_HEIGHT, z], size: [w, FRAME, FRAME] },
    { pos: [x0, y + ITEM_HEIGHT / 2, z], size: [FRAME, ITEM_HEIGHT, FRAME] },
    { pos: [x1, y + ITEM_HEIGHT / 2, z], size: [FRAME, ITEM_HEIGHT, FRAME] },
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

export default function RackCloseup({ map, stock }: { map: WarehouseMap; stock: Stock }) {
  const focus = useGameStore((s) => (s.game.minigame?.atFocus ? s.game.minigame.focus : null));
  const paused = useGameStore((s) => s.game.clock.paused);
  const scanShelf = useGameStore((s) => s.scanShelf);
  const [hover, setHover] = useState<string | null>(null);

  const rack: Rack | undefined = focus ? map.racks.find((r) => r.aisle === focus.aisle && r.rack === focus.rack) : undefined;

  // товар на полках этого стеллажа — по остаткам склада
  const shelves = useMemo(() => {
    if (!rack) return [];
    return goodsOnShelves(stock)
      .filter(({ address }) => address.aisle === rack.aisle && address.rack === rack.rack)
      .map(({ address, contents }) => ({ address, layout: shelfLayout(rack, address.shelf, contents) }));
  }, [rack, stock]);

  // ушли от стеллажа — сбросить наведение и курсор
  useEffect(() => {
    if (rack) return;
    setHover(null);
    document.body.style.cursor = '';
  }, [rack]);

  if (!rack) return null;

  const setCursor = (c: string) => { document.body.style.cursor = c; };
  const rot = rackRotY(rack);
  const origin = rackLocalToWorld(rack, [0, 0, 0]);
  const w = rackWidth(rack.cells.length);
  const d = WAREHOUSE_VIEW.rackDepth;
  const frontSign = rackFrontSign(rack);
  const keyOf = (shelf: number, g: ShelfGroup) => `${shelf}:${g.productId}`;

  return (
    // всё рисуется в координатах стеллажа: x — вдоль, z — поперёк, лицо со стороны frontSign
    <group position={origin} rotation={[0, rot, 0]}>
      {/* этикетки адресов — наклейка на лицевом краю доски своей полки, вровень с ней, полка 1 — нижняя (08, раздел 7) */}
      {Array.from({ length: rack.shelves }, (_, i) => i + 1).map((shelf) => (
        <Html
          key={`l${shelf}`}
          position={[-w / 2 + 0.16, shelfY(shelf, rack.shelves), frontSign * (d / 2 + 0.01)]}
          center
          className="shelf-label"
        >
          {addressText({ aisle: rack.aisle, rack: rack.rack, shelf })}
        </Html>
      ))}

      {shelves.map(({ address, layout }) =>
        layout.groups.map((g) => {
          const key = keyOf(address.shelf, g);
          const isHover = hover === key && !paused;
          const frameZ = layout.front * (d / 2 + 0.02);
          return (
            <group key={key}>
              {/* невидимый блок по размеру товара — в него попадает клик */}
              <mesh
                position={[(g.x0 + g.x1) / 2, layout.y + ITEM_HEIGHT / 2, 0]}
                onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); setHover(key); setCursor('pointer'); }}
                onPointerOut={() => { setHover((k) => (k === key ? null : k)); setCursor(''); }}
                onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); scanShelf(address, g.productId); }}
              >
                <boxGeometry args={[g.x1 - g.x0, ITEM_HEIGHT, d]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              </mesh>
              {isHover && <ItemFrame x0={g.x0} x1={g.x1} y={layout.y} z={frameZ} color={HOVER_COLOR} />}
            </group>
          );
        }),
      )}
    </group>
  );
}
