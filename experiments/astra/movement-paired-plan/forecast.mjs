import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';
import * as T from 'three';
import {fileURLToPath} from 'node:url';

const hash=text=>crypto.createHash('sha256').update(text).digest('hex');
const kernels=new Map();
function kernel(sourceRoot){
  sourceRoot=path.resolve(sourceRoot);if(kernels.has(sourceRoot))return kernels.get(sourceRoot);
  const hashes={},cache=new Map();
  function read(relative){const text=fs.readFileSync(path.join(sourceRoot,relative),'utf8');hashes[relative]=hash(text);return text;}
  function load(relative){if(cache.has(relative))return cache.get(relative);const text=read(relative),m={exports:{}};cache.set(relative,m.exports);
    new Function('require','module','exports',ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText)(id=>id==='three'?T:load(path.posix.normalize(path.posix.join(path.posix.dirname(relative),id+'.ts'))),m,m.exports);cache.set(relative,m.exports);return m.exports;}
  const relative='src/world/character/locomotion.ts',text=read(relative),ast=ts.createSourceFile(relative,text,ts.ScriptTarget.Latest,true);
  const factory=ast.statements.find(s=>ts.isFunctionDeclaration(s)&&s.name?.text==='createLocomotion');
  const declarations=factory.body.statements.filter(s=>ts.isVariableStatement(s)&&s.declarationList.declarations.some(d=>['offsets','blocked','pathBlocked','tick'].includes(d.name.getText(ast)))).map(s=>s.getText(ast)).join('\n');
  const returned=factory.body.statements.find(s=>ts.isReturnStatement(s)&&s.expression&&ts.isObjectLiteralExpression(s.expression));
  const update=returned.expression.properties.find(p=>p.name?.getText(ast)==='update');
  const updateBody=update.body.getText(ast).slice(1,-1).replaceAll('return state;','return {state,temporal:{remainder,jumpHeld,buffered,coyote}};');
  const extracted=text.slice(0,factory.getFullStart())+`\nexport function advance(snapshot,dt,input,surface){
    const state={...snapshot.state}; let {remainder,jumpHeld,buffered,coyote}=snapshot.temporal;
    const onStep=undefined;\n${declarations}\n${updateBody}\n}`;
  const module={exports:{}};new Function('require','module','exports',ts.transpileModule(extracted,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText)(()=>{throw Error('Unexpected runtime import in physics extraction');},module,module.exports);
  const curves=load('src/world/character/ordinary-body-curve.ts');
  // These files establish the authored body endpoint formula/transition contract.
  read('src/world/character/play-pose.ts');read('src/world/character/animation.ts');
  const result={advance:module.exports.advance,MOVE:module.exports.MOVE,curves,hashes,verify(){for(const [file,digest] of Object.entries(hashes))if(hash(fs.readFileSync(path.join(sourceRoot,file)))!==digest)throw Error('Frozen source changed: '+file);}};
  kernels.set(sourceRoot,result);return result;
}
const asV=v=>v?.clone?v.clone():Array.isArray(v)?new T.Vector3().fromArray(v):new T.Vector3(v.x,v.y,v.z);
const asQ=q=>q?.clone?q.clone():Array.isArray(q)?new T.Quaternion().fromArray(q):new T.Quaternion(q.x,q.y,q.z,q.w);
function request(p){return {root:asV(p.root),visualYaw:p.visualYaw,hipsLocal:asV(p.hipsLocal),hipsRotation:asQ(p.hipsRotation),soles:p.soles.map(s=>({position:asV(s.position),rotation:asQ(s.rotation)})),...(p.poles?{poles:p.poles.map(asV)}:{})};}

/** Frozen-fixture, held-intent forecast. No live controller, rig, or RNG is used.
 * Missing intent/private clock/upper transition is an API-domain failure, not a new physical guard.
 */
export function createHeldIntentBodyForecast(input){
  const before=JSON.stringify(input),k=kernel(input.sourceRoot),dt=k.MOVE.fixedStep,horizon=input.horizon??.35;
  if(!input.temporal||input.temporal.remainder!==0||input.temporal.buffered!==0||input.temporal.jumpHeld!==false||!Number.isFinite(input.temporal.coyote))return {status:'unavailable',reason:'missing-or-incompatible-controller-clock'};
  if(!input.intent||input.intent.jump!==false||input.upperTransitionComplete!==true||input.surfaceKind!=='flat-zero'||!input.state.grounded||input.state.y!==0||input.state.vy!==0)return {status:'unavailable',reason:'fixture-intent-surface-or-upper-transition'};
  const heading=Math.atan2(input.intent.moveX,input.intent.moveZ),angle=d=>Math.atan2(Math.sin(d),Math.cos(d));
  if(Math.hypot(input.intent.moveX,input.intent.moveZ)<=.05||Math.abs(angle(heading-input.state.yaw))>1e-12||Math.abs(angle(input.acceptedRequest.visualYaw-input.state.yaw))>1e-12)return {status:'unavailable',reason:'unresolved-visual-yaw-admission'};
  const count=Math.round(horizon/dt);if(!(horizon>0&&horizon<=.35+1e-12)||Math.abs(count*dt-horizon)>1e-12)return {status:'unavailable',reason:'horizon-must-end-on-fixed-tick-at-most-350ms'};
  const baseline=request(input.acceptedRequest),previous=request(input.previousRequest),half=input.hipHalfWidth??.068,sole=new T.Vector3().fromArray(input.soleOffset??[0,-.065,.025]);
  const states=[structuredClone(input.state)],endpoints=[baseline],pieces=[];
  let snapshot={state:structuredClone(input.state),temporal:structuredClone(input.temporal)};
  const surface=Object.freeze({height:()=>0,blocked:()=>false,onStairs:()=>false});
  for(let i=0;i<count;i++){
    snapshot=k.advance(snapshot,dt,input.intent,surface);const s=snapshot.state;
    if(!s.grounded)return {status:'unavailable',reason:'future-ground-transition',tick:i+1};
    states.push({...s});const p=request(baseline),wave=Math.sin(s.phase*(Math.PI*2)),w=s.moveWeight;
    p.root.set(s.x,s.y,s.z);p.visualYaw=s.yaw;p.hipsLocal.x=.012*Math.sin(s.time*.45)*(1-s.moveWeight);p.hipsLocal.z=0;
    p.hipsRotation.setFromEuler(new T.Euler(0,.045*wave*w,.022*wave*w));endpoints.push(p);
  }
  const make=(from,to,index)=>({index,start:index*dt,end:(index+1)*dt,from,to,
    curve:k.curves.createOrdinaryBodyCurve(from,to,dt,half,sole),rootVelocity:to.root.clone().sub(from.root).divideScalar(dt),
    yawRate:angle(to.visualYaw-from.visualYaw)/dt,localOmega:k.curves.rotationVector(from.hipsRotation,to.hipsRotation).divideScalar(dt)});
  const incoming=make(previous,baseline,-1);for(let i=0;i<count;i++)pieces.push(make(endpoints[i],endpoints[i+1],i));
  const held=baseline.soles.map(s=>({...s,velocity:new T.Vector3(),angularVelocity:new T.Vector3()}));
  function bodyAt(time,side='right'){
    if(!Number.isFinite(time)||time<0||time>horizon||!['left','right'].includes(side))return {status:'unavailable',reason:'sample-domain'};
    let scaled=time/dt;const nearest=Math.round(scaled);if(Math.abs(scaled-nearest)<1e-10)scaled=nearest;
    let index=Math.floor(scaled);if(Number.isInteger(scaled)&&side==='left')index--;
    if(index>=count)return {status:'unavailable',reason:'outgoing-chord-beyond-horizon',time};
    const piece=index<0?incoming:pieces[index],elapsed=time-piece.start,p=piece.curve.at(elapsed,held);
    const worldOmega=piece.localOmega.clone().applyAxisAngle(new T.Vector3(0,1,0),p.request.visualYaw).add(new T.Vector3(0,piece.yawRate,0));
    // The helper deliberately leaves shared H/Hdot unknown. H=0 request and hip bases expose no guessed height.
    p.request.hipsLocal.y=-p.request.root.y;
    return {status:'clear',time,absoluteTime:input.state.time+time,chordIndex:index,chordStart:piece.start,chordEnd:piece.end,side,
      request:p.request,rootYdot:piece.rootVelocity.y,rootVelocity:piece.rootVelocity.clone(),yawRate:piece.yawRate,hipsOmega:worldOmega,
      hipBase:p.hips.positions.map(v=>v.clone()),hipVelocity:p.hips.velocities.map(v=>v.clone()),hips:{positions:p.hips.positions.map(v=>v.clone()),velocities:p.hips.velocities.map(v=>v.clone())},
      note:'hipBase is world hip position at shared world pelvis H=0; add H to Y and Hdot to velocity Y. request.soles are retained placeholders, not a forecast.'};
  }
  k.verify();if(JSON.stringify(input)!==before)throw Error('Forecast mutated input');
  return {status:'clear',dt,horizon,states,knots:Array.from({length:count+1},(_,i)=>i*dt),bodyAt,sourceHashes:{...k.hashes},verifySources:k.verify,
    initialHeight:structuredClone(input.initialHeight??null),domain:'Conditional held supplied intent, flat-zero fixture, complete ordinary upper transition and aligned visual yaw; no future physical contact or paired-pose admission.'};
}

/** Convenience fixture entry point. Future history is never an input to prediction. */
export function createFrozenForecast({horizon=.35}={}){
  const folder=path.dirname(fileURLToPath(import.meta.url));
  const gate=fs.readFileSync(path.join(folder,'fixture.json'));
  const fixture=JSON.parse(gate);
  const accepted=fixture.accepted,previous=fixture.previous;
  if(!accepted||!previous)return {status:'unavailable',reason:'missing-accepted-58-59'};
  const result=createHeldIntentBodyForecast({sourceRoot:path.join(folder,'source'),state:accepted.state,
    previousRequest:previous.snapshot.request,acceptedRequest:accepted.snapshot.request,initialHeight:accepted.snapshot.height,
    temporal:{remainder:0,jumpHeld:false,buffered:0,coyote:.10},intent:{moveX:0,moveZ:1,run:true,jump:false},
    upperTransitionComplete:true,surfaceKind:'flat-zero',horizon,hipHalfWidth:.068,soleOffset:[0,-.065,.025]});
  if(result.status==='clear')result.fixture={acceptedFrame:59,previousFrame:58,gateSha256:fixture.provenance.forecastInput,compactFixtureSha256:hash(gate),
    temporalProvenance:'After completed fixed tick59; original runner has jump=false throughout0–59, grounded/no jump history, zero accumulated remainder; flat fixture and held run intent are explicit runner inputs.'};
  return result;
}
