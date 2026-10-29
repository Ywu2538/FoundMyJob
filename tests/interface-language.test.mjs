import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createServer} from '../server/index.mjs';
import {Store} from '../server/db.mjs';
import {companyCareersLink,OVERSEAS_COMPANIES} from '../dist/company-catalog.js';

test('interface locale survives module reload and storage failures, independently of resume language',()=>{
  const data=new Map(),localStorage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};
  const source=readFileSync(new URL('../dist/i18n.js',import.meta.url),'utf8').replace(/^export /gm,'');
  const context=()=>{const c=vm.createContext({localStorage});vm.runInContext(source,c);return c;};
  let c=context();
  assert.equal(vm.runInContext('getLocale()',c),'zh');
  vm.runInContext("setLocale('en')",c);
  c=context();
  assert.equal(vm.runInContext("t('工作台')",c),'Dashboard');
  assert.equal(vm.runInContext("t('用户填写的真实经历')",c),'用户填写的真实经历');
  assert.deepEqual([...data.keys()],['foundmyjob:ui-language']);
  localStorage.getItem=localStorage.setItem=()=>{throw Error('Storage disabled');};
  c=context();
  assert.equal(vm.runInContext("setLocale('en');t('求职画像')",c),'Profiles');
  assert.equal(vm.runInContext("setLocale('invalid');getLocale()",c),'zh');
});

test('country links use the official country formats and unsupported sites retain their official destination',()=>{
  const company=slug=>OVERSEAS_COMPANIES.find(c=>c.slug===slug);
  for(const [country,code] of Object.entries({ca:'CAN',us:'USA',jp:'JPN',gb:'GBR',fr:'FRA',au:'AUS',sg:'SGP'})){
    const link=companyCareersLink(company('amazon'),country);
    assert.equal(new URL(link.url).searchParams.get('country'),code);
    assert.equal(link.countryFiltered,true);
  }
  assert.equal(new URL(companyCareersLink(company('google'),'gb').url).searchParams.get('location'),'United Kingdom');
  assert.deepEqual(companyCareersLink(company('rbc'),'ca'),{url:company('rbc').careersUrl,countryFiltered:false});
});

test('the backend serves new browser modules with JavaScript MIME types',async()=>{
  const server=createServer({store:new Store(':memory:')});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const base=`http://127.0.0.1:${server.address().port}`;
    for(const name of ['company-catalog.js','i18n.js','job-preferences.js','sync-progress.js']){
      const response=await fetch(`${base}/${name}`);
      assert.equal(response.status,200);
      assert.match(response.headers.get('content-type'),/javascript/);
      assert.match(await response.text(),/export /);
    }
  }finally{await new Promise(resolve=>server.close(resolve));}
});
