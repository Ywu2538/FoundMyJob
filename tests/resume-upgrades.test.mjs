import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {extractDocument} from '../server/document-import.mjs';
import {Store} from '../server/db.mjs';
import {createServer} from '../server/index.mjs';
import {manualJob} from '../server/jobs.mjs';
import {CursorConnection,cursorLoginUrl} from '../server/cursor-connection.mjs';
import {Providers} from '../server/providers.mjs';
import {canUseResumeLayout,RESUME_LAYOUTS,resumePrintDocumentHtml} from '../dist/resume-layouts.js';
import {renderResumeMarkdown} from '../dist/resume-markdown.js';

const fixture=name=>readFile(new URL('./fixtures/document-import/'+name,import.meta.url));
test('local OCR reads image-only PDF, raster images and embedded Word images',async()=>{
 for(const filename of ['ocr-resume.png','ocr-resume.pdf','image-word.docx']){
  const result=await extractDocument(filename,await fixture(filename));
  assert.match(result.text,/Python SQL/i,filename);assert.match(result.text,/Example University/i,filename);assert.equal(result.ocrUsed,true);
  if(filename.endsWith('docx')){assert.match(result.text,/工作经历：软件工程师/);assert.equal(result.text.includes('\ufffd'),false);assert.equal(result.images.length,1);}
  if(filename.endsWith('pdf'))assert.deepEqual(result.ocrPages,[1]);
 }
 const chinese=await extractDocument('ocr-chinese.png',await fixture('ocr-chinese.png'));assert.match(chinese.text.replace(/\s/g,''),/教育经历上海交通大学/);
 await assert.rejects(()=>extractDocument('fake.png',Buffer.from('<svg/>')),/图片内容与格式不符/);
});

test('two simultaneous OCR imports load complete local language models',async()=>{
 const bytes=await fixture('ocr-chinese.png');
 const results=await Promise.all([extractDocument('first.png',bytes),extractDocument('second.png',bytes)]);
 for(const result of results){
  assert.equal(result.ocrUsed,true);
  assert.match(result.text.replace(/\s/g,''),/教育经历上海交通大学/);
  assert.match(result.text.replace(/\s/g,''),/专业技能PythonSQL/);
 }
});

test('portrait layouts print photos only when supported and reject injected photo markup',async()=>{
 const photo='data:image/jpeg;base64,'+(await readFile(new URL('./fixtures/user-center/avatar.jpg',import.meta.url))).toString('base64');
 const content='# Candidate\n## Skills\n- SQL\n## Work\n- Built pipelines';
 assert.equal(RESUME_LAYOUTS.length,12);assert.equal(RESUME_LAYOUTS.filter(x=>x.photo).length,4);
 for(const layout of RESUME_LAYOUTS){
  const html=resumePrintDocumentHtml({content,layout:layout.id,photo,title:'Resume',buttonLabel:'Print'},renderResumeMarkdown);
  assert.equal(html.includes('class="resume-portrait"'),layout.photo,layout.id);assert.match(html,/Built pipelines/);
 }
 assert.doesNotMatch(renderResumeMarkdown(content,'cn-formal',{photo:'" onerror="alert(1)'}),/onerror|<img/);
 const paid=[{id:'premium',access:'credits',creditCost:20,entitlementKey:'resume-template:premium'}];
 assert.equal(canUseResumeLayout('premium',[],paid),false);assert.equal(canUseResumeLayout('premium',['resume-template:premium'],paid),true);
 assert.equal(canUseResumeLayout('missing'),false);
});

async function app(fn,options={}){
 const store=new Store(':memory:'),server=createServer({store,...options});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`,state=await(await fetch(base+'/api/state')).json();
 const post=async(route,body,token=state.token)=>{const response=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json','X-FMJ-Token':token},body:JSON.stringify(body)});return {status:response.status,data:await response.json()};};
 try{await fn({store,post,base});}finally{await new Promise(resolve=>server.close(resolve));}
}

test('resume photo is versioned, persists through layout changes and invalidates review',()=>app(async({store,post,base})=>{
 const job=manualJob({company:'Example',title:'Engineer',location:'Toronto',region:'ca',track:'experienced',url:'https://example.com/job',description:'SQL'});store.addJob(job);
 const content='# Candidate\n## Skills\n- SQL',id='photo-resume',photo='data:image/jpeg;base64,'+(await readFile(new URL('./fixtures/user-center/avatar.jpg',import.meta.url))).toString('base64');
 store.createResume({id,jobId:job.id,content,status:'reviewed',layout:'classic',reviewedAt:'before'});
 assert.equal((await post('/api/resumes/save',{id,content,photo,layout:'cn-formal',revision:1})).status,200);
 assert.equal(store.get('resumes',id).status,'draft');assert.equal(store.get('resumes',id).photo,photo);
 assert.equal((await post('/api/resumes/save',{id,content,photo:'',revision:1})).status,409);
 assert.equal((await post('/api/resumes/save',{id,content,photo:'https://evil.test/photo',revision:2})).status,400);
 assert.equal((await post('/api/resumes/save',{id,content,layout:'north-america',review:true,revision:2})).status,200);
 assert.equal(store.get('resumes',id).photo,photo);assert.equal(store.get('resumes',id).status,'reviewed');
 assert.equal((await post('/api/resumes/save',{id,content,photo:'',revision:3})).status,200);
 assert.equal(store.get('resumes',id).status,'draft');
 const catalog=await(await fetch(base+'/api/resume-templates')).json();assert.equal(catalog.templates.length,12);assert.equal(catalog.billingEnabled,false);
}));

test('Cursor can be enabled, disabled and configured through authenticated APIs without a restart',async()=>{
 const connection=new CursorConnection({runner:async()=>({stdout:'{"isAuthenticated":true}'}),resolveCli:()=>({command:'agent',args:[]})});
 await app(async({store,post})=>{
  assert.equal((await post('/api/cursor/connect',{consent:true},'bad')).status,403);
  assert.equal((await post('/api/cursor/connect',{})).status,400);
  const connected=await post('/api/cursor/connect',{consent:true});assert.equal(connected.status,200);assert.equal(connected.data.capabilities.cursor,true);
  assert.equal(store.get('config','cursorIntegration').enabled,true);
  const saved=await post('/api/cursor/key',{key:'private-test-key'});assert.equal(saved.status,200);assert.equal(JSON.stringify(saved.data).includes('private-test-key'),false);
  assert.equal(connection.environment().CURSOR_API_KEY,'private-test-key');
  const disabled=await post('/api/cursor/disable',{});assert.equal(disabled.data.capabilities.cursor,false);assert.equal(store.get('config','cursorIntegration').enabled,false);assert.equal(connection.key,'');
 },{cursorConnection:connection});
});

test('Cursor browser login uses an argument array, bounded official URL and no shell',()=>{
 let args,options;
 const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.kill=()=>child.emit('close',0);
 const connection=new CursorConnection({resolveCli:()=>({command:'node.exe',args:['C:/app/cursor/index.js']}),spawnChild:(command,a,o)=>{args=a;options=o;return child;}});
 connection.startLogin();assert.deepEqual(args,['C:/app/cursor/index.js','login']);assert.equal(options.shell,false);assert.equal(options.windowsHide,true);assert.equal(options.env.NO_OPEN_BROWSER,'1');
 child.stdout.write('Open https://cursor.com/login?challenge=test\n');assert.match(connection.login.url,/^https:\/\/cursor.com\//);
 assert.equal(cursorLoginUrl('https://cursor.com.evil.test/login'),null);assert.equal(cursorLoginUrl('https://attacker@cursor.com/login'),null);
 connection.close();
});

test('new BYOK providers send only the selected key to their fixed official API',async()=>{
 for(const id of ['kimi','doubao','grok','gemini']){
  const requests=[],providers=new Providers({fetcher:async(url,options)=>{requests.push({url,options});return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({content:'# Candidate',notes:[]})}}]}),{headers:{'Content-Type':'application/json'}});}});
  providers.setKey(id,'selected-private-key');providers.setKey('deepseek','other-private-key');
  const profile={name:'Candidate',email:'',phone:'',location:'',target:'Engineer',education:'University',experience:'Built tests',projects:'',skills:['SQL']};
  await providers.generate({profile,job:{company:'Example',title:'Engineer'},language:'en',provider:id,model:'selected-model'});
  assert.equal(requests.length,1);assert.equal(requests[0].url,providers.provider(id).base+'/chat/completions');assert.equal(requests[0].options.headers.Authorization,'Bearer selected-private-key');
  assert.equal(requests[0].options.redirect,'error');assert.equal(JSON.stringify(providers.list()).includes('private-key'),false);
 }
});
