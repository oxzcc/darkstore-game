// Барабан исхода (P3, решение автора 18.10): поручённое задание без развилки закрыто — окно по центру, мир на паузе.
// Исход уже брошен правилами (advanceWorld); здесь он только показывается: лента ТСД с символами исходов в пропорции шансов
// останавливается на выпавшем, а под ней маркер бежит по той же полосе шансов, что была на карточке сборщика, — до места броска.
// Клик или Enter — сразу итог / закрыть; иначе закрывается само (ROLL_REEL).
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { Outcome } from '../model/task';
import { useGameStore, type RollCard } from '../store/gameStore';
import { money } from '../store/selectors';
import { ROLL_REEL } from '../config/balance';
import { OUTCOME_LOOK, OUTCOMES_ORDER, taskTitle } from './labels';
import Vx from './Vx';
import Icon from './icons';

const SYM_H = 44; // высота одного символа на ленте, px (= .rr-sym в theme.css)

/** Лента: символы исходов в пропорции шансов, перемешаны; три круга, остановка — на выпавшем исходе в третьем. */
function buildStrip(card: RollCard): { strip: Outcome[]; stop: number } {
  const n = ROLL_REEL.symbols;
  const counts = OUTCOMES_ORDER.map((o) => Math.max(card.chances[o] > 0 ? 1 : 0, Math.round(card.chances[o] * n)));
  const pool: Outcome[] = [];
  OUTCOMES_ORDER.forEach((o, i) => { for (let k = 0; k < counts[i]; k++) pool.push(o); });
  // перемешать по id карточки — один и тот же порядок при перерисовке
  let seed = card.id * 9301 + 49297;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const strip = [...pool, ...pool, ...pool];
  const third = pool.length * 2;
  const at = strip.slice(third).indexOf(card.outcome);
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
  const { strip, stop } = useMemo(() => buildStrip(card), [card]);
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
    left: `${(moving ? card.value : 0) * 100}%`,
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
              {strip.map((o, i) => (
                <div key={i} className="rr-sym"><span style={{ background: OUTCOME_LOOK[o].color }}><Icon name={OUTCOME_LOOK[o].icon} /></span></div>
              ))}
            </div>
          </div>
        </div>

        {/* та же полоса шансов, что на карточке сборщика; маркер — куда выпал бросок */}
        <div className="rr-barwrap">
          <span className="ac-bar rr-bar">
            {OUTCOMES_ORDER.map((o) => (
              <b key={o} style={{ width: `${card.chances[o] * 100}%`, background: OUTCOME_LOOK[o].color }}>
                {card.chances[o] >= 0.14 ? `${Math.round(card.chances[o] * 100)}%` : ''}
              </b>
            ))}
          </span>
          <i className="rr-marker" style={markerStyle} />
        </div>

        <div className={`rr-verdict${instant ? ' on' : ''}`}>
          <Icon name={look.icon} />
          <b>{look.name}</b>
          {instant && (g.money !== 0 || g.rating !== 0) && (
            <span className="rr-gain">{g.money >= 0 ? '+' : '−'}{money(Math.abs(g.money))}</span>
          )}
        </div>
      </Vx>
    </div>
  );
}
