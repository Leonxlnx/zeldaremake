/**
 * Fairy Ocarina — a small potato-shaped clay ocarina in a cream glaze: the rounded body, an
 * angled mouthpiece, a tail nub, eight finger holes set slightly into the shell and a thin
 * leather cord looped through the tail. Original shapes (not the blue Ocarina of Time).
 */
import { CylinderGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry, TorusGeometry, Vector3 } from 'three';
import { bezierPath, circleSection, hsl, paintData, paintTexture, sweep } from './shape';

export function buildOcarina(): Group {
  const group = new Group();
  const seed = 0x0ca1;
  const glaze = new MeshStandardMaterial({
    map: paintTexture(
      256,
      256,
      (ctx, rng) => {
        ctx.fillStyle = hsl(40, 0.42, 0.78);
        ctx.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 900; i++) {
          ctx.fillStyle = hsl(36 + (rng() - 0.5) * 20, 0.35, 0.6 + rng() * 0.3, 0.25);
          ctx.beginPath();
          ctx.ellipse(rng() * 256, rng() * 256, 1 + rng() * 6, 1 + rng() * 3, rng() * 3, 0, Math.PI * 2);
          ctx.fill();
        }
        // a pale green leaf motif painted on the belly
        ctx.fillStyle = hsl(110, 0.35, 0.5, 0.75);
        ctx.beginPath();
        ctx.moveTo(150, 150);
        ctx.bezierCurveTo(200, 120, 220, 160, 190, 200);
        ctx.bezierCurveTo(160, 200, 140, 180, 150, 150);
        ctx.fill();
        ctx.strokeStyle = hsl(110, 0.35, 0.3, 0.8);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(152, 152);
        ctx.lineTo(188, 196);
        ctx.stroke();
      },
      seed,
    ),
    roughnessMap: paintData(
      128,
      128,
      (ctx, rng) => {
        ctx.fillStyle = '#5a5a5a';
        ctx.fillRect(0, 0, 128, 128);
        for (let i = 0; i < 500; i++) {
          const v = 60 + Math.floor(rng() * 90);
          ctx.fillStyle = `rgb(${v},${v},${v})`;
          ctx.fillRect(rng() * 128, rng() * 128, 1 + rng() * 3, 1 + rng() * 3);
        }
      },
      seed + 1,
    ),
    roughness: 0.4,
    metalness: 0.02,
  });
  const dark = new MeshStandardMaterial({ color: 0x2a2018, roughness: 0.9 });
  const cordMat = new MeshStandardMaterial({ color: 0x5a3c22, roughness: 0.95 });

  // body: an egg, longer along x, slightly flattened
  const body = new Mesh(new SphereGeometry(0.11, 48, 32), glaze);
  body.scale.set(1.35, 0.72, 0.9);
  const bp = body.geometry.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    const x = bp.getX(i) / 0.11;
    // tapers toward the tail (+x), fuller toward the head (−x)
    const k = 1 - 0.18 * Math.max(0, x) ** 1.5 + 0.06 * Math.max(0, -x);
    bp.setY(i, bp.getY(i) * k);
    bp.setZ(i, bp.getZ(i) * k);
  }
  bp.needsUpdate = true;
  body.geometry.computeVertexNormals();
  group.add(body);

  // mouthpiece: angled tube off the head end
  const mouthBase = new Vector3(-0.12, 0.015, 0.02);
  const mouthTip = new Vector3(-0.2, 0.08, 0.05);
  const mouth = sweep({
    path: bezierPath(mouthBase, new Vector3(-0.17, 0.03, 0.035), mouthTip),
    section: (t) => {
      const w = 0.028 * (1 - t * 0.3);
      const h = 0.016 * (1 - t * 0.25);
      const pts: [number, number][] = [];
      for (let j = 0; j < 14; j++) {
        const a = (j / 14) * Math.PI * 2;
        pts.push([Math.cos(a) * w, Math.sin(a) * h]);
      }
      return pts;
    },
    segments: 10,
    caps: true,
  });
  group.add(new Mesh(mouth, glaze));
  const windway = new Mesh(new CylinderGeometry(0.008, 0.008, 0.004, 12), dark);
  windway.position.copy(mouthTip);
  windway.scale.set(2.2, 1, 1);
  windway.lookAt(mouthTip.clone().add(mouthTip.clone().sub(mouthBase)));
  windway.rotateX(Math.PI / 2);
  group.add(windway);

  // tail nub + cord loop
  const nub = new Mesh(new SphereGeometry(0.02, 16, 12), glaze);
  nub.position.set(0.15, 0.005, 0);
  nub.scale.set(1.3, 0.8, 0.8);
  group.add(nub);
  const ring = new Mesh(new TorusGeometry(0.018, 0.0035, 8, 24), cordMat);
  ring.position.set(0.166, 0.004, 0);
  ring.rotation.y = Math.PI / 2;
  group.add(ring);
  const cord = sweep({
    path: bezierPath(new Vector3(0.17, -0.01, 0), new Vector3(0.28, -0.1, 0.06), new Vector3(0.22, -0.2, -0.03)),
    section: circleSection(() => 0.0035, 8),
    segments: 12,
    caps: true,
  });
  group.add(new Mesh(cord, cordMat));

  // finger holes: dark discs sunk into the shell's upper surface
  const holes: [number, number, number, number][] = [
    [-0.075, 0.062, 0.03, 0.011],
    [-0.035, 0.07, 0.035, 0.012],
    [0.005, 0.07, 0.035, 0.012],
    [0.045, 0.065, 0.03, 0.011],
    [-0.06, 0.06, -0.035, 0.0095],
    [-0.02, 0.066, -0.04, 0.01],
    [0.02, 0.066, -0.04, 0.0095],
    [0.06, 0.06, -0.03, 0.009],
  ];
  for (const [x, y, z, r] of holes) {
    const hole = new Mesh(new CylinderGeometry(r, r * 0.8, 0.014, 16), dark);
    hole.position.set(x, y, z);
    // tilt the hole to follow the local surface: outward normal ≈ position scaled by the body's inverse squares
    const n = new Vector3(x / (0.11 * 1.35) ** 2, y / (0.11 * 0.72) ** 2, z / (0.11 * 0.9) ** 2).normalize();
    hole.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), n);
    hole.position.addScaledVector(n, -0.003);
    group.add(hole);
    const rim = new Mesh(new TorusGeometry(r + 0.001, 0.0018, 6, 18), glaze);
    rim.position.copy(hole.position).addScaledVector(n, 0.0065);
    rim.quaternion.copy(hole.quaternion);
    rim.rotateX(Math.PI / 2);
    group.add(rim);
  }

  group.rotation.set(0.35, 0.45, 0.1);
  return group;
}
