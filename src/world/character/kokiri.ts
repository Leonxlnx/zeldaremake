/**
 * Kokiri kid (~1.15 m): same rig as Link with a near-black green sleeveless tunic, rope belt,
 * dark boots to the knee, an auburn bob under a green headband, brown eyes, pointed ears.
 * `variant` nudges the hair/skin tint and the headband so the kids are not clones.
 */
import { BoxGeometry, Color, CylinderGeometry, MeshStandardMaterial, TorusGeometry } from 'three';
import { merge, ovalLathe, place } from './geometry';
import { CHAR_COLORS, matte } from './palette';
import { beginTally, buildArms, buildFace, buildHair, buildLegs, buildNeck, endTally, part, type Character } from './link';
import { buildRig, KOKIRI_PROPORTIONS } from './rig';

const variantMats = new Map<string, MeshStandardMaterial>();
function tinted(key: 'kidHair' | 'kidSkin' | 'kidHeadband' | 'kidTunic', variant: number, hueShift: number, lightScale: number): MeshStandardMaterial {
  const id = `${key}:${variant}`;
  let m = variantMats.get(id);
  if (!m) {
    const c = new Color(CHAR_COLORS[key]);
    const hsl = { h: 0, s: 0, l: 0 };
    c.getHSL(hsl);
    c.setHSL((hsl.h + hueShift + 1) % 1, hsl.s, Math.min(1, hsl.l * lightScale));
    m = new MeshStandardMaterial({ color: c, roughness: 0.9, metalness: 0 });
    m.name = `char-${key}-${variant}`;
    variantMats.set(id, m);
  }
  return m;
}

export function createKokiri(variant: number): Character {
  beginTally();
  const rig = buildRig(KOKIRI_PROPORTIONS, `kokiri-${variant}`);
  const p = rig.props;
  const skin = tinted('kidSkin', variant, 0, 1 + 0.06 * ((variant % 3) - 1));
  const tunic = tinted('kidTunic', variant, 0.01 * (variant % 2), 1 + 0.12 * (variant % 2));
  const hair = tinted('kidHair', variant, -0.01 * (variant % 3), 1 - 0.1 * (variant % 2));
  buildLegs(rig, { skin, boot: matte('kidBoot'), cuff: null, shaftTop: p.kneeY - p.ankleY - 0.02 });
  buildArms(rig, { skin, sleeve: null });
  buildNeck(rig, skin);
  // sleeveless tunic: one piece from the ragged hem to the shoulders (hips joint) + upper on chest
  const hl = (y: number) => y - p.hipY;
  const cl = (y: number) => y - p.chestY;
  part(
    rig.hips,
    ovalLathe(
      [
        [0.13, hl(0.38)],
        [0.115, hl(0.47)],
        [0.102, hl(0.55)],
        [0.1, hl(0.6)],
      ],
      { segments: 22, scaleZ: 0.78, raggedHem: 0.025, seed: 21 + variant },
    ),
    tunic,
    'kid-tunic-skirt',
  );
  part(
    rig.chest,
    ovalLathe(
      [
        [0.098, cl(0.57)],
        [0.104, cl(0.66)],
        [0.115, cl(0.74)],
        [0.112, cl(0.79)],
        [0.07, cl(0.815)],
        [0.05, cl(0.83)],
      ],
      { segments: 22, scaleZ: 0.74 },
    ),
    tunic,
    'kid-tunic-upper',
  );
  // rope belt (twisted look from two thin tori)
  const rope = merge([
    place(new TorusGeometry(0.106, 0.009, 6, 26), 0, hl(0.575), 0, [Math.PI / 2, 0, 0], [1, 1, 0.8]),
    place(new TorusGeometry(0.106, 0.007, 6, 26), 0, hl(0.59), 0, [Math.PI / 2, 0, 0], [1, 1, 0.8]),
    // knot + hanging ends at the front
    place(new CylinderGeometry(0.008, 0.008, 0.07, 6), 0.02, hl(0.545), 0.088, [0.2, 0, 0.15]),
    place(new CylinderGeometry(0.008, 0.008, 0.06, 6), -0.015, hl(0.55), 0.09, [0.2, 0, -0.1]),
  ]);
  part(rig.hips, rope, matte('kidRope'), 'kid-rope-belt', false);
  buildFace(rig, { skin, iris: matte('irisKid', { roughness: 0.3 }), earLength: 0.07 });
  buildHair(rig, hair, 'bob');
  // green headband around the forehead
  const band = tinted('kidHeadband', variant, 0.03 * (variant % 3), 1);
  part(rig.head, place(new TorusGeometry(p.headRadius * 1.1, 0.011, 6, 26), 0, 0.032, 0.004, [Math.PI / 2 - 0.12, 0, 0], [1, 1, 0.98]), band, 'kid-headband', false);
  // a small pouch on the belt for variety
  if (variant % 2 === 1) part(rig.hips, place(new BoxGeometry(0.05, 0.05, 0.03), -0.09, hl(0.53), 0.04, [0, 0.4, 0]), matte('leatherDark'), 'kid-pouch', false);
  // the first kid holds a Deku Stick in the right hand like a staff (butt near the ground)
  if (variant === 0) {
    const handY = -p.forearm - 0.02;
    const stick = merge([
      place(new CylinderGeometry(0.011, 0.014, 0.95, 7), 0, handY - 0.02, 0.03),
      // a knobbly tip
      place(new CylinderGeometry(0.017, 0.011, 0.05, 7), 0, handY + 0.44, 0.03),
    ]);
    part(rig.elbowR, place(stick, 0, 0, 0, [0.1, 0, 0.05]), matte('stick'), 'deku-stick');
  }
  rig.root.userData.character = 'kokiri';
  return { kind: 'kokiri', rig, group: rig.root, triangles: endTally(), height: 1.15 };
}
