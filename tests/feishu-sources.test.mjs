import test from 'node:test';
import assert from 'node:assert/strict';
import {createCipheriv} from 'node:crypto';
import {fetchExtendedJobs} from '../server/feishu-sources.mjs';

const csrf=()=>Response.json({code:0,data:{token:'anonymous-token'}},{headers:{'Set-Cookie':'atsx-csrf-token=anonymous-token; Secure; HttpOnly; Path=/'}});
const position=id=>({id:String(id),title:'数据工程师',description:'维护数据服务',requirement:'熟悉 SQL',city_list:[{name:'北京'}],process_type:1,publish_time:1792000000000});

test('Feishu performs anonymous CSRF handshake, honors page lengths, and ignores caller URLs',async()=>{
  const calls=[];
  const result=await fetchExtendedJobs({slug:'nio',careersUrl:'https://127.0.0.1',company:'wrong'},{fetcher:async(url,options)=>{
    calls.push({url,options});
    assert.equal(new URL(url).origin,'https://nio.jobs.feishu.cn');assert.equal(options.redirect,'error');
    if(url.endsWith('/csrf/token'))return csrf();
    const body=JSON.parse(options.body);
    assert.equal(options.headers['x-csrf-token'],'anonymous-token');
    assert.equal(options.headers.Cookie,'atsx-csrf-token=anonymous-token');
    assert.equal(options.headers['website-path'],'index');
    return Response.json({code:0,data:{count:2,job_post_list:[position(body.offset+1)]}});
  }});
  assert.deepEqual(calls.slice(1).map(c=>JSON.parse(c.options.body).offset),[0,1]);
  assert.equal(result.jobs.length,2);assert.equal(result.complete,true);
  assert.equal(result.jobs[0].company,'蔚来');assert.equal(result.jobs[0].companyId,'nio');
  assert.equal(result.jobs[0].descriptionKind,'full');assert.ok(result.jobs[0].description.includes('熟悉 SQL'));
  assert.equal(result.jobs[0].url,'https://nio.jobs.feishu.cn/index/position/1/detail');
});

test('Feishu missing descriptions remain genuine list summaries, campus type and website path survive',async()=>{
  const result=await fetchExtendedJobs({slug:'ireader'},{fetcher:async(url,options)=>{
    if(url.endsWith('/csrf/token'))return csrf();
    assert.equal(options.headers['website-path'],'zhangyue');
    return Response.json({code:0,data:{count:1,job_post_list:[{...position(7),description:null,requirement:null,process_type:2}]}});
  }});
  assert.equal(result.jobs[0].descriptionKind,'summary');assert.equal(result.jobs[0].track,'campus');
  assert.equal(result.jobs[0].verificationStatus,'official');assert.match(result.jobs[0].url,/\/zhangyue\/position\/7\/detail$/);
});

test('Feishu malformed tokens, blocked pages, and repeated pagination never claim a complete snapshot',async()=>{
  await assert.rejects(fetchExtendedJobs({slug:'nio'},{fetcher:async()=>Response.json({code:0,data:{token:'no-cookie'}})}),/格式/);
  await assert.rejects(fetchExtendedJobs({slug:'nio'},{fetcher:async()=>new Response('',{status:403})}),/403/);
  await assert.rejects(fetchExtendedJobs({slug:'nio'},{fetcher:async url=>url.endsWith('/csrf/token')?csrf():Response.json({code:0,data:{count:3,job_post_list:[position(1)]}})}),/重复/);
});

test('Feishu overlapping pages are deduplicated and marked partial',async()=>{
  const result=await fetchExtendedJobs({slug:'qunar'},{fetcher:async(url,options)=>{
    if(url.endsWith('/csrf/token'))return csrf();
    const {offset}=JSON.parse(options.body);
    return Response.json({code:0,data:{count:4,job_post_list:offset===0?[position(1),position(2)]:[position(2),position(3)]}});
  }});
  assert.equal(result.complete,false);assert.equal(result.jobs.length,3);
});

test('Bytedance maps society to experienced URLs and preserves history at its search cap',async()=>{
  const result=await fetchExtendedJobs({slug:'bytedance'},{fetcher:async(url,options)=>{
    if(url.endsWith('/csrf/token'))return csrf();
    assert.equal(options.headers['website-path'],'society');assert.equal(options.headers['Portal-Channel'],'office');
    const {offset,limit,portal_type}=JSON.parse(options.body);assert.equal(portal_type,2);
    return Response.json({code:0,data:{count:10000,job_post_list:Array.from({length:limit},(_,i)=>position(offset+i+1))}});
  }});
  assert.equal(result.jobs.length,10000);assert.equal(result.complete,false);assert.match(result.note,/10,000/);
  assert.match(result.jobs[0].url,/\/experienced\/position\/1\/detail$/);
});

const iv='1234567890123456',key='abcdef1234567890';
const encrypted=data=>{const cipher=createCipheriv('aes-128-cbc',Buffer.from(key),Buffer.from(iv));return Response.json({necromancer:key,data:Buffer.concat([cipher.update(JSON.stringify(data)),cipher.final()]).toString('base64')});};
const mokaHome=(org='zte',site=47588)=>new Response(`<input id="init-data" type="hidden" value="${JSON.stringify({org:{id:org},siteId:String(site),aesIv:iv}).replaceAll('"','&quot;')}">`);
const mokaRow=(id,status='open')=>({id:String(id),orgId:'zte',status,title:'研发工程师',locations:[{country:'中国',provinceName:'陕西',cityName:'西安'}],publishedAt:'2026-10-15T12:00:00'});

test('Moka retains anonymous redirect cookies, decodes the public envelope, and excludes paused positions',async()=>{
  let homepageCalls=0;const offsets=[];
  const result=await fetchExtendedJobs({slug:'zte',careersUrl:'https://127.0.0.1'},{fetcher:async(url,options)=>{
    assert.equal(new URL(url).origin,'https://app.mokahr.com');
    if(options.method==='GET'){
      if(++homepageCalls===1)return new Response('',{status:302,headers:{Location:'/social-recruitment/zte/47588','Set-Cookie':'moka-apply=anonymous; Secure; HttpOnly'}});
      assert.equal(options.headers.Cookie,'moka-apply=anonymous');return mokaHome();
    }
    const body=JSON.parse(options.body);offsets.push(body.offset);assert.equal(body.limit,30);
    return encrypted({code:0,data:{jobStats:{orgId:'zte',total:3},jobs:body.offset===0?[mokaRow(1),mokaRow(2,'pause')]:[mokaRow(3)]}});
  }});
  assert.deepEqual(offsets,[0,2]);assert.equal(result.complete,true);assert.equal(result.jobs.length,2);assert.match(result.note,/排除 1 条/);
  assert.equal(result.jobs[0].descriptionKind,'summary');assert.equal(result.jobs[0].companyId,'zte');
  assert.equal(result.jobs[0].url,'https://app.mokahr.com/social-recruitment/zte/47588#/job/1');
});

test('Moka rejects foreign redirects, wrong tenants, invalid envelopes, and repeated pages',async()=>{
  await assert.rejects(fetchExtendedJobs({slug:'zte'},{fetcher:async()=>new Response('',{status:302,headers:{Location:'https://example.com/'}})}),/跳转/);
  await assert.rejects(fetchExtendedJobs({slug:'zte'},{fetcher:async()=>mokaHome('foreign')}),/格式/);
  await assert.rejects(fetchExtendedJobs({slug:'zte'},{fetcher:async(url,options)=>options.method==='GET'?mokaHome():Response.json({data:'invalid',necromancer:key})}),/格式/);
  await assert.rejects(fetchExtendedJobs({slug:'zte'},{fetcher:async(url,options)=>options.method==='GET'?mokaHome():encrypted({code:0,data:{jobStats:{orgId:'zte',total:2},jobs:[mokaRow(1)]}})}),/重复/);
});

test('unsupported source does not make network requests',async()=>{
  assert.equal(await fetchExtendedJobs({slug:'example'},{fetcher:()=>{throw new Error('Unexpected network request')}}),null);
});
