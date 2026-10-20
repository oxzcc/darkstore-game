// Итог задания без развилки (P3; вид — прототип «Окно итога задания», одобрен автором 18.10): три кадра, как у итога развилки.
// 1. «Задание сделано» — сборщик докладывает, что сделал (без подсказки об исходе); 2. «Как вышло» — что повлияло на шансы
// (Нюх, опыт по этому типу, усталость) и ТСД с барабаном из трёх исходов в пропорции шансов; 3. «Итог» — лента исхода, жетоны, «Дальше».
// Исход уже брошен правилами (advanceWorld), барабан только показывает его. Мир на паузе; закрывается только кнопкой «Дальше» / Enter / Esc
// (решение автора 18.10); клик по окну во время барабана — сразу итог.
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import type { Picker } from '../model/picker';
import { useGameStore, type RollCard } from '../store/gameStore';
import { rollView } from '../store/selectors';
import { SPEC_RANKS } from '../config/pickers';
import { ROLL_SHOUT } from '../config/taskReport';
import { EXP_NAME, OUTCOME_LOOK, OUTCOMES_ORDER, STAT_LOOK, nameForm } from './labels';
import type { ReelSeg } from './ReelTsd';
import ChanceBar from './ChanceBar';
import { play } from '../audio/engine';
import { FinalFrame, Join, StoryFrame } from './ResultFrames';

const signedPct = (v: number) => `${v < 0 ? '−' : '+'}${Math.abs(Math.round(v * 100))}%`;

type Props = { renderPortrait?: (picker: Picker) => ReactNode };

export default function RollWindow({ renderPortrait }: Props) {
  const card = useGameStore((s) => s.ui.rolls[0]);
  const tsdPlaying = useGameStore((s) => s.game.tsdGame !== null);
  if (!card || tsdPlaying) return null;
  return <Roll key={card.id} card={card} renderPortrait={renderPortrait} />;
}

function Roll({ card, renderPortrait }: Props & { card: RollCard }) {
  const game = useGameStore((s) => s.game);
  const dismiss = useGameStore((s) => s.dismissRoll);
  // данные — на момент открытия окна: пока оно открыто, мир на паузе
  const v = useMemo(() => rollView(game, card), [card]);
  const segs = useMemo<ReelSeg[]>(
    () => OUTCOMES_ORDER.map((o) => ({ key: o, share: card.chances[o], color: OUTCOME_LOOK[o].color, icon: OUTCOME_LOOK[o].icon })),
    [card],
  );
  const [done, setDone] = useState(false);
  // барабан встал — «Чисто! / Почти! / Мимо!» голосом (M9e)
  useEffect(() => { if (done) play(card.outcome, { delay: 0.12 }); }, [done]);

  const next = () => (done ? dismiss(card.id) : setDone(true));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Enter' || e.code === 'Escape') { e.preventDefault(); next(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!v) return null;
  const p = v.picker;
  const look = OUTCOME_LOOK[card.outcome];
  const shoutClass = card.outcome === 'perfect' ? 'ok' : card.outcome === 'withErrors' ? 'mid' : 'bad';

  return (
    <div className="ac-veil">
      <div className="rw" style={{ '--pc': p.color, '--oc': look.color } as CSSProperties} onClick={() => !done && setDone(true)}>
        <StoryFrame tab="Задание сделано" taskType={v.taskType} taskNumber={v.taskNumber} speech={v.speech} picker={p} portrait={renderPortrait?.(p)} />
        <Join />

        {/* 2. как вышло (упрощение по макету «Итог · В», 20.10): из чего сложились шансы — одной строкой; тонкая полоса трёх исходов с маркером */}
        <section className={`rw-panel rw-p2${done && card.outcome === 'failed' ? ' shake' : ''}`}>
          <span className="rw-tab" style={{ '--tc': 'var(--text)' } as CSSProperties}>Как вышло</span>
          <b className="rw-choice">Шансы {nameForm(p.name)}</b>
          <div className="rw-chance">
            <ChanceBar segs={segs} marker={card.value} done={done} onDone={() => setDone(true)} />
            <div className={`rw-shout${done ? ` go ${shoutClass}` : ' wait'}`}>{done ? ROLL_SHOUT[card.outcome] : '…'}</div>
          </div>
          <span className="rw-sub">
            {STAT_LOOK.accuracy.name} {v.why.accuracy} · {EXP_NAME[v.taskType]}: {SPEC_RANKS[v.why.level] ?? v.why.level}
            {v.why.tired !== null && <> · <span className="rw-sub-warn">Устал {signedPct(v.why.tired)}</span></>}
          </span>
        </section>

        <Join lit={done} />
        <FinalFrame
          done={done}
          outcome={card.outcome}
          title={v.title}
          text={v.text}
          notes={[]}
          gain={{ money: card.gain.money, rating: card.gain.rating, xp: v.xp }}
          seed={card.id}
          onClose={() => dismiss(card.id)}
        />
      </div>
    </div>
  );
}
