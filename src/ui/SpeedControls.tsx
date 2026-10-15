// Пауза / ×1 / ×2 справа сверху (ui_01; 08, раздел 10.4: ×2 остаётся).
// Пока открыто окно назначения, горит «пауза» — это автопауза (02, раздел 2).
// Пока игрок с ТСД, мир на паузе: остальной мир замедлен (02, раздел 2; 08, раздел 10.4).
import { useState } from 'react';
import { TSD } from '../config/balance';
import { useGameStore } from '../store/gameStore';
import Vx from './Vx';
import Icon from './icons';

export default function SpeedControls() {
  const clock = useGameStore((s) => s.game.clock);
  // игра на ТСД — мир на паузе (решение автора 14.10)
  const autopause = useGameStore((s) => s.ui.assignTaskId !== null || s.ui.openCallId !== null || s.ui.results.length > 0 || s.game.tsdGame !== null);
  const { togglePause, setPlayerSpeed, restartCampaign } = useGameStore.getState();
  // «Новая игра» — с подтверждением, прогресс пропадёт (M8e, решение автора 15.10)
  const [confirming, setConfirming] = useState(false);
  const slowed = useGameStore((s) => s.game.minigame !== null);
  const paused = clock.paused || autopause;
  const slowText = `×${String(TSD.worldSpeedDuringGame).replace('.', ',')}`;

  return (
    <div className="speed">
      {confirming
        ? (
          <Vx className="restart-confirm">
            <span>Начать новую кампанию? Прогресс пропадёт</span>
            <button className="mini-btn danger" onClick={() => { setConfirming(false); restartCampaign(); }}>Да</button>
            <button className="mini-btn" onClick={() => setConfirming(false)}>Нет</button>
          </Vx>
        )
        : <button className="mini-btn restart" title="Начать новую кампанию" onClick={() => setConfirming(true)}>Новая игра</button>}
      <button className={`btn sq${paused ? ' on' : ''}`} title="Пауза" onClick={togglePause} disabled={autopause}>
        <Vx><Icon name="pause" /></Vx>
      </button>
      {slowed && (
        <button className={`btn sq slow${paused ? '' : ' on'}`} title="Мир замедлен: вы с ТСД" disabled>
          <Vx>{slowText}</Vx>
        </button>
      )}
      {([1, 2] as const).map((v) => (
        <button key={v} className={`btn sq${!paused && !slowed && clock.playerSpeed === v ? ' on' : ''}`} onClick={() => setPlayerSpeed(v)} disabled={autopause}>
          <Vx>×{v}</Vx>
        </button>
      ))}
    </div>
  );
}
