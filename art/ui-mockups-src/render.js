// Рендер макетов в PNG: из этой папки запустить `python3 -m http.server 8765`, затем `node render.js s01 s02 ...`
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  for (const f of process.argv.slice(2)) {
    await p.goto('http://localhost:8765/' + f + '.html');
    await p.waitForFunction('window.READY === true', null, { timeout: 90000 });
    await p.screenshot({ path: f + '.png' });
    console.log('ok', f);
  }
  await b.close();
})();
