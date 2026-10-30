import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {setTimeout as delay} from 'node:timers/promises';
import {SelfHostedModel,selfHostedConfig} from '../server/self-hosted-model.mjs';
import {Providers} from '../server/providers.mjs';
import {createServer} from '../server/index.mjs';
import {Store} from '../server/db.mjs';
import {manualJob} from '../server/jobs.mjs';
import {DEFAULT_PROFILE,JOBS} from '../dist/data.js';

const model='fob-resume',secret='test-service-key';
const environment=(base='http://127.0.0.1:8000/v1')=>({FMJ_SELF_HOSTED_BASE_URL:base,FMJ_SELF_HOSTED_MODEL:model,FMJ_SELF_HOSTED_API_KEY:secret});
const generation={profile:DEFAULT_PROFILE,job:JOBS[0],language:'zh',provider:'self-hosted',model};
const modelResponse=()=>({choices:[{message:{content:JSON.stringify({content:'# Test Candidate\n## Skills\n- SQL',notes:[]})},finish_reason:'stop'}],usage:{prompt_tokens:50,completion_tokens:25}});
const listen=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve('http://127.0.0.1:'+server.address().port)));
const close=server=>new Promise(resolve=>server.close(resolve));

test('deployment config is opt-in, normalized and rejects malformed URLs and limits without revealing values',()=>{
 assert.equal(selfHostedConfig({}),null);
 const config=selfHostedConfig(environment('http://127.0.0.1:8000/llm/v1/'));
 assert.equal(config.base,'http://127.0.0.1:8000/llm/v1');assert.equal(config.timeoutMs,180000);assert.equal(config.maxTokens,6000);
 assert.equal(selfHostedConfig({...environment(),FMJ_SELF_HOSTED_API_KEY:''}).key,'');
 for(const base of ['file:///tmp/model','https://user:private-secret@host/v1','https://host/v1?key=private-secret','https://host/v1#secret','http://host/v1/chat/completions','http://host/v1/models','bad-url']){
  assert.throws(()=>selfHostedConfig(environment(base)),error=>!error.message.includes('private-secret'));
 }
 assert.throws(()=>selfHostedConfig({FMJ_SELF_HOSTED_BASE_URL:'http://localhost/v1'}),/同时配置/);
 for(const [key,value] of [['FMJ_SELF_HOSTED_TIMEOUT_MS','0'],['FMJ_SELF_HOSTED_TIMEOUT_MS','600001'],['FMJ_SELF_HOSTED_MAX_TOKENS','2.5'],['FMJ_SELF_HOSTED_API_KEY','bad\nkey']])assert.throws(()=>selfHostedConfig({...environment(),[key]:value}));
});

test('unconfigured or unapproved models never issue requests and service credentials cannot be changed by BYOK',async()=>{
 let calls=0;const fetcher=async()=>{calls++;throw new Error('must not call');};
 const providers=new Providers({fetcher,selfHosted:new SelfHostedModel({env:{},fetcher})});
 assert.equal(providers.provider('self-hosted').configured,false);
 await assert.rejects(()=>providers.generate(generation),/尚未配置/);
 await assert.rejects(()=>providers.selfHosted.testConnection(),/尚未配置/);
 assert.throws(()=>providers.setKey('self-hosted','browser-key'),/部署者管理/);
 assert.throws(()=>providers.clearKey('self-hosted'),/部署者管理/);
 const configured=new Providers({fetcher,selfHosted:new SelfHostedModel({env:environment(),fetcher})});
 await assert.rejects(()=>configured.generate({...generation,model:'other'}),/未获允许/);
 await assert.rejects(()=>configured.generate({...generation,freeOnly:true}),/免费模型筛选/);
 assert.equal(calls,0);
});

test('self-hosted model works through real HTTP status, connection test, generation and resume persistence',async()=>{
 const requests=[];
 const upstream=http.createServer(async(req,res)=>{
  let body='';for await(const chunk of req)body+=chunk;
  requests.push({url:req.url,method:req.method,authorization:req.headers.authorization,body:body?JSON.parse(body):null});
  res.setHeader('Content-Type','application/json');
  res.end(JSON.stringify(req.url==='/v1/models'?{data:[{id:model},{id:'unapproved-model'}]}:modelResponse()));
 });
 const modelBase=await listen(upstream),env={...environment(modelBase+'/v1'),FMJ_SELF_HOSTED_MAX_TOKENS:'1024'};
 const providers=new Providers({selfHosted:new SelfHostedModel({env})});providers.setKey('deepseek','unrelated-private-key');
 const store=new Store(':memory:'),initial=store.snapshot().profiles[0];
 store.editProfile(initial.id,{...DEFAULT_PROFILE,label:'Self-host test'},initial.revision);
 const profile=store.profile(initial.id),job=manualJob({company:'Example',title:'Engineer',url:'https://example.com/job',description:'SQL',region:'ca',location:'Toronto',track:'experienced'});store.addJob(job);
 const server=createServer({store,providers}),base=await listen(server);
 try{
  const state=await(await fetch(base+'/api/state')).json(),token=state.token;
  const post=async(path,body,auth=token)=>{const response=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json','X-FMJ-Token':auth},body:JSON.stringify(body)});return {status:response.status,data:await response.json()};};
  assert.equal((await fetch(base+'/api/self-hosted/status')).status,403);
  const status=await(await fetch(base+'/api/self-hosted/status',{headers:{'X-FMJ-Token':token}})).json();assert.equal(status.configured,true);assert.equal(status.model,model);
  assert.equal((await post('/api/self-hosted/test',{},'bad-token')).status,403);
  assert.equal((await post('/api/self-hosted/test',{baseUrl:'http://attacker/v1'})).status,400);
  assert.equal(requests.length,0);
  const checked=await post('/api/self-hosted/test',{});assert.equal(checked.status,200);assert.equal(checked.data.ok,true);
  assert.deepEqual(requests[0],{url:'/v1/models',method:'GET',authorization:'Bearer '+secret,body:null});
  const models=await(await fetch(base+'/api/models?provider=self-hosted',{headers:{'X-FMJ-Token':token}})).json();assert.deepEqual(models.models.map(item=>item.id),[model]);
  assert.equal((await post('/api/credentials',{provider:'self-hosted',key:'attacker-key'})).status,400);
  assert.equal((await post('/api/credentials',{provider:'self-hosted',remove:true})).status,400);
  assert.equal((await post('/api/settings',{provider:'self-hosted',model:'unapproved-model',language:'zh',revision:state.settings.revision})).status,400);
  assert.equal((await post('/api/settings',{provider:'self-hosted',model,language:'zh',revision:state.settings.revision})).status,200);
  const input={provider:'self-hosted',model,language:'zh',profileId:profile.id,profileRevision:profile.revision,jobId:job.id,requestId:'self-hosted-test',consent:true};
  assert.equal((await post('/api/generate',{...input,consent:false})).status,400);
  assert.equal((await post('/api/generate',{...input,model:'unapproved-model'})).status,400);
  assert.equal((await post('/api/generate',input)).status,202);
  let task;for(let i=0;i<100;i++){task=store.get('tasks',input.requestId);if(task.status!=='running')break;await delay(10);}
  assert.equal(task.status,'completed');const resume=store.get('resumes',task.resumeId);
  assert.equal(resume.mode,'self-hosted');assert.equal(resume.model,model);assert.equal(resume.status,'draft');assert.equal(resume.sourceProfile.id,profile.id);assert.equal(resume.usage.completion_tokens,25);
  assert.equal(requests.filter(r=>r.method==='POST').length,1);
  const outgoing=requests.find(r=>r.method==='POST');assert.equal(outgoing.url,'/v1/chat/completions');assert.equal(outgoing.authorization,'Bearer '+secret);assert.equal(outgoing.body.max_tokens,1024);assert.equal(outgoing.body.stream,false);assert.equal(outgoing.body.model,model);assert.match(outgoing.body.messages[0].content,/RESUME WRITING SKILL/);
  assert.equal((await post('/api/generate',input)).status,200);assert.equal(requests.filter(r=>r.method==='POST').length,1);
  const snapshot=JSON.stringify(await(await fetch(base+'/api/state')).json());
  for(const value of [secret,'unrelated-private-key',modelBase])assert.equal(snapshot.includes(value),false);
 }finally{await close(server);await close(upstream);}
});

test('self-hosted HTTP redirects are rejected and never forward the service key',async()=>{
 let trapCalls=0;const trap=http.createServer((req,res)=>{trapCalls++;res.end('{}');});const trapBase=await listen(trap);
 const redirect=http.createServer((req,res)=>{res.writeHead(307,{Location:trapBase+'/capture'});res.end();});const redirectBase=await listen(redirect);
 try{const service=new SelfHostedModel({env:environment(redirectBase+'/v1')});await assert.rejects(()=>service.testConnection(),/网络不可用/);assert.equal(trapCalls,0);}
 finally{await close(redirect);await close(trap);}
});

test('upstream failures are sanitized, model absence is detected and invalid output is rejected without fallback',async()=>{
 const scenarios=[
  {body:{data:[{id:'different-model'}]},check:true,pattern:/未列出/},
  {body:{error:secret},check:true,pattern:/列表格式异常/},
  {status:401,body:{error:secret},pattern:/认证失败/},
  {status:429,body:{error:secret},pattern:/繁忙/},
  {body:{choices:[]},pattern:/未返回/},
  {body:{choices:[{message:{content:'not json'}}]},pattern:/有效简历 JSON/},
  {body:{choices:[{finish_reason:'length'}]},pattern:/截断/},
 ];
 for(const scenario of scenarios){
  let calls=0;const fetcher=async()=>{calls++;return new Response(JSON.stringify(scenario.body),{status:scenario.status||200});};
  const service=new SelfHostedModel({env:environment(),fetcher}),providers=new Providers({fetcher,selfHosted:service});
  await assert.rejects(()=>scenario.check?service.testConnection():providers.generate(generation),error=>scenario.pattern.test(error.message)&&!error.message.includes(secret));
  assert.equal(calls,1);
 }
});

test('configured generation timeout aborts and keyless private services omit Authorization',async()=>{
 let authorization,aborted=false;
 const fetcher=async(url,options)=>{authorization=options.headers.Authorization;return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>{aborted=true;reject(options.signal.reason);},{once:true}));};
 const selfHosted=new SelfHostedModel({env:{...environment(),FMJ_SELF_HOSTED_API_KEY:'',FMJ_SELF_HOSTED_TIMEOUT_MS:'1000'},fetcher});
 const providers=new Providers({fetcher,selfHosted});
 // AbortSignal's timer is unref'ed; keep a bounded timer alive for this isolated test.
 const keepAlive=setTimeout(()=>{},2000);
 try{await assert.rejects(()=>providers.generate(generation),/超时/);assert.equal(aborted,true);assert.equal(authorization,undefined);}
 finally{clearTimeout(keepAlive);}
});
