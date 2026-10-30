import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Store} from '../server/db.mjs';
import {createServer} from '../server/index.mjs';
import {manualJob} from '../server/jobs.mjs';
import {renderResumeMarkdown} from '../dist/resume-markdown.js';
import {DEFAULT_RESUME_LAYOUT,RESUME_LAYOUTS,isResumeLayout,normalizeResumeLayout,resumeLayoutPickerHtml,resumePrintDocumentHtml} from '../dist/resume-layouts.js';

test('twelve layouts offer distinct choices and print the rendered document safely',()=>{
  assert.equal(RESUME_LAYOUTS.length,12);
  assert.equal(new Set(RESUME_LAYOUTS.map(layout=>layout.id)).size,12);
  assert.equal(DEFAULT_RESUME_LAYOUT,'classic');
  assert.equal(normalizeResumeLayout('unknown'),'classic');
  assert.equal(isResumeLayout('sidebar'),true);
  assert.equal(RESUME_LAYOUTS.find(layout=>layout.id==='sidebar').ats,false);
  const picker=resumeLayoutPickerHtml('modern');
  assert.equal((picker.match(/name="resume-template"/g)||[]).length,12);
  assert.match(picker,/value="modern" checked/);
  const html=resumePrintDocumentHtml({title:'<candidate>',content:'# Candidate\n## Skills\n- SQL\n## Work\n### Role\n**Result**',layout:'sidebar',buttonLabel:'Print'},renderResumeMarkdown);
  assert.match(html,/layout-sidebar/);
  assert.match(html,/resume-sidebar/);
  assert.match(html,/href="\/resume.css"/);
  assert.match(html,/<h3>Role<\/h3>/);
  assert.match(html,/<strong>Result<\/strong>/);
  assert.doesNotMatch(html,/<candidate>/);
  assert.doesNotMatch(html,/###|\*\*Result/);
});

test('printed single-column layouts lead with existing skills before experience',()=>{
  const content='# Candidate\nContact\n## Work Experience\n- Built tests\n## Technical Skills\n- Python';
  for(const layout of ['classic','campus','modern','modular']){
    const html=resumePrintDocumentHtml({title:'Candidate',content,layout,buttonLabel:'Print'},renderResumeMarkdown);
    assert.ok(html.indexOf('<h1>Candidate</h1>')<html.indexOf('<h2>Technical Skills</h2>'),layout);
    assert.ok(html.indexOf('<h2>Technical Skills</h2>')<html.indexOf('<h2>Work Experience</h2>'),layout);
  }
});

test('the server serves every resume rendering asset with the right MIME type',async()=>{
  const server=createServer({store:new Store(':memory:')});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const base=`http://127.0.0.1:${server.address().port}`;
    for(const [asset,type] of [['resume.css','css'],['resume-layouts.js','javascript'],['resume-markdown.js','javascript']]){
      const response=await fetch(`${base}/${asset}`);
      assert.equal(response.status,200,asset);
      assert.match(response.headers.get('content-type'),new RegExp(type),asset);
    }
  }finally{await new Promise(resolve=>server.close(resolve));}
});

test('selected layout persists without changing content or prior review',async()=>{
  const store=new Store(':memory:'),job=manualJob({company:'Example',title:'Engineer',location:'Toronto',region:'ca',track:'experienced',url:'https://example.com/job',description:'Engineering'});
  store.addJob(job);
  const id=randomUUID(),content='# Candidate\n## Work\n- Built tests';
  store.createResume({id,jobId:job.id,title:'Example · Engineer',content,status:'reviewed',reviewedAt:new Date().toISOString(),language:'en',notes:[],createdAt:new Date().toISOString()});
  const server=createServer({store});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const base=`http://127.0.0.1:${server.address().port}`,token=(await(await fetch(`${base}/api/state`)).json()).token;
    const post=body=>fetch(`${base}/api/resumes/save`,{method:'POST',headers:{'Content-Type':'application/json','X-FMJ-Token':token},body:JSON.stringify(body)});
    assert.equal((await post({id,content,layout:'sidebar',revision:1})).status,200);
    assert.equal(store.get('resumes',id).layout,'sidebar');
    assert.equal(store.get('resumes',id).content,content);
    assert.equal(store.get('resumes',id).status,'reviewed');
    assert.equal((await post({id,content,layout:'invalid',revision:2})).status,400);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
