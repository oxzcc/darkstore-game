// Барабан исхода (P3, решение автора 18.10): поручённое задание без развилки закрыто — окно по центру, мир на паузе.
// Исход уже брошен правилами (advanceWorld); здесь он только показывается: лента ТСД с символами исходов в пропорции шансов
// останавливается на выпавшем, а под ней маркер встаёт на той же полосе шансов, что была на карточке сборщика, — в точке броска.
// Задания с развилкой показывает окно итога (ResultWindow) — там тот же барабан в центре.
// Клик или Enter — сразу итог / закрыть; иначе закрывается само (ROLL_REEL).
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useGameStore, type RollCard } from '../store/gameStore';
import { money } from '../store/selectors';
import { ROLL_REEL } from '../config/balance';
import { OUTCOME_LOOK, OUTCOMES_ORDER, taskTitle } from './labels';
import ReelTsd, { type ReelSeg } from './ReelTsd';
import Vx from './Vx';
import Icon from './icons';

export default function RollWindow() {
  const card = useGameStore((s) => s.ui.rolls[0]);
  const tsdPlaying = useGameStore((s) => s.game.tsdGame !== null);
  const picker = useGameStore((s) => (card ? s.game.pickers[card.pickerId] : undefined));
  const dismiss = useGameStore((s) => s.dismissRoll);
  if (!card || tsdPlaying) return null;
  return <Roll key={card.id} card={card} pickerName={picker?.name ?? ''} pickerColor={picker?.color ?? 'var(--primary)'} onClose={() => dismiss(card.id)} />;
}

function Roll({ card, pickerName, pickerColor, onClose }: { card: RollCard; pickerName: string; pickerColor: string; onClose: () => void }) {
  const segs = useMemo<ReelSeg[]>(
    () => OUTCOMES_ORDER.map((o) => ({ key: o, share: card.chances[o], color: OUTCOME_LOOK[o].color, icon: OUTCOME_LOOK[o].icon })),
    [card],
  );
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(onClose, ROLL_REEL.holdMs);
    return () => clearTimeout(t);
  }, [done, onClose]);

  const skip = () => (done ? onClose() : setDone(true));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape') { e.preventDefault(); skip(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const look = OUTCOME_LOOK[card.outcome];
  const g = card.gain;
  return (
    <div className="ac-veil rr-veil" onClick={skip}>
      <Vx className="rr" style={{ '--pc': pickerColor } as CSSProperties}>
        <div className="rr-head">
          <span className="rr-who">{taskTitle({ type: card.taskType, number: card.taskNumber })}</span>
          <span className="rr-name">{pickerName}</span>
        </div>
        <ReelTsd segs={segs} hit={card.outcome} marker={card.value} seed={card.id} done={done} onDone={() => setDone(true)} />
        {/* итог — только когда лента остановилась; место под него занято всегда */}
        <div className="rr-verdict">
          {done ? <>
            <span className="rr-result"><Icon name={look.icon} /><b>{look.name}</b></span>
            {(g.money !== 0 || g.rating !== 0) && <span className="rr-gain">{g.money >= 0 ? '+' : '−'}{money(Math.abs(g.money))}</span>}
          </> : <span className="rr-wait">…</span>}
        </div>
      </Vx>
    </div>
  );
}
