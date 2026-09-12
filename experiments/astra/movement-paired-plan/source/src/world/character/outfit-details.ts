/** Original sewn cloth and leather details, attached to the existing moving joints. */
import { BufferGeometry, Float32BufferAttribute, Material, Mesh, Object3D, Raycaster, Vector3 } from 'three';
import { merge, sweep } from './geometry';
import { cloth, matte } from './palette';
import type { Rig } from './rig';
import { createLinkLeatherMaterial } from './leather-material';
import { createLinkCapTailStitches } from './cap-tail-stitches';

type Attach = (parent: Object3D, geometry: BufferGeometry, material: Material, name: string, shadows?: boolean) => Mesh;

/** Small stitch segments stay batched per animated joint. */
function stitches(points: Vector3[], spacing = 0.010, radius = 0.0008): BufferGeometry[] {
  const result: BufferGeometry[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], length = a.distanceTo(b);
    const count = Math.max(1, Math.ceil(length / spacing));
    for (let j = 0; j < count; j++) {
      const from = a.clone().lerp(b, (j + 0.15) / count);
      const to = a.clone().lerp(b, (j + 0.72) / count);
      result.push(sweep([from, to], [radius, radius], { segments: 1, radial: 5, smooth: false, closeStart: true, closeTip: true }));
    }
  }
  return result;
}

export function addOutfitDetails(rig: Rig, attach: Attach): void {
  const skirt = rig.hips.getObjectByName('tunic-skirt') as Mesh;
  const surface = new Mesh(skirt.geometry, skirt.material);
  const ray = new Raycaster(new Vector3(), new Vector3(0, 0, -1));
  const front = (x: number, y: number, gap: number) => {
    ray.ray.origin.set(x, y - rig.props.hipY, 0.3);
    const hit = ray.intersectObject(surface, false)[0];
    if (!hit) throw new Error('Tunic panel must remain inside the original skirt silhouette');
    return new Vector3(x, y - rig.props.hipY, hit.point.z + gap);
  };
  const sewn: BufferGeometry[] = [];
  // Two shaped overskirt panels leave a small central opening and a visible lower hem.
  for (const sign of [-1, 1]) {
    const outline = [[0.012, 0.586], [0.092, 0.586], [0.124, 0.485], [0.110, 0.451], [0.023, 0.442]];
    const centre = [0.064, 0.52], rings = 8, edgeSteps = 8, segments = outline.length * edgeSteps;
    const positions = front(sign * centre[0], centre[1], 0.005).toArray(), uvs = [0.5, 0.5], indices: number[] = [];
    const border: Vector3[] = [];
    for (let ring = 1; ring <= rings; ring++) for (let j = 0; j < segments; j++) {
      const edge = Math.floor(j / edgeSteps), t = j % edgeSteps / edgeSteps;
      const a = outline[edge], b = outline[(edge + 1) % outline.length];
      const x = centre[0] + ((a[0] + (b[0] - a[0]) * t) - centre[0]) * ring / rings;
      const y = centre[1] + ((a[1] + (b[1] - a[1]) * t) - centre[1]) * ring / rings;
      const v = front(sign * x, y, 0.005);
      positions.push(...v.toArray()); uvs.push(x * 5, y * 5);
      if (ring === rings) border.push(v.clone().add(new Vector3(0, 0, 0.0012)));
      const q = 1 + (ring - 1) * segments + j, next = 1 + (ring - 1) * segments + (j + 1) % segments;
      const faces = ring === 1 ? [0, next, q] : [q - segments, next, q, q - segments, next - segments, next];
      if (sign < 0) for (let k = 0; k < faces.length; k += 3) [faces[k + 1], faces[k + 2]] = [faces[k + 2], faces[k + 1]];
      indices.push(...faces);
    }
    const panel = new BufferGeometry();
    panel.setAttribute('position', new Float32BufferAttribute(positions, 3));
    panel.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
    panel.setIndex(indices); panel.computeVertexNormals();
    attach(rig.hips, panel, cloth('tunicCollar'), 'tunic-front-panel');
    border.push(border[0]); sewn.push(...stitches(border, 0.010, 0.0008));
  }
  const threadMaterial = matte('clothThread');
  attach(rig.hips, merge(sewn), threadMaterial, 'tunic-sewn-edges', false);

  // A narrow folded tongue, crossed laces follow each ankle.
  const tongueLeather = createLinkLeatherMaterial(matte('leather'), [.064 * Math.PI / 3, .114]);
  for (const ankle of [rig.ankleL, rig.ankleR]) {
    const leatherParts: BufferGeometry[] = [], laceParts: BufferGeometry[] = [];
    const tongue = new BufferGeometry();
    const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
    for (let row = 0; row <= 8; row++) for (let col = 0; col <= 6; col++) {
      const x = (col / 6 - 0.5) * 0.064, y = 0.01 + row / 8 * 0.114;
      const z = Math.sqrt(0.064 ** 2 - x * x) + 0.001;
      positions.push(x, y, z);
      // The tongue spans a 60-degree cylindrical arc: U follows its physical
      // width, V follows its height. Preserve the existing surface and normals.
      uvs.push(0.5 + Math.asin(x / 0.064) / (Math.PI / 3), row / 8);
      if (row < 8 && col < 6) {
        const a = row * 7 + col, b = a + 7;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
    tongue.setAttribute('position', new Float32BufferAttribute(positions, 3));
    tongue.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
    tongue.setIndex(indices); tongue.computeVertexNormals(); leatherParts.push(tongue);
    attach(ankle, merge(leatherParts), tongueLeather, 'boot-tongue');
    for (let row = 0; row < 4; row++) for (const sign of [-1, 1]) {
      const y = 0.02 + row * 0.022;
      laceParts.push(sweep([new Vector3(sign * 0.028, y, 0.060), new Vector3(0, y + 0.009, 0.068), new Vector3(-sign * 0.028, y + 0.018, 0.060)], [0.0018, 0.0018], { segments: 8, radial: 5, closeStart: true, closeTip: true }));
    }
    attach(ankle, merge(laceParts), matte('leatherStitch'), 'boot-laces', false);
  }

  // Sewn centre seam along the existing cap tail's backmost surface.
  const tail = rig.cap?.getObjectByName('cap-tail') as Mesh | undefined;
  if (tail && tail.parent) {
    attach(tail.parent, createLinkCapTailStitches(tail.geometry), threadMaterial, 'cap-tail-stitches', false);
  }
}
