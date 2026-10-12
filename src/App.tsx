// Собирает экран игры: 3D-сцена и интерфейс поверх неё.
import Scene from './scene/Scene';
import GameLoop from './app/GameLoop';
import { useGameStore, WAREHOUSE_MAP } from './store/gameStore';
import TaskPanel from './ui/TaskPanel';
import PickerPanel from './ui/PickerPanel';
import AssignDialog from './ui/AssignDialog';
import Toasts from './ui/Toasts';
import TsdOffer from './ui/TsdOffer';
import TsdHint from './ui/TsdHint';
import SpeedControls from './ui/SpeedControls';
import './ui/theme.css';

export default function App() {
  const stock = useGameStore((s) => s.game.stock);
  // У стеллажа вид во весь экран (06, раздел 2.3): список заданий и карточки сборщиков прячутся.
  const closeup = useGameStore((s) => s.game.minigame?.atFocus ?? false);
  return (
    <>
      <GameLoop />
      <Scene map={WAREHOUSE_MAP} stock={stock} />
      <div className="hud">
        {!closeup && <TaskPanel />}
        {!closeup && <PickerPanel />}
        <AssignDialog />
        <TsdOffer />
        <TsdHint />
        <SpeedControls />
        <Toasts />
      </div>
    </>
  );
}
