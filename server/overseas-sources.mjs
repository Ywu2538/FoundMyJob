// Public Workday boards verified from each employer's official career listings.
// A search retrieves a bounded subset, never a complete employer-wide snapshot.
import {cleanText,normalizeJob,readJson} from './jobs.mjs';
import {matchesTarget,canonicalSearchQuery} from '../dist/core.js';
import {normalizeWork,WORK_PREFERENCES} from '../dist/job-preferences.js';

const boards=[['bmo','BMO','External'],['td','TD Bank','TD_Bank_Careers'],['rbc','RBC','RBCGLOBAL1'],['cibc','CIBC','search']];
export const OVERSEAS_SOURCES=boards.map(([slug,company,site])=>({id:`workday:${slug}`,provider:'workday',slug,company,site,host:`${slug}.wd3.myworkdayjobs.com`,careersUrl:`https://${slug}.wd3.myworkdayjobs.com/en-US/${site}`,directoryScope:'overseas',featured:true,adapter:'workday-search'}));
const dateToday=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Toronto'});
export function overseasSearchQuery(target){
 return canonicalSearchQuery(target);
}
const validPath=path=>typeof path==='string'&&/^\/job\/[A-Za-z0-9_/%.,+()&!~'-]+$/.test(path)&&!path.includes('..')&&!/%2f|%5c/i.test(path);
function workArrangement(info,row){
 const explicit=normalizeWork(info.remoteType||row.remoteType||'');
 if(explicit)return WORK_PREFERENCES[explicit][0];
 const text=cleanText(info.jobDescription);
 // Match employment arrangements only: "hybrid cloud" and "remote systems" are not work modes.
 const lines=text.match(/(?:work\s*(?:model|arrangement|location)|working\s*(?:model|arrangement)|remote\s*type)[^.!?\n]{0,180}|[^.!?\n]{0,80}\bhybrid\s+(?:work\s+arrangement|role|working|work\s+model)[^.!?\n]{0,120}|[^.!?\n]{0,50}\b(?:fully|100%)\s+remote\b[^.!?\n]{0,80}/gi)||[];
 return WORK_PREFERENCES[normalizeWork(lines.join(' '))]?.[0]||'未注明';
}
function postingJob(row,info,source,query){
 const locations=[info.location,...(info.additionalLocations||[])].filter(v=>typeof v==='string'&&v.trim());
 const country=info.country?.descriptor||info.jobRequisitionLocation?.country?.descriptor||'';
 let location=locations.length?[...new Set(locations)].join(' / '):row.locationsText;
 if(country&&locations.length<2&&!location?.toLowerCase().includes(country.toLowerCase()))location=`${location} · ${country}`;
 const title=info.title||row.title,url=`https://${source.host}/en-US/${source.site}${row.externalPath}`;
 const description=info.jobDescription||[title,location,row.postedOn].filter(Boolean).join('\n');
 const job=normalizeJob({id:row.externalPath.split('/').at(-1),title,location,description,absolute_url:url},source);
 return {...job,work:workArrangement(info,row),sourceKind:'synced',sourceName:source.company,descriptionKind:info.jobDescription?'full':'summary',verificationStatus:info.jobDescription?'official':'pending',searchQuery:query,sourceUpdatedAt:info.startDate||null,applicationDeadline:info.endDate||null};
}
export async function fetchOverseasJobs(input,{fetcher=fetch,query='data engineer',maxJobs=200,detailLimit=80,today=dateToday()}={}){
 const source=OVERSEAS_SOURCES.find(s=>s.id===input.id);
 if(!source)throw new Error('未知的海外官方招聘源。');
 if(typeof query!=='string'||!query.trim()||query.length>160)throw new Error('请填写目标职位或搜索关键词。');
 query=query.trim();maxJobs=Math.max(1,Math.min(300,maxJobs));detailLimit=Math.max(0,Math.min(100,detailLimit));
 const base=`https://${source.host}/wday/cxs/${source.slug}/${source.site}`;
 const read=async(url,options={})=>readJson(await fetcher(url,{...options,redirect:'error',signal:AbortSignal.timeout(20000)}),8000000);
 const rows=[],seen=new Set();let total,offset=0,partial=false;
 while(offset<maxJobs){
  const data=await read(`${base}/jobs`,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({appliedFacets:{},limit:20,offset,searchText:query})});
  if(!Number.isSafeInteger(data.total)||data.total<0||!Array.isArray(data.jobPostings)||data.jobPostings.length>20)throw new Error('海外招聘源返回格式异常，已保留上次岗位。');
  total??=data.total;
  // Workday returns the total on page one and commonly returns 0 on later pages.
  if(data.total>0&&total!==data.total)partial=true;
  if(data.jobPostings.some(row=>!validPath(row.externalPath)||typeof row.title!=='string'||!row.title.trim()))throw new Error('海外职位链接或标题异常，已保留上次岗位。');
  let added=0;
  for(const row of data.jobPostings){if(seen.has(row.externalPath)){partial=true;continue;}seen.add(row.externalPath);rows.push(row);added++;}
  offset+=data.jobPostings.length;
  if(offset>=total)break;
  if(!added){partial=true;break;}
 }
 if(rows.length<total)partial=true;
 const ordered=[...rows].sort((a,b)=>Number(matchesTarget(b,query))-Number(matchesTarget(a,query)));
 const details=new Map(),closedIds=[];let failures=0;
 const detailRows=ordered.slice(0,detailLimit);
 for(let i=0;i<detailRows.length;i+=4)await Promise.all(detailRows.slice(i,i+4).map(async row=>{
  try{const detail=await read(base+row.externalPath),info=detail.jobPostingInfo;
   if(!info||typeof info.title!=='string'||info.jobPostingId!==row.externalPath.split('/').at(-1)||info.jobPostingSiteId!==source.site)throw new Error('职位详情与列表不一致。');
   details.set(row.externalPath,info);
  }catch{failures++;}
 }));
 const jobs=[];
 for(const row of rows){
  const info=details.get(row.externalPath)||{},job=postingJob(row,info,source,query);
  if(info.canApply===false||info.posted===false||(info.endDate&&info.endDate.slice(0,10)<today)){closedIds.push(job.id);continue;}
  jobs.push(job);
 }
 return {jobs,complete:false,total,closedIds,query,searchComplete:!partial,note:`关键词：${query}；读取 ${rows.length}/${total} 条搜索结果，${details.size} 条已读取完整详情${failures?`，${failures} 条详情暂不可用`:''}。仅覆盖本次官网搜索，不代表公司全部岗位。`};
}
