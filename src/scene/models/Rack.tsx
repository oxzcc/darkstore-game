// Стеллаж-заглушка: металлический каркас и деревянные полки, без ячеек (08, раздел 7).
// Настоящая модель по art/reference/world_shelving_unit.png появится позже.
import { WAREHOUSE_VIEW } from '../../config/warehouse';
import { PALETTE } from '../../config/palette';
import { RACK_BOARD, RACK_POST, rackWidth, shelfY } from '../rackGeometry';

type Props = {
  position: [number, number, number]; // центр основания стеллажа
  rotationY: number;                  // поворот: стеллаж вдоль x (0) или вдоль z (90°)
  length: number;                     // длина вдоль аллеи, в клетках
  shelves: number;
};

export default function Rack({ position, rotationY, length, shelves }: Props) {
  const h = WAREHOUSE_VIEW.rackHeight;
  const d = WAREHOUSE_VIEW.rackDepth;
  const w = rackWidth(length);

  const posts: [number, number][] = [
    [-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2],
  ];

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {posts.map(([x, z], i) => (
        <mesh key={`p${i}`} position={[x, h / 2, z]}>
          <boxGeometry args={[RACK_POST, h, RACK_POST]} />
          <meshStandardMaterial color={PALETTE.metal} />
        </mesh>
      ))}
      {Array.from({ length: shelves }, (_, i) => (
        <mesh key={`s${i}`} position={[0, shelfY(i + 1, shelves), 0]}>
          <boxGeometry args={[w, RACK_BOARD, d]} />
          <meshStandardMaterial color={PALETTE.wood} />
        </mesh>
      ))}
    </group>
  );
}
