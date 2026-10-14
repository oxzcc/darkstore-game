// Экран ТСД в «Штрихкоде» (docs/10-minigames-concept.md, раздел 11.3; прототип одобрен автором 14.10).
// Окно ТСД — как на макете автора ui_04_tsd.png: корпус терминала (public/assets/pdt.png) справа, на экране — строка статуса,
// зелёная шапка с названием и красным таймером, полоска попыток, строки попыток с отметками, клавиатура, «Стереть» и «Ввод».
// Зелёная кнопка на корпусе — тоже «Ввод». Видимые цифры кода на ТСД не показываются, клавиатура без подсказок (решения автора 14.10).
// Только показывает данные из props и передаёт клики наверх (09, раздел 6.3).
import { useEffect, useState, type CSSProperties } from 'react';
import type { BarcodeView } from '../../store/selectors';
import { clockText } from '../../store/selectors';
import { OUTCOME_LOOK } from '../../ui/labels';
import Vx from '../../ui/Vx';

type Props = {
  view: BarcodeView;
  onDigit: (d: number) => void;
  onErase: () => void;
  onEnter: () => void;
  onClose: () => void;
};

const DESIGN_HEIGHT = 860; // корпус рисуется в этой высоте и масштабируется под окно

export default function BarcodeTsd({ view, onDigit, onErase, onEnter, onClose }: Props) {
  const done = view.result !== null;
  const [k, setK] = useState(1);

  useEffect(() => {
    const fit = () => setK(Math.min(1, (window.innerHeight - 40) / DESIGN_HEIGHT));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (done) { if (e.code === 'Enter' || e.code === 'Escape') onClose(); return; }
      if (!view.ready) return;
      const m = /^(?:Digit|Numpad)(\d)$/.exec(e.code);
      if (m) onDigit(Number(m[1]));
      else if (e.code === 'Backspace') onErase();
      else if (e.code === 'Enter' || e.code === 'NumpadEnter') onEnter();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [done, view.ready, onDigit, onErase, onEnter, onClose]);

  const used = view.guesses.length;
  const rows = Array.from({ length: view.attempts }, (_, r) => {
    if (r < used) return { cells: view.guesses[r].digits.map((d, i) => ({ d, mark: view.guesses[r].marks[i] as string })), current: false };
    if (r === used && !done) return { cells: Array.from({ length: view.hiddenCount }, (_, i) => ({ d: view.input[i], mark: '' })), current: true };
    return { cells: Array.from({ length: view.hiddenCount }, () => ({ d: undefined as number | undefined, mark: '' })), current: false };
  });
  const result = view.result ? OUTCOME_LOOK[view.result] : null;
  const resultText = view.note === 'timeout'
    ? `Время вышло · код ${view.code}`
    : view.note === 'outOfTries'
      ? `Попытки кончились · код ${view.code}`
      : `Код верный с ${used}-й попытки`;

  return (
    <>
      <div className="pdt-wrap" style={{ '--k': k } as CSSProperties}>
        <div className="pdt">
          <img className="pdt-body" src="/assets/pdt.png" alt="" draggable={false} />
          <div className="pdt-screen">
            <div className="pdt-status"><span>ТСД-07 · {view.picker.name.toUpperCase()}</span><span>ручной ввод</span></div>
            <div className="pdt-head">
              <div>
                <div className="pdt-head-sub">ШТРИХКОД НЕ ЧИТАЕТСЯ</div>
                <div className="pdt-head-title">{view.product.name}</div>
              </div>
              <div className={`pdt-timer${view.secondsLeft <= 10 && !done ? ' low' : ''}`}>{clockText(view.secondsLeft)}</div>
            </div>
            <div className="pdt-progress">
              <span>{used} / {view.attempts}</span>
              <div className="pdt-segs">
                {Array.from({ length: view.attempts }, (_, i) => (
                  <i key={i} className={`${i < used ? 'on' : ''}${i < view.perfectWithin ? ' perfect' : ''}`} />
                ))}
              </div>
            </div>
            <div className="pdt-card">
              <div className="pdt-card-tab">ВВЕДИТЕ СТЁРТЫЕ ЦИФРЫ</div>
              <div className="pdt-rows">
                {rows.map((row, r) => (
                  <div key={r} className="pdt-row">
                    {row.cells.map((c, i) => (
                      <div key={i} className={`pdt-cell ${c.mark}${row.current && i === view.input.length ? ' cur' : ''}`}>{c.d ?? ''}</div>
                    ))}
                  </div>
                ))}
              </div>
              <div className="pdt-legend">
                <span><i className="hit" />на месте</span><span><i className="near" />не на месте</span><span><i className="miss" />нет</span>
              </div>
            </div>
            <div className="pdt-keys">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d) => (
                <button key={d} className="pdt-key" disabled={!view.ready || done} onClick={() => onDigit(d)}>{d}</button>
              ))}
            </div>
            <div className="pdt-actions">
              <button className="pdt-btn ok" disabled={!view.ready || done} onClick={onEnter}>ВВОД</button>
              <button className="pdt-btn" disabled={!view.ready || done} onClick={onErase}>СТЕРЕТЬ</button>
            </div>
            {!view.ready && <div className="pdt-wait">Достаём товар…</div>}
          </div>
          {/* зелёная кнопка на корпусе — «Ввод» */}
          <button className="pdt-hw-ok" title="Ввод (Enter)" disabled={!view.ready || done} onClick={onEnter} />
        </div>
      </div>

      {result && (
        <div className="depth-result-dim">
          <Vx className="depth-result" style={{ '--oc': result.color } as CSSProperties}>
            <div className="depth-result-name">{result.name}</div>
            <div className="depth-result-sub">{resultText}</div>
            <button className="btn primary" onClick={onClose}><Vx>К складу · Enter</Vx></button>
          </Vx>
        </div>
      )}
    </>
  );
}
