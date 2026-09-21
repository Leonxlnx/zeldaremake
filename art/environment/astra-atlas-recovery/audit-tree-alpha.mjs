// CPU lower-bound coverage of the actual ordinary cluster texture's opaque fills.
// No Canvas/GPU rendering: records actual source paths with 128 subdivisions per quadratic.
// Ignores strokes/gradients (which can only add alpha), mip filtering and GPU wind.
import fs from 'node:fs';
import cp from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import * as THREE from 'three';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../../..');
const ref = process.argv[2] ?? '24dc4cac';
function load(file) {
  const source = cp.execFileSync('git', ['-C', root, 'show', `${ref}:${file}`], { encoding: 'utf8' });
  const m = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(n => { if (n === 'three') return THREE; throw Error(n); }, m, m.exports);
  return m.exports;
}
const paths = [], stack = [];
let matrix = [1,0,0,1,0,0], polygon = [];
const point = (x,y) => [matrix[0]*x+matrix[2]*y+matrix[4], matrix[1]*x+matrix[3]*y+matrix[5]];
const ctx = {
  clearRect() {}, stroke() {}, closePath() {},
  save() { stack.push([...matrix]); }, restore() { matrix = stack.pop(); },
  translate(x,y) { [matrix[4],matrix[5]] = point(x,y); },
  rotate(a) { const [aa,b,c,d,e,f]=matrix, co=Math.cos(a),si=Math.sin(a); matrix=[aa*co+c*si,b*co+d*si,-aa*si+c*co,-b*si+d*co,e,f]; },
  beginPath() { polygon=[]; }, moveTo(x,y) { polygon.push(point(x,y)); }, lineTo(x,y) { polygon.push(point(x,y)); },
  quadraticCurveTo(cx,cy,x,y) { const a=polygon.at(-1),b=point(cx,cy),c=point(x,y); for(let i=1;i<=128;i++){const t=i/128,s=1-t;polygon.push([s*s*a[0]+2*s*t*b[0]+t*t*c[0],s*s*a[1]+2*s*t*b[1]+t*t*c[1]]);} },
  fill() { if (typeof this.fillStyle === 'string' && this.fillStyle.startsWith('rgb(')) paths.push(polygon); },
  fillRect() {}, createLinearGradient() { return {addColorStop(){}}; },
};
globalThis.document = { createElement: () => ({width:0,height:0,getContext:()=>ctx}) };
const { WORLD } = load('src/world/config.ts');
const { createRng } = load('src/world/util/prng.ts');
load('src/world/trees/leaf-cluster-texture.ts').createLeafClusterTexture(createRng(WORLD.seed).fork('trees/leaf-cluster'), WORLD.palette);
function inside(p, poly) { let odd=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1]) && p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])odd=!odd;}return odd; }
function edgeDistance(p,poly) { let best=Infinity;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],dx=b[0]-a[0],dy=b[1]-a[1],d=dx*dx+dy*dy,t=d?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/d)):0;best=Math.min(best,Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy));}return best; }
const graph = JSON.parse(fs.readFileSync(path.join(here,'audit-tree-identity.json')));
const samples=[];
for(const [view,rows] of Object.entries(graph.views))for(const row of rows)for(const hit of row.hits){
  if(hit.materialRole !== 'giantCanopy' || hit.flat)continue;
  const p=[hit.uv[0]*512,(1-hit.uv[1])*512];
  const coverage=paths.map((poly,i)=>inside(p,poly)?{leaf:i,marginTexels:edgeDistance(p,poly)}:null).filter(Boolean);
  samples.push({view,pixel:row.pixel,object:hit.object,distance:hit.distance,uv:hit.uv,opaqueFillCount:coverage.length,maxInteriorMarginTexels:Math.max(0,...coverage.map(x=>x.marginTexels)),coverage});
}
const result={sourceRef:ref,opaqueFillCount:paths.length,method:'Exact source calls and PRNG; quadratic fills polygonized to 128 intervals; strokes/gradients ignored. Texture-space coverage lower bound, not a rendered-fragment certificate.',samples};
fs.writeFileSync(path.join(here,'audit-tree-alpha.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
