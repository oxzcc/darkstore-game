// Пауза / ×1 / ×2 справа сверху (ui_01; 08, раздел 10.4: ×2 остаётся).
// Пока открыто окно назначения, горит «пауза» — это автопауза (02, раздел 2).
// Пока игрок с ТСД, горит «×0,2»: остальной мир замедлен (02, раздел 2; 08, раздел 10.4).
import { TSD } from '../config/balance';
import { useGameStore } from '../store/gameStore';
import Vx from './Vx';
import Icon from './icons';

export default function SpeedControls() {
  const clock = useGameStore((s) => s.game.clock);
  const autopause = useGameStore((s) => s.ui.assignTaskId !== null || s.ui.openCallId !== null);
  const { togglePause, setPlayerSpeed } = useGameStore.getState();
  const slowed = useGameStore((s) => s.game.minigame !== null);
  const paused = clock.paused || autopause;
  const slowText = `×${String(TSD.worldSpeedDuringGame).replace('.', ',')}`;

  return (
    <div className="speed">
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
