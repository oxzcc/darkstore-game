// Пины заданий прямо на складе (T1, решение автора 18.10): круглая иконка типа с кольцом-таймером и хвостиком вниз.
// Висят над местом задания, пока оно новое; клик — окно «Кого отправить?». После назначения пин исчезает.
// Где висит и сколько осталось — считает selectors.taskPins; сцена только рисует.
import { useMemo, type CSSProperties } from 'react';
import type { WarehouseMap } from '../model/warehouse';
import { ICON_PATHS } from '../config/icons';
import { TASK_TYPE_LOOK } from '../config/taskLook';
import { useGameStore } from '../store/gameStore';
import { closeupFocus, taskPins, type TaskPin } from '../store/selectors';
import SceneHtml from './SceneHtml';

// Кольцо: окружность r = 20 в рамке 48 × 48; pathLength = 100 — убывает в процентах.
const R = 20;

function Pin({ pin, selected, onOpen }: { pin: TaskPin; selected: boolean; onOpen: () => void }) {
  const look = TASK_TYPE_LOOK[pin.type];
  const left = pin.left ?? 0;
  const cls = `task-pin${pin.warn ? ' warn' : ''}${pin.overdue ? ' overdue' : ''}${selected ? ' selected' : ''}`;
  return (
    <SceneHtml position={pin.pos} zIndexRange={[15, 0]}>
      <div className="task-pin-anchor">
        <button className={cls} onClick={onOpen} aria-label={look.name}
          style={{ '--pin': look.pin, '--tint': look.tint } as CSSProperties}>
          <svg className="task-pin-body" viewBox="0 0 60 74" aria-hidden>
            {/* круг и хвостик — одна фигура: аутлайн без шва (правка автора 18.10) */}
            <path className="shape" d="M30 3 A27 27 0 0 1 41.5 54.4 L30 71 L18.5 54.4 A27 27 0 0 1 30 3 Z" />
            <circle className="track" cx="30" cy="30" r={R} />
            {pin.left !== null && (
              <circle className="left" cx="30" cy="30" r={R} pathLength={100}
                style={{ strokeDashoffset: 100 * (1 - left) } as CSSProperties} transform="rotate(-90 30 30)" />
            )}
            <circle className="tile" cx="30" cy="30" r="15" />
          </svg>
          <svg className="task-pin-icon" viewBox="0 0 24 24" aria-hidden dangerouslySetInnerHTML={{ __html: ICON_PATHS[look.icon] }} />
        </button>
      </div>
    </SceneHtml>
  );
}

export default function TaskPins({ map }: { map: WarehouseMap }) {
  const game = useGameStore((s) => s.game);
  const selectedId = useGameStore((s) => s.ui.assignTaskId);
  const openAssign = useGameStore((s) => s.openAssign);
  const pins = useMemo(() => taskPins(game, map), [game, map]);
  // в виде стеллажа вблизи (ТСД) пины не нужны — мешают игре
  if (closeupFocus(game)) return null;
  return (
    <group>
      {pins.map((p) => <Pin key={p.id} pin={p} selected={p.id === selectedId} onOpen={() => openAssign(p.id)} />)}
    </group>
  );
}
