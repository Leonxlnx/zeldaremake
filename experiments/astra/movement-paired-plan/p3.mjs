import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import ts from 'typescript';
import * as THREE from 'three';
import {createFrozenForecast} from './forecast.mjs';
import {projectBridgeAmplitude} from './bridge-domain.mjs';
const folder=path.dirname(fileURLToPath(import.meta.url));
const outputDirectory=path.resolve(process.env.P3_OUTPUT_DIR??path.join(folder,'generated'));
fs.mkdirSync(outputDirectory,{recursive:true});
const source=path.join(folder,'source');
const fixtureFile=path.join(folder,'fixture.json');
const fixture=JSON.parse(fs.readFileSync(fixtureFile,'utf8'));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const beforeHashes={...fixture.provenance.physicalInputs,fixture:sha(fixtureFile)},sourceHashes={},cache=new Map();
function load(file){file=path.resolve(source,file);if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);sourceHashes[path.relative(source,file)]=sha(file);new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(id=>id==='three'?THREE:load(path.resolve(path.dirname(file),id+'.ts')),m,m.exports);return m.exports;}
const {advanceConfiguration}=load('src/world/character/air-configuration.ts');
const {rebaseConfigurationRates,configurationSoleVelocities}=load('src/world/character/contact-kinematics.ts');
const {strideLength}=load('src/world/character/locomotion.ts');
const {Vector3:V,Quaternion:Q}=THREE;
const dims={a:.23,b:.225,hipHalfWidth:.068,sole:new V(0,-.065,.025)};
const limits={planar:8,vertical:3,pelvis:3,knee:40.964617361572074,pitch:6,yaw:9,minLength:.015,maxLength:.453,radicand:1e-12};
const saved=fixture.accepted;
const target=new V().fromArray(fixture.preferredGoal);
const starts=saved.snapshot.feet.map(f=>new V().fromArray(f.position));
const velocities=saved.snapshot.feet.map(f=>new V().fromArray(f.velocity));
assert(saved.snapshot.feet.every(f=>f.rotation.every((v,i)=>v===(i===3?1:0))&&f.yawVelocity===0&&f.pitchVelocity===0));
const nominal=.52-.035-.04*saved.state.moveWeight-.01*saved.state.runWeight;
const work={forecastMs:0,planningAndChecksMs:0,supportDomainMs:0,bridgeProjectionMs:0,peakSelectionQueries:0,supportDomainPieces:0,supportDomainEndpointInversions:0,piecesBuilt:0,configurationLegReconstructions:0,endpointLegInversions:0,supportSampleLegInversions:0,configurationCalls:0,scalarCriticalEvaluations:0,pairedSamples:0,candidateCount:1,projectionIterations:0,stageCalls:0,bvhCalls:0};
const started=performance.now(),forecast=createFrozenForecast({horizon:.35});work.forecastMs=performance.now()-started;
assert.equal(forecast.status,'clear');
const dt=forecast.dt,leadT=1.5*Math.hypot(target.x-starts[0].x,target.z-starts[0].z)/8+dt;
// Frozen algebra's absolute horizontal anchor bound. This preference is not a support certificate.
const bridges=[];
const heightSettle=.100755/2;
const initialHeightCurve=cubic(saved.snapshot.height.height,saved.snapshot.height.velocity,nominal,0,heightSettle);
function originalHeight(t){return t<=heightSettle?scalar(initialHeightCurve,heightSettle,t):{p:nominal,v:0};}
// One pass through the support family; departures are selected from already existing body knots.
const supportDomains=[];
function deriveDeparture(start,nominalEnd,side,soleAnchor){
 const boundaries=[start,...forecast.knots.filter(t=>t>start+1e-12&&t<nominalEnd-1e-12),nominalEnd],ankle=soleAnchor.clone().sub(dims.sole),admitted=[];
 const endpoint=(time,sideOfKnot)=>{work.supportDomainEndpointInversions++;const b=body(time,sideOfKnot),h=originalHeight(time),d=b.hips.positions[side].clone().add(new V(0,h.p,0)).sub(ankle),hv=b.hips.velocities[side].clone().add(new V(0,h.v,0)),L=d.length();if(!(L>=limits.minLength&&L<=limits.maxLength))return{status:'reach',time,length:L};const flex=Math.acos((L*L-dims.a*dims.a-dims.b*dims.b)/(2*dims.a*dims.b)),velocity=-d.dot(hv)/(dims.a*dims.b*Math.sin(flex));return{status:'clear',time,flex,velocity,length:L,height:h};};
 for(let k=0;k<boundaries.length-1;k++){if(++work.supportDomainPieces>64)throw{kind:'support-domain-piece-budget'};const t0=boundaries[k],t1=boundaries[k+1],a=endpoint(t0,'right'),b=endpoint(t1,'left');let refusal=null,cert=null;if(a.status!=='clear'||b.status!=='clear')refusal={kind:'endpoint',a,b};else{const coeff=cubic(a.flex,a.velocity,b.flex,b.velocity,t1-t0);cert=extrema(coeff,t1-t0);if(cert.minimum<0||cert.maximum>Math.PI)refusal={kind:'support-flex-angular-range',certificate:cert};if(cert.maximumRate>limits.knee+1e-6)refusal={kind:'support-flex-rate',certificate:cert,coefficients:coeff};const lo=Math.sqrt(dims.a*dims.a+dims.b*dims.b+2*dims.a*dims.b*Math.cos(cert.maximum)),hi=Math.sqrt(dims.a*dims.a+dims.b*dims.b+2*dims.a*dims.b*Math.cos(cert.minimum));if(lo<limits.minLength||hi>limits.maxLength+1e-10)refusal={kind:'support-flex-reach',minLength:lo,maxLength:hi};}
  if(refusal){if(k===0)throw{kind:'support-domain-no-positive-piece',start,side,refusal};const result={side,start,nominalEnd,departure:t0,firstRefusal:{t0,t1,...refusal},admitted};supportDomains.push(result);return t0;}admitted.push({t0,t1,maximumRate:cert.maximumRate});}
 const result={side,start,nominalEnd,departure:nominalEnd,firstRefusal:null,admitted};supportDomains.push(result);return nominalEnd;
}
const domainStarted=performance.now();
const rightRelease=deriveDeparture(0,heightSettle,1,starts[1]);
const leftRelease=deriveDeparture(leadT,leadT+.04,0,target);
work.supportDomainMs=performance.now()-domainStarted;
const rightContact=leadT+.15,leftSecondContact=rightContact+.15,end=rightContact+.02;
const halfStride=.5*strideLength(saved.state.runWeight,saved.state.stairWeight);
const rightGoal=new V(starts[1].x,0,target.z+halfStride),leftSecondGoal=new V(starts[0].x,0,rightGoal.z+halfStride);
const events=[{t:0,kind:'left-liftoff'},{t:rightRelease,kind:'right-liftoff'},{t:leadT,kind:'left-touchdown'},{t:leftRelease,kind:'left-second-liftoff'},{t:rightContact,kind:'right-touchdown'}];
const swings=[{side:0,t0:0,t1:leadT,p0:starts[0],p1:target,v0:velocities[0]},{side:1,t0:rightRelease,t1:rightContact,p0:starts[1],p1:rightGoal,v0:velocities[1]},{side:0,t0:leftRelease,t1:leftSecondContact,p0:target,p1:leftSecondGoal,v0:new V()}];
function cubic(p,v,q,w,T){return[p,T*v,3*(q-p)-T*(2*v+w),2*(p-q)+T*(v+w)];}
function scalar(c,T,t){const u=t/T;return{p:((c[3]*u+c[2])*u+c[1])*u+c[0],v:(c[1]+2*c[2]*u+3*c[3]*u*u)/T};}
function bumpAt(t,b){if(t<=b.start||t>=b.end)return{p:0,v:0};const a=t<b.peak?scalar(cubic(0,0,1,0,b.peak-b.start),b.peak-b.start,t-b.start):scalar(cubic(1,0,0,0,b.end-b.peak),b.end-b.peak,t-b.peak);return a;}
function heightRef(t){const h=originalHeight(t);for(const b of bridges){const w=bumpAt(t,b);h.p-=b.amplitude*w.p;h.v-=b.amplitude*w.v;}return h;}
function planar(p,v,q,T,t){const ramp=.15*T,cruise=(q-p-.5*v*ramp)/(T-ramp);if(t<=0)return{p,v};if(t>=T)return{p:q,v:0};if(t<=ramp)return{p:p+v*t+.5*(cruise-v)*t*t/ramp,v:v+(cruise-v)*t/ramp};if(t<=T-ramp)return{p:p+.5*(v+cruise)*ramp+cruise*(t-ramp),v:cruise};return{p:q-.5*cruise*(T-t)**2/ramp,v:cruise*(T-t)/ramp};}
function swingAt(s,t){const T=s.t1-s.t0,u=t-s.t0,upT=.45*T,apex=.045;const x=planar(s.p0.x,s.v0.x,s.p1.x,T,u),z=planar(s.p0.z,s.v0.z,s.p1.z,T,u);const y=u<=upT?scalar(cubic(s.p0.y,s.v0.y,apex,0,upT),upT,Math.max(0,u)):scalar(cubic(apex,0,s.p1.y,0,T-upT),T-upT,Math.min(T-upT,u-upT));return{p:new V(x.p,y.p,z.p),v:new V(x.v,y.v,z.v)};}
function footRef(side,t){if(side===0){if(t<=leadT)return swingAt(swings[0],t);if(t<leftRelease)return{p:target.clone(),v:new V()};return swingAt(swings[2],t);}if(t<rightRelease)return{p:starts[1].clone(),v:new V()};if(t<=rightContact)return swingAt(swings[1],t);return{p:rightGoal.clone(),v:new V()};}
function supportAt(t){if(t<rightRelease)return 1;if(t>=leadT&&t<leftRelease)return 0;if(t>=rightContact)return 1;return -1;}
function body(t,side){const b=forecast.bodyAt(t,side);if(b.status&&b.status!=='clear')throw{kind:'body-unavailable',t,detail:b};return b;}
function configAt(b,h,feet,purpose='endpoint'){const result=[];for(let i=0;i<2;i++){work.configurationLegReconstructions++;if(purpose==='endpoint'){if(++work.endpointLegInversions>256)throw{kind:'endpoint-inversion-budget'};}else if(++work.supportSampleLegInversions>1536)throw{kind:'support-inversion-budget'};const hip=b.hips.positions[i].clone().add(new V(0,h.p,0));const d=feet[i].p.clone().sub(dims.sole).sub(hip),length=d.length();if(!(length>=limits.minLength&&length<=limits.maxLength))throw{kind:'knot-leg-reach',side:i,length,limit:limits.maxLength,height:h,foot:feet[i].p.toArray(),hip:hip.toArray()};const cosine=(length*length-dims.a*dims.a-dims.b*dims.b)/(2*dims.a*dims.b),flex=Math.acos(cosine);result.push({direction:d.divideScalar(length).applyAxisAngle(new V(0,1,0),-b.request.visualYaw),directionVelocity:new V(),flex,flexVelocity:0,footRotation:new Q(),footAngularVelocity:new V()});}const worldHipVelocity=b.hips.velocities.map(v=>v.clone().add(new V(0,h.v,0)));const rates=rebaseConfigurationRates(result,b.request.visualYaw,b.yawRate??0,worldHipVelocity,feet.map(f=>f.v),dims);if(rates.status!=='clear')throw{kind:'knot-rate-rebase',detail:rates};return rates.configuration;}
function extrema(c,T){const u=[0,1];if(c[3]!==0){const x=-c[2]/(3*c[3]);if(x>0&&x<1)u.push(x);}const values=[0,1],A=3*c[3],B=2*c[2],C=c[1];if(A===0){if(B!==0){const x=-C/B;if(x>0&&x<1)values.push(x);}}else{const d=B*B-4*A*C;if(d>=0)for(const x of[(-B-Math.sqrt(d))/(2*A),(-B+Math.sqrt(d))/(2*A)])if(x>0&&x<1)values.push(x);}work.scalarCriticalEvaluations+=u.length+values.length;const rates=u.map(x=>({time:x*T,...scalar(c,T,x*T)})),points=values.map(x=>({time:x*T,...scalar(c,T,x*T)}));return{maximumRate:Math.max(...rates.map(x=>Math.abs(x.v))),minimum:Math.min(...points.map(x=>x.p)),maximum:Math.max(...points.map(x=>x.p)),rates,points};}
const bridgeStarted=performance.now();
let bridgeFailure=null;
for(const interval of[{start:rightRelease,end:leadT},{start:leftRelease,end:rightContact}]){
 const baseTimes=Array.from({length:Math.ceil((interval.end-interval.start)/.004)+1},(_,i,a)=>0);
 const N=Math.ceil((interval.end-interval.start)/.004),scanTimes=Array.from({length:N+1},(_,i)=>interval.start+(interval.end-interval.start)*i/N);
 let minimumCeiling=Infinity,peak=null;
 for(const t of scanTimes.slice(1,-1)){work.peakSelectionQueries++;const b=body(t,'right');for(let i=0;i<2;i++){const f=footRef(i,t),d=b.hips.positions[i].clone().sub(f.p.clone().sub(dims.sole)),square=limits.maxLength**2-d.x*d.x-d.z*d.z;if(square<=0){bridgeFailure={kind:'bridge-horizontal-domain',t,side:i,square};break;}const ceiling=f.p.y-dims.sole.y-b.hips.positions[i].y+Math.sqrt(square);if(ceiling<minimumCeiling){minimumCeiling=ceiling;peak=t;}}if(bridgeFailure)break;}
 if(bridgeFailure)break;
 const proposal={...interval,peak,minimumCeiling},times=scanTimes.map(t=>({t,side:t===interval.end?'left':'right'}));
 for(const t of forecast.knots)if(t>interval.start+1e-12&&t<interval.end-1e-12)times.push({t,side:'left'},{t,side:'right'});
 for(const t of[peak,heightSettle,...swings.flatMap(s=>[s.t0+.15*(s.t1-s.t0),s.t0+.45*(s.t1-s.t0),s.t0+.85*(s.t1-s.t0)])])if(t>interval.start&&t<interval.end)times.push({t,side:'right'});
 times.sort((a,b)=>a.t-b.t||(a.side==='left'?-1:1));const unique=times.filter((x,i)=>!i||Math.abs(x.t-times[i-1].t)>1e-12||x.side!==times[i-1].side);
 const projection=projectBridgeAmplitude({times:unique,sample:time=>{const b=body(time.t,time.side),h=originalHeight(time.t),w=bumpAt(time.t,proposal),legs=[0,1].map(i=>{const f=footRef(i,time.t),d=b.hips.positions[i].clone().add(new V(0,h.p,0)).sub(f.p.clone().sub(dims.sole)),v=b.hips.velocities[i].clone().add(new V(0,h.v,0)).sub(f.v);return{dy:d.y,vdy:v.y,horizontalSq:d.x*d.x+d.z*d.z,horizontalDot:d.x*v.x+d.z*v.z};});return{height:h.p,heightVelocity:h.v,rootYdot:b.rootYdot,bump:w.p,bumpVelocity:w.v,legs};}});
 if(projection.status!=='clear'){bridgeFailure={kind:'bridge-amplitude-domain',proposal,projection};break;}bridges.push({...proposal,amplitude:projection.amplitude,projection});
}
work.bridgeProjectionMs=performance.now()-bridgeStarted;
const rawKnots=[0,end,heightSettle,...bridges.map(b=>b.peak),...forecast.knots.filter(t=>t>0&&t<end),...events.map(e=>e.t)];for(const s of swings){const T=s.t1-s.t0;for(const u of[0,.15,.45,.85,1]){const t=s.t0+u*T;if(t>0&&t<end)rawKnots.push(t);}}
rawKnots.sort((a,b)=>a-b);const knots=rawKnots.filter((x,i)=>i===0||x-rawKnots[i-1]>1e-12);assert(end<=.35&&knots.length-1<=64);
let failure=bridgeFailure;const pieces=[],samples=[],maxima={planar:0,vertical:0,pelvis:0,knee:0},minima={soleY:Infinity,radicand:Infinity,length:Infinity},endpointErrors={position:0,velocity:0,height:0,heightVelocity:0};
const planStarted=performance.now();
function sample(piece,t){work.pairedSamples++;if(work.pairedSamples>768)throw{kind:'numerical-budget',pairedSamples:work.pairedSamples};const q=t-piece.t0,b=body(t,t===piece.t1?'left':'right'),configuration=piece.c0.map((c,i)=>{work.configurationCalls++;const result=advanceConfiguration([c,c],[piece.c1[i],piece.c1[i]],piece.T,q);if(result.status!=='clear')throw{kind:'configuration-curve',side:i,t,detail:result};return result.configuration[0];});let h=heightRef(t),radicand=null;
 if(piece.support>=0){const side=piece.support,ankle=footRef(side,(piece.t0+piece.t1)*.5).p.sub(dims.sole),hip=b.hips.positions[side],hv=b.hips.velocities[side],f=configuration[side],dx=ankle.x-hip.x,dz=ankle.z-hip.z;radicand=dims.a*dims.a+dims.b*dims.b+2*dims.a*dims.b*Math.cos(f.flex)-dx*dx-dz*dz;if(!(radicand>limits.radicand))throw{kind:'support-radicand',t,radicand};const y=Math.sqrt(radicand);h={p:ankle.y-hip.y+y,v:-hv.y+(-dims.a*dims.b*Math.sin(f.flex)*f.flexVelocity+dx*hv.x+dz*hv.z)/y};const refs=configuration.map((_,i)=>footRef(i,t));refs[side]={p:ankle.clone().add(dims.sole),v:new V()};const exact=configAt(b,h,refs,'support');configuration[side]=exact[side];}
 const hips=b.hips.positions.map(v=>v.clone().add(new V(0,h.p,0))),hipVel=b.hips.velocities.map(v=>v.clone().add(new V(0,h.v,0))),velocityResult=configurationSoleVelocities(configuration,b.request.visualYaw,b.yawRate??0,hipVel,dims);if(velocityResult.status!=='clear')throw{kind:'world-velocity',t,detail:velocityResult};const feet=configuration.map((c,i)=>{const L=Math.sqrt((dims.a-dims.b)**2+4*dims.a*dims.b*Math.cos(c.flex*.5)**2),p=hips[i].clone().add(c.direction.clone().applyAxisAngle(new V(0,1,0),b.request.visualYaw).multiplyScalar(L)).add(dims.sole);return{position:p.toArray(),velocity:velocityResult.velocities[i].toArray(),length:L,kneeRate:c.flexVelocity,flex:c.flex};});
 const row={t,support:piece.support,height:h.p,heightVelocity:h.v,radicand,feet};samples.push(row);const pelvis=Math.abs(h.v-b.rootYdot);maxima.pelvis=Math.max(maxima.pelvis,pelvis);if(pelvis>limits.pelvis+1e-6)throw{kind:'pelvis-rate',t,value:pelvis,limit:limits.pelvis,row};if(h.p<0||h.p>.64)throw{kind:'height-domain',t,height:h.p};if(radicand!==null)minima.radicand=Math.min(minima.radicand,radicand);
 for(let i=0;i<2;i++){const f=feet[i],planarSpeed=Math.hypot(f.velocity[0],f.velocity[2]),verticalSpeed=Math.abs(f.velocity[1]);maxima.planar=Math.max(maxima.planar,planarSpeed);maxima.vertical=Math.max(maxima.vertical,verticalSpeed);maxima.knee=Math.max(maxima.knee,Math.abs(f.kneeRate));minima.soleY=Math.min(minima.soleY,f.position[1]);minima.length=Math.min(minima.length,f.length);if(f.length>limits.maxLength+1e-10||f.length<limits.minLength-1e-10)throw{kind:'sample-leg-reach',side:i,t,value:f.length};if(planarSpeed>8+1e-6||verticalSpeed>3+1e-6)throw{kind:'sole-speed',side:i,t,planarSpeed,verticalSpeed,row};if(Math.abs(f.kneeRate)>limits.knee+1e-6)throw{kind:'knee-rate',side:i,t,value:f.kneeRate,row};if(f.position[1]<-1e-6)throw{kind:'sole-floor',side:i,t,value:f.position[1],row};}
 if(t===piece.t0||t===piece.t1){const refs=[footRef(0,t),footRef(1,t)],href=heightRef(t);endpointErrors.height=Math.max(endpointErrors.height,Math.abs(h.p-href.p));endpointErrors.heightVelocity=Math.max(endpointErrors.heightVelocity,Math.abs(h.v-href.v));for(let i=0;i<2;i++){endpointErrors.position=Math.max(endpointErrors.position,new V().fromArray(feet[i].position).distanceTo(refs[i].p));endpointErrors.velocity=Math.max(endpointErrors.velocity,new V().fromArray(feet[i].velocity).distanceTo(refs[i].v));}}
 return row;}
let cursor=0;try{if(bridgeFailure)throw bridgeFailure;for(let k=0;k<knots.length-1;k++){const t0=knots[k],t1=knots[k+1],T=t1-t0;cursor=t0;const c0=configAt(body(t0,'right'),heightRef(t0),[footRef(0,t0),footRef(1,t0)]),c1=configAt(body(t1,'left'),heightRef(t1),[footRef(0,t1),footRef(1,t1)]),piece={t0,t1,T,support:supportAt((t0+t1)*.5),c0,c1,certificates:[]};work.piecesBuilt++;for(let i=0;i<2;i++){const coeff=cubic(c0[i].flex,c0[i].flexVelocity,c1[i].flex,c1[i].flexVelocity,T),cert=extrema(coeff,T);piece.certificates.push({side:i,coefficients:coeff,...cert});if(cert.minimum<0||cert.maximum>Math.PI)throw{kind:'analytic-flex-angular-range',piece:k,t0,t1,side:i,certificate:cert};if(cert.maximumRate>limits.knee+1e-6)throw{kind:'analytic-flex-rate',piece:k,t0,t1,side:i,value:cert.maximumRate,limit:limits.knee,certificate:cert};const minL=Math.sqrt(dims.a*dims.a+dims.b*dims.b+2*dims.a*dims.b*Math.cos(cert.maximum)),maxL=Math.sqrt(dims.a*dims.a+dims.b*dims.b+2*dims.a*dims.b*Math.cos(cert.minimum));if(minL<limits.minLength||maxL>limits.maxLength+1e-10)throw{kind:'analytic-flex-reach',piece:k,t0,t1,side:i,minL,maxL,certificate:cert};}pieces.push(piece);const N=Math.ceil(T/.0005);for(let j=0;j<=N;j++){cursor=j===N?t1:t0+T*j/N;sample(piece,cursor);}}}catch(e){failure=e instanceof Error?{kind:'prototype-exception',message:e.message,stack:e.stack}:e;failure.detectedDuringTime=cursor;}
work.planningAndChecksMs=performance.now()-planStarted;work.configurationLegCurveEvaluations=work.configurationCalls*2;work.totalNumericalMs=work.forecastMs+work.supportDomainMs+work.bridgeProjectionMs+work.planningAndChecksMs;
assert.equal(sha(fixtureFile),beforeHashes.fixture);for(const[f,h]of Object.entries(sourceHashes))assert.equal(sha(path.join(source,f)),h);
const output={status:failure?'refused':'finite-prefix-clear',family:'P3 joint overlap amplitude domain',immutableInputs:beforeHashes,sourceHashes,limits,parameters:{dt,nominal,leadT,rightRelease,leftRelease,rightContact,leftSecondContact,end,halfStride,originalLeftTarget:target.toArray(),rightGoal:rightGoal.toArray(),leftSecondGoal:leftSecondGoal.toArray(),apex:.045,apexFraction:.45},events,supportDomains,bridges,knots,work,maxima,minima,endpointErrors,failure,pieces,samples,scope:'One deterministic family; exact scalar flex certificates, finite ≤0.5 ms world kinematic coverage only. No rig/stage/BVH or actual boot/calf geometry. Future left touchdown beyond horizon is unassessed. No actual contact events or physical state committed.'};
fs.writeFileSync(path.join(outputDirectory,'p3-result.json'),JSON.stringify(output,null,2));console.log(JSON.stringify({status:output.status,parameters:output.parameters,bridges,work,maxima,minima,endpointErrors,failure},null,2));
