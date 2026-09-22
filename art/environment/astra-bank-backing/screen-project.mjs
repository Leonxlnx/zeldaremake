import assert from 'node:assert/strict';
import * as T from 'three';

const width = 1280, height = 720, count = width * height;
const emptyDepth = () => new Float64Array(count).fill(Infinity);
const quantiles = values => {
  const v = [...values].sort((a,b)=>a-b), at = q => v[Math.min(v.length-1,Math.floor(q*(v.length-1)))];
  return { n:v.length,min:v[0],p10:at(.1),p25:at(.25),median:at(.5),p75:at(.75),p90:at(.9),p99:at(.99),max:v.at(-1),mean:v.reduce((a,b)=>a+b,0)/v.length };
};
function clippedArea(points) {
  let poly=points.map(p=>[p.x,p.y]);
  for(const [axis,limit,sign] of [[0,0,1],[0,width,-1],[1,0,1],[1,height,-1]]) {
    const next=[];
    for(let i=0;i<poly.length;i++) {
      const a=poly[i],b=poly[(i+1)%poly.length],insideA=(a[axis]-limit)*sign>=0,insideB=(b[axis]-limit)*sign>=0;
      if(insideA)next.push(a);
      if(insideA!==insideB){const t=(limit-a[axis])/(b[axis]-a[axis]);next.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
    }poly=next;if(!poly.length)return 0;
  }
  return Math.abs(poly.reduce((s,p,i)=>s+p[0]*poly[(i+1)%poly.length][1]-p[1]*poly[(i+1)%poly.length][0],0))*.5;
}
function raster(points, visit) {
  if(points.some(p=>p.z < -1 || p.z > 1))return 0;
  const [a,b,c]=points,den=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);
  if(Math.abs(den)<1e-12)return 0;
  const x0=Math.max(0,Math.floor(Math.min(a.x,b.x,c.x))),x1=Math.min(width-1,Math.ceil(Math.max(a.x,b.x,c.x)));
  const y0=Math.max(0,Math.floor(Math.min(a.y,b.y,c.y))),y1=Math.min(height-1,Math.ceil(Math.max(a.y,b.y,c.y)));
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++) {
    const u=((b.y-c.y)*(x+.5-c.x)+(c.x-b.x)*(y+.5-c.y))/den;
    const v=((c.y-a.y)*(x+.5-c.x)+(a.x-c.x)*(y+.5-c.y))/den;
    if(u < -1e-10 || v < -1e-10 || u+v>1+1e-10)continue;
    visit(y*width+x,u*a.z+v*b.z+(1-u-v)*c.z);
  }
  return clippedArea(points);
}
export function measureScreen(asset, records, origin, native) {
  assert.equal(native.settings.width,width);assert.equal(native.settings.height,height);
  const pose=native.images.F_canopy.camera,cam=new T.PerspectiveCamera(pose.fov,width/height,.1,500);
  cam.position.fromArray(pose.position);cam.lookAt(cam.position.clone().add(new T.Vector3().fromArray(pose.direction)));cam.updateMatrixWorld();
  const time=native.settings.time,dir=new T.Vector2(.72,-.69).normalize(),strength=.85;
  const gust=Math.min(1,(.5+.5*Math.sin(time*.37)*Math.sin(time*.11+1.3))*.8+Math.max(0,Math.sin(time*.23+.4))**3*.6);
  const field=(p,speed,scale)=>{
    const x=p.x*scale-dir.x*time*speed,z=p.z*scale-dir.y*time*speed;
    return Math.sin(x*1.7+z*.9)*.5+Math.sin(x*.6-z*1.3+1.7)*.35+Math.sin((x+z)*2.3+time*.7)*.15;
  };
  const transformed=new Map();
  const pointsFor=g=>{
    if(transformed.has(g))return transformed.get(g);
    const points=[];
    for(let i=0;i<g.attributes.position.count;i++) {
      const p=new T.Vector3().fromBufferAttribute(g.attributes.position,i).add(origin);
      const root=new T.Vector3().fromBufferAttribute(g.attributes.aRoot,i).add(origin),w=g.attributes.aWind;
      const h=Math.max(0,p.y-root.y),phase=w.getY(i),flutter=Math.max(0,w.getZ(i));
      const whole=field(root,.35,.05)*(.7+.3*gust)*(.03*strength*.06*h);
      const flexP=p.clone().add(new T.Vector3(phase*41,phase*7,phase*23));
      const flex=field(flexP,.35,.05)*(.7+.3*gust)*((1-w.getX(i))*strength*.06*h*.5*.3);
      const f1=Math.sin(time*7+phase*12.566+p.y*1.3),f2=Math.sin(time*4.3+phase*3.7+p.x*.7),amp=flutter*strength*(.5+.5*gust);
      p.add(new T.Vector3(dir.x*(whole+flex)+f1*.6*amp,f2*.4*amp,dir.y*(whole+flex)+f1*f2*.5*amp));
      const world=p.clone();p.project(cam);p.world=world;
      p.x=(p.x*.5+.5)*width;p.y=(.5-p.y*.5)*height;points.push(p);
    }
    transformed.set(g,points);return points;
  };
  const coreDepth=emptyDepth(),coreOwner=new Int8Array(count).fill(-1),oldLeafDepth=emptyDepth(),woodDepth=emptyDepth(),fineDepth=emptyDepth(),fineOwner=new Int8Array(count).fill(-1);
  const coreByGroup=new Map(),groups=new Map(),rayTriangles=[];
  const far=asset.authoredLeaves,farPoints=pointsFor(far),r=far.attributes.aRoot,uv=far.attributes.uv;
  const groupOf=i=>r.getW(i)>=999?Math.floor(r.getW(i)-1000+.01):-1;
  for(const id of [24,25,26]) {coreByGroup.set(id,emptyDepth());groups.set(id,{group:id,leafIds:[],coreTriangles:0,oldLeafTriangles:0,nearWoodTriangles:0});}
  for(let i=0;i<far.index.count;i+=3) {
    const ids=[0,1,2].map(k=>far.index.getX(i+k)),group=groupOf(ids[0]);
    if(!groups.has(group))continue;assert(ids.every(id=>groupOf(id)===group));
    const core=ids.every(id=>uv.getX(id)===0&&uv.getY(id)===0),row=groups.get(group),depth=core?coreDepth:oldLeafDepth;
    rayTriangles.push({kind:core?'core':'oldFlatLeaf',group,sourceTriangle:i/3,sourceGeometry:'authoredLeaves',points:ids.map(id=>farPoints[id].world)});
    row[core?'coreTriangles':'oldLeafTriangles']++;
    raster(ids.map(id=>farPoints[id]),(at,z)=>{
      if(z<depth[at]){depth[at]=z;if(core)coreOwner[at]=group;}
      if(core)coreByGroup.get(group)[at]=Math.min(coreByGroup.get(group)[at],z);
    });
  }
  const leaves=[];
  for(const [group,row] of groups) {
    const part=asset.nearCanopy.find(p=>p.kind==='lobe'&&p.group===group),g=part.geometry,p=g.attributes.position,roots=g.attributes.aRoot,projected=pointsFor(g),idsByVertex=new Int32Array(p.count).fill(-1);
    for(let v=0;v<p.count;) {
      if(roots.getW(v)<.5){v++;continue;}
      const leaf={id:leaves.length,group,tris:[],area:0,pixels:0,corePixels:0,frontCorePixels:0,frontOpaquePixels:0,visiblePixels:0};
      const base=new T.Vector3().fromBufferAttribute(p,v);leaf.lengthM=0;leaf.worldAreaM2=0;
      for(let k=0;k<8;k++){idsByVertex[v+k]=leaf.id;leaf.lengthM=Math.max(leaf.lengthM,base.distanceTo(new T.Vector3().fromBufferAttribute(p,v+k)));}
      row.leafIds.push(leaf.id);leaves.push(leaf);v+=8;
    }
    for(let i=0;i<g.index.count;i+=3) {
      const ids=[0,1,2].map(k=>g.index.getX(i+k)),leaf=idsByVertex[ids[0]];
      rayTriangles.push({kind:leaf<0?'nearWood':'fineLeaf',group,leafId:leaf,sourceTriangle:i/3,sourceGeometry:`nearCanopy:lobe:${group}`,points:ids.map(id=>projected[id].world)});
      if(leaf<0){row.nearWoodTriangles++;raster(ids.map(id=>projected[id]),(at,z)=>woodDepth[at]=Math.min(woodDepth[at],z));}
      else {assert(ids.every(id=>idsByVertex[id]===leaf));leaves[leaf].tris.push(ids.map(id=>projected[id]));leaves[leaf].worldAreaM2+=new T.Triangle(...ids.map(id=>new T.Vector3().fromBufferAttribute(p,id))).getArea();}
    }
    assert.equal(row.leafIds.length,part.leaves);
  }
  const layerCount=new Uint16Array(count),frontLayerCount=new Uint16Array(count),last=new Int32Array(count).fill(-1),lastFront=new Int32Array(count).fill(-1),lastOpaque=new Int32Array(count).fill(-1),fineLeafOwner=new Int32Array(count).fill(-1);
  let trianglePixelSamples=0;
  for(const leaf of leaves) for(const tri of leaf.tris) leaf.area+=raster(tri,(at,z)=>{
    trianglePixelSamples++;
    if(z<fineDepth[at]){fineDepth[at]=z;fineOwner[at]=leaf.group;fineLeafOwner[at]=leaf.id;}
    if(last[at]!==leaf.id){last[at]=leaf.id;layerCount[at]++;leaf.pixels++;if(Number.isFinite(coreDepth[at]))leaf.corePixels++;}
    if(z<coreDepth[at]-1e-8&&lastFront[at]!==leaf.id){lastFront[at]=leaf.id;if(Number.isFinite(coreDepth[at])){frontLayerCount[at]++;leaf.frontCorePixels++;}}
    if(z<Math.min(coreDepth[at],oldLeafDepth[at],woodDepth[at])-1e-8&&lastOpaque[at]!==leaf.id){lastOpaque[at]=leaf.id;leaf.frontOpaquePixels++;}
  });
  const maskCounts=()=>({projectedCorePixels:0,frontmostCorePixels:0,anyFineProjection:0,fineInFrontOfCore:0,projectedFineBehindCore:0,noFineProjection:0,frontmostFine:0,frontmostCore:0,frontmostOldFlatLeaf:0,frontmostWood:0});
  const overall=maskCounts();for(const row of groups.values())row.coverage=maskCounts();
  const increment=(row,at)=>{
    row.frontmostCorePixels++;const any=Number.isFinite(fineDepth[at]),front=fineDepth[at]<coreDepth[at]-1e-8;
    row.anyFineProjection+=Number(any);row.fineInFrontOfCore+=Number(front);row.projectedFineBehindCore+=Number(any&&!front);row.noFineProjection+=Number(!any);
    const z=Math.min(coreDepth[at],oldLeafDepth[at],woodDepth[at],fineDepth[at]);
    if(z===fineDepth[at])row.frontmostFine++;else if(z===oldLeafDepth[at])row.frontmostOldFlatLeaf++;else if(z===woodDepth[at])row.frontmostWood++;else row.frontmostCore++;
  };
  let fineUnion=0,fineUnoccluded=0;
  for(let at=0;at<count;at++) {
    if(Number.isFinite(fineDepth[at])){
      fineUnion++;
      if(fineDepth[at]<Math.min(coreDepth[at],oldLeafDepth[at],woodDepth[at])-1e-8){fineUnoccluded++;leaves[fineLeafOwner[at]].visiblePixels++;}
    }
    if(Number.isFinite(coreDepth[at])){overall.projectedCorePixels++;increment(overall,at);increment(groups.get(coreOwner[at]).coverage,at);}
    for(const [id,depth] of coreByGroup)if(Number.isFinite(depth[at]))groups.get(id).coverage.projectedCorePixels++;
  }
  const sum=(xs,key)=>xs.reduce((n,x)=>n+x[key],0),summarize=xs=>({leaves:xs.length,onScreenLeaves:xs.filter(x=>x.pixels).length,leavesWithAnyUnoccludedPixel:xs.filter(x=>x.visiblePixels).length,
    lengthM:quantiles(xs.map(x=>x.lengthM)),worldAreaM2:quantiles(xs.map(x=>x.worldAreaM2)),clippedProjectedTriangleAreaPx2:quantiles(xs.map(x=>x.area)),uniquePixelsPerLeaf:quantiles(xs.map(x=>x.pixels)),visibleUniquePixelsPerLeaf:quantiles(xs.map(x=>x.visiblePixels)),
    summedProjectedTriangleAreaPx2:sum(xs,'area'),summedDistinctLeafFootprintPixels:sum(xs,'pixels'),summedLeafFootprintsInsideCore:sum(xs,'corePixels'),summedLeafFootprintsInFrontOfCore:sum(xs,'frontCorePixels'),summedLeafFootprintsInFrontOfBankOpaque:sum(xs,'frontOpaquePixels'),visiblePixelOwnership:sum(xs,'visiblePixels')});
  for(const row of groups.values()){row.leafMetrics=summarize(row.leafIds.map(i=>leaves[i]));delete row.leafIds;}
  const leafMetrics=summarize(leaves);
  const rayChecks=[],checkCoords=[[675,85],[1000,155],[733,122]];
  for(let y=20;y<340;y+=40)for(let x=560;x<1140;x+=40)checkCoords.push([x,y]);
  for(const [x,y] of checkCoords){
    const ndc=new T.Vector2((x+.5)/width*2-1,1-(y+.5)/height*2),caster=new T.Raycaster();caster.setFromCamera(ndc,cam);
    const hits={},target=new T.Vector3();
    for(const tri of rayTriangles){
      const hit=caster.ray.intersectTriangle(...tri.points,false,target);if(!hit)continue;
      const distance=hit.distanceTo(cam.position);
      if(!hits[tri.kind]||distance<hits[tri.kind].distance)hits[tri.kind]={distance,group:tri.group,leafId:tri.leafId,sourceTriangle:tri.sourceTriangle,sourceGeometry:tri.sourceGeometry};
    }
    const nearest=Object.entries(hits).sort((a,b)=>a[1].distance-b[1].distance)[0],at=y*width+x;
    const rasterKinds={core:coreDepth[at],oldFlatLeaf:oldLeafDepth[at],nearWood:woodDepth[at],fineLeaf:fineDepth[at]};
    const rasterNearest=Object.entries(rasterKinds).filter(([,z])=>Number.isFinite(z)).sort((a,b)=>a[1]-b[1])[0];
    assert.equal(nearest?.[0],rasterNearest?.[0],`ray/raster classification differs at ${x},${y}`);
    for(const [kind,hit]of Object.entries(hits)){
      const p=caster.ray.at(hit.distance,new T.Vector3()).project(cam);assert(Math.abs(p.z-rasterKinds[kind])<1e-9,`ray/raster depth differs for ${kind} at ${x},${y}`);
    }
    rayChecks.push({x,y,frontmost:nearest?.[0]??null,hits});
  }
  return {sourceRef:'063772a4',view:'F_canopy',width,height,time,pose,groups:[...groups.values()],overall,leafMetrics,fineUnionPixels:fineUnion,fineUnoccludedByBankOpaquePixels:fineUnoccluded,trianglePixelSamples,
    overlap:{summedLeafFootprintsDividedByUnion:leafMetrics.summedDistinctLeafFootprintPixels/fineUnion,frontCoreFootprintsDividedByUniqueFrontCorePixels:leafMetrics.summedLeafFootprintsInFrontOfCore/overall.fineInFrontOfCore,extraFrontCoreSamplesFromOverlappingLeaves:leafMetrics.summedLeafFootprintsInFrontOfCore-overall.fineInFrontOfCore},
    remainingCoreAreaWithoutFineLeafPixels:overall.frontmostCorePixels-overall.frontmostFine,
    independentRayCheck:{sampleCount:rayChecks.length,method:'Three.Ray.intersectTriangle at the same pixel centres, DoubleSide, independent world-space intersection. Nearest kind and per-kind projected depth must agree with CPU raster within 1e-9 NDC.',samples:rayChecks},
    method:'CPU output-pixel-centre triangle raster at native camera and t12.6, DoubleSide. Actual aRoot/aWind evaluated with source wind equations. Original core masks partitioned by nearest of the three cores; fine leaves from all three parts compete together. Per-leaf footprint counts each pixel once even when its own curved triangles overlap. Visible means frontmost against the selected cores, original tagged opaque flat laminae, selected near wood, and other fine leaves.',
    limitations:['No GPU float/postprocessing/MSAA/FXAA simulation; raster counts are geometric pixel estimates, not exact final-image segmentation.','Original alpha cards and unrelated world meshes are omitted, so unoccluded fine-leaf area is an upper bound before those objects.','Projected leaf-area sums include off-facing/back-of-core leaves where noted; area is not a guarantee of useful coverage.','No new density, geometry or rendering trial.']};
}
