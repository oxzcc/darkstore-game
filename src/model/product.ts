// Товар из каталога (docs/09-architecture.md, раздел 4.2).

/** Форма воксельной заглушки товара на полке (M5d). Сама модель из кубов — scene/models/ProductItem.tsx. */
export type ProductShape =
  | 'carton'  // пакет молока, сока
  | 'bottle'  // бутылка
  | 'loaf'    // буханка
  | 'bunch'   // связка бананов
  | 'cup'     // стаканчик йогурта
  | 'tray'    // лоток яиц
  | 'wedge'   // кусок сыра
  | 'pack'    // пачка печенья, макарон
  | 'bag'     // пакет чипсов
  | 'jar';    // банка кофе

/** Как товар выглядит на полке: форма и два цвета (основной и деталь — крышка, этикетка). */
export type ProductLook = { shape: ProductShape; color: string; accent: string };

export type Product = {
  id: string;
  name: string;
  shelfLifeShifts: number; // срок годности в сменах
  look: ProductLook;       // заглушка из кубов, пока нет воксельных иконок (08, раздел 9)
  icon?: string;           // путь к картинке в public/assets (пока нет)
};
