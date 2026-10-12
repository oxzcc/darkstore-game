// Окно результата заказа с развилкой (решение автора 13.10; как раскрытие исхода в Dispatch).
// Сначала маркер бежит по полосе «идеально / с ошибками / провал» — исход по характеристикам сборщика;
// потом по очереди развилки: маркер на полосе «осложнение / без осложнений», текст, что вышло; в конце итог.
// Процентов игрок не видит — только ширину зон (решение автора: риск словом). Окно уходит само или по клику.
import { useEffect, type CSSProperties } from 'react';
import type { CallReveal } from '../model/call';
import { SITUATION_BY_ID } from '../config/calls';
import { useGameStore } from '../store/gameStore';
import { OUTCOME_LOOK, OUTCOMES_ORDER, RISK_LOOK } from './labels';
import { Avatar } from './PickerBits';
import Vx from './Vx';
import Icon from './icons';

const STEP_MS = 1000;  // на каждую полосу (маркер бежит ~0,9 с)
const HOLD_MS = 4000;  // сколько висит итог (решение автора 13.10: 4 с)

function CallRow({ c, delayMs }: { c: CallReveal; delayMs: number }) {
  const option = SITUATION_BY_ID[c.situationId]?.options.find((o) => o.id === c.optionId);
  const effect = c.complication ? 'исход хуже на ступень' : c.capped ? `исход не выше «${OUTCOME_LOOK[c.after].name.toLowerCase()}»` : 'исход не меняется';
  return (
    <div className="result-row" style={{ '--d': `${delayMs}ms` } as CSSProperties}>
      <div className="result-row-head">
        <b>{option?.label ?? c.optionId}</b>
        <span className="call-sub"> · {c.auto ? 'решил сам' : 'ваше решение'} · риск {RISK_LOOK[c.risk].name}</span>
      </div>
      <div className="reveal-bar small">
        <i className="zone bad" style={{ width: `${c.chance * 100}%` }} />
        <i className="zone ok" style={{ width: `${(1 - c.chance) * 100}%` }} />
        <span className="marker" style={{ '--to': `${c.roll * 100}%`, '--d': `${delayMs}ms` } as CSSProperties} />
      </div>
      <div className={`result-text ${c.complication ? 'bad' : 'ok'}`}>
        {c.complication ? option?.badText : option?.okText} — {effect}
      </div>
    </div>
  );
}

export default function ResultWindow() {
  const card = useGameStore((s) => s.ui.results[0]);
  const picker = useGameStore((s) => (card ? s.game.pickers[card.pickerId] : null));
  const dismiss = useGameStore((s) => s.dismissResult);

  const total = card ? STEP_MS * (1 + card.reveal.calls.length) + HOLD_MS : 0;
  useEffect(() => {
    if (!card) return;
    const t = setTimeout(() => dismiss(card.id), total);
    return () => clearTimeout(t);
  }, [card, total, dismiss]);

  if (!card || !picker) return null;
  const { reveal } = card;
  const finalLook = OUTCOME_LOOK[reveal.final];
  const finalDelay = STEP_MS * (1 + reveal.calls.length);

  return (
    <Vx key={card.id} className="result" style={{ '--pc': picker.color } as CSSProperties} onClick={() => dismiss(card.id)}>
      <div className="call-head">
        <Avatar picker={picker} small />
        <div className="grow">
          <div className="call-who">Сборка №{card.taskNumber} · {picker.name}</div>
          <div className="call-sub">Итог заказа</div>
        </div>
      </div>

      <div className="result-row" style={{ '--d': '0ms' } as CSSProperties}>
        <div className="result-row-head"><b>Работа {picker.name}</b><span className="call-sub"> · по характеристикам</span></div>
        <div className="reveal-bar">
          {OUTCOMES_ORDER.map((o) => (
            <i key={o} className="zone" style={{ width: `${reveal.chances[o] * 100}%`, background: OUTCOME_LOOK[o].color }} />
          ))}
          <span className="marker" style={{ '--to': `${reveal.roll * 100}%`, '--d': '0ms' } as CSSProperties} />
        </div>
        <div className="result-text">{OUTCOME_LOOK[reveal.base].name}</div>
      </div>

      {reveal.calls.map((c, i) => <CallRow key={i} c={c} delayMs={STEP_MS * (i + 1)} />)}

      <div className="result-final" style={{ '--oc': finalLook.color, '--d': `${finalDelay}ms` } as CSSProperties}>
        <Icon name={finalLook.icon} />
        <span>{finalLook.name}</span>
      </div>
    </Vx>
  );
}
