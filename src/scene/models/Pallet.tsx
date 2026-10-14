// Паллета с коробками по art/reference/world_palete.png (08, раздел 7: 1×1 клетка).
// Деревянный поддон с брусками и стопка картонных коробок со скотчем. Чем больше товара — тем выше стопка.
import { PALETTE } from '../../config/palette';

type Part = { pos: [number, number, number]; size: [number, number, number]; color: string };

const SIZE = 0.86;   // сторона поддона
const DECK = 0.05;   // толщина настила
const BLOCK = 0.09;  // высота брусков под настилом
const BOX = 0.38;    // сторона коробки

function parts(boxes: number): Part[] {
  const p: Part[] = [];
  const add = (pos: Part['pos'], size: Part['size'], color: string) => p.push({ pos, size, color });

  // бруски по углам и посередине краёв, сверху настил
  for (const x of [-1, 0, 1]) {
    for (const z of [-1, 1]) add([x * (SIZE / 2 - 0.06), BLOCK / 2, z * (SIZE / 2 - 0.06)], [0.12, BLOCK, 0.12], PALETTE.wood);
  }
  add([0, BLOCK + DECK / 2, 0], [SIZE, DECK, SIZE], PALETTE.wood);

  // коробки: нижний ряд 2 × 2, сверху ещё до двух
  const base = BLOCK + DECK;
  const spots: [number, number, number][] = [
    [-0.2, 0, -0.2], [0.2, 0, -0.2], [-0.2, 0, 0.2], [0.2, 0, 0.2],
    [-0.1, 1, -0.05], [0.12, 1, 0.12],
  ];
  for (const [x, layer, z] of spots.slice(0, boxes)) {
    const h = layer === 0 ? 0.36 : 0.3;
    const y = base + (layer === 0 ? h / 2 : 0.36 + h / 2);
    add([x, y, z], [BOX, h, BOX], PALETTE.box);
    add([x, y + h / 2 + 0.005, z], [0.1, 0.01, BOX + 0.01], PALETTE.boxTape); // полоска скотча по крышке
  }
  return p;
}

type Props = { position: [number, number, number]; boxes: number };

export default function Pallet({ position, boxes }: Props) {
  return (
    <group position={position}>
      {parts(Math.max(1, Math.min(6, boxes))).map((part, i) => (
        <mesh key={i} position={part.pos}>
          <boxGeometry args={part.size} />
          <meshStandardMaterial color={part.color} />
        </mesh>
      ))}
    </group>
  );
}
