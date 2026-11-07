// Окно «Кого отправить?» (A1, макеты ui_13_assign_pentagon / ui_14_assign_phone, решения автора 21.10–07.11):
// окно по центру — плашка задания (название, «взять до», товары), большой пятиугольник (пунктир — что нужно, заливка — выбранный сборщик,
// красное — не хватает; у осей «есть / нужно») и кнопка «Отправить …» с наградой. Сборщики — квадраты отдельным рядом под окном,
// статус — тегом внутри портрета. Нажатие на квадрат только выбирает сборщика (накладывает на пятиугольник), отправляет кнопка (решение автора 07.11).
// При открытии сразу выбран свободный сборщик с наименьшей нехваткой (`bestPickerFor`, вариант «б»). Процента шанса в окне нет (решение автора 07.11).
// Все числа — из selectors (а те — из rules); окно само ничего не считает.
import { useEffect, type CSSProperties, type ReactNode } from 'react';
import type { Picker } from '../model/picker';
import type { Task } from '../model/task';
import { useGameStore } from '../store/gameStore';
import { activityOf, addressText, assignCardView, bestPickerFor, clockText, groupedLines, money, pickerList, takeTimer, type AssignCardView } from '../store/selectors';
import StatPentagon from './StatPentagon';
import { TIRED_BADGE_FROM } from '../config/pickers';
import { activityLine } from './activityText';
import { TASK_TYPE_LOOK, taskTitle } from './labels';
import { Avatar } from './PickerBits';
import Vx from './Vx';
import Icon from './icons';
import { usePhone } from '../app/usePhone';

/** «Коржика», «Бурана», «Лаки» — для кнопки «Отправить …». */
function accusative(name: string): string {
  if (/[бвгдзклмнпрстфхцчшщж]$/i.test(name)) return `${name}а`;
  if (/й$/i.test(name)) return `${name.slice(0, -1)}я`;
  return name;
}

/** `renderPortrait` — 3D-портрет сборщика (его передаёт App: интерфейс сам 3D не импортирует). */
export default function AssignDialog({ renderPortrait }: { renderPortrait?: (picker: Picker) => ReactNode }) {
  const game = useGameStore((s) => s.game);
  const taskId = useGameStore((s) => s.ui.assignTaskId);
  const chosenId = useGameStore((s) => s.ui.chosenPickerId);
  const { choosePicker, closeAssign, sendChosenPicker } = useGameStore.getState();
  const phone = usePhone();

  const task = taskId ? game.tasks[taskId] : null;

  // при открытии — сразу лучший свободный сборщик (вариант «б»)
  useEffect(() => {
    if (!taskId || chosenId) return;
    const best = bestPickerFor(useGameStore.getState().game, taskId);
    if (best) choosePicker(best);
  }, [taskId, chosenId, choosePicker]);

  useEffect(() => {
    if (!task) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') closeAssign();
      // Enter — «Отправить»; на квадрате сборщика Enter только выбирает его (это делает сама кнопка)
      if (e.code === 'Enter' && !(e.target instanceof HTMLButtonElement)) sendChosen();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [task, closeAssign]);

  if (!task) return null;

  const views = pickerList(game.pickers)
    .map((p) => assignCardView(game, p.id, task.id))
    .filter((v): v is AssignCardView => v !== null);
  const chosen = views.find((v) => v.picker.id === chosenId && v.check.ok) ?? null;
  const req = views[0]?.req ?? null;

  function sendChosen() {
    const s = useGameStore.getState();
    const id = s.ui.chosenPickerId;
    const t = s.ui.assignTaskId;
    if (!id || !t) return;
    const v = assignCardView(s.game, id, t);
    if (v?.check.ok) sendChosenPicker();
  }

  return (
    <div className="as-veil" onClick={closeAssign}>
      <div className="as-wrap" onClick={(e) => e.stopPropagation()}>
        <Vx className="as-window" bodyClass="window">
          <button className="as-close" onClick={closeAssign} aria-label="Закрыть">×</button>
          <div className="as-inner">
            <TaskHead task={task} />
            <div className="as-graph">
              <StatPentagon
                stats={chosen?.stats ?? null}
                req={req}
                color={chosen?.picker.color ?? '#9A9184'}
                size={phone ? 320 : 400}
                detail
              />
            </div>
            <button className="btn primary as-send" disabled={!chosen} onClick={sendChosen}>
              <Vx>
                {chosen ? `Отправить ${accusative(chosen.picker.name)}` : 'Выбери сборщика'}
                {chosen && !task.overdue && <span className="as-reward">+{money(task.reward.money)}</span>}
              </Vx>
            </button>
          </div>
        </Vx>

        <div className="as-squares">
          {views.map((v) => {
            const p = v.picker;
            const busy = v.check.ok ? null : p.state === 'idle' ? v.check.reason ?? 'Нельзя' : activityLine(activityOf(game, p.id)).text;
            return (
              <PickerSquare
                key={p.id}
                view={v}
                busy={busy}
                selected={chosen?.picker.id === p.id}
                portrait={renderPortrait?.(p)}
                onPick={() => { if (!busy) choosePicker(p.id); }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Плашка задания: значок, название, «взять до»; ниже товары с адресами. Награда — на кнопке «Отправить». */
function TaskHead({ task }: { task: Task }) {
  const game = useGameStore((s) => s.game);
  const look = TASK_TYPE_LOOK[task.type];
  const timer = takeTimer(game, task);
  return (
    <div className="as-head">
      <div className="as-head-row">
        <Vx className="task-icon" style={{ '--tint': look.tint } as CSSProperties}><Icon name={look.icon} /></Vx>
        <div className="as-title grow">{taskTitle(task)}</div>
        {(timer || task.overdue) && (
          <span className={`as-timer${timer?.warn || task.overdue ? ' warn' : ''}`} title="Взять до">
            <Icon name="clock" small />
            {timer ? clockText(timer.secondsLeft) : 'просрочено'}
          </span>
        )}
      </div>
      <div className="as-lines">
        {task.type === 'order' && task.payload.lines.map((l) => (
          <span key={`${l.productId}-${addressText(l.address)}`} className="as-line">
            <span className="tag">{addressText(l.address)}</span>
            {game.products[l.productId]?.name ?? l.productId} <b>×{l.qty}</b>
          </span>
        ))}
        {task.type !== 'order' && groupedLines(game, task).map((g) => (
          <span key={g.productId} className="as-line">
            {g.places.length > 0 && <span className="tag">{g.places.join(', ')}</span>}
            {g.name} <b>×{g.qty}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

type SquareProps = {
  view: AssignCardView;
  busy: string | null;
  selected: boolean;
  portrait: ReactNode;
  onPick: () => void;
};

/** Квадрат сборщика: портрет, флаг с именем, тег статуса внутри портрета; выбранный приподнят, рамка его цвета, галочка. */
function PickerSquare({ view, busy, selected, portrait, onPick }: SquareProps) {
  const { picker: p, total } = view;
  const tired = p.stats.fatigue >= TIRED_BADGE_FROM ? Math.round(p.stats.fatigue) : null;
  return (
    <button
      className={`as-sq${busy ? ' busy' : ''}${selected ? ' on' : ''}`}
      style={{ '--pc': p.color } as CSSProperties}
      disabled={!!busy}
      aria-pressed={selected}
      aria-label={p.name}
      onClick={onPick}
    >
      <span className="as-sq-face">{portrait ?? <Avatar picker={p} />}</span>
      <span className="as-flag">{p.name}</span>
      {selected && <span className="as-check"><Icon name="check" small /></span>}
      <span className="as-tags">
        {!busy && tired !== null && <span className="as-tag tired">Устал {tired}%</span>}
        <span className={`as-tag${busy ? ' dark' : ''}`}>
          <Icon name="clock" small />
          {busy ?? (total === null ? 'не дойти' : clockText(total))}
        </span>
      </span>
    </button>
  );
}
