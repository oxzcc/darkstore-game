// Экран ТСД: игра из развилки («Глубина», N2 — плашка сверху по центру) или личная «Сборка» (M5e1, панель справа, выключена флагом).
// Подключает экран игры к store. Другие игры («Срок», «Штрихкод») встанут сюда же.
import { useGameStore } from '../store/gameStore';
import { depthView, expiryView, pickingView } from '../store/selectors';
import PickingTsd from '../minigames/picking/PickingTsd';
import DepthTsd from '../minigames/depth/DepthTsd';
import ExpiryTsd from '../minigames/expiry/ExpiryTsd';
import Vx from './Vx';

export default function TsdPanel() {
  const game = useGameStore((s) => s.game);
  const closeTsdGame = useGameStore((s) => s.closeTsdGame);
  const { closeExpiryUnit, takeExpiryUnit } = useGameStore.getState();
  const depth = depthView(game);
  // «Глубина»: без панели справа — плашка сверху по центру и итог по центру (прототип, одобрен автором 14.10)
  if (depth) return <DepthTsd key={game.tsdGame!.callId} view={depth} onClose={closeTsdGame} />;
  const expiry = expiryView(game);
  if (expiry) return <ExpiryTsd key={game.tsdGame!.callId} view={expiry} onBack={closeExpiryUnit} onTake={takeExpiryUnit} onClose={closeTsdGame} />;
  const view = pickingView(game);
  if (!view) return null;
  return (
    <Vx className="tsd-panel">
      {/* key: новое задание — экран заново, с вкладки «Заказ» */}
      <PickingTsd key={game.minigame!.taskId} view={view} />
    </Vx>
  );
}
