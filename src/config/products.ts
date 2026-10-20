// Каталог товаров. Срок годности — в сменах (04, 5.4: списание по сроку).
// Стартовые значения, утверждены автором для первой версии; меняются здесь.
// look — как товар выглядит на полке (M5d, решение автора 12.10: упрощённые воксельные формы разного цвета).
// heavy — тяжёлый товар: заказу с ним нужна Сила (docs/10, раздел 14.4).
// Цвета не совпадают с цветами исходов и основным зелёным, чтобы товар не путался с подсветкой.
import type { Product } from '../model/product';

const list: Product[] = [
  // быстро портятся
  { id: 'bread',   name: 'Хлеб',     shelfLifeShifts: 2,  look: { shape: 'loaf',   color: '#C98B4A', accent: '#E8B97A' } },
  { id: 'milk',    name: 'Молоко',   shelfLifeShifts: 3,  look: { shape: 'carton', color: '#F4F6FA', accent: '#4A90D9' } },
  { id: 'bananas', name: 'Бананы',   shelfLifeShifts: 3,  look: { shape: 'bunch',  color: '#F7D23E', accent: '#6B5A2A' } },
  { id: 'yogurt',  name: 'Йогурт',   shelfLifeShifts: 4,  look: { shape: 'cup',    color: '#F6C9DA', accent: '#FFFFFF' } },
  // средний срок
  { id: 'eggs',    name: 'Яйца',     shelfLifeShifts: 6,  look: { shape: 'tray',   color: '#B9A58A', accent: '#FBF3E4' } },
  { id: 'cheese',  name: 'Сыр',      shelfLifeShifts: 8,  look: { shape: 'wedge',  color: '#FFC94A', accent: '#E8A92E' } },
  // долго хранятся
  { id: 'juice',   name: 'Сок',      shelfLifeShifts: 15, heavy: true, look: { shape: 'carton', color: '#FF8A3D', accent: '#FFE07A' } },
  { id: 'cookies', name: 'Печенье',  shelfLifeShifts: 20, look: { shape: 'pack',   color: '#8E5BC2', accent: '#F2D29B' } },
  { id: 'chips',   name: 'Чипсы',    shelfLifeShifts: 20, look: { shape: 'bag',    color: '#E5484D', accent: '#FFD43B' } },
  { id: 'pasta',   name: 'Макароны', shelfLifeShifts: 20, look: { shape: 'pack',   color: '#2F6FD0', accent: '#F5DC8C' } },
  { id: 'coffee',  name: 'Кофе',     shelfLifeShifts: 20, look: { shape: 'jar',    color: '#5A3A28', accent: '#C9A27A' } },
  { id: 'water',   name: 'Вода',     shelfLifeShifts: 30, heavy: true, look: { shape: 'bottle', color: '#8FD3F4', accent: '#2C7FB8' } },
];

export const PRODUCTS: Record<string, Product> = Object.fromEntries(list.map((p) => [p.id, p]));
