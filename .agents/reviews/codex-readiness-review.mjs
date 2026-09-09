// CPU-only failure-path diagnostic. Real assembler/API, injected factories; no rendering.
// Run: node .agents/reviews/codex-readiness-review.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import * as THREE from 'three';
const compile = (file, imports) => {
  const m={exports:{}};
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('require','module','exports',code)(name=>{
    if(name==='three')return THREE;
    if(name in imports)return imports[name];
    throw Error(`Unexpected dependency ${name}`);
  },m,m.exports);
  return m.exports;
};
const names=['lighting','atmosphere','terrain','hardscape','rocks','structures','trees','vegetation','props'];
const errors=[];
const originalError=console.error, originalInfo=console.info;
const terrain={height:()=>0,slope:()=>0,mask:()=>({})};
const imports={
  './config':{WORLD:{seed:'diagnostic'}},'./layout':{LAYOUT:{viewpoints:[],stairs:[]}},
  './terrain/heightfield':{getTerrain:()=>terrain},'./wind/wind':{createWind:()=>({update(){}})},
  './util/prng':{createRng:()=>({})},'./materials/textures':{createTextureLibrary:()=>({})},
};
let injected = new Map();
const called = [];
for (const name of names) imports[`./${name}`] = { create: ctx => {
  called.push(name);
  const failure = injected.get(name);
  if (failure === 'sync') throw Error(`injected ${name} sync failure`);
  if (failure === 'async') return Promise.reject(Error(`injected ${name} async failure`));
  ctx.audit(name, () => ({ built: true }));
  return { name, group: new THREE.Group() };
}};
const { createWorld, qualityFor } = compile('src/world/index.ts', imports);
const { installCaptureApi } = compile('src/capture/api.ts', { '../world/layout': imports['./layout'] });
const originalWindow = globalThis.window;
const originalWarn = console.warn;
const warnings = [];
const summaries = [];
try {
  globalThis.window = {};
  console.error = (...args) => errors.push(args.map(String).join(' '));
  console.info = () => {};
  console.warn = (...args) => warnings.push(args.map(String).join(' '));
  for (const headless of [true, false]) {
    for (const failing of [false, true]) {
      injected = failing ? new Map([['terrain', 'sync'], ['vegetation', 'async']]) : new Map();
      called.length = errors.length = warnings.length = 0;
      const scene = new THREE.Scene(), audits = new Map(), camera = new THREE.PerspectiveCamera();
      const renderer = { capabilities: { getMaxAnisotropy: () => 1 } };
      const world = await createWorld({ scene, renderer, camera, quality: qualityFor('low'), headless, audits });
      assert.deepEqual(called, names, 'Later systems still run after a rejected factory');
      const expectedNames = failing ? ['terrain', 'vegetation'] : [];
      assert.deepEqual(world.failures.map(f => f.name), expectedNames, 'Both failure types survive later successes');
      assert.deepEqual(world.systems.map(s => s.name), names.filter(n => !injected.has(n)));
      assert.equal(world.systems.at(-1).name, 'props', 'Success after both failures remains available interactively');
      assert.equal(errors.length, expectedNames.length);
      for (const failure of world.failures) {
        assert.match(failure.error, new RegExp(`injected ${failure.name} ${injected.get(failure.name)} failure`));
      }
      const api = installCaptureApi({ scene, renderer, camera, audits, terrain,
        failures: world.failures, headless, ready: Promise.resolve(), setViewpoint: () => true,
        setPose() {}, step() {}, setTime() {}, getTime: () => 0, setQuality() {} });
      if (headless && failing) {
        await assert.rejects(api.ready(), e => {
          assert.match(e.message, /world incomplete/);
          assert.match(e.message, /terrain: injected terrain sync failure/);
          assert.match(e.message, /vegetation: injected vegetation async failure/);
          return true;
        });
      } else {
        assert.equal(await api.ready(), !failing, 'Healthy resolves true; incomplete interactive resolves false');
      }
      assert.equal(warnings.length, !headless && failing ? 1 : 0);
      const expected = world.failures.map(f => ({ ...f }));
      for (const list of [api.failures(), api.audit().systemFailures]) {
        assert.deepEqual(list, expected);
        if (list.length) { list[0].name = 'tampered'; list[0].error = 'tampered'; }
        list.push({ name: 'invented', error: 'invented' });
      }
      assert.deepEqual(world.failures, expected, 'Read APIs do not expose mutable source failures');
      assert.deepEqual(api.failures(), expected);
      assert.deepEqual(api.audit().systemFailures, expected);
      assert.equal(api.audit().systems.props.built, true, 'Audit retains success after errors');
      summaries.push({ headless, injected: expectedNames, readiness: headless && failing ? 'reject' : !failing });
      world.dispose();
    }
  }
} finally {
  console.error = originalError;
  console.info = originalInfo;
  console.warn = originalWarn;
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
}
console.log(JSON.stringify({ diagnostic: 'Readiness regressions passed for Fable 1b3b54d contract', cases: summaries,
  limitation: 'Actual assembler and capture API with injected synchronous/asynchronous factories and CPU scene objects; no rendering, GPU validation, or claim that real systems fail.' }, null, 2));
