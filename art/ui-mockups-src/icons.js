// Voxel-ish square icon set: drawn on 24 grid, ink fill, no rounding
const ICON = {
  pick: '<path d="M3 8h18l-2 12H5z" fill="var(--f,#fff)" stroke="currentColor" stroke-width="2.5" stroke-linejoin="miter"/><path d="M8 8l2-5h4l2 5" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M9 12v5M15 12v5" stroke="currentColor" stroke-width="2.5"/>',
  putaway: '<path d="M3 3h18v4H3zM3 10h18v4H3zM3 17h18v4H3z" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M12 5.5v13" stroke="none"/><rect x="13" y="11" width="5" height="2" fill="currentColor"/><rect x="6" y="4" width="5" height="2" fill="currentColor"/>',
  receive: '<path d="M2 6h12v11H2zM14 10h5l3 4v3h-8z" fill="var(--f,#fff)" stroke="currentColor" stroke-width="2.5"/><rect x="4" y="16" width="4" height="4" fill="currentColor"/><rect x="16" y="16" width="4" height="4" fill="currentColor"/>',
  writeoff: '<path d="M5 7h14l-1.5 14h-11z" fill="var(--f,#fff)" stroke="currentColor" stroke-width="2.5"/><path d="M3 4h18v3H3z" fill="currentColor"/><path d="M9 11l6 6M15 11l-6 6" stroke="currentColor" stroke-width="2.5"/>',
  clock: '<rect x="3" y="3" width="18" height="18" fill="var(--f,#fff)" stroke="currentColor" stroke-width="2.5"/><path d="M12 6v6h5" fill="none" stroke="currentColor" stroke-width="3"/>',
  coin: '<path d="M7 2h10l5 5v10l-5 5H7l-5-5V7z" fill="#FFC629" stroke="currentColor" stroke-width="2.5"/><path d="M9 7h5a3 3 0 010 6H9V7zM9 13v5M7 15h6" fill="none" stroke="currentColor" stroke-width="2.5"/>',
  star: '<path d="M12 1.5l3.2 6.6 7.3 1-5.3 5.1 1.3 7.3L12 18l-6.5 3.5 1.3-7.3L1.5 9.1l7.3-1z" fill="#FFC629" stroke="currentColor" stroke-width="2.3" stroke-linejoin="miter"/>',
  pause: '<rect x="5" y="4" width="5" height="16" fill="currentColor"/><rect x="14" y="4" width="5" height="16" fill="currentColor"/>',
  play: '<path d="M6 3l14 9-14 9z" fill="currentColor"/>',
  speed: '<path d="M3 6l9 6-9 6zM12 6l9 6-9 6z" fill="currentColor"/>',
  walk: '<path d="M3 10h11V5l8 7-8 7v-5H3z" fill="var(--f,#fff)" stroke="currentColor" stroke-width="2.5" stroke-linejoin="miter"/>',
  wait: '<path d="M5 2h14v3l-5 7 5 7v3H5v-3l5-7-5-7z" fill="var(--f,#fff)" stroke="currentColor" stroke-width="2.5"/><path d="M8 19h8" stroke="currentColor" stroke-width="3"/>',
  work: '<rect x="3" y="3" width="18" height="18" fill="var(--f,#fff)" stroke="currentColor" stroke-width="2.5"/><path d="M7 7v10M10 7v10M13 7v10M17 7v10" stroke="currentColor" stroke-width="2"/>',
  rest: '<path d="M3 9h14v6a5 5 0 01-5 5H8a5 5 0 01-5-5z" fill="var(--f,#fff)" stroke="currentColor" stroke-width="2.5"/><path d="M17 11h2a2 2 0 010 4h-2" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M8 2v4M12 3v3" stroke="currentColor" stroke-width="2.5"/>',
  speedStat: '<path d="M13 1L4 14h7l-2 9 11-14h-7z" fill="#FFC629" stroke="currentColor" stroke-width="2.3" stroke-linejoin="miter"/>',
  acc: '<rect x="2" y="2" width="20" height="20" fill="#fff" stroke="currentColor" stroke-width="2.5"/><rect x="7" y="7" width="10" height="10" fill="#F0373B" stroke="currentColor" stroke-width="2.5"/><rect x="10.5" y="10.5" width="3" height="3" fill="currentColor"/>',
  fatigue: '<rect x="2" y="6" width="17" height="12" fill="#fff" stroke="currentColor" stroke-width="2.5"/><rect x="19" y="9.5" width="3" height="5" fill="currentColor"/><rect x="5" y="9" width="4" height="6" fill="#F0373B"/>',
  perfect: '<path d="M12 1.5l3.2 6.6 7.3 1-5.3 5.1 1.3 7.3L12 18l-6.5 3.5 1.3-7.3L1.5 9.1l7.3-1z" fill="var(--f,#5CB80F)" stroke="currentColor" stroke-width="2.3" stroke-linejoin="miter"/>',
  errors: '<rect x="2" y="2" width="20" height="20" fill="var(--f,#FF9F1A)" stroke="currentColor" stroke-width="2.5"/><rect x="10" y="5" width="4" height="9" fill="currentColor"/><rect x="10" y="16" width="4" height="4" fill="currentColor"/>',
  fail: '<rect x="2" y="2" width="20" height="20" fill="var(--f,#F0373B)" stroke="currentColor" stroke-width="2.5"/><path d="M7 7l10 10M17 7L7 17" stroke="currentColor" stroke-width="3.5"/>',
  late: '<rect x="2" y="2" width="20" height="20" fill="var(--f,#B9BFB2)" stroke="currentColor" stroke-width="2.5"/><path d="M12 5v7h5" fill="none" stroke="currentColor" stroke-width="3"/><path d="M5 19L19 5" stroke="#F0373B" stroke-width="3"/>',
  scan: '<path d="M2 8V2h6M16 2h6v6M22 16v6h-6M8 22H2v-6" fill="none" stroke="currentColor" stroke-width="2.8"/><path d="M6 7v10M9 7v10M12 7v10M15 7v10M18 7v10" stroke="currentColor" stroke-width="1.8"/><path d="M3 12h18" stroke="#F0373B" stroke-width="2"/>',
  user: '<rect x="7" y="2" width="10" height="10" fill="var(--f,#fff)" stroke="currentColor" stroke-width="2.5"/><path d="M3 22v-5h18v5z" fill="var(--f,#fff)" stroke="currentColor" stroke-width="2.5"/>',
  list: '<path d="M3 4h4v4H3zM3 10h4v4H3zM3 16h4v4H3z" fill="currentColor"/><path d="M9 6h12M9 12h12M9 18h12" stroke="currentColor" stroke-width="2.6"/>',
  check: '<path d="M3 12l6 6L21 6" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="miter"/>',
  plus: '<path d="M12 3v18M3 12h18" stroke="currentColor" stroke-width="3.5"/>',
  minus: '<path d="M3 12h18" stroke="currentColor" stroke-width="3.5"/>',
  rot: '<path d="M19 12a7 7 0 11-3-5.7" fill="none" stroke="currentColor" stroke-width="3"/><path d="M14 2h7v7z" fill="currentColor"/>',
  home: '<path d="M2 11L12 2l10 9v11H2z" fill="none" stroke="currentColor" stroke-width="2.8"/><rect x="9" y="14" width="6" height="8" fill="currentColor"/>',
  layers: '<path d="M12 2l10 5-10 5L2 7z" fill="var(--f,#fff)" stroke="currentColor" stroke-width="2.5"/><path d="M2 12l10 5 10-5M2 17l10 5 10-5" fill="none" stroke="currentColor" stroke-width="2.5"/>',
  box: '<path d="M2 6h20v16H2z" fill="#E9C48E" stroke="currentColor" stroke-width="2.5"/><path d="M2 6l3-4h14l3 4" fill="#F5D7A8" stroke="currentColor" stroke-width="2.5"/><rect x="9" y="6" width="6" height="5" fill="#C99A5B"/>',
  alert: '<path d="M12 2l11 20H1z" fill="#FFC629" stroke="currentColor" stroke-width="2.5" stroke-linejoin="miter"/><rect x="10.5" y="8" width="3" height="7" fill="currentColor"/><rect x="10.5" y="17" width="3" height="3" fill="currentColor"/>',
  person: '<rect x="8" y="1" width="8" height="8" fill="var(--f,#fff)" stroke="currentColor" stroke-width="2.5"/><path d="M5 11h14v6h-3v6H8v-6H5z" fill="var(--f,#fff)" stroke="currentColor" stroke-width="2.5"/>',
  hand: '<path d="M6 11V4h3v6h1V2h3v8h1V3h3v8h1V6h3v9l-3 7H9l-5-7 2-2z" fill="var(--f,#fff)" stroke="currentColor" stroke-width="2.2" stroke-linejoin="miter"/>',
  arrowR: '<path d="M2 9h12V3l9 9-9 9v-6H2z" fill="currentColor"/>',
  settings: '<path d="M9 1h6v4l3 2 3-2 3 5-3 2v4l3 2-3 5-3-2-3 2v4H9v-4l-3-2-3 2-3-5 3-2v-4L0 8l3-5 3 2 3-2z" transform="scale(.92) translate(1 1)" fill="var(--f,#fff)" stroke="currentColor" stroke-width="2.4"/><rect x="9" y="9" width="6" height="6" fill="currentColor"/>',
};
function ic(name, size = 26, color = 'var(--text)', fill) {
  if (color === 'var(--ink)') color = 'var(--text)';
  return `<svg class="i" viewBox="0 0 24 24" style="width:${size}px;height:${size}px;color:${color};${fill ? `--f:${fill}` : ''}">${ICON[name]}</svg>`;
}
function seg(n, on, c) { let s = `<div class="seg" style="--c:${c || 'var(--g)'}">`; for (let i = 0; i < n; i++) s += `<i class="${i < on ? 'on' : ''}"></i>`; return s + '</div>'; }

// tiny voxel product renders (iso SVG)
function shade(hex, k) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; r = Math.round(r * k); g = Math.round(g * k); b = Math.round(b * k); return `rgb(${r},${g},${b})`; }
function vox(cubes, size = 44) {
  // cubes: [x,y,z,color]; iso unit
  const u = 1; const P = (x, y, z) => [(x - y) * 0.866, (x + y) * 0.5 - z];
  cubes = cubes.slice().sort((a, b) => (a[0] + a[1] + a[2] * 0.01) - (b[0] + b[1] + b[2] * 0.01) || a[2] - b[2]);
  let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9, out = '';
  const poly = (pts, f) => { pts.forEach(p => { minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); miny = Math.min(miny, p[1]); maxy = Math.max(maxy, p[1]); }); out += `<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="${f}" stroke="#1B2116" stroke-width=".09" stroke-linejoin="round"/>`; };
  for (const [x, y, z, c] of cubes) {
    poly([P(x, y, z + 1), P(x + 1, y, z + 1), P(x + 1, y + 1, z + 1), P(x, y + 1, z + 1)], c);
    poly([P(x, y + 1, z), P(x + 1, y + 1, z), P(x + 1, y + 1, z + 1), P(x, y + 1, z + 1)], shade(c, .82));
    poly([P(x + 1, y, z), P(x + 1, y + 1, z), P(x + 1, y + 1, z + 1), P(x + 1, y, z + 1)], shade(c, .66));
  }
  const pad = .25, w = maxx - minx + pad * 2, h = maxy - miny + pad * 2, m = Math.max(w, h);
  return `<svg viewBox="${minx - pad - (m - w) / 2} ${miny - pad - (m - h) / 2} ${m} ${m}" style="width:${size}px;height:${size}px;display:block">${out}</svg>`;
}
const PROD = {
  milk: () => vox([[0,0,0,'#FFFFFF'],[0,0,1,'#FFFFFF'],[0,0,2,'#4AA3FF'],[0,0,3,'#FFFFFF']]),
  bread: () => vox([[0,0,0,'#D8963F'],[1,0,0,'#D8963F'],[2,0,0,'#D8963F'],[1,0,1,'#E8AE55']]),
  cheese: () => vox([[0,0,0,'#FFCF3A'],[1,0,0,'#FFCF3A'],[0,1,0,'#FFCF3A'],[0,0,1,'#FFDF6E']]),
  banana: () => vox([[0,0,0,'#FFD93B'],[1,0,0,'#FFD93B'],[2,0,1,'#FFD93B'],[-1,0,1,'#FFD93B'],[3,0,2,'#6B8E23']]),
  apple: () => vox([[0,0,0,'#F0373B'],[1,0,0,'#F0373B'],[0,1,0,'#F0373B'],[1,1,0,'#F0373B'],[0,0,1,'#F0373B'],[1,0,1,'#F0373B'],[0,1,1,'#F0373B'],[1,1,1,'#F0373B'],[1,1,2,'#5CB80F']]),
  water: () => vox([[0,0,0,'#7CC8FF'],[0,0,1,'#7CC8FF'],[0,0,2,'#7CC8FF'],[0,0,3,'#1F7BFF']]),
  eggs: () => vox([[0,0,0,'#C9A27A'],[1,0,0,'#C9A27A'],[0,1,0,'#C9A27A'],[1,1,0,'#C9A27A'],[0,0,1,'#FFF6E6'],[1,1,1,'#FFF6E6']]),
  yogurt: () => vox([[0,0,0,'#FFFFFF'],[0,0,1,'#FF7FB0']]),
  box: () => vox([[0,0,0,'#E2B579'],[1,0,0,'#E2B579'],[0,1,0,'#E2B579'],[1,1,0,'#E2B579'],[0,0,1,'#E2B579'],[1,0,1,'#E2B579'],[0,1,1,'#E2B579'],[1,1,1,'#E2B579']]),
};
