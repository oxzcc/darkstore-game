// Карточки сборщиков снизу (ui_01): имя, что делает сейчас, прогресс, усталость.
import type { CSSProperties } from 'react';
import { useGameStore } from '../store/gameStore';
import { activityOf, pickerList } from '../store/selectors';
import { activityLine } from './activityText';
import { Avatar, FatigueBar } from './PickerBits';
import Vx from './Vx';
import Icon from './icons';

export default function PickerPanel() {
  const game = useGameStore((s) => s.game);

  return (
    <div className="picker-bar">
      {pickerList(game.pickers).map((p) => {
        const line = activityLine(activityOf(game, p.id));
        return (
          <Vx key={p.id} className="picker-card" style={{ '--pc': p.color } as CSSProperties}>
            <Avatar picker={p} />
            <div className="grow">
              <div className="picker-name">{p.name}</div>
              <div className="picker-state">
                <Icon name={line.icon} small />
                {line.text}
              </div>
              {line.progress !== null
                ? <div className="progress"><b style={{ width: `${line.progress * 100}%` }} /></div>
                : <FatigueBar value={p.stats.fatigue} />}
            </div>
          </Vx>
        );
      })}
    </div>
  );
}
