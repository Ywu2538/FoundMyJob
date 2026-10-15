import {cleanText,normalizeJob,readJson} from './jobs.mjs';
import {officialSource} from './company-sources.mjs';
import {fetchExtendedJobs as fetchAlibabaJobs} from './alibaba-sources.mjs';
import {fetchExtendedJobs as fetchFeishuJobs} from './feishu-sources.mjs';
import {officialFetch} from './official-fetch.mjs';
import {fetchEnterpriseJobs} from './enterprise-sources.mjs';
import {fetchBankJobs} from './bank-sources.mjs';
import {fetchMobileJobs} from './mobile-sources.mjs';

const invalid=()=>{throw new Error('官网职位数据格式改变；已保留上次岗位。');};
async function readText(response) {
  if(!response.ok)throw new Error(`官网返回 HTTP ${response.status}，暂时无法获取公开职位。`);
  const chunks=[];let size=0;
  for await(const chunk of response.body){size+=chunk.length;if(size>8000000)throw new Error('官网页面超过读取限制。');chunks.push(chunk);}
  return Buffer.concat(chunks).toString('utf8');
}
function job(source,{id,title,location,description,url,track,updatedAt,summary=false}) {
  if(id==null||!String(id)||!title?.trim()||!description?.trim())invalid();
  const j=normalizeJob({id,title,location:location||'未注明',description,url,updated_at:updatedAt},source);
  return {...j,...(track?{track}:{}),sourceKind:'synced',descriptionKind:summary?'summary':'full',verificationStatus:'official',companyId:source.slug};
}
function unique(rows) {if(new Set(rows.map(j=>j.id)).size!==rows.length)throw new Error('官网分页返回重复职位，请稍后重试。');return rows;}
function count(value) {if(!['string','number'].includes(typeof value)||value===''||!Number.isSafeInteger(Number(value))||Number(value)<0||Number(value)>30000)invalid();return Number(value);}

export async function fetchOfficialJobs(input,{fetcher=officialFetch}={}) {
  // Resolve endpoints only from the maintained catalog, never from client-supplied URLs.
  const source=officialSource(input.slug);
  const extended=await fetchAlibabaJobs(source,{fetcher})||await fetchFeishuJobs(source,{fetcher})||await fetchEnterpriseJobs(source,{fetcher})||await fetchBankJobs(source,{fetcher})||await fetchMobileJobs(source,{fetcher});
  if(extended)return extended;
  if(source.adapter==='pending')throw Object.assign(new Error(source.note),{code:'SOURCE_PENDING'});
  const signal=AbortSignal.timeout(180000);
  const request=(url,options={})=>fetcher(url,{...options,signal:AbortSignal.any([signal,AbortSignal.timeout(18000)]),redirect:'error'});
  const json=async(url,body)=>readJson(await request(url,body===undefined?{}:body instanceof URLSearchParams?{method:'POST',body}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));
  const html=async url=>readText(await request(url));
  if(['didi','tal'].includes(source.adapter)) {
    const rows=[],pages=new Set();let total;
    for(let page=1;page<=300;page++) {
      let batch;
      if(source.adapter==='didi') {
        const data=await json(`https://talent.didiglobal.com/recruit-portal-service/api/job/front/list?page=${page}&size=100`);
        if(data.meta?.code!==0||!Array.isArray(data.data?.items))invalid();
        total??=count(data.data.total);
        batch=data.data.items.map(r=>job(source,{id:r.jdId,title:r.jobName,location:r.workArea,description:[r.jobDuty,r.jobQualification].filter(Boolean).join('\n\n任职要求\n'),url:`https://talent.didiglobal.com/social/jobDetail?jdId=${encodeURIComponent(r.jdId)}`,track:/实习|校招/.test(r.jobName)?'campus':'experienced',updatedAt:r.refreshTime,summary:!r.jobQualification}));
      }else{
        const data=await json('https://job-api.100tal.com/sapi/activities/c/jobs/list',{orgId:'tal',route_code:'kg8Meh',limit:100,offset:page-1,site:'campus',keyword:'',locations:[],commitments:[],zhinengIds:[],tag_ids:[]});
        if(data.code!==200||!Array.isArray(data.data?.list))invalid();
        total??=count(data.data.total);
        batch=data.data.list.map(r=>job(source,{id:r.job_id,title:r.title,location:r.Locations?.join('、'),description:r.description,url:`https://job.tal.com/campus/positions/${encodeURIComponent(r.job_id)}`,track:'campus',updatedAt:r.updated_at}));
      }
      const signature=batch.map(j=>j.id).join(',');
      if(pages.has(signature))throw new Error('官网重复返回同一页，已保留上次岗位。');
      pages.add(signature);rows.push(...batch);
      if(rows.length>=total){
        const jobs=[...new Map(rows.map(j=>[j.id,j])).values()],complete=jobs.length===total;
        return {jobs,complete,total,note:(source.adapter==='tal'?'已读取官网校招列表。':'已读取官网社会招聘列表。')+(complete?'':'分页有重叠，已保留未读取的历史岗位。')};
      }
      if(!batch.length)invalid();
    }
    throw new Error('官网分页超过限制。');
  }
  if(source.adapter==='xiaomi') {
    const rows=[],pages=new Set();let total;
    for(let page=1;page<=300;page++) {
      const data=await json(`https://hr.xiaomi.com/website/api/agent/searchJobPage?keyword=&cityZhNames=&pageSize=100&pageNum=${page}`);
      if(data.code!==0||!Array.isArray(data.data?.list))invalid();
      total??=count(data.data.total);
      const batch=data.data.list,signature=batch.map(r=>r.jobPostId||r.id).join(',');
      if(pages.has(signature))throw new Error('官网重复返回同一页，已保留上次岗位。');
      pages.add(signature);
      rows.push(...batch.map(r=>job(source,{id:r.jobPostId||r.id,title:r.title,location:r.cityZhNames?.join('、'),description:[r.description,r.requirement].filter(Boolean).join('\n\n任职要求\n'),url:r.url,track:r.type===1?'experienced':[2,3].includes(r.type)?'campus':undefined,updatedAt:r.publishTime,summary:!r.requirement})));
      if(rows.length>=total){
        const jobs=[...new Map(rows.map(j=>[j.id,j])).values()],complete=jobs.length===total;
        return {jobs,complete,total,note:'来自小米官网公开职位搜索，包含官网提供的招聘类型。'+(complete?'':'列表有重复记录，未读取的历史岗位予以保留。')};
      }
      if(!batch.length)invalid();
    }
    throw new Error('官网分页超过限制。');
  }
  if(source.adapter==='baidu') {
    // Read the same public server-rendered lists shown without login. The separate
    // pagination API requires access validation, so these bounded lists are partial.
    const rows=[];
    for(const [path,type] of [['social-list','SOCIAL'],['list','GRADUATE'],['list','INTERN']]) {
      for(const keyword of ['', '数据']) {
        const text=await html(`https://talent.baidu.com/jobs/${path}?recruitType=${type}&search=${encodeURIComponent(keyword)}`);
        const match=text.match(/window\.__INITIAL_DATA__\s*=\s*([\s\S]+?);\s*window\.prefix/);
        if(!match)invalid();
        // The site's serialized object may contain undefined values. Replace only
        // bare tokens outside quoted strings, and still reject executable syntax.
        const serialized=match[1].replace(/"(?:\\.|[^"\\])*"|\bundefined\b/g,token=>token==='undefined'?'null':token);
        const data=JSON.parse(serialized).listData;
        if(!Array.isArray(data?.listDetailData)||data.recruitType!==type)invalid();
        rows.push(...data.listDetailData.map(r=>job(source,{id:r.postId,title:r.name,location:r.workPlace,description:[r.workContent,r.serviceCondition].filter(Boolean).join('\n\n任职要求\n'),url:`https://talent.baidu.com/jobs/detail/${type}/${encodeURIComponent(r.postId)}`,track:type==='SOCIAL'?'experienced':'campus',updatedAt:r.updateDate,summary:!r.serviceCondition})));
      }
    }
    return {jobs:[...new Map(rows.map(j=>[j.id,j])).values()],complete:false,note:'已读取官网社招、校招、实习的公开首屏及“数据”搜索首屏；分页接口受访问校验限制，尚非全量。'};
  }
  if(source.adapter==='xiaohongshu') {
    const rows=[];let total=0,complete=true;
    for(const type of ['social','campus']) {
      const branch=[],pages=new Set();let expected;
      for(let page=1;page<=300;page++) {
        const data=await json('https://job.xiaohongshu.com/websiterecruit/position/pageQueryPosition',{pageNum:page,pageSize:100,recruitType:type});
        if(data.success!==true||data.statusCode!==200||!Array.isArray(data.data?.list))invalid();
        expected??=count(data.data.total);
        const batch=data.data.list;
        const signature=batch.map(r=>r.positionId).join(',');
        if(pages.has(signature))throw new Error('官网重复返回同一页，已保留上次岗位。');
        pages.add(signature);
        branch.push(...batch.map(r=>job(source,{id:r.positionId,title:r.positionName,location:r.workplace,description:[r.duty,r.qualification].filter(Boolean).join('\n\n任职要求\n'),url:`https://job.xiaohongshu.com/${type}/${encodeURIComponent(r.positionId)}`,track:type==='campus'?'campus':'experienced',updatedAt:r.publishTime,summary:!r.qualification})));
        if(branch.length>=expected)break;
        if(!batch.length||page===300)invalid();
      }
      if(new Set(branch.map(j=>j.id)).size!==expected)complete=false;
      total+=expected;rows.push(...branch);
    }
    return {jobs:[...new Map(rows.map(j=>[j.id,j])).values()],complete,total,note:'已读取官网社招与校招列表（含实习）。'+(complete?'':'分页数据有重叠，已去重并保留未读取的历史岗位。')};
  }
  if(source.adapter==='qianxin') {
    // JSONP is parsed as data, never executed as JavaScript.
    const text=await html('https://campus.qianxin.com/Job/Campus/lists');
    const payload=text.match(/^\s*jsonpReturn\((\{[\s\S]*\})\);?\s*$/);
    if(!payload)invalid();
    const data=JSON.parse(payload[1]);
    if(String(data.code)!=='200'||!Array.isArray(data.data?.jobs))invalid();
    const rows=data.data.jobs.map(r=>job(source,{id:r.id,title:r.name,location:r.jobCity,description:[r.content,r.description].filter(Boolean).join('\n\n任职要求\n'),url:r.jobUrl,track:'campus',summary:!r.description}));
    return {jobs:unique(rows),complete:true,total:rows.length,note:'已读取官网校招列表；不代表社招职位全量。'};
  }
  if(source.adapter==='tencent') {
    const rows=[],pages=new Set();let total;
    for(let page=1;page<=300;page++) {
      const data=await json(`https://careers.tencent.com/tencentcareer/api/post/Query?pageIndex=${page}&pageSize=100&language=zh-cn&area=cn`);
      if(data.Code!==200||!Array.isArray(data.Data?.Posts))invalid();
      total??=count(data.Data.Count);
      const batch=data.Data.Posts;
      const signature=batch.map(r=>r.PostId).join(',');
      if(pages.has(signature))throw new Error('官网重复返回同一页，已保留上次岗位。');
      pages.add(signature);
      rows.push(...batch.map(r=>job(source,{id:r.PostId,title:r.RecruitPostName,location:[r.CountryName,r.LocationName].filter(Boolean).join(' · '),description:[r.Responsibility,r.Requirement].filter(Boolean).join('\n\n任职要求\n'),url:`https://careers.tencent.com/jobdesc.html?postId=${encodeURIComponent(r.PostId)}`,updatedAt:r.LastUpdateTime,summary:!r.Requirement})));
      if(rows.length>=total){
        const jobs=[...new Map(rows.map(j=>[j.id,j])).values()],complete=jobs.length===total;
        return {jobs,complete,total,note:complete?'':'官网分页在同步时发生重叠，已去重并保留未读取的历史岗位。'};
      }
      if(!batch.length)invalid();
    }
    throw new Error('官网分页数量超过安全上限，已保留上次岗位。');
  }
  if(source.adapter==='jd') {
    const params={workCityJson:'[]',jobTypeJson:'[]',depTypeJson:'[]',jobSearch:''};
    const total=count(await json('https://zhaopin.jd.com/web/job/job_count',new URLSearchParams(params))),rows=[],pages=new Set();
    for(let page=1;page<=300;page++) {
      const batch=await json('https://zhaopin.jd.com/web/job/job_list',new URLSearchParams({...params,pageIndex:String(page),pageSize:'100'}));
      if(!Array.isArray(batch))invalid();
      const signature=batch.map(r=>r.requirementId).join(',');
      if(pages.has(signature))throw new Error('官网重复返回同一页，已保留上次岗位。');
      pages.add(signature);
      rows.push(...batch.map(r=>job(source,{id:r.requirementId,title:r.positionNameOpen||r.positionName,location:r.workCity,description:[r.workContent,r.qualification].filter(Boolean).join('\n\n任职要求\n'),url:`https://zhaopin.jd.com/web/job-info-detail?requementId=${encodeURIComponent(r.requirementId)}`,track:'experienced',updatedAt:r.formatPublishTime,summary:!r.qualification})));
      if(rows.length>=total)return {jobs:[...new Map(rows.map(j=>[j.id,j])).values()],complete:true,total};
      if(!batch.length)invalid();
    }
    throw new Error('官网分页数量超过安全上限，已保留上次岗位。');
  }
  if(['meituan','oppo','trip'].includes(source.adapter)) {
    const rows=[];let total;const pages=new Set();
    for(let page=1;page<=300;page++){
      let batch;
      if(source.adapter==='meituan'){
        const data=await json('https://zhaopin.meituan.com/api/official/job/getJobList',{page:{pageNo:page,pageSize:100}});
        if(data.status!==1||!Array.isArray(data.data?.list))invalid();
        total??=count(data.data.page?.totalCount);
        batch=data.data.list.map(r=>job(source,{id:r.jobUnionId,title:r.name,location:r.cityList?.map(c=>c.name).join('、'),description:[r.jobDuty,r.jobRequirement,r.highLight].filter(Boolean).join('\n\n'),url:`https://zhaopin.meituan.com/web/position/detail?jobUnionId=${encodeURIComponent(r.jobUnionId)}`,updatedAt:r.refreshTime?new Date(r.refreshTime).toISOString():null,summary:!r.jobRequirement}));
      }else if(source.adapter==='oppo'){
        const data=await json('https://careers.oppo.com/openapi/position/pageNew',{pageNum:page,pageSize:100});
        if(data.code!==0||!Array.isArray(data.data?.records))invalid();
        total??=count(data.data.total);
        batch=data.data.records.map(r=>job(source,{id:r.idRecruitPosition,title:r.positionName,location:r.workCityName,description:[r.positionDesc,r.positionRequire,r.knowledgeSkill,r.aiCapabilityLevelDesc].filter(Boolean).join('\n\n'),url:`https://careers.oppo.com/campus/post/${encodeURIComponent(r.idRecruitPosition)}`,track:'campus',updatedAt:r.releaseTime,summary:!r.positionRequire&&!r.knowledgeSkill}));
      }else{
        const data=await json('https://careers.ctrip.com/api/hrrecruit/getJobAd',{condition:{fromId:[],keyword:'',kind:[],country:[],city:[],bucode:[],jobFamilyCode:[],jobFamilyGroupCode:[]},pager:{index:String(page),size:'100'}});
        if(data.retCode!=='201'||!Array.isArray(data.retValue?.recruitJobAdList))invalid();
        total??=count(data.retValue.total);
        batch=data.retValue.recruitJobAdList.map(r=>job(source,{id:r.id,title:r.jobTitle,location:r.cityName,description:[r.duty,r.requirements].filter(Boolean).join('\n\n'),url:`https://careers.ctrip.com/${r.category==='2'?'campus':'experienced'}/job-detail/${encodeURIComponent(r.id)}`,updatedAt:r.publishDate,track:r.category==='2'?'campus':undefined}));
      }
      const signature=batch.map(j=>j.id).join(',');
      if(pages.has(signature))throw new Error('官网重复返回同一页，已保留上次岗位。');
      pages.add(signature);rows.push(...batch);
      if(rows.length>=total)return {jobs:[...new Map(rows.map(j=>[j.id,j])).values()],complete:true,total};
      if(!batch.length)invalid();
    }
    throw new Error('官网分页超过限制。');
  }
  if(source.adapter==='lenovo') {
    // A bounded public listing import; absence on these pages never closes older jobs.
    const rows=[];
    for(let offset=0;offset<100;offset+=10){
      const text=await html(`https://jobs.lenovo.com/en_US/careers/SearchJobs/?jobRecordsPerPage=10&jobOffset=${offset}`);
      const articles=[...text.matchAll(/<article class="article article--result">([\s\S]*?)<\/article>/g)];
      if(!articles.length)invalid();
      for(const [,part] of articles){
        const match=part.match(/<a href="(https:\/\/jobs\.lenovo\.com\/en_US\/careers\/JobDetail\/[^"<>]+)">([\s\S]*?)<\/a>/);
        const location=cleanText(part.match(/article__header__text__subtitle">\s*<span>([\s\S]*?)<\/span>/)?.[1]);
        if(!match)invalid();
        const title=cleanText(match[2]);
        rows.push(job(source,{id:match[1].split('/').pop(),title,location,url:match[1],description:`官网列表公开职位：${title}\n工作地点：${location||'未注明'}\n${cleanText(part.match(/<span class="paragraph">([\s\S]*?)<\/span>/)?.[1])}\n完整职责和任职要求请查看岗位原文。`,summary:true}));
      }
      if(articles.length<10)break;
    }
    return {jobs:unique(rows),complete:false,note:'已获取官网前 100 条职位摘要；完整要求见原文，未抓取部分不标为下架。'};
  }
  if(source.adapter==='4399') {
    const rows=[];
    for(const type of [1,2]){
      const text=await html(`https://u.4399.com/hr/zhaopin?cid=${type}`);
      for(const [,id,part] of text.matchAll(/<a class="j-job" href="job\?id=(\d+)"[^>]*>([\s\S]*?)<\/a>/g)){
        const cells=[...part.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/g)].map(m=>cleanText(m[1]));
        rows.push(job(source,{id,title:cells[0],location:cells.at(-1),description:`官网列表公开职位：${cells[0]}\n招聘类型：${cells[2]}\n工作地点：${cells.at(-1)}\n招聘人数：${cells[1]}\n完整职责和任职要求请查看岗位原文。`,url:`https://u.4399.com/hr/job?id=${id}`,track:cells[2]?.includes('校园')?'campus':'experienced',summary:true}));
      }
    }
    if(!rows.length)invalid();
    return {jobs:[...new Map(rows.map(j=>[j.id,j])).values()],complete:false,note:'已获取官网首屏职位摘要；完整要求见原文。'};
  }
  throw new Error('此招聘源暂未返回可读取的公开职位。');
}
