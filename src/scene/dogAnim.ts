// Анимации сборщиков-собак (W7b; 08, раздел 9) — по коду концепт-рендера «Даркстор: Moving Out-стиль».
// Только отображение: из того, что сборщик делает по данным игры, и игрового времени считается поза — углы частей тела
// (точки поворота — в models/Dog.ts) и предметы в лапах. На паузе игровое время стоит, поэтому собаки замирают вместе с миром.
// Числа — WAREHOUSE_VIEW.pickerAnim (config/warehouse.ts).
import type { Picker } from '../model/picker';
import type { TaskType } from '../model/task';
import { WAREHOUSE_VIEW } from '../config/warehouse';
import { ARMS_ON_CART } from './models/Dog';

/**
 * Что делает сборщик: идёт; сканирует у полки (сбор, выкладка, снять партию на списании) — ТСД в лапе;
 * бросает коробки (приёмка); фасует (фасовка, сдать в брак); зовёт диспетчера; сидит на диване (перерыв); стоит.
 */
export type DogAction = 'idle' | 'walk' | 'scan' | 'throw' | 'pack' | 'call' | 'sit';

/** Поза: повороты частей тела (радианы) и всё, что двигается вместе с фигуркой. */
export type DogPose = {
  legL: number; legR: number;                         // вокруг x: вперёд-назад
  armL: [number, number]; armR: [number, number];     // вокруг x (вперёд-назад) и z (в сторону)
  head: [number, number];                             // кивок (x) и поворот (y)
  tail: number;                                       // виляние (y)
  roll: number;                                       // покачивание тела (z)
  lean: number;                                       // наклон всей фигурки вперёд-назад (x): замах и бросок
  bob: number;                                        // подпрыгивание на месте, м
  breath: number;                                     // дыхание: тело чуть шире и ниже (+) или уже и выше (−)
  drop: number;                                       // насколько опустить фигурку, м
  tsd: boolean;                                       // ТСД в правой лапе
  box: { k: number; spin: number } | null;            // коробка в броске: 0 — в лапах над головой, 1 — на паллете; поворот
};

const A = () => WAREHOUSE_VIEW.pickerAnim;

/** Что делает сборщик — для выбора анимации. `taskType` — тип его задания (если есть). */
export function dogAction(p: Picker, taskType: TaskType | undefined): DogAction {
  if (p.path.length > 0) return 'walk';
  if (p.state === 'calling') return 'call';
  if (p.state === 'resting') return 'sit';
  const step = p.job?.steps[p.job.stepIndex];
  if (p.state !== 'working' || !step) return 'idle';
  switch (step.kind) {
    case 'pick':
    case 'place':
      return 'scan';
    case 'pack':
      return 'pack';
    case 'work':
      if (taskType === 'receiving') return 'throw';
      // списание: первый рабочий шаг — «Снимает с полки» (скан у полки), дальше — «Сдаёт в брак»
      return taskType === 'writeoff' && p.job!.steps.findIndex((s) => s.kind === 'work') === p.job!.stepIndex ? 'scan' : 'pack';
    default:
      return 'idle';
  }
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
    tail: Math.sin(tt * a.tailSlow) * a.tailSwing * 0.6, roll: 0, lean: 0,
    bob: Math.abs(Math.sin(tt * a.idleBobSpeed)) * a.idleBob, // переминается, как курьер на рендере
    breath: 0, drop: 0, tsd: false, box: null,
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
      pose.bob = 0; // подскок при ходьбе — от пути (pickerPose)
      break;
    }
    case 'scan': {
      // как Буля на рендере: ТСД в поднятой правой лапе покачивается, голова осматривает полку
      pose.tsd = true;
      pose.armR = [a.scanArm + Math.sin(tt * a.scanSpeed) * a.scanSwing, 0];
      pose.head = [a.scanNod, Math.sin(tt * a.scanLook) * a.scanLookSwing];
      break;
    }
    case 'throw': {
      // как Лаки на рендере: замах обеими лапами над головой с наклоном назад, бросок с наклоном вперёд, коробка летит по дуге на паллету
      const ph = ((tt * a.throwRate) % 1 + 1) % 1;
      if (ph < a.throwWindup) {
        const k = ph / a.throwWindup;
        const arm = -2.6 - k * 0.4;
        pose.armL = [arm, 0];
        pose.armR = [arm, 0];
        pose.lean = -k * 0.15;
        pose.box = { k: 0, spin: 0 };
      } else {
        const k = (ph - a.throwWindup) / (1 - a.throwWindup);
        const arm = -2.6 + Math.min(1, k * 3) * 1.6;
        pose.armL = [arm, 0];
        pose.armR = [arm, 0];
        pose.lean = Math.min(1, k * 3) * 0.12;
        pose.box = { k, spin: k * 5 };
      }
      pose.bob = Math.abs(Math.sin(tt * 3.4)) * 0.03;
      break;
    }
    case 'pack': {
      // фасует: голова к столу, лапы вперёд, кивает
      const k = Math.sin(tt * a.nodSpeed);
      pose.head = [a.nodBase + k * a.nodSwing, 0];
      pose.armL = [-1.0 + k * 0.15, 0];
      pose.armR = [-1.0 - k * 0.15, 0];
      break;
    }
    case 'call': {
      // машет правой лапой над головой
      pose.armR = [-2.7 + Math.sin(tt * a.waveSpeed) * 0.2, Math.sin(tt * a.waveSpeed) * 0.35];
      pose.head = [-0.1, Math.sin(tt * 1.3) * 0.15];
      pose.tail = Math.sin(tt * a.tailFast) * a.tailSwing;
      break;
    }
    case 'sit': {
      // как Коржик на рендере: сидит на диване, ноги вперёд, лапы в стороны, дышит, хвост виляет
      pose.legL = pose.legR = -1.3;
      pose.armL = [0, -0.4];
      pose.armR = [0, 0.4];
      pose.head = [0.05, 0];
      pose.breath = Math.sin(tt * a.breathSpeed) * a.breathAmount;
      pose.tail = Math.sin(tt * 6) * 0.5;
      pose.bob = 0;
      break;
    }
    case 'idle':
      break;
  }
  // руки на ручке тележки, пока идёт, стоит или фасует; у полки правая — с ТСД, левая на ручке
  if (cart && (action === 'walk' || action === 'idle' || action === 'pack')) {
    pose.armL = [ARMS_ON_CART, 0];
    pose.armR = [ARMS_ON_CART, 0];
  } else if (cart && action === 'scan') {
    pose.armL = [ARMS_ON_CART, 0];
  }
  return pose;
}
