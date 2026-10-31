import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Store} from '../server/db.mjs';
import {createServer} from '../server/index.mjs';

async function campus(options,fn){
 const previous=process.env.FMJ_DEPLOYMENT;
 process.env.FMJ_DEPLOYMENT='campus';
 let server;
 try{server=createServer({store:new Store(':memory:'),...options});}
 finally{if(previous===undefined)delete process.env.FMJ_DEPLOYMENT;else process.env.FMJ_DEPLOYMENT=previous;}
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 try{await fn(base);}finally{await new Promise(resolve=>server.close(resolve));}
}

const gateway={'X-User-Id':'42','X-User-Role':'STUDENT','X-User-Name':encodeURIComponent('测试同学')};

test('campus mode only answers requests forwarded by the SuperUnknown gateway',()=>campus({},async base=>{
 assert.equal((await fetch(base)).status,401);
 assert.equal((await fetch(base+'/api/state')).status,401);
 const health=await fetch(base+'/api/health');
 assert.equal(health.status,200);
 assert.equal((await health.json()).mode,'campus');
 assert.equal((await fetch(base,{headers:gateway})).status,200);
 assert.equal((await fetch(base+'/styles.css',{headers:gateway})).status,200);
 assert.equal((await fetch(base+'/api/state',{headers:{...gateway,Origin:'https://evil.example'}})).status,403);
 assert.equal((await fetch(base+'/api/state',{headers:{...gateway,Origin:base}})).status,200);
}));

test('campus mode never offers the server Cursor login, even when enabled locally',()=>campus({cursorEnabled:true},async base=>{
 const state=await(await fetch(base+'/api/state',{headers:gateway})).json();
 assert.equal(state.capabilities.cursor,false);
 assert.equal(state.capabilities.deployment,'campus');
 for(const action of ['connect','install','login','key']){
  const response=await fetch(`${base}/api/cursor/${action}`,{method:'POST',headers:{...gateway,'Content-Type':'application/json','X-FMJ-Token':state.token},body:JSON.stringify({consent:true,key:'k'})});
  assert.equal(response.status,403,action);
 }
}));

test('only local and campus deployments are accepted',()=>{
 const previous=process.env.FMJ_DEPLOYMENT;
 process.env.FMJ_DEPLOYMENT='cloud';
 try{assert.throws(()=>createServer({store:new Store(':memory:')}),/FMJ_DEPLOYMENT/);}
 finally{if(previous===undefined)delete process.env.FMJ_DEPLOYMENT;else process.env.FMJ_DEPLOYMENT=previous;}
});

test('the page loads its assets and API with relative paths so it can live under /jobs/',async()=>{
 const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
 assert.doesNotMatch(html,/(href|src)="\//);
 for(const file of ['app.js','profile-import.js','resume-layouts.js']){
  const source=await readFile(new URL(`../dist/${file}`,import.meta.url),'utf8');
  assert.doesNotMatch(source,/fetch\('\/|href="\/(resume|styles)\.css"|src="\/favicon\.svg"/,file);
 }
});
