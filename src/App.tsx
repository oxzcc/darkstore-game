// Собирает экран игры: 3D-сцена и интерфейс поверх неё.
import { useMemo } from 'react';
import Scene from './scene/Scene';
import { seenStock } from './rules/minigames/picking';
import GameLoop from './app/GameLoop';
import { useGameStore, WAREHOUSE_MAP } from './store/gameStore';
import TaskPanel from './ui/TaskPanel';
import PickerPanel from './ui/PickerPanel';
import AssignDialog from './ui/AssignDialog';
import Toasts from './ui/Toasts';
import TsdOffer from './ui/TsdOffer';
import TsdHint from './ui/TsdHint';
import TsdPanel from './ui/TsdPanel';
import CallWindow from './ui/CallWindow';
import ResultWindow from './ui/ResultWindow';
import SpeedControls from './ui/SpeedControls';
import './ui/theme.css';

export default function App() {
  const stock = useGameStore((s) => s.game.stock);
  // во время «Сборки» взятое в тележку уже не лежит на полке (склад поменяется только в M6)
  const actions = useGameStore((s) => s.game.minigame?.actions);
  const seen = useMemo(() => seenStock(stock, actions), [stock, actions]);
  // У стеллажа вид во весь экран (06, раздел 2.3): список заданий и карточки сборщиков прячутся.
  const closeup = useGameStore((s) => (s.game.minigame?.atFocus ?? false) || s.game.tsdGame !== null);
  return (
    <>
      <GameLoop />
      <Scene map={WAREHOUSE_MAP} stock={seen} />
      <div className="hud">
        {!closeup && <TaskPanel />}
        {!closeup && <PickerPanel />}
        <AssignDialog />
        <TsdOffer />
        <TsdHint />
        <TsdPanel />
        <CallWindow />
        <ResultWindow />
        <SpeedControls />
        <Toasts />
      </div>
    </>
  );
}
