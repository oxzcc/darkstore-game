// Анимации сборщиков-собак (W7b; 08, раздел 9). Только отображение: из того, что сборщик делает по данным игры,
// и игрового времени считается поза — углы частей тела (точки поворота — в models/Dog.ts). На паузе игровое время стоит,
// поэтому собаки замирают вместе с миром. Числа — PICKER_ANIM в config/warehouse.ts.
import type { Picker } from '../model/picker';
import { WAREHOUSE_VIEW } from '../config/warehouse';
import { ARMS_ON_CART } from './models/Dog';

export type DogAction = 'idle' | 'walk' | 'work' | 'call' | 'sit';

/** Поза: повороты частей тела, радианы; drop — насколько опустить фигурку (сидит на полу), м. */
export type DogPose = {
  legL: number; legR: number;                         // вокруг x: вперёд-назад
  armL: [number, number]; armR: [number, number];     // вокруг x (вперёд-назад) и z (в сторону)
  head: [number, number];                             // кивок (x) и поворот (y)
  tail: number;                                       // виляние (y)
  roll: number;                                       // покачивание тела (z)
  drop: number;
};

const A = () => WAREHOUSE_VIEW.pickerAnim;

/** Что делает сборщик — для выбора анимации. */
export function dogAction(p: Picker): DogAction {
  if (p.path.length > 0) return 'walk';
  if (p.state === 'calling') return 'call';
  if (p.state === 'resting') return 'sit';
  const step = p.job?.steps[p.job.stepIndex];
  if (p.state === 'working' && step && (step.kind === 'pick' || step.kind === 'place' || step.kind === 'pack' || step.kind === 'work')) return 'work';
  return 'idle';
}

/** Сдвиг фазы у каждого сборщика, чтобы хвосты не виляли в такт. */
export function phaseOffset(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 1000;
  return (h / 1000) * Math.PI * 2;
}

/**
 * Поза в момент `t` (игровое время, с). `walkPhase` — фаза шага от пути (два шажка на клетку, как подскок),
 * `cart` — катит тележку: руки на ручке.
 */
export function dogPose(action: DogAction, t: number, walkPhase: number, cart: boolean, offset: number): DogPose {
  const a = A();
  const tt = t + offset;
  const pose: DogPose = {
    legL: 0, legR: 0, armL: [0, 0], armR: [0, 0], head: [0, Math.sin(tt * 0.9) * a.idleLook],
    tail: Math.sin(tt * a.tailSlow) * a.tailSwing * 0.6, roll: 0, drop: 0,
  };
  switch (action) {
    case 'walk': {
      const s = Math.sin(walkPhase);
      pose.legL = s * a.legSwing;
      pose.legR = -s * a.legSwing;
      pose.armL = [-s * a.armSwing, 0];
      pose.armR = [s * a.armSwing, 0];
      pose.roll = s * a.walkRoll;
      pose.head = [0, 0];
      pose.tail = Math.sin(tt * a.tailFast) * a.tailSwing;
      break;
    }
    case 'work': {
      // кивает к полке и тянется лапами вперёд
      const k = Math.sin(tt * a.nodSpeed);
      pose.head = [a.nodBase + k * a.nodSwing, 0];
      pose.armL = [-1.0 + k * 0.15, 0];
      pose.armR = [-1.0 - k * 0.15, 0];
      break;
    }
    case 'call': {
      // машет правой лапой над головой, смотрит на зрителя
      pose.armR = [-2.7 + Math.sin(tt * a.waveSpeed) * 0.2, Math.sin(tt * a.waveSpeed) * 0.35];
      pose.head = [-0.1, Math.sin(tt * 1.3) * 0.15];
      pose.tail = Math.sin(tt * a.tailFast) * a.tailSwing;
      break;
    }
    case 'sit': {
      // сидит на полу: ноги вперёд, лапы в стороны, дышит
      pose.legL = pose.legR = -1.45;
      pose.armL = [0, -0.35];
      pose.armR = [0, 0.35];
      pose.head = [0.1 + Math.sin(tt * 0.8) * 0.04, Math.sin(tt * 0.5) * 0.2];
      pose.drop = a.sitDrop;
      break;
    }
    case 'idle':
      break;
  }
  // руки на ручке тележки — всегда, кроме сидения и маха лапой (тележки там нет)
  if (cart && action !== 'sit' && action !== 'call') {
    pose.armL = [ARMS_ON_CART, 0];
    pose.armR = [ARMS_ON_CART, 0];
  }
  return pose;
}
