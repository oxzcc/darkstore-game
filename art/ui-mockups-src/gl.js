// Minimal WebGL voxel renderer: boxes, flat colors, sun + shadow map, ortho iso camera
const GL = (() => {
  const boxes = [];
  function hex(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; }
  // box: x,y,z = min corner (y up), w (x), h (y), d (z)
  function box(x, y, z, w, h, d, color, opt = {}) { boxes.push({ x, y, z, w, h, d, c: typeof color === 'string' ? hex(color) : color, ...opt }); }
  function clear() { boxes.length = 0; }

  function buildMesh() {
    const P = [], N = [], C = [];
    const faces = [
      [[0, 1, 0], [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]]],
      [[0, -1, 0], [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]]],
      [[1, 0, 0], [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]]],
      [[-1, 0, 0], [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]]],
      [[0, 0, 1], [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]]],
      [[0, 0, -1], [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]]],
    ];
    for (const b of boxes) {
      for (const [n, q] of faces) {
        if (b.skipBottom && n[1] === -1) continue;
        const v = q.map(([a, bb, cc]) => [b.x + a * b.w, b.y + bb * b.h, b.z + cc * b.d]);
        for (const i of [0, 1, 2, 0, 2, 3]) {
          P.push(...v[i]); N.push(...n);
          // fake AO: darken near ground for vertical faces
          let k = 1;
          if (n[1] === 0 && !b.noAO) { const yy = v[i][1]; k = 0.86 + 0.14 * Math.min(1, yy / 0.5); }
          C.push(b.c[0] * k, b.c[1] * k, b.c[2] * k, b.emit ? 1 : 0);
        }
      }
    }
    return { P: new Float32Array(P), N: new Float32Array(N), C: new Float32Array(C), n: P.length / 3 };
  }

  // ---- math ----
  const norm = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  function lookAt(eye, tgt, up) {
    const z = norm(eye.map((e, i) => e - tgt[i])), x = norm(cross(up, z)), y = cross(z, x);
    return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1];
  }
  function ortho(l, r, b, t, n, f) { return [2 / (r - l), 0, 0, 0, 0, 2 / (t - b), 0, 0, 0, 0, -2 / (f - n), 0, -(r + l) / (r - l), -(t + b) / (t - b), -(f + n) / (f - n), 1]; }
  function mul(a, b) { const o = new Array(16).fill(0); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) o[j * 4 + i] += a[k * 4 + i] * b[j * 4 + k]; return o; }
  function xf(m, p) { const v = [0, 0, 0, 0]; for (let i = 0; i < 4; i++) v[i] = m[i] * p[0] + m[4 + i] * p[1] + m[8 + i] * p[2] + m[12 + i]; return v; }

  let lastVP = null, lastW = 0, lastH = 0;
  function camMatrix(cam, W, H) {
    const az = (cam.az ?? 45) * Math.PI / 180, el = (cam.el ?? 35) * Math.PI / 180;
    const dir = [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)];
    const eye = cam.target.map((t, i) => t + dir[i] * 200);
    const V = lookAt(eye, cam.target, [0, 1, 0]);
    const hh = cam.zoom, hw = hh * W / H;
    const Pm = ortho(-hw + (cam.shiftX || 0), hw + (cam.shiftX || 0), -hh + (cam.shiftY || 0), hh + (cam.shiftY || 0), 1, 500);
    return mul(Pm, V);
  }
  function project(x, y, z) { const v = xf(lastVP, [x, y, z]); return [(v[0] / v[3] * 0.5 + 0.5) * lastW, (1 - (v[1] / v[3] * 0.5 + 0.5)) * lastH]; }

  const VS = `attribute vec3 p;attribute vec3 n;attribute vec4 c;uniform mat4 VP;uniform mat4 LVP;varying vec3 vn;varying vec4 vc;varying vec4 lp;varying vec3 wp;
  void main(){vn=n;vc=c;wp=p;lp=LVP*vec4(p,1.0);gl_Position=VP*vec4(p,1.0);}`;
  const FS = `precision highp float;varying vec3 vn;varying vec4 vc;varying vec4 lp;varying vec3 wp;uniform sampler2D sm;uniform vec3 L;uniform float texel;
  float unpack(vec4 c){return dot(c,vec4(1.0,1.0/255.0,1.0/65025.0,1.0/16581375.0));}
  void main(){
    vec3 l=lp.xyz/lp.w*0.5+0.5; float sh=0.0;
    float nl=dot(vn,L);
    float bias=0.0016+0.002*(1.0-max(nl,0.0));
    for(int i=-2;i<=2;i++)for(int j=-2;j<=2;j++){float d=unpack(texture2D(sm,l.xy+vec2(float(i),float(j))*texel*1.2));sh+=(l.z-bias>d)?0.0:1.0;}
    sh/=25.0;
    float diff=max(nl,0.0)*sh;
    float amb=0.56+0.14*vn.y+0.04*vn.z;
    vec3 col=vc.rgb*(amb+0.52*diff);
    // warm tint in light, cool in shade
    col*=mix(vec3(0.93,0.95,1.04),vec3(1.04,1.01,0.95),sh*max(nl,0.0));
    if(vc.a>0.5) col=vc.rgb;
    gl_FragColor=vec4(pow(col,vec3(0.95)),1.0);}`;
  const SVS = `attribute vec3 p;uniform mat4 LVP;varying float dz;void main(){vec4 q=LVP*vec4(p,1.0);dz=q.z/q.w*0.5+0.5;gl_Position=q;}`;
  const SFS = `precision highp float;varying float dz;vec4 pack(float d){vec4 e=vec4(1.0,255.0,65025.0,16581375.0)*d;e=fract(e);e-=e.yzww*vec4(1.0/255.0,1.0/255.0,1.0/255.0,0.0);return e;}void main(){gl_FragColor=pack(dz);}`;

  function prog(g, vs, fs) {
    const mk = (t, s) => { const sh = g.createShader(t); g.shaderSource(sh, s); g.compileShader(sh); if (!g.getShaderParameter(sh, g.COMPILE_STATUS)) throw g.getShaderInfoLog(sh); return sh; };
    const p = g.createProgram(); g.attachShader(p, mk(g.VERTEX_SHADER, vs)); g.attachShader(p, mk(g.FRAGMENT_SHADER, fs)); g.linkProgram(p); return p;
  }

  function render(canvas, cam, opt = {}) {
    const W = canvas.width, H = canvas.height;
    const g = canvas.getContext('webgl', { antialias: true, preserveDrawingBuffer: true });
    const mesh = buildMesh();
    const buf = (arr) => { const b = g.createBuffer(); g.bindBuffer(g.ARRAY_BUFFER, b); g.bufferData(g.ARRAY_BUFFER, arr, g.STATIC_DRAW); return b; };
    const bP = buf(mesh.P), bN = buf(mesh.N), bC = buf(mesh.C);
    // light
    const L = norm(opt.light || [0.42, 0.85, 0.62]);
    const sc = opt.sceneCenter || [14, 0, 10], sr = opt.sceneRadius || 34;
    const LV = lookAt(sc.map((c, i) => c + L[i] * 100), sc, [0, 1, 0]);
    const LP = ortho(-sr, sr, -sr, sr, 40, 170);
    const LVP = mul(LP, LV);
    // shadow pass
    const S = 4096;
    const tex = g.createTexture(); g.bindTexture(g.TEXTURE_2D, tex);
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, S, S, 0, g.RGBA, g.UNSIGNED_BYTE, null);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.NEAREST); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.NEAREST);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
    const fb = g.createFramebuffer(); g.bindFramebuffer(g.FRAMEBUFFER, fb);
    g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, tex, 0);
    const rb = g.createRenderbuffer(); g.bindRenderbuffer(g.RENDERBUFFER, rb); g.renderbufferStorage(g.RENDERBUFFER, g.DEPTH_COMPONENT16, S, S);
    g.framebufferRenderbuffer(g.FRAMEBUFFER, g.DEPTH_ATTACHMENT, g.RENDERBUFFER, rb);
    g.viewport(0, 0, S, S); g.clearColor(1, 1, 1, 1); g.clear(g.COLOR_BUFFER_BIT | g.DEPTH_BUFFER_BIT); g.enable(g.DEPTH_TEST);
    const sp = prog(g, SVS, SFS); g.useProgram(sp);
    g.uniformMatrix4fv(g.getUniformLocation(sp, 'LVP'), false, LVP);
    const ap = g.getAttribLocation(sp, 'p'); g.bindBuffer(g.ARRAY_BUFFER, bP); g.enableVertexAttribArray(ap); g.vertexAttribPointer(ap, 3, g.FLOAT, false, 0, 0);
    g.drawArrays(g.TRIANGLES, 0, mesh.n);
    // main pass
    g.bindFramebuffer(g.FRAMEBUFFER, null); g.viewport(0, 0, W, H);
    const bg = hex(opt.bg || '#86D33C'); g.clearColor(bg[0], bg[1], bg[2], 1); g.clear(g.COLOR_BUFFER_BIT | g.DEPTH_BUFFER_BIT);
    const mp = prog(g, VS, FS); g.useProgram(mp);
    const VP = camMatrix(cam, W, H); lastVP = VP; lastW = W; lastH = H;
    g.uniformMatrix4fv(g.getUniformLocation(mp, 'VP'), false, VP);
    g.uniformMatrix4fv(g.getUniformLocation(mp, 'LVP'), false, LVP);
    g.uniform3fv(g.getUniformLocation(mp, 'L'), L);
    g.uniform1f(g.getUniformLocation(mp, 'texel'), 1 / S);
    g.activeTexture(g.TEXTURE0); g.bindTexture(g.TEXTURE_2D, tex); g.uniform1i(g.getUniformLocation(mp, 'sm'), 0);
    const att = (name, b, size) => { const a = g.getAttribLocation(mp, name); g.bindBuffer(g.ARRAY_BUFFER, b); g.enableVertexAttribArray(a); g.vertexAttribPointer(a, size, g.FLOAT, false, 0, 0); };
    att('p', bP, 3); att('n', bN, 3); att('c', bC, 4);
    g.drawArrays(g.TRIANGLES, 0, mesh.n);
    return mesh.n / 36;
  }
  return { box, clear, render, project, hex };
})();
