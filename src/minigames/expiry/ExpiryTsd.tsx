// Экран ТСД в «Сроке» (docs/10-minigames-concept.md, раздел 11.3; прототип одобрен автором 14.10).
// Сверху по центру: «Найдите · товар», «Годен не ранее …», «сегодня …», полоса времени.
// Поднятая штука — крупно по центру: упаковка, которую крутят перетаскиванием или стрелками ← →; этикетка «Годен до» —
// на одной её стороне (у каждой штуки на своей). «Положить обратно» / «Взять». Итог — по центру с затемнением.
// Только показывает данные из props и передаёт клики наверх (09, раздел 6.3). Угол поворота — состояние экрана, не игры.
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import type { ExpiryView } from '../../store/selectors';
import type { ProductShape } from '../../model/product';
import { OUTCOME_LOOK } from '../../ui/labels';
import Vx from '../../ui/Vx';

/** Размер упаковки на экране по форме товара: ширина, высота, глубина (px). */
const PACK_SIZE: Record<ProductShape, [number, number, number]> = {
  carton: [220, 340, 140], bottle: [170, 360, 170], loaf: [320, 160, 200], bunch: [280, 200, 160],
  cup: [200, 200, 200], tray: [300, 120, 220], wedge: [280, 170, 180], pack: [280, 300, 120],
  bag: [260, 320, 120], jar: [200, 260, 200],
};
const SIDES = ['f', 'r', 'b', 'l'] as const; // 0 — перед, 1 — право, 2 — зад, 3 — лево

type Props = {
  view: ExpiryView;
  onBack: () => void;
  onTake: () => void;
  onClose: () => void;
};

function Face({ side, w, h, d, children, accent }: { side: number; w: number; h: number; d: number; children: ReactNode; accent?: boolean }) {
  const wide = side === 0 || side === 2;
  const width = wide ? w : d;
  const depth = wide ? d : w;
  const style: CSSProperties = {
    width, height: h, left: (w - width) / 2,
    transform: `rotateY(${side * 90}deg) translateZ(${depth / 2}px)`,
  };
  return <div className={`expiry-face${wide ? '' : ' narrow'}${accent ? ' brand-side' : ''}`} style={style}>{children}</div>;
}

/** Крупная упаковка: 4 стороны и крышка; на стороне `labelSide` — этикетка со сроком. */
function Pack({ view, angle }: { view: ExpiryView; angle: number }) {
  const unit = view.open!;
  const look = view.product.look;
  const [w, h, d] = PACK_SIZE[look?.shape ?? 'carton'];
  const vars = { '--pc1': look?.color ?? '#F4F6FA', '--pc2': look?.accent ?? '#4A90D9', width: w, height: h } as CSSProperties;
  const content = (side: number): ReactNode => {
    if (side === unit.side) {
      return <div className="expiry-sticker"><span>ГОДЕН ДО</span><b>{unit.date}</b></div>;
    }
    if (side === 0) return <div className="expiry-brand"><b>{view.product.name.toUpperCase()}</b></div>;
    if (side === 2) return <div className="expiry-facts">Пищевая ценность на 100 г<i /><i /><i /></div>;
    return <div className="expiry-lines"><i /><i /><i /></div>;
  };
  return (
    <div className="expiry-cube" style={{ ...vars, transform: `rotateX(-16deg) rotateY(${angle}deg)` }}>
      {SIDES.map((_, side) => (
        <Face key={side} side={side} w={w} h={h} d={d}>{content(side)}</Face>
      ))}
      <div className="expiry-cap" style={{ width: w, height: d, top: -d / 2 }} />
    </div>
  );
}

export default function ExpiryTsd({ view, onBack, onTake, onClose }: Props) {
  const look = view.product.look;
  const done = view.result !== null;
  const [angle, setAngle] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; a: number } | null>(null);
  const openIndex = view.open?.index ?? null;

  // новая штука — снова лицом к игроку
  useEffect(() => { setAngle(0); }, [openIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (done) { if (e.code === 'Enter' || e.code === 'Escape') onClose(); return; }
      if (openIndex === null) return;
      if (e.code === 'ArrowLeft') setAngle((a) => Math.round(a / 90) * 90 - 90);
      if (e.code === 'ArrowRight') setAngle((a) => Math.round(a / 90) * 90 + 90);
      if (e.code === 'Escape') onBack();
      if (e.code === 'Enter') onTake();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [done, openIndex, onBack, onTake, onClose]);

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
            <div className={`depth-time${view.secondsLeft <= 6 ? ' low' : ''}`}><b style={{ width: `${(view.secondsLeft / view.timeLimit) * 100}%` }} /></div>
          </div>
        </Vx>
      </div>

      {view.open && !done && (
        <div className="expiry-inspect">
          <div
            className="expiry-spin"
            onPointerDown={(e: PointerEvent<HTMLDivElement>) => { drag.current = { x: e.clientX, a: angle }; setDragging(true); e.currentTarget.setPointerCapture(e.pointerId); }}
            onPointerMove={(e: PointerEvent<HTMLDivElement>) => { if (drag.current) setAngle(drag.current.a + (e.clientX - drag.current.x) * 0.6); }}
            onPointerUp={() => { drag.current = null; setDragging(false); setAngle((a) => Math.round(a / 90) * 90); }}
          >
            <div className={dragging ? 'expiry-turning' : ''}><Pack view={view} angle={angle} /></div>
          </div>
          <div className="expiry-controls">
            <button className="btn sq" title="Повернуть влево (←)" onClick={() => setAngle((a) => Math.round(a / 90) * 90 - 90)}><Vx>‹</Vx></button>
            <button className="btn" onClick={onBack}><Vx>Положить обратно</Vx></button>
            <button className="btn primary" onClick={onTake}><Vx>Взять</Vx></button>
            <button className="btn sq" title="Повернуть вправо (→)" onClick={() => setAngle((a) => Math.round(a / 90) * 90 + 90)}><Vx>›</Vx></button>
          </div>
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
