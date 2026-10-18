// Скошенная подложка в стиле 08: мягкая тень → светлый тёплый аутлайн → тело карточки.
import type { CSSProperties, ReactNode } from 'react';

type Props = {
  children?: ReactNode;
  className?: string;   // класс внешнего блока (размер, положение, состояние)
  bodyClass?: string;   // доп. класс тела, например "window" для больших окон
  style?: CSSProperties;
  onClick?: () => void;
  tut?: string;         // метка для подсветки в обучении (data-tut)
};

export default function Vx({ children, className = '', bodyClass = '', style, onClick, tut }: Props) {
  return (
    <div className={`vx ${className}`} style={style} onClick={onClick} data-tut={tut}>
      <div className="vx-edge">
        <div className={`vx-body ${bodyClass}`}>{children}</div>
      </div>
    </div>
  );
}
