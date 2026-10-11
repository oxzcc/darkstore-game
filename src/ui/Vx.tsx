// Скошенная подложка в стиле 08: мягкая тень → светлый тёплый аутлайн → тело карточки.
import type { CSSProperties, ReactNode } from 'react';

type Props = {
  children?: ReactNode;
  className?: string;   // класс внешнего блока (размер, положение, состояние)
  bodyClass?: string;   // доп. класс тела, например "window" для больших окон
  style?: CSSProperties;
  onClick?: () => void;
};

export default function Vx({ children, className = '', bodyClass = '', style, onClick }: Props) {
  return (
    <div className={`vx ${className}`} style={style} onClick={onClick}>
      <div className="vx-edge">
        <div className={`vx-body ${bodyClass}`}>{children}</div>
      </div>
    </div>
  );
}
