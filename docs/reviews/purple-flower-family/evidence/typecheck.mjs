import path from 'node:path';import {execFileSync} from 'node:child_process';import ts from 'typescript';
import {pin,provenance,source,candidateSource,verifyReceipt} from './source.mjs';
const root=process.cwd(),config=ts.parseJsonConfigFileContent(JSON.parse(source('tsconfig.json')),ts.sys,root),host=ts.createCompilerHost(config.options),read=host.readFile.bind(host);
const names=execFileSync('git',['ls-tree','-r','--name-only',pin],{encoding:'utf8'}).trim().split('\n').filter(f=>(f.startsWith('src/')&&/\.(ts|tsx|js|mjs)$/.test(f))||f==='vite.config.ts').map(f=>path.join(root,f));
host.readFile=f=>{const rel=path.relative(root,f).split(path.sep).join('/');if(rel==='vite.config.ts'||(rel.startsWith('src/')&&/\.(ts|tsx|js|mjs)$/.test(rel))){try{return candidateSource(rel);}catch(error){if(provenance.files.some(m=>m.file===rel))throw error;return undefined;}}return read(f);};
const program=ts.createProgram(names,{...config.options,noEmit:true},host),diagnostics=ts.getPreEmitDiagnostics(program);
verifyReceipt('typecheck.json',{source:pin,candidates:provenance.files,diagnosticCount:diagnostics.length,passed:diagnostics.length===0});
if(diagnostics.length){console.log(ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCanonicalFileName:f=>f,getCurrentDirectory:()=>root,getNewLine:()=> '\n'}));process.exitCode=1;}else console.log('PASS: pinned source with reviewed candidate, zero TypeScript diagnostics.');
