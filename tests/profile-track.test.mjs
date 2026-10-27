import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import * as core from '../dist/core.js';
import {profileFocusField,profileTrackFields} from '../dist/profile-track.js';
const {profileCompletion}=core;

test('profile guidance follows the hiring track in Chinese and English',()=>{
  const campus=profileTrackFields('campus');
  const experienced=profileTrackFields('experienced');
  assert.match(campus.guide,/没有工作经历可留空/);
  assert.match(campus.experience[0],/选填/);
  assert.match(campus.projects[0],/校园与课程项目/);
  assert.match(experienced.guide,/优先填写相关工作经历/);
  assert.match(experienced.projects[0],/选填.*校园项目/);
  assert.equal(profileFocusField('campus'),'projects');
  assert.equal(profileFocusField('experienced'),'experience');
  assert.match(profileTrackFields('campus',(_zh,en)=>en).experience[0],/optional/);
  assert.match(profileTrackFields('experienced',(_zh,en)=>en).projects[0],/optional/);
});

test('completion does not penalize the track-specific optional section',()=>{
  const common={name:'Candidate',email:'candidate@example.com',location:'Toronto',target:'Analyst',education:'University',preferences:'Toronto',skills:['SQL']};
  assert.equal(profileCompletion({...common,track:'campus',experience:'',projects:'Course project'}),100);
  assert.equal(profileCompletion({...common,track:'experienced',experience:'Full-time role',projects:''}),100);
  assert.ok(profileCompletion({...common,track:'campus',experience:'Internship',projects:''})<100);
  assert.ok(profileCompletion({...common,track:'experienced',experience:'',projects:'Course project'})<100);
});

test('switching Profile track updates guidance without discarding unsaved experience',async()=>{
  const profile={id:'candidate',revision:1,label:'Candidate',name:'Candidate',email:'candidate@example.com',location:'Toronto',phone:'',target:'Analyst',education:'University',experience:'Real internship',projects:'Real course project',preferences:'',skills:['SQL'],track:'campus',market:'',searchScope:'all',resumeLanguage:'zh',archived:false};
  const handlers={};
  const context=vm.createContext({...core,e:core.escapeHtml,profileTrackFields,tr:zh=>zh,localizedLabel:pair=>pair?.[0]||'',JOB_COUNTRIES:{},WORK_PREFERENCES:{},resolvedJobPreferences:()=>({country:'',city:'',work:''}),cityOptions:()=>[],cityEntry:()=>null,COMPANY_LOGOS:{},
    document:{addEventListener:(name,fn)=>{handlers[name]=fn;},querySelector:()=>null,querySelectorAll:()=>[]},
    window:{addEventListener(){}},location:{hash:'#profile'},sessionStorage:{getItem:()=>null,setItem(){}},
    FormData:class{constructor(form){this.fields=form.fields;}*[Symbol.iterator](){yield* Object.entries(this.fields);}},
    profile,
  });
  const source=readFileSync(process.env.FMJ_PROFILE_APP_SOURCE||new URL('../dist/app.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace(/\bboot\(\);\s*$/,'');
  vm.runInContext(source,context);
  vm.runInContext("state={profile,profiles:[profile],settings:{language:'zh'}};ui.profileId=profile.id;render=()=>{globalThis.lastHtml=profilePage();};render();",context);
  assert.match(context.lastHtml,/实习与工作经历（选填）/);
  assert.match(context.lastHtml,/Real internship/);
  const form={dataset:{id:profile.id,revision:'1'},fields:{...profile,skills:'SQL',track:'experienced',preferenceCountry:'',preferenceCity:'',preferenceCityCustom:'',preferenceWork:''},querySelector:()=>({textContent:''})};
  context.document.querySelector=selector=>selector==='#profile-form'?form:null;
  const target={name:'track',value:'experienced',dataset:{},closest:selector=>selector==='#profile-form'?form:null};
  await handlers.change({target});
  assert.match(context.lastHtml,/工作经历（重点）/);
  assert.match(context.lastHtml,/项目经历（选填，含校园项目）/);
  assert.match(context.lastHtml,/Real internship/);
  assert.match(context.lastHtml,/Real course project/);
  assert.equal(vm.runInContext('ui.drafts.candidate.track',context),'experienced');
});
