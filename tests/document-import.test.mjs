import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {extractDocument,MAX_IMPORT_BYTES} from '../server/document-import.mjs';
import {createServer} from '../server/index.mjs';
import {Store} from '../server/db.mjs';

const fixture=name=>readFile(new URL('./fixtures/document-import/'+name,import.meta.url));
test('DOCX preserves Chinese, paragraphs, table cells and header/footer text',async()=>{
  const {text,format}=await extractDocument('履历.DOCX',await fixture('experience.docx'));
  assert.equal(format,'docx');assert.match(text,/教育经历：西安大学，计算机科学/);
  assert.match(text,/Work experience: Built Python and SQL pipelines\./);
  assert.match(text,/项目经历\t数据平台开发/);
  assert.equal(text.match(/Candidate contact/g).length,1);assert.equal(text.match(/Fixture footer/g).length,1);
});
test('legacy binary Word uses its real document structure',async()=>{
  const {text}=await extractDocument('legacy.doc',await fixture('legacy.doc'));
  assert.match(text,/This is a test of reviewing/);assert.match(text,/😀 ∀/);
});
test('PDF extracts Chinese through local CMaps and preserves multiple pages',async()=>{
  const result=await extractDocument('experience.pdf',await fixture('experience.pdf'));
  assert.equal(result.pages,2);assert.deepEqual(result.emptyPages,[]);
  assert.match(result.text,/教育经历：西安大学，计算机科学/);
  assert.match(result.text,/Python and SQL pipelines/);assert.match(result.text,/项目经历：数据平台开发/);
  assert.deepEqual((await extractDocument('mixed.pdf',await fixture('mixed.pdf'))).emptyPages,[3]);
});
test('image-only and encrypted PDFs produce actionable errors',async()=>{
  await assert.rejects(()=>fixture('image-only.pdf').then(b=>extractDocument('scan.pdf',b)),/OCR/);
  await assert.rejects(()=>fixture('encrypted.pdf').then(b=>extractDocument('locked.pdf',b)),/已加密/);
});
test('plain text supports UTF-8, UTF-16 BOM and Chinese GB18030 without binary gibberish',async()=>{
  for(const buffer of [Buffer.from('中文经历'),Buffer.concat([Buffer.from([255,254]),Buffer.from('中文经历','utf16le')]),Buffer.from('d6d0cec4beadc0fa','hex')]){
    assert.equal((await extractDocument('notes.txt',buffer)).text,'中文经历');
  }
  assert.equal((await extractDocument('notes.md',Buffer.from('# Projects\n\nBuilt SQL pipelines'))).text,'# Projects\n\nBuilt SQL pipelines');
  await assert.rejects(()=>extractDocument('notes.txt',Buffer.from([0,1,2])),/不是可读取的纯文本/);
  await assert.rejects(()=>fixture('experience.docx').then(b=>extractDocument('notes.txt',b)),/扩展名不符/);
});
test('invalid, unsupported, empty and oversized files never yield a partial success',async()=>{
  await assert.rejects(()=>extractDocument('file.exe',Buffer.from('hello')),/请选择 Word/);
  await assert.rejects(()=>extractDocument('file.txt',Buffer.alloc(0)),/文件为空/);
  await assert.rejects(()=>extractDocument('file.txt',Buffer.alloc(MAX_IMPORT_BYTES+1)),/10 MB/);
  await assert.rejects(()=>extractDocument('file.txt',Buffer.from('a'.repeat(100001))),/100,000/);
  await assert.rejects(()=>extractDocument('file.pdf',Buffer.from('Not a PDF')),/有效的 PDF/);
  await assert.rejects(()=>extractDocument('file.docx',Buffer.from('PK\x03\x04broken file')),/无法读取/);
});
test('upload endpoint authenticates, enforces limits and returns a preview without modifying any profile',async()=>{
  const store=new Store(':memory:'),server=createServer({store});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  try{
    const before=await(await fetch(base+'/api/state')).json();
    const upload=(filename,body,headers={})=>fetch(base+'/api/profiles/import-document?filename='+encodeURIComponent(filename),{
      method:'POST',body,headers:{'Content-Type':'application/octet-stream','X-FMJ-Token':before.token,...headers},
    });
    assert.equal((await upload('test.txt','hello',{'X-FMJ-Token':''})).status,403);
    assert.equal((await upload('test.txt','hello',{Origin:'https://evil.example'})).status,403);
    assert.equal((await upload('test.txt','hello',{'Content-Type':'application/json'})).status,415);
    assert.equal((await upload('test.txt',Buffer.alloc(MAX_IMPORT_BYTES+1))).status,413);
    const response=await upload('经历.pdf',await fixture('experience.pdf'));
    assert.equal(response.status,200);assert.match((await response.json()).text,/西安大学/);
    assert.deepEqual((await(await fetch(base+'/api/state')).json()).profiles,before.profiles);
    assert.equal((await fetch(base+'/profile-import.js')).status,200);
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
