// Панель заданий слева (ui_01). Клик по заданию открывает окно «Кого отправить?».
import { useMemo } from 'react';
import { useGameStore } from '../store/gameStore';
import { money, openTaskList, orderSummary } from '../store/selectors';
import Vx from './Vx';
import Icon from './icons';

export default function TaskPanel() {
  const tasks = useGameStore((s) => s.game.tasks);
  const selectedId = useGameStore((s) => s.ui.assignTaskId);
  const openAssign = useGameStore((s) => s.openAssign);
  const list = useMemo(() => openTaskList(tasks), [tasks]);

  return (
    <Vx className="task-panel" bodyClass="window">
      <div className="panel-title">
        Задания
        <span className="count">{list.length}</span>
      </div>
      <div className="task-list">
        {list.length === 0 && <div className="empty">Новых заданий нет</div>}
        {list.map((t) => (
          <Vx key={t.id} className={`task-card${t.id === selectedId ? ' selected' : ''}`} onClick={() => openAssign(t.id)}>
            <Vx className="task-icon"><Icon name="pick" /></Vx>
            <div className="task-main">
              <div className="task-name">Сборка №{t.number}</div>
              <div className="task-sub">{orderSummary(t)}</div>
            </div>
            <div className="reward">+{money(t.reward.money)}</div>
          </Vx>
        ))}
      </div>
    </Vx>
  );
}
