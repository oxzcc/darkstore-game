// Сборщики на складе (09, раздел 7.4). Логика хранит клетку, маршрут и дробный прогресс по нему;
// сцена только ставит фигурку между клетками. На паузе прогресс не меняется — фигурка стоит.
import type { Picker as PickerData } from '../model/picker';
import { lookOf } from '../config/pickers';
import { CALLS } from '../config/calls';
import { FLOOR_MARKINGS } from '../config/warehouse';
import { useGameStore, WAREHOUSE_MAP } from '../store/gameStore';
import { cellToWorld } from '../rules/warehouse';
import PickerModel from './models/Picker';
import { pickerPose } from './pickerPose';
import { blocksCloseup } from './closeupView';
import { closeupFocus } from '../store/selectors';
import SceneHtml from './SceneHtml';
import type { CSSProperties } from 'react';

// Тележка — у заданий, где сборщик возит товар: сборка и выкладка (W7, решение автора 16.10, вариант «а»).
const CART_TASKS = new Set(['order', 'putaway']);

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

/** Красный «!» над сборщиком, которому нужна помощь: по контуру убывает таймер, клик открывает окно развилки. */
function CallBang({ pickerId, pos }: { pickerId: string; pos: [number, number, number] }) {
  const call = useGameStore((s) => s.game.calls.find((c) => c.pickerId === pickerId));
  const time = useGameStore((s) => s.game.clock.time);
  const openCall = useGameStore((s) => s.openCall);
  if (!call) return null;
  const left = call.expiresAt === null ? 1 : Math.max(0, call.expiresAt - time) / CALLS.answerSeconds;
  return (
    <SceneHtml position={[pos[0], 2.1, pos[2]]} center zIndexRange={[20, 0]}>
      <button className="call-bang" title="Нужна помощь — нажмите" onClick={() => openCall(call.id)}>
        <svg viewBox="0 0 44 44" className="call-bang-timer" aria-hidden>
          <rect x="2" y="2" width="40" height="40" pathLength={100} className="track" />
          <rect x="2" y="2" width="40" height="40" pathLength={100} className="left" style={{ strokeDashoffset: 100 * (1 - left) } as CSSProperties} />
        </svg>
        <span>!</span>
      </button>
    </SceneHtml>
  );
}

// Направления каждого сборщика между кадрами: куда он шёл последним (смотрит стоящий) и куда смотрел, когда последний раз стоял
// (из этой точки он «выходит» в начале пути, pickerPose).
const lastAngle = new Map<string, number>();
const standAngle = new Map<string, number>();
const DEFAULT_ANGLE = Math.PI / 4;

export default function Pickers() {
  const pickers = useGameStore((s) => s.game.pickers);
  const tasks = useGameStore((s) => s.game.tasks);
  // В виде стеллажа вблизи сборщики между глазами и полками не рисуются — иначе загораживают товар.
  const focus = useGameStore((s) => closeupFocus(s.game));
  const focusRack = focus ? WAREHOUSE_MAP.racks.find((r) => r.aisle === focus.aisle && r.rack === focus.rack) : undefined;
  return (
    <group>
      {Object.values(pickers).map((p) => {
        const withCart = p.taskId !== null && CART_TASKS.has(tasks[p.taskId]?.type ?? '');
        const last = lastAngle.get(p.id) ?? DEFAULT_ANGLE;
        const pose = pickerPose(p, withCart, standAngle.get(p.id) ?? last, last);
        if (pose.moving) {
          const i = Math.min(Math.floor(p.pathProgress), p.path.length - 1);
          const [a, b] = [i === 0 ? p.position : p.path[i - 1], p.path[i]];
          lastAngle.set(p.id, Math.atan2(b.x - a.x, b.z - a.z));
        } else {
          standAngle.set(p.id, last);
        }
        if (focusRack && blocksCloseup(focusRack, pose.dog)) return null;
        return (
          <group key={p.id}>
            {p.path.length > 0 && <Route p={p} from={pose.cart?.pos ?? pose.dog} />}
            <PickerModel
              position={pose.dog}
              facing={pose.facing}
              hop={pose.hop}
              look={lookOf(p.id)}
              ringColor={p.color}
              cart={pose.cart}
            />
            {/* нужна помощь (развилка) — красный «!» над головой с таймером по контуру; клик — окно (решение автора 13.10) */}
            {p.state === 'calling' && <CallBang pickerId={p.id} pos={pose.dog} />}
          </group>
        );
      })}
    </group>
  );
}
