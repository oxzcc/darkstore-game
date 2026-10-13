// Панель ТСД справа: игра на ТСД из развилки («Глубина», N2) или личная «Сборка» (M5e1, выключена флагом).
// Подключает экран игры к store. Другие игры («Срок», «Штрихкод») встанут сюда же.
import { useGameStore } from '../store/gameStore';
import { depthView, pickingView } from '../store/selectors';
import PickingTsd from '../minigames/picking/PickingTsd';
import DepthTsd from '../minigames/depth/DepthTsd';
import Vx from './Vx';

export default function TsdPanel() {
  const game = useGameStore((s) => s.game);
  const closeTsdGame = useGameStore((s) => s.closeTsdGame);
  const depth = depthView(game);
  if (depth) {
    return (
      <Vx className="tsd-panel">
        <DepthTsd key={game.tsdGame!.callId} view={depth} onClose={closeTsdGame} />
      </Vx>
    );
  }
  const view = pickingView(game);
  if (!view) return null;
  return (
    <Vx className="tsd-panel">
      {/* key: новое задание — экран заново, с вкладки «Заказ» */}
      <PickingTsd key={game.minigame!.taskId} view={view} />
    </Vx>
  );
}
