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
async function waitForSync(request){
 for(let i=0;i<100;i++){
  const {data}=await request('/api/jobs/sync/status');
  if(data.status!=='running')return data;
  await new Promise(resolve=>setTimeout(resolve,5));
 }
 throw new Error('岗位同步未在测试期限内结束。');
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
test('job synchronization preserves previous data on failure and marks absent jobs inactive only on success',()=>app(async({store,post,request})=>{
 const source=store.rows('sources')[0],j=normalizeJob({id:1,title:'Intern',location:{name:'Toronto'},content:'<p>Python &amp; SQL</p>',absolute_url:'https://example.com/job'},source);store.upsertJobs(source,[j]);
 assert.equal((await post('/api/jobs/sync',{})).status,202);assert.equal((await waitForSync(request)).status,'completed');assert.equal(store.snapshot().jobs[0].active,true);assert.equal(store.get('sources',source.id).status,'同步失败');
 store.upsertJobs(source,[]);assert.equal(store.snapshot().jobs[0].active,false);
},{jobFetcher:async()=>{throw new Error('network');}}));
test('saved jobs and generation remain usable while a source sync is waiting',async()=>{
 let release;
 const gate=new Promise(resolve=>{release=resolve;});
 try{
  await app(async({store,post,request,profileId})=>{
   assert.equal((await post('/api/profile',{...profile,id:profileId})).status,200);
   const job=manualJob(imported),source=store.rows('sources')[0];store.addJob(job);
   assert.equal((await post('/api/jobs/save',{id:job.id,saved:true})).status,200);
   const started=await post('/api/jobs/sync',{sourceId:source.id});
   assert.equal(started.status,202);assert.equal(started.data.sync.total,1);
   assert.equal((await request('/api/jobs/sync/status')).data.status,'running');
   const state=(await request('/api/state')).data;
   assert.ok(state.jobs.some(row=>row.id===job.id));assert.ok(state.saved.includes(job.id));
   const generated=await post('/api/generate',{provider:'cursor',jobId:job.id,profileId,profileRevision:2,language:'en',model:'auto',requestId:'during-sync',consent:true});
   assert.equal(generated.status,202);
   for(let i=0;i<100;i++){
    const task=(await request('/api/tasks/during-sync')).data;
    if(task.status==='completed')break;
    await new Promise(resolve=>setTimeout(resolve,5));
   }
   assert.equal((await request('/api/tasks/during-sync')).data.status,'completed');
   assert.equal((await request('/api/jobs/sync/status')).data.status,'running');
   release();assert.equal((await waitForSync(request)).status,'completed');
  },{cursorEnabled:true,jobFetcher:async()=>{await gate;return [];},generator:async()=>({content:'# Test Candidate\n## Skills\n- Python',notes:[],mode:'cursor'})});
 }finally{release?.();}
});
test('job parsing does not execute HTML or accept unsafe source/link input',async()=>{
 assert.equal(cleanText('&lt;p&gt;Hello&lt;/p&gt;<script>alert(1)</script>'),'Hello');
 assert.throws(()=>manualJob({...imported,url:'javascript:alert(1)'}));
 await assert.rejects(fetchJobs({provider:'greenhouse',slug:'../../localhost'}),/无效/);
 assert.equal(matchJob({tags:[],track:'unknown',category:'其他'},{skills:[],target:'',track:'campus'}).score,0);
});

test('sync refills available slots while slow sources remain active, with bounded concurrency and truthful counts',async()=>{
 let release,resolveFourth;const gate=new Promise(resolve=>{release=resolve;}),fourth=new Promise(resolve=>{resolveFourth=resolve;});
 let active=0,peak=0;
 await app(async({store,post,request})=>{
  store.db.exec('DELETE FROM sources');
  for(let i=0;i<5;i++)store.put('sources',{id:`source-${i}`,company:`Company ${i}`,provider:'greenhouse',slug:`source-${i}`,status:'未同步',count:0});
  try{
   assert.equal((await post('/api/jobs/sync',{})).status,202);
   await Promise.race([fourth,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('free slot was not refilled')),1000);timer.unref();})]);
   const progress=(await request('/api/jobs/sync/status')).data;
   assert.equal(progress.status,'running');assert.equal(progress.total,5);
   assert.equal(progress.sources[0].status,'running');assert.equal(progress.sources[1].status,'running');
   assert.equal(progress.sources[0].requestsCompleted,1);assert.ok(progress.completed>=1);assert.equal(peak,3);
   assert.equal((await post('/api/jobs/sync',{})).status,409);
  }finally{release();}
  const result=await waitForSync(request);
  assert.equal(result.completed,5);assert.equal(result.succeeded,3);assert.equal(result.partial,1);assert.equal(result.failed,1);assert.equal(result.pending,1);assert.equal(result.jobsReceived,3);
  assert.ok(result.sources.every(source=>source.finishedAt));assert.ok(result.finishedAt);
  assert.equal((await request('/api/state')).data.jobs.length,3);
 },{jobFetcher:async(source,{onProgress})=>{
  active++;peak=Math.max(peak,active);onProgress({requestsStarted:1,requestsCompleted:1});
  try{
   if(['source-0','source-1'].includes(source.id))await gate;
   if(source.id==='source-3'){resolveFourth();throw Error('offline');}
   if(source.id==='source-4')throw Object.assign(Error('not connected'),{code:'SOURCE_PENDING'});
   const job=normalizeJob({id:source.id,title:'Engineer',description:'SQL',url:'https://example.com/'+source.id},source);
   return {jobs:[job],complete:source.id!=='source-2'};
  }finally{active--;}
 }});
});

test('fetch progress reports request activity without changing imported results',async()=>{
 const events=[];
 const jobs=await fetchJobs({id:'greenhouse:test',provider:'greenhouse',slug:'test',company:'Test'},{onProgress:event=>events.push(event),fetcher:async()=>Response.json({jobs:[{id:1,title:'Engineer',content:'SQL',absolute_url:'https://example.com/job'}]})});
 assert.equal(jobs.length,1);assert.deepEqual(events,[{requestsStarted:1,requestsCompleted:0},{requestsStarted:1,requestsCompleted:1}]);
});

test('sync follows the browsing scope, retains custom boards and supports explicit company or all-source updates',async()=>{
 for(const [input,count,check] of [
  [{region:'cn'},37,calls=>calls.every(s=>s.directoryScope==='domestic'||s.id==='greenhouse:custom')],
  [{region:'ca'},8,calls=>calls.every(s=>s.directoryScope!=='domestic')],
  [{region:''},44,()=>true],
  [{region:'cn',all:true},44,()=>true],
  [{region:'cn',sourceId:'workday:bmo'},1,calls=>calls[0].id==='workday:bmo'],
 ]){
  const calls=[];
  await app(async({store,post,request})=>{
   store.put('sources',{id:'greenhouse:custom',company:'Custom board',provider:'greenhouse',slug:'custom',status:'未同步',count:0});
   const response=await post('/api/jobs/sync',input);assert.equal(response.status,202);
   assert.equal(response.data.sync.total,count);
   await waitForSync(request);assert.equal(calls.length,count);assert.ok(check(calls));
  },{jobFetcher:async source=>{calls.push(source);return [];}});
 }
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
