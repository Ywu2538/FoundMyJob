import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {Store,blankProfile} from '../server/db.mjs';
import {createServer} from '../server/index.mjs';
import {Providers} from '../server/providers.mjs';
import {manualJob,normalizeJob,cleanText,fetchJobs} from '../server/jobs.mjs';
import {matchJob} from '../dist/core.js';

const imported={title:'Data Intern',company:'Test Company',description:'Analyze data with Python and SQL.',location:'Toronto',region:'na',track:'campus',url:'https://example.com/job/123'};
const profile={...blankProfile(),name:'Test Candidate',email:'test@example.com',phone:'',location:'Toronto',target:'Data analyst',education:'Test University, Statistics',experience:'',projects:'Analyzed a class survey using Python.',preferences:'',track:'campus',skills:['Python'],revision:1};
async function app(fn,options={}) {
 const store=new Store(':memory:'),server=createServer({store,...options});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 const request=async(p,body,headers={})=>{const response=await fetch(base+p,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:response.status,data:await response.json()};};
 const initial=(await request('/api/state')).data;const post=(p,b)=>request(p,b,{'X-FMJ-Token':initial.token});
 try{await fn({store,request,post,initial,profileId:initial.profiles[0].id});}finally{await new Promise(r=>server.close(r));}
}
test('SQLite persists a real profile and saved job through reopening, starts without fictional data',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'fmj-db-')),filename=path.join(dir,'data.sqlite');
 try{let db=new Store(filename);assert.equal(db.snapshot().profiles[0].name,'');assert.equal(db.snapshot().jobs.length,0);db.editProfile(db.snapshot().profiles[0].id,profile,1);const j=manualJob(imported);db.addJob(j);db.db.prepare('INSERT INTO saved VALUES(?)').run(j.id);db.close();db=new Store(filename);assert.equal(db.snapshot().profiles[0].name,profile.name);assert.deepEqual(db.snapshot().saved,[j.id]);db.close();}finally{await rm(dir,{recursive:true,force:true});}
});
test('API blocks cross-origin changes, forged credits, missing consent and disabled Cursor',()=>app(async({request,post,initial})=>{
 assert.equal((await request('/api/profile',profile)).status,403);
 assert.equal((await request('/api/profile',profile,{'X-FMJ-Token':initial.token,Origin:'https://evil.example'})).status,403);
 assert.equal((await post('/api/generate',{provider:'platform',credits:999999,consent:true})).status,403);
 assert.equal((await post('/api/generate',{provider:'cursor',consent:true})).status,403);
 assert.equal((await request('/.env.local')).status,404);
 assert.equal((await request('/.runtime/foundmyjob.sqlite')).status,404);
}));
test('server revisions prevent a stale browser overwriting profile updates',()=>app(async({post,profileId})=>{
 assert.equal((await post('/api/profile',{...profile,id:profileId})).status,200);
 assert.equal((await post('/api/profile',{...profile,id:profileId,name:'Overwrite'})).status,409);
}));
test('generation is idempotent, review is enforced server-side and edits invalidate review',()=>app(async({post,request,store,profileId})=>{
 await post('/api/profile',{...profile,id:profileId});const j=manualJob(imported);store.addJob(j);
 await post('/api/applications',{jobId:j.id,profileId});let a=store.rows('applications')[0];
 assert.equal((await post('/api/applications/status',{id:a.id,status:'已投递',revision:a.revision})).status,400);
 const input={provider:'cursor',jobId:j.id,profileId,profileRevision:2,language:'en',model:'auto',requestId:'unique-test',consent:true};
 assert.equal((await post('/api/generate',{...input,consent:false})).status,400);
 assert.equal((await post('/api/generate',input)).status,202);
 await new Promise(r=>setTimeout(r,50));assert.equal((await post('/api/generate',input)).status,200);
 let rs=store.rows('resumes');assert.equal(rs.length,1);assert.equal(rs[0].status,'draft');
 let r=rs[0];await post('/api/resumes/save',{id:r.id,content:r.content,review:true,revision:r.revision});
 assert.equal((await post('/api/applications/status',{id:a.id,status:'已投递',revision:a.revision})).status,200);
 r=store.rows('resumes')[0];await post('/api/resumes/save',{id:r.id,content:r.content+'\nChanged',review:false,revision:r.revision});
 r=store.rows('resumes')[0];assert.equal(r.status,'draft');assert.equal(r.reviewedAt,null);
 assert.equal(store.db.prepare('SELECT count(*) AS n FROM resume_versions').get().n,2);
 assert.equal((await request('/api/tasks/unique-test')).data.status,'completed');
},{cursorEnabled:true,generator:async()=>({content:'# Test Candidate\nFacts only',notes:['Review facts'],mode:'cursor'})}));
test('provider failure records failed task without fabricated resume',()=>app(async({post,store,profileId})=>{
 await post('/api/profile',{...profile,id:profileId});const j=manualJob(imported);store.addJob(j);
 await post('/api/generate',{provider:'cursor',jobId:j.id,profileId,profileRevision:2,language:'zh',model:'auto',requestId:'failed-test',consent:true});await new Promise(r=>setTimeout(r,30));
 assert.equal(store.get('tasks','failed-test').status,'failed');assert.equal(store.rows('resumes').length,0);
},{cursorEnabled:true,generator:async()=>{throw new Error('Quota exhausted');}}));
test('BYOK credentials never enter snapshots or the database',()=>app(async({post,request,store})=>{
 const key='fake-test-secret-123';await post('/api/credentials',{provider:'deepseek',key});
 const json=JSON.stringify((await request('/api/state')).data);assert.ok(!json.includes(key));assert.ok(json.includes('"configured":true'));
 assert.ok(!JSON.stringify(store.rows('config')).includes(key));
 await post('/api/credentials',{provider:'deepseek',remove:true});assert.equal((await request('/api/state')).data.providers.find(p=>p.id==='deepseek').configured,false);
}));
test('only selected provider receives its key; failed requests do not fall back or reveal vendor errors',async()=>{
 const calls=[],p=new Providers({fetcher:async(url,opts)=>{calls.push({url,auth:opts.headers.Authorization});return new Response(JSON.stringify({error:'sensitive vendor text'}),{status:429});}});
 p.setKey('deepseek','fake-key-deepseek');p.setKey('siliconflow','fake-key-siliconflow');
 await assert.rejects(p.generate({profile,job:imported,language:'en',provider:'deepseek',model:'test-model'}),/限流/);
 assert.equal(calls.length,1);assert.equal(calls[0].auth,'Bearer fake-key-deepseek');assert.ok(calls[0].url.startsWith('https://api.deepseek.com/'));
});
test('free-only mode checks live pricing and refuses paid/unknown models without a completion call',async()=>{
 const calls=[],p=new Providers({fetcher:async url=>{calls.push(url);return Response.json({data:[{id:'free',architecture:{input_modalities:['text'],output_modalities:['text']},pricing:{prompt:'0',completion:'0'}},{id:'paid',architecture:{input_modalities:['text'],output_modalities:['text']},pricing:{prompt:'0.1',completion:'0'}},{id:'unknown'}]});}});p.setKey('openrouter','fake-openrouter-key');
 const models=await p.models('openrouter');assert.deepEqual(models.filter(m=>m.free).map(m=>m.id),['free']);
 await assert.rejects(p.generate({profile,job:imported,language:'en',provider:'openrouter',model:'paid',freeOnly:true}),/免费/);assert.ok(calls.every(u=>u.endsWith('/models')));
});
test('job synchronization preserves previous data on failure and marks absent jobs inactive only on success',()=>app(async({store,post})=>{
 const source=store.rows('sources')[0],j=normalizeJob({id:1,title:'Intern',location:{name:'Toronto'},content:'<p>Python &amp; SQL</p>',absolute_url:'https://example.com/job'},source);store.upsertJobs(source,[j]);
 await post('/api/jobs/sync',{});assert.equal(store.snapshot().jobs[0].active,true);assert.equal(store.get('sources',source.id).status,'同步失败');
 store.upsertJobs(source,[]);assert.equal(store.snapshot().jobs[0].active,false);
},{jobFetcher:async()=>{throw new Error('network');}}));
test('job parsing does not execute HTML or accept unsafe source/link input',async()=>{
 assert.equal(cleanText('&lt;p&gt;Hello&lt;/p&gt;<script>alert(1)</script>'),'Hello');
 assert.throws(()=>manualJob({...imported,url:'javascript:alert(1)'}));
 await assert.rejects(fetchJobs({provider:'greenhouse',slug:'../../localhost'}),/无效/);
 assert.equal(matchJob({tags:[],track:'unknown',category:'其他'},{skills:[],target:'',track:'campus'}).score,0);
});

test('web-discovered jobs retain pending provenance, deduplicate URLs and survive board sync',()=>app(async({store,post,request})=>{
  const lead={...imported,discoveredFromWeb:true};
  assert.equal((await post('/api/jobs/import',lead)).status,200);
  assert.equal((await post('/api/jobs/import',lead)).status,200);
  let jobs=(await request('/api/state')).data.jobs;
  assert.equal(jobs.length,1);assert.equal(jobs[0].sourceKind,'discovered');
  assert.equal(jobs[0].verificationStatus,'pending');assert.equal(jobs[0].descriptionKind,'summary');
  store.upsertJobs(store.rows('sources')[0],[]);
  jobs=(await request('/api/state')).data.jobs;
  assert.equal(jobs[0].active,true);
}));
test('free generation caps OpenRouter pricing and excludes audio-only models',async()=>{
 let sent;
 const p=new Providers({fetcher:async(url,opts)=>{
   if(url.endsWith('/models'))return Response.json({data:[{id:'free',architecture:{input_modalities:['text'],output_modalities:['text']},pricing:{prompt:'0',completion:'0',request:'0'},top_provider:{max_completion_tokens:4096}},{id:'music',architecture:{input_modalities:['text'],output_modalities:['audio']},pricing:{prompt:'0',completion:'0'}}]});
   sent=JSON.parse(opts.body);return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({content:'# Test',notes:[]})}}]});
 }});p.setKey('openrouter','fake-only-test-key');
 assert.deepEqual((await p.models('openrouter')).map(m=>m.id),['free']);
 await p.generate({profile,job:imported,language:'en',provider:'openrouter',model:'free',freeOnly:true});
 assert.deepEqual(sent.provider,{allow_fallbacks:false,max_price:{prompt:0,completion:0,request:0}});assert.equal(sent.max_tokens,4096);
});
