import { Box3, Mesh, Quaternion, Vector3, type Object3D } from 'three';
import { DEFAULT_LENS, type Lens, type Pipeline } from '../render/pipeline';
import type { FilmUI } from '../ui';
import { World } from './world';
import { FILM_DURATION, SHOTS, scheduleBattle, shotAt, type Cam } from './shots';
import { renderSoundtrack } from '../audio/soundtrack';

/** Where a hero's head (with hair) lands in the picture at one instant: NDC, the 2.39:1 frame edge is ±1. */
export interface HeadProbe {
  who: string;
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface Film {
  duration: number;
  renderAt(t: number, o?: { subframes?: number; shutter?: number; fps?: number }): void;
  /** framing QA: pose time T without rendering and project the visible heroes' head + hair vertices */
  probeHeads(T: number): { shot: string; heads: HeadProbe[] };
  /** contact QA: the hangar deck height and the lowest world-space point of each visible hero, ship, droid, wreck part */
  probeContact(T: number): { shot: string; deck: number | null; low: Record<string, number> };
  /** motion QA: every actor's world transform at T (no rendering) */
  probeActors(T: number): { shot: string; cam: { pos: number[]; target: number[]; fov: number }; actors: Record<string, [number, number, number, number, number, number, number, number]> };
  /** camera QA: the pose the shot asks for at T (no rendering) */
  probeCamera(T: number): { shot: string; pos: number[]; target: number[]; fov: number; roll: number; ships: Record<string, { pos: number[]; quat: number[]; visible: boolean }> };
  /** caption QA: apply the overlays for time T (no rendering) and report the caption box against the page and picture */
  captionAt(T: number): { text: string; box: number[]; pic: number[]; page: number[]; font: number };
  shots(): { name: string; start: number; end: number; lines: { who: string; text: string }[] }[];
  renderAudio(): Promise<string>;
}

function shown(o: Object3D): boolean {
  for (let p: Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}

function halton(i: number, base: number): number {
  let f = 1, r = 0;
  for (let k = i; k > 0; k = Math.floor(k / base)) {
    f /= base;
    r += f * (k % base);
  }
  return r;
}

export async function createFilm(pipeline: Pipeline, ui: FilmUI): Promise<Film> {
  const w = new World(pipeline);
  // ?debug=1: the world, plus an optional camera override (framing sweeps) called after each shot's pose
  const debug = new URLSearchParams(location.search).get('debug') === '1';
  // ?ca=<strength>: chromatic-aberration override for A/B tests (the film's lens default otherwise)
  const caParam = new URLSearchParams(location.search).get('ca');
  const caOverride = caParam === null ? null : Number(caParam);
  const dbg = window as unknown as { __LSW_WORLD__?: World; __LSW_CAM__?: (cam: Cam, shot: string, t: number, T: number) => Cam | undefined };
  if (debug) dbg.__LSW_WORLD__ = w;
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
  for (const p of [...w.obiwanShip.breakables, ...w.anakinShip.breakables]) {
    remember(p);
    p.userData.home = { pos: p.position.clone(), quat: p.quaternion.clone() };
  }
  remember(w.obiwanShip.canopy);
  remember(w.anakinShip.canopy);

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
    let cam = shot.pose(w, t, T);
    if (debug && dbg.__LSW_CAM__) cam = dbg.__LSW_CAM__(cam, shot.name, t, T) ?? cam;
    // animated ray shields (scanlines / flicker)
    if (w.hand.group.visible) (w.hand.group.userData.animate as ((t: number) => void) | undefined)?.(T);
    if (w.hangar.group.visible) (w.hangar.group.userData.animate as ((t: number) => void) | undefined)?.(T);
    w.fx.update(T, pipeline.height / 804, cam.pos, shot.laserClear ?? 0);
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
    const { shot, t, index } = shotAt(T);
    // subtitles; a line with t0 < 0 starts over the end of the previous shot (its caption with it)
    let sub: { who: string; text: string; a: number } | null = null;
    for (const l of shot.lines ?? []) {
      if (t >= l.t0 && t <= l.t1) sub = { who: l.who, text: l.text, a: Math.min(1, (t - l.t0) / 0.08, (l.t1 - t) / 0.08) };
    }
    const next = SHOTS[index + 1];
    for (const l of next?.lines ?? []) {
      const tn = T - next.start!;
      if (l.t0 < 0 && tn >= l.t0) sub = { who: l.who, text: l.text, a: Math.min(1, (tn - l.t0) / 0.08) };
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
      if (caOverride !== null) lens.ca = caOverride;
      if (first.card) {
        pipeline.renderer.setRenderTarget(null);
        pipeline.renderer.setClearColor(0x000000, 1);
        pipeline.renderer.clear();
        return;
      }
      const shot = shotAt(T).shot;
      const n = (o.subframes ?? 1) > 1 ? Math.max(o.subframes!, shot.blur ?? 1) : 1;
      const shutter = shot.shutter ?? o.shutter ?? 0.5;
      const fps = o.fps ?? 24;
      let s0 = shot.start ?? 0, s1 = s0 + shot.dur;
      for (const c of shot.cuts ?? []) {
        const cT = (shot.start ?? 0) + c;
        if (cT <= T) s0 = Math.max(s0, cT);
        else s1 = Math.min(s1, cT);
      }
      pipeline.render(w.scene, camera, lens, {
        time: T,
        subframes: n,
        setSub: (k, count) => {
          // samples stay inside this frame's shot (and setup, for cuts inside a shot), or the first frame after a cut is a double exposure
          const Ts = Math.min(s1 - 1e-6, Math.max(s0, T + ((k + 0.5) / count - 0.5) * (shutter / fps)));
          const p = pose(Ts);
          applyCamera(p.cam);
          // the shutter sub-frames double as supersampling: jitter each by a sub-pixel Halton offset
          camera.setViewOffset(pipeline.width, pipeline.height, halton(k + 1, 2) - 0.5, halton(k + 1, 3) - 0.5, pipeline.width, pipeline.height);
        },
      });
      camera.clearViewOffset();
    },
    probeHeads(T) {
      const p = pose(T);
      applyCamera(p.cam);
      w.scene.updateMatrixWorld(true);
      const heads: HeadProbe[] = [];
      const v = new Vector3();
      for (const [who, fig] of [['anakin', w.anakin], ['obiwan', w.obiwan]] as const) {
        if (!shown(fig.head)) continue;
        const r = { who, top: -Infinity, bottom: Infinity, left: Infinity, right: -Infinity };
        fig.head.traverse((o) => {
          if (!(o instanceof Mesh) || !o.visible) return;
          const pos = o.geometry.getAttribute('position');
          for (let i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).project(camera);
            if (v.z > 1) continue;
            r.top = Math.max(r.top, v.y);
            r.bottom = Math.min(r.bottom, v.y);
            r.left = Math.min(r.left, v.x);
            r.right = Math.max(r.right, v.x);
          }
        });
        if (r.right >= -1 && r.left <= 1 && r.top >= -1 && r.bottom <= 1) heads.push(r);
      }
      return { shot: shotAt(T).shot.name, heads };
    },
    probeActors(T) {
      const p = pose(T);
      const named: [string, Object3D][] = [
        ['venator', w.venator.group], ['hand', w.hand.group], ['anakinShip', w.anakinShip.group], ['obiwanShip', w.obiwanShip.group],
        ['anakin', w.anakin.group], ['obiwan', w.obiwan.group], ['zap', w.zap],
        ...w.vultures.map((v, i) => [`vulture${i}`, v.group] as [string, Object3D]),
        ...w.crawlers.map((v, i) => [`crawler${i}`, v.group] as [string, Object3D]),
        ...w.arcs.map((v, i) => [`arc${i}`, v.group] as [string, Object3D]),
        ...w.missiles.map((v, i) => [`missile${i}`, v.group] as [string, Object3D]),
        ...w.buzz.map((v, i) => [`buzz${i}`, v.group] as [string, Object3D]),
        ...w.droids.map((v, i) => [`droid${i}`, v.group] as [string, Object3D]),
        ...w.sabers.map((v, i) => [`saber${i}`, v.group] as [string, Object3D]),
        ...w.fleet.map((v, i) => [`fleet${i}`, v.root] as [string, Object3D]),
      ];
      const actors: Record<string, [number, number, number, number, number, number, number, number]> = {};
      const pv = new Vector3(), qv = new Quaternion();
      for (const [k, o] of named) {
        let vis = o.visible;
        for (let q = o.parent; q && vis; q = q.parent) vis = q.visible;
        o.updateWorldMatrix(true, false);
        o.matrixWorld.decompose(pv, qv, new Vector3());
        actors[k] = [pv.x, pv.y, pv.z, qv.x, qv.y, qv.z, qv.w, vis ? 1 : 0];
      }
      return { shot: shotAt(T).shot.name, cam: { pos: p.cam.pos.toArray(), target: p.cam.target.toArray(), fov: p.cam.fov }, actors };
    },
    probeCamera(T) {
      const p = pose(T);
      const c = p.cam;
      const ships: Record<string, { pos: number[]; quat: number[]; visible: boolean }> = {};
      for (const [k, sh] of [['anakin', w.anakinShip], ['obiwan', w.obiwanShip], ['anakinFig', w.anakin], ['obiwanFig', w.obiwan]] as const) {
        sh.group.updateMatrixWorld(true);
        ships[k] = { pos: sh.group.getWorldPosition(new Vector3()).toArray(), quat: sh.group.getWorldQuaternion(new Quaternion()).toArray(), visible: sh.group.visible };
      }
      return { shot: shotAt(T).shot.name, pos: c.pos.toArray(), target: c.target.toArray(), fov: c.fov, roll: c.roll ?? 0, ships };
    },
    probeContact(T) {
      pose(T);
      w.scene.updateMatrixWorld(true);
      const deckA = w.hangar.group.visible ? w.hangar.anchors['landingA'] : undefined;
      const deck = deckA ? deckA.getWorldPosition(new Vector3()).y : null;
      const box = new Box3();
      const lowest = (o: Object3D) => (shown(o) ? box.setFromObject(o, true).min.y : NaN);
      const low: Record<string, number> = {
        anakin: lowest(w.anakin.group),
        obiwan: lowest(w.obiwan.group),
        anakinShip: lowest(w.anakinShip.group),
        obiwanShip: lowest(w.obiwanShip.group),
      };
      // the hull and the parts still attached, without the three wing parts it sheds on impact
      const shed = new Set<Object3D>(w.obiwanShip.breakables.slice(0, 3));
      let hull = Infinity;
      const v = new Vector3();
      const visit = (o: Object3D) => {
        if (!o.visible || shed.has(o)) return;
        if (o instanceof Mesh) {
          if ((o as Mesh & { isInstancedMesh?: boolean }).isInstancedMesh) hull = Math.min(hull, box.setFromObject(o, true).min.y);
          else {
            const pos = o.geometry.getAttribute('position');
            for (let i = 0; i < pos.count; i++) hull = Math.min(hull, v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).y);
          }
        }
        for (const c of o.children) visit(c);
      };
      if (shown(w.obiwanShip.group)) visit(w.obiwanShip.group);
      low.obiwanHull = hull === Infinity ? NaN : hull;
      w.obiwanShip.breakables.slice(0, 3).forEach((p, i) => (low[`wreck${i}`] = lowest(p)));
      w.droids.forEach((d, i) => (low[`droid${i}`] = lowest(d.group)));
      return { shot: shotAt(T).shot.name, deck, low };
    },
    captionAt(T) {
      overlays(T);
      const r = ui.sub.getBoundingClientRect();
      const L = ui.layout;
      return {
        text: ui.sub.style.opacity === '0' ? '' : (ui.sub.textContent ?? ''),
        box: [r.left, r.top, r.right, r.bottom],
        pic: [L.left, L.top, L.left + L.width, L.top + L.height],
        page: [L.pageW, L.pageH],
        font: parseFloat(ui.sub.style.fontSize),
      };
    },
    shots: () => SHOTS.map((s) => ({ name: s.name, start: s.start!, end: s.start! + s.dur, lines: (s.lines ?? []).map((l) => ({ who: l.who, text: l.text })) })),
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
