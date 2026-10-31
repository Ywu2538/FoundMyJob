import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Store} from '../server/db.mjs';
import {createServer} from '../server/index.mjs';

test('fonts are bundled, so the page never depends on Google Fonts',async()=>{
 const css=await readFile(new URL('../dist/styles.css',import.meta.url),'utf8');
 assert.doesNotMatch(css,/fonts\.(googleapis|gstatic)\.com/);
 const server=createServer({store:new Store(':memory:')});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 try{
  for(const file of ['dm-sans-latin-wght-normal.woff2','dm-sans-latin-ext-wght-normal.woff2']){
   const font=await fetch(`${base}/fonts/${file}`);
   assert.equal(font.status,200,file);
   assert.equal(font.headers.get('content-type'),'font/woff2');
  }
  const page=await fetch(base);
  assert.doesNotMatch(page.headers.get('content-security-policy'),/googleapis|gstatic/);
  assert.match(page.headers.get('content-security-policy'),/font-src 'self'/);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
