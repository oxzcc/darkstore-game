// Барабан исхода (P3, решение автора 18.10): поручённое задание без развилки закрыто — окно по центру, мир на паузе.
// Исход уже брошен правилами (advanceWorld); здесь он только показывается: лента ТСД с символами исходов в пропорции шансов
// останавливается на выпавшем, а под ней маркер бежит по той же полосе шансов, что была на карточке сборщика, — до места броска.
// Была развилка (P4): два сегмента — «Сработало» и «Осложнение» по шансу выбранного варианта, сверху «Вы решили: …»; окна итога нет.
// Клик или Enter — сразу итог / закрыть; иначе закрывается само (ROLL_REEL).
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useGameStore, type RollCard } from '../store/gameStore';
import { money } from '../store/selectors';
import { ROLL_REEL } from '../config/balance';
import { OUTCOME_LOOK, OUTCOMES_ORDER, taskTitle } from './labels';
import Vx from './Vx';
import Icon, { type IconName } from './icons';

const SYM_H = 44; // высота одного символа на ленте, px (= .rr-sym в theme.css)

/** Сегмент полосы и символ ленты: исход по характеристикам или «сработало / осложнение» в развилке. */
type Seg = { key: string; share: number; color: string; icon: IconName; label: string };

/** Что крутит барабан: сегменты, на каком остановиться, где маркер (0…1 слева направо). */
function reelOf(card: RollCard): { segs: Seg[]; hit: string; marker: number } {
  if (card.fork) {
    // правила: бросок < шанса — осложнение. На полосе «сработало» слева, поэтому маркер — зеркально: 1 − бросок.
    const f = card.fork;
    return {
      segs: [
        { key: 'ok', share: 1 - f.chance, color: OUTCOME_LOOK.perfect.color, icon: 'check', label: 'Сработало' },
        { key: 'bad', share: f.chance, color: OUTCOME_LOOK.failed.color, icon: 'fail', label: 'Осложнение' },
      ],
      hit: f.complication ? 'bad' : 'ok',
      marker: 1 - f.roll,
    };
  }
  return {
    segs: OUTCOMES_ORDER.map((o) => ({ key: o, share: card.chances[o], color: OUTCOME_LOOK[o].color, icon: OUTCOME_LOOK[o].icon, label: OUTCOME_LOOK[o].name })),
    hit: card.outcome,
    marker: card.value,
  };
}

/** Лента: символы в пропорции долей, перемешаны; три круга, остановка — на выпавшем в третьем. */
function buildStrip(card: RollCard, segs: Seg[], hit: string): { strip: Seg[]; stop: number } {
  const n = ROLL_REEL.symbols;
  const pool: Seg[] = [];
  for (const sg of segs) {
    const count = Math.max(sg.share > 0 ? 1 : 0, Math.round(sg.share * n));
    for (let k = 0; k < count; k++) pool.push(sg);
  }
  // перемешать по id карточки — один и тот же порядок при перерисовке
  let seed = card.id * 9301 + 49297;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const strip = [...pool, ...pool, ...pool];
  const third = pool.length * 2;
  const at = strip.slice(third).findIndex((sg) => sg.key === hit);
  return { strip, stop: third + Math.max(0, at) };
}

export default function RollWindow() {
  const card = useGameStore((s) => s.ui.rolls[0]);
  const tsdPlaying = useGameStore((s) => s.game.tsdGame !== null);
  const picker = useGameStore((s) => (card ? s.game.pickers[card.pickerId] : undefined));
  const dismiss = useGameStore((s) => s.dismissRoll);
  if (!card || tsdPlaying) return null;
  return <Reel key={card.id} card={card} pickerName={picker?.name ?? ''} pickerColor={picker?.color ?? 'var(--primary)'} onClose={() => dismiss(card.id)} />;
}

function Reel({ card, pickerName, pickerColor, onClose }: { card: RollCard; pickerName: string; pickerColor: string; onClose: () => void }) {
  const { segs, hit, marker } = useMemo(() => reelOf(card), [card]);
  const { strip, stop } = useMemo(() => buildStrip(card, segs, hit), [card, segs, hit]);
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const spinMs = reduce ? 0 : ROLL_REEL.spinMs;
  const [phase, setPhase] = useState<'ready' | 'spin' | 'done'>('ready');

  // кадр на месте → запуск ленты; после spinMs — итог; после holdMs — закрыть
  useEffect(() => {
    const raf = requestAnimationFrame(() => setPhase('spin'));
    const t1 = setTimeout(() => setPhase('done'), spinMs + 30);
    return () => { cancelAnimationFrame(raf); clearTimeout(t1); };
  }, [spinMs]);
  useEffect(() => {
    if (phase !== 'done') return;
    const t = setTimeout(onClose, ROLL_REEL.holdMs);
    return () => clearTimeout(t);
  }, [phase, onClose]);

  const skip = () => (phase === 'done' ? onClose() : setPhase('done'));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape') { e.preventDefault(); skip(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const moving = phase !== 'ready';
  const instant = phase === 'done';
  const ease = `transform ${spinMs}ms cubic-bezier(.12,.75,.18,1)`;
  const stripStyle: CSSProperties = {
    transform: `translateY(${moving ? -(stop * SYM_H - SYM_H) : 0}px)`,
    transition: moving && !instant ? ease : instant ? 'none' : undefined,
  };
  const markerStyle: CSSProperties = {
    left: `${(moving ? marker : 0) * 100}%`,
    transition: moving && !instant ? `left ${spinMs}ms cubic-bezier(.12,.75,.18,1)` : 'none',
  };
  const look = OUTCOME_LOOK[card.outcome];
  const g = card.gain;

  return (
    <div className="ac-veil rr-veil" onClick={skip}>
      <Vx className="rr" style={{ '--pc': pickerColor, '--oc': look.color } as CSSProperties}>
        <div className="rr-head">
          <span className="rr-who">{taskTitle({ type: card.taskType, number: card.taskNumber })}</span>
          <span className="rr-name">{pickerName}</span>
        </div>

        {/* корпус ТСД с окошком ленты */}
        <div className="rr-tsd">
          <div className="rr-screen">
            <div className={`rr-window${instant ? ' hit' : ''}`} />
            <div className="rr-strip" style={stripStyle}>
              {strip.map((sg, i) => (
                <div key={i} className="rr-sym"><span style={{ background: sg.color }}><Icon name={sg.icon} /></span></div>
              ))}
            </div>
          </div>
        </div>

        {/* та же полоса шансов, что на карточке сборщика; маркер — куда выпал бросок */}
        <div className="rr-barwrap">
          <span className="ac-bar rr-bar">
            {segs.map((sg) => (
              <b key={sg.key} style={{ width: `${sg.share * 100}%`, background: sg.color }}>
                {sg.share >= 0.14 ? `${Math.round(sg.share * 100)}%` : ''}
              </b>
            ))}
          </span>
          {/* маркер — стрелки над и под полосой, чтобы не закрывать проценты (правка автора 18.10) */}
          <i className="rr-marker" style={markerStyle} />
        </div>

        {card.fork && (
          <div className="rr-choice">
            {card.fork.auto ? <>{pickerName} решил сам: </> : <>Вы решили: </>}<b>{card.fork.optionLabel}</b>
            {card.fork.auto && <span className="rr-note">риск выше, чем в окне</span>}
          </div>
        )}

        {/* итог — только когда лента остановилась (правка автора 18.10: раньше бледный итог был виден заранее); место под него занято всегда */}
        <div className="rr-verdict">
          {instant ? <>
            {card.fork && <span className="rr-step">{card.fork.complication ? 'Осложнение' : 'Сработало'}</span>}
            <span className="rr-result"><Icon name={look.icon} /><b>{look.name}</b></span>
            {(g.money !== 0 || g.rating !== 0) && (
              <span className="rr-gain">{g.money >= 0 ? '+' : '−'}{money(Math.abs(g.money))}</span>
            )}
          </> : <span className="rr-wait">…</span>}
        </div>
        {card.fork?.cap && instant && card.fork.capped && (
          <div className="rr-note center">У этого варианта исход не выше «{OUTCOME_LOOK[card.fork.cap].name}»</div>
        )}
      </Vx>
    </div>
  );
}
