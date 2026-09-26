import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Group, Mesh, MeshBasicMaterial, Object3D } from 'three';
import { Builder } from '../core/builder';
import { lathe, profile } from '../core/geom';

/**
 * Lightsaber: a moulded metal hilt (fits the minifig hand's bar grip along local Y) and an
 * energy blade — a white-hot core inside a coloured bloom sheath — that extends on ignition.
 */
export interface Lightsaber {
  group: Group;
  blade: Object3D;
  setIgnite(v: number, flicker?: number): void;
}

export function lightsaber(color: 'blue' | 'green' = 'blue', o: { length?: number } = {}): Lightsaber {
  const L = o.length ?? 4.6;
  const group = new Group();
  group.name = 'lightsaber';
  const b = new Builder({ seed: 9 });
  // hilt along +Y, centred at the grip (y = 0)
  const hilt = profile(
    [
      [0, 0.78],
      [0.13, 0.78],
      [0.15, 0.72],
      [0.15, 0.5],
      [0.12, 0.47],
      [0.12, -0.55],
      [0.14, -0.58],
      [0.14, -0.72],
      [0.1, -0.78],
      [0, -0.78],
    ],
    40,
  );
  b.lathe('flatSilver', hilt, { radial: 20 });
  for (let i = 0; i < 6; i++) b.cyl('black', 0, -0.4 + i * 0.13, 0, 0.13, 0.06, { radial: 20, c: 0.01 });
  b.box('black', 0.13, 0.62, 0, 0.06, 0.14, 0.08, { c: 0.01 });
  b.cyl('glowRed', 0.12, 0.35, 0, 0.025, 0.05, { axis: 'x', radial: 8, c: 0.005 });
  group.add(b.build('hilt').group);
  const blade = new Object3D();
  blade.position.y = 0.78;
  group.add(blade);
  const cap = lathe(profile([[0, 1.0], [0.6, 0.97], [0.95, 0.9], [1, 0.8], [1, 0.0], [0.9, -0.02], [0, -0.02]], 50), 16);
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(cap.pos, 3));
  geo.setAttribute('normal', new BufferAttribute(cap.nrm, 3));
  // deep, saturated sheath around a thin blue-white core: ACES desaturates very bright colours, so the
  // core stays moderate and the colour comes from the sheath and its bloom
  // HDR budget after the core and sheath add up: centre ≈ (0.3, 0.9, 4) → light blue, sheath ≈ (0.04, 0.25, 1.8) → deep blue
  const hue = color === 'blue' ? new Color(0.02, 0.14, 1.0) : new Color(0.1, 1.0, 0.14);
  const coreCol = color === 'blue' ? new Color(0.1, 0.26, 1.0) : new Color(0.3, 1.0, 0.34);
  const core = new Mesh(geo, new MeshBasicMaterial({ color: coreCol.multiplyScalar(2.4), toneMapped: false }));
  core.scale.set(0.065, L, 0.065);
  const glow = new Mesh(geo, new MeshBasicMaterial({ color: hue.clone().multiplyScalar(2.6), transparent: true, opacity: 0.7, blending: AdditiveBlending, depthWrite: false, toneMapped: false }));
  glow.scale.set(0.19, L * 1.03, 0.19);
  glow.renderOrder = 5;
  const glow2 = new Mesh(geo, new MeshBasicMaterial({ color: hue.clone().multiplyScalar(1.2), transparent: true, opacity: 0.45, blending: AdditiveBlending, depthWrite: false, toneMapped: false }));
  glow2.scale.set(0.46, L * 1.06, 0.46);
  glow2.renderOrder = 5;
  blade.add(core, glow, glow2);
  return {
    group,
    blade,
    setIgnite(v, flicker = 0) {
      const s = Math.max(0.0001, v);
      blade.visible = v > 0.001;
      blade.scale.set(1 + flicker * 0.06, s, 1 + flicker * 0.06);
    },
  };
}
