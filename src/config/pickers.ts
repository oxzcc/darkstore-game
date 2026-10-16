// Стартовые сборщики (05-pickers.md; имена, породы и цвета — 08-art-style.md, раздел 3.2).
// Характеристики по шкале 1–10; разные профили, чтобы выбор сборщика имел смысл.
// Стартовые значения, утверждены автором для первой версии; меняются здесь.

/** Как выглядит порода на сцене (W7, по art/reference/character_picker_*.png). Только для модели, правила это не читают. */
export type DogLook = {
  fur: string;        // основной окрас: голова, руки, хвост
  light: string;      // светлые места: морда, грудь, кончики лап
  ear: string;        // цвет ушей (у лабрадора чуть темнее шерсти)
  earInner?: string;  // внутренняя сторона стоячих ушей
  ears: 'floppy' | 'pointy' | 'bigPointy';   // висячие / стоячие / большие стоячие
  tail: 'straight' | 'fluffy' | 'curl';      // прямой / пушистый короткий / бубликом
  mask: boolean;      // светлая «маска» на лице (хаски)
  legs: string;       // штаны или шерсть ног
  feet: string;       // ботинки или светлые лапы
  nose: string;
  tongue: boolean;    // высунутый язык
};

export type PickerTemplate = {
  id: string;
  name: string;
  breed: string;
  color: string;
  look: DogLook;
  speed: number;
  accuracy: number;
};

const LABRADOR: DogLook = {
  fur: '#F2E6CC', light: '#FAF4E6', ear: '#E6D3AC', ears: 'floppy', tail: 'straight', mask: false,
  legs: '#3A3A3E', feet: '#26262A', nose: '#5A3424', tongue: true,
};
const CORGI: DogLook = {
  fur: '#E39A3B', light: '#F6EFE2', ear: '#E39A3B', earInner: '#F2B8B4', ears: 'bigPointy', tail: 'fluffy', mask: false,
  legs: '#E39A3B', feet: '#F6EFE2', nose: '#26262A', tongue: true,
};
const HUSKY: DogLook = {
  fur: '#5E6470', light: '#F2EEE6', ear: '#5E6470', earInner: '#E8D9C2', ears: 'pointy', tail: 'curl', mask: true,
  legs: '#4A4E58', feet: '#F2EEE6', nose: '#26262A', tongue: false,
};

export const STAT_SCALE = { min: 1, max: 10 };
export const START_SPECIALIZATION_LEVEL = 1;

export const STARTING_PICKERS: PickerTemplate[] = [
  { id: 'lucky', name: 'Лаки',   breed: 'лабрадор', color: '#2280FF', look: LABRADOR, speed: 5, accuracy: 5 }, // ровный середняк
  { id: 'korzh', name: 'Коржик', breed: 'корги',    color: '#E0409B', look: CORGI,    speed: 7, accuracy: 3 }, // быстрый, но ошибается чаще
  { id: 'buran', name: 'Буран',  breed: 'хаски',    color: '#9B4DFF', look: HUSKY,    speed: 3, accuracy: 7 }, // медленный, но точный
];

/** Окрас по id сборщика; неизвестный — лабрадор. */
export const lookOf = (id: string): DogLook => STARTING_PICKERS.find((t) => t.id === id)?.look ?? LABRADOR;

// Четвёртый сборщик на будущее (08, раздел 5), в игру пока не входит. Порода добавится одним объектом DogLook:
// { id: 'bulya', name: 'Буля', breed: 'бульдог', color: '#13B8A8', look: BULLDOG, … }
