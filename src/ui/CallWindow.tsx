// Развилки (docs/10-minigames-concept.md, раздел 3): окна-вызовы от сборщиков, столбиком справа.
// В каждом — кто зовёт, ситуация, 2–3 варианта (время, последствие, риск словом) и таймер.
// Мир не стоит; на паузе таймеры стоят. Клавиши 1 / 2 / 3 — ответ на верхний вызов.
import { useEffect, type CSSProperties } from 'react';
import { CALLS } from '../config/calls';
import { useGameStore } from '../store/gameStore';
import { callsView, clockText } from '../store/selectors';
import { RISK_LOOK } from './labels';
import { Avatar } from './PickerBits';
import Vx from './Vx';

export default function CallWindow() {
  const game = useGameStore((s) => s.game);
  const assignOpen = useGameStore((s) => s.ui.assignTaskId !== null);
  const answer = useGameStore((s) => s.answerCall);
  const { shown, queued } = callsView(game);
  const top = shown[0];

  useEffect(() => {
    if (!top || assignOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
      if (n >= 0 && top.options[n]) answer(top.id, top.options[n].id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [top, assignOpen, answer]);

  // окно назначения стоит на том же месте и ставит мир на паузу — вызовы подождут
  if (shown.length === 0 || assignOpen) return null;

  return (
    <div className={`calls${game.minigame ? ' beside-tsd' : ''}`}>
      {shown.map((c, i) => (
        <Vx key={c.id} className="call" style={{ '--pc': c.picker.color } as CSSProperties}>
          <div className="call-head">
            <Avatar picker={c.picker} small />
            <div className="grow">
              <div className="call-who">{c.picker.name} · Сборка №{c.taskNumber}</div>
              <div className="call-sub">Зовёт диспетчера</div>
            </div>
            <div className="call-time">{clockText(c.secondsLeft)}</div>
          </div>
          <div className="progress wide"><b style={{ width: `${(c.secondsLeft / CALLS.answerSeconds) * 100}%` }} /></div>
          <div className="call-text">{c.text}</div>
          <div className="call-options">
            {c.options.map((o, k) => (
              <button key={o.id} className="call-option" onClick={() => answer(c.id, o.id)}>
                {i === 0 && <span className="call-key">{k + 1}</span>}
                <span className="grow">
                  <span className="call-label">{o.label}</span>
                  <span className="call-note">
                    {o.seconds > 0 ? `+${o.seconds} с` : 'без задержки'}
                    {o.note ? ` · ${o.note}` : ''}
                    {o.requires ? ` · ★ ${o.requires.stat === 'accuracy' ? 'точность' : 'скорость'} ${c.picker.name}` : ''}
                  </span>
                </span>
                <span className={`risk risk-${o.risk}`} title={`Риск: ${RISK_LOOK[o.risk].name}`}>
                  {[1, 2, 3].map((b) => <i key={b} className={b <= RISK_LOOK[o.risk].bars ? 'on' : ''} />)}
                  <em>{RISK_LOOK[o.risk].name}</em>
                </span>
              </button>
            ))}
          </div>
          <div className="note">Не ответите — {c.picker.name} решит сам, и риск будет выше.</div>
        </Vx>
      ))}
      {queued > 0 && <Vx className="call-queue">Ещё вызовов в очереди: {queued}</Vx>}
    </div>
  );
}
