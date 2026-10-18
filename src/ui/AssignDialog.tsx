// Окно «Кого отправить?» по центру (решение автора 18.10, прототип «Сборщики: назначение и барабан»):
// задание в шапке, ниже вертикальные карточки сборщиков — портрет, флаг с именем, опыт под это задание, полоса шансов
// («?» — из чего она сложилась) и «Готово через». Нажатие на карточку — назначить (правка автора 18.10: меньше информации).
// Все числа — из selectors (а те — из rules); окно само ничего не считает.
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import type { Picker } from '../model/picker';
import type { Task, TaskType } from '../model/task';
import { useGameStore } from '../store/gameStore';
import { activityOf, addressText, assignCardView, clockText, groupedLines, money, pickerList, taskSummary, type AssignCardView, type ChancePart } from '../store/selectors';
import { SPEC_RANKS, TIRED_BADGE_FROM } from '../config/pickers';
import { activityLine } from './activityText';
import { EXP_NAME, OUTCOME_LOOK, OUTCOMES_ORDER, STAT_LOOK, TASK_TYPE_LOOK, taskTitle } from './labels';
import { Avatar, Pips } from './PickerBits';
import Vx from './Vx';
import Icon from './icons';

const pct = (v: number) => Math.round(v * 100);
const signed = (v: number) => {
  const n = pct(v);
  return n > 0 ? `+${n}%` : n < 0 ? `−${-n}%` : '0%';
};

/** Подпись строки раскладки шанса. */
function partLabel(p: ChancePart, type: TaskType): string {
  switch (p.kind) {
    case 'base': return 'База';
    case 'accuracy': return `${STAT_LOOK.accuracy.name} ${p.points}`;
    case 'spec': return `${EXP_NAME[type]}: ${SPEC_RANKS[p.level] ?? p.level}`;
    case 'fatigue': return `Усталость ${Math.round(p.fatigue)}%`;
    case 'difficulty': return `Сложность задания ${p.difficulty}`;
    case 'limit': return 'Предел шансов';
  }
}

/** `renderPortrait` — 3D-портрет сборщика (его передаёт App: интерфейс сам 3D не импортирует). */
export default function AssignDialog({ renderPortrait }: { renderPortrait?: (picker: Picker) => ReactNode }) {
  const game = useGameStore((s) => s.game);
  const taskId = useGameStore((s) => s.ui.assignTaskId);
  const { choosePicker, closeAssign, sendChosenPicker } = useGameStore.getState();
  const [why, setWhy] = useState<Record<string, boolean>>({});

  const task = taskId ? game.tasks[taskId] : null;

  useEffect(() => {
    if (!task) return;
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Escape') closeAssign(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [task, closeAssign]);

  if (!task) return null;

  const send = (pickerId: string) => {
    choosePicker(pickerId);
    sendChosenPicker();
  };

  return (
    <div className="ac-veil" onClick={closeAssign}>
      <div className="ac-wrap" onClick={(e) => e.stopPropagation()}>
      <Vx className="ac-window" bodyClass="window">
        <div className="ac-inner">
          <TaskHead task={task} />
          <div className="ac-cards">
            {pickerList(game.pickers).map((p) => {
              const v = assignCardView(game, p.id, task.id);
              if (!v) return null;
              const busy = v.check.ok ? null : p.state === 'idle' ? v.check.reason ?? 'Нельзя' : activityLine(activityOf(game, p.id)).text;
              return (
                <PickerCard
                  key={p.id}
                  view={v}
                  task={task}
                  busy={busy}
                  portrait={renderPortrait?.(p)}
                  open={!!why[p.id]}
                  onWhy={() => setWhy((w) => ({ ...w, [p.id]: !w[p.id] }))}
                  onSend={() => send(p.id)}
                />
              );
            })}
          </div>
        </div>
      </Vx>
      </div>
    </div>
  );
}

/** Шапка: тип и номер задания, коротко что внутри, награда, пауза; позиции — мелко ниже. */
function TaskHead({ task }: { task: Task }) {
  const game = useGameStore((s) => s.game);
  const closeAssign = useGameStore((s) => s.closeAssign);
  const look = TASK_TYPE_LOOK[task.type];
  return (
    <div className="ac-head">
      <div className="ac-head-row">
        <Vx className="task-icon" style={{ '--tint': look.tint } as CSSProperties}><Icon name={look.icon} /></Vx>
        <div className="grow">
          <div className="ac-title">{taskTitle(task)}</div>
          <div className="task-sub">{taskSummary(game, task)}</div>
        </div>
        <div className="reward">{task.overdue ? 'без награды' : `+${money(task.reward.money)}`}</div>
        <button className="call-close" onClick={closeAssign} aria-label="Закрыть">×</button>
      </div>
      <div className="ac-lines">
        {task.type === 'order' && task.payload.lines.map((l) => (
          <span key={`${l.productId}-${addressText(l.address)}`} className="ac-line">
            <span className="tag">{addressText(l.address)}</span>
            {game.products[l.productId]?.name ?? l.productId} ×{l.qty}
          </span>
        ))}
        {task.type !== 'order' && groupedLines(game, task).map((g) => (
          <span key={g.productId} className="ac-line">
            {g.name} ×{g.qty}
            {g.places.length > 0 && <span className="places">{g.places.join(', ')}</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

type CardProps = {
  view: AssignCardView;
  task: Task;
  busy: string | null;
  portrait: ReactNode;
  open: boolean;
  onWhy: () => void;
  onSend: () => void;
};

/**
 * Карточка сборщика — вся карточка кнопка, как вариант в развилке (правка автора 18.10).
 * На карточке только то, по чему выбирают: опыт под это задание, шансы и когда будет готово.
 * Лапы, Нюх и опыт по всем типам — в расчёте шансов и в профиле; бодрость — плашкой, только когда устал.
 */
function PickerCard({ view, task, busy, portrait, open, onWhy, onSend }: CardProps) {
  const { picker: p, breakdown, eta, total } = view;
  const { chances, parts } = breakdown;
  const level = p.specialization[task.type]?.level ?? 1;
  const tired = p.stats.fatigue >= TIRED_BADGE_FROM ? parts.find((x) => x.kind === 'fatigue')?.value ?? 0 : null;
  const pick = () => { if (!busy) onSend(); };
  return (
    <div
      className={`ac-pick${busy ? ' busy' : ''}`}
      role="button"
      tabIndex={busy ? -1 : 0}
      aria-disabled={!!busy}
      onClick={pick}
      onKeyDown={(e) => { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); pick(); } }}
    >
      <Vx className="ac-card" style={{ '--pc': p.color } as CSSProperties}>
        <div className="ac-portrait">
          {portrait ?? <Avatar picker={p} />}
          <span className="ac-flag">{p.name}</span>
          {busy && <span className="ac-busy">{busy}</span>}
          {!busy && tired !== null && <span className="ac-tired">Устал {signed(tired)}</span>}
        </div>

        <div className="ac-body">
          <div className="ac-rank">
            <span className="grow">{TASK_TYPE_LOOK[task.type].name}: <b>{SPEC_RANKS[level] ?? level}</b></span>
            <Pips value={level} />
          </div>

          <div className="ac-chance">
            <span className="ac-bar">
              {OUTCOMES_ORDER.map((o) => (
                <b key={o} style={{ width: `${chances[o] * 100}%`, background: OUTCOME_LOOK[o].color }} title={`${OUTCOME_LOOK[o].name} ${pct(chances[o])}%`}>
                  {chances[o] >= 0.14 ? `${pct(chances[o])}%` : chances[o] >= 0.04 ? <Icon name={OUTCOME_LOOK[o].icon} small /> : null}
                </b>
              ))}
            </span>
            <button
              className={`ac-q${open ? ' on' : ''}`}
              onClick={(e) => { e.stopPropagation(); onWhy(); }}
              aria-expanded={open}
              aria-label="Почему такие шансы?"
              title="Почему такие шансы?"
            >?</button>
          </div>
          {open && (
            <div className="ac-breakdown" onClick={(e) => e.stopPropagation()}>
              <b>Шанс «{OUTCOME_LOOK.perfect.name}»</b>
              {parts.map((x, i) => (
                <span key={i} className="row">
                  <span>{partLabel(x, task.type)}</span>
                  <span className={x.kind === 'base' ? '' : x.value > 0.0005 ? 'plus' : x.value < -0.0005 ? 'minus' : 'zero'}>
                    {x.kind === 'base' ? `${pct(x.value)}%` : signed(x.value)}
                  </span>
                </span>
              ))}
              <span className="row total"><span>Итого</span><span>{pct(chances.perfect)}%</span></span>
              <span className="ac-mute">
                {OUTCOME_LOOK.withErrors.name} {pct(chances.withErrors)}%, {OUTCOME_LOOK.failed.name.toLowerCase()} {pct(chances.failed)}%.
                {' '}{STAT_LOOK.speed.name} {p.stats.speed}: {eta === null ? 'дорога —' : `до места ${clockText(eta)}`}.
              </span>
            </div>
          )}

          <div className="ac-time">
            {busy ? <span>Сейчас занят</span> : total === null ? <span>Не дойти</span> : <span>Готово через <b>~{clockText(total)}</b></span>}
          </div>
        </div>
      </Vx>
    </div>
  );
}
