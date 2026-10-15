// Панель заданий слева (ui_01). Новое задание — клик открывает «Кого отправить?».
// Задание в работе остаётся в списке с аватаром сборщика, пока не завершится.
import { useMemo } from 'react';
import { useGameStore } from '../store/gameStore';
import { assigneeOf, clockText, money, panelTaskList, takeTimer, taskSummary } from '../store/selectors';
import { TASK_TYPE_LOOK, taskTitle } from './labels';
import { Avatar } from './PickerBits';
import Vx from './Vx';
import Icon from './icons';

export default function TaskPanel() {
  const game = useGameStore((s) => s.game);
  const selectedId = useGameStore((s) => s.ui.assignTaskId);
  const openAssign = useGameStore((s) => s.openAssign);
  const list = useMemo(() => panelTaskList(game.tasks), [game.tasks]);

  return (
    <Vx className="task-panel" bodyClass="window">
      <div className="panel-title">
        Задания
        <span className="count">{list.length}</span>
      </div>
      <div className="task-list">
        {list.length === 0 && <div className="empty">Новых заданий нет</div>}
        {list.map((t) => {
          const who = assigneeOf(game, t);
          const isNew = t.status === 'new';
          const timer = takeTimer(game, t); // сколько осталось взять задание (M8b)
          return (
            <Vx
              key={t.id}
              className={`task-card${t.id === selectedId ? ' selected' : ''}${isNew ? '' : ' busy'}`}
              onClick={isNew ? () => openAssign(t.id) : undefined}
            >
              <Vx className="task-icon"><Icon name={TASK_TYPE_LOOK[t.type].icon} /></Vx>
              <div className="task-main">
                <div className="task-name">{taskTitle(t)}</div>
                <div className={`task-sub${t.overdue ? ' overdue' : ''}`}>
                  {t.overdue && isNew ? 'Просрочено · без награды' : isNew ? taskSummary(game, t) : `В работе · ${who?.name ?? ''}`}
                </div>
              </div>
              {isNew || !who
                ? (
                  <div className="task-right">
                    {!t.overdue && <div className="reward">+{money(t.reward.money)}</div>}
                    {timer && <div className={`task-timer${timer.warn ? ' warn' : ''}`}>{clockText(timer.secondsLeft)}</div>}
                  </div>
                )
                : <Avatar picker={who} small />}
            </Vx>
          );
        })}
      </div>
    </Vx>
  );
}
