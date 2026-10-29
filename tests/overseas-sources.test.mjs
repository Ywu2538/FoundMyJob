import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchOverseasJobs,OVERSEAS_SOURCES,overseasSearchQuery} from '../server/overseas-sources.mjs';
import {Store} from '../server/db.mjs';
import {createServer} from '../server/index.mjs';

const row=i=>({title:`Data Engineer ${i}`,externalPath:`/job/Toronto-ON-CAN/Data-Engineer_R${i}`,locationsText:'Toronto, ON, CAN',remoteType:i===0?'Onsite':undefined});
function fixture({count=23,detail=()=>({}),failDetail=false}={}){
 const calls=[];
 const fetcher=async(url,options)=>{
  calls.push({url,options});assert.equal(new URL(url).hostname,'bmo.wd3.myworkdayjobs.com');assert.equal(options.redirect,'error');
  if(url.endsWith('/jobs')){const {offset,limit}=JSON.parse(options.body);assert.equal(limit,20);return Response.json({total:offset?0:count,jobPostings:Array.from({length:Math.min(20,count-offset)},(_,n)=>row(n+offset))});}
  if(failDetail)throw Error('Offline');
  const i=Number(url.match(/R(\d+)$/)[1]);
  return Response.json({jobPostingInfo:{title:`Data Engineer ${i}`,jobPostingId:`Data-Engineer_R${i}`,jobPostingSiteId:'External',jobDescription:'<p>Build ETL data pipelines with Python and SQL. Hybrid cloud infrastructure.</p>',location:'Toronto, ON, CAN',country:{descriptor:'Canada'},canApply:true,...detail(i)}});
 };
 return {fetcher,calls};
}
test('official Workday sources register without pretend jobs and ignore caller-controlled endpoints',async()=>{
 const store=new Store(':memory:');
 try{assert.equal(store.rows('sources').filter(s=>s.provider==='workday').length,4);assert.equal(store.snapshot().jobs.length,0);}finally{store.close();}
 const f=fixture({count:1});await fetchOverseasJobs({id:'workday:bmo',host:'attacker.invalid',site:'bad',slug:'bad'},{fetcher:f.fetcher});
 assert.ok(f.calls.every(c=>c.url.startsWith('https://bmo.wd3.myworkdayjobs.com/wday/cxs/bmo/External/')));
 await assert.rejects(fetchOverseasJobs({id:'workday:invalid'},{fetcher:f.fetcher}),/未知/);
 assert.equal(overseasSearchQuery('数据工程师'),'data engineer');
});
test('later Workday pages with total zero still paginate and full details preserve arrangements and deadlines',async()=>{
 const f=fixture({detail:i=>i===1?{jobDescription:'<p>Work Model: Hybrid (2 days per week in office).</p>',endDate:'2026-11-01'}:{}});
 const result=await fetchOverseasJobs({id:'workday:bmo'},{fetcher:f.fetcher,today:'2026-10-16'});
 assert.equal(result.jobs.length,23);assert.equal(result.total,23);assert.equal(result.searchComplete,true);assert.equal(result.complete,false);
 assert.deepEqual(f.calls.filter(c=>c.url.endsWith('/jobs')).map(c=>JSON.parse(c.options.body).offset),[0,20]);
 assert.equal(result.jobs[0].work,'现场办公');assert.equal(result.jobs[1].work,'混合办公');assert.equal(result.jobs[2].work,'未注明');
 assert.equal(result.jobs[1].applicationDeadline,'2026-11-01');assert.equal(result.jobs[2].descriptionKind,'full');
 assert.ok(result.jobs[2].location.includes('Canada'));assert.ok(result.jobs[2].url.startsWith('https://bmo.wd3.myworkdayjobs.com/en-US/External/job/'));
});
test('expired and explicitly closed jobs retire only their own source while different queries retain earlier jobs',async()=>{
 const f=fixture({count:4,detail:i=>i===0?{canApply:false}:i===1?{endDate:'2026-10-15'}:i===2?{endDate:'2026-10-16'}:{}});
 const result=await fetchOverseasJobs({id:'workday:bmo'},{fetcher:f.fetcher,today:'2026-10-16'});
 assert.equal(result.jobs.length,2);assert.equal(result.closedIds.length,2);
 const store=new Store(':memory:'),source=OVERSEAS_SOURCES[0];
 try{
  store.upsertJobs(source,[{...result.jobs[0],id:result.closedIds[0]},{...result.jobs[0],id:'unrelated-query'}],{complete:false});
  store.upsertJobs(source,result.jobs,result);
  assert.equal(store.snapshot().jobs.find(j=>j.id===result.closedIds[0]).active,false);
  assert.equal(store.snapshot().jobs.find(j=>j.id==='unrelated-query').active,true);
 }finally{store.close();}
});
test('unavailable details remain marked summaries and malformed lists cannot clear stored jobs',async()=>{
 const f=fixture({count:1,failDetail:true});const result=await fetchOverseasJobs({id:'workday:bmo'},{fetcher:f.fetcher});
 assert.equal(result.jobs[0].descriptionKind,'summary');assert.equal(result.jobs[0].verificationStatus,'pending');
 for(const externalPath of ['https://attacker.invalid/job/1','/job/../../secret','/job/%2fsecret','/job/x?url=bad'])await assert.rejects(fetchOverseasJobs({id:'workday:bmo'},{fetcher:async()=>Response.json({total:1,jobPostings:[{...row(1),externalPath}]})}),/异常/);
});
test('official search uses only the requested source and passes translated target terms without profile facts',async()=>{
 const store=new Store(':memory:'),calls=[];
 const server=createServer({store,jobFetcher:async(source,options)=>{calls.push({source:source.id,options});return {jobs:[],complete:false,total:0,query:options.query};}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const url=`http://127.0.0.1:${server.address().port}`,initial=await(await fetch(url+'/api/state')).json();
  const response=await fetch(url+'/api/jobs/search',{method:'POST',headers:{'Content-Type':'application/json','X-FMJ-Token':initial.token},body:JSON.stringify({profileId:initial.profiles[0].id,query:'数据工程师',sourceId:'workday:bmo'})});
  assert.equal(response.status,202);
  let syncStatus;
  for(let i=0;i<20;i++){
   syncStatus=await(await fetch(url+'/api/jobs/sync/status')).json();
   if(syncStatus.status!=='running')break;
   await new Promise(resolve=>setTimeout(resolve,5));
  }
  assert.equal(syncStatus.status,'completed');
  assert.deepEqual(calls.map(call=>({source:call.source,query:call.options.query})),[{source:'workday:bmo',query:'data engineer'}]);
  assert.equal(typeof calls[0].options.onProgress,'function');
 }finally{await new Promise(resolve=>server.close(resolve));}
});
