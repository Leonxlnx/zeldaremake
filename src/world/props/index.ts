/** Original village props. Leaf module: no imports from other rendering systems. */
import { BoxGeometry, BufferGeometry, Color, CylinderGeometry, Float32BufferAttribute, Group,
  LatheGeometry, Matrix4, Mesh, MeshStandardMaterial, Quaternion, TorusGeometry, TubeGeometry,
  CatmullRomCurve3, Vector2, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { WorldContext, WorldSystem } from '../system';
import { createRng } from '../util/prng';
import { PROP_LAYOUT } from './layout';

type MaterialKey = 'wood' | 'clay' | 'iron' | 'rope';
const UP = new Vector3(0, 1, 0);

/** Radius probes keep the whole footprint out of paths and architecture, not only its origin. */
export function placementAllowed(ctx: Pick<WorldContext, 'terrain' | 'layout'>, x: number, z: number, radius: number) {
  for (let i = 0; i < 9; i++) {
    const a = i * Math.PI / 4, r = i === 8 ? 0 : radius;
    const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
    const m = ctx.terrain.mask(px, pz);
    if (m.path > 0.18 || m.stairs > 0.01 || m.structure > 0.12 || m.cliff > 0.1) return false;
    if (ctx.layout.giantTrees.some(t => Math.hypot(px - t.position[0], pz - t.position[2]) < t.trunkRadius + 0.45)) return false;
  }
  return true;
}

export function create(ctx: WorldContext): WorldSystem {
  const root = new Group(); root.name = 'props';
  const materials: Record<MaterialKey, MeshStandardMaterial> = {
    wood: new MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.93 }),
    clay: new MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.87 }),
    iron: new MeshStandardMaterial({ color: 0x403d32, roughness: 0.72, metalness: 0.55 }),
    rope: new MeshStandardMaterial({ color: 0x948462, roughness: 1 }),
  };
  const ownedGeometry: BufferGeometry[] = [];
  const bases: number[][] = [];
  const counts = { pots: 0, crates: 0, buckets: 0, platforms: 0, ladders: 0, ropeRailings: 0 };
  const skipped: string[] = [];

  for (const def of PROP_LAYOUT) {
    const footprint = def.kind === 'platform' ? 1.65 : def.size * 0.73;
    let x = def.x as number, z = def.z as number, found = false;
    // Small local adjustment only; never relocate a detail across the village to meet a count.
    for (let attempt = 0; attempt < 17; attempt++) {
      const a = (attempt - 1) * Math.PI / 4, r = attempt === 0 ? 0 : attempt < 9 ? 0.55 : 1.05;
      x = def.x + Math.cos(a) * r; z = def.z + Math.sin(a) * r;
      if (placementAllowed(ctx, x, z, footprint) && !bases.some(b => Math.hypot(b[0] - x, b[2] - z) < def.size * 0.7)) { found = true; break; }
    }
    if (!found) { skipped.push(def.id); continue; }
    const rng = createRng(`${ctx.config.seed}/props/${def.id}`);
    const pigment = rng.range(0.94, 1.06);
    const group = new Group(); group.name = def.id;
    const groundY = ctx.terrain.height(x, z);
    group.position.set(x, groundY, z);
    if (def.kind !== 'platform') group.quaternion.setFromUnitVectors(UP, ctx.terrain.normal(x, z, new Vector3()));
    group.rotateY(def.yaw);
    root.add(group); bases.push([x, groundY, z]);
    const batches: Record<MaterialKey, BufferGeometry[]> = { wood: [], clay: [], iron: [], rope: [] };

    function add(geometry: BufferGeometry, key: MaterialKey, position = new Vector3(), rotation = new Quaternion(), tint?: number) {
      // Strip UVs: all surfaces use original geometry/vertex pigments, no texture dependencies.
      geometry.deleteAttribute('uv');
      const g = geometry.index ? geometry.toNonIndexed() : geometry;
      if (g !== geometry) geometry.dispose();
      if (key === 'wood' || key === 'clay') {
        const color = new Color(tint ?? (key === 'wood' ? 0x766044 : 0x987249));
        const data: number[] = [];
        for (let i = 0; i < g.attributes.position.count; i++) {
          const p = g.attributes.position;
          const grain = key === 'wood' ? Math.sin(p.getX(i) * 170 + p.getY(i) * 2) * 0.035 : Math.sin(p.getY(i) * 115) * 0.025;
          // Spatial, continuous pigment avoids seams between duplicate triangle vertices.
          const shade = pigment + grain + Math.sin(p.getX(i)*13+p.getY(i)*9+p.getZ(i)*17)*0.025;
          data.push(color.r * shade, color.g * shade, color.b * shade);
        }
        g.setAttribute('color', new Float32BufferAttribute(data, 3));
      }
      g.applyMatrix4(new Matrix4().compose(position, rotation, new Vector3(1, 1, 1)));
      batches[key].push(g);
    }
    function beam(a: Vector3, b: Vector3, width: number, depth = width, key: MaterialKey = 'wood') {
      const d = b.clone().sub(a);
      add(new BoxGeometry(width, d.length(), depth), key, a.clone().add(b).multiplyScalar(0.5), new Quaternion().setFromUnitVectors(UP, d.normalize()));
    }
    function groundedBeam(a: Vector3, b: Vector3, width: number) {
      beam(a,b,width);
      const geometry=batches.wood[batches.wood.length-1], p=geometry.attributes.position;
      const contacts:number[]=[];
      for(let i=0;i<p.count;i++) {
        const v=new Vector3().fromBufferAttribute(p,i);
        if(v.distanceTo(a)<width*1.5) {
          v.applyQuaternion(group.quaternion).add(group.position);
          v.y=ctx.terrain.height(v.x,v.z)-.008;
          v.sub(group.position).applyQuaternion(group.quaternion.clone().invert());
          p.setXYZ(i,v.x,v.y,v.z);contacts.push(i);
        }
      }
      geometry.computeVertexNormals();geometry.userData.contactIndices=contacts;
    }
    function ring(radius: number, tube: number, y: number, key: MaterialKey) {
      add(new TorusGeometry(radius, tube, 6, 36), key, new Vector3(0, y, 0), new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2));
    }
    function cord(points: Vector3[], radius = 0.022) {
      add(new TubeGeometry(new CatmullRomCurve3(points), 22, radius, 5, false), 'rope');
    }
    const s = def.size;
    if (def.kind === 'pot') {
      // Closed cross-section follows the outside, rolled lip, inside wall and solid floor.
      const profile = [[0,0],[.20,0],[.27,.035],[.35,.18],[.39,.39],[.34,.62],[.24,.78],[.245,.84],[.27,.855],[.27,.89],[.225,.90],[.21,.855],[.205,.79],[.30,.61],[.345,.38],[.305,.19],[.22,.07],[0,.07]];
      add(new LatheGeometry(profile.map(([r,y]) => new Vector2(r*s,y*s)), 40), 'clay');
      ring(.258*s,.015*s,.864*s,'clay');
      // Two small ceramic loop handles; actual open holes, no painted silhouettes.
      for (const side of [-1,1]) add(new TorusGeometry(.105*s,.026*s,8,20), 'clay', new Vector3(side*.335*s,.61*s,0));
      counts.pots++;
    } else if (def.kind === 'crate') {
      const w=s, h=s*.82, plank=s/5;
      for (let i=0;i<5;i++) {
        const p=-w/2+plank*(i+.5);
        for (const side of [-1,1]) {
          add(new BoxGeometry(plank*.94,h,.055), 'wood',new Vector3(p,h/2,side*w/2));
          add(new BoxGeometry(.055,h,plank*.94), 'wood',new Vector3(side*w/2,h/2,p));
        }
        add(new BoxGeometry(w, .055, plank*.94),'wood',new Vector3(0,h,p));
        add(new BoxGeometry(w, .055, plank*.94),'wood',new Vector3(0,.0275,p));
      }
      for (const side of [-1,1]) {
        for (const y of [.11*h,.86*h]) add(new BoxGeometry(w+.07,.075,.047),'wood',new Vector3(0,y,side*(w/2+.046)),undefined,0x514530);
        beam(new Vector3(-w*.4,h*.18,side*(w/2+.077)),new Vector3(w*.4,h*.8,side*(w/2+.077)),.065,.035);
        for (const px of [-w*.39,w*.39]) for (const y of [.11*h,.86*h]) add(new CylinderGeometry(.012,.012,.014,6),'iron',new Vector3(px,y,side*(w/2+.075)),new Quaternion().setFromAxisAngle(new Vector3(1,0,0),Math.PI/2));
      }
      counts.crates++;
    } else if (def.kind === 'bucket') {
      const h=.66*s;
      for (let i=0;i<14;i++) {
        const a=i/14*Math.PI*2;
        // Wedge staves preserve the visible hollow interior and slight seams.
        const profile=[new Vector2(.26*s,0),new Vector2(.34*s,h),new Vector2(.305*s,h),new Vector2(.225*s,.035),new Vector2(.26*s,0)];
        add(new LatheGeometry(profile,2,a+.016,Math.PI*2/14-.032),'wood');
      }
      add(new CylinderGeometry(.255*s,.255*s,.035,24),'wood',new Vector3(0,.0175,0));
      ring(.281*s,.018,.15*h,'iron'); ring(.326*s,.018,.81*h,'iron');
      ring(.322*s,.018,h,'wood');
      cord([new Vector3(-.33*s,.58*s,0),new Vector3(-.32*s,.91*s,0),new Vector3(0,1.05*s,0),new Vector3(.32*s,.91*s,0),new Vector3(.33*s,.58*s,0)],.018);
      counts.buckets++;
    } else {
      const deckY=1.28;
      // Individual supports terminate at the sampled ground, even on the west embankment.
      for (const px of [-.76,.76]) for (const pz of [-.55,.55]) {
        const footY=ctx.terrain.height(x+px,z+pz)-groundY;
        groundedBeam(new Vector3(px,footY-.025,pz),new Vector3(px,deckY,pz),.115);
      }
      for (let i=0;i<8;i++) add(new BoxGeometry(.203,.095,1.34),'wood',new Vector3(-.75+i*.214,deckY,0));
      for (const pz of [-.5,.5]) beam(new Vector3(-.88,deckY-.15,pz),new Vector3(.88,deckY-.15,pz),.13,.13);
      beam(new Vector3(-.76,.18,-.55),new Vector3(.76,deckY-.2,-.55),.09);
      for (const px of [-.77,.77]) {
        beam(new Vector3(px,deckY,-.55),new Vector3(px,deckY+.72,-.55),.085);
        beam(new Vector3(px,deckY,.55),new Vector3(px,deckY+.72,.55),.085);
        for (const h of [.34,.66]) cord([new Vector3(px,deckY+h,-.55),new Vector3(px,deckY+h-.08,0),new Vector3(px,deckY+h,.55)]);
        for (const pz of [-.55,.55]) for (const h of [.34,.66]) {
          // Visible lashings bind ropes to posts.
          for(let wrap=0;wrap<3;wrap++) add(new TorusGeometry(.061,.012,5,12),'rope',new Vector3(px,deckY+h+wrap*.02,pz),new Quaternion().setFromAxisAngle(new Vector3(1,0,0),Math.PI/2));
        }
      }
      cord([new Vector3(-.77,deckY+.66,-.55),new Vector3(0,deckY+.55,-.55),new Vector3(.77,deckY+.66,-.55)]);
      const bottomZ=1.28, topZ=.57;
      const rails=[-.29,.29].map(px=>({bottom:new Vector3(px,ctx.terrain.height(x+px,z+bottomZ)-groundY,bottomZ),top:new Vector3(px,deckY+.15,topZ)}));
      for(const rail of rails) groundedBeam(rail.bottom,rail.top,.073);
      for(let i=1;i<=5;i++) {
        const t=i/6;
        beam(rails[0].bottom.clone().lerp(rails[0].top,t),rails[1].bottom.clone().lerp(rails[1].top,t),.065);
      }
      counts.platforms++; counts.ladders++; counts.ropeRailings+=3;
    }
    for (const key of Object.keys(batches) as MaterialKey[]) if (batches[key].length) {
      let vertexOffset=0;const platformContacts:number[]=[];
      for(const g of batches[key]) {
        platformContacts.push(...(g.userData.contactIndices??[]).map((i:number)=>i+vertexOffset));
        vertexOffset+=g.attributes.position.count;
      }
      const merged=mergeGeometries(batches[key],false);
      batches[key].forEach(g=>g.dispose());
      if(!merged) throw new Error(`Cannot merge props material ${key}`);
      if(def.kind!=='platform') {
        // Conform just the underside to the actual heightfield. A tangent-plane orientation
        // alone leaves gaps on curved ground; preserve the rigid silhouette above 8 cm.
        const p=merged.attributes.position, v=new Vector3(), inverse=group.quaternion.clone().invert();
        const contactIndices: number[]=[];
        const editedFaces=new Set<number>();
        for(let i=0;i<p.count;i++) if(p.getY(i)<.08) {
          editedFaces.add(Math.floor(i/3)*3);
          const weight=Math.min(1,Math.max(0,(.08-p.getY(i))/.06));
          if(weight>=.99999) contactIndices.push(i);
          v.fromBufferAttribute(p,i).applyQuaternion(group.quaternion).add(group.position);
          const seated=ctx.terrain.height(v.x,v.z)-.008;
          v.y+=(seated-v.y)*weight;
          v.sub(group.position).applyQuaternion(inverse);
          p.setXYZ(i,v.x,v.y,v.z);
        }
        merged.userData.contactIndices=contactIndices;
        // Only edited faces need new normals; preserve the pottery's smooth upper shading.
        const normals=merged.attributes.normal, a=new Vector3(),b=new Vector3(),c=new Vector3();
        for(const i of editedFaces) {
          a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);
          b.sub(a);c.sub(a);b.cross(c).normalize();
          for(let j=0;j<3;j++) normals.setXYZ(i+j,b.x,b.y,b.z);
        }
        merged.userData.recomputedFaces=[...editedFaces];
      } else {
        merged.userData.contactIndices=platformContacts;
      }
      merged.computeBoundingBox(); merged.computeBoundingSphere(); ownedGeometry.push(merged);
      const mesh=new Mesh(merged,materials[key]); mesh.name=`${def.id}-${key}`;
      mesh.castShadow=ctx.quality.shadows; mesh.receiveShadow=true; group.add(mesh);
    }
  }
  ctx.audit('props',()=>({ ...counts, geometry:'original-lathed-pottery-planked-joinery-rope', samplePositions:{bases}, skipped, meshes:ownedGeometry.length }));
  return {name:'props',group:root,dispose(){ownedGeometry.forEach(g=>g.dispose());Object.values(materials).forEach(m=>m.dispose());root.clear();}};
}
