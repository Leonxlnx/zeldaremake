#!/usr/bin/env node
/**
 * Assemble the work-in-progress site: the rendered cut (with the synthesised soundtrack), one still per
 * shot, the asset turntables and the real-time film, as a self-contained static folder.
 *
 *   node legosw/scripts/wip-site.mjs --render /tmp/lsw-wip-render --out /tmp/lsw-wip
 *        [--film <built dist>] [--shots <shots.json>] [--hero <still.mjs --film output>] [--asset-stills /opt/cursor/artifacts]
 *        [--commit <sha>] [--fps 24] [--no-video] [--keep-video] [--video-url <absolute mp4 url>] [--print-hero-times]
 *
 * --print-hero-times lists the time of each shot's still, to pass to `still.mjs --film --times`; stills found
 * in --hero are used instead of video frames, so the shot list can be complete before the render is.
 * --keep-video reuses an existing encode; --video-url is tried before the local file (for static hosts that
 * serve .mp4 with a generic content type, which iOS Safari refuses).
 *
 * <render> is a render.mjs output folder (frames/, shots.json, audio.wav). --film is copied to <out>/film
 * unless it already lives there. The page works from any static host (relative URLs only).
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : [])).filter(Boolean),
);
const renderDir = path.resolve(args.render || '/tmp/lsw-wip-render');
const out = path.resolve(args.out || '/tmp/lsw-wip');
const fps = Number(args.fps || 24);
const assetStills = path.resolve(args['asset-stills'] || '/opt/cursor/artifacts');
const commit = args.commit || gitHead();
const framesDir = path.join(renderDir, 'frames');

const SHOT_INFO = {
  farfar: { title: 'A long time ago…', at: 0.5 },
  crawl: { title: 'Opening crawl', note: 'The crawl recedes into a baked nebula and 11,000 live stars.', at: 0.3 },
  longtake: { title: 'The long take', note: 'Tilt down to Coruscant, then the two Jedi interceptors dive over a Venator, thread its bridge towers, skim the deck and drop off the port edge into the battle.', at: 0.62 },
  track: { title: 'Through the fleet', note: 'Tracking shot through the battle; a Munificent frigate comes apart in bricks.', at: 0.62 },
  'anakin-cockpit': { title: 'Anakin', at: 0.55 },
  vultures: { title: 'Vulture droids', note: 'Vultures and tri-fighters dive on the Jedi and the ARC-170 escort.', at: 0.5 },
  'hand-reveal': { title: 'The Invisible Hand', note: "Grievous's flagship, with vulture droids crawling over the hull.", at: 0.55 },
  'obiwan-cockpit': { title: 'Obi-Wan', at: 0.5 },
  missiles: { title: 'Discord missiles', note: 'The missiles split open and release buzz droids.', at: 0.75 },
  'buzz-close': { title: 'Buzz droids', note: "Buzz droids saw into Obi-Wan's fighter and slice R4-P17's dome off.", at: 0.72 },
  'obiwan-cockpit-2': { title: 'Obi-Wan', at: 0.5 },
  'anakin-cockpit-2': { title: 'Anakin', at: 0.5 },
  rescue: { title: 'The rescue', note: "Anakin blasts a buzz droid off Obi-Wan's wing; R2-D2 zaps the one that hopped onto Anakin's fighter.", at: 0.3 },
  'hangar-approach': { title: 'Into the hangar', note: 'Straight at the hangar mouth as the ray shield flickers off.', at: 0.5 },
  landing: { title: 'Crash landing', note: "Obi-Wan's fighter skids in and sheds its wings in bricks.", at: 0.52 },
  droids: { title: 'Flying is for droids', note: 'Sabers ignite; the battle droids reconsider.', at: 0.9 },
  endcard: { title: 'End card', at: 0.5 },
};

const ASSETS = [
  { id: 'eta2-anakin', title: "Anakin's Eta-2 interceptor", thumb: 'final-anakin-34front.png', bg: 'space' },
  { id: 'eta2-obiwan', title: "Obi-Wan's Eta-2 interceptor", thumb: 'final-obiwan-34front.png', bg: 'space' },
  { id: 'eta2-anakin-cockpit', title: 'Cockpit: Anakin + R2-D2', thumb: 'final-anakin-cockpit.png', bg: 'space' },
  { id: 'venator', title: 'Venator Star Destroyer', thumb: 'final-venator-wide.png', bg: 'space' },
  { id: 'arc170', title: 'ARC-170', thumb: 'final-arc170-34.png', bg: 'space' },
  { id: 'invisible-hand', title: 'The Invisible Hand', thumb: 'final-ih-wide.png', bg: 'space' },
  { id: 'munificent', title: 'Munificent frigate', thumb: 'final-munificent-wide.png', bg: 'space' },
  { id: 'hangar', title: 'Hangar interior', thumb: 'final-hangar-toward-mouth.png', bg: 'space' },
  { id: 'vulture', title: 'Vulture droid', thumb: 'c-finals-vulture-buzz-b1.png', bg: 'space' },
  { id: 'trifighter', title: 'Droid tri-fighter', thumb: 'c-trifighter.png', bg: 'space' },
  { id: 'missile', title: 'Discord missile', thumb: 'c-finals-missile-trifighter.png', bg: 'space' },
  { id: 'buzzdroid', title: 'Buzz droid', bg: 'studio' },
  { id: 'battledroid', title: 'B1 battle droid', bg: 'studio' },
  { id: 'anakin', title: 'Anakin minifigure', bg: 'studio' },
  { id: 'obiwan', title: 'Obi-Wan minifigure', bg: 'studio' },
  { id: 'astromechs-pair', title: 'R2-D2 and R4-P17', thumb: 'final-droids.png', bg: 'studio' },
];

const DONE = [
  'Brick engine: bevelled bricks, plates, tiles, slopes and studs with real seams; ABS plastic shader (clearcoat, scratches, smudges)',
  'Renderer: HDR, bloom, depth of field, motion blur, ACES tonemapping, film grain; reversed-Z depth so a cockpit and the planet share one pass',
  'Anakin and Obi-Wan minifigures: rigged, sculpted hair, printed faces with live expressions and lip flaps',
  'Ships: both Eta-2 interceptors with R2-D2 and R4-P17, Venator, ARC-170, Munificent frigate, the Invisible Hand and its hangar',
  'Coruscant city-planet shader (street grids, night-side lights, atmosphere), nebula sky, opening crawl',
  'All 17 shots blocked and animated, synthesised sound design and LEGO mumble voices, Skywalker Saga-style subtitles',
];
const DOING = ['Droid squad final pass (vulture, tri-fighter, buzz droid, battle droid)', 'Shot-by-shot polish: framing, lighting, effects density'];
const NEXT = ['Final 1080p render with multi-sample motion blur', 'Final sound mix'];

function gitHead() {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function ff(argv) {
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...argv], { stdio: 'inherit' });
}

function frameFile(f) {
  return path.join(framesDir, `f${String(f).padStart(5, '0')}.png`);
}

function nearestFrame(f) {
  for (let d = 0; d < fps * 2; d++) {
    for (const g of [f - d, f + d]) if (g >= 0 && fs.existsSync(frameFile(g))) return g;
  }
  return -1;
}

const heroTime = (s, info) => Math.round((s.start + (s.end - s.start) * info.at) * 100) / 100;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

function main() {
  fs.mkdirSync(out, { recursive: true });
  if (args.film && path.resolve(args.film) !== path.join(out, 'film')) {
    fs.cpSync(path.resolve(args.film), path.join(out, 'film'), { recursive: true });
  }
  const shots = JSON.parse(fs.readFileSync(path.resolve(args.shots || path.join(renderDir, 'shots.json')), 'utf8'));
  const duration = shots.at(-1).end;
  if (args['print-hero-times']) {
    console.log(shots.map((s) => heroTime(s, SHOT_INFO[s.name] ?? { at: 0.5 })).join(','));
    return;
  }

  fs.mkdirSync(path.join(out, 'stills'), { recursive: true });
  const shotCards = [];
  shots.forEach((s, i) => {
    const info = SHOT_INFO[s.name] ?? { title: s.name, at: 0.5 };
    const T = heroTime(s, info);
    const hero = args.hero ? path.join(path.resolve(args.hero), `film-${T.toFixed(2).padStart(6, '0')}.png`) : '';
    const f = nearestFrame(Math.round(T * fps));
    let still = '';
    if (hero && fs.existsSync(hero)) {
      still = `stills/${String(i + 1).padStart(2, '0')}-${s.name}.jpg`;
      ff(['-i', hero, '-vf', 'scale=1280:-2', '-q:v', '3', path.join(out, still)]);
    } else if (f >= 0) {
      still = `stills/${String(i + 1).padStart(2, '0')}-${s.name}.jpg`;
      ff(['-i', frameFile(f), '-q:v', '3', path.join(out, still)]);
    }
    shotCards.push({ ...s, ...info, index: i + 1, still });
  });

  fs.mkdirSync(path.join(out, 'assets'), { recursive: true });
  const assetCards = ASSETS.map((a) => {
    const src = a.thumb && path.join(assetStills, a.thumb);
    let thumb = '';
    if (src && fs.existsSync(src)) {
      thumb = `assets/${a.id}.jpg`;
      ff(['-i', src, '-vf', 'scale=720:-2', '-q:v', '4', path.join(out, thumb)]);
    }
    return { ...a, thumb };
  });

  let video = '';
  let poster = shotCards.find((c) => c.name === 'hand-reveal')?.still || shotCards.find((c) => c.still)?.still || '';
  const total = Math.round(duration * fps);
  const have = fs.existsSync(framesDir) ? fs.readdirSync(framesDir).filter((n) => /^f\d{5}\.png$/.test(n)).length : 0;
  if (args['keep-video'] && fs.existsSync(path.join(out, 'video/lego-rots-wip.mp4'))) {
    video = 'video/lego-rots-wip.mp4';
  } else if (!args['no-video'] && have >= total - 1) {
    fs.mkdirSync(path.join(out, 'video'), { recursive: true });
    video = 'video/lego-rots-wip.mp4';
    const audio = path.join(renderDir, 'audio.wav');
    const argv = ['-framerate', String(fps), '-i', path.join(framesDir, 'f%05d.png')];
    if (fs.existsSync(audio)) argv.push('-i', audio);
    argv.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-tune', 'film', '-pix_fmt', 'yuv420p', '-movflags', '+faststart');
    if (fs.existsSync(audio)) argv.push('-c:a', 'aac', '-b:a', '160k', '-shortest');
    argv.push(path.join(out, video));
    ff(argv);
  } else if (!args['no-video']) {
    console.error(`video skipped: ${have}/${total} frames rendered`);
  }

  const stamp = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  const li = (items, cls) => items.map((t) => `<li class="${cls}">${esc(t)}</li>`).join('\n          ');
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>LEGO Star Wars: Revenge of the Sith — Battle over Coruscant (work in progress)</title>
  <meta name="description" content="A brick-built Three.js short: the opening of Revenge of the Sith, LEGO Star Wars style. Work in progress." />
  <meta property="og:title" content="LEGO Star Wars: Battle over Coruscant — work in progress" />
  <meta property="og:description" content="The Revenge of the Sith opening, built brick by brick in Three.js." />
  ${poster ? `<meta property="og:image" content="${poster}" />` : ''}
  <meta name="theme-color" content="#05060a" />
  <style>
    :root { --bg: #05060a; --panel: #0d1018; --line: #1d2330; --text: #e9ecf3; --dim: #9aa3b5; --gold: #ffd43b; --red: #e3000b; --blue: #3fa9ff; }
    * { box-sizing: border-box; }
    html { background: var(--bg); }
    body { margin: 0; color: var(--text); font: 16px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
      background: radial-gradient(1200px 600px at 70% -10%, #16213d 0%, transparent 60%), radial-gradient(900px 500px at -10% 30%, #1d1030 0%, transparent 55%), var(--bg); }
    .wrap { max-width: 1100px; margin: 0 auto; padding: max(18px, env(safe-area-inset-top)) 16px 64px; }
    header { padding: 12px 0 18px; }
    .studs { display: flex; gap: 6px; margin-bottom: 14px; }
    .studs i { width: 18px; height: 18px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #ffe680, var(--gold) 55%, #c79a00); box-shadow: 0 2px 0 #8a6a00; }
    .studs i:nth-child(2) { background: radial-gradient(circle at 35% 30%, #ff6b6b, var(--red) 55%, #9a0008); box-shadow: 0 2px 0 #6a0006; }
    .studs i:nth-child(3) { background: radial-gradient(circle at 35% 30%, #9fd4ff, var(--blue) 55%, #1567b0); box-shadow: 0 2px 0 #0d4577; }
    .kicker { color: var(--gold); font-weight: 700; letter-spacing: .14em; text-transform: uppercase; font-size: 12px; }
    h1 { font-size: clamp(26px, 6vw, 44px); line-height: 1.1; margin: 6px 0 10px; letter-spacing: -.01em; }
    h1 .sub { display: block; color: var(--gold); font-size: .62em; margin-top: 6px; }
    .lede { color: var(--dim); margin: 0 0 14px; max-width: 760px; }
    .meta { display: flex; flex-wrap: wrap; gap: 8px; }
    .pill { font-size: 12px; color: var(--dim); border: 1px solid var(--line); background: var(--panel); border-radius: 999px; padding: 4px 10px; }
    .pill b { color: var(--text); font-weight: 600; }
    .player { margin: 8px 0 14px; border-radius: 14px; overflow: hidden; background: #000; border: 1px solid var(--line); box-shadow: 0 20px 60px rgba(0,0,0,.5); }
    .player video, .player img { display: block; width: 100%; height: auto; }
    .note { color: var(--dim); font-size: 13px; margin: 0 0 18px; }
    .btns { display: flex; flex-wrap: wrap; gap: 10px; margin: 0 0 28px; }
    .btn { display: inline-flex; align-items: center; gap: 8px; text-decoration: none; color: #111; background: var(--gold); font-weight: 700; padding: 11px 16px; border-radius: 10px; }
    .btn.alt { background: transparent; color: var(--text); border: 1px solid var(--line); font-weight: 600; }
    h2 { font-size: 20px; margin: 34px 0 12px; }
    h2 small { color: var(--dim); font-weight: 500; font-size: 13px; margin-left: 6px; }
    .grid { display: grid; gap: 14px; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }
    .card { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
    .card img { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; background: #000; }
    .card .body { padding: 10px 12px 12px; }
    .card .row { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
    .card h3 { font-size: 15px; margin: 0; }
    .card .t { color: var(--dim); font-size: 12px; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .card p { color: var(--dim); font-size: 13px; margin: 6px 0 0; }
    .card .line { color: var(--text); font-size: 13px; margin: 6px 0 0; }
    .card .line b { color: var(--gold); font-weight: 600; }
    .card a.go { display: inline-block; margin-top: 8px; font-size: 13px; color: var(--blue); text-decoration: none; }
    .assets .card img { aspect-ratio: 4 / 3; }
    .ph { display: grid; place-items: center; aspect-ratio: 4 / 3; background: repeating-linear-gradient(45deg, #0f131c, #0f131c 10px, #121826 10px, #121826 20px); color: var(--dim); font-size: 13px; }
    ul.status { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; }
    ul.status li { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 9px 12px 9px 38px; position: relative; font-size: 14px; }
    ul.status li::before { position: absolute; left: 12px; top: 9px; font-weight: 800; }
    li.done::before { content: "✓"; color: #46d37e; }
    li.doing::before { content: "◐"; color: var(--gold); }
    li.next::before { content: "○"; color: var(--dim); }
    footer { margin-top: 40px; color: var(--dim); font-size: 12px; }
    footer a { color: var(--dim); }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <div class="studs"><i></i><i></i><i></i></div>
      <div class="kicker">Work in progress</div>
      <h1>LEGO Star Wars: Revenge of the Sith <span class="sub">Battle over Coruscant</span></h1>
      <p class="lede">The opening of Episode III, from the crawl to the hangar of the <em>Invisible Hand</em>, built brick by brick in Three.js. Every ship, minifigure, planet and sound is procedural: no downloaded models, textures or samples.</p>
      <div class="meta">
        <span class="pill">Length <b>${mmss(duration)}</b></span>
        <span class="pill">Shots <b>${shots.length}</b></span>
        <span class="pill">Updated <b>${esc(stamp)}</b></span>
        ${commit ? `<span class="pill">Build <b>${esc(commit)}</b></span>` : ''}
      </div>
    </header>

    <div class="player">
      ${video ? `<video poster="${poster}" controls playsinline preload="metadata">${args['video-url'] ? `<source src="${esc(args['video-url'])}" type="video/mp4" />` : ''}<source src="${video}" type="video/mp4" /></video>` : poster ? `<img src="${poster}" alt="Current cut" />` : ''}
    </div>
    <p class="note">${video ? 'Work-in-progress render of the current cut at 960×540 (turn the sound on). The final render will be 1080p with full motion blur.' : 'The work-in-progress video is still rendering. Shot stills are below.'}</p>
    <div class="btns">
      <a class="btn" href="film/index.html">Play in real time</a>
      <a class="btn alt" href="film/index.html?t=${shotCards.find((c) => c.name === 'longtake')?.start ?? 0}">Jump to the long take</a>
      <a class="btn alt" href="film/index.html?t=${shotCards.find((c) => c.name === 'landing')?.start ?? 0}">Jump to the hangar</a>
    </div>
    <p class="note">The real-time version renders live in your browser; it is heavy, so a desktop GPU is best. Tap or press space to pause.</p>

    <h2>Shot list <small>tap a shot to watch it live</small></h2>
    <div class="grid">
      ${shotCards
        .map(
          (c) => `<div class="card">
        ${c.still ? `<a href="film/index.html?t=${c.start.toFixed(2)}"><img loading="lazy" src="${c.still}" alt="${esc(c.title)}" /></a>` : ''}
        <div class="body">
          <div class="row"><h3>${c.index}. ${esc(c.title)}</h3><span class="t">${mmss(c.start)}–${mmss(c.end)}</span></div>
          ${c.note ? `<p>${esc(c.note)}</p>` : ''}
          ${(c.lines ?? []).map((l) => `<p class="line"><b>${esc(l.who)}:</b> ${esc(l.text)}</p>`).join('')}
        </div>
      </div>`,
        )
        .join('\n      ')}
    </div>

    <h2>Assets <small>tap to open a live 3D turntable</small></h2>
    <div class="grid assets">
      ${assetCards
        .map(
          (a) => `<a class="card" style="text-decoration:none;color:inherit" href="film/index.html?lab=${encodeURIComponent(a.id)}&bg=${a.bg}">
        ${a.thumb ? `<img loading="lazy" src="${a.thumb}" alt="${esc(a.title)}" />` : `<div class="ph">live turntable</div>`}
        <div class="body"><div class="row"><h3>${esc(a.title)}</h3></div></div>
      </a>`,
        )
        .join('\n      ')}
    </div>

    <h2>Progress</h2>
    <ul class="status">
          ${li(DONE, 'done')}
          ${li(DOING, 'doing')}
          ${li(NEXT, 'next')}
    </ul>

    <footer>
      Fan-made, non-commercial. LEGO and Star Wars are trademarks of their owners; this project uses no official assets.
    </footer>
  </div>
</body>
</html>
`;
  fs.writeFileSync(path.join(out, 'index.html'), html);
  console.error(`site → ${out} (${shotCards.filter((c) => c.still).length} stills, ${assetCards.filter((a) => a.thumb).length} asset thumbs${video ? ', video' : ''})`);
}

main();
