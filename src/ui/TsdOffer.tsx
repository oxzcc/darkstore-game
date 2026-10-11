// Плашка «Взять ТСД?» (ui_09 в переделке; 02, раздел 6; 06, раздел 2.1).
// Появляется только по шансу. Мир не останавливается, у плашки свой таймер; не ответил — сборщик работает сам.
// Горячие клавиши: Q — взять ТСД, E — пусть работает (08, раздел 10.3).
import { useEffect, type CSSProperties } from 'react';
import { TSD } from '../config/balance';
import { useGameStore } from '../store/gameStore';
import { chancesFor, clockText, orderSummary, tsdSecondsLeft } from '../store/selectors';
import { OUTCOME_LOOK, OUTCOMES_ORDER } from './labels';
import { Avatar } from './PickerBits';
import Vx from './Vx';
import Icon from './icons';

export default function TsdOffer() {
  const game = useGameStore((s) => s.game);
  const { acceptTsd, declineTsd } = useGameStore.getState();
  const offer = game.tsdOffer;

  useEffect(() => {
    if (!offer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'KeyQ') acceptTsd();
      if (e.code === 'KeyE') declineTsd();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [offer, acceptTsd, declineTsd]);

  if (!offer) return null;
  const task = game.tasks[offer.taskId];
  const picker = game.pickers[offer.pickerId];
  if (!task || !picker) return null;

  const left = tsdSecondsLeft(game) ?? 0;
  const chances = chancesFor(game, picker.id, task.id);

  return (
    <Vx className="tsd-offer" bodyClass="window" style={{ '--pc': picker.color } as CSSProperties}>
      <div className="panel-title">Взять ТСД?</div>
      <div className="tsd-offer-body">
        <div className="tsd-offer-head">
          <Avatar picker={picker} />
          <div className="grow">
            <div className="picker-name">{picker.name}</div>
            <div className="picker-state">Сборка №{task.number} · {orderSummary(task)}</div>
          </div>
          <div className="tsd-offer-time">{clockText(left)}</div>
        </div>
        <div className="progress wide"><b style={{ width: `${(left / TSD.offerSeconds) * 100}%` }} /></div>
        <div className="note">Возьмёте ТСД — соберёте заказ сами. Иначе {picker.name} сделает всё сам:</div>
        <div className="chance-legend">
          {OUTCOMES_ORDER.map((o) => (
            <span key={o} title={OUTCOME_LOOK[o].name}>
              <Icon name={OUTCOME_LOOK[o].icon} small />
              {Math.round(chances[o] * 100)}%
            </span>
          ))}
        </div>
      </div>
      <div className="buttons">
        <button className="btn" onClick={declineTsd}><Vx>Пусть работает · E</Vx></button>
        <button className="btn primary" onClick={acceptTsd}><Vx>Взять ТСД · Q</Vx></button>
      </div>
    </Vx>
  );
}
