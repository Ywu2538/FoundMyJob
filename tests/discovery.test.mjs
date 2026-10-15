import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverySummary,filterJobs,matchJob,matchesTarget,jobInRegion,defaultJobFilters,discoveryGroups,profileSearchScope} from '../dist/core.js';

const profile={target:'数据分析师',skills:['Python','SQL'],track:'experienced'};
const base={title:'Data Analyst',company:'Example',tags:['Python','SQL'],track:'experienced',category:'数据',location:'Toronto',region:'na',active:true};

test('420 stored records are separated into 416 active, 8 China results and pagination',()=>{
  const jobs=Array.from({length:420},(_,i)=>({...base,id:String(i),active:i<416,location:i<8?'Shanghai':'Toronto',company:i<8?'Tower':'Example'}));
  const cn=discoverySummary(jobs,profile,{region:'cn',limit:36});
  assert.equal(cn.active,416);assert.equal(cn.archived,4);assert.equal(cn.region,8);
  assert.equal(cn.results.length,8);assert.equal(cn.visible,8);
  const all=discoverySummary(jobs,profile,{limit:36});
  assert.equal(all.results.length,416);assert.equal(all.visible,36);
  assert.equal(discoverySummary(jobs,profile,{limit:72}).visible,72);
  const saved=discoverySummary(jobs,profile,{savedOnly:true,saved:['419']});
  assert.deepEqual(saved.results.map(j=>j.id),['419']);assert.equal(saved.active,416);
});

test('data analyst target excludes engineering and quant roles even with identical skills',()=>{
  const titles=['数据分析师-电商','Senior Data Analyst','Business Intelligence Analyst','Data Engineer','Machine Learning Engineer','Quantitative Researcher','Software Engineer'];
  const jobs=titles.map(title=>({...base,title}));
  assert.deepEqual(filterJobs(jobs,profile,{targetOnly:true}).map(j=>j.title),titles.slice(0,3));
  assert.equal(matchesTarget({title:'高级数据分析师'},'Data Analyst'),true);
  assert.ok(matchJob(jobs[0],profile).score>matchJob(jobs[3],profile).score);
  assert.equal(matchJob(jobs[3],profile).role,false);
  assert.equal(filterJobs(jobs,profile,{}).length,7);
  assert.equal(filterJobs(jobs,{...profile,target:''},{targetOnly:true}).length,7);
});

test('data engineering is distinct from data analysis; compound targets retain both requested roles',()=>{
  assert.equal(matchesTarget({title:'数据开发工程师'},'Data Engineer'),true);
  assert.equal(matchesTarget({title:'Data Analyst'},'Data Engineer'),false);
  assert.equal(matchesTarget({title:'Software Engineer'},'Data Engineer / Software Engineer'),true);
  assert.equal(matchesTarget({title:'Data Engineer'},'Data Engineer / Software Engineer'),true);
  assert.equal(jobInRegion({...base,location:'Hangzhou',region:'other'},'cn'),true);
  assert.equal(jobInRegion({...base,location:'香港',region:'other'},'cn'),false);
});

test('default view batches 25 jobs while sorting and profile location retain every active result',()=>{
  const jobs=Array.from({length:413},(_,i)=>({...base,id:String(i),title:i%2?'Software Engineer':'Data Analyst',location:i<8?'Shanghai':'Toronto',syncedAt:new Date(1000*i).toISOString()}));
  jobs.push({...base,id:'closed',active:false});
  for(const searchScope of ['domestic','overseas','all'])for(const sort of ['match','new']){
    const filters={...defaultJobFilters(),sort};
    const result=discoverySummary(jobs,{...profile,searchScope,market:'cn'},filters);
    assert.equal(result.results.length,413);assert.equal(result.visible,25);assert.equal(filters.pageSize,25);
    assert.equal(result.archived,1);assert.equal(filters.targetOnly,false);assert.equal(filters.region,'');
    assert.equal(discoverySummary(jobs,profile,{...filters,pageSize:50,limit:50}).visible,50);
  }
});

test('official discovery groups follow profile scope, including legacy country preferences',()=>{
  assert.deepEqual(discoveryGroups({searchScope:'domestic',market:'ca'}),['domestic']);
  assert.deepEqual(discoveryGroups({searchScope:'overseas',market:'cn'}),['overseas']);
  assert.deepEqual(discoveryGroups({searchScope:'all'}),['domestic','overseas']);
  assert.equal(profileSearchScope({market:'cn'}),'domestic');
  assert.equal(profileSearchScope({market:'ca'}),'overseas');
  assert.equal(profileSearchScope({market:'us'}),'overseas');
  assert.equal(profileSearchScope({market:''}),'all');
  assert.equal(jobInRegion({...base,location:'Shanghai / Singapore'},'overseas'),true);
  for(const location of ['Aarhus, Central Denmark Region, Denmark','São Paulo, Brazil','Tel Aviv, Israel','Gurgaon','Grand Cayman'])assert.equal(jobInRegion({...base,location,region:'other'},'overseas'),true);
  assert.equal(jobInRegion({...base,location:'Remote',region:'other'},'overseas'),false);
});

test('discovered roles are visible in the main results and counted separately from synced jobs',()=>{
  const jobs=[{...base,id:'synced'}, {...base,id:'lead',source:'manual',sourceKind:'discovered'}, {...base,id:'manual',source:'manual'}];
  const result=discoverySummary(jobs,profile,defaultJobFilters());
  assert.equal(result.active,3);assert.equal(result.visible,3);
  assert.equal(result.synced,1);assert.equal(result.pending,1);assert.equal(result.manual,1);
  assert.deepEqual(filterJobs(jobs,profile,{sourceKind:'discovered'}).map(j=>j.id),['lead']);
});
