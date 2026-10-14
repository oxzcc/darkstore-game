// Экран ТСД в «Сроке» (docs/10-minigames-concept.md, раздел 11.3; прототип и правки автора 14.10).
// Сверху по центру: «Найдите · товар», «Годен не ранее …», «сегодня …», полоса времени.
// Сама штука — 3D-модель на сцене (scene/ExpiryShelf.tsx): её поднимают с полки и крутят мышью; клик мимо — обратно на полку.
// Здесь, пока штука в руках, — только «Взять» (Enter) и подсказка; Esc — положить обратно. Итог — по центру с затемнением.
// Только показывает данные из props и передаёт клики наверх (09, раздел 6.3).
import { useEffect, type CSSProperties } from 'react';
import type { ExpiryView } from '../../store/selectors';
import { OUTCOME_LOOK } from '../../ui/labels';
import Vx from '../../ui/Vx';

type Props = {
  view: ExpiryView;
  onBack: () => void;
  onTake: () => void;
  onClose: () => void;
};

export default function ExpiryTsd({ view, onBack, onTake, onClose }: Props) {
  const look = view.product.look;
  const done = view.result !== null;
  const holding = view.open !== null && !done;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (done) { if (e.code === 'Enter' || e.code === 'Escape') onClose(); return; }
      if (!holding) return;
      if (e.code === 'Escape') onBack();
      if (e.code === 'Enter') onTake();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [done, holding, onBack, onTake, onClose]);

  const result = view.result ? OUTCOME_LOOK[view.result] : null;
  const resultText = view.note === 'timeout'
    ? 'Время вышло'
    : view.taken
      ? (view.result === 'failed' ? `Срок до ${view.taken.date} — нужен не ранее ${view.need}` : `Срок до ${view.taken.date} — подходит${view.result === 'withErrors' ? ', но искали долго' : ''}`)
      : '';

  return (
    <>
      <div className="depth-hud-wrap">
        <Vx className="depth-hud">
          <div className="depth-hud-item">
            <span className="swatch" style={look ? ({ '--sw': look.color, '--sw2': look.accent } as CSSProperties) : undefined} />
            <div>
              <div className="depth-hud-label">Найдите</div>
              <div className="depth-hud-name">{view.product.name}</div>
            </div>
          </div>
          <div className="depth-hud-sep" />
          <div className="depth-hud-moves">
            <div className="depth-hud-moves-top"><span>Годен не ранее</span><b>{view.need}</b></div>
            <div className="depth-track-legend"><span>сегодня {view.today}</span></div>
            <div className={`depth-time${view.secondsLeft <= 8 ? ' low' : ''}`}><b style={{ width: `${(view.secondsLeft / view.timeLimit) * 100}%` }} /></div>
          </div>
        </Vx>
      </div>

      {holding && (
        <div className="expiry-hold">
          <div className="expiry-hold-hint">тяните, чтобы покрутить · клик мимо — на полку</div>
          <button className="btn primary" onClick={onTake}><Vx>Взять · Enter</Vx></button>
        </div>
      )}

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
