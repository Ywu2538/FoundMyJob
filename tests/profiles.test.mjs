import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {Store,blankProfile} from '../server/db.mjs';
import {createServer} from '../server/index.mjs';
import {manualJob} from '../server/jobs.mjs';
import {filterJobs,matchJob} from '../dist/core.js';
import {buildPrompt} from '../server/cursor.mjs';

const candidate={...blankProfile(),label:'加拿大 · Data Engineer',market:'ca',resumeLanguage:'en',name:'Candidate',education:'University',experience:'Built SQL pipelines.',skills:['SQL','Python'],target:'Data Engineer'};
const jobInput={title:'Data Engineer',company:'Example',description:'SQL pipelines',location:'Toronto',region:'ca',track:'experienced',url:'https://example.com/jobs/1'};
async function app(fn,generator=async({profile,language})=>({content:`# ${profile.name}\n${profile.experience}\n${language}`,notes:[],mode:'cursor'})){
 const store=new Store(':memory:'),server=createServer({store,cursorEnabled:true,generator});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}`;
 const initial=await(await fetch(base+'/api/state')).json();
 const post=async(p,body)=>{const response=await fetch(base+p,{method:'POST',headers:{'Content-Type':'application/json','X-FMJ-Token':initial.token},body:JSON.stringify(body)});return {status:response.status,data:await response.json()};};
 try{await fn({store,post,id:initial.profiles[0].id});}finally{await new Promise(r=>server.close(r));}
}
async function completed(store,id){for(let i=0;i<100;i++){const task=store.get('tasks',id);if(task.status!=='running')return task;await new Promise(r=>setTimeout(r,5));}throw new Error('Task did not settle');}

test('upgrade preserves legacy profile, historical facts, versions, applications and task identity exactly once',async()=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'fmj-migration-')),filename=path.join(directory,'legacy.sqlite');
 try{
  const legacy=new DatabaseSync(filename);
  legacy.exec(`CREATE TABLE config(key TEXT PRIMARY KEY,data TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1);
   CREATE TABLE jobs(id TEXT PRIMARY KEY,source_id TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,data TEXT NOT NULL);
   CREATE TABLE resumes(id TEXT PRIMARY KEY,job_id TEXT NOT NULL REFERENCES jobs(id),data TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1);
   CREATE TABLE resume_versions(id INTEGER PRIMARY KEY,resume_id TEXT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,data TEXT NOT NULL);
   CREATE TABLE applications(id TEXT PRIMARY KEY,job_id TEXT NOT NULL UNIQUE REFERENCES jobs(id),data TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1);
   CREATE TABLE tasks(id TEXT PRIMARY KEY,data TEXT NOT NULL); PRAGMA user_version=1;`);
  legacy.prepare('INSERT INTO config VALUES(?,?,?)').run('profile',JSON.stringify(candidate),7);
  legacy.prepare('INSERT INTO config VALUES(?,?,?)').run('settings',JSON.stringify({language:'en',provider:'cursor',model:'auto'}),3);
  const job=manualJob(jobInput),resume={id:'resume',jobId:job.id,content:'Historical resume',sourceProfile:{...candidate,experience:'Earlier facts'},status:'reviewed'};
  legacy.prepare('INSERT INTO jobs VALUES(?,?,1,?)').run(job.id,'manual',JSON.stringify(job));
  legacy.prepare('INSERT INTO resumes VALUES(?,?,?,?)').run(resume.id,job.id,JSON.stringify(resume),4);
  legacy.prepare('INSERT INTO resume_versions(resume_id,data) VALUES(?,?)').run(resume.id,JSON.stringify(resume));
  legacy.prepare('INSERT INTO applications VALUES(?,?,?,?)').run('application',job.id,JSON.stringify({id:'application',jobId:job.id,status:'已投递'}),5);
  legacy.prepare('INSERT INTO tasks VALUES(?,?)').run('task',JSON.stringify({id:'task',jobId:job.id,status:'completed',resumeId:resume.id}));
  legacy.close();
  let store=new Store(filename);const profile=store.snapshot().profiles[0];
  assert.equal(profile.experience,candidate.experience);assert.equal(profile.resumeLanguage,'en');
  assert.equal(store.get('resumes','resume').sourceProfile.experience,'Earlier facts');
  assert.equal(store.get('resumes','resume').profileId,profile.id);assert.equal(store.get('resumes','resume').revision,4);
  assert.equal(store.get('applications','application').profileId,profile.id);assert.equal(store.get('applications','application').revision,5);
  assert.equal(store.get('tasks','task').profileId,profile.id);
  assert.equal(JSON.parse(store.db.prepare('SELECT data FROM resume_versions').get().data).sourceProfile.experience,'Earlier facts');
  const second=store.createProfile({...candidate,label:'中国 · Software Engineer',market:'cn',resumeLanguage:'zh'});
  store.track(job.id,second.id);assert.equal(store.rows('applications').length,2);
  store.archiveProfile(second.id,true,second.revision);store.close();
  store=new Store(filename);assert.equal(store.snapshot().profiles.length,2);assert.equal(store.snapshot().profiles[0].id,profile.id);assert.equal(store.profile(second.id,{allowArchived:true}).archived,true);assert.equal(store.get('resumes','resume').content,resume.content);store.close();
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('profile create, copy, edit, conflicts, archive and restore keep profiles independent',()=>app(async({post,store,id})=>{
 assert.equal((await post('/api/profiles/save',{...candidate,id,revision:1})).status,200);
 const result=await post('/api/profiles/create',{copyFrom:id,label:'中国 · Software Engineer',market:'cn',resumeLanguage:'zh'});
 assert.equal(result.status,201);const copyId=result.data.createdProfileId;assert.notEqual(id,copyId);
 const copy=store.profile(copyId);assert.deepEqual(copy.skills,candidate.skills);assert.equal(copy.experience,candidate.experience);
 assert.equal((await post('/api/profiles/save',{...copy,target:'Software Engineer',experience:'Built Java services.',skills:['Java']})).status,200);
 assert.equal(store.profile(id).experience,candidate.experience);assert.deepEqual(store.profile(id).skills,candidate.skills);
 assert.equal((await post('/api/profiles/save',{...copy,experience:'Stale overwrite'})).status,409);
 assert.equal((await post('/api/profiles/save',{...copy,id:'missing'})).status,404);
 assert.equal((await post('/api/profiles/create',{copyFrom:'missing',label:'Copy'})).status,404);
 assert.equal((await post('/api/profiles/create',{label:' ',market:'ca'})).status,400);
 assert.equal((await post('/api/profiles/create',{label:'New',market:'invalid'})).status,400);
 assert.equal((await post('/api/profiles/archive',{id:copyId,revision:2,archived:true})).status,200);
 assert.equal((await post('/api/profiles/archive',{id,revision:2,archived:true})).status,400);
 assert.equal((await post('/api/profiles/archive',{id:copyId,revision:2,archived:false})).status,409);
 assert.equal((await post('/api/profiles/archive',{id:copyId,revision:3,archived:false})).status,200);
}));

test('generation pins the selected profile facts and language and rejects stale, missing or archived selections',async()=>{
 let finish,received;
 await app(async({store,post,id})=>{
  store.editProfile(id,candidate,1);
  const other=store.createProfile({...candidate,label:'中国 · Software Engineer',market:'cn',resumeLanguage:'zh',experience:'Built Java services.'});
  const job=manualJob(jobInput);store.addJob(job);
  const input={provider:'cursor',model:'auto',jobId:job.id,profileId:other.id,profileRevision:1,requestId:'snapshot-task',consent:true};
  assert.equal((await post('/api/generate',{...input,profileId:undefined})).status,400);
  assert.equal((await post('/api/generate',{...input,profileId:'missing'})).status,404);
  assert.equal((await post('/api/generate',{...input,profileRevision:0})).status,409);
  store.archiveProfile(other.id,true,1);
  assert.equal((await post('/api/generate',input)).status,404);
  store.archiveProfile(other.id,false,2);input.profileRevision=3;
  assert.equal((await post('/api/generate',input)).status,202);
  try{
   assert.equal(received.profile.experience,other.experience);assert.equal(received.language,'zh');
   assert.equal(store.get('tasks',input.requestId).sourceProfile.experience,other.experience);
   assert.equal((await post('/api/profiles/archive',{id:other.id,revision:3,archived:true})).status,400);
   store.editProfile(other.id,{experience:'Changed after launch',label:'Renamed'},3);
  }finally{finish({content:'# Candidate\nOriginal facts',notes:[],mode:'cursor'});}
  assert.equal((await completed(store,input.requestId)).status,'completed');
  const resume=store.rows('resumes')[0];assert.equal(resume.profileId,other.id);assert.equal(resume.sourceProfile.experience,other.experience);assert.equal(resume.profileLabel,other.label);assert.equal(resume.profileRevision,3);
  assert.equal((await post('/api/generate',input)).status,200);assert.equal(store.rows('resumes').length,1);
  assert.equal((await post('/api/generate',{...input,profileId:id})).status,409);
  store.archiveProfile(other.id,true,4);assert.equal(store.get('resumes',resume.id).sourceProfile.experience,other.experience);
 },async input=>{received=input;return new Promise(resolve=>{finish=resolve;});});
});

test('reviewed resume for one profile cannot authorize another profile application',()=>app(async({post,store,id})=>{
 store.editProfile(id,candidate,1);const other=store.createProfile({...candidate,label:'Second direction'}),job=manualJob(jobInput);store.addJob(job);
 await post('/api/applications',{jobId:job.id,profileId:id});await post('/api/applications',{jobId:job.id,profileId:other.id});await post('/api/applications',{jobId:job.id,profileId:id});
 assert.equal(store.rows('applications').length,2);
 store.createResume({id:'reviewed',jobId:job.id,profileId:id,status:'reviewed',content:'# Candidate'});
 for(const a of store.rows('applications'))assert.equal((await post('/api/applications/status',{id:a.id,status:'已投递',revision:a.revision})).status,a.profileId===id?200:400);
}));

test('market filtering distinguishes Canada from US, handles legacy jobs, and target direction changes ranking',()=>{
 const jobs=[{id:'ca',location:'Toronto',region:'na',tags:['SQL'],category:'数据',track:'experienced'},{id:'us',location:'New York',region:'na',tags:['SQL'],category:'数据',track:'experienced'},{id:'cn',location:'上海',region:'cn',tags:['Java'],category:'研发',track:'experienced'},{id:'unknown',location:'Remote',region:'na',tags:[],category:'其他'},{id:'mixed',location:'Canada / United States',region:'na',tags:[],category:'其他'}];
 assert.deepEqual(filterJobs(jobs,candidate,{region:'ca'}).map(j=>j.id),['ca','mixed']);
 assert.deepEqual(filterJobs(jobs,candidate,{region:'cn'}).map(j=>j.id),['cn']);
 assert.equal(filterJobs(jobs,candidate,{region:'na'}).length,4);
 assert.equal(filterJobs([manualJob({...jobInput,location:'Remote',region:'ca'})],candidate,{region:'ca'}).length,1);
 const data={...jobs[0],tags:[]},software={...data,category:'研发'};
 assert.ok(matchJob(data,candidate).score>matchJob(software,candidate).score);
 assert.ok(matchJob(software,{...candidate,target:'Software Engineer'}).score>matchJob(data,{...candidate,target:'Software Engineer'}).score);
 const source=JSON.parse(buildPrompt(candidate,jobInput,'en').split('SOURCE DATA:\n')[1]);
 assert.equal(source.profile.market,'ca');assert.equal(source.profile.target,'Data Engineer');
});

test('three location preferences survive create, copy, save and reject invalid values',()=>app(async({post,store,id})=>{
  const initial=store.profile(id);
  assert.equal(initial.searchScope,'all');
  for(const searchScope of ['domestic','overseas','all']){
    const created=await post('/api/profiles/create',{label:searchScope,searchScope,market:'ca',resumeLanguage:'en'});
    assert.equal(created.status,201);
    const newId=created.data.createdProfileId;
    assert.equal(store.profile(newId).searchScope,searchScope);
    assert.equal(store.profile(newId).market,searchScope==='domestic'?'cn':searchScope==='all'?'':'ca');
    const copy=await post('/api/profiles/create',{label:'Copy',copyFrom:newId});
    assert.equal(store.profile(copy.data.createdProfileId).searchScope,searchScope);
    const saved=await post('/api/profiles/save',{...candidate,id,revision:store.profile(id).revision,searchScope});
    assert.equal(saved.status,200);assert.equal(store.profile(id).searchScope,searchScope);
  }
  assert.equal((await post('/api/profiles/create',{label:'Invalid',searchScope:'invalid'})).status,400);
  assert.equal((await post('/api/profiles/save',{...store.profile(id),searchScope:'invalid'})).status,400);
}));

test('structured preferences survive save and copy, reject inconsistent cities, and allow clearing legacy text',()=>app(async({post,store,id})=>{
 const prefs={country:'ca',city:'多伦多',work:'onsite'};
 const saved=await post('/api/profiles/save',{...candidate,id,revision:1,searchScope:'all',preferences:'Toronto，onsite',jobPreferences:prefs});
 assert.equal(saved.status,200);
 let p=store.profile(id);
 assert.deepEqual(p.jobPreferences,{country:'ca',city:'Toronto',work:'onsite'});assert.equal(p.searchScope,'overseas');assert.equal(p.market,'ca');
 const copy=await post('/api/profiles/create',{copyFrom:id,label:'Copy'});
 assert.deepEqual(store.profile(copy.data.createdProfileId).jobPreferences,p.jobPreferences);
 const domestic=await post('/api/profiles/create',{copyFrom:id,label:'Domestic',searchScope:'domestic',market:'cn'});
 assert.equal(store.profile(domestic.data.createdProfileId).jobPreferences.country,'');
 assert.equal(store.profile(domestic.data.createdProfileId).searchScope,'domestic');
 for(const jobPreferences of [{...prefs,country:'us'},{...prefs,work:'invalid'},{...prefs,country:'invalid'},{...prefs,city:'a'.repeat(121)},{city:'Unknown City',country:'',work:''}])assert.equal((await post('/api/profiles/save',{...p,jobPreferences})).status,400);
 assert.equal(store.profile(id).revision,p.revision);
 assert.equal((await post('/api/profiles/save',{...p,jobPreferences:{country:'ca',city:'Vancouver',work:'hybrid'}})).status,200);
 p=store.profile(id);assert.equal(p.jobPreferences.city,'Vancouver');
 assert.equal((await post('/api/profiles/save',{...p,searchScope:'all',market:'',jobPreferences:{country:'',city:'',work:''}})).status,200);
 p=store.profile(id);assert.equal(p.preferences,'Toronto，onsite');assert.deepEqual(p.jobPreferences,{country:'',city:'',work:''});assert.equal(p.searchScope,'all');
}));

test('stored legacy preferences are resolved on read without rewriting the profile or revision',()=>app(async({store,post,id})=>{
 store.editProfile(id,{...candidate,market:'overseas',searchScope:'overseas',preferences:'Toronto，onsite',jobPreferences:null},1);
 const before=store.get('profiles',id),p=store.profile(id);
 assert.deepEqual(p.jobPreferences,{country:'ca',city:'Toronto',work:'onsite'});
 assert.deepEqual(store.get('profiles',id),before);
 assert.equal((await post('/api/profiles/save',{...p,jobPreferences:{country:'ca',city:'Kingston',work:'remote'}})).status,200);
 assert.equal(store.profile(id).jobPreferences.city,'Kingston');
}));
