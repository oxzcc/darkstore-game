// Стартовые сборщики (05-pickers.md; имена, породы и цвета — 08-art-style.md, раздел 3.2).
// Характеристики по шкале 1–10; разные профили, чтобы выбор сборщика имел смысл.
// Стартовые значения, утверждены автором для первой версии; меняются здесь.
import type { StatBlock } from '../model/picker';

/** Как выглядит порода на сцене (W7). Размеры и цвета — из концепт-рендера «Даркстор: Moving Out-стиль» (одобрен автором 16.10),
 *  окрасы — по art/reference/character_picker_*.png. Только для модели, правила это не читают. */
export type DogLook = {
  fur: string;        // основной окрас: голова, кисти
  face: string;       // светлая «маска» на морде
  ear: string;        // цвет ушей
  earInner?: string;  // внутренняя сторона стоячих ушей
  ears: 'floppy' | 'tall' | 'bat';   // висячие (лабрадор) / стоячие (корги, хаски) / «летучая мышь» (бульдог)
  tail?: [string, string];           // хвост: основание и кончик; у лабрадора на рендере хвоста нет
  patch?: string;     // пятно у глаза (бульдог)
};

export type PickerTemplate = {
  id: string;
  name: string;
  breed: string;
  color: string;
  look: DogLook;
  /** Пять характеристик на старте (docs/10, раздел 14.3; допущение Claude: сумма 25 у всех). */
  stats: StatBlock;
};

export const STAT_SCALE = { min: 1, max: 10 };
/** С какой усталости (%) на карточке в окне назначения появляется плашка «Устал» (решение автора 18.10: бодрость — только когда устал). */
export const TIRED_BADGE_FROM = 40;

const LABRADOR: DogLook = { fur: '#F2E2C2', face: '#FAF1DE', ear: '#E5CFA4', ears: 'floppy' };
const CORGI: DogLook = {
  fur: '#E98A33', face: '#FFF6E8', ear: '#E98A33', earInner: '#F6B6A8', ears: 'tall', tail: ['#E98A33', '#FFF6E8'],
};
const HUSKY: DogLook = {
  fur: '#4B5058', face: '#F7F4EE', ear: '#4B5058', earInner: '#F7F4EE', ears: 'tall', tail: ['#4B5058', '#F7F4EE'],
};
/** Бульдог Буля — на будущее (08, раздел 5), в игру пока не входит. */
export const BULLDOG: DogLook = {
  fur: '#D9B083', face: '#F3E2C8', ear: '#7A5236', earInner: '#E8A28E', ears: 'bat', patch: '#7A5236',
};

export const STARTING_PICKERS: PickerTemplate[] = [
  // speed — Лапы, accuracy — Нюх, strength — Сила, memory — Память, friendly — Дружелюбие
  { id: 'lucky', name: 'Лаки',   breed: 'лабрадор', color: '#2280FF', look: LABRADOR,
    stats: { speed: 5, accuracy: 5, strength: 5, memory: 5, friendly: 5 } }, // ровный
  { id: 'korzh', name: 'Коржик', breed: 'корги',    color: '#E0409B', look: CORGI,
    stats: { speed: 8, accuracy: 3, strength: 3, memory: 5, friendly: 6 } }, // быстрый и общительный, но невнимательный
  { id: 'buran', name: 'Буран',  breed: 'хаски',    color: '#9B4DFF', look: HUSKY,
    stats: { speed: 3, accuracy: 7, strength: 6, memory: 7, friendly: 2 } }, // медленный, внимательный и сильный, но угрюмый
];

/** Породы курьеров у двери выдачи (W8a, art/reference/character_courier_*.png) — только декорация. */
export const COURIER_LOOKS: DogLook[] = [LABRADOR, CORGI, HUSKY, BULLDOG];

/** Окрас по id сборщика; неизвестный — лабрадор. */
export const lookOf = (id: string): DogLook => STARTING_PICKERS.find((t) => t.id === id)?.look ?? LABRADOR;

// Четвёртый сборщик на будущее (08, раздел 5), в игру пока не входит:
// { id: 'bulya', name: 'Буля', breed: 'бульдог', color: '#13B8A8', look: BULLDOG, … }
