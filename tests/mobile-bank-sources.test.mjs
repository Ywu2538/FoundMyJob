import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {fetchJobs} from '../server/jobs.mjs';
import {COMPANY_SOURCES} from '../server/company-sources.mjs';
const source=slug=>COMPANY_SOURCES.find(s=>s.slug===slug);
const {publicKey}=generateKeyPairSync('rsa',{modulusLength:2048,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
const keyScript='.pbkey="'+publicKey.replace(/-----[^-]+-----|\s/g,'')+'"';
test('China Mobile uses public anonymous request envelopes and imports paginated real requirements',async()=>{
 const pages=[];const r=await fetchJobs(source('mobile'),{fetcher:async(url,options)=>{
  assert.equal(new URL(url).hostname,'job.10086.cn');
  if(url.endsWith('.js'))return new Response(keyScript);
  const b=JSON.parse(options.body);pages.push(b.data.pageNo);assert.equal(b.data.companyId,'');assert.equal(b.serviceName,'searchJobs');assert.match(b.header.digest,/^[A-Za-z0-9+/=]+;[A-Za-z0-9+/=]+$/);assert.equal(options.headers.Authorization,undefined);
  return Response.json({code:'0000',data:{total:2,jobList:[{id:'id-'+b.data.pageNo,name:'数据工程师',description:'建设数据平台',dutyCondition:'熟悉 SQL',type:'2',province:'甘肃省',city:'庆阳市'}]}});
 }});assert.deepEqual(pages,[1,2]);assert.equal(r.complete,true);assert.equal(r.jobs[0].descriptionKind,'full');assert.match(r.jobs[0].description,/SQL/);assert.equal(r.jobs[0].track,'experienced');
});
test('China Mobile rejects stale/malformed lists and cannot silently retire historical jobs',async()=>{
 const reply={code:'0000',data:{total:3,jobList:[{id:'same',name:'工程师',description:'开发',type:'1'}]}};
 await assert.rejects(fetchJobs(source('mobile'),{fetcher:async url=>url.endsWith('.js')?new Response(keyScript):Response.json(reply)}),/重复/);
 await assert.rejects(fetchJobs(source('mobile'),{fetcher:async()=>new Response('missing key')}),/格式/);
});
test('a real China Mobile listing with omitted duties remains a clearly marked summary',async()=>{
 const r=await fetchJobs(source('mobile'),{fetcher:async url=>url.endsWith('.js')?new Response(keyScript):Response.json({code:'0000',data:{total:1,jobList:[{id:'real-listing',name:'AI全栈工程师',type:'1'}]}})});
 assert.equal(r.jobs[0].descriptionKind,'summary');assert.match(r.jobs[0].description,/未提供完整职责/);assert.equal(r.complete,true);
});
test('CCB Fintech scopes all queries to its institution and accepts a verified empty active list',async()=>{
 const r=await fetchJobs(source('ccbft'),{fetcher:async url=>{const u=new URL(url);assert.equal(u.searchParams.get('orgId'),'8ba3bc9962e2c55501636c1220b10648');assert.equal(u.searchParams.get('viewFffectivePost'),'1');return Response.json({SUCCESS:'true',TOTAL_REC:'0'});}});
 assert.equal(r.complete,true);assert.equal(r.jobs.length,0);assert.match(r.note,/暂无有效/);
 await assert.rejects(fetchJobs(source('ccbft'),{fetcher:async()=>Response.json({SUCCESS:'true',TOTAL_REC:'1',planPostList:[{orgId:'another bank',planStatus:'1'}]})}),/格式/);
});
