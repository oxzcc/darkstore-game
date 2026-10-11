// Товар из каталога (docs/09-architecture.md, раздел 4.2).
export type Product = {
  id: string;
  name: string;
  shelfLifeShifts: number; // срок годности в сменах
  icon?: string;           // путь к картинке в public/assets (пока нет)
};
