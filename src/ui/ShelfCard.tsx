// Карточка товара внизу экрана у стеллажа (06, раздел 2.3; M5d): по какому товару кликнул игрок.
// Пока ничего не берётся — это просто «посмотреть». В M5e клик станет сканом, а здесь появится панель ТСД.
import type { CSSProperties } from 'react';
import { useGameStore } from '../store/gameStore';
import { inspectedShelf } from '../store/selectors';
import Vx from './Vx';

export default function ShelfCard() {
  // берём из store только неизменные ссылки (сессия, остатки, каталог), а карточку считаем в отрисовке:
  // если селектор каждый раз возвращает новый объект, zustand перерисовывает компонент бесконечно
  const minigame = useGameStore((s) => s.game.minigame);
  const stock = useGameStore((s) => s.game.stock);
  const products = useGameStore((s) => s.game.products);
  if (!minigame?.atFocus) return null;
  const shelf = inspectedShelf(minigame, stock, products);

  if (!shelf) {
    return (
      <div className="shelf-card">
        <Vx className="shelf-card-hint">Нажмите на товар на полке</Vx>
      </div>
    );
  }

  return (
    <div className="shelf-card">
      {shelf.items.map((it) => (
        <Vx key={it.productId} className="shelf-card-item">
          <span className="swatch" style={{ '--sw': it.product.look.color, '--sw2': it.product.look.accent } as CSSProperties} />
          <div>
            <div className="shelf-card-name">{it.product.name}</div>
            <div className="shelf-card-sub">Полка <span className="tag">{shelf.address}</span> · на полке {it.qty} шт.</div>
            <div className="note">Скан и сбор заказа — на следующем шаге (M5e)</div>
          </div>
        </Vx>
      ))}
    </div>
  );
}
