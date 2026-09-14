// Run: node gauntlet/scripts/lib/browser.test.mjs
import assert from 'node:assert/strict';
import {Agent,get} from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {ROOT,serveStatic} from './browser.mjs';

const server=await serveStatic(ROOT);
const agent=new Agent({keepAlive:true,maxSockets:1});
const sockets=new Set();
try{
  for(const name of ['package.json','package.json']){
    const expected=await fs.readFile(path.join(ROOT,name));
    const {headers,body}=await new Promise((resolve,reject)=>{
      const request=get(server.url+'/'+name,{agent},response=>{
        const chunks=[];response.on('data',data=>chunks.push(data));
        response.on('end',()=>resolve({headers:response.headers,body:Buffer.concat(chunks)}));
        response.on('error',reject);
      });
      request.on('socket',socket=>sockets.add(socket));request.on('error',reject);
      request.setTimeout(2000,()=>request.destroy(new Error('Local HTTP response did not finish')));
    });
    assert.equal(Number(headers['content-length']),expected.length);
    assert.equal(headers.connection,'close');assert.deepEqual(body,expected);
  }
  assert.equal(sockets.size,2,'The capture server must finish and close each response');
  console.log('Two complete local HTTP responses, correct byte lengths, fresh sockets.');
}finally{agent.destroy();await server.close();}
