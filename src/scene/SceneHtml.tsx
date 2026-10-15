// Подпись или кнопка поверх 3D (Html из drei), которая не пропадает после загрузки сохранения.
// Html кладёт свой элемент в контейнер сцены. В самый первый кадр контейнер ещё «временный»: сцена подключает мышь
// чуть позже и меняет его, Html переносит элемент — и при этом теряет содержимое. Поэтому ждём, пока сцена готова.
// В обычной игре подписи появляются позже первого кадра, а после загрузки (M8e) — сразу, отсюда баг с «!».
import type { ComponentProps } from 'react';
import { Html } from '@react-three/drei';
import { useThree } from '@react-three/fiber';

export default function SceneHtml(props: ComponentProps<typeof Html>) {
  const ready = useThree((s) => !!s.events.connected);
  return ready ? <Html {...props} /> : null;
}
