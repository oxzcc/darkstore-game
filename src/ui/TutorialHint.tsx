// Подсказка обучающей смены по центру (M8d; решение автора 15.10): заголовок, пара строк и «Понятно» (Enter).
// Пока открыта — мир на паузе (store.tick). Показывается один раз на каждую тему.
// Подсветка (правка автора 18.10): то, о чём подсказка (пин задания, «!», карточка ТСД), остаётся светлым,
// остальной экран затемнён. Что подсвечивать — поле focus в config/tutorial.ts; элементы помечены data-tut.
// Если подсказка закрывает подсвеченное — окно уезжает вверх или вниз.
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useGameStore } from '../store/gameStore';
import { hintView } from '../store/selectors';
import Vx from './Vx';

type Hole = { x: number; y: number; w: number; h: number };

const PAD = 10;        // запас вокруг подсвеченного, px
const EDGE = 16;       // отступ окна от края экрана, px
const TOP_SAFE = 110;  // под верхней панелью (время, деньги, рейтинг)

/** Прямоугольники подсвеченных элементов на экране; следит за ними каждый кадр (пины двигаются с камерой). */
function useHoles(focus: string | undefined): Hole[] {
  const [holes, setHoles] = useState<Hole[]>([]);
  useEffect(() => {
    if (!focus) { setHoles([]); return; }
    let raf = 0;
    let last = '';
    const loop = () => {
      const list: Hole[] = [];
      document.querySelectorAll<HTMLElement>(`[data-tut="${focus}"]`).forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        if (r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight) return;
        list.push({ x: Math.round(r.left - PAD), y: Math.round(r.top - PAD), w: Math.round(r.width + PAD * 2), h: Math.round(r.height + PAD * 2) });
      });
      const key = JSON.stringify(list);
      if (key !== last) { last = key; setHoles(list); }
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [focus]);
  return holes;
}

const overlaps = (a: Hole, top: number, h: number, left: number, w: number) =>
  a.x < left + w && a.x + a.w > left && a.y < top + h && a.y + a.h > top;

export default function TutorialHint() {
  const game = useGameStore((s) => s.game);
  const ui = useGameStore((s) => s.ui);
  const dismiss = useGameStore((s) => s.dismissHint);
  const hint = hintView(game, ui);
  const holes = useHoles(hint?.focus);
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardSize, setCardSize] = useState({ w: 460, h: 260 });

  useEffect(() => {
    if (!hint) return;
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); dismiss(hint.id); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [hint, dismiss]);

  // размер окна подсказки — чтобы понять, закрывает ли оно подсвеченное
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (Math.round(r.width) !== cardSize.w || Math.round(r.height) !== cardSize.h) setCardSize({ w: Math.round(r.width), h: Math.round(r.height) });
  });

  if (!hint) return null;

  // Где поставить окно: по центру, если ничего не закрывает; иначе — на ту половину экрана, где подсвеченного нет.
  const vw = innerWidth, vh = innerHeight;
  const left = (vw - cardSize.w) / 2;
  const centerTop = (vh - cardSize.h) / 2;
  let top = centerTop;
  if (holes.some((h) => overlaps(h, centerTop, cardSize.h, left, cardSize.w))) {
    const upTop = TOP_SAFE;
    const downTop = vh - cardSize.h - EDGE - 130; // над карточками сборщиков
    const freeUp = !holes.some((h) => overlaps(h, upTop, cardSize.h, left, cardSize.w));
    const freeDown = !holes.some((h) => overlaps(h, downTop, cardSize.h, left, cardSize.w));
    const holesMid = holes.reduce((s, h) => s + h.y + h.h / 2, 0) / holes.length;
    top = freeUp && (!freeDown || holesMid > vh / 2) ? upTop : freeDown ? downTop : upTop;
  }
  const placeStyle: CSSProperties = { top: Math.max(EDGE, top), transform: 'translateX(-50%)' };

  return (
    <div className="hint-back">
      <svg className="hint-dim" width="100%" height="100%" aria-hidden>
        <defs>
          <mask id="hint-mask">
            <rect width="100%" height="100%" fill="#fff" />
            {holes.map((h, i) => <rect key={i} x={h.x} y={h.y} width={h.w} height={h.h} rx="14" fill="#000" />)}
          </mask>
        </defs>
        <rect width="100%" height="100%" className="hint-shade" mask="url(#hint-mask)" />
        {holes.map((h, i) => <rect key={i} x={h.x} y={h.y} width={h.w} height={h.h} rx="14" className="hint-ring" />)}
      </svg>
      <div className="call-center hint-place" style={placeStyle}>
        <div ref={cardRef}>
          <Vx key={hint.id} className="hint" bodyClass="window">
            <div className="panel-title">{hint.title}</div>
            <div className="hint-body">{hint.text}</div>
            <div className="buttons">
              <button className="btn primary" onClick={() => dismiss(hint.id)}><Vx>Понятно</Vx></button>
            </div>
          </Vx>
        </div>
      </div>
    </div>
  );
}
