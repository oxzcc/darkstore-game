// Сборщики на складе (09, раздел 7.4). Логика хранит клетку, маршрут и дробный прогресс по нему;
// сцена только ставит фигурку между клетками. На паузе прогресс не меняется — фигурка стоит.
import type { Picker as PickerData } from '../model/picker';
import type { Cell } from '../model/warehouse';
import { STARTING_PICKERS } from '../config/pickers';
import { FLOOR_MARKINGS } from '../config/warehouse';
import { useGameStore } from '../store/gameStore';
import { cellToWorld } from '../rules/warehouse';
import PickerModel from './models/Picker';

const HOP_HEIGHT = 0.06;  // высота подскока при ходьбе
const HOPS_PER_CELL = 2;  // два шажка на клетку
const FUR_DEFAULT = '#D9C4A0';
const furOf = (id: string) => STARTING_PICKERS.find((t) => t.id === id)?.fur ?? FUR_DEFAULT;

/** Где сейчас фигурка: между клетками маршрута по дробному прогрессу. Плюс направление и подскок. */
function placement(p: PickerData) {
  const pts: Cell[] = [p.position, ...p.path];
  if (pts.length === 1) {
    return { pos: cellToWorld(p.position), facing: null as number | null, hop: 0 };
  }
  const i = Math.min(Math.floor(p.pathProgress), pts.length - 2);
  const t = p.pathProgress - i;
  const a = cellToWorld(pts[i]);
  const b = cellToWorld(pts[i + 1]);
  const pos: [number, number, number] = [a[0] + (b[0] - a[0]) * t, 0, a[2] + (b[2] - a[2]) * t];
  const facing = Math.atan2(b[0] - a[0], b[2] - a[2]);
  const hop = Math.abs(Math.sin(p.pathProgress * Math.PI * HOPS_PER_CELL)) * HOP_HEIGHT;
  return { pos, facing, hop };
}

/** Пунктир оставшегося пути в цвете сборщика (ui_03). */
function Route({ p, from }: { p: PickerData; from: [number, number, number] }) {
  const i = Math.floor(p.pathProgress);
  const rest = p.path.slice(i).map(cellToWorld);
  const pts = [from, ...rest];
  const dashes: { pos: [number, number, number]; len: number; rotY: number }[] = [];
  for (let k = 0; k < pts.length - 1; k++) {
    const [a, b] = [pts[k], pts[k + 1]];
    const dx = b[0] - a[0], dz = b[2] - a[2];
    const len = Math.hypot(dx, dz);
    if (len < 0.01) continue;
    // по две чёрточки на отрезок
    for (const f of [0.25, 0.75]) {
      dashes.push({ pos: [a[0] + dx * f, 0.025, a[2] + dz * f], len: Math.min(0.3, len * 0.4), rotY: Math.atan2(dx, dz) });
    }
  }
  return (
    <group>
      {dashes.map((d, k) => (
        <mesh key={k} position={d.pos} rotation={[0, d.rotY, 0]}>
          <boxGeometry args={[FLOOR_MARKINGS.lineWidth * 1.4, 0.01, d.len]} />
          <meshStandardMaterial color={p.color} />
        </mesh>
      ))}
    </group>
  );
}

// Последнее направление взгляда каждого сборщика, чтобы стоящий не разворачивался «по умолчанию».
const lastFacing = new Map<string, number>();

export default function Pickers() {
  const pickers = useGameStore((s) => s.game.pickers);
  return (
    <group>
      {Object.values(pickers).map((p) => {
        const { pos, facing, hop } = placement(p);
        if (facing !== null) lastFacing.set(p.id, facing);
        return (
          <group key={p.id}>
            {p.path.length > 0 && <Route p={p} from={pos} />}
            <PickerModel position={pos} facing={lastFacing.get(p.id) ?? Math.PI / 4} hop={hop} fur={furOf(p.id)} ringColor={p.color} />
          </group>
        );
      })}
    </group>
  );
}
