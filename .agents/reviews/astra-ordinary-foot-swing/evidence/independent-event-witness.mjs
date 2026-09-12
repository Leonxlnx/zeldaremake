import fs from'node:fs';import path from'node:path';import ts from'typescript';import*as T from'three';import{execFileSync}from'node:child_process';
const repo='/workspace/scratch/0dfc487f788e/zeldaremake-resumed',candidate=path.resolve('review-candidate10'),cache=new Map();let frame=0,name='',intent={};const retired=[],completions=[],errors=[];let phaseCalls=0,activeCurveCalls=0;
globalThis.__phase=(x)=>{phaseCalls++;if(x.curve)activeCurveCalls++;if(x.curve&& !x.phaseSwinging && x.curve.end>x.time+1e-10)retired.push({case:name,frame,intent,...x});};
globalThis.__complete=(x)=>{if(!x.wasSwing)completions.push({case:name,frame,intent,...x});};
const samples=[],afters=[];globalThis.__after=x=>afters.push({case:name,frame,...x});globalThis.__sample=x=>samples.push({case:name,frame,...x});
function load(file){file=path.resolve(repo,file);if(cache.has(file))return cache.get(file).exports;let rel=path.relative(repo,file),base=path.basename(file),s=['play-pose.ts','foot-swing.ts','locomotion.ts'].includes(base)?fs.readFileSync(path.join(candidate,base),'utf8'):execFileSync('git',['show','9a317b873eae4a036e0ad179027201fdfdb217c1:'+rel],{cwd:repo,encoding:'utf8'});if(base==='play-pose.ts'){
const hook = `        let swinging = !settling && (phaseSwinging || f.curve !== null);`;
if(!s.includes(hook))throw new Error('phase instrumentation not installed');
s=s.replace(hook,`        globalThis.__phase({time:s.time,side:f.side,phase,duty,w,settling,phaseSwinging,wasSwing:f.swing,target:f.target.toArray(),curve:f.curve?{start:f.curve.start,end:f.curve.start+f.curve.duration,to:f.curve.to.toArray()}:null});
${hook}`);
const sample=`          sampleFootSwing(f.curve, s.time, f.target, f.velocity);`;
if(!s.includes(sample))throw new Error('sample instrumentation not installed');
s=s.replace(sample,`          globalThis.__sample({time:s.time,side:f.side,phase,phaseSwinging,ordinary,hasContext:!!context,stair:s.stairWeight,onStairs:context?.surface.onStairs(s.x,s.z),grounded:s.grounded,wasSwing:f.swing,to:f.curve.to.toArray(),end:f.curve.start+f.curve.duration});
${sample}`);
const complete=`          f.anchor.copy(f.target); f.curve = null; f.velocity.set(0, 0, 0);`;
if(!s.includes(complete))throw new Error('completion instrumentation not installed');
s=s.replace(complete,`          globalThis.__complete({time:s.time,side:f.side,wasSwing:f.swing,phaseSwinging,phase,duty,before:f.target.toArray(),to:f.curve.to.toArray(),curve:{start:f.curve.start,end:f.curve.start+f.curve.duration}});
${complete}`);
const after=`          f.swing = s.grounded && swinging;
        }
      }`;
if(!s.includes(after))throw new Error('after instrumentation not installed');
s=s.replace(after,`          f.swing = s.grounded && swinging;
        }
        globalThis.__after({time:s.time,side:f.side,root:[s.x,s.y,s.z],phase,phaseSwinging,ordinary,settling,swing:f.swing,curve:f.curve?{end:f.curve.start+f.curve.duration,to:f.curve.to.toArray()}:null,target:f.target.toArray(),anchor:f.anchor.toArray(),velocity:f.velocity.toArray()});
      }`);
}const m={exports:{}};cache.set(file,m);new Function('require','module','exports',ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(id=>id==='three'?T:load(path.resolve(path.dirname(file),id+'.ts')),m,m.exports);return m.exports;}
const {buildRig,LINK_PROPORTIONS}=load('src/world/character/rig.ts'),{createLocomotion,MOVE}=load('src/world/character/locomotion.ts'),{createPlayPose}=load('src/world/character/play-pose.ts');
const input=(x,z,run=false)=>({moveX:x,moveZ:z,run,jump:false});const cases=[{name:'run-leave-stair-band',fn:f=>input(0,1,true),onStairs:(x,z)=>z<1.4},{name:'walk-leave-stair-band',fn:f=>input(0,1),onStairs:(x,z)=>z<1.4},{name:'walk-turn90',fn:f=>f<180?input(0,1):input(1,0)},{name:'run-stop180',fn:f=>input(0,f<180?1:0,true)},{name:'run-stop165',fn:f=>input(0,f<165?1:0,true)},{name:'run-walk180',fn:f=>input(0,1,f<180)},{name:'walk-analogue180',fn:f=>input(0,f<180?1:.2)},{name:'unknown-context',fn:f=>input(0,1),cloneAfter:181},{name:'turn-into-stair-band',fn:f=>f<181?input(0,1,true):input(1,0,true),onStairs:(x,z)=>x>.1},{name:'walk-obstruction',fn:f=>input(0,1),blocked:(x,z)=>z>1.3}];
for(const test of cases){name=test.name;const flat={height:()=>0,onStairs:test.onStairs??(()=>false),blocked:test.blocked??(()=>false)},r=buildRig(LINK_PROPORTIONS,'witness'),c=createLocomotion(flat,0,0,0),p=createPlayPose(r,flat.height);for(frame=0;frame<420;frame++){intent=test.fn(frame);c.update(MOVE.fixedStep,intent,(s,dt)=>p.update(test.cloneAfter&&frame>=test.cloneAfter?{...s}:s,s.time,dt));}}
const outside=samples.filter(x=>!x.ordinary),unknown=samples.filter(x=>!x.hasContext),late=samples.filter(x=>x.time>x.end+1e-10); const stuck=afters.filter(x=>x.case==='turn-into-stair-band'&&x.side===1&&x.frame>=180),result={stuckContactWitnesses:stuck.filter(x=>[180,181,189,199,200,220,300,419].includes(x.frame)),outsideOrdinaryCount:outside.length,unknownContextCount:unknown.length,afterClockCount:late.length,firstOutside:outside[0],firstUnknown:unknown[0],firstLate:late[0],source:'9a317b8',candidate:'10',phaseCalls,activeCurveCalls,phaseEndedWithUnfinishedCurve:retired.length,staleCompletionCount:completions.length,firstRetired:retired[0],firstStale:completions[0],byCase:cases.map(x=>({case:x.name,retired:retired.filter(y=>y.case===x.name).length,stale:completions.filter(y=>y.case===x.name).length,outsideOrdinary:samples.filter(y=>y.case===x.name&&!y.ordinary).length,late:samples.filter(y=>y.case===x.name&&y.time>y.end+1e-10).length})),retired:retired.slice(0,12),completions:completions.slice(0,12),limits:'Live unchanged controller/rig, flat sampled surface, source instrumentation only; no mesh/render proof.'};fs.writeFileSync('independent-candidate10-review/event-witness.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,retired:undefined,completions:undefined},null,2));
