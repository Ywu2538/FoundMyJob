import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeJobEvidence,extractRequirements} from '../dist/job-evidence.js';
import {evidencePanelHtml} from '../dist/job-evidence-view.js';
import {setLocale} from '../dist/i18n.js';
import {Store,blankProfile} from '../server/db.mjs';
import {createServer} from '../server/index.mjs';
import {manualJob} from '../server/jobs.mjs';

const compare=(requirement,profile={})=>analyzeJobEvidence({requirements:[requirement]},profile).rows[0];

test('requirements show traceable applied evidence, absent information and explicit years gaps separately',()=>{
  const job={description:'任职要求：\n具备 SQL 经验。\n3年以上工作经验。\n加分项：\nAWS experience.'};
  const profile={experience:'总计2年工作经验。',projects:'使用 SQL 分析课程数据。',skills:[]};
  const result=analyzeJobEvidence(job,profile);
  assert.deepEqual(result.counts,{supported:1,unknown:1,gap:1});
  assert.deepEqual(result.rows.map(r=>r.kind),['required','required','preferred']);
  for(const row of result.rows){
    assert.equal(job.description.slice(row.source.start,row.source.end),row.source.quote);
    for(const item of row.evidence)assert.equal(profile[item.field].slice(item.start,item.end),item.quote);
  }
});

test('source extraction keeps arbitrary requirements and avoids inventing demands from tags or duties',()=>{
  const result=extractRequirements({description:'About us:\nWe make SQL software.\nResponsibilities:\nBuild Python tools.\nRequirements:\nAble to travel internationally.\nPreferred qualifications:\nSQL experience.',tags:['Java']});
  assert.equal(result.rows.length,2);
  assert.equal(result.rows[0].kind,'required');
  assert.equal(result.rows[1].kind,'preferred');
  assert.equal(analyzeJobEvidence({description:'We build useful tools.',tags:['SQL']},{}).rows.length,0);
  const row=compare('愿意到项目现场工作');assert.equal(row.status,'unknown');assert.equal(row.source.field,'requirements');assert.equal(row.source.index,0);
});

test('a bare skill declaration, education mention or aspiration is not evidence of applied experience',()=>{
  for(const profile of [{skills:['SQL']},{education:'SQL course'},{projects:'计划使用SQL开发项目。'},{projects:'Learning SQL to build an app.'}]){
    assert.equal(compare('SQL experience',profile).status,'unknown');
  }
  assert.equal(compare('SQL experience',{}).reason,'not_recorded');
  assert.equal(compare('SQL experience',{skills:['SQL']}).reason,'mention_only');
});

test('exact tool boundaries prevent SQL from matching NoSQL and Java from matching JavaScript',()=>{
  assert.equal(compare('SQL experience',{projects:'Used NoSQL to build a prototype.'}).status,'unknown');
  assert.equal(compare('Java experience',{projects:'Built a JavaScript app.'}).status,'unknown');
  assert.equal(compare('C++ experience',{projects:'Used C++ to build a prototype.'}).status,'supported');
  assert.equal(compare('AWS experience',{projects:'Deployed a prototype using Amazon Web Services.'}).status,'supported');
});

test('missing evidence stays unknown while an explicit negative can establish a gap',()=>{
  assert.equal(compare('AWS experience',{projects:'Built a SQL report.'}).status,'unknown');
  assert.equal(compare('AWS experience',{experience:'没有 AWS 使用经验。'}).status,'gap');
  assert.equal(compare('AWS experience',{experience:'No AWS experience.',projects:'Used AWS to deploy a prototype.'}).reason,'conflicting_evidence');
  assert.equal(compare('SQL and Python experience',{projects:'Used SQL to build a report.'}).status,'unknown');
  assert.equal(compare('SQL and Python experience',{projects:'Used SQL and Python to analyze data.'}).status,'supported');
  assert.notEqual(compare('SQL experience',{projects:'Built SQL reports without AWS.'}).status,'gap');
  assert.notEqual(compare('SQL experience',{projects:'No AWS experience but used SQL.'}).status,'gap');
  assert.equal(compare('SQL experience',{experience:'I did not use SQL.'}).status,'gap');
  assert.equal(compare('SQL experience',{projects:'Will use SQL to build a report.'}).status,'unknown');
  assert.equal(compare('SQL experience',{projects:'Used SQL?'}).status,'unknown');
  assert.equal(compare('SQL experience',{projects:'Not only used SQL but also Python.'}).status,'supported');
  assert.equal(compare('No SQL experience required').kind,'unspecified');
});

test('proficiency, professional scope, alternatives and additional qualifications remain unconfirmed',()=>{
  const profile={projects:'使用 SQL 分析课程数据。Used AWS to deploy a prototype.'};
  for(const requirement of ['精通 SQL','SQL or Python experience','SQL experience in a regulated bank','3 years SQL experience','Production AWS experience','SQL and excellent communication skills']){
    assert.equal(compare(requirement,profile).status,'unknown',requirement);
  }
});

test('work years require a single explicit comparable total, never project dates or partial timelines',()=>{
  const requirement='至少3年工作经验';
  assert.equal(compare(requirement,{experience:'总计2年工作经验。'}).status,'gap');
  assert.equal(compare(requirement,{experience:'总计4年工作经验。'}).status,'supported');
  assert.equal(compare(requirement,{experience:'2年以上工作经验。'}).status,'unknown');
  assert.equal(compare(requirement,{projects:'5年工作经验。'}).status,'unknown');
  assert.equal(compare(requirement,{experience:'2024–2025 在某公司实习。'}).status,'unknown');
  assert.equal(compare(requirement,{experience:'2年工作经验。另有3年工作经验。'}).status,'unknown');
  assert.equal(compare('3+ years of work experience',{experience:'2 years of work experience.'}).status,'gap');
  assert.equal(compare('3年以上 SQL 开发经验',{experience:'5年工作经验。'}).status,'unknown');
  assert.equal(compare('3 years full-time work experience',{experience:'4 years of work experience.'}).status,'unknown');
  assert.equal(compare('本科，3年工作经验',{experience:'5年工作经验。'}).status,'unknown');
  assert.equal(compare('3 years of work experience or an equivalent degree',{experience:'2 years of work experience.'}).status,'unknown');
});

test('duplicate clauses are removed, summaries flagged and excessive descriptions bounded',()=>{
  const result=analyzeJobEvidence({description:'SQL experience.',requirements:['SQL experience.'],descriptionKind:'summary'},{});
  assert.equal(result.rows.length,1);assert.equal(result.summaryOnly,true);
  const many=analyzeJobEvidence({requirements:Array.from({length:80},(_,i)=>`Condition ${i}`)},{});
  assert.equal(many.rows.length,60);assert.equal(many.truncated,true);
});

test('the comparison view escapes source content and translates interface labels without altering evidence',()=>{
  const quote='Used SQL <img src=x onerror=alert(1)>.';
  const result=analyzeJobEvidence({requirements:['SQL experience']},{projects:quote});
  setLocale('zh');let html=evidencePanelHtml(result,'<script>profile</script>',{hasDraft:true});
  assert.match(html,/部分符合|符合/);assert.match(html,/未保存修改/);assert.ok(!html.includes('<img'));assert.ok(!html.includes('<script>'));
  setLocale('en');html=evidencePanelHtml(result,'Candidate');
  assert.match(html,/Experience comparison: job requirements, my experience and assessment/);assert.match(html,/My experience/);assert.ok(!html.includes('<details'));assert.ok(!html.includes('View sources'));assert.ok(html.includes('Used SQL &lt;img'));
  setLocale('zh');
});

test('match API reads saved snapshots, isolates profiles, detects revisions and never invokes generation',async()=>{
  const store=new Store(':memory:');
  const a=store.createProfile({...blankProfile(),label:'SQL evidence',projects:'Used SQL to analyze survey data.'});
  const b=store.createProfile({...blankProfile(),label:'No evidence',skills:['SQL']});
  const job=manualJob({title:'Analyst',company:'Test',description:'Requirements:\nSQL experience.',location:'Toronto',region:'ca',track:'unknown',url:'https://example.com/evidence-test'});
  store.addJob(job);
  let generated=0;const server=createServer({store,generator:()=>{generated++;throw Error('Not expected');}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  try{
    const initial=await(await fetch(base+'/api/state')).json();
    const request=async(body,token=initial.token,origin)=>{
      const response=await fetch(base+'/api/jobs/match',{method:'POST',headers:{'Content-Type':'application/json','X-FMJ-Token':token,...(origin?{Origin:origin}:{})},body:JSON.stringify(body)});
      return {status:response.status,data:await response.json()};
    };
    const input={jobId:job.id,profileId:a.id,profileRevision:a.revision};
    let result=await request(input);assert.equal(result.status,200);assert.equal(result.data.rows[0].status,'supported');
    assert.equal(result.data.profileId,a.id);const originalJobVersion=result.data.jobVersion;
    result=await request({...input,profileId:b.id,profileRevision:b.revision,profile:{projects:'Used SQL'}});assert.equal(result.data.rows[0].status,'unknown');
    assert.equal((await request(input,'bad')).status,403);
    assert.equal((await request(input,initial.token,'https://other.example')).status,403);
    assert.equal((await request({...input,jobId:'missing'})).status,404);
    assert.equal((await request({...input,profileId:'missing'})).status,404);
    store.editProfile(a.id,{...a,projects:''},a.revision);
    assert.equal((await request(input)).status,409);
    result=await request({...input,profileRevision:a.revision+1});assert.equal(result.data.rows[0].status,'unknown');
    store.db.prepare('UPDATE jobs SET data=? WHERE id=?').run(JSON.stringify({...job,description:'Requirements:\nPython experience.'}),job.id);
    result=await request({...input,profileRevision:a.revision+1});assert.notEqual(result.data.jobVersion,originalJobVersion);
    assert.equal(generated,0);assert.equal(store.rows('tasks').length,0);
    const module=await fetch(base+'/job-evidence-view.js');assert.equal(module.status,200);assert.match(module.headers.get('content-type'),/javascript/);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
