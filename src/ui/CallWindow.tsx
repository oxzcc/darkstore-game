// Окно развилки (docs/10-minigames-concept.md, раздел 3; переделка по решению автора 13.10).
// Сначала над сборщиком только красный «!» с таймером по контуру (scene/Pickers.tsx). Клик по нему — это окно по центру:
// мир на паузе, таймера в окне нет. Варианты: время, последствие, риск словом; закрытые — серые с требованием.
// Закрыть (× или Esc) — мир идёт дальше. После ответа окно ~1,5 с показывает выбор, потом открывается следующая ждущая развилка.
// Клавиши 1 / 2 / 3 — ответ.
import { useEffect, type CSSProperties, type ReactNode } from 'react';
import type { Picker } from '../model/picker';
import { useGameStore } from '../store/gameStore';
import { callsView, flashView, type CallOptionView } from '../store/selectors';
import { RISK_LOOK } from './labels';
import { Avatar } from './PickerBits';
import Vx from './Vx';

const FLASH_MS = 1500;
const STAT_NAME = { accuracy: 'точность', speed: 'скорость' } as const;

type CardProps = {
  picker: Picker;
  taskNumber: number;
  text: string;
  options: CallOptionView[];
  // вызов ждёт ответа:
  withKeys?: boolean;
  onAnswer?: (optionId: string) => void;
  onClose?: () => void;
  waiting?: number; // сколько ещё сборщиков ждут помощи
  // ответ уже есть:
  chosenId?: string;
  auto?: boolean;
};

function Risk({ risk }: { risk: CallOptionView['risk'] }) {
  return (
    <span className="risk" title={`Риск: ${RISK_LOOK[risk].name}`}>
      {[1, 2, 3].map((b) => <i key={b} className={b <= RISK_LOOK[risk].bars ? 'on' : ''} />)}
      <em>{RISK_LOOK[risk].name}</em>
    </span>
  );
}

function CallCard(p: CardProps) {
  const decided = p.chosenId !== undefined;
  let key = 0; // номера только у доступных вариантов
  return (
    <Vx className={`call${decided ? ' decided' : ''}`} style={{ '--pc': p.picker.color } as CSSProperties}>
      <div className="call-head">
        <Avatar picker={p.picker} small />
        <div className="grow">
          <div className="call-who">{p.picker.name} · Сборка №{p.taskNumber}</div>
          <div className="call-sub">{decided ? (p.auto ? `${p.picker.name} решил сам` : 'Ваше решение') : 'Нужна помощь'}</div>
        </div>
        {p.onClose && <button className="call-close" title="Закрыть (Esc) — мир продолжит идти" onClick={p.onClose}>×</button>}
      </div>
      <div className="call-text">{p.text}</div>
      <div className="call-options">
        {p.options.map((o) => {
          const n = o.locked ? null : ++key;
          const state = decided ? (o.id === p.chosenId ? ' chosen' : ' dim') : o.locked ? ' locked' : '';
          return (
            <button
              key={o.id}
              className={`call-option${state}`}
              disabled={decided || o.locked}
              onClick={() => p.onAnswer?.(o.id)}
            >
              {p.withKeys && n !== null && <span className="call-key">{n}</span>}
              <span className="grow">
                <span className="call-label">{o.label}</span>
                <span className="call-note">
                  {o.locked && o.requires
                    ? `нужна ${STAT_NAME[o.requires.stat]} ${o.requires.min}`
                    : <>
                        {o.seconds > 0 ? `+${o.seconds} с` : 'без задержки'}
                        {o.note ? ` · ${o.note}` : ''}
                        {o.requires ? ` · ★ ${STAT_NAME[o.requires.stat]} ${p.picker.name}` : ''}
                      </>}
                </span>
              </span>
              <Risk risk={o.risk} />
            </button>
          );
        })}
      </div>
      {!decided && (
        <div className="note">
          Мир на паузе. Закроете окно — {p.picker.name} подождёт, но если не решить вовремя, решит сам, и риск будет выше.
          {p.waiting ? ` Ещё ждут помощи: ${p.waiting}.` : ''}
        </div>
      )}
    </Vx>
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
    const available = open.options.filter((o) => !o.locked);
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'Escape') { closeCall(); return; }
      const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
      if (n >= 0 && available[n]) answer(open.id, available[n].id);
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
            <CallCard picker={fv.picker} taskNumber={fv.taskNumber} text={fv.text} options={fv.options} chosenId={fv.chosenId} auto={fv.auto} />
          </Flash>
        </div>
      )}
      {!fv && open && (
        <div className="call-center">
          <CallCard
            key={open.id}
            picker={open.picker}
            taskNumber={open.taskNumber}
            text={open.text}
            options={open.options}
            withKeys
            onAnswer={(optionId) => answer(open.id, optionId)}
            onClose={closeCall}
            waiting={shown.length - 1}
          />
        </div>
      )}
    </>
  );
}
