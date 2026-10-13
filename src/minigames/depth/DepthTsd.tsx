// Экран ТСД в «Глубине» (docs/10-minigames-concept.md, раздел 11.3): что достать, с какой полки, время и ходы.
// Сама полка с коробками — на сцене (scene/DepthShelf.tsx). Только показывает данные из props (09, раздел 6.3).
import { useEffect, type CSSProperties } from 'react';
import type { DepthView } from '../../store/selectors';
import { clockText, plural } from '../../store/selectors';
import { OUTCOME_LOOK } from '../../ui/labels';
import Vx from '../../ui/Vx';

const NOTE_TEXT: Record<string, { text: string; cls: string }> = {
  stuck: { text: 'Рядом нет пустого места — коробка не сдвинется', cls: 'mute' },
  timeout: { text: 'Время вышло', cls: 'bad' },
  tooMany: { text: 'Слишком много ходов', cls: 'bad' },
};

export default function DepthTsd({ view, onClose }: { view: DepthView; onClose: () => void }) {
  const look = view.product.look;
  const done = view.result !== null;

  useEffect(() => {
    if (!done) return;
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Enter' || e.code === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [done, onClose]);

  const note = view.note ? NOTE_TEXT[view.note] : undefined;
  const result = view.result ? OUTCOME_LOOK[view.result] : null;

  return (
    <div className="tsd">
      <div className="tsd-head">
        <div className="tsd-head-title">Достаньте товар</div>
        <div className={`tsd-head-time${view.secondsLeft <= 5 && !done ? ' late' : ''}`}>{clockText(view.secondsLeft)}</div>
        <div className="progress wide tsd-time-bar"><b style={{ width: `${(view.secondsLeft / view.timeLimit) * 100}%` }} /></div>
      </div>

      <div className="tsd-scroll">
        <div className="tsd-info">
          <div className="tsd-info-row">
            <span className="tsd-order-no">Заказ №{view.taskNumber}</span>
            <span className="tsd-units">полка {view.address}</span>
          </div>
          <div className="tsd-chips">
            <span className="tsd-chip picker" style={{ '--pc': view.picker.color } as CSSProperties}>{view.picker.name}</span>
            <span className="tsd-chip">товар в глубине полки</span>
          </div>
        </div>

        <div className="tsd-line">
          <span className="swatch" style={look ? ({ '--sw': look.color, '--sw2': look.accent } as CSSProperties) : undefined} />
          <div className="tsd-line-text">
            <div className="tsd-line-name">{view.product.name}</div>
            <span className="tsd-qty part">у задней стенки</span>
          </div>
        </div>

        <div className="depth-rules">
          <p>Кликайте по коробкам рядом с пустым местом — они сдвигаются.</p>
          <p>Выведите <b>{view.product.name}</b> (в зелёной рамке) в передний ряд — ближе к вам — и кликните по нему.</p>
        </div>

        <div className="depth-moves">
          <div><span>Ходов</span><b>{view.moves}</b></div>
          <div><span>Идеально</span><b>до {view.perfectUpTo}</b></div>
          <div><span>С ошибками</span><b>до {view.errorsUpTo}</b></div>
        </div>
      </div>

      {result ? (
        <div className="depth-result" style={{ '--oc': result.color } as CSSProperties}>
          <div className="depth-result-name">{result.name}</div>
          <div className="depth-result-sub">
            {view.note === 'timeout' ? 'Не успели за время' : view.note === 'tooMany' ? `Больше ${view.errorsUpTo} ходов` : `${view.moves} ${plural(view.moves, 'ход', 'хода', 'ходов')}`}
          </div>
          <button className="btn primary" onClick={onClose}><Vx>К складу · Enter</Vx></button>
        </div>
      ) : note ? (
        <div key={view.noteAt} className={`tsd-msg ${note.cls}`}>{note.text}</div>
      ) : (
        <div className="tsd-msg idle">Мир идёт медленнее, пока вы с ТСД</div>
      )}
    </div>
  );
}
