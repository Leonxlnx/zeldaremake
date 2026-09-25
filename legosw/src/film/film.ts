import { Quaternion, Vector3 } from 'three';
import { DEFAULT_LENS, type Lens, type Pipeline } from '../render/pipeline';
import type { FilmUI } from '../ui';
import { World } from './world';
import { FILM_DURATION, SHOTS, scheduleBattle, shotAt, type Cam } from './shots';
import { renderSoundtrack } from '../audio/soundtrack';

export interface Film {
  duration: number;
  renderAt(t: number, o?: { subframes?: number; shutter?: number; fps?: number }): void;
  shots(): { name: string; start: number; end: number }[];
  renderAudio(): Promise<string>;
}

export async function createFilm(pipeline: Pipeline, ui: FilmUI): Promise<Film> {
  const w = new World(pipeline);
  // schedule every shot's time-pure effects, plus the background slugfest
  scheduleBattle(w, 19, SHOTS.find((s) => s.name === 'hangar-approach')!.start! + 4);
  for (const s of SHOTS) s.schedule?.(w, s.start!);
  w.fx.build();

  // homes of parts that shots detach / animate, so every frame starts from the same state
  const homes: { o: import('three').Object3D; pos: Vector3; quat: Quaternion; vis: boolean }[] = [];
  const remember = (o: import('three').Object3D) => homes.push({ o, pos: o.position.clone(), quat: o.quaternion.clone(), vis: o.visible });
  remember(w.r4.head);
  remember(w.r2.head);
  for (const b of w.buzz) remember(b.head);
  for (const p of w.obiwanShip.breakables) remember(p);
  for (const p of w.anakinShip.breakables) remember(p);

  const camera = w.camera;
  const lens: Lens = { ...DEFAULT_LENS };

  function pose(T: number): { cam: Cam; card: boolean } {
    for (const h of homes) {
      h.o.position.copy(h.pos);
      h.o.quaternion.copy(h.quat);
      h.o.visible = h.vis;
    }
    w.reset();
    w.space();
    const { shot, t } = shotAt(T);
    const cam = shot.pose(w, t, T);
    w.fx.update(T, pipeline.height / 804);
    return { cam, card: !!shot.card };
  }

  function applyCamera(cam: Cam): void {
    camera.position.copy(cam.pos);
    camera.up.set(0, 1, 0);
    camera.lookAt(cam.target);
    if (cam.roll) camera.rotateZ(cam.roll);
    camera.fov = cam.fov;
    camera.near = cam.near ?? 0.3;
    camera.far = 3e6;
    camera.aspect = pipeline.width / pipeline.height;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }

  function overlays(T: number): void {
    const { shot, t } = shotAt(T);
    // subtitles
    let sub: { who: string; text: string; a: number } | null = null;
    for (const l of shot.lines ?? []) {
      if (t >= l.t0 && t <= l.t1) sub = { who: l.who, text: l.text, a: Math.min(1, (t - l.t0) / 0.08, (l.t1 - t) / 0.08) };
    }
    ui.setSubtitle(sub?.who ?? null, sub?.text ?? null, sub?.a ?? 0);
    // cards and fades
    let fade = 0;
    let far = 0;
    let end = 0;
    if (shot.name === 'farfar') {
      fade = 1;
      far = Math.min(1, Math.max(0, (t - 0.4) / 0.8)) * Math.min(1, Math.max(0, (4.1 - t) / 0.7));
    } else if (shot.name === 'endcard') {
      fade = 1;
      end = Math.min(1, Math.max(0, (t - 0.3) / 0.8)) * Math.min(1, Math.max(0, (4.4 - t) / 0.6));
    } else {
      // short dips to black at the act changes
      const s = shot.start!;
      if (shot.name === 'crawl') fade = Math.max(0, 1 - (T - s) / 1.0);
      if (shot.name === 'landing') fade = Math.max(0, 1 - (T - s) / 0.25);
    }
    ui.setFade(fade);
    ui.setCards(far, end, '<div><div style="font-size:0.55em;letter-spacing:0.35em;color:#e9e3cf;margin-bottom:0.5em">EPISODE III</div>REVENGE OF THE SITH<div style="font-size:0.32em;letter-spacing:0.3em;color:#9aa3ad;margin-top:1.6em">A BRICK-BUILT BATTLE OVER CORUSCANT</div></div>');
  }

  return {
    duration: FILM_DURATION,
    renderAt(T, o = {}) {
      overlays(T);
      const first = pose(T);
      applyCamera(first.cam);
      Object.assign(lens, DEFAULT_LENS, first.cam.lens ?? {});
      if (first.card) {
        pipeline.renderer.setRenderTarget(null);
        pipeline.renderer.setClearColor(0x000000, 1);
        pipeline.renderer.clear();
        return;
      }
      const n = Math.max(1, Math.min(o.subframes ?? 1, shotAt(T).shot.blur ?? 1));
      const shutter = o.shutter ?? 0.5;
      const fps = o.fps ?? 24;
      pipeline.render(w.scene, camera, lens, {
        time: T,
        subframes: n,
        setSub: (k, count) => {
          const Ts = T + ((k + 0.5) / count - 0.5) * (shutter / fps);
          const p = pose(Ts);
          applyCamera(p.cam);
        },
      });
    },
    shots: () => SHOTS.map((s) => ({ name: s.name, start: s.start!, end: s.start! + s.dur })),
    renderAudio: () =>
      renderSoundtrack({
        shots: SHOTS,
        duration: FILM_DURATION,
        camAt: (() => {
          const cache = new Map<number, Vector3>();
          return (T: number) => {
            const k = Math.round(T * 5);
            let p = cache.get(k);
            if (!p) cache.set(k, (p = pose(k / 5).cam.pos.clone()));
            return p;
          };
        })(),
        lasers: w.fx.lasers.events,
        explosions: w.fx.explosions,
      }),
  };
}
