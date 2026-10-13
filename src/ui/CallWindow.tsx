// Окно развилки по центру экрана — по макету автора ui_11 (13.10; docs/10-minigames-concept.md, раздел 3).
// Сначала над сборщиком только красный «!» с таймером по контуру (scene/Pickers.tsx). Клик по нему — это окно:
// слева портрет (пока заглушка), справа реплика сборщика; ниже карточки вариантов (время, риск словом и делениями);
// закрытые варианты — серые с требованием. Мир на паузе; внизу — что сборщик выберет сам и через сколько.
// × или Esc — закрыть, мир идёт дальше. После ответа окно ~1,5 с показывает выбор, потом открывается следующая развилка.
import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { CALLS } from '../config/calls';
import type { Picker } from '../model/picker';
import { useGameStore } from '../store/gameStore';
import { callsView, clockText, flashView, plural, type CallOptionView } from '../store/selectors';
import { RISK_LOOK } from './labels';
import Vx from './Vx';

const FLASH_MS = 1500;
const STAT_NAME = { accuracy: 'точность', speed: 'скорость' } as const;

type CardProps = {
  picker: Picker;
  taskNumber: number;
  text: string;
  riskLabel: string;
  options: CallOptionView[];
  autoNumber: number | null;
  // вызов ждёт ответа:
  secondsLeft?: number;
  waiting?: string[];                 // кто ещё ждёт помощи
  onAnswer?: (optionId: string) => void;
  onClose?: () => void;
  // ответ уже есть:
  chosenId?: string;
  auto?: boolean;
};

function Risk({ risk }: { risk: CallOptionView['risk'] }) {
  return (
    <span className={`fork-risk risk-${risk}`}>
      <b>{RISK_LOOK[risk].name}</b>
      <span>{[1, 2, 3].map((b) => <i key={b} className={b <= RISK_LOOK[risk].bars ? 'on' : ''} />)}</span>
    </span>
  );
}

function secondsText(s: number): string {
  return s > 0 ? `+${s} ${plural(s, 'секунда', 'секунды', 'секунд')}` : 'не меняется';
}

function ForkCard(p: CardProps) {
  const decided = p.chosenId !== undefined;
  const chosen = p.options.find((o) => o.id === p.chosenId);
  return (
    <div className={`fork-wrap${decided ? ' decided' : ''}`} style={{ '--pc': p.picker.color } as CSSProperties}>
    {/* заглушка портрета 224 × 257: сборщик по пояс с ТСД (решение автора 13.10 — картинка позже).
        Стоит поверх окна и выходит за его верх, как на макете (сама подложка окна обрезает всё, что выходит за край). */}
    <div className="fork-portrait"><span>{p.picker.name[0]}</span><em>{p.picker.name}</em></div>
    <Vx className="fork">
      <div className="fork-top">
        <div className="fork-portrait-space" />
        <div className="fork-talk">
          <div className="fork-tab-row">
            <div className="fork-tab"><b>{p.picker.name}</b> · Сборка №{p.taskNumber}</div>
            {p.onClose && <button className="call-close" title="Закрыть (Esc) — мир продолжит идти" onClick={p.onClose}>×</button>}
          </div>
          <div className="fork-bubble">«{p.text}»</div>
        </div>
      </div>

      <div className="fork-hint">
        {decided
          ? (p.auto ? `${p.picker.name} решил сам: ${chosen?.label ?? ''}` : `Ваше решение: ${chosen?.label ?? ''}`)
          : 'Выберите вариант — кликом или клавишами 1–' + p.options.filter((o) => !o.locked).length}
      </div>

      <div className="fork-options" style={{ '--n': p.options.filter((o) => !o.tsd).length } as CSSProperties}>
        {p.options.map((o) => {
          const state = decided ? (o.id === p.chosenId ? ' chosen' : ' dim') : o.locked ? ' locked' : '';
          // «Взять ТСД» — во всю ширину под остальными (10, раздел 11.1): риска нет, исход решает игрок
          if (o.tsd) return (
            <button key={o.id} className={`fork-option tsd${state}`} disabled={decided || o.locked} onClick={() => p.onAnswer?.(o.id)}>
              <div className="fork-tsd-main">
                <div className="fork-option-head">
                  {o.number !== null && <span className="call-key">{o.number}</span>}
                  <span className="fork-tsd-icon">ТСД</span>
                  <span>{o.label}</span>
                </div>
                <div className="fork-option-text">{o.text}</div>
              </div>
              <div className="fork-tsd-rows">
                <div className="fork-option-row"><span>Время сборки</span><b>пока вы играете</b></div>
                <div className="fork-option-row"><span>Исход</span><b className="tsd-yours">зависит от вас</b></div>
              </div>
            </button>
          );
          return (
            <button key={o.id} className={`fork-option${state}`} disabled={decided || o.locked} onClick={() => p.onAnswer?.(o.id)}>
              <div className="fork-option-head">
                {o.number !== null && <span className="call-key">{o.number}</span>}
                <span>{o.label}</span>
              </div>
              <div className="fork-option-text">
                {o.locked && o.requires ? `Нужна ${STAT_NAME[o.requires.stat]} ${o.requires.min} — у ${p.picker.name} меньше.` : o.text}
              </div>
              <div className="fork-option-line" />
              <div className="fork-option-row"><span>Время сборки</span><b className={o.seconds > 0 ? 'slow' : ''}>{secondsText(o.seconds)}</b></div>
              <div className="fork-option-row"><span>{p.riskLabel}</span><Risk risk={o.risk} /></div>
            </button>
          );
        })}
      </div>

      {!decided && (
        <div className="fork-foot">
          <div className="fork-foot-text">
            Игра на паузе. Если не ответить, {p.picker.name} выберет вариант {p.autoNumber ?? '—'}.
            {p.waiting && p.waiting.length > 0 ? ` Ещё ждут помощи: ${p.waiting.join(', ')}.` : ''}
          </div>
          <div className="fork-foot-timer">
            <span>{p.picker.name} решит сам через</span>
            <div className="progress"><b style={{ width: `${((p.secondsLeft ?? 0) / CALLS.answerSeconds) * 100}%` }} /></div>
            <b>{clockText(p.secondsLeft ?? 0)}</b>
          </div>
        </div>
      )}
    </Vx>
    </div>
  );
}

/** Вспышка после ответа: сама уходит через FLASH_MS. */
function Flash({ id, children }: { id: number; children: ReactNode }) {
  const dismiss = useGameStore((s) => s.dismissFlash);
  useEffect(() => {
    const t = setTimeout(() => dismiss(id), FLASH_MS);
    return () => clearTimeout(t);
  }, [id, dismiss]);
  return <>{children}</>;
}

export default function CallWindow() {
  const game = useGameStore((s) => s.game);
  const flashes = useGameStore((s) => s.ui.callFlashes);
  const openCallId = useGameStore((s) => s.ui.openCallId);
  const assignOpen = useGameStore((s) => s.ui.assignTaskId !== null);
  const { answerCall: answer, closeCall } = useGameStore.getState();
  const { shown } = callsView(game);
  const open = shown.find((c) => c.id === openCallId);

  useEffect(() => {
    if (!open || assignOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'Escape') { closeCall(); return; }
      const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].indexOf(e.code) + 1;
      const o = open.options.find((x) => x.number === n);
      if (o) answer(open.id, o.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, assignOpen, answer, closeCall]);

  // окно назначения тоже ставит мир на паузу — развилка подождёт
  if (assignOpen) return null;
  const flash = flashes[0];
  const fv = flash ? flashView(game, flash) : null;

  return (
    <>
      {fv?.picker && (
        <div className="call-center">
          <Flash key={`f${fv.id}`} id={fv.id}>
            <ForkCard {...fv} />
          </Flash>
        </div>
      )}
      {!fv && open && open.picker && (
        <div className="call-center">
          <ForkCard
            key={open.id}
            {...open}
            waiting={shown.filter((c) => c.id !== open.id).map((c) => c.picker?.name ?? '')}
            onAnswer={(optionId) => answer(open.id, optionId)}
            onClose={closeCall}
          />
        </div>
      )}
    </>
  );
}
