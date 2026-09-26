#!/usr/bin/env node
/**
 * Render the film to PNG frames (+ the synthesised soundtrack) and encode an MP4.
 *
 *   node legosw/scripts/render.mjs [--size 1920x1080] [--fps 24] [--from 0] [--to <end>] [--subframes 1]
 *        [--out legosw/out] [--shards 1 --shard 0] [--audio] [--encode] [--dist legosw/dist] [--step 1] [--msaa 4]
 *
 * Frames already on disk are skipped, so an interrupted render resumes. Run several shards in
 * parallel (--shards 2 --shard 0 / --shard 1) to use more cores, then `--encode` once.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { serveStatic, launchBrowser } from '../../gauntlet/scripts/lib/browser.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : [])).filter(Boolean),
);
const [width, height] = String(args.size || '1920x1080').split('x').map(Number);
const fps = Number(args.fps || 24);
const out = path.resolve(args.out || path.resolve(here, '../out'));
const framesDir = path.join(out, 'frames');
const shards = Number(args.shards || 1);
const shard = Number(args.shard || 0);
const subframes = Number(args.subframes || 1);
const step = Number(args.step || 1);
fs.mkdirSync(framesDir, { recursive: true });

async function main() {
  const needBrowser = !args['encode-only'];
  let duration = Number(args.to || 0);
  if (needBrowser) {
    const server = await serveStatic(path.resolve(args.dist || path.resolve(here, '../dist')));
    const browser = await launchBrowser({ width, height });
    try {
      const page = await browser.newPage();
      await page.setViewport({ width, height, deviceScaleFactor: 1 });
      page.on('console', (m) => {
        if (m.type() === 'error' || m.type() === 'warning') console.error(`[page:${m.type()}] ${m.text()}`);
      });
      page.on('pageerror', (e) => console.error(`[pageerror] ${e.message}`));
      await page.goto(`${server.url}/?capture=1&msaa=${Number(args.msaa ?? 4)}`, { waitUntil: 'load', timeout: 600000 });
      await page.waitForFunction(() => !!window.__LSW__, { timeout: 600000 });
      await page.evaluate(() => window.__LSW__.ready);
      const total = await page.evaluate(() => window.__LSW__.duration());
      if (!duration) duration = total;
      fs.writeFileSync(path.join(out, 'shots.json'), JSON.stringify(await page.evaluate(() => window.__LSW__.shots()), null, 2));
      if (args.audio) {
        const t0 = Date.now();
        const b64 = await page.evaluate(() => window.__LSW__.renderAudio());
        fs.writeFileSync(path.join(out, 'audio.wav'), Buffer.from(b64, 'base64'));
        console.error(`audio: ${(Date.now() - t0) / 1000}s → ${path.join(out, 'audio.wav')}`);
      }
      if (!args['audio-only']) {
        const from = Math.round(Number(args.from || 0) * fps);
        const to = Math.round(duration * fps);
        const t0 = Date.now();
        let done = 0;
        for (let f = from; f < to; f += step) {
          if (f % shards !== shard) continue;
          const file = path.join(framesDir, `f${String(f).padStart(5, '0')}.png`);
          if (fs.existsSync(file) && fs.statSync(file).size > 1000) continue;
          const T = f / fps;
          await page.evaluate(([T, sf, fps]) => window.__LSW__.renderAt(T, sf, 0.5, fps), [T, subframes, fps]);
          await page.screenshot({ path: file + '.tmp.png', captureBeyondViewport: false });
          fs.renameSync(file + '.tmp.png', file);
          done++;
          if (done % 12 === 0) {
            const spf = (Date.now() - t0) / 1000 / done;
            const left = Math.ceil((to - f) / shards / step);
            console.error(`shard ${shard}: frame ${f}/${to} (T=${T.toFixed(2)}) ${spf.toFixed(2)} s/frame, ~${((left * spf) / 60).toFixed(1)} min left`);
          }
        }
        console.error(`shard ${shard}: rendered ${done} frames in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
      }
    } finally {
      await browser.close();
      await server.close();
    }
  }
  if (args.encode || args['encode-only']) {
    const mp4 = path.join(out, args.name || 'lego-rots-battle-over-coruscant.mp4');
    const audio = path.join(out, 'audio.wav');
    const ff = ['-y', '-framerate', String(fps / step), '-i', path.join(framesDir, 'f%05d.png')];
    if (fs.existsSync(audio)) ff.push('-i', audio);
    ff.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart');
    if (fs.existsSync(audio)) ff.push('-c:a', 'aac', '-b:a', '256k', '-shortest');
    ff.push(mp4);
    console.error(`ffmpeg ${ff.join(' ')}`);
    execFileSync('ffmpeg', ff, { stdio: 'inherit' });
    console.error(`encoded → ${mp4}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
