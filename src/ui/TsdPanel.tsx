// Панель ТСД справа во время личной мини-игры (06, раздел 2.4): подключает экран «Сборки» к store.
// Видна и в общем виде склада, и у стеллажа. Другие мини-игры (M7) встанут сюда же.
import { useGameStore } from '../store/gameStore';
import { pickingView } from '../store/selectors';
import PickingTsd from '../minigames/picking/PickingTsd';
import Vx from './Vx';

export default function TsdPanel() {
  const game = useGameStore((s) => s.game);
  const view = pickingView(game);
  if (!view) return null;
  return (
    <Vx className="tsd-panel">
      {/* key: новое задание — экран заново, с вкладки «Заказ» */}
      <PickingTsd key={game.minigame!.taskId} view={view} />
    </Vx>
  );
}
