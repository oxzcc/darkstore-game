// Адрес места на складе: аллея.стеллаж.полка, например 3.2.1 (docs/07-warehouse-map.md, раздел 5).
// Строкой адрес вручную не собирать — только через функции в rules/address.ts.
export type Address = {
  aisle: number; // аллея
  rack: number;  // стеллаж
  shelf: number; // полка, 1 — нижняя
};
