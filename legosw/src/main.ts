import { Pipeline } from './render/pipeline';
import { FilmUI } from './ui';
import { Lab } from './lab';
import { createFilm, type Film } from './film/film';
import { ASSETS } from './assets';
import { Controls, Loading } from './controls';

/**
 * Entry point. Modes:
 *   (default)          the film, playing in real time from t=0 (click / space to pause)
 *   ?t=12.5            start the film at a time
 *   ?lab=<asset>       turntable of one asset (&bg=studio|space, &yaw, &pitch, &dist)
 *   ?capture=1         externally driven (window.__LSW__) — used by scripts/*.mjs
 */
const params = new URLSearchParams(location.search);
const capture = params.get('capture') === '1';
const labId = params.get('lab');
const app = document.getElementById('app')!;
const ui = new FilmUI(document.getElementById('film-ui')!);
const samples = Number(params.get('msaa') ?? 4);
const loading = capture ? null : new Loading();
// keep captions clear of the transport bar in the realtime viewer (?reserve= lets caption QA reproduce it under capture)
ui.reserve = capture ? Number(params.get('reserve') ?? 0) : 64;

let pipeline!: Pipeline;
try {
  pipeline = new Pipeline(app, { width: 16, height: 16, samples });
} catch (e) {
  loading?.fail(e);
  throw e;
}
pipeline.renderer.domElement.addEventListener('webglcontextlost', () => loading?.fail(new Error('the graphics context was lost (GPU reset or out of memory)')));
function fit() {
  const L = ui.fit(pipeline.renderer.domElement, innerWidth, innerHeight);
  pipeline.setSize(L.width, L.height);
}
fit();
// under capture the harness owns the viewport; screenshot tooling may emit transient resizes
if (!capture) addEventListener('resize', fit);

interface Api {
  ready: Promise<void>;
  mode: 'lab' | 'film';
  info(): Record<string, unknown>;
  assets(): string[];
  labPose(yaw: number, pitch: number, dist: number, t: number): void;
  labRender(t: number): void;
  duration(): number;
  shots(): { name: string; start: number; end: number; lines: { who: string; text: string }[] }[];
  renderAt(t: number, subframes?: number, shutter?: number, fps?: number): { ms: number };
  probeHeads(t: number): ReturnType<Film['probeHeads']> | null;
  probeContact(t: number): ReturnType<Film['probeContact']> | null;
  captionAt(t: number): ReturnType<Film['captionAt']> | null;
  renderAudio(): Promise<string>;
}

declare global {
  interface Window {
    __LSW__?: Api;
  }
}

let lab: Lab | null = null;
let film: Film | null = null;

async function boot(): Promise<void> {
  if (labId) {
    lab = new Lab(pipeline, labId, (params.get('bg') as 'studio' | 'space') ?? 'studio');
    lab.pose(Number(params.get('yaw') ?? 35), Number(params.get('pitch') ?? 18), Number(params.get('dist') ?? 1), 0);
    ui.setCards(0, 0);
    loading?.done();
    if (!capture) {
      let yaw = Number(params.get('yaw') ?? 35);
      const t0 = performance.now();
      const loop = () => {
        const t = (performance.now() - t0) / 1000;
        if (params.get('spin') !== '0') yaw += 0.25;
        lab!.pose(yaw, Number(params.get('pitch') ?? 18), Number(params.get('dist') ?? 1), t);
        lab!.render(t);
        requestAnimationFrame(loop);
      };
      loop();
    }
    return;
  }
  loading?.status('Building the fleet… (bricks, ships and minifigures are generated in the browser)');
  await new Promise((r) => setTimeout(r, 30));
  film = await createFilm(pipeline, ui);
  if (!capture) {
    const f = film;
    let t = Math.max(0, Math.min(f.duration, Number(params.get('t') ?? 0)));
    let last = performance.now();
    let paused = false;
    let seeked = false;
    const seek = (to: number) => {
      t = Math.max(0, Math.min(f.duration - 1e-3, to));
      seeked = true;
    };
    // the soundtrack is pre-rendered next to a published build (soundtrack.m4a) and optional; it starts from
    // the sound button (a user gesture), and while it plays its clock drives the picture so a slow GPU
    // drops frames instead of drifting out of sync
    const audio = new Audio('./soundtrack.m4a');
    audio.preload = 'auto';
    let audioReady = false;
    let soundOn = false;
    audio.addEventListener('loadedmetadata', () => (audioReady = true));
    audio.addEventListener('error', () => (audioReady = soundOn = false));
    const toggleSound = () => {
      soundOn = audioReady && !soundOn;
      if (!soundOn) return audio.pause();
      audio.currentTime = t;
      if (!paused) audio.play().catch(() => (soundOn = false));
    };
    const controls = new Controls({
      duration: f.duration,
      shots: f.shots(),
      time: () => t,
      seek,
      paused: () => paused,
      setPaused: (p) => (paused = p),
      sound: { available: () => audioReady, on: () => soundOn, toggle: toggleSound },
    });
    addEventListener('keydown', (e) => {
      if (e.code === 'Space') paused = !paused;
      else if (e.code === 'ArrowRight') seek(t + 2);
      else if (e.code === 'ArrowLeft') seek(t - 2);
      else if (e.code === 'Home') {
        seek(0);
        paused = false;
      } else if (e.code === 'Period') {
        paused = true;
        seek(t + 1 / 24);
      } else if (e.code === 'Comma') {
        paused = true;
        seek(t - 1 / 24);
      } else if (e.code === 'KeyM') toggleSound();
      else return;
      e.preventDefault();
    });
    addEventListener('click', () => (paused = !paused));
    // the first frame is on screen before the panel goes, so the page never shows an unexplained black canvas
    f.renderAt(t);
    loading?.done();
    const loop = () => {
      const now = performance.now();
      // while the soundtrack plays it is the clock; otherwise wall time, capped so a stall does not jump
      const driven = soundOn && !paused && !audio.paused && !audio.ended;
      if (!paused && !driven) t += Math.min(0.1, (now - last) / 1000);
      last = now;
      if (t > f.duration) seek(0);
      if (soundOn) {
        if (paused) {
          if (!audio.paused) audio.pause();
        } else if (audio.paused || audio.ended) {
          audio.currentTime = t;
          audio.play().catch(() => (soundOn = false));
        } else if (seeked) audio.currentTime = t;
        else t = audio.currentTime;
      }
      seeked = false;
      f.renderAt(t);
      controls.update();
      requestAnimationFrame(loop);
    };
    loop();
  }
}

const ready = boot();
ready.catch((e) => loading?.fail(e));

window.__LSW__ = {
  ready,
  mode: labId ? 'lab' : 'film',
  info: () => ({
    width: pipeline.width,
    height: pipeline.height,
    calls: pipeline.renderer.info.render.calls,
    triangles: pipeline.renderer.info.render.triangles,
    programs: pipeline.renderer.info.programs?.length ?? 0,
    geometries: pipeline.renderer.info.memory.geometries,
    lastRenderMs: pipeline.lastRenderMs,
  }),
  assets: () => Object.keys(ASSETS),
  labPose: (yaw, pitch, dist, t) => lab?.pose(yaw, pitch, dist, t),
  labRender: (t) => {
    lab?.render(t);
    pipeline.sync();
  },
  duration: () => film?.duration ?? 0,
  shots: () => film?.shots() ?? [],
  renderAt: (t, subframes = 1, shutter = 0.5, fps = 24) => {
    const t0 = performance.now();
    film?.renderAt(t, { subframes, shutter, fps });
    pipeline.sync();
    return { ms: performance.now() - t0 };
  },
  probeHeads: (t) => film?.probeHeads(t) ?? null,
  probeContact: (t) => film?.probeContact(t) ?? null,
  captionAt: (t) => film?.captionAt(t) ?? null,
  renderAudio: async () => (film ? film.renderAudio() : ''),
};
