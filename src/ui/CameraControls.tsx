// Кнопки камеры справа, над карточками сборщиков (W1; 08, раздел 0 и 4): поворот на четверть круга, зум, исходный вид.
// Мышью то же самое: перетаскивание — поворот, колесо — зум, двойной клик — исходный вид (scene/CameraRig).
import { useGameStore } from '../store/gameStore';
import Vx from './Vx';
import { usePhone } from '../app/usePhone';

export default function CameraControls() {
  const { turnCamera, zoomCamera, resetCamera } = useGameStore.getState();
  const phone = usePhone();
  const buttons: { label: string; title: string; onClick: () => void }[] = [
    { label: '⟲', title: 'Повернуть влево', onClick: () => turnCamera(-1) },
    { label: '⟳', title: 'Повернуть вправо', onClick: () => turnCamera(1) },
    { label: '−', title: 'Отдалить', onClick: () => zoomCamera(-1) },
    { label: '+', title: 'Приблизить', onClick: () => zoomCamera(1) },
    { label: '⌂', title: 'Исходный вид', onClick: resetCamera },
  ];
  // телефон (R1): крутить — пальцем, зум — двумя пальцами; остаётся только «исходный вид»
  const shown = phone ? buttons.filter((b) => b.label === '⌂') : buttons;
  return (
    <div className="cam-controls">
      {shown.map((b) => (
        <button key={b.title} className="btn sq cam" title={b.title} aria-label={b.title} onClick={b.onClick}>
          <Vx>{b.label}</Vx>
        </button>
      ))}
    </div>
  );
}
