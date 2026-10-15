import {cleanText,normalizeJob,readJson} from './jobs.mjs';
import {officialSource} from './company-sources.mjs';

const supported=new Set(['iflytek','yonyou','unicom','sangfor']);
const invalid=()=>{throw new Error('官网职位数据格式改变，已保留上次岗位。');};
function count(value){if(!['string','number'].includes(typeof value)||value===''||!Number.isSafeInteger(Number(value))||Number(value)<0||Number(value)>30000)invalid();return Number(value);}
function normalize(source,row){
 if(row.id==null||!String(row.id)||!cleanText(row.title)||!cleanText(row.description))invalid();
 return {...normalizeJob(row,source),companyId:source.slug,sourceKind:'synced',verificationStatus:'official',descriptionKind:row.summary?'summary':'full',track:row.track||'unknown'};
}
export async function fetchEnterpriseJobs(input,{fetcher=fetch}={}){
 if(!supported.has(input.slug))return null;
 const source=officialSource(input.slug),overall=AbortSignal.timeout(300000);
 let headers={};
 const json=async(url,body)=>readJson(await fetcher(url,{method:body===undefined?'GET':'POST',headers:{...headers,'Content-Type':body instanceof URLSearchParams?'application/x-www-form-urlencoded':'application/json'},...(body===undefined?{}:{body:body instanceof URLSearchParams?body:JSON.stringify(body)}),signal:AbortSignal.any([overall,AbortSignal.timeout(18000)]),redirect:'error'}));
 if(source.slug==='sangfor'){
  const auth=await json('https://hr.sangfor.com/api/api/connect/token');
  if(typeof auth.access_token!=='string'||!auth.access_token||auth.access_token.length>4096||/[\r\n]/.test(auth.access_token))invalid();
  headers={Authorization:'Bearer '+auth.access_token};
 }
 const rows=[],pages=new Set();let expected,changed=false,first;
 for(let page=0;page<300;page++){
  let data,batch,current;
  if(source.slug==='iflytek'){
   data=await json('https://iflytek.zhiye.com/api/Jobad/GetJobAdPageList',{PageIndex:page,PageSize:50,KeyWords:'',SpecialType:0,PortalId:'6e2235dc-4b88-4698-b96a-5a73c705d8db',DisplayFields:['LocId','PostDate','Kind','Category','Degree','YearsOfWorking','Org']});
   if(data.Code!==200||!Array.isArray(data.Data))invalid();current=count(data.Count);
   batch=data.Data.map(r=>normalize(source,{id:r.Id,title:r.JobAdName,location:r.LocNames?.join('、'),description:[r.Duty,r.Require].filter(Boolean).join('\n\n任职要求\n'),url:`https://iflytek.zhiye.com/jobs?jobAdId=${encodeURIComponent(r.Id)}`,updated_at:r.ChangeDate,summary:!r.Duty||!r.Require,track:/校园|校招|实习|飞星/.test(r.Category||'')?'campus':/社会|社招/.test(r.Category||'')?'experienced':'unknown'}));
  }else if(source.slug==='unicom'){
   data=await json('https://fe.zhaopin.com/grace/api/dsc/search-job-list',{orgNumbers:['105347'],jobSource:2,pageIndex:page+1,pageSize:50});
   if(data.code!==200||!Array.isArray(data.data?.jobList))invalid();current=count(data.data.pageInfo?.totalNum);
   batch=data.data.jobList.map(r=>{
    if(r.company?.companyId!==105347||!r.job||!r.job.jobNumber)invalid();
    const j=r.job,url=new URL(j.url);
    if(url.origin!=='https://xiaoyuan.zhaopin.com'||url.pathname!==`/job/${j.jobNumber}`)invalid();
    return normalize(source,{id:j.jobNumber,title:j.title,description:[r.company.campusOrgName,j.detail].filter(Boolean).join('\n\n'),location:j.cityName||j.address,url:url.href,updated_at:j.modifiedTime?new Date(j.modifiedTime).toISOString():null,track:'campus',summary:!j.detail});
   });
  }else if(source.slug==='sangfor'){
   data=await json('https://hr.sangfor.com/api/api/Jobs',{channelId:101,page:page+1,pageSize:50,departmentId:0,functionId:0,kw:'',locationId:0,workPlaceId:0});
   if(data.code!==0||!Array.isArray(data.data?.listData))invalid();current=count(data.data.count);
   batch=data.data.listData.map(r=>{
    if(r.positionState!=='open'||!r.channelIds?.includes(101))invalid();
    return normalize(source,{id:r.positionId,title:r.title,description:r.description,location:r.workPlaceText,url:`https://hr.sangfor.com/campucompon/Delivery/${encodeURIComponent(r.positionId)}`,updated_at:r.openedAt,track:'campus'});
   });
  }else{
   const suite='SU67ac41886202cc7916ae3029',base='https://career.yonyou.com';
   data=await json(`${base}/wecruit/positionInfo/listPosition/${suite}`,new URLSearchParams({isFrompb:'true',recruitType:'2',pageSize:'12',currentPage:String(page+1)}));
   if(String(data.state)!=='200'||!Array.isArray(data.data?.pageForm?.pageData))invalid();current=count(data.data.pageForm.dataCount);
   const list=data.data.pageForm.pageData;batch=[];
   // Fetch public job descriptions in small batches; don't use login or resume APIs.
   for(let i=0;i<list.length;i+=4){
    const group=await Promise.all(list.slice(i,i+4).map(async r=>{
     const detail=await json(`${base}/wecruit/positionInfo/listPositionDetail/${suite}`,new URLSearchParams({postId:r.postId}));
     if(String(detail.state)!=='200'||detail.data?.postId!==r.postId||detail.data?.company!==r.company)invalid();
     const d=detail.data;
     return normalize(source,{id:d.postId,title:d.postName,location:d.workPlaceStr,description:[d.workContent,d.serviceCondition].filter(Boolean).join('\n\n任职要求\n'),url:`${base}/${suite}/pb/posDetail.html?postId=${encodeURIComponent(d.postId)}&postType=society`,updated_at:d.publishDate,track:'experienced',summary:!d.workContent||!d.serviceCondition});
    }));batch.push(...group);
   }
  }
  first??=current;changed||=first!==current;expected=Math.max(expected||0,current);
  const signature=batch.map(j=>j.id).join(',');if(pages.has(signature))throw new Error('官网重复返回同一页，已保留上次岗位。');pages.add(signature);rows.push(...batch);
  if(rows.length>=expected){const jobs=[...new Map(rows.map(j=>[j.id,j])).values()],complete=!changed&&jobs.length===expected;
   const note={unicom:'已读取中国联通官方 2027 校招专题的职位及完整说明，不代表社会招聘全量。',yonyou:'已读取用友官网社会招聘列表及各岗位详情。',iflytek:'已读取科大讯飞官网公开职位列表及职责、要求。',sangfor:'已通过官网匿名浏览接口读取 2027 校招职位及完整说明，不代表社会招聘全量。'}[source.slug];
   return {jobs,total:expected,complete,note:note+(complete?'':'同步期间列表变化或重叠，已保留未读取的历史岗位。')};
  }
  if(!batch.length)invalid();
 }
 throw new Error('官网分页超过读取上限，已保留上次岗位。');
}
