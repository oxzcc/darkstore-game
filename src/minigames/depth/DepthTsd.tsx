// Экран ТСД в «Глубине» (docs/10-minigames-concept.md, раздел 11.3; вид — по прототипу, одобрен автором 14.10).
// Сверху по центру одна плашка: что достать и ходы (дорожка: зелёные клетки — «идеально», оранжевые — «с ошибками»,
// крестик — дальше провал) и тонкая полоса времени. Итог — окно по центру, фон затемнён.
// Сама полка с лотками — на сцене (scene/DepthShelf.tsx). Только показывает данные из props (09, раздел 6.3).
import { useEffect, type CSSProperties } from 'react';
import type { DepthView } from '../../store/selectors';
import { plural } from '../../store/selectors';
import { OUTCOME_LOOK } from '../../ui/labels';
import Vx from '../../ui/Vx';

const NOTE_TEXT: Partial<Record<NonNullable<DepthView['note']>, string>> = {
  stuck: 'Этот лоток некуда сдвинуть',
};

function resultText(v: DepthView): string {
  if (v.note === 'timeout') return 'Время вышло';
  if (v.note === 'tooMany') return `Больше ${v.errorsUpTo} ${plural(v.errorsUpTo, 'хода', 'ходов', 'ходов')}`;
  return `${v.moves} ${plural(v.moves, 'ход', 'хода', 'ходов')} · лучший путь — ${v.best}`;
}

export default function DepthTsd({ view, onClose }: { view: DepthView; onClose: () => void }) {
  const look = view.product.look;
  const done = view.result !== null;

  useEffect(() => {
    if (!done) return;
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Enter' || e.code === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [done, onClose]);

  const note = view.note && !done ? NOTE_TEXT[view.note] : undefined;
  const result = view.result ? OUTCOME_LOOK[view.result] : null;
  const timeShare = view.secondsLeft / view.timeLimit;

  return (
    <>
      <div className="depth-hud-wrap">
        <Vx className="depth-hud">
          <div className="depth-hud-item">
            <span className="swatch" style={look ? ({ '--sw': look.color, '--sw2': look.accent } as CSSProperties) : undefined} />
            <div>
              <div className="depth-hud-label">Достаньте</div>
              <div className="depth-hud-name">{view.product.name}</div>
            </div>
          </div>
          <div className="depth-hud-sep" />
          <div className="depth-hud-moves">
            <div className="depth-hud-moves-top">
              <span>Ходы</span>
              <b>{view.moves} <small>из {view.errorsUpTo}</small></b>
            </div>
            <div className="depth-track">
              {Array.from({ length: view.errorsUpTo }, (_, i) => (
                <i key={i} className={i < view.moves ? 'on' : ''}
                  style={{ '--zone': i < view.perfectUpTo ? 'var(--perfect)' : 'var(--errors)' } as CSSProperties} />
              ))}
              <i className="end" title="дальше — провал" />
            </div>
            <div className="depth-track-legend">
              <span>идеально до {view.perfectUpTo}</span>
              <span>с ошибками до {view.errorsUpTo}</span>
            </div>
            <div className={`depth-time${view.secondsLeft <= 8 ? ' low' : ''}`}><b style={{ width: `${timeShare * 100}%` }} /></div>
          </div>
        </Vx>
        {note && <div key={view.noteAt} className="depth-note">{note}</div>}
      </div>

      {result && (
        <div className="depth-result-dim">
          <Vx className="depth-result" style={{ '--oc': result.color } as CSSProperties}>
            <div className="depth-result-name">{result.name}</div>
            <div className="depth-result-sub">{resultText(view)}</div>
            <button className="btn primary" onClick={onClose}><Vx>К складу · Enter</Vx></button>
          </Vx>
        </div>
      )}
    </>
  );
}
