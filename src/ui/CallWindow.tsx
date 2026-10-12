// Развилки (docs/10-minigames-concept.md, раздел 3): окна-вызовы от сборщиков, столбиком справа.
// Вызов: кто зовёт, ситуация, варианты (время, последствие, риск словом) и таймер; закрытые варианты — серые с требованием.
// После ответа окно ~2 с показывает выбор: «Ваше решение» или «Лаки решил сам» (решение автора 13.10).
// Мир не стоит; на паузе таймеры стоят. Клавиши 1 / 2 / 3 — ответ на верхний вызов.
import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { CALLS } from '../config/calls';
import type { Picker } from '../model/picker';
import { useGameStore } from '../store/gameStore';
import { callsView, clockText, flashView, type CallOptionView } from '../store/selectors';
import { RISK_LOOK } from './labels';
import { Avatar } from './PickerBits';
import Vx from './Vx';

const FLASH_MS = 2000;
const STAT_NAME = { accuracy: 'точность', speed: 'скорость' } as const;

type CardProps = {
  picker: Picker;
  taskNumber: number;
  text: string;
  options: CallOptionView[];
  // вызов ждёт ответа:
  secondsLeft?: number;
  withKeys?: boolean;
  onAnswer?: (optionId: string) => void;
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
          <div className="call-sub">{decided ? (p.auto ? `${p.picker.name} решил сам` : 'Ваше решение') : 'Зовёт диспетчера'}</div>
        </div>
        {!decided && <div className="call-time">{clockText(p.secondsLeft ?? 0)}</div>}
      </div>
      {!decided && (
        <div className="progress wide"><b style={{ width: `${((p.secondsLeft ?? 0) / CALLS.answerSeconds) * 100}%` }} /></div>
      )}
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
      {!decided && <div className="note">Не ответите — {p.picker.name} решит сам, и риск будет выше.</div>}
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
  const assignOpen = useGameStore((s) => s.ui.assignTaskId !== null);
  const answer = useGameStore((s) => s.answerCall);
  const { shown, queued } = callsView(game);
  const top = shown[0];

  useEffect(() => {
    if (!top || assignOpen) return;
    const available = top.options.filter((o) => !o.locked);
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
      if (n >= 0 && available[n]) answer(top.id, available[n].id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [top, assignOpen, answer]);

  // окно назначения стоит на том же месте и ставит мир на паузу — вызовы подождут
  if ((shown.length === 0 && flashes.length === 0) || assignOpen) return null;

  return (
    <div className={`calls${game.minigame ? ' beside-tsd' : ''}`}>
      {flashes.map((f) => {
        const v = flashView(game, f);
        if (!v.picker) return null;
        return (
          <Flash key={`f${f.id}`} id={f.id}>
            <CallCard picker={v.picker} taskNumber={v.taskNumber} text={v.text} options={v.options} chosenId={v.chosenId} auto={v.auto} />
          </Flash>
        );
      })}
      {shown.map((c, i) => (
        <CallCard
          key={c.id}
          picker={c.picker}
          taskNumber={c.taskNumber}
          text={c.text}
          options={c.options}
          secondsLeft={c.secondsLeft}
          withKeys={i === 0}
          onAnswer={(optionId) => answer(c.id, optionId)}
        />
      ))}
      {queued > 0 && <Vx className="call-queue">Ещё вызовов в очереди: {queued}</Vx>}
    </div>
  );
}
