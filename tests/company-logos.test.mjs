import test from 'node:test';
import assert from 'node:assert/strict';
import {COMPANY_LOGOS} from '../dist/company-logos.js';
import {COMPANY_SOURCES} from '../server/company-sources.mjs';
import {Store} from '../server/db.mjs';
import {createServer} from '../server/index.mjs';
test('every featured company logo is served locally with an image MIME type while arbitrary files stay private',async()=>{
 const store=new Store(':memory:'),server=createServer({store});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 try{
  for(const source of COMPANY_SOURCES)assert.ok(COMPANY_LOGOS[source.slug]);
  for(const asset of Object.values(COMPANY_LOGOS)){const r=await fetch(base+asset);assert.equal(r.status,200,asset);assert.match(r.headers.get('content-type'),/^image\//,asset);assert.ok((await r.arrayBuffer()).byteLength>0,asset);}
  assert.equal((await fetch(base+'/company-logos.js')).status,200);assert.equal((await fetch(base+'/company-logos/unknown.svg')).status,404);assert.equal((await fetch(base+'/.runtime/foundmyjob.sqlite')).status,404);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
