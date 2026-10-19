// Собирает экран игры: 3D-сцена и интерфейс поверх неё.
import { useMemo, useState } from 'react';
import Scene from './scene/Scene';
import { seenStock } from './rules/minigames/picking';
import GameLoop from './app/GameLoop';
import SoundDirector from './audio/SoundDirector';
import { useGameStore, WAREHOUSE_MAP } from './store/gameStore';
import PickerPanel from './ui/PickerPanel';
import AssignDialog from './ui/AssignDialog';
import PickerProfile from './ui/PickerProfile';
import Toasts from './ui/Toasts';
import TsdOffer from './ui/TsdOffer';
import TsdHint from './ui/TsdHint';
import TsdPanel from './ui/TsdPanel';
import CallWindow from './ui/CallWindow';
import ResultWindow from './ui/ResultWindow';
import RollWindow from './ui/RollWindow';
import SpeedControls from './ui/SpeedControls';
import CameraControls from './ui/CameraControls';
import TopBar from './ui/TopBar';
import ShiftSummary from './ui/ShiftSummary';
import TutorialHint from './ui/TutorialHint';
import FpsMeter, { fpsMeterOn } from './ui/FpsMeter';
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

const showFps = fpsMeterOn();

export default function App() {
  const stock = useGameStore((s) => s.game.stock);
  // во время «Сборки» (M5e1, выключена) взятое в тележку уже не рисуется на полке
  const actions = useGameStore((s) => s.game.minigame?.actions);
  const seen = useMemo(() => seenStock(stock, actions), [stock, actions]);
  // У стеллажа вид во весь экран (06, раздел 2.3): список заданий и карточки сборщиков прячутся.
  const closeup = useGameStore((s) => (s.game.minigame?.atFocus ?? false) || s.game.tsdGame !== null);
  // Слой для пинов заданий (T1): лежит между сценой и интерфейсом, поэтому окна всегда поверх пинов (правка автора 18.10).
  const [pinLayer, setPinLayer] = useState<HTMLDivElement | null>(null);
  return (
    <>
      <GameLoop />
      <SoundDirector />
      <Scene map={WAREHOUSE_MAP} stock={seen} pinLayer={pinLayer} />
      <div className="pin-layer" ref={setPinLayer} />
      {/* панели заданий слева больше нет — задания видны пинами на складе (решение автора 18.10) */}
      <div className="hud">
        {!closeup && <PickerPanel />}
        <AssignDialog renderPortrait={renderPortrait} />
        <PickerProfile renderPortrait={renderPortrait} />
        <TsdOffer />
        <TsdHint />
        <TsdPanel />
        <CallWindow renderPortrait={renderPortrait} />
        <ResultWindow renderArt={renderArt} renderPortrait={renderPortrait} />
        <RollWindow renderPortrait={renderPortrait} />
        {!closeup && <TopBar />}
        <SpeedControls />
        {!closeup && <CameraControls />}
        <Toasts />
        <ShiftSummary />
        <TutorialHint />
      </div>
      {/* «?fps» в адресе — счётчик кадров для замера на телефоне (F0) */}
      {showFps && <FpsMeter />}
    </>
  );
}
