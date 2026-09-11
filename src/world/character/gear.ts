/** Original carrying gear on the existing chest joint. */
import { BoxGeometry, BufferGeometry, CylinderGeometry, Group, Material, Mesh, MeshStandardMaterial, Object3D, Raycaster, SphereGeometry, TorusGeometry, Vector3 } from 'three';
import { merge, place, sweep } from './geometry';
import { matte, shieldTexture } from './palette';
import { createWoodenShield } from './gear-geometry';
import type { Rig } from './rig';

type Attach = (parent: Object3D, geometry: BufferGeometry, material: Material, name: string, shadows?: boolean) => Mesh;

export function buildGear(rig: Rig, part: Attach): void {
  const cl = (y: number) => y - rig.props.chestY;
  // A softly packed leather bag sits against the back, behind the separately strapped shield.
  const pack = new SphereGeometry(1, 32, 24), positions = pack.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    positions.setXYZ(i, x * 0.138 * (1 + 0.025 * Math.sin(y * 6)), cl(0.610) + y * 0.160,
      -0.120 + z * 0.054 * (1 + 0.035 * Math.sin(y * 22 + x * 3)));
  }
  pack.computeVertexNormals();
  const leather = matte('packLeather');
  part(rig.chest, pack, leather, 'backpack');
  const surface = new Mesh(pack, leather), ray = new Raycaster(new Vector3(), new Vector3(0, 0, 1));
  const back = (x: number, y: number, gap = 0.0008) => {
    ray.ray.origin.set(x, cl(y), -0.3);
    const hit = ray.intersectObject(surface, false)[0];
    if (!hit) throw new Error('Pack seam must stay inside the leather silhouette');
    return new Vector3(x, cl(y), hit.point.z - gap);
  };
  const edge: Vector3[] = [];
  const side = [[0, 0.462], [0.061, 0.479], [0.106, 0.523], [0.128, 0.586],
    [0.124, 0.650], [0.094, 0.715], [0.041, 0.757], [0, 0.765]];
  for (const [x, y] of side) edge.push(back(x, y, 0.0018));
  for (const [x, y] of side.slice(1, -1).reverse()) edge.push(back(-x, y, 0.0018));
  edge.push(edge[0].clone());
  const seams: BufferGeometry[] = [];
  // Short separate stitches follow the fitted edge, batched into one mesh.
  for (let i = 1; i < edge.length; i++) {
    const length = edge[i - 1].distanceTo(edge[i]), count = Math.ceil(length / 0.012);
    for (let j = 0; j < count; j++) {
      const a = edge[i - 1].clone().lerp(edge[i], (j + 0.12) / count);
      const b = edge[i - 1].clone().lerp(edge[i], (j + 0.64) / count);
      // Refit line interpolation against the curved shell.
      seams.push(sweep([back(a.x, a.y + rig.props.chestY, 0.002), back(b.x, b.y + rig.props.chestY, 0.002)],
        [0.0009, 0.0009], { segments: 1, radial: 5, smooth: false, closeStart: true, closeTip: true }));
    }
  }
  part(rig.chest, merge(seams), matte('leatherStitch'), 'pack-stitches', false);
  const loops = [-1, 1].map(sign => place(new TorusGeometry(0.018, 0.004, 6, 18), sign * 0.091, cl(0.740), -0.137));
  part(rig.chest, merge(loops), matte('leatherDark'), 'pack-loops');

  const shield = new Group();
  shield.name = 'deku-shield';
  shield.position.set(0, cl(0.700), -0.204);
  shield.rotation.set(-0.12, Math.PI, 0.06);
  rig.chest.add(shield);
  const shape = createWoodenShield();
  const shieldMat = new MeshStandardMaterial({ map: shieldTexture(), color: 0xffffff, roughness: 0.9, metalness: 0 });
  shieldMat.name = 'char-shield';
  part(shield, shape.face, shieldMat, 'shield-face');
  part(shield, shape.shell, matte('shieldRim'), 'shield-back');
  // Kokiri Sword in its scabbard: from the left hip up past the right shoulder
  // the hilt clears the head beside the right ear so it reads from behind (reference A/D)
  const bottom = new Vector3(0.09, 0.52, -0.105);
  const top = new Vector3(-0.15, 0.905, -0.1);
  const axis = top.clone().sub(bottom);
  const len = axis.length();
  const dir = axis.clone().normalize();
  const roll = Math.atan2(-dir.x, dir.y);
  const mid = bottom.clone().lerp(top, 0.5);
  part(rig.chest, place(new BoxGeometry(0.046, len, 0.03), mid.x, cl(mid.y), mid.z, [0, 0, roll]), matte('scabbard'), 'scabbard');
  const guardPos = top.clone().addScaledVector(dir, 0.01);
  part(rig.chest, place(new BoxGeometry(0.09, 0.016, 0.028), guardPos.x, cl(guardPos.y), guardPos.z, [0, 0, roll]), matte('swordGuard', { roughness: 0.6 }), 'sword-guard', false);
  const gripPos = top.clone().addScaledVector(dir, 0.06);
  part(rig.chest, place(new CylinderGeometry(0.012, 0.013, 0.095, 8), gripPos.x, cl(gripPos.y), gripPos.z, [0, 0, roll]), matte('swordGrip'), 'sword-grip', false);
  const pommel = top.clone().addScaledVector(dir, 0.115);
  part(rig.chest, place(new SphereGeometry(0.019, 8, 6), pommel.x, cl(pommel.y), pommel.z), matte('steel', { roughness: 0.6 }), 'sword-pommel', false);
}
