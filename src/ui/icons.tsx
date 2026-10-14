// Иконки интерфейса из макетов (art/ui-mockups-src/icons.js; 08, раздел 10.2): сетка 24, обводка 2,5.
import type { CSSProperties } from 'react';

const PATHS = {
  pick: '<path d="M3 8h18l-2 12H5z" fill="var(--f,#fff)" stroke="currentColor" stroke-width="2.5" stroke-linejoin="miter"/><path d="M8 8l2-5h4l2 5" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M9 12v5M15 12v5" stroke="currentColor" stroke-width="2.5"/>',
  speedStat: '<path d="M13 1L4 14h7l-2 9 11-14h-7z" fill="#FFC629" stroke="currentColor" stroke-width="2.3" stroke-linejoin="miter"/>',
  acc: '<rect x="2" y="2" width="20" height="20" fill="#fff" stroke="currentColor" stroke-width="2.5"/><rect x="7" y="7" width="10" height="10" fill="#F0373B" stroke="currentColor" stroke-width="2.5"/><rect x="10.5" y="10.5" width="3" height="3" fill="currentColor"/>',
  fatigue: '<rect x="2" y="6" width="17" height="12" fill="#fff" stroke="currentColor" stroke-width="2.5"/><rect x="19" y="9.5" width="3" height="5" fill="currentColor"/><rect x="5" y="9" width="4" height="6" fill="#F0373B"/>',
  perfect: '<path d="M12 1.5l3.2 6.6 7.3 1-5.3 5.1 1.3 7.3L12 18l-6.5 3.5 1.3-7.3L1.5 9.1l7.3-1z" fill="var(--f,#5CB80F)" stroke="currentColor" stroke-width="2.3" stroke-linejoin="miter"/>',
  errors: '<rect x="2" y="2" width="20" height="20" fill="var(--f,#FF9F1A)" stroke="currentColor" stroke-width="2.5"/><rect x="10" y="5" width="4" height="9" fill="currentColor"/><rect x="10" y="16" width="4" height="4" fill="currentColor"/>',
  fail: '<rect x="2" y="2" width="20" height="20" fill="var(--f,#F0373B)" stroke="currentColor" stroke-width="2.5"/><path d="M7 7l10 10M17 7L7 17" stroke="currentColor" stroke-width="3.5"/>',
  coin: '<path d="M7 2h10l5 5v10l-5 5H7l-5-5V7z" fill="#FFC629" stroke="currentColor" stroke-width="2.5"/><path d="M9 7h5a3 3 0 010 6H9V7zM9 13v5M7 15h6" fill="none" stroke="currentColor" stroke-width="2.5"/>',
  pause: '<rect x="5" y="4" width="5" height="16" fill="currentColor"/><rect x="14" y="4" width="5" height="16" fill="currentColor"/>',
  walk: '<path d="M3 10h11V5l8 7-8 7v-5H3z" fill="var(--f,#fff)" stroke="currentColor" stroke-width="2.5" stroke-linejoin="miter"/>',
  check: '<path d="M3 12l6 6L21 6" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="miter"/>',
  work: '<rect x="3" y="3" width="18" height="18" fill="var(--f,#fff)" stroke="currentColor" stroke-width="2.5"/><path d="M7 7v10M10 7v10M13 7v10M17 7v10" stroke="currentColor" stroke-width="2"/>',
  truck: '<rect x="1.5" y="5" width="13" height="12" fill="var(--f,#fff)" stroke="currentColor" stroke-width="2.5"/><path d="M14.5 9h4.5l3.5 4v4h-8z" fill="var(--f,#fff)" stroke="currentColor" stroke-width="2.5" stroke-linejoin="miter"/><rect x="4" y="16.5" width="4.5" height="4.5" fill="currentColor"/><rect x="16" y="16.5" width="4.5" height="4.5" fill="currentColor"/>',
  rack: '<rect x="3" y="2" width="18" height="20" fill="var(--f,#fff)" stroke="currentColor" stroke-width="2.5"/><path d="M3 9h18M3 15.5h18" stroke="currentColor" stroke-width="2.5"/><rect x="6" y="5" width="4" height="4" fill="currentColor"/><rect x="13" y="11.5" width="5" height="4" fill="currentColor"/>',
  scrap: '<path d="M4 7h16l-1.5 15h-13z" fill="var(--f,#fff)" stroke="currentColor" stroke-width="2.5" stroke-linejoin="miter"/><path d="M2 7h20M9 7V3h6v4" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M9 11l6 7M15 11l-6 7" stroke="#F0373B" stroke-width="2.5"/>',
} as const;

export type IconName = keyof typeof PATHS;

export default function Icon({ name, small, style }: { name: IconName; small?: boolean; style?: CSSProperties }) {
  return (
    <svg className={`i${small ? ' sm' : ''}`} viewBox="0 0 24 24" style={style}
      dangerouslySetInnerHTML={{ __html: PATHS[name] }} />
  );
}
