// Иконка интерфейса. Сами картинки — config/icons.ts (их же рисуют пины заданий на сцене).
import type { CSSProperties } from 'react';
import { ICON_PATHS, type IconName } from '../config/icons';

export type { IconName };

export default function Icon({ name, small, style }: { name: IconName; small?: boolean; style?: CSSProperties }) {
  return (
    <svg className={`i${small ? ' sm' : ''}`} viewBox="0 0 24 24" style={style}
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }} />
  );
}
