import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {Store} from '../server/db.mjs';
import {createServer} from '../server/index.mjs';
import {validateAvatar} from '../server/user.mjs';
import {prepareAvatar} from '../dist/user-avatar.js';

const avatarBytes=await readFile(new URL('./fixtures/user-center/avatar.jpg',import.meta.url));
const avatar=`data:image/jpeg;base64,${avatarBytes.toString('base64')}`;
const basics=p=>Object.fromEntries(['id','revision','label','name','email','phone','location','target','market','searchScope','resumeLanguage','track','skills','preferences','jobPreferences'].map(key=>[key,p[key]]));
async function app(fn){
 const store=new Store(':memory:'),server=createServer({store,cursorEnabled:false});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 const initial=await(await fetch(base+'/api/state')).json();
 const post=async(route,body,token=initial.token)=>{
  const response=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json','X-FMJ-Token':token},body:JSON.stringify(body)});
  return {status:response.status,data:await response.json()};
 };
 try{await fn({store,base,initial,post});}finally{await new Promise(resolve=>server.close(resolve));}
}

test('user identity persists separately from profiles and legacy initialization happens once',async()=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'fmj-user-'));
 let store;
 try{
  const filename=path.join(directory,'test.sqlite');store=new Store(filename);
  const first=store.snapshot().profiles[0];
  store.editProfile(first.id,{name:'Original candidate'},first.revision);
  store.db.prepare("DELETE FROM config WHERE key='user'").run();store.close();
  store=new Store(filename);
  assert.equal(store.snapshot().user.username,'Original candidate');
  store.config('user',{username:'My workspace',avatar},1);
  store.editProfile(first.id,{name:'Changed candidate'},store.profile(first.id).revision);
  store.createProfile({label:'Another profile',name:'Other candidate'});store.close();
  store=new Store(filename);
  assert.deepEqual(store.snapshot().user,{username:'My workspace',avatar,revision:2});
  assert.equal(store.profile(first.id).name,'Changed candidate');
 }finally{store?.close();await rm(directory,{recursive:true,force:true});}
});

test('user API saves, rejects stale writes, removes avatar, and requires the session token',()=>app(async({store,base,initial,post})=>{
 const profiles=store.snapshot().profiles;
 assert.deepEqual(initial.user,{username:'',avatar:'',revision:1});
 const saved=await post('/api/user',{username:'  Job seeker  ',avatar,revision:1});
 assert.equal(saved.status,200);assert.equal(saved.data.user.username,'Job seeker');assert.equal(saved.data.user.avatar,avatar);
 assert.equal((await post('/api/user',{username:'Stale',avatar:'',revision:1})).status,409);
 assert.equal((await post('/api/user',{username:'Unauthorized',avatar:'',revision:2},'bad-token')).status,403);
 assert.equal(store.snapshot().user.username,'Job seeker');
 assert.equal((await post('/api/user',{username:'Job seeker',avatar:'',revision:2})).status,200);
 assert.equal(store.snapshot().user.avatar,'');assert.deepEqual(store.snapshot().profiles,profiles);
 assert.equal((await fetch(base+'/user-avatar.js')).status,200);
}));

test('invalid user input cannot overwrite saved identity',()=>app(async({store,post})=>{
 for(const changes of [{username:' '},{username:'x'.repeat(81)},{avatar:null},{avatar:'https://example.com/avatar.jpg'},{avatar:'data:image/svg+xml;base64,PHN2Zy8+'},{avatar:'data:image/jpeg;base64,YmFk'}]){
  assert.equal((await post('/api/user',{username:'Candidate',avatar:'',revision:1,...changes})).status,400);
  assert.equal(store.snapshot().user.revision,1);
 }
}));

test('basic profile edits preserve all experience and other profiles, without changing user identity',()=>app(async({store,initial,post})=>{
 const id=initial.profiles[0].id;
 store.editProfile(id,{name:'Candidate',education:'Existing education',experience:'Existing employment',projects:'Existing project'},1);
 const other=store.createProfile({label:'Other',name:'Other candidate',experience:'Other experience'});
 const before=store.profile(id),input={...basics(before),name:'Updated candidate',skills:['SQL','Python'],jobPreferences:{country:'ca',city:'Toronto',work:'hybrid'}};
 const saved=await post('/api/profiles/basics',input);
 assert.equal(saved.status,200);
 const after=store.profile(id);
 for(const key of ['education','experience','projects'])assert.equal(after[key],before[key]);
 assert.equal(after.name,'Updated candidate');assert.deepEqual(after.skills,['SQL','Python']);assert.equal(after.jobPreferences.city,'Toronto');
 assert.equal(after.searchScope,'overseas');assert.equal(after.market,'ca');
 assert.deepEqual(store.profile(other.id),other);assert.deepEqual(store.snapshot().user,initial.user);
 assert.equal((await post('/api/profiles/basics',input)).status,409);
 assert.deepEqual(store.profile(id),after);
}));

test('basic profile API disallows hidden experience edits and archived profiles and supports new profiles',()=>app(async({store,initial,post})=>{
 const id=initial.profiles[0].id,input={...basics(store.profile(id)),name:'New candidate'};
 assert.equal((await post('/api/profiles/basics',input)).status,200);
 assert.equal(store.profile(id).education,'');
 const current=basics(store.profile(id));
 for(const changes of [{education:'Injected'},{experience:'Injected'},{projects:'Injected'},{skills:['x'.repeat(101)]},{jobPreferences:{country:'ca',city:'New York',work:'hybrid'}}]){
  assert.equal((await post('/api/profiles/basics',{...current,...changes})).status,400);
  assert.equal(store.profile(id).revision,current.revision);
 }
 const other=store.createProfile({label:'Other'});store.archiveProfile(other.id,true,other.revision);
 assert.equal((await post('/api/profiles/basics',{...current,id:other.id})).status,404);
 assert.equal((await post('/api/profiles/basics',{...current,id:'missing'})).status,404);
}));

test('avatar validation accepts resized JPEG and rejects malformed or oversized payloads',()=>{
 assert.equal(validateAvatar(avatar),avatar);assert.equal(validateAvatar(''),'');
 assert.throws(()=>validateAvatar(avatar.slice(0,-12)));
 assert.throws(()=>validateAvatar('data:image/jpeg;base64,'+'A'.repeat(180000)));
 const oversized=Buffer.from(avatarBytes);
 const marker=oversized.indexOf(Buffer.from([0xff,0xc0]));assert.ok(marker>0);
 oversized.writeUInt16BE(513,marker+5);
 assert.throws(()=>validateAvatar(`data:image/jpeg;base64,${oversized.toString('base64')}`));
});

test('avatar upload rejects unsupported types and oversized or empty files before decoding',async()=>{
 for(const file of [{type:'image/svg+xml',size:100},{type:'image/png',size:0},{type:'image/jpeg',size:5*1024*1024+1}])await assert.rejects(prepareAvatar(file));
});
