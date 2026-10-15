import {normalizeJob,readJson} from './jobs.mjs';
import {officialSource} from './company-sources.mjs';
const ORG='8ba3bc9962e2c55501636c1220b10648',BASE='https://job.ccb.com';
const invalid=()=>{throw new Error('建行招聘数据格式改变，已保留上次岗位。');};
export async function fetchBankJobs(input,{fetcher=fetch}={}){
 if(input.slug!=='ccbft')return null;
 const source=officialSource(input.slug),overall=AbortSignal.timeout(180000),jobs=[],seen=new Set();let expected;
 for(let page=1;page<=300;page++){
  const query=new URLSearchParams({CCB_IBSVersion:'V5',isAjaxRequest:'true',SERVLET_NAME:'WCCMainPlatV5',TXCODE:'NHR104',orgId:ORG,viewFffectivePost:'1',PAGE_JUMP:String(page),REC_IN_PAGE:'10'});
  const data=await readJson(await fetcher(`${BASE}/tran/WCCMainPlatV5?${query}`,{headers:{'User-Agent':'Mozilla/5.0',Referer:BASE+'/cn/job/index.html'},redirect:'error',signal:AbortSignal.any([overall,AbortSignal.timeout(18000)])}));
  if(data.SUCCESS!=='true'||!/^\d+$/.test(String(data.TOTAL_REC)))invalid();
  const total=Number(data.TOTAL_REC);if(total>3000)invalid();expected??=total;
  const batch=data.planPostList??(total===0?[]:null);if(!Array.isArray(batch))invalid();
  const signature=batch.map(r=>`${r.planId}:${r.planPost}`).join(',');if(seen.has(signature))invalid();seen.add(signature);
  for(const r of batch){
   if(r.orgId!==ORG||r.planStatus!=='1'||!r.planId||!r.planPost||!r.planPostName)invalid();
   const url=BASE+'/cn/job/job_detail.html?'+new URLSearchParams({planId:r.planId,planPost:r.planPost,planType:r.planType,orgId:ORG,secondOrgId:r.secondOrgId});
   const description=`官网当前报名岗位：${r.planPostName}\n招聘机构：${r.orgName}\n工作地点：${r.workPlace}\n报名截止：${r.endDate}\n完整职责和任职要求请查看岗位原文。`;
   jobs.push({...normalizeJob({id:r.planId+':'+r.planPost,title:r.planPostName,location:r.workPlace,description,url,updated_at:r.postDate},source),companyId:source.slug,sourceKind:'synced',verificationStatus:'official',descriptionKind:'summary',track:['XY','SX'].includes(r.planType)?'campus':'experienced'});
  }
  if(jobs.length>=expected){const unique=[...new Map(jobs.map(j=>[j.id,j])).values()];return {jobs:unique,total,complete:total===expected&&unique.length===total,note:total?'已读取建设银行招聘平台中建信金科机构当前开放报名的职位摘要。':'已核验建信金科当前开放报名列表，暂无有效职位；已结束报名的岗位未计为在招。'};}
  if(!batch.length)invalid();
 }
 throw new Error('建行招聘分页超过读取限制。');
}
