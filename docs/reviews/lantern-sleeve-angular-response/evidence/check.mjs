import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import * as T from 'three';
import { WebGLPrograms } from 'three/src/renderers/webgl/WebGLPrograms.js';
import { WebGLProgram } from 'three/src/renderers/webgl/WebGLProgram.js';

import {pin,sha,gitSource,candidateSource,helperSource,verifyReceipt,trackedFiles} from './source.mjs';
const materialPath = 'src/world/structures/materials.ts';
const helperPath = 'src/world/structures/sleeveBark.ts';
for (const [file, receipt] of Object.entries(pin.inputs)) assert.equal(sha(gitSource(file)), receipt.sha256, file);
const original = gitSource(materialPath);
const candidate = candidateSource(materialPath);
const helper = helperSource();
assert.equal(sha(candidate), pin.candidateMaterialSHA256);
assert.equal(sha(helper), pin.helperSHA256);
assert.equal(sha(fs.readFileSync(new URL('./sleeve-angular.patch',import.meta.url))), pin.patchSHA256);
assert.equal(candidate.replace("import { applySleeveBarkResponse } from './sleeveBark';\n", '')
  .replace('  applySleeveBarkResponse(sleeveBark);\n', ''), original);
assert.equal((candidate.match(/applySleeveBarkResponse\(sleeveBark\)/g) ?? []).length, 1);
assert.ok(candidate.includes('  applyShadeFloor(sleeveBark, LIMB_BARK_FLOOR, new Color(LIMB_BARK_TINT));\n  applySleeveBarkResponse(sleeveBark);'));

// Evaluate module exports without invoking the full material/geometry factory or its canvases.
const cache = new Map();
function load(file) {
  file = path.posix.normalize(file);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  const source = file === helperPath ? helper : gitSource(file);
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)(id => id === 'three' ? T : load(path.posix.join(path.posix.dirname(file), `${id}.ts`)), module, module.exports);
  return module.exports;
}
const { LIMB_BARK_FLOOR, LIMB_BARK_TINT } = load(materialPath);
const { applyShadeFloor } = load('src/world/materials/shadeFloor.ts');
const { applySleeveBarkResponse } = load(helperPath);
assert.deepEqual(LIMB_BARK_FLOOR, { lift: 9, texture: 0.3, canopy: 1, albedo: 0.08, chroma: 0.6 });
assert.equal(LIMB_BARK_TINT, 0x6c6e48);

// Extract the actual bark constructor, retaining its map bindings and every property.
const ast = ts.createSourceFile(materialPath, original, ts.ScriptTarget.Latest, true);
const barkInitializers = [];
function visit(node) {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'bark') barkInitializers.push(node.initializer.getText(ast));
  ts.forEachChild(node, visit);
}
visit(ast); assert.equal(barkInitializers.length, 1);
const maps = ['color', 'normal', 'roughness'].map(kind => {
  const map = new T.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1);
  map.name = `bark_brown_02/${kind}`; return map;
});
const bark = new Function('MeshStandardMaterial', 'Color', 'Vector2', 'barkC', 'barkN', 'barkR', `return ${barkInitializers[0]}`)(T.MeshStandardMaterial, T.Color, T.Vector2, ...maps);
const baseline = bark.clone(), changed = bark.clone();
baseline.name = changed.name = 'structures:sleeve-bark';
applyShadeFloor(baseline, LIMB_BARK_FLOOR, new T.Color(LIMB_BARK_TINT));
applyShadeFloor(changed, LIMB_BARK_FLOOR, new T.Color(LIMB_BARK_TINT));
const beforeListeners = changed._listeners;
assert.equal(applySleeveBarkResponse(changed), changed);
assert.equal(changed._listeners, beforeListeners);
for (const [key, value] of Object.entries(baseline)) {
  if (['id', 'uuid', 'onBeforeCompile', 'customProgramCacheKey'].includes(key)) continue;
  assert.deepEqual(changed[key], value, `Unchanged material input: ${key}`);
}
assert.equal(changed.map, maps[0]); assert.equal(changed.normalMap, maps[1]); assert.equal(changed.roughnessMap, maps[2]);

// Real Three program construction and preprocessing, with a source-only GL sink.
const gl = { VERTEX_SHADER: 35633, FRAGMENT_SHADER: 35632, createProgram: () => ({}), createShader: type => ({ type }), shaderSource(shader, source) { shader.source = source; }, compileShader() {}, attachShader() {}, bindAttribLocation() {}, linkProgram() {} };
const renderer = { getContext: () => gl, getRenderTarget: () => null, state: { buffers: { depth: { getReversed: () => false } } }, shadowMap: { enabled: true, type: T.PCFShadowMap }, toneMapping: T.NoToneMapping, outputColorSpace: T.LinearSRGBColorSpace, debug: { checkShaderErrors: false } };
const programs = WebGLPrograms(renderer, { get: () => null }, { has: () => false }, { precision: 'highp', logarithmicDepthBuffer: false, vertexTextures: true, getMaxPrecision: p => p }, {}, { numPlanes: 0, numIntersection: 0 });
const geometry = new T.BoxGeometry();
function compile(material, hemi = 1) {
  const lights = { sun: [], directional: [{}], point: [{}], spot: [], spotLightMap: [], rectArea: [], hemi: hemi ? [{}] : [], sunShadowMap: [], directionalShadowMap: [], pointShadowMap: [], spotShadowMap: [], numSpotLightShadowsWithMaps: 0, numLightProbes: 0 };
  const object = new T.Mesh(geometry, material);
  const parameters = programs.getParameters(material, lights, [], new T.Scene(), object, []);
  const key = programs.getProgramCacheKey(parameters);
  parameters.uniforms = programs.getUniforms(material); material.onBeforeCompile(parameters, renderer);
  const program = new WebGLProgram(renderer, key, parameters, {});
  const vertex = program.vertexShader.source, fragment = program.fragmentShader.source;
  const processed = execFileSync('cpp', ['-P', '-undef', '-x', 'c', '-'], { input: fragment.replace(/^#version.*$/gm, '').replace(/^#extension.*$/gm, ''), encoding: 'utf8', maxBuffer: 5e6 });
  return { key, parameters, vertex, fragment, processed };
}
const old = compile(baseline), next = compile(changed);
assert.equal(old.vertex, next.vertex);
assert.deepEqual(old.parameters.uniforms, next.parameters.uniforms);
assert.notEqual(old.key, next.key);
assert.ok(next.key.includes('|sleeve-hemi-angular-020-v1'));
assert.equal(next.parameters.normalMap, true); assert.equal(next.parameters.numHemiLights, 1);
const mappedNormal = next.processed.indexOf('normal = normalize( tbn * mapN );');
const response = next.processed.indexOf('float sleeveHemiWeight');
const accumulation = next.processed.indexOf('float have = dot(', response);
assert.ok(mappedNormal >= 0 && mappedNormal < response && response < accumulation);
assert.ok(next.processed.includes('floorLight *= mix(1.0, sleeveRatio, 0.20);'));
assert.equal(compile(baseline, 0).processed, compile(changed, 0).processed);

const sentinel = new T.MeshStandardMaterial(), rendererSentinel = {};
const anchor = 'floorLight = mix(vec3(dot(floorLight, lumW)), floorLight, uShadeFloorChroma);';
let calls = 0;
sentinel.onBeforeCompile = function (shader, r) { assert.equal(this, sentinel); assert.equal(r, rendererSentinel); calls++; shader.fragmentShader += anchor; };
sentinel.customProgramCacheKey = function () { assert.equal(this, sentinel); return 'prior'; };
applySleeveBarkResponse(sentinel);
const shader = { uniforms: { original: { value: 3 } }, vertexShader: 'original', fragmentShader: '' };
sentinel.onBeforeCompile(shader, rendererSentinel);
assert.equal(calls, 1); assert.equal(sentinel.customProgramCacheKey(), 'prior|sleeve-hemi-angular-020-v1');
assert.deepEqual(shader.uniforms, { original: { value: 3 } }); assert.equal(shader.vertexShader, 'original');
for (const anchors of [0, 2]) {
  const bad = new T.MeshStandardMaterial(); bad.onBeforeCompile = s => { s.fragmentShader = anchor.repeat(anchors); }; applySleeveBarkResponse(bad);
  assert.throws(() => bad.onBeforeCompile({ fragmentShader: '' }, {}), /exactly one applied shade floor/);
}

// One TypeScript no-emit check, with only the two scratch files overlaid in memory.
const root = process.cwd();
const files = new Set(trackedFiles());
const roots = [...files].filter(file => (file.startsWith('src/') || file === 'vite.config.ts') && /\.[cm]?[jt]sx?$/.test(file)).map(file => path.resolve(file));
const config = JSON.parse(gitSource('tsconfig.json'));
const parsed = ts.parseJsonConfigFileContent(config, { ...ts.sys, readDirectory: () => roots }, root);
const host = ts.createCompilerHost(parsed.options);
const overlay = new Map([[path.resolve(materialPath), candidate], [path.resolve(helperPath), helper]]);
const readFile = host.readFile.bind(host), fileExists = host.fileExists.bind(host);
const relative = file => path.relative(root,path.resolve(file)).split(path.sep).join('/');
host.readFile = file => {
  const name=path.resolve(file),rel=relative(name);
  if(overlay.has(name))return overlay.get(name);
  if(files.has(rel))return gitSource(rel);
  if(rel.startsWith('src/'))return undefined;
  return readFile(file);
};
host.fileExists = file => overlay.has(path.resolve(file)) || (relative(file).startsWith('src/') ? files.has(relative(file)) : files.has(relative(file)) || fileExists(file));
const program = ts.createProgram([...parsed.fileNames, path.resolve(helperPath)], { ...parsed.options, noEmit:true }, host);
const diagnostics = ts.getPreEmitDiagnostics(program);
assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCurrentDirectory: () => process.cwd(), getCanonicalFileName: f => f, getNewLine: () => '\n' }));

const result = {
  passed: true, pin: pin.sourceCommit, partner: pin.partnerMaterialCommit, threeRevision: T.REVISION,
  sourceUsesPublishedCommitOnly: true, localIntegrationCommitRequired: false,
  scope: 'One extracted actual bark constructor, its sleeve clone, actual shared floor and frozen helper. No scene, material factory, geometry suite, RNG suite, GPU compile/link or render.',
  sourceInverseExact: true, helperOriginalBytesExact: true, resourceInputsExact: true, uniformsAndVertexExact: true,
  mappedNormalBeforeResponseBeforeAccumulation: true, exactStrength: 0.20, noHemispherePreprocessedFragmentExact: true,
  previousReceiverRendererKeyPreserved: true, missingDuplicateAnchorsRejected: true, typecheckVirtualOverlayPassed: true,
  programCacheSeparated: true, newResources: 0,
  originalBarkConstructorSHA256: sha(barkInitializers[0]), baselineFragmentSHA256: sha(old.fragment), candidateFragmentSHA256: sha(next.fragment),
  installedProgramSHA256: sha(fs.readFileSync('node_modules/three/src/renderers/webgl/WebGLProgram.js')),
  installedProgramsSHA256: sha(fs.readFileSync('node_modules/three/src/renderers/webgl/WebGLPrograms.js')),
  limitations: 'No current-world draw-count or appearance verdict. Historical A/B floor medians are a CPU proxy, not predicted displayed pixels. A real paired-image trial remains required.'
};
verifyReceipt('evidence.json',result);
console.log(JSON.stringify(result, null, 2));

console.log("Portable sleeve 0.20 adaptation: original focused receipt reproduced exactly; no files written.");
