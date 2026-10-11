// Окно «Кого отправить?» справа (ui_03): задание сверху, сборщики с шансами трёх исходов, кнопки.
// Все числа — из selectors (а те — из rules); окно само ничего не считает.
import type { CSSProperties } from 'react';
import { useGameStore } from '../store/gameStore';
import { addressText, assignCheck, chancesFor, money, orderSummary, pickerList } from '../store/selectors';
import { OUTCOME_LOOK, OUTCOMES_ORDER } from './labels';
import { Avatar, StatBars } from './PickerBits';
import Vx from './Vx';
import Icon from './icons';

export default function AssignDialog() {
  const game = useGameStore((s) => s.game);
  const taskId = useGameStore((s) => s.ui.assignTaskId);
  const chosenId = useGameStore((s) => s.ui.chosenPickerId);
  const { choosePicker, closeAssign, sendChosenPicker } = useGameStore.getState();

  const task = taskId ? game.tasks[taskId] : null;
  if (!task || task.type !== 'order') return null;

  return (
    <Vx className="assign" bodyClass="window">
      <div className="panel-title">Кого отправить?</div>
      <div className="assign-scroll">
        {/* задание */}
        <Vx className="task-card">
          <Vx className="task-icon"><Icon name="pick" /></Vx>
          <div className="task-main">
            <div className="task-name">Сборка №{task.number}</div>
            <div className="task-sub">{orderSummary(task)}</div>
          </div>
          <div className="reward">+{money(task.reward.money)}</div>
        </Vx>
        <div className="order-lines">
          {task.payload.lines.map((l) => (
            <div key={l.productId} className="order-line">
              <span className="tag">{addressText(l.address)}</span>
              <span>{game.products[l.productId]?.name ?? l.productId}</span>
              <span className="qty">×{l.qty}</span>
            </div>
          ))}
        </div>

        {/* сборщики */}
        {pickerList(game.pickers).map((p) => {
          const check = assignCheck(game, task.id, p.id);
          const chances = chancesFor(game, p.id, task.id);
          const chosen = p.id === chosenId;
          return (
            <Vx
              key={p.id}
              className={`choice${chosen ? ' chosen' : ''}${check.ok ? '' : ' disabled'}`}
              style={{ '--pc': p.color } as CSSProperties}
              onClick={() => check.ok && choosePicker(p.id)}
            >
              <div className="choice-head">
                <Avatar picker={p} />
                <div className="grow">
                  <div className="picker-name">{p.name}</div>
                  <div className="picker-state">{check.ok ? p.breed : check.reason}</div>
                </div>
                <StatBars picker={p} />
              </div>
              <div className="chances">
                <div className="chance-bar">
                  {OUTCOMES_ORDER.map((o) => (
                    <b key={o} style={{ width: `${chances[o] * 100}%`, background: OUTCOME_LOOK[o].color }} />
                  ))}
                </div>
                <div className="chance-legend">
                  {OUTCOMES_ORDER.map((o) => (
                    <span key={o} title={OUTCOME_LOOK[o].name}>
                      <Icon name={OUTCOME_LOOK[o].icon} small />
                      {Math.round(chances[o] * 100)}%
                    </span>
                  ))}
                </div>
              </div>
            </Vx>
          );
        })}
        <div className="note">Шансы пока одинаковые для всех — формула появится позже</div>
      </div>

      <div className="buttons">
        <button className="btn" onClick={closeAssign}><Vx>Отмена</Vx></button>
        <button className="btn primary" disabled={!chosenId} onClick={sendChosenPicker}><Vx>Отправить</Vx></button>
      </div>
    </Vx>
  );
}
