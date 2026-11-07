// Окно «Кого отправить?» по центру (решение автора 18.10, прототип «Сборщики: назначение и барабан»):
// задание в шапке и «Что нужно» (откуда требования, X3), ниже вертикальные карточки сборщиков — портрет, флаг с именем,
// пятиугольник характеристик с пунктиром требований (X3, макет StatsAssign), полоса шансов («?» — из чего она сложилась) и «Готово через». Нажатие на карточку — назначить (правка автора 18.10: меньше информации).
// Все числа — из selectors (а те — из rules); окно само ничего не считает.
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import type { Picker } from '../model/picker';
import type { Task } from '../model/task';
import { useGameStore } from '../store/gameStore';
import { activityOf, addressText, assignCardView, clockText, groupedLines, money, pickerList, plural, takeTimer, taskNeeds, taskSummary, type AssignCardView } from '../store/selectors';
import type { RequirementReason } from '../rules/requirements';
import type { StatBlock } from '../model/picker';
import StatPentagon from './StatPentagon';
import { TIRED_BADGE_FROM } from '../config/pickers';
import { activityLine } from './activityText';
import { OUTCOME_LOOK, OUTCOMES_ORDER, STAT_LOOK, TASK_TYPE_LOOK, taskTitle } from './labels';
import { Avatar } from './PickerBits';
import Vx from './Vx';
import Icon from './icons';
import { usePhone } from '../app/usePhone';

const pct = (v: number) => Math.round(v * 100);
/** Число характеристики: целое — как есть, дробное (усталость) — с одним знаком. */
const statNum = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ','));

/** `renderPortrait` — 3D-портрет сборщика (его передаёт App: интерфейс сам 3D не импортирует). */
export default function AssignDialog({ renderPortrait }: { renderPortrait?: (picker: Picker) => ReactNode }) {
  const game = useGameStore((s) => s.game);
  const taskId = useGameStore((s) => s.ui.assignTaskId);
  const { choosePicker, closeAssign, sendChosenPicker } = useGameStore.getState();
  // «Почему такие шансы?» — всплывающее окно рядом с «?» поверх карточки (правка автора 18.10); одно на всё окно
  const [why, setWhy] = useState<{ pickerId: string; rect: DOMRect } | null>(null);

  const task = taskId ? game.tasks[taskId] : null;

  useEffect(() => {
    if (!task) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Escape') return;
      setWhy((w) => { if (!w) closeAssign(); return null; }); // Esc сначала закрывает расчёт, потом окно
    };
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
      <div className="ac-wrap" onClick={(e) => { e.stopPropagation(); setWhy(null); }}>
      <Vx className="ac-window" bodyClass="window">
        <div className="ac-inner">
          <TaskHead task={task} />
          <Needs task={task} />
          <div className="ac-cards">
            {pickerList(game.pickers).map((p) => {
              const v = assignCardView(game, p.id, task.id);
              if (!v) return null;
              const busy = v.check.ok ? null : p.state === 'idle' ? v.check.reason ?? 'Нельзя' : activityLine(activityOf(game, p.id)).text;
              return (
                <PickerCard
                  key={p.id}
                  view={v}
                  busy={busy}
                  portrait={renderPortrait?.(p)}
                  open={why?.pickerId === p.id}
                  onWhy={(rect) => setWhy((w) => (w?.pickerId === p.id ? null : { pickerId: p.id, rect }))}
                  onSend={() => send(p.id)}
                />
              );
            })}
          </div>
          <div className="ac-legend">Пунктир — что нужно, заливка — что умеет сборщик, красное — не хватает</div>
        </div>
      </Vx>
      </div>
      {why && game.pickers[why.pickerId] && (
        <WhyPopover view={assignCardView(game, why.pickerId, task.id)} rect={why.rect} />
      )}
    </div>
  );
}

const POP_W = 270;
/** Расчёт шанса — поверх, справа от «?» (не влезает — слева), по высоте в пределах экрана. */
function WhyPopover({ view, rect }: { view: AssignCardView | null; rect: DOMRect }) {
  if (!view) return null;
  const { picker: p, breakdown, eta } = view;
  const { chances, needs, coverage, fatigue } = breakdown;
  const right = rect.right + 10 + POP_W <= window.innerWidth - 8;
  const left = right ? rect.right + 10 : Math.max(8, rect.left - 10 - POP_W);
  const top = Math.min(Math.max(8, rect.top - 60), window.innerHeight - 300);
  return (
    <div
      className={`ac-pop ${right ? 'to-right' : 'to-left'}`}
      style={{ left, top, width: POP_W, '--pc': p.color, '--arrow-y': `${rect.top + rect.height / 2 - top}px` } as CSSProperties}
      onClick={(e) => e.stopPropagation()}
    >
      <b>{p.name}: что нужно заданию</b>
      {/* требования задания против рабочих характеристик (docs/10, раздел 14.5); не хватает — красным */}
      {needs.map((x) => (
        <span key={x.stat} className="row">
          <span>{STAT_LOOK[x.stat].name}</span>
          <span className={x.have >= x.need ? 'plus' : 'minus'}>{statNum(x.have)} из {x.need}</span>
        </span>
      ))}
      <span className="row total"><span>Покрытие</span><span>{pct(coverage)}%</span></span>
      <span className="row"><span>{OUTCOME_LOOK.perfect.name}</span><span>{pct(chances.perfect)}%</span></span>
      {fatigue > 0 && <span className="ac-mute">Усталость {Math.round(fatigue)}% снижает все характеристики.</span>}
      <span className="ac-mute">
        {OUTCOME_LOOK.withErrors.name} {pct(chances.withErrors)}%, {OUTCOME_LOOK.failed.name.toLowerCase()} {pct(chances.failed)}%.
        {' '}{STAT_LOOK.speed.name} {p.stats.speed}: {eta === null ? 'дорога —' : `до места ${clockText(eta)}`}.
      </span>
    </div>
  );
}

/** «Лапы 5, Нюх 5» — только ненулевые, в порядке осей. */
function statsText(adds: Partial<StatBlock>, sign = ''): string {
  return (Object.keys(STAT_LOOK) as (keyof typeof STAT_LOOK)[])
    .filter((k) => k !== 'energy' && (adds as Record<string, number | undefined>)[k])
    .map((k) => `${STAT_LOOK[k].name} ${sign}${(adds as Record<string, number>)[k]}`)
    .join(', ');
}

/** Строка «откуда требование»: «4 позиции → Память 4», «есть вода → Сила 5», «+ Лапы 5, Нюх 5». */
function reasonText(r: RequirementReason, productName: (id: string) => string, only: boolean): string {
  switch (r.kind) {
    case 'base': return only ? statsText(r.adds) : `+ ${statsText(r.adds)}`;
    case 'lines': return `${r.count} ${plural(r.count, 'позиция', 'позиции', 'позиций')} → ${statsText(r.adds)}`;
    case 'shelves': return `${r.count} ${plural(r.count, 'полка', 'полки', 'полок')} → ${statsText(r.adds)}`;
    case 'pallets': return `${r.count} ${plural(r.count, 'паллета', 'паллеты', 'паллет')} → ${statsText(r.adds, '+')}`;
    case 'heavy': return `есть ${productName(r.productId).toLowerCase()} → ${statsText(r.adds)}`;
    case 'difficulty': return `сложность ${r.level} → всё ×${r.factor.toFixed(2).replace('.', ',').replace(/0$/, '')}`;
  }
}

/** «Что нужно»: откуда взялись требования задания (X3, макет StatsAssign). */
function Needs({ task }: { task: Task }) {
  const products = useGameStore((s) => s.game.products);
  const { reasons } = taskNeeds(task);
  const name = (id: string) => products[id]?.name ?? id;
  return (
    <div className="ac-needs">
      <b>Что нужно</b>
      {reasons.map((r, i) => <span key={i}>{reasonText(r, name, reasons.length === 1)}</span>)}
    </div>
  );
}

/** Шапка: тип и номер задания, коротко что внутри, награда, пауза; позиции — мелко ниже. */
function TaskHead({ task }: { task: Task }) {
  const game = useGameStore((s) => s.game);
  const closeAssign = useGameStore((s) => s.closeAssign);
  const look = TASK_TYPE_LOOK[task.type];
  const phone = usePhone();
  const lines = (
    <div className="ac-lines">
      {task.type === 'order' && task.payload.lines.map((l) => (
        <span key={`${l.productId}-${addressText(l.address)}`} className="ac-line">
          <span className="tag">{addressText(l.address)}</span>
          {game.products[l.productId]?.name ?? l.productId} ×{l.qty}
        </span>
      ))}
      {/* у списания одна позиция, и она уже написана строкой выше — не повторяем (прогон 18.10) */}
      {task.type !== 'order' && task.type !== 'writeoff' && groupedLines(game, task).map((g) => (
        <span key={g.productId} className="ac-line">
          {g.name} ×{g.qty}
          {g.places.length > 0 && <span className="places">{g.places.join(', ')}</span>}
        </span>
      ))}
    </div>
  );
  // телефон (R2, макет R0): название и ×, три плашки «Награда / Взять до / Что внутри», позиции в две колонки
  if (phone) {
    const timer = takeTimer(game, task);
    return (
      <div className="ac-head">
        <div className="ac-head-row">
          <Vx className="task-icon" style={{ '--tint': look.tint } as CSSProperties}><Icon name={look.icon} /></Vx>
          <div className="ac-title grow">{taskTitle(task)}</div>
          <button className="call-close" onClick={closeAssign} aria-label="Закрыть">×</button>
        </div>
        <div className="ac-plaques">
          <span><small>Награда</small><b>{task.overdue ? 'нет' : `+${money(task.reward.money)}`}</b></span>
          <span className={timer?.warn ? 'warn' : ''}><small>Взять до</small><b>{timer ? clockText(timer.secondsLeft) : task.overdue ? 'просрочено' : '—'}</b></span>
          <span><small>Что внутри</small><b>{taskSummary(game, task)}</b></span>
        </div>
        {lines}
      </div>
    );
  }
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
      {lines}
    </div>
  );
}

type CardProps = {
  view: AssignCardView;
  busy: string | null;
  portrait: ReactNode;
  open: boolean;
  onWhy: (rect: DOMRect) => void;
  onSend: () => void;
};

/**
 * Карточка сборщика — вся карточка кнопка, как вариант в развилке (правка автора 18.10).
 * На карточке только то, по чему выбирают: пятиугольник против требований, шансы и когда будет готово.
 * Числа — в расчёте шансов («?») и в профиле; бодрость — плашкой, только когда устал.
 */
function PickerCard({ view, busy, portrait, open, onWhy, onSend }: CardProps) {
  const phone = usePhone();
  const { picker: p, breakdown, total, stats, req } = view;
  const { chances } = breakdown;
  const tired = p.stats.fatigue >= TIRED_BADGE_FROM ? Math.round(p.stats.fatigue) : null;
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
          {!busy && tired !== null && <span className="ac-tired">Устал {tired}%</span>}
        </div>

        <div className="ac-body">
          {/* что умеет сборщик против того, что нужно заданию (X3) */}
          <div className="ac-pent"><StatPentagon stats={stats} req={req} color={p.color} size={phone ? 80 : 104} /></div>

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
              onClick={(e) => { e.stopPropagation(); onWhy(e.currentTarget.getBoundingClientRect()); }}
              aria-expanded={open}
              aria-label="Почему такие шансы?"
              title="Почему такие шансы?"
            >?</button>
          </div>
          <div className="ac-time">
            {busy ? <span>Сейчас занят</span> : total === null ? <span>Не дойти</span> : <span>Готово через <b>~{clockText(total)}</b></span>}
          </div>
        </div>
      </Vx>
    </div>
  );
}
