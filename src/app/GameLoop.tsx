// Двигатель времени (09, раздел 7.1): каждый кадр браузера передаёт в store, сколько прошло реального времени.
// Ничего не рисует. Логика от сцены не зависит, поэтому не используем useFrame из three.
import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

export default function GameLoop() {
  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const realDt = (now - last) / 1000;
      last = now;
      useGameStore.getState().tick(realDt);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);
  return null;
}
