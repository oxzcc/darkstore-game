// Стеллаж-заглушка: металлический каркас и деревянные полки, без ячеек (08, раздел 7).
// Настоящая модель по art/reference/world_shelving_unit.png появится позже.
import { WAREHOUSE_VIEW } from '../../config/warehouse';
import { PALETTE } from '../../config/palette';

type Props = {
  position: [number, number, number]; // центр основания стеллажа
  length: number;                     // длина вдоль аллеи, в метрах
  shelves: number;
};

const POST = 0.06;  // толщина стойки
const BOARD = 0.05; // толщина полки

export default function Rack({ position, length, shelves }: Props) {
  const h = WAREHOUSE_VIEW.rackHeight;
  const d = WAREHOUSE_VIEW.rackDepth;
  const w = length * 0.92; // небольшой зазор между соседними стеллажами

  const posts: [number, number][] = [
    [-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2],
  ];
  // Полка 1 — нижняя, остальные равномерно до верха.
  const shelfY = Array.from({ length: shelves }, (_, i) => 0.15 + (i * (h - 0.25)) / (shelves - 1 || 1));

  return (
    <group position={position}>
      {posts.map(([x, z], i) => (
        <mesh key={`p${i}`} position={[x, h / 2, z]}>
          <boxGeometry args={[POST, h, POST]} />
          <meshStandardMaterial color={PALETTE.metal} />
        </mesh>
      ))}
      {shelfY.map((y, i) => (
        <mesh key={`s${i}`} position={[0, y, 0]}>
          <boxGeometry args={[w, BOARD, d]} />
          <meshStandardMaterial color={PALETTE.wood} />
        </mesh>
      ))}
    </group>
  );
}
