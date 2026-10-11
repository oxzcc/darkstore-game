// Cohesive voxel darkstore world built from boxes (meters). X → east (screen down-right), Z → south (screen down-left), Y up.
const B = (x, y, z, w, h, d, c, o) => GL.box(x, y, z, w, h, d, c, o);
const WD = { W: 24, D: 16, H: 3.0, F: 0.15 }; // building size, wall height, floor thickness
const COL = {
  grassA: '#8BD444', grassB: '#80CB3B', road: '#575C66', walk: '#D9D6CE', curb: '#C2BEB4',
  floorA: '#F1EEE6', floorB: '#E9E5DB', slab: '#CFCAC0',
  wall: '#F6F4EF', wallBase: '#A9AEB4', wallCap: '#7E848C', green: '#5DB52A', greenD: '#3F8F1C',
  post: '#4A4F57', board: '#EAD7AF', box: '#E2BF8C', boxD: '#D2A86F', tape: '#C99A5E', crate: '#5DB52A',
  wood: '#E4C28C', woodD: '#C9A26A', metal: '#B9BEC4', dark: '#3D4249', black: '#26292E', white: '#FAFAF7',
  yellow: '#FFC629', red: '#EF3E3E', blue: '#1F7BFF', orange: '#FF8A00', purple: '#9B4DFF', teal: '#11B5A4',
};
function shadeHex(h, k) { const c = GL.hex(h); return c.map(v => Math.min(1, v * k)); }

// ---------- primitives ----------
function wallX(x0, x1, z, h, t = 0.3, opt = {}) { // wall running along X at z (z..z+t)
  const len = x1 - x0;
  B(x0, WD.F, z, len, 0.35, t, COL.wallBase);
  B(x0, WD.F + 0.35, z, len, h - 0.35, t, COL.wall);
  B(x0 - 0.02, WD.F + h, z - 0.02, len + 0.04, 0.12, t + 0.04, COL.wallCap);
  if (opt.pil) for (let x = x0 + 1.5; x < x1 - 0.5; x += 3) B(x, WD.F + 0.35, z + t, 0.45, h - 0.35, 0.05, COL.green);
}
function wallZ(z0, z1, x, h, t = 0.3, opt = {}) {
  const len = z1 - z0;
  B(x, WD.F, z0, t, 0.35, len, COL.wallBase);
  B(x, WD.F + 0.35, z0, t, h - 0.35, len, COL.wall);
  B(x - 0.02, WD.F + h, z0 - 0.02, t + 0.04, 0.12, len + 0.04, COL.wallCap);
  if (opt.pil) for (let z = z0 + 1.5; z < z1 - 0.5; z += 3) B(x + t, WD.F + 0.35, z, 0.05, h - 0.35, 0.45, COL.green);
}
function flatRect(x, z, w, d, c, y = WD.F) { B(x, y, z, w, 0.012, d, c, { noAO: true }); }
function dashX(x0, x1, z, c, y = WD.F + 0.012, dash = 0.5, gap = 0.3, t = 0.08) { for (let x = x0; x < x1; x += dash + gap) B(x, y, z, Math.min(dash, x1 - x), 0.01, t, c, { noAO: true }); }
function dashZ(z0, z1, x, c, y = WD.F + 0.012, dash = 0.5, gap = 0.3, t = 0.08) { for (let z = z0; z < z1; z += dash + gap) B(x, y, z, t, 0.01, Math.min(dash, z1 - z), c, { noAO: true }); }
function zoneDash(x, z, w, d, c) { dashX(x, x + w, z, c); dashX(x, x + w, z + d - 0.08, c); dashZ(z, z + d, x, c); dashZ(z, z + d, x + w - 0.08, c); }

// cardboard box with tape
function cbox(x, y, z, w, h, d, c = COL.box) { B(x, y, z, w, h, d, c); B(x + w * 0.42, y + h, z - 0.001, w * 0.16, 0.006, d + 0.002, COL.tape, { noAO: true }); }
function crate(x, y, z, w = 0.5, h = 0.3, d = 0.45) { B(x, y, z, w, 0.04, d, COL.greenD); B(x, y, z, 0.04, h, d, COL.crate); B(x + w - 0.04, y, z, 0.04, h, d, COL.crate); B(x, y, z, w, h, 0.04, COL.crate); B(x, y, z + d - 0.04, w, h, 0.04, COL.crate); }

// shelving unit: along Z (length L), depth along X, opens to +x
function shelf(x, z, L = 2.2, Dp = 0.75, Hh = 2.2, seed = 1, sel) {
  const y0 = WD.F;
  for (const [px, pz] of [[0, 0], [Dp - 0.1, 0], [0, L - 0.1], [Dp - 0.1, L - 0.1]]) B(x + px, y0, z + pz, 0.1, Hh + 0.08, 0.1, COL.post);
  // x-brace side panels (cheap: thin dark bars)
  for (const pz of [0, L - 0.1]) { B(x + 0.1, y0 + 0.5, z + pz + 0.03, Dp - 0.2, 0.05, 0.04, COL.post); B(x + 0.1, y0 + 1.4, z + pz + 0.03, Dp - 0.2, 0.05, 0.04, COL.post); }
  let r = seed * 9301 + 49297; const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
  const levels = [0.12, 0.82, 1.52, 2.16];
  levels.forEach((ly, li) => {
    B(x, y0 + ly, z, Dp, 0.06, L, COL.board);
    B(x + Dp - 0.04, y0 + ly - 0.06, z, 0.06, 0.1, L, COL.post); // front beam
    if (li === 3) { if (seed % 2) { cbox(x + 0.1, y0 + ly + 0.06, z + 0.3, Dp - 0.2, 0.34, 0.7); crate(x + 0.12, y0 + ly + 0.06, z + 1.3, Dp - 0.24, 0.3, 0.6); } else cbox(x + 0.1, y0 + ly + 0.06, z + 1.0, Dp - 0.2, 0.3, 0.8, '#EDD3A6'); return; }
    // 3 cells
    for (let k = 0; k < 3; k++) {
      const cz = z + 0.12 + k * (L - 0.2) / 3, cw = (L - 0.2) / 3 - 0.06;
      const t = rnd();
      if (t < 0.32) crate(x + 0.12, y0 + ly + 0.06, cz + 0.04, Dp - 0.24, 0.32, cw - 0.08);
      else if (t < 0.8) { const bh = 0.3 + rnd() * 0.22; cbox(x + 0.1, y0 + ly + 0.06, cz, Dp - 0.22, bh, cw * 0.55, rnd() < .5 ? COL.box : '#EDD3A6'); if (rnd() < .7) cbox(x + 0.14, y0 + ly + 0.06, cz + cw * 0.58, Dp - 0.28, 0.26, cw * 0.4, '#F3E6CC'); }
      else { // products
        const pc = ['#FFFFFF', '#7CC8FF', '#FF7FB0', '#FFD93B', '#F0373B'][Math.floor(rnd() * 5)];
        for (let q = 0; q < 3; q++) B(x + 0.2, y0 + ly + 0.06, cz + 0.05 + q * cw / 3, 0.22, 0.28, cw / 3 - 0.06, pc);
      }
    }
  });

  if (sel) { const c = sel, o = 0.3, t = 0.16; B(x - o, WD.F + 0.016, z - o, Dp + 2 * o, 0.02, t, c, { emit: 1 }); B(x - o, WD.F + 0.016, z + L + o - t, Dp + 2 * o, 0.02, t, c, { emit: 1 }); B(x - o, WD.F + 0.016, z - o, t, 0.02, L + 2 * o, c, { emit: 1 }); B(x + Dp + o - t, WD.F + 0.016, z - o, t, 0.02, L + 2 * o, c, { emit: 1 }); }
}
function pallet(x, z, load = 1, seed = 3) {
  const y = WD.F;
  for (const pz of [0, 0.5, 1.0]) B(x, y, z + pz, 1.2, 0.1, 0.12, COL.woodD);
  for (let px = 0; px < 1.2; px += 0.24) B(x + px, y + 0.1, z, 0.18, 0.04, 1.12, COL.wood);
  if (load) { const yy = y + 0.14; cbox(x + 0.05, yy, z + 0.05, 0.52, 0.42, 0.5); cbox(x + 0.62, yy, z + 0.05, 0.52, 0.42, 0.5, COL.boxD); cbox(x + 0.05, yy, z + 0.58, 0.52, 0.42, 0.5, '#EDD3A6'); cbox(x + 0.62, yy, z + 0.58, 0.52, 0.42, 0.5); if (load > 1) { cbox(x + 0.1, yy + 0.42, z + 0.1, 0.5, 0.36, 0.5); cbox(x + 0.6, yy + 0.42, z + 0.55, 0.5, 0.36, 0.5, COL.boxD); } }
}
function table(x, z, L = 2.4, D = 0.9) { // long along X
  const y = WD.F;
  for (const [px, pz] of [[0, 0], [L - 0.1, 0], [0, D - 0.1], [L - 0.1, D - 0.1]]) B(x + px, y, z + pz, 0.1, 0.86, 0.1, COL.post);
  B(x, y + 0.3, z, L, 0.05, D, COL.post);
  B(x - 0.04, y + 0.86, z - 0.04, L + 0.08, 0.07, D + 0.08, '#EDE7DA');
  cbox(x + 0.2, y + 0.36, z + 0.15, 0.5, 0.3, 0.5); cbox(x + 0.8, y + 0.36, z + 0.2, 0.4, 0.26, 0.45, COL.boxD);
  B(x + 1.5, y + 0.35, z + 0.2, 0.5, 0.2, 0.5, '#8B9098');
  cbox(x + 0.3, y + 0.93, z + 0.2, 0.55, 0.32, 0.45);
  B(x + L - 0.6, y + 0.93, z + 0.35, 0.22, 0.18, 0.12, COL.green); B(x + L - 0.56, y + 0.97, z + 0.33, 0.14, 0.14, 0.16, COL.tape);
}
function tree(x, z, s = 1) {
  B(x - 0.15 * s, 0, z - 0.15 * s, 0.3 * s, 1.1 * s, 0.3 * s, '#8A5A34');
  B(x - 0.8 * s, 1.0 * s, z - 0.8 * s, 1.6 * s, 1.1 * s, 1.6 * s, '#5DB52A');
  B(x - 0.6 * s, 2.0 * s, z - 0.6 * s, 1.2 * s, 0.7 * s, 1.2 * s, '#6CC734');
  B(x - 0.95 * s, 1.25 * s, z - 0.4 * s, 0.3 * s, 0.6 * s, 0.8 * s, '#55A827');
  B(x + 0.55 * s, 1.35 * s, z - 0.2 * s, 0.35 * s, 0.6 * s, 0.6 * s, '#66BF31');
}
function bush(x, z, s = 1) { B(x - 0.5 * s, 0, z - 0.4 * s, 1.0 * s, 0.55 * s, 0.8 * s, '#5DB52A'); B(x - 0.3 * s, 0.45 * s, z - 0.25 * s, 0.6 * s, 0.3 * s, 0.5 * s, '#6CC734'); }
function bike(x, z) { // along X
  const y = 0.02;
  for (const px of [0, 1.1]) { B(x + px, y, z, 0.5, 0.5, 0.1, COL.black); B(x + px + 0.15, y + 0.15, z - 0.01, 0.2, 0.2, 0.12, '#9AA0A8'); }
  B(x + 0.3, y + 0.45, z + 0.01, 1.1, 0.1, 0.08, COL.green); B(x + 0.55, y + 0.5, z + 0.01, 0.1, 0.35, 0.08, '#E9EAE6');
  B(x + 0.45, y + 0.85, z - 0.06, 0.4, 0.08, 0.22, COL.dark); B(x + 1.3, y + 0.55, z, 0.08, 0.5, 0.1, '#E9EAE6'); B(x + 1.2, y + 1.05, z - 0.2, 0.1, 0.06, 0.5, COL.dark);
  B(x - 0.05, y + 0.6, z - 0.22, 0.5, 0.45, 0.54, COL.green); B(x - 0.05, y + 1.05, z - 0.22, 0.5, 0.04, 0.54, COL.greenD);
}
function truck(x, z) { // cab faces +z (south), body extends to -z
  const y = 0;
  for (const [px, pz] of [[0, 0.5], [2.0, 0.5], [0, 3.2], [2.0, 3.2], [0, 4.1], [2.0, 4.1]]) B(x + px - 0.05, y, z + pz, 0.35, 0.75, 0.75, COL.black);
  B(x + 0.1, 0.45, z - 0.2, 2.1, 0.25, 5.3, COL.dark);
  B(x, 0.7, z - 0.3, 2.3, 2.5, 4.0, '#F4F4F1'); B(x - 0.02, 3.2, z - 0.32, 2.34, 0.1, 4.04, '#DCDCD6');
  B(x - 0.02, 0.9, z + 1.0, 0.04, 0.3, 2.6, COL.green); B(x + 2.28, 0.9, z + 1.0, 0.04, 0.3, 2.6, COL.green);
  // cab
  B(x, 0.7, z + 3.75, 2.3, 1.9, 1.5, COL.green); B(x + 0.05, 2.6, z + 3.8, 2.2, 0.15, 1.2, COL.greenD);
  B(x + 0.15, 1.6, z + 5.2, 2.0, 0.85, 0.06, '#2D3640'); B(x - 0.02, 1.65, z + 4.05, 0.04, 0.7, 0.9, '#2D3640'); B(x + 2.28, 1.65, z + 4.05, 0.04, 0.7, 0.9, '#2D3640');
  B(x + 0.1, 0.75, z + 5.24, 2.1, 0.35, 0.08, '#E9EAE6'); B(x + 0.15, 1.15, z + 5.24, 0.35, 0.18, 0.06, '#FFF6C9', { emit: 1 }); B(x + 1.8, 1.15, z + 5.24, 0.35, 0.18, 0.06, '#FFF6C9', { emit: 1 });
}
function gate(x, z, w = 3.6) { // opening in south wall at z, from x to x+w
  const h = WD.H + 0.3;
  B(x - 0.45, WD.F, z - 0.1, 0.45, h, 0.5, COL.dark); B(x + w, WD.F, z - 0.1, 0.45, h, 0.5, COL.dark);
  B(x - 0.45, WD.F + h, z - 0.12, w + 0.9, 0.55, 0.54, COL.dark);
  for (let k = 0; k < 6; k++) B(x + 0.1 + k * 0.12, WD.F + h - 0.3, z + 0.02, w - 0.2, 0.06, 0.04, '#5A6068');
  B(x + 0.1, WD.F + h - 0.75, z, w - 0.2, 0.7, 0.18, '#D9DBD8'); // rolled-up door
  B(x + 0.1, WD.F + 0.6, z + 0.3, 0.12, 1.0, 0.12, COL.green); B(x + w - 0.22, WD.F + 0.6, z + 0.3, 0.12, 1.0, 0.12, COL.green);
  B(x, 0, z + 0.4, w, WD.F + 0.05, 1.2, '#BFC3C6'); // dock plate
  B(x + 0.4, WD.F + h - 0.95, z + 0.36, 0.8, 0.12, 0.08, '#FFF6C9', { emit: 1 });
}
function cooler(x, z) { B(x, WD.F, z, 0.45, 1.0, 0.45, '#E6ECF1'); B(x + 0.05, WD.F + 1.0, z + 0.05, 0.35, 0.5, 0.35, '#7CC8FF'); B(x + 0.1, WD.F + 0.6, z + 0.45, 0.08, 0.08, 0.06, COL.blue); }
function sofa(x, z, L = 2.2) { B(x, WD.F, z, L, 0.45, 0.85, '#6CC734'); B(x, WD.F, z, L, 0.95, 0.25, '#5DB52A'); B(x, WD.F, z, 0.2, 0.65, 0.85, '#5DB52A'); B(x + L - 0.2, WD.F, z, 0.2, 0.65, 0.85, '#5DB52A'); }
function lockers(x, z, n = 3) { for (let i = 0; i < n; i++) { B(x + i * 0.55, WD.F, z, 0.52, 1.9, 0.5, i % 2 ? '#8FC3E8' : '#A4CFEE'); B(x + i * 0.55 + 0.35, WD.F + 1.0, z + 0.5, 0.06, 0.2, 0.03, COL.dark); } }

// ---------- characters ----------
const BREED = {
  lucky: { fur: '#F1E2C2', fur2: '#F8EFDC', ear: 'flop', earC: '#E6CFA4', tail: '#F1E2C2' },
  korzh: { fur: '#E99A3C', fur2: '#FBF4EA', ear: 'up', earC: '#F6B8B8', tail: '#E99A3C' },
  buran: { fur: '#5D6168', fur2: '#F2F2F2', ear: 'up', earC: '#3E4147', tail: '#5D6168' },
  bulya: { fur: '#D9B07F', fur2: '#EEDDC0', ear: 'bat', earC: '#C99070', tail: '#D9B07F' },
};
// dog at (x,z) facing dir: 'S' (+z), 'E' (+x), 'N', 'W'. s = scale
function dog(x, z, k, face = 'S', opt = {}) {
  const br = BREED[k], s = opt.s || 1.2, y0 = WD.F + (opt.y || 0);
  const parts = [];
  const P = (lx, ly, lz, w, h, d, c, o) => parts.push([lx, ly, lz, w, h, d, c, o]);
  // local: x across (−0.3..0.3), z forward (+), y up
  const step = opt.walk ? 0.1 : 0;
  P(-0.2, 0, -0.1 + step, 0.17, 0.08, 0.27, COL.green); P(0.03, 0, -0.1 - step, 0.17, 0.08, 0.27, COL.green);
  P(-0.2, 0.08, -0.06 + step, 0.17, 0.38, 0.18, '#4B4F57'); P(0.03, 0.08, -0.06 - step, 0.17, 0.38, 0.18, '#4B4F57');
  P(-0.26, 0.44, -0.16, 0.52, 0.5, 0.32, COL.white);
  P(-0.22, 0.44, 0.16, 0.44, 0.42, 0.04, COL.green); P(-0.22, 0.86, 0.16, 0.08, 0.1, 0.03, COL.green); P(0.14, 0.86, 0.16, 0.08, 0.1, 0.03, COL.green);
  P(0.04, 0.7, 0.2, 0.12, 0.05, 0.01, '#EDEDED');
  const armF = opt.cart ? 0.18 : 0;
  P(-0.38, 0.56, -0.07 + armF * 0.5, 0.12, 0.36, 0.14 + armF, COL.white); P(0.26, 0.56, -0.07 + armF * 0.5, 0.12, 0.36, 0.14 + armF, COL.white);
  P(-0.38, 0.5, 0.0 + armF, 0.12, 0.1, 0.12, br.fur2); P(0.26, 0.5, 0.0 + armF, 0.12, 0.1, 0.12, br.fur2);
  // head (chibi)
  P(-0.27, 0.92, -0.22, 0.54, 0.46, 0.46, br.fur);
  P(-0.17, 0.92, 0.24, 0.34, 0.16, 0.1, br.fur2);            // muzzle
  P(-0.06, 1.04, 0.33, 0.12, 0.07, 0.04, COL.black);         // nose
  P(-0.03, 0.95, 0.335, 0.06, 0.04, 0.01, '#E8708A');        // tongue
  P(-0.2, 1.12, 0.24, 0.08, 0.1, 0.01, COL.black); P(0.12, 1.12, 0.24, 0.08, 0.1, 0.01, COL.black); // eyes
  P(-0.18, 1.18, 0.245, 0.03, 0.03, 0.01, '#FFFFFF'); P(0.14, 1.18, 0.245, 0.03, 0.03, 0.01, '#FFFFFF');
  if (k === 'korzh' || k === 'buran') P(-0.06, 1.08, 0.24, 0.12, 0.2, 0.005, br.fur2); // blaze
  if (k === 'bulya') { P(-0.24, 1.08, 0.24, 0.14, 0.16, 0.005, '#8C6A4C'); }
  if (br.ear === 'flop') { P(-0.33, 0.96, -0.12, 0.07, 0.34, 0.26, br.earC); P(0.26, 0.96, -0.12, 0.07, 0.34, 0.26, br.earC); }
  if (br.ear === 'up') { P(-0.28, 1.36, -0.08, 0.16, 0.3, 0.1, br.fur); P(0.12, 1.36, -0.08, 0.16, 0.3, 0.1, br.fur); P(-0.25, 1.4, 0.02, 0.1, 0.2, 0.01, br.earC); P(0.15, 1.4, 0.02, 0.1, 0.2, 0.01, br.earC); }
  if (br.ear === 'bat') { P(-0.34, 1.32, -0.08, 0.16, 0.24, 0.1, br.fur); P(0.18, 1.32, -0.08, 0.16, 0.24, 0.1, br.fur); P(-0.31, 1.35, 0.02, 0.1, 0.16, 0.01, br.earC); P(0.21, 1.35, 0.02, 0.1, 0.16, 0.01, br.earC); }
  // cap
  P(-0.24, 1.38, -0.2, 0.48, 0.12, 0.42, COL.green); P(-0.2, 1.38, 0.22, 0.4, 0.04, 0.16, COL.greenD);
  // tail
  P(-0.06, 0.5, -0.32, 0.12, 0.12, 0.18, br.tail);
  if (opt.cart) {
    const cz = 0.42;
    for (const [px, pz] of [[-0.32, 0], [0.24, 0], [-0.32, 0.62], [0.24, 0.62]]) { P(px, 0, cz + pz, 0.08, 0.1, 0.08, COL.black); P(px, 0.1, cz + pz, 0.06, 0.78, 0.06, COL.metal); }
    P(-0.32, 0.3, cz, 0.62, 0.04, 0.68, COL.metal);
    P(-0.34, 0.6, cz - 0.02, 0.66, 0.04, 0.72, COL.greenD); P(-0.34, 0.6, cz - 0.02, 0.04, 0.26, 0.72, COL.green); P(0.28, 0.6, cz - 0.02, 0.04, 0.26, 0.72, COL.green); P(-0.34, 0.6, cz + 0.66, 0.66, 0.26, 0.04, COL.green); P(-0.34, 0.6, cz - 0.02, 0.66, 0.26, 0.04, COL.green);
    P(-0.34, 0.86, cz - 0.06, 0.66, 0.05, 0.05, COL.metal);
    P(-0.22, 0.64, cz + 0.1, 0.2, 0.26, 0.2, COL.box); P(0.02, 0.64, cz + 0.1, 0.18, 0.3, 0.18, '#FFFFFF'); P(-0.2, 0.64, cz + 0.38, 0.16, 0.18, 0.16, COL.red); P(0.02, 0.64, cz + 0.36, 0.2, 0.22, 0.2, '#EDD3A6');
    P(-0.3, 0.34, cz + 0.06, 0.24, 0.2, 0.24, '#F3E6CC');
  }
  if (opt.cup) P(0.27, 0.6, 0.12, 0.1, 0.12, 0.1, '#FFFFFF');
  // ring (Mini Metro color)
  if (opt.ring) { const r = opt.ring, R = 0.48; B(x - R, WD.F + 0.013, z - R, 2 * R, 0.015, 0.09, r, { emit: 1, noAO: 1 }); B(x - R, WD.F + 0.013, z + R - 0.09, 2 * R, 0.015, 0.09, r, { emit: 1, noAO: 1 }); B(x - R, WD.F + 0.013, z - R, 0.09, 0.015, 2 * R, r, { emit: 1, noAO: 1 }); B(x + R - 0.09, WD.F + 0.013, z - R, 0.09, 0.015, 2 * R, r, { emit: 1, noAO: 1 }); }
  const rot = { S: (a, c, w, d) => [a, c, w, d], N: (a, c, w, d) => [-a - w, -c - d, w, d], E: (a, c, w, d) => [c, -a - w, d, w], W: (a, c, w, d) => [-c - d, a, d, w] }[face];
  for (const [lx, ly, lz, w, h, d, c, o] of parts) { const [ax, az, ww, dd] = rot(lx * s, lz * s, w * s, d * s); B(x + ax, y0 + ly * s, z + az, ww, h * s, dd, c, o); }
}

// ---------- route (Mini Metro line on floor) ----------
function route(pts, c, w = 0.22, dashed = false) {
  const y = WD.F + 0.02;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
    const segs = [];
    if (dashed) { const L = Math.hypot(x1 - x0, z1 - z0); for (let t = 0; t < L; t += 0.6) segs.push([t / L, Math.min(1, (t + 0.35) / L)]); } else segs.push([0, 1]);
    for (const [a, b] of segs) {
      const xa = x0 + (x1 - x0) * a, za = z0 + (z1 - z0) * a, xb = x0 + (x1 - x0) * b, zb = z0 + (z1 - z0) * b;
      const mx = Math.min(xa, xb), mz = Math.min(za, zb), W = Math.abs(xb - xa), D = Math.abs(zb - za);
      B(mx - w / 2 - 0.06, y, mz - w / 2 - 0.06, W + w + 0.12, 0.012, D + w + 0.12, '#FFFFFF', { emit: 1, noAO: 1 });
      B(mx - w / 2, y + 0.012, mz - w / 2, W + w, 0.012, D + w, c, { emit: 1, noAO: 1 });
    }
  }
}
function stop(x, z, c) { const y = WD.F + 0.03; B(x - 0.32, y, z - 0.32, 0.64, 0.03, 0.64, c, { emit: 1 }); B(x - 0.22, y + 0.01, z - 0.22, 0.44, 0.03, 0.44, '#FFFFFF', { emit: 1 }); }

// ---------- whole scene ----------
const AISLES = [8.6, 12.4, 16.2, 20.0]; // shelf row x (shelves face +x)
const UNITZ = [0.8, 3.2, 5.6];         // shelf unit z start
function buildWorld(o = {}) {
  GL.clear();
  // ground: Crossy Road style grass strips
  for (let z = -30; z < 50; z += 2) B(-30, -0.35, z, 90, 0.3, 2, Math.abs(z / 2) % 2 ? COL.grassA : COL.grassB, { noAO: 1, skipBottom: 1 });
  // road + sidewalk
  B(-30, -0.29, 20.2, 90, 0.3, 0.8, COL.walk, { noAO: 1 }); B(-30, -0.29, 21.0, 90, 0.31, 0.15, COL.curb, { noAO: 1 });
  B(-30, -0.3, 21.15, 90, 0.3, 4.6, COL.road, { noAO: 1 });
  for (let x = -30; x < 60; x += 3) B(x, 0.005, 23.35, 1.6, 0.01, 0.2, '#FFFFFF', { noAO: 1, emit: 1 });
  B(-30, -0.29, 25.75, 90, 0.31, 0.15, COL.curb, { noAO: 1 }); B(-30, -0.29, 25.9, 90, 0.3, 0.8, COL.walk, { noAO: 1 });
  // driveway to dock + apron for bikes
  B(1.2, -0.29, WD.D, 5.6, 0.3, 4.2, '#A5A9B0', { noAO: 1 });
  for (let k = 0; k < 3; k++) B(1.6, 0.005, WD.D + 1.2 + k * 1.1, 4.8, 0.01, 0.12, '#FFFFFF', { noAO: 1, emit: 1 });
  B(WD.W, -0.29, 6, 6.5, 0.3, 14.2, '#D3D5D9', { noAO: 1 });
  for (let z = 7; z <= 13; z += 2) B(WD.W + 0.8, 0.005, z, 2.6, 0.01, 0.1, '#FFFFFF', { noAO: 1, emit: 1 });
  // building slab + floor tiles (checker 1m)
  B(-0.2, -0.3, -0.2, WD.W + 0.4, 0.3 + WD.F, WD.D + 0.4, COL.slab);
  B(0, WD.F - 0.001, 0, WD.W, 0.002, WD.D, '#F4F2EC', { noAO: 1 });
  for (let x = 2; x < WD.W; x += 2) B(x - 0.03, WD.F, 0, 0.06, 0.003, WD.D, '#D6D0C2', { noAO: 1 });
  for (let z = 2; z < WD.D; z += 2) B(0, WD.F, z - 0.03, WD.W, 0.003, 0.06, '#D6D0C2', { noAO: 1 });
  // ----- zones on floor -----
  // rest room floor (wood)
  for (let x = 0; x < 5; x += 0.5) B(x, WD.F, 0, 0.5, 0.01, 4.6, (x * 2) % 2 ? '#E8CB98' : '#E1C08A', { noAO: 1 });
  // defect zone: red stripes
  for (let z = 5.2; z < 8.6; z += 0.5) B(0.3, WD.F, z, 4.4, 0.01, 0.25, '#F7B8B3', { noAO: 1 });
  zoneDash(0.3, 5.2, 4.4, 3.4, COL.red);
  // receiving zone
  zoneDash(0.4, 9.4, 7.6, 6.2, '#E7A400');
  // packing zone
  flatRect(8.8, 10.2, 13.6, 3.4, '#E2F2CF'); zoneDash(8.8, 10.2, 13.6, 3.4, COL.greenD);
  // walkway lanes (yellow)
  B(8.0, WD.F + 0.012, 8.9, 14.8, 0.01, 0.1, COL.yellow, { noAO: 1 }); B(8.0, WD.F + 0.012, 9.6, 14.8, 0.01, 0.1, COL.yellow, { noAO: 1 });
  // aisle number tiles
  AISLES.forEach((ax, i) => B(ax + 1.25, WD.F + 0.012, 8.15, 0.5, 0.01, 0.5, '#3D4249', { noAO: 1, emit: 1 }));
  if (o.floor) o.floor();
  // ----- walls -----
  wallX(-0.3, WD.W + 0.3, -0.3, WD.H, 0.3, { pil: 1 });      // back (north)
  wallZ(-0.3, WD.D, -0.3, WD.H, 0.3, { pil: 1 });              // west
  // east wall: full but with door gap 11.6..13.4 ... cut low for readability
  const lowH = 0.7;
  wallZ(-0.3, 11.6, WD.W, lowH); wallZ(13.4, WD.D + 0.3, WD.W, lowH);
  B(WD.W - 0.05, WD.F, 11.4, 0.4, 2.4, 0.2, COL.dark); B(WD.W - 0.05, WD.F, 13.4, 0.4, 2.4, 0.2, COL.dark); B(WD.W - 0.05, WD.F + 2.4, 11.4, 0.4, 0.25, 2.2, COL.dark);
  // south wall low with gate
  wallX(-0.3, 1.6, WD.D, lowH); wallX(6.4, WD.W + 0.3, WD.D, lowH);
  gate(2.0, WD.D, 4.0);
  // rest room partitions
  wallX(-0.1, 3.2, 4.6, 1.1, 0.2); wallZ(-0.1, 2.4, 5.0, 1.1, 0.2); wallZ(3.4, 4.8, 5.0, 1.1, 0.2);
  for (const [x0, x1] of [[-0.1, 3.2]]) B(x0, WD.F + 1.22, 4.66, x1 - x0, 0.9, 0.08, '#CDEBF5', { noAO: 1 });
  B(5.06, WD.F + 1.22, -0.1, 0.08, 0.9, 2.5, '#CDEBF5', { noAO: 1 }); B(5.06, WD.F + 1.22, 3.4, 0.08, 0.9, 1.4, '#CDEBF5', { noAO: 1 });
  B(-0.1, WD.F + 2.12, 4.62, 3.3, 0.08, 0.16, COL.wallCap); B(5.02, WD.F + 2.12, -0.1, 0.16, 0.08, 2.5, COL.wallCap); B(5.02, WD.F + 2.12, 3.4, 0.16, 0.08, 1.4, COL.wallCap);
  // defect cage fence
  const fy = WD.F;
  for (let x = 0.3; x <= 4.7; x += 0.55) B(x, fy, 8.55, 0.06, 1.1, 0.06, COL.dark);
  for (let z = 5.2; z <= 8.6; z += 0.55) B(4.7, fy, z, 0.06, 1.1, 0.06, COL.dark);
  B(0.3, fy + 1.05, 8.55, 4.46, 0.06, 0.06, COL.dark); B(4.7, fy + 1.05, 5.2, 0.06, 0.06, 3.4, COL.dark);
  B(0.3, fy + 0.5, 8.55, 4.46, 0.03, 0.03, COL.dark); B(4.7, fy + 0.5, 5.2, 0.03, 0.03, 3.4, COL.dark);
  // ----- furniture -----
  sofa(0.3, 0.2, 2.6); cooler(3.9, 0.35); lockers(0.25, 3.6, 4);
  B(1.0, WD.F, 1.6, 1.4, 0.45, 0.8, COL.woodD); B(0.95, WD.F + 0.45, 1.55, 1.5, 0.05, 0.9, COL.wood);
  // defect bins + damaged pallet
  B(0.6, WD.F, 5.5, 0.9, 0.8, 0.7, COL.red); B(0.55, WD.F + 0.8, 5.45, 1.0, 0.08, 0.8, '#C22F2F');
  pallet(2.6, 6.2, 1, 7);
  // receiving pallets
  pallet(1.0, 10.0, 2); pallet(2.7, 10.0, 1); pallet(1.0, 12.0, 1); pallet(4.6, 10.2, 2); pallet(2.7, 12.2, 2);
  // shelves
  AISLES.forEach((ax, i) => UNITZ.forEach((uz, k) => shelf(ax, uz, 2.2, 0.75, 2.2, i * 3 + k + 1, o.sel && o.sel[0] === i && o.sel[1] === k ? o.selColor : null)));
  // packing tables
  table(9.6, 10.8); table(13.2, 10.8); table(16.8, 10.8);
  for (const [px, pz] of [[0, 0], [1.12, 0], [0, 0.52], [1.12, 0.52]]) B(20.6 + px, WD.F, 10.6 + pz, 0.08, 1.6, 0.08, COL.post); for (let l = 0; l < 3; l++) { B(20.6, WD.F + 0.1 + l * 0.5, 10.6, 1.2, 0.05, 0.6, COL.board); cbox(20.7, WD.F + 0.15 + l * 0.5, 10.65, 0.45, 0.3, 0.45); cbox(21.2, WD.F + 0.15 + l * 0.5, 10.65, 0.45, 0.25, 0.45, '#EDD3A6'); }
  // ----- outside -----
  truck(2.85, WD.D + 0.7);
  for (let z = 7.1; z <= 13; z += 2) bike(WD.W + 1.1, z + 0.6);
  const trees = o.trees || [[-3, 2], [-3.4, 8], [-2.8, 13.5], [-6, 5], [9, 18.2], [13.5, 18.6], [18, 18.0], [27.8, 1.8], [31, 5], [31.5, 14], [8, -3.2], [15, -3.6], [21.5, -3.2], [2, -3.4], [-7, 17], [34, 9]];
  trees.forEach(([x, z]) => tree(x, z, 1));
  [[11, 17.6], [16, 17.4], [21, 17.8], [-1.5, 18], [29, 18], [26, -2.5], [-2.5, -2.5]].forEach(([x, z]) => bush(x, z));
  if (o.extra) o.extra();
}
const CAM_MAIN = { target: [12.2, 0, 8.0], zoom: 10.9, az: 45, el: 38, shiftY: 0.35, shiftX: -1.3 };
function crew(o = {}) {
  dog(17.6, 5.0, 'lucky', 'S', { cart: 1, ring: '#1F7BFF', walk: 1 });
  dog(21.45, 4.4, 'korzh', 'S', { ring: '#FF8A00' });
  dog(3.4, 2.4, 'buran', 'S', { ring: '#9B4DFF', cup: 1 });
  dog(26.3, 9.8, 'bulya', 'W', {});
}
