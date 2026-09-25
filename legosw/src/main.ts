import { Pipeline } from './render/pipeline';
import { FilmUI } from './ui';
import { Lab } from './lab';
import { createFilm, type Film } from './film/film';
import { ASSETS } from './assets';

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

const pipeline = new Pipeline(app, { width: 16, height: 16, samples });
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
  shots(): { name: string; start: number; end: number }[];
  renderAt(t: number, subframes?: number, shutter?: number, fps?: number): { ms: number };
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
  film = await createFilm(pipeline, ui);
  if (!capture) {
    let t = Number(params.get('t') ?? 0);
    let last = performance.now();
    let paused = false;
    addEventListener('keydown', (e) => {
      if (e.code === 'Space') paused = !paused;
      if (e.code === 'ArrowRight') t += 2;
      if (e.code === 'ArrowLeft') t = Math.max(0, t - 2);
    });
    addEventListener('click', () => (paused = !paused));
    const loop = () => {
      const now = performance.now();
      if (!paused) t += Math.min(0.1, (now - last) / 1000);
      last = now;
      if (t > film!.duration) t = 0;
      film!.renderAt(t);
      requestAnimationFrame(loop);
    };
    loop();
  }
}

const ready = boot();

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
  renderAudio: async () => (film ? film.renderAudio() : ''),
};
