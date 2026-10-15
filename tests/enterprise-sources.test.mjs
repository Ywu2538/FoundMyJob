import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchJobs} from '../server/jobs.mjs';
import {COMPANY_SOURCES} from '../server/company-sources.mjs';
const source=slug=>COMPANY_SOURCES.find(s=>s.slug===slug);
test('iFlytek paginates the official list and preserves location, requirements and public detail identifiers',async()=>{
 const pages=[];const r=await fetchJobs(source('iflytek'),{fetcher:async(url,options)=>{
  const body=JSON.parse(options.body);pages.push(body.PageIndex);assert.equal(new URL(url).hostname,'iflytek.zhiye.com');
  return Response.json({Code:200,Count:2,Data:[{Id:'id-'+body.PageIndex,JobAdName:'数据工程师',LocNames:['合肥'],Duty:'建设数据管道',Require:'熟悉 SQL',Category:'社会招聘'}]});
 }});assert.deepEqual(pages,[0,1]);assert.equal(r.jobs.length,2);assert.equal(r.complete,true);assert.equal(r.jobs[0].track,'experienced');assert.match(r.jobs[0].url,/jobAdId=id-0/);assert.match(r.jobs[0].description,/SQL/);
});
test('Unicom validates the official project and links and marks campus jobs explicitly',async()=>{
 const job={jobNumber:'CC123',title:'数据分析师',detail:'SQL 数据分析',url:'https://xiaoyuan.zhaopin.com/job/CC123',cityName:'北京'};
 const reply=(companyId=105347)=>Response.json({code:200,data:{pageInfo:{totalNum:1},jobList:[{company:{companyId,campusOrgName:'中国联通北京市分公司'},job}]}});
 const r=await fetchJobs({...source('unicom'),careersUrl:'https://evil.test'},{fetcher:async(url,options)=>{assert.equal(new URL(url).hostname,'fe.zhaopin.com');assert.deepEqual(JSON.parse(options.body).orgNumbers,['105347']);return reply();}});
 assert.equal(r.jobs[0].company,'中国联通');assert.equal(r.jobs[0].track,'campus');
 await assert.rejects(fetchJobs(source('unicom'),{fetcher:async()=>reply(9)}),/格式/);
});
test('Yonyou reads full public descriptions and verifies detail ownership against each official list record',async()=>{
 const fetcher=async(url)=>url.includes('listPositionDetail')?Response.json({state:'200',data:{postId:'one',company:'用友集团成员公司',postName:'工程师',workContent:'Python 开发',serviceCondition:'SQL',workPlaceStr:'北京'}}):Response.json({state:'200',data:{pageForm:{dataCount:1,pageData:[{postId:'one',company:'用友集团成员公司'}]}}});
 const r=await fetchJobs(source('yonyou'),{fetcher});assert.equal(r.jobs[0].descriptionKind,'full');assert.match(r.jobs[0].url,/postType=society/);assert.equal(r.complete,true);
 await assert.rejects(fetchJobs(source('yonyou'),{fetcher:async url=>url.includes('listPositionDetail')?Response.json({state:'200',data:{postId:'wrong'}}):fetcher(url)}),/格式/);
});
test('Sangfor uses only its anonymous public token and rejects non-open or unrelated listings',async()=>{
 const calls=[];const fetcher=async(url,options)=>{calls.push(url);if(url.endsWith('/token'))return Response.json({access_token:'public-test-token'});assert.equal(options.headers.Authorization,'Bearer public-test-token');return Response.json({code:0,data:{count:1,listData:[{positionId:4,positionState:'open',channelIds:[101],title:'校园软件工程师',description:'Python 开发',workPlaceText:'深圳'}]}});};
 const r=await fetchJobs(source('sangfor'),{fetcher});assert.equal(calls.length,2);assert.equal(r.jobs[0].track,'campus');assert.match(r.jobs[0].url,/Delivery\/4$/);
});
test('enterprise repeated pages and missing totals fail before historical records can be retired',async()=>{
 const data={Code:200,Count:3,Data:[{Id:'same',JobAdName:'工程师',Duty:'开发'}]};
 await assert.rejects(fetchJobs(source('iflytek'),{fetcher:async()=>Response.json(data)}),/重复/);
 await assert.rejects(fetchJobs(source('iflytek'),{fetcher:async()=>Response.json({...data,Count:null})}),/格式/);
});
