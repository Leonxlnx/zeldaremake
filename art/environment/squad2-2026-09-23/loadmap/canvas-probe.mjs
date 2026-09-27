import { serveStatic, launchBrowser } from '/workspace/gauntlet/scripts/lib/browser.mjs';
const server = await serveStatic('dist');
const browser = await launchBrowser({ width: 300, height: 200 });
try {
  const page = await browser.newPage();
  await page.goto(server.url, { waitUntil: 'domcontentloaded' });
  const out = await page.evaluate(() => {
    const res = {};
    const mk = (wrf) => { const c = document.createElement('canvas'); c.width = c.height = 1024; return [c, c.getContext('2d', wrf ? { willReadFrequently: true } : undefined)]; };
    const paint = (ctx, n) => {
      const st = document.createElement('canvas'); st.width = st.height = 128;
      const sc = st.getContext('2d');
      for (let i = 0; i < n; i++) {
        sc.globalCompositeOperation = 'copy';
        sc.fillStyle = `rgba(${i % 200}, 120, 60, 0.9)`;
        sc.fillRect(0, 0, 128, 128);
        ctx.drawImage(st, (i * 37) % 900, (i * 53) % 900, 50, 50);
      }
    };
    for (const wrf of [false, true]) {
      const key = wrf ? 'cpu' : 'gpu';
      let [c, ctx] = mk(wrf);
      let t = performance.now();
      ctx.getImageData(0, 0, 1024, 1024);
      res[`${key}-blank-read`] = Math.round(performance.now() - t);
      [c, ctx] = mk(wrf);
      t = performance.now();
      paint(ctx, 1500);
      res[`${key}-paint1500`] = Math.round(performance.now() - t);
      t = performance.now();
      ctx.getImageData(0, 0, 1024, 1024);
      res[`${key}-read-after-paint`] = Math.round(performance.now() - t);
      t = performance.now();
      ctx.getImageData(0, 0, 1024, 1024);
      res[`${key}-read-again`] = Math.round(performance.now() - t);
    }
    return res;
  });
  console.log(JSON.stringify(out, null, 1));
} finally { await browser.close(); await server.close(); }
