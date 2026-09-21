// Diagnostic only: exact FrontSide downward hits on static world-space triangle meshes.
// Buckets hold triangle references, not sampled heights. No Three.js/WebGL dependency.
export function buildFrontSideHeightSampler(meshes,cell=.1){
  const buckets=new Map(),triangles=[];
  for(const mesh of meshes){
    const e=mesh.matrixWorld?.elements;
    if(e&&e.some((v,i)=>Math.abs(v-(i%5===0?1:0))>1e-12))throw new Error('Exact height fixture requires identity world matrices: '+mesh.name);
    const g=mesh.geometry,p=g.attributes.position,idx=g.index,n=idx?.count??p.count;
    for(let i=0;i<n;i+=3){
      const ids=[0,1,2].map(k=>idx?idx.getX(i+k):i+k),v=ids.map(i=>[p.getX(i),p.getY(i),p.getZ(i)]),[a,b,c]=v;
      const det=(b[0]-a[0])*(c[2]-a[2])-(c[0]-a[0])*(b[2]-a[2]);
      if(det>=-1e-12)continue;
      const id=triangles.length;triangles.push({a,b,c,det,mesh:mesh.name});
      const x0=Math.floor(Math.min(...v.map(v=>v[0]))/cell),x1=Math.floor(Math.max(...v.map(v=>v[0]))/cell),z0=Math.floor(Math.min(...v.map(v=>v[2]))/cell),z1=Math.floor(Math.max(...v.map(v=>v[2]))/cell);
      for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++){
        const key=x+','+z;let list=buckets.get(key);if(!list)buckets.set(key,list=[]);list.push(id);
      }
    }
  }
  const sample=(x,z)=>{
    let best=null;
    for(const id of buckets.get(Math.floor(x/cell)+','+Math.floor(z/cell))??[]){
      const {a,b,c,det,mesh}=triangles[id],u=((x-a[0])*(c[2]-a[2])-(c[0]-a[0])*(z-a[2]))/det,v=((b[0]-a[0])*(z-a[2])-(x-a[0])*(b[2]-a[2]))/det,w=1-u-v;
      if(Math.min(u,v,w)<-1e-8)continue;
      const y=a[1]*w+b[1]*u+c[1]*v;if(!best||y>best.y)best={y,mesh};
    }
    return best;
  };
  return {sample,triangleCount:triangles.length,bucketCount:buckets.size};
}
