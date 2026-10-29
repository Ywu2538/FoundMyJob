import test from 'node:test';
import assert from 'node:assert/strict';
import {resolvedJobPreferences,jobInCity,jobInWork} from '../dist/job-preferences.js';
import {profileJobFilters,discoverySummary,companyJobMatches,companyJobRecommendations,profileCompletion} from '../dist/core.js';
import {normalizeJob} from '../server/jobs.mjs';

const profile={target:'Data Engineer',skills:['Python','SQL'],track:'experienced',preferences:'Toronto，onsite',searchScope:'overseas'};
const base={id:'toronto',title:'Senior Data Engineer',company:'Figma',location:'Toronto, Canada',work:'现场办公',tags:['SQL'],track:'experienced',active:true};

test('legacy Chinese and English preferences migrate without overwriting notes or structured choices',()=>{
 for(const text of ['Toronto，onsite','多伦多，现场办公','Canada, Toronto, on-site']){
  const p={preferences:text};assert.deepEqual(resolvedJobPreferences(p),{country:'ca',city:'Toronto',work:'onsite'});assert.equal(p.preferences,text);
 }
 assert.deepEqual(resolvedJobPreferences({preferences:'London, Ontario, hybrid'}),{country:'ca',city:'London, Ontario',work:'hybrid'});
 assert.deepEqual(resolvedJobPreferences({preferences:'Toronto or Vancouver, remote'}),{country:'ca',city:'',work:'remote'});
 assert.deepEqual(resolvedJobPreferences({...profile,jobPreferences:{country:'',city:'',work:''}}),{country:'',city:'',work:''});
 assert.equal(resolvedJobPreferences({preferences:'希望在西安，全职工作'}).city,'Xi’an');
});

test('profile filters retain geography and explicitly allow unspecified arrangements without inventing an arrangement',()=>{
 const jobs=[base,{...base,id:'china',location:'Shanghai, China'},{...base,id:'vancouver',location:'Vancouver, Canada'},{...base,id:'remote',work:'远程办公'},{...base,id:'unknown',work:'未注明'},{...base,id:'closed',active:false}];
 const filters=profileJobFilters(profile);
 assert.equal(filters.region,'ca');assert.equal(filters.companyCountry,'ca');assert.equal(filters.city,'Toronto');assert.equal(filters.work,'现场办公');
 assert.deepEqual(discoverySummary(jobs,profile,filters).results.map(j=>j.id),['toronto','unknown']);
 assert.deepEqual(discoverySummary(jobs,profile,{...filters,workUnknown:false}).results.map(j=>j.id),['toronto']);
 assert.equal(profileJobFilters({searchScope:'domestic'}).region,'cn');
 assert.equal(profileJobFilters({searchScope:'overseas'}).region,'overseas');
 assert.equal(profileJobFilters({searchScope:'all'}).region,'');
 assert.equal(jobInCity({location:'North York, Canada'},'Toronto','ca'),true);
 assert.equal(jobInCity({location:'Toronto Street, London'},'Toronto','ca'),true); // Country is checked separately.
 assert.equal(jobInWork({work:'on-site'},'现场办公'),true);
 assert.equal(jobInWork({work:'未注明'},'onsite'),false);
 const complete={name:'A',email:'a@example.com',location:'A',target:'A',education:'A',experience:'A',projects:'A',skills:['SQL'],jobPreferences:{country:'ca',city:'Toronto',work:'onsite'}};
 assert.equal(profileCompletion(complete),100);
});

test('related alternatives retain company and geography, label differing arrangements and share the ten-job limit',()=>{
 const jobs=Array.from({length:12},(_,i)=>({...base,id:`hybrid-${i}`,work:'混合办公'}));
 jobs.push({...base,id:'exact'},{...base,id:'unknown',work:'未注明'},{...base,id:'wrong-country',location:'Beijing'},{...base,id:'other',company:'Other'});
 const result=companyJobRecommendations(jobs,profile,[{company:'Figma'}],profileJobFilters(profile));
 assert.deepEqual(result.jobs.map(j=>j.id),['exact','unknown']);assert.equal(result.alternativeTotal,12);assert.equal(result.alternatives.length,8);
 assert.ok(result.alternatives.every(j=>j.id.startsWith('hybrid-')));assert.equal(result.jobs.length+result.alternatives.length,10);
});

test('featured matches show at most ten real active jobs with a target title or shared skills',()=>{
 const rows=Array.from({length:12},(_,i)=>({...base,id:`matching-${i}`}));
 rows.push({...base,id:'skills',title:'Analytics Platform Developer',tags:['SQL','Python']},
  {...base,id:'irrelevant',title:'Office Manager',tags:['SQL']},
  {...base,id:'closed',active:false}, {...base,id:'domestic',location:'Beijing, China'},
  {...base,id:'hybrid',work:'混合办公'}, {...base,id:'other-company',company:'Unlisted'});
 const result=companyJobMatches(rows,profile,[{company:'Figma'}],profileJobFilters(profile));
 assert.equal(result.total,13);assert.equal(result.jobs.length,10);
 assert.ok(result.matches.some(job=>job.id==='skills'));
 assert.ok(result.matches.every(job=>job.id.startsWith('matching-')||job.id==='skills'));
 assert.equal(companyJobMatches(rows,{...profile,target:'律师',skills:[]},[{company:'Figma'}],profileJobFilters(profile)).total,0);
 assert.equal(companyJobMatches(rows,{...profile,target:'',skills:[]},[{company:'Figma'}],{}).total,0);
 assert.equal(companyJobMatches([{...base,company:'Google'}],profile,[{company:'Google / Alphabet',aliases:['Google']}],profileJobFilters(profile)).total,1);
});

test('job normalization preserves explicit on-site arrangements and never infers them from a city',()=>{
 const raw={id:1,title:'Data Engineer',location:'Toronto',absolute_url:'https://example.com/jobs/1'},source={id:'lever:example',provider:'lever',slug:'example',company:'Example'};
 assert.equal(normalizeJob({...raw,workplaceType:'on-site'},source).work,'现场办公');
 assert.equal(normalizeJob({...raw,workplaceType:'hybrid'},source).work,'混合办公');
 assert.equal(normalizeJob(raw,source).work,'未注明');
});
