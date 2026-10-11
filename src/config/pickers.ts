// Стартовые сборщики (05-pickers.md; имена, породы и цвета — 08-art-style.md, раздел 3.2).
// Характеристики по шкале 1–10; разные профили, чтобы выбор сборщика имел смысл.
// Стартовые значения, утверждены автором для первой версии; меняются здесь.

export type PickerTemplate = {
  id: string;
  name: string;
  breed: string;
  color: string;
  speed: number;
  accuracy: number;
};

export const STAT_SCALE = { min: 1, max: 10 };
export const START_SPECIALIZATION_LEVEL = 1;

export const STARTING_PICKERS: PickerTemplate[] = [
  { id: 'lucky', name: 'Лаки',   breed: 'лабрадор', color: '#2280FF', speed: 5, accuracy: 5 }, // ровный середняк
  { id: 'korzh', name: 'Коржик', breed: 'корги',    color: '#E0409B', speed: 7, accuracy: 3 }, // быстрый, но ошибается чаще
  { id: 'buran', name: 'Буран',  breed: 'хаски',    color: '#9B4DFF', speed: 3, accuracy: 7 }, // медленный, но точный
];

// Четвёртый сборщик на будущее (08, раздел 5), в игру пока не входит:
// { id: 'bulya', name: 'Буля', breed: 'бульдог', color: '#13B8A8', … }
