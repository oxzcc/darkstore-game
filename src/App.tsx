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
import CameraControls from './ui/CameraControls';
import TopBar from './ui/TopBar';
import ShiftSummary from './ui/ShiftSummary';
import TutorialHint from './ui/TutorialHint';
import type { Picker } from './model/picker';
import type { ResultArt } from './ui/ResultWindow';
import { lookOf } from './config/pickers';
import { resultVignette, tsdVignette } from './config/vignettes';
import { PickerPortrait, ResultVignette } from './scene/vignette/Vignette';
import './ui/theme.css';

// Сценки-иллюстрации (прототип 16.10) передаются в окна отсюда: интерфейс сам 3D не импортирует (09, раздел 3).
const renderPortrait = (p: Picker) => <PickerPortrait look={lookOf(p.id)} />;
const renderArt = (a: ResultArt) => {
  const recipe = a.tsd ? tsdVignette(a.situationId, a.tsd) : resultVignette(a.situationId, a.optionId, a.worked);
  return recipe ? <ResultVignette recipe={recipe} look={lookOf(a.picker.id)} product={a.product} /> : null;
};

export default function App() {
  const stock = useGameStore((s) => s.game.stock);
  // во время «Сборки» (M5e1, выключена) взятое в тележку уже не рисуется на полке
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
        <CallWindow renderPortrait={renderPortrait} />
        <ResultWindow renderArt={renderArt} />
        {!closeup && <TopBar />}
        <SpeedControls />
        {!closeup && <CameraControls />}
        <Toasts />
        <ShiftSummary />
        <TutorialHint />
      </div>
    </>
  );
}
