import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../server/db.mjs';
import {createServer} from '../server/index.mjs';
import {COMPANY_SOURCES} from '../server/company-sources.mjs';
import {fetchJobs,normalizeJob} from '../server/jobs.mjs';
import {filterJobs} from '../dist/core.js';

const source=slug=>COMPANY_SOURCES.find(s=>s.slug===slug);
test('all 36 pictured companies register idempotently without creating pretend jobs',()=>{
 const store=new Store(':memory:');
 try{
  assert.equal(COMPANY_SOURCES.length,36);assert.equal(new Set(COMPANY_SOURCES.map(s=>s.id)).size,36);
  assert.equal(store.rows('sources').filter(s=>s.featured).length,36);assert.equal(store.snapshot().jobs.length,0);
  for(const s of COMPANY_SOURCES)assert.equal(new URL(s.careersUrl).protocol,'https:');
  for(const name of ['淘宝闪购','飞猪','度小满','掌阅科技','交银金科'])assert.ok(COMPANY_SOURCES.some(s=>s.company===name));
 }finally{store.close();}
});
test('Tencent follows pagination, imports requirements and keeps IDs stable',async()=>{
 const calls=[];
 const r=await fetchJobs(source('tencent'),{fetcher:async url=>{
  calls.push(url);const page=Number(new URL(url).searchParams.get('pageIndex'));
  return Response.json({Code:200,Data:{Count:2,Posts:[{PostId:String(page),RecruitPostName:'数据工程师',CountryName:'中国',LocationName:'北京',Responsibility:'开发 Python 数据管道',Requirement:'熟悉 SQL'}]}});
 }});
 assert.equal(calls.length,2);assert.equal(r.complete,true);assert.equal(r.jobs.length,2);
 assert.ok(r.jobs[0].description.includes('熟悉 SQL'));assert.equal(r.jobs[0].company,'腾讯');
 assert.equal(r.jobs[0].url,'https://careers.tencent.com/jobdesc.html?postId=1');
 assert.equal(r.jobs[0].descriptionKind,'full');
});
test('official sources cannot be redirected by input and malformed/blocked pages are failures',async()=>{
 await assert.rejects(fetchJobs({...source('tencent'),slug:'unregistered',careersUrl:'https://127.0.0.1/'}),/未知/);
 await assert.rejects(fetchJobs(source('tencent'),{fetcher:async()=>Response.json({Code:200,Data:{Count:100,Posts:[]}})}),/格式/);
 await assert.rejects(fetchJobs(source('nio'),{fetcher:async()=>new Response('Verification required',{status:403})}),/403/);
 await assert.rejects(fetchJobs(source('kuaishou'),{fetcher:async()=>{throw new Error('must not fetch');}}),/校验/);
});
test('partial refresh preserves unseen roles; complete empty snapshot closes only its own source',()=>{
 const store=new Store(':memory:'),s=source('lenovo');
 const make=id=>normalizeJob({id,title:'Engineer',description:'Build software',location:'China',url:'https://jobs.lenovo.com/en_US/careers/JobDetail/'+id},s);
 try{
  store.upsertJobs(s,[make('1'),make('2')]);
  store.upsertJobs(s,[make('1')],{complete:false,note:'first page'});
  assert.equal(store.snapshot().jobs.filter(j=>j.active).length,2);assert.equal(store.get('sources',s.id).status,'部分同步');
  assert.equal(store.get('sources',s.id).count,2);
  assert.throws(()=>store.upsertJobs(s,[{...make('3'),source:'wrong'}]),/无效/);
  assert.equal(store.snapshot().jobs.filter(j=>j.active).length,2);
  store.upsertJobs(s,[]);assert.equal(store.snapshot().jobs.filter(j=>j.active).length,0);
 }finally{store.close();}
});
test('JD deduplicates multiple publications of the same requirement',async()=>{
 const row={requirementId:7,positionNameOpen:'后台研发工程师',workContent:'开发服务',qualification:'熟悉 Java',workCity:'上海'};
 const r=await fetchJobs(source('jd'),{fetcher:async url=>url.endsWith('job_count')?Response.json(2):Response.json([row,row])});
 assert.equal(r.jobs.length,1);assert.equal(r.total,2);assert.equal(r.jobs[0].track,'experienced');
});
test('Xiaohongshu imports both recruitment tracks and deduplicates overlapping pages safely',async()=>{
 const calls=[];
 const result=await fetchJobs(source('xiaohongshu'),{fetcher:async(url,options)=>{
  const request=JSON.parse(options.body);calls.push(request);
  const id=request.recruitType==='social'?10:20;
  const row={positionId:id,positionName:'数据分析师',workplace:'杭州',duty:'分析数据',qualification:'熟悉 SQL',publishTime:'2026-10-15'};
  return Response.json({success:true,statusCode:200,data:{total:2,list:[row,{...row}]}});
 }});
 assert.deepEqual(calls.map(x=>x.recruitType),['social','campus']);
 assert.equal(result.jobs.length,2);assert.equal(result.complete,false);
 assert.deepEqual(result.jobs.map(x=>x.track),['experienced','campus']);
 assert.equal(result.jobs[0].url,'https://job.xiaohongshu.com/social/10');
});
test('Qianxin parses JSONP strictly as data with original application links',async()=>{
 const payload={code:'200',data:{jobs:[{id:1,name:'安全工程师',jobCity:'北京',content:'<p>保护服务</p>',description:'熟悉 Linux',jobUrl:'https://app.mokahr.com/campus-recruitment/qianxin/29182#/job/example'}]}};
 const result=await fetchJobs(source('qianxin'),{fetcher:async()=>new Response(`jsonpReturn(${JSON.stringify(payload)});`)});
 assert.equal(result.jobs[0].track,'campus');assert.equal(result.jobs[0].descriptionKind,'full');
 assert.equal(result.jobs[0].description.includes('<p>'),false);
 await assert.rejects(fetchJobs(source('qianxin'),{fetcher:async()=>new Response(`jsonpReturn(${JSON.stringify(payload)});evil()`)}),/格式/);
});
test('missing total and repeated JD pages cannot close unseen jobs',async()=>{
 await assert.rejects(fetchJobs(source('tencent'),{fetcher:async()=>Response.json({Code:200,Data:{Posts:[]}})}),/格式/);
 await assert.rejects(fetchJobs(source('jd'),{fetcher:async url=>url.endsWith('job_count')?Response.json(3):Response.json([{requirementId:7,positionName:'开发工程师',workContent:'开发服务'}])}),/重复/);
});
test('Xiaomi paginates all types with stable posting IDs and genuine original URLs',async()=>{
 const calls=[];
 const result=await fetchJobs(source('xiaomi'),{fetcher:async url=>{
  const page=Number(new URL(url).searchParams.get('pageNum'));calls.push(page);
  return Response.json({code:0,data:{total:2,list:[{jobPostId:`posting-${page}`,title:'数据分析',cityZhNames:['武汉'],description:'分析数据',requirement:'熟悉 SQL',type:page,url:`https://xiaomi.jobs.f.mioffice.cn/index/position/posting-${page}/detail`}]}});
 }});
 assert.deepEqual(calls,[1,2]);assert.equal(result.jobs.length,2);assert.equal(result.complete,true);
 assert.equal(result.jobs[0].id,'official:xiaomi:posting-1');
 assert.deepEqual(result.jobs.map(j=>j.track),['experienced','campus']);
});
test('Baidu reads public serialized job data without executing scripts and never claims full coverage',async()=>{
 const result=await fetchJobs(source('baidu'),{fetcher:async url=>{
  const type=new URL(url).searchParams.get('recruitType');
  return new Response(`<script>window.__INITIAL_DATA__ ={"listData":{"recruitType":"${type}","listDetailData":[{"postId":"${type}","name":"数据分析","workPlace":"北京","workContent":"SQL undefined","serviceCondition":"工作要求","extra":undefined}]}}; window.prefix="/jobs";</script>`);
 }});
 assert.equal(result.jobs.length,3);assert.equal(result.complete,false);
 assert.ok(result.jobs[0].description.includes('SQL undefined'));
 assert.equal(result.jobs[0].url,'https://talent.baidu.com/jobs/detail/SOCIAL/SOCIAL');
 await assert.rejects(fetchJobs(source('baidu'),{fetcher:async()=>new Response('<script>window.__INITIAL_DATA__ =runCode(); window.prefix="/jobs";</script>')}));
});
test('Didi imports duties and qualifications; TAL page offsets are page numbers',async()=>{
 const didi=await fetchJobs(source('didi'),{fetcher:async()=>Response.json({meta:{code:0},data:{total:1,items:[{jdId:123,jobName:'研发工程师',workArea:'北京',jobDuty:'开发',jobQualification:'Java'}]}})});
 assert.equal(didi.jobs[0].url,'https://talent.didiglobal.com/social/jobDetail?jdId=123');assert.ok(didi.jobs[0].description.includes('Java'));
 const offsets=[];
 const tal=await fetchJobs(source('tal'),{fetcher:async(url,options)=>{
  const {offset}=JSON.parse(options.body);offsets.push(offset);
  return Response.json({code:200,data:{total:2,list:[{job_id:String(offset),title:'数据实习生',Locations:['北京'],description:'分析数据'}]}});
 }});
 assert.deepEqual(offsets,[0,1]);assert.equal(tal.jobs.length,2);assert.equal(tal.jobs[0].track,'campus');
});
test('single company sync isolates sources, preserves results on failure, and custom boards still fit',async()=>{
 const store=new Store(':memory:'),calls=[],s=source('tencent');
 const server=createServer({store,jobFetcher:async src=>{calls.push(src.id);throw new Error('HTTP 403');}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 try{
  const initial=await(await fetch(base+'/api/state')).json();
  const post=(url,body)=>fetch(base+url,{method:'POST',headers:{'Content-Type':'application/json','X-FMJ-Token':initial.token},body:JSON.stringify(body)});
  const row=normalizeJob({id:'7',title:'Engineer',description:'Python',url:'https://careers.tencent.com/jobdesc.html?postId=7'},s);
  store.upsertJobs(s,[row]);
  assert.equal((await post('/api/jobs/sync',{sourceId:s.id})).status,200);
  assert.deepEqual(calls,[s.id]);assert.equal(store.snapshot().jobs[0].active,true);assert.equal(store.get('sources',s.id).count,1);
  assert.equal((await post('/api/jobs/sync',{sourceId:s.id})).status,429);
  assert.equal((await post('/api/jobs/sync',{sourceId:'missing'})).status,404);
  assert.equal((await post('/api/sources',{provider:'lever',slug:'example',company:'Example'})).status,200);
  assert.equal(store.rows('sources').length,40);
 }finally{await new Promise(r=>server.close(r));}
});
test('company selection composes with keyword, region and existing filters',()=>{
 const profile={skills:[],target:'',track:'campus'},base={tags:[],track:'campus',active:true,age:0,region:'cn',location:'上海'};
 const jobs=[{...base,title:'工程师',company:'美团'},{...base,title:'分析师',company:'美团'},{...base,title:'工程师',company:'腾讯'}];
 assert.deepEqual(filterJobs(jobs,profile,{company:'美团',query:'工程师',region:'cn'}).map(j=>j.title),['工程师']);
 assert.equal(filterJobs(jobs,profile,{company:'尚未入库'}).length,0);
});
