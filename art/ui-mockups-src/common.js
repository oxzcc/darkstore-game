// shared HUD pieces
const UI = document.getElementById('ui');
function add(html) { UI.insertAdjacentHTML('beforeend', html); }
function hudTop(o = {}) {
  add(`
  <div class="abs panel" style="left:16px;top:14px;height:70px;display:flex;align-items:center;gap:12px;padding:0 18px 0 10px">
    <div style="width:46px;height:46px;background:var(--g);border:3px solid var(--ink);display:grid;place-items:center;box-shadow:inset 0 -5px 0 var(--gLo)">${ic('box', 28)}</div>
    <div><div style="font-weight:700;font-size:22px;letter-spacing:.06em;line-height:1">ДАРКСТОР <span style="color:var(--g)">№7</span></div>
    <div style="margin-top:3px;font-size:14px;font-weight:500;color:var(--ink2)">Смена 2 из 7</div></div>
  </div>
  <div class="abs" style="left:50%;top:14px;transform:translateX(-50%);display:flex;gap:12px">
    <div class="panel hud" style="width:290px">
      <div class="ico" style="background:var(--gTint)">${ic('clock', 26, 'var(--ink)', '#fff')}</div>
      <div style="flex:1"><div class="lbl">До конца смены</div>
        <div style="display:flex;align-items:center;gap:12px"><div class="val">${o.time || '06:42'}</div>
        <div class="bar" style="flex:1;--c:var(--g)"><b style="width:${o.timePct || 33}%"></b></div></div></div>
    </div>
    <div class="panel hud"><div class="ico" style="background:#FFF4CF">${ic('coin', 28)}</div>
      <div><div class="lbl">Деньги</div><div class="val">12 450 ₽</div></div></div>
    <div class="panel hud"><div class="ico" style="background:#FFF4CF">${ic('star', 28)}</div>
      <div><div class="lbl">Рейтинг</div><div class="val">4,6</div></div></div>
  </div>
  <div class="abs" style="right:16px;top:14px;display:flex">
    <div class="panel" style="display:flex;height:70px">
      <div style="width:70px;display:grid;place-items:center;border-right:3px solid var(--ink);${o.paused ? 'background:var(--g);color:#fff' : ''}">${ic('pause', 26, o.paused ? '#fff' : 'var(--ink)')}</div>
      <div style="width:70px;display:grid;place-items:center;border-right:3px solid var(--ink);${o.paused ? '' : 'background:var(--g);'}font-weight:700;font-size:22px;color:${o.paused ? 'var(--ink)' : '#fff'}">×1</div>
      <div style="width:70px;display:grid;place-items:center;font-weight:700;font-size:22px">×2</div>
    </div>
    <div class="panel" style="width:70px;height:70px;display:grid;place-items:center;margin-left:12px">${ic('settings', 28)}</div>
  </div>`);
}
const PK = {
  lucky: { name: 'Лаки', breed: 'лабрадор', c: 'var(--lucky)', hex: '#1F7BFF', head: 'cut/vhead_lucky.png' },
  korzh: { name: 'Коржик', breed: 'корги', c: 'var(--korzh)', hex: '#FF8A00', head: 'cut/vhead_korzh.png' },
  buran: { name: 'Буран', breed: 'хаски', c: 'var(--buran)', hex: '#9B4DFF', head: 'cut/vhead_buran.png' },
  bulya: { name: 'Буля', breed: 'бульдог', c: '#11B5A4', hex: '#11B5A4', head: 'cut/vhead_bulya.png' },
};
function portrait(k, size = 72, bg) {
  const p = PK[k], s = size, cc = Math.max(4, Math.round(s * .14));
  const poly = `${cc},1.5 ${s - cc},1.5 ${s - 1.5},${cc} ${s - 1.5},${s - cc} ${s - cc},${s - 1.5} ${cc},${s - 1.5} 1.5,${s - cc} 1.5,${cc}`;
  return `<div class="nodeco" style="width:${s}px;height:${s}px;position:relative;flex:none;filter:drop-shadow(0 3px 4px rgba(0,0,0,.18))">
    <div style="position:absolute;inset:0;clip-path:polygon(${cc}px 0,calc(100% - ${cc}px) 0,100% ${cc}px,100% calc(100% - ${cc}px),calc(100% - ${cc}px) 100%,${cc}px 100%,0 calc(100% - ${cc}px),0 ${cc}px);background:${bg || p.c};overflow:hidden">
            <img src="${p.head}" style="position:absolute;width:100%;left:0;top:0"></div>
    <svg style="position:absolute;inset:0" width="${s}" height="${s}"><polygon points="${poly}" fill="none" stroke="#6B6150" stroke-width="2.5"/></svg></div>`;
}
function dim(alpha = .55) { add(`<div class="abs" style="inset:0;background:rgba(20,28,16,${alpha})"></div>`); }

// ---- voxel chamfer decoration ----
function shadeCol(col, k) { const m = col.match(/[\d.]+/g); if (!m) return col; const [r, g, b] = m.map(Number); return `rgb(${Math.round(r * k)},${Math.round(g * k)},${Math.round(b * k)})`; }
function voxify(root = document) {
  const els = [...root.querySelectorAll('*')].filter(el => {
    if (el.closest('svg') || el.classList.contains('nodeco') || el.tagName === 'IMG' || el.tagName === 'CANVAS') return false;
    const cs = getComputedStyle(el); const bw = parseFloat(cs.borderTopWidth);
    return bw >= 2 && cs.borderTopStyle === 'solid' && parseFloat(cs.borderLeftWidth) >= 2 && el.offsetWidth >= 26 && el.offsetHeight >= 22;
  });
  const info = els.map(el => { const cs = getComputedStyle(el); return { el, bw: parseFloat(cs.borderTopWidth), stroke: cs.borderTopColor, fill: cs.backgroundColor, img: cs.backgroundImage, sh: cs.boxShadow !== 'none', pos: cs.position, w: el.offsetWidth, h: el.offsetHeight }; });
  info.forEach(({ el, bw, stroke, fill, img, sh, pos, w, h }) => {
    const small = Math.min(w, h);
    const c = Math.max(4, Math.min(12, Math.round(small * .16)));
    const ex = el.classList.contains('tag') || small < 34 || el.dataset.flat !== undefined ? 0 : Math.min(7, Math.round(small * .08) + 2);
    const ring = el.dataset.ring;
    const shadow = sh || el.dataset.shadow !== undefined;
    if (pos === 'static') el.style.position = 'relative';
    el.style.isolation = 'isolate';
    el.style.borderColor = 'transparent';
    el.style.boxShadow = 'none'; el.style.outline = 'none';
    const transparentFill = fill === 'rgba(0, 0, 0, 0)';
    if (img === 'none') el.style.background = 'transparent';
    else el.style.clipPath = `polygon(${c}px 0,calc(100% - ${c}px) 0,100% ${c}px,100% calc(100% - ${c}px),calc(100% - ${c}px) 100%,${c}px 100%,0 calc(100% - ${c}px),0 ${c}px)`;
    const P = (x, y, W, H, k) => `${x + k},${y} ${x + W - k},${y} ${x + W},${y + k} ${x + W},${y + H - k} ${x + W - k},${y + H} ${x + k},${y + H} ${x},${y + H - k} ${x},${y + k}`;
    const h2 = bw / 2;
    const id = 'f' + Math.random().toString(36).slice(2, 8);
    let g = '';
    if (shadow) g += `<defs><filter id="${id}" x="-20%" y="-20%" width="140%" height="160%"><feGaussianBlur stdDeviation="7"/></filter></defs><polygon points="${P(4, 9, w - 8, h - 4, c)}" fill="rgba(80,55,20,.30)" filter="url(#${id})"/>`;
    if (ring) g += `<polygon points="${P(-7, -7, w + 14, h + 14, c + 3)}" fill="none" stroke="${ring}" stroke-width="5"/>`;
    if (img === 'none' && !transparentFill) {
      g += `<polygon points="${P(h2, h2, w - bw, h - bw, c)}" fill="${ex ? shadeCol(fill, .84) : fill}"/>`;
      if (ex) g += `<polygon points="${P(h2, h2, w - bw, h - bw - ex, c)}" fill="${fill}"/><polygon points="${P(h2 + 3, h2 + 2, w - bw - 6, 3, 1)}" fill="rgba(255,255,255,.35)"/>`;
    }
    if (el.dataset.check !== undefined) g += `<defs><pattern id="p${id}" width="64" height="64" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="32" height="32" fill="rgba(140,105,50,.05)"/><rect x="32" y="32" width="32" height="32" fill="rgba(140,105,50,.05)"/></pattern></defs><polygon points="${P(h2, h2, w - bw, h - bw - ex, c)}" fill="url(#p${id})"/>`;
    g += `<polygon points="${P(h2, h2, w - bw, h - bw, c)}" fill="none" stroke="${stroke}" stroke-width="${bw}" stroke-linejoin="miter"/>`;
    el.insertAdjacentHTML('afterbegin', `<svg class="vx-svg" style="left:${-bw}px;top:${-bw}px" width="${w}" height="${h}">${g}</svg>`);
  });
}

// render world into #world canvas and return projector
function renderWorld(cam, opts = {}) {
  buildWorld(opts);
  GL.render(document.getElementById('world'), cam, opts.gl || {});
  return (x, y, z) => GL.project(x, WD.F + y, z);
}
