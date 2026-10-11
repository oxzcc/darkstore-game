// Собирает экран игры: 3D-сцена и интерфейс поверх неё.
import Scene from './scene/Scene';
import { useGameStore, WAREHOUSE_MAP } from './store/gameStore';
import TaskPanel from './ui/TaskPanel';
import PickerPanel from './ui/PickerPanel';
import AssignDialog from './ui/AssignDialog';
import Toasts from './ui/Toasts';
import './ui/theme.css';

export default function App() {
  const stock = useGameStore((s) => s.game.stock);
  return (
    <>
      <Scene map={WAREHOUSE_MAP} stock={stock} />
      <div className="hud">
        <TaskPanel />
        <PickerPanel />
        <AssignDialog />
        <Toasts />
      </div>
    </>
  );
}
