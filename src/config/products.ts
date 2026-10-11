// Каталог товаров. Срок годности — в сменах (04, 5.4: списание по сроку).
// Стартовые значения, утверждены автором для первой версии; меняются здесь.
import type { Product } from '../model/product';

const list: Product[] = [
  // быстро портятся
  { id: 'bread',   name: 'Хлеб',     shelfLifeShifts: 2 },
  { id: 'milk',    name: 'Молоко',   shelfLifeShifts: 3 },
  { id: 'bananas', name: 'Бананы',   shelfLifeShifts: 3 },
  { id: 'yogurt',  name: 'Йогурт',   shelfLifeShifts: 4 },
  // средний срок
  { id: 'eggs',    name: 'Яйца',     shelfLifeShifts: 6 },
  { id: 'cheese',  name: 'Сыр',      shelfLifeShifts: 8 },
  // долго хранятся
  { id: 'juice',   name: 'Сок',      shelfLifeShifts: 15 },
  { id: 'cookies', name: 'Печенье',  shelfLifeShifts: 20 },
  { id: 'chips',   name: 'Чипсы',    shelfLifeShifts: 20 },
  { id: 'pasta',   name: 'Макароны', shelfLifeShifts: 20 },
  { id: 'coffee',  name: 'Кофе',     shelfLifeShifts: 20 },
  { id: 'water',   name: 'Вода',     shelfLifeShifts: 30 },
];

export const PRODUCTS: Record<string, Product> = Object.fromEntries(list.map((p) => [p.id, p]));
