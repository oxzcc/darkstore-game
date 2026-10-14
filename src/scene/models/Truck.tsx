// Грузовик-заглушка по art/reference/world_transport_truck.png (08, раздел 7: 2×5 клеток).
// Собран из блоков: зелёная кабина, белый фургон с серыми уголками, тёмная рама и колёса-кубы.
// Начало координат — середина заднего края (тем краем грузовик встаёт к воротам), длина идёт по +z.
import { PALETTE } from '../../config/palette';

type Part = { pos: [number, number, number]; size: [number, number, number]; color: string };

const W = 1.9;        // ширина
const BOX_L = 3.4;    // фургон
const CAB_L = 1.3;    // кабина
const WHEEL = 0.7;    // колесо (куб)
const FRAME_Y = 0.45; // верх рамы

function parts(): Part[] {
  const p: Part[] = [];
  const add = (pos: Part['pos'], size: Part['size'], color: string) => p.push({ pos, size, color });

  // рама под всем грузовиком
  add([0, FRAME_Y - 0.12, (BOX_L + CAB_L) / 2], [W * 0.9, 0.24, BOX_L + CAB_L], PALETTE.truckDark);

  // фургон и серые уголки по вертикальным рёбрам и по крыше
  const boxH = 1.9;
  const boxY = FRAME_Y + boxH / 2;
  add([0, boxY, BOX_L / 2], [W, boxH, BOX_L], PALETTE.truckBody);
  const c = 0.14;
  for (const x of [-W / 2, W / 2]) {
    for (const z of [0, BOX_L]) add([x, boxY, z], [c, boxH + 0.02, c], PALETTE.truckTrim);
    add([x, FRAME_Y + boxH, BOX_L / 2], [c, c, BOX_L], PALETTE.truckTrim);
  }
  for (const z of [0, BOX_L]) add([0, FRAME_Y + boxH, z], [W, c, c], PALETTE.truckTrim);
  // задние двери: тёмная щель посередине
  add([0, boxY, -0.005], [0.04, boxH * 0.9, 0.02], PALETTE.truckTrim);

  // кабина
  const cabZ = BOX_L + CAB_L / 2 + 0.05;
  const cabH = 1.45;
  add([0, FRAME_Y + cabH / 2, cabZ], [W, cabH, CAB_L], PALETTE.truckCab);
  // лобовое стекло и боковые окна
  const glassY = FRAME_Y + cabH * 0.68;
  add([0, glassY, cabZ + CAB_L / 2 + 0.01], [W * 0.8, 0.5, 0.02], PALETTE.truckDark);
  for (const s of [-1, 1]) add([s * (W / 2 + 0.01), glassY, cabZ - 0.1], [0.02, 0.45, CAB_L * 0.55], PALETTE.truckDark);
  // зеркала
  for (const s of [-1, 1]) add([s * (W / 2 + 0.12), glassY, cabZ + CAB_L / 2 - 0.15], [0.12, 0.3, 0.08], PALETTE.truckDark);
  // решётка, фары, белый бампер
  const front = cabZ + CAB_L / 2;
  add([0, FRAME_Y + 0.35, front + 0.02], [W * 0.4, 0.3, 0.04], PALETTE.truckDark);
  for (const s of [-1, 1]) add([s * (W / 2 - 0.22), FRAME_Y + 0.38, front + 0.03], [0.26, 0.2, 0.04], PALETTE.truckLight);
  add([0, FRAME_Y + 0.05, front + 0.08], [W + 0.06, 0.22, 0.16], PALETTE.truckTrim);

  // колёса: под кабиной и под задом фургона
  for (const z of [0.85, cabZ]) {
    for (const s of [-1, 1]) {
      add([s * (W / 2 - 0.12), WHEEL / 2, z], [0.32, WHEEL, WHEEL], PALETTE.truckDark);
      add([s * (W / 2 + 0.05), WHEEL / 2, z], [0.02, WHEEL * 0.4, WHEEL * 0.4], PALETTE.truckTrim);
    }
  }
  return p;
}

const PARTS = parts();

type Props = { position: [number, number, number]; rotationY: number };

export default function Truck({ position, rotationY }: Props) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {PARTS.map((part, i) => (
        <mesh key={i} position={part.pos}>
          <boxGeometry args={part.size} />
          <meshStandardMaterial color={part.color} />
        </mesh>
      ))}
    </group>
  );
}
