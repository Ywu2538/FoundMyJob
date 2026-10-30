import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as core from '../dist/core.js';
import * as catalog from '../dist/company-catalog.js';
import * as preferences from '../dist/job-preferences.js';
import {profileTrackFields} from '../dist/profile-track.js';
import {t as tr,getLocale,setLocale,localizedLabel} from '../dist/i18n.js';
import {manualJob} from '../server/jobs.mjs';
import {COMPANY_LOGOS} from '../dist/company-logos.js';
import {Store} from '../server/db.mjs';
import {cursorSettingsHtml} from '../dist/cursor-settings.js';

function fixture() {
  const store=new Store(':memory:');
  try {
    const snapshot=store.snapshot();
    return {...snapshot,providers:[],capabilities:{},profiles:['domestic','overseas','all'].map(searchScope=>({...snapshot.profiles[0],id:searchScope,label:searchScope,searchScope}))};
  } finally {store.close();}
}
const flatten=groups=>groups.flatMap(group=>group.companies);

test('domestic, overseas and global directories follow the profile and retain actual source metadata',()=>{
  const {sources}=fixture(),original=structuredClone(sources);
  const domestic=flatten(core.companyDiscoveryGroups(sources,{searchScope:'domestic'}));
  const overseas=flatten(core.companyDiscoveryGroups(sources,{searchScope:'overseas'}));
  const global=flatten(core.companyDiscoveryGroups(sources,{searchScope:'all'}));
  assert.equal(domestic.length,36);
  assert.ok(domestic.every(company=>company.directoryScope==='domestic'&&company.sourceId));
  assert.equal(overseas.length,129);
  assert.equal(global.length,165);
  assert.equal(new Set(global.map(company=>company.company)).size,165);
  assert.deepEqual(global,[...domestic,...overseas]);
  assert.equal(overseas.find(company=>company.company==='Figma').sourceId,'greenhouse:figma');
  assert.equal(overseas.find(company=>company.slug==='google').sourceId,null);
  for(const company of global)assert.equal(new URL(company.careersUrl).protocol,'https:');
  assert.deepEqual(sources,original);
  assert.deepEqual(flatten(core.companyDiscoveryGroups(sources,{market:'cn'})),domestic);
  assert.deepEqual(flatten(core.companyDiscoveryGroups(sources,{market:'ca'})),overseas);
  assert.deepEqual(flatten(core.companyDiscoveryGroups(sources,{})),global);
});

test('legacy featured sources, added overseas sources and duplicate company entries have one directory destination',()=>{
  const sources=fixture().sources.map(({directoryScope,...source})=>source);
  sources.push({id:'lever:google',slug:'google',provider:'lever',company:'Google',careersUrl:'https://jobs.lever.co/google',status:'已同步',syncedAt:'2026-10-16',count:2});
  sources.push({id:'greenhouse:extra',slug:'extra',company:'Extra',featured:true,directoryScope:'overseas',careersUrl:'https://example.com/careers'});
  sources.push({...sources.find(source=>source.company==='美团'),id:'official:duplicate'});
  const groups=core.companyDiscoveryGroups(sources,{searchScope:'all'});
  assert.equal(groups[0].companies.length,36);
  assert.equal(groups[1].companies.length,130);
  const google=groups[1].companies.find(company=>company.slug==='google');
  assert.equal(google.sourceId,'lever:google');
  assert.equal(google.careersUrl,'https://jobs.lever.co/google');
  assert.equal(google.status,'已同步');
  assert.equal(google.count,2);
  assert.equal(flatten(core.companyDiscoveryGroups([],{searchScope:'overseas'})).every(company=>!company.sourceId),true);
});

// Exercise the real rendering and profile-change handler without a browser dependency.
function appHarness(snapshot) {
  const handlers={};
  const context=vm.createContext({...core,...catalog,...preferences,profileTrackFields,cursorSettingsHtml,tr,getLocale,setLocale,localizedLabel,e:core.escapeHtml,COMPANY_LOGOS,
    document:{addEventListener:(name,handler)=>{handlers[name]=handler;},querySelector:()=>null,querySelectorAll:()=>[]},
    window:{addEventListener(){}},location:{hash:'#jobs'},FormData:class{constructor(form){return form.fields;}},
    sessionStorage:{getItem:()=>null,setItem(){}},snapshot,
  });
  const app=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace(/\bboot\(\);\s*$/,'');
  vm.runInContext(app,context);
  vm.runInContext('render=()=>{globalThis.html=companyDirectory();}; accept(snapshot); ui.companiesOpen=true; render();',context);
  return {
    html:()=>context.html,
    run:code=>vm.runInContext(code,context),
    switchProfile:id=>handlers.change({target:{value:id,dataset:{profileSelect:'search'},closest:()=>null}}),
    change:(id,value)=>handlers.change({target:{id,value,dataset:{},closest:()=>null}}),
    submit:fields=>handlers.submit({preventDefault(){},target:{id:'job-search',fields,querySelector:()=>null}}),
  };
}

test('job-library searches filter existing jobs without starting a network sync, including overseas profiles',async()=>{
 const app=appHarness(fixture());await app.switchProfile('overseas');
 app.run("globalThis.networkSearches=0; searchOfficialJobs=async()=>{networkSearches++;};");
 await app.submit([['query','Data Engineer'],['region','ca'],['city','Toronto'],['work','现场办公']]);
 assert.equal(app.run('networkSearches'),0);assert.equal(app.run('ui.query'),'Data Engineer');assert.equal(app.run('ui.region'),'ca');
});
function assertMatchingLinks(html,expectedCount) {
  const chips=[...html.matchAll(/class="company-chip [^"]*" data-action="company-filter" data-company="([^"]+)"/g)].map(match=>match[1]);
  const footer=html.slice(html.indexOf('<section class="domestic-discovery"'));
  const links=[...footer.matchAll(/<a class="button secondary" href="([^"]+)"[^>]*>([^<]+?) (?:<small>[^<]+<\/small>)?<svg/g)];
  assert.equal(chips.length,expectedCount);
  assert.deepEqual(links.map(match=>match[2]),chips);
  return new Map(links.map(match=>[match[2],match[1]]));
}

test('switching profiles updates the heading, cards and website links together and clears the old company filter',async()=>{
  const app=appHarness(fixture());
  assert.match(app.html(),/国内热门公司/);
  assertMatchingLinks(app.html(),36);
  app.run("actions['company-filter']({dataset:{company:'美团'}})");
  assert.match(app.html(),/已选 美团/);
  await app.switchProfile('overseas');
  assert.match(app.html(),/国外热门公司/);
  assert.doesNotMatch(app.html(),/美团|国内招聘官网/);
  assert.equal(app.run('ui.company'),'');
  assert.equal(app.run('ui.limit'),25);
  assert.equal(app.run('ui.companiesOpen'),true);
  const links=assertMatchingLinks(app.html(),129);
  app.run("actions['company-filter']({dataset:{company:'Google / Alphabet'}})");
  assert.match(app.html(),/官网查看/);
  assert.doesNotMatch(app.html(),/同步这家公司|data-id="undefined"/);
  assert.ok(app.html().includes(`href="${links.get('Google / Alphabet')}"`));
  app.run("actions['company-filter']({dataset:{company:'Figma'}})");
  assert.match(app.html(),/data-id="greenhouse:figma"/);
  await app.switchProfile('all');
  assert.match(app.html(),/全球热门公司/);
  assert.match(app.html(),/国内招聘官网/);
  assert.match(app.html(),/国外招聘官网/);
  assertMatchingLinks(app.html(),165);
  await app.switchProfile('domestic');
  assertMatchingLinks(app.html(),36);
  assert.doesNotMatch(app.html(),/Google|Figma|国外招聘官网/);
});

test('counts include only active stored jobs and refreshing an edited scope clears hidden selections',async()=>{
  const snapshot=fixture();
  snapshot.jobs=[{company:'Figma',location:'Toronto',active:true},{company:'Figma',location:'Toronto',active:false},{company:'美团',location:'Shanghai',active:true}];
  const app=appHarness(snapshot);
  await app.switchProfile('overseas');
  assert.match(app.html(),/1 家已有岗位/);
  assert.match(app.html(),/<strong>Figma<\/strong><span>1 条岗位/);
  app.run("actions['company-filter']({dataset:{company:'Figma'}})");
  app.run("snapshot.profiles=snapshot.profiles.map(profile=>profile.id==='overseas'?{...profile,searchScope:'domestic'}:profile); accept(snapshot); render();");
  assert.equal(app.run('ui.company'),'');
  assert.match(app.html(),/国内热门公司/);
  assertMatchingLinks(app.html(),36);
  assert.doesNotMatch(app.html(),/Figma/);
});

test('collections contain six Global 500 picks per sector and five financial picks of each kind per country',()=>{
  const {OVERSEAS_COMPANIES:companies,COUNTRIES,INDUSTRIES,inCollection}=catalog;
  assert.equal(companies.length,129);
  assert.equal(new Set(companies.map(c=>c.slug)).size,129);
  assert.equal(Object.keys(INDUSTRIES).length,10);
  for(const category of Object.keys(INDUSTRIES))assert.equal(companies.filter(c=>inCollection(c,{category})).length,6,category);
  for(const country of Object.keys(COUNTRIES))for(const category of ['investment','bank'])assert.equal(companies.filter(c=>inCollection(c,{country,category})).length,5,`${country}/${category}`);
  assert.equal(companies.filter(c=>c.slug==='hsbc').length,1);
});

test('seven countries filter real job locations and manual imports preserve the exact country',()=>{
  const locations={ca:'Toronto, Canada',us:'New York, United States',jp:'Tokyo, Japan',gb:'London, United Kingdom',fr:'Paris, France',au:'Sydney, Australia',sg:'Singapore'};
  for(const [country,location] of Object.entries(locations)){
    const job={location,region:'other'};
    for(const other of Object.keys(locations))assert.equal(core.jobInRegion(job,other),country===other,`${location}/${other}`);
    assert.ok(core.jobInRegion(job,'overseas'));
    const imported=manualJob({company:'Example',title:'Data Engineer',description:'SQL',url:'https://example.com/job',location:'Office',region:country,track:'unknown'});
    assert.equal(imported.market,country);
    assert.ok(core.jobInRegion(imported,country));
  }
  assert.equal(core.jobInRegion({location:'London, Ontario, Canada'},'gb'),false);
  assert.equal(core.jobInRegion({location:'Paris, Texas, United States'},'fr'),false);
  for(const country of Object.keys(locations))assert.equal(core.jobInRegion({location:'Remote',region:'other'},country),false);
});

test('country, sector and company aliases compose with active, saved and source filters',()=>{
  const {sources,profiles}=fixture(),profile=profiles[1];
  const rows=[['google-ca','Google','Toronto, Canada'],['alphabet-ca','Alphabet','Montreal, Canada'],['google-cn','Google','Beijing, China'],['rbc-ca','Royal Bank of Canada','Toronto, Canada'],['rbc-us','RBC','New York, USA'],['other-ca','Unlisted Company','Toronto, Canada']].map(([id,company,location])=>({id,company,location,active:true,title:'Data Engineer',tags:['SQL'],track:'unknown',sourceKind:'synced'}));
  const results=filters=>core.discoverySummary(rows,profile,core.directoryJobFilters(sources,profile,filters)).results.map(j=>j.id);
  assert.deepEqual(results({companyCountry:'ca',companyCategory:'technology'}),['google-ca','alphabet-ca']);
  assert.deepEqual(results({company:'Google / Alphabet',region:'ca'}),['google-ca','alphabet-ca']);
  assert.deepEqual(results({companyCountry:'ca',companyCategory:'bank'}),['rbc-ca']);
  assert.deepEqual(results({companyCountry:'ca',companyCategory:'bank',sourceKind:'manual'}),[]);
  rows[0].active=false;
  assert.deepEqual(results({companyCountry:'ca',companyCategory:'technology'}),['alphabet-ca']);
  assert.deepEqual(results({companyCountry:'ca',companyCategory:'technology',savedOnly:true,saved:['google-ca']}),['google-ca']);
});

test('country changes update cards, job counts and career links together; profile switching clears filters',async()=>{
  const snapshot=fixture();
  snapshot.jobs=[{company:'Google',location:'Toronto, Canada',active:true},{company:'Alphabet',location:'Tokyo, Japan',active:true},{company:'Google',location:'Toronto, Canada',active:false}];
  const app=appHarness(snapshot);
  await app.switchProfile('overseas');
  await app.change('company-country','ca');
  assert.equal(app.run('ui.region'),'ca');
  assertMatchingLinks(app.html(),73);
  assert.match(app.html(),/<strong>Google \/ Alphabet<\/strong><span>1 条岗位/);
  assert.match(app.html(),/location=Canada/);
  assert.match(app.html(),/country=CAN&amp;loc_query=Canada/);
  await app.change('company-category','bank');
  assertMatchingLinks(app.html(),5);
  assert.match(app.html(),/RBC/);
  assert.doesNotMatch(app.html(),/JPMorgan Chase/);
  app.run("actions['company-filter']({dataset:{company:'RBC'}})");
  await app.change('company-country','jp');
  assert.equal(app.run('ui.company'),'');
  assertMatchingLinks(app.html(),5);
  assert.match(app.html(),/MUFG/);
  await app.switchProfile('domestic');
  assertMatchingLinks(app.html(),36);
  for(const key of ['companyCountry','companyCategory','company'])assert.equal(app.run(`ui.${key}`),'');
  assert.equal(app.run('ui.region'),'cn');
});

test('English interface preserves profile, resume language and user content while translating all primary pages',async()=>{
  const snapshot=fixture();
  snapshot.profiles.forEach(p=>{p.label='我的真实画像';p.experience='我开发了数据管道';p.resumeLanguage='zh';});
  const original=JSON.stringify(snapshot.profiles);
  const app=appHarness(snapshot);
  await app.switchProfile('overseas');
  await app.change('ui-language','en');
  try{
    assert.equal(getLocale(),'en');
    assert.match(app.html(),/Featured overseas companies/);
    assert.match(app.html(),/Job country/);
    assert.doesNotMatch(app.html(),/国外热门公司|岗位所在国家|官网查看/);
    assert.equal(JSON.stringify(snapshot.profiles),original);
    for(const page of ['dashboardPage','jobsPage','profilePage','resumesPage','trackerPage','creditsPage','settingsPage']){
      const html=app.run(`${page}()`);
      // Only authored UI is translated; these strings are intentionally retained.
      const visible=html.replace(/<[^>]*>/g,'').replaceAll('我的真实画像','').replaceAll('我开发了数据管道','').replaceAll('美团','');
      if(page==='profilePage')assert.match(html,/我开发了数据管道/);
      assert.doesNotMatch(visible,/工作台|发现岗位|求职画像|生成设置|没有生成任务|招聘地点范围/);
    }
  }finally{setLocale('zh');}
});

test('switching interface language retains unsaved controls without marking an untouched profile dirty',async()=>{
  const app=appHarness(fixture());
  app.run(`globalThis.fields=[{id:'api-key',name:'',type:'password',value:'test-only-input'},{id:'',name:'model',type:'select-one',value:'chosen-model'},{id:'free-models',name:'',type:'checkbox',value:'on',checked:true}];
    document.querySelectorAll=()=>globalThis.fields;
    render=()=>{globalThis.fields=globalThis.fields.map(field=>({...field,value:'',checked:false}));globalThis.html=companyDirectory();};`);
  await app.change('ui-language','en');
  try{
    assert.equal(app.run('fields[0].value'),'test-only-input');
    assert.equal(app.run('fields[1].value'),'chosen-model');
    assert.equal(app.run('fields[2].checked'),true);
    assert.equal(app.run('Object.keys(ui.drafts).length'),0);
  }finally{setLocale('zh');}
});

test('profile selection, same-country preference saves, explicit clear and restore synchronize discovery',async()=>{
 const snapshot=fixture();
 snapshot.profiles[1]={...snapshot.profiles[1],jobPreferences:null,preferences:'Toronto，onsite',target:'Data Engineer',skills:['SQL','Python']};
 const app=appHarness(snapshot);
 await app.switchProfile('overseas');
 assert.equal(app.run('ui.region'),'ca');assert.equal(app.run('ui.city'),'Toronto');assert.equal(app.run('ui.work'),'现场办公');assert.equal(app.run('ui.companyCountry'),'ca');
 assert.match(app.run('profileSelector()'),/加拿大 · 多伦多 · 现场办公/);
 app.run("ui.query='old';ui.company='Figma'; snapshot.profiles=snapshot.profiles.map(p=>p.id==='overseas'?{...p,jobPreferences:{country:'ca',city:'Vancouver',work:'hybrid'}}:p);accept(snapshot);");
 assert.equal(app.run('ui.city'),'Vancouver');assert.equal(app.run('ui.work'),'混合办公');assert.equal(app.run('ui.query'),'');assert.equal(app.run('ui.company'),'');
 app.run("actions['clear-filters']();accept(snapshot);");
 assert.equal(app.run('ui.region'),'');assert.equal(app.run('ui.city'),'');assert.equal(app.run('ui.work'),'');
 app.run("actions['profile-filters']();");assert.equal(app.run('ui.city'),'Vancouver');
 await app.change('company-country','us');
 assert.equal(app.run('ui.region'),'us');assert.equal(app.run('ui.city'),'');
 app.run("applyJobSearch({region:'ca',city:'New York',work:'现场办公'});");
 assert.equal(app.run('ui.city'),'');assert.equal(app.run('ui.companyCountry'),'ca');
 await app.change('company-country','');assert.equal(app.run('ui.region'),'overseas');
});

test('featured section renders ten relevant details and an honest empty state in Chinese and English',async()=>{
 const snapshot=fixture();
 snapshot.profiles[1]={...snapshot.profiles[1],jobPreferences:null,preferences:'Toronto，onsite',target:'Data Engineer',skills:['SQL']};
 snapshot.jobs=Array.from({length:12},(_,i)=>({id:`related-${i}`,title:'Data Engineer',company:'Figma',location:'Toronto',work:'现场办公',tags:['SQL'],active:true}));
 snapshot.jobs.push({id:'wrong-role',title:'Office Manager',company:'Figma',location:'Toronto',work:'现场办公',tags:[],active:true},
 {id:'wrong-city',title:'Data Engineer',company:'Figma',location:'Vancouver',work:'现场办公',tags:['SQL'],active:true});
 const app=appHarness(snapshot);await app.switchProfile('overseas');
 for(const language of ['zh','en']){
  await app.change('ui-language',language);
  const featured=app.html().match(/<section class="featured-jobs"[\s\S]*?<\/section>/)[0];
  assert.equal([...featured.matchAll(/class="featured-job" data-action="job-detail"/g)].length,10);
  assert.doesNotMatch(featured,/wrong-role|wrong-city/);
  assert.match(featured,language==='en'?/Matched 12 jobs; showing 10/:/匹配到 12 个岗位，展示 10/);
  const form=app.run('profilePage()');
  assert.match(form,/<option value="ca" selected>/);assert.match(form,/<option value="Toronto" selected>/);assert.match(form,/<option value="onsite" selected>/);
  assert.match(form,language==='en'?/Preferred country/:/期望国家/);
 }
 app.run("actions['company-filter']({dataset:{company:'Apple'}})");
 assert.match(app.html(),/No stored jobs match every current filter/);
 assert.match(app.html(),/Job feed not connected/);
 await app.change('ui-language','zh');assert.match(app.html(),/已收录岗位未匹配当前全部条件/);
});

test('Chinese and English search words show the same bank roles in both interfaces',async()=>{
 const snapshot=fixture();
 snapshot.profiles[1]={...snapshot.profiles[1],target:'Data Engineer',skills:['SQL'],jobPreferences:{country:'ca',city:'Toronto',work:'onsite'}};
 snapshot.jobs=[{id:'bmo-data',title:'Data Engineer',company:'BMO',location:'Toronto, Canada',work:'未注明',tags:['SQL'],active:true},
  {id:'bmo-hybrid',title:'Senior Data Engineer',company:'BMO',location:'Toronto, Canada',work:'混合办公',tags:['SQL'],active:true},
  {id:'wrong-city',title:'Data Engineer',company:'BMO',location:'Vancouver, Canada',work:'未注明',tags:['SQL'],active:true}];
 const app=appHarness(snapshot);await app.switchProfile('overseas');
 app.run("actions['company-filter']({dataset:{company:'BMO'}})");
 try{
  for(const language of ['zh','en'])for(const query of ['数据工程师','Data Engineer']){
   await app.change('ui-language',language);
   app.run(`applyJobSearch({query:${JSON.stringify(query)}});render();`);
   const featured=app.html().match(/<section class="featured-jobs"[\s\S]*?<\/section>/)[0];
   assert.match(featured,/data-id="bmo-data"/);assert.match(featured,/data-id="bmo-hybrid"/);
   assert.doesNotMatch(featured,/wrong-city/);
   assert.match(featured,language==='en'?/Work arrangement not specified/:/办公方式待核实/);
   assert.match(featured,language==='en'?/Work arrangement differs from preference/:/办公方式与偏好不同/);
   const ids=app.run('filterJobs(JOBS,state.profile,ui).map(job=>job.id).join()');
   assert.equal(ids,'bmo-data');
  }
 }finally{setLocale('zh');}
});
