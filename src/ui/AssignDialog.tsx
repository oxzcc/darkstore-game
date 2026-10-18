// Окно «Кого отправить?» по центру (решение автора 18.10, прототип «Сборщики: назначение и барабан»):
// задание в шапке, ниже вертикальные карточки сборщиков — портрет, флаг с именем, опыт под это задание, Лапы / Нюх / Бодрость,
// полоса шансов (по нажатию — из чего она сложилась), время и своя кнопка «Назначить».
// Все числа — из selectors (а те — из rules); окно само ничего не считает.
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import type { Picker } from '../model/picker';
import type { Task, TaskType } from '../model/task';
import { useGameStore } from '../store/gameStore';
import { activityOf, addressText, assignCardView, clockText, groupedLines, money, pickerList, taskSummary, type AssignCardView, type ChancePart } from '../store/selectors';
import { SPEC_RANKS, STAT_SCALE } from '../config/pickers';
import { activityLine } from './activityText';
import { EXP_NAME, OUTCOME_LOOK, OUTCOMES_ORDER, STAT_LOOK, TASK_TYPE_LOOK, taskTitle } from './labels';
import { Avatar, Pips } from './PickerBits';
import Vx from './Vx';
import Icon from './icons';

const TYPES: TaskType[] = ['order', 'putaway', 'receiving', 'writeoff'];
const pct = (v: number) => Math.round(v * 100);
const signed = (v: number) => {
  const n = pct(v);
  return n > 0 ? `+${n}%` : n < 0 ? `−${-n}%` : '0%';
};
/** Шкала 1–10 в пяти ромбах. */
const pips10 = (v: number) => v * 5 / STAT_SCALE.max;

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
        <span className="ac-pause"><Icon name="pause" small /> пауза</span>
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

function PickerCard({ view, task, busy, portrait, open, onWhy, onSend }: CardProps) {
  const { picker: p, breakdown, eta, total } = view;
  const { chances, parts } = breakdown;
  const level = p.specialization[task.type]?.level ?? 1;
  const look = TASK_TYPE_LOOK[task.type];
  const energy = Math.round(100 - p.stats.fatigue);
  return (
    <Vx className={`ac-card${busy ? ' busy' : ''}`} style={{ '--pc': p.color } as CSSProperties}>
      <div className="ac-portrait">
        {portrait ?? <Avatar picker={p} />}
        <span className="ac-flag">{p.name}</span>
        <span className="ac-breed">{p.breed}</span>
        {busy && <span className="ac-busy">{busy}</span>}
      </div>

      <div className="ac-body">
        {/* опыт под это задание — крупно */}
        <div className="ac-focus">
          <Vx className="task-icon small" style={{ '--tint': look.tint } as CSSProperties}><Icon name={look.icon} small /></Vx>
          <div className="grow">
            <div className="ac-mute">{EXP_NAME[task.type]}</div>
            <div className="ac-rank"><Pips value={level} /> {SPEC_RANKS[level] ?? level}</div>
          </div>
        </div>

        <div className="ac-stats">
          <Icon name={STAT_LOOK.speed.icon} small /><span title={STAT_LOOK.speed.hint}>{STAT_LOOK.speed.name}</span>
          <Pips value={pips10(p.stats.speed)} title={`${p.stats.speed} из ${STAT_SCALE.max}`} />
          <Icon name={STAT_LOOK.accuracy.icon} small /><span title={STAT_LOOK.accuracy.hint}>{STAT_LOOK.accuracy.name}</span>
          <Pips value={pips10(p.stats.accuracy)} title={`${p.stats.accuracy} из ${STAT_SCALE.max}`} />
          <Icon name={STAT_LOOK.energy.icon} small /><span title={STAT_LOOK.energy.hint}>{STAT_LOOK.energy.name}</span>
          <span className="ac-energy">
            <span className="ac-energy-bar"><b className={energy < 40 ? 'low' : energy < 65 ? 'mid' : ''} style={{ width: `${energy}%` }} /></span>
            {energy}%
          </span>
        </div>

        {/* опыт по всем типам: этот подсвечен */}
        <div className="ac-exps">
          {TYPES.map((t) => {
            const l = p.specialization[t]?.level ?? 1;
            return (
              <span key={t} className={`ac-exp${t === task.type ? ' on' : ''}`} title={`${EXP_NAME[t]}: ${SPEC_RANKS[l] ?? l}`}>
                <Icon name={TASK_TYPE_LOOK[t].icon} small />
                <b>{l}</b>
              </span>
            );
          })}
        </div>

        {/* шансы; нажатие — раскладка */}
        <button className="ac-chance" onClick={onWhy} aria-expanded={open}>
          <span className="ac-bar">
            {OUTCOMES_ORDER.map((o) => (
              <b key={o} style={{ width: `${chances[o] * 100}%`, background: OUTCOME_LOOK[o].color }}>
                {chances[o] >= 0.14 ? `${pct(chances[o])}%` : ''}
              </b>
            ))}
          </span>
          <span className="ac-legend">
            {OUTCOMES_ORDER.map((o) => (
              <span key={o}><Icon name={OUTCOME_LOOK[o].icon} small />{OUTCOME_LOOK[o].name} {pct(chances[o])}%</span>
            ))}
          </span>
          <span className="ac-why">{open ? 'Скрыть расчёт' : 'Почему такие шансы?'}</span>
        </button>
        {open && (
          <div className="ac-breakdown">
            <b className="wide">Шанс «{OUTCOME_LOOK.perfect.name}»</b>
            {parts.map((x, i) => (
              <span key={i} className="row">
                <span>{partLabel(x, task.type)}</span>
                <span className={x.kind === 'base' ? '' : x.value > 0.0005 ? 'plus' : x.value < -0.0005 ? 'minus' : 'zero'}>
                  {x.kind === 'base' ? `${pct(x.value)}%` : signed(x.value)}
                </span>
              </span>
            ))}
            <span className="row total"><span>Итого</span><span>{pct(chances.perfect)}%</span></span>
            <span className="wide ac-mute">
              {OUTCOME_LOOK.failed.name} {pct(chances.failed)}%: Нюх и опыт его снижают, усталость и сложность повышают.
            </span>
          </div>
        )}

        <div className="ac-times">
          <Icon name="walk" small />
          {eta === null ? <span>—</span> : <span>Дойдёт за <b>{clockText(eta)}</b></span>}
          {total !== null && <span>Закончит через <b>~{clockText(total)}</b></span>}
        </div>

        <button className="btn primary ac-send" disabled={!!busy} onClick={onSend}>
          <Vx>{busy ? 'Занят' : `Назначить`}</Vx>
        </button>
      </div>
    </Vx>
  );
}
