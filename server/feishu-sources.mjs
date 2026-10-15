import {normalizeJob,readJson} from './jobs.mjs';
import {officialSource} from './company-sources.mjs';
import {fetchMokaJobs} from './moka-sources.mjs';

// These are the public career-site settings, not tenant/admin API credentials.
// Bytedance's visible /experienced route uses the internal website path "society".
const SITES = {
  bytedance:{origin:'https://jobs.bytedance.com',path:'society',route:'experienced',channel:'office',portal:2,label:'社会招聘',capped:true},
  nio:{origin:'https://nio.jobs.feishu.cn',path:'index',label:'社会招聘'},
  li:{origin:'https://li.jobs.feishu.cn',path:'index',label:'公开招聘'},
  ireader:{origin:'https://q7w8vltyes.jobs.feishu.cn',path:'zhangyue',label:'公开招聘'},
  qunar:{origin:'https://hf7l9aiqzx.jobs.feishu.cn',path:'704852',label:'校园招聘'},
  duxiaoman:{origin:'https://campus.duxiaoman.com',path:'051736',label:'校园招聘'},
};
const invalid=()=>{throw new Error('官网职位数据格式改变，已保留上次岗位。');};
const count=value=>{
  if(!['number','string'].includes(typeof value)||value===''||!Number.isSafeInteger(Number(value))||Number(value)<0||Number(value)>30000)invalid();
  return Number(value);
};
const name=value=>typeof value==='string'?value:value?.zh_cn||value?.i18n||value?.en_us||'';

function normalize(source,site,row) {
  if(!row||!['string','number'].includes(typeof row.id)||!/^[\w-]{1,100}$/.test(String(row.id))||typeof row.title!=='string'||!row.title.trim())invalid();
  const fullDescription=[row.description,row.requirement].filter(v=>typeof v==='string'&&v.trim()).join('\n\n任职要求\n');
  const cities=Array.isArray(row.city_list)?row.city_list.map(c=>name(c.name)).filter(Boolean):[];
  const location=cities.join('、')||name(row.city_info?.name)||'未注明';
  const description=fullDescription||`官网公开职位：${row.title}\n工作地点：${location}\n官网列表未提供职责和要求，请查看岗位原文。`;
  const published=Number(row.publish_time),date=published>0?new Date(published):null;
  const result=normalizeJob({id:row.id,title:row.title,description,location,
    url:`${site.origin}/${site.route||site.path}/position/${encodeURIComponent(row.id)}/detail`,
    updated_at:date&&!Number.isNaN(date.getTime())?date.toISOString():null},source);
  const recruitment=row.recruit_type||row.job_post_info?.recruitment_type;
  const category=String(recruitment?.parent?.id||recruitment?.id||'');
  const track=row.process_type===2||category==='2'?'campus':row.process_type===1||category==='1'?'experienced':result.track;
  return {...result,track,sourceKind:'synced',verificationStatus:'official',descriptionKind:fullDescription?'full':'summary',companyId:source.slug};
}

export async function fetchExtendedJobs(input,{fetcher=fetch}={}) {
  const site=SITES[input?.slug];
  if(!site)return fetchMokaJobs(input,{fetcher});
  // Ignore client-provided URLs, names, and adapters. Only fixed official sites
  // and the maintained catalog may supply request destinations and ownership.
  const source=officialSource(input.slug),overall=AbortSignal.timeout(300000);
  const headers={'Content-Type':'application/json','website-path':site.path,
    'Portal-Channel':site.channel||'saas-career','Portal-Platform':'pc',
    'Accept-Language':'zh-CN',Origin:site.origin,Referer:`${site.origin}/${site.route||site.path}/`};
  const request=(path,body)=>fetcher(site.origin+path,{method:'POST',headers:{...headers},body:JSON.stringify(body),
    signal:AbortSignal.any([overall,AbortSignal.timeout(20000)]),redirect:'error'});
  // This anonymous CSRF handshake is what the public site itself performs.
  // Tokens remain in memory for this sync and are never persisted or logged.
  const tokenResponse=await request('/api/v1/csrf/token',{}),tokenData=await readJson(tokenResponse,100000);
  const token=tokenData.data?.token;
  if(tokenData.code!==0||typeof token!=='string'||!token||token.length>1024||/[\r\n;]/.test(token))invalid();
  const cookie=tokenResponse.headers.getSetCookie().map(c=>c.split(';')[0]).find(c=>c.startsWith('atsx-csrf-token='));
  if(!cookie||/[\r\n]/.test(cookie))invalid();
  headers['x-csrf-token']=token;headers.Cookie=cookie;
  const rows=[],seenPages=new Set();let initialTotal,total,changed=false;
  for(let offset=0,page=0;page<300;page++) {
    const data=await readJson(await request('/api/v1/search/job/posts',{
      keyword:'',limit:100,offset,job_category_id_list:[],tag_id_list:[],location_code_list:[],
      subject_id_list:[],recruitment_id_list:[],job_function_id_list:[],storefront_id_list:[],
      portal_type:site.portal||6,portal_entrance:1,
    }));
    if(data.code!==0||!Array.isArray(data.data?.job_post_list))invalid();
    const currentTotal=count(data.data.count),batch=data.data.job_post_list;
    initialTotal??=currentTotal;total=Math.max(total||0,currentTotal);changed||=currentTotal!==initialTotal;
    if(batch.length>100)invalid();
    if(!batch.length&&offset<total)invalid();
    const signature=batch.map(r=>r.id).join(',');
    if(seenPages.has(signature))throw new Error('官网重复返回同一页，已保留上次岗位。');
    seenPages.add(signature);rows.push(...batch.map(row=>normalize(source,site,row)));offset+=batch.length;
    if(offset>=total) {
      const jobs=[...new Map(rows.map(row=>[row.id,row])).values()];
      const capped=site.capped&&total>=10000;
      const complete=!changed&&!capped&&jobs.length===total;
      const note=`已读取官网${site.label}列表。`+(capped?'官网搜索最多返回 10,000 条，当前为部分同步，保留未读取的历史岗位。':complete?'': '同步期间列表有变化或重叠，已去重并保留未读取的历史岗位。');
      return {jobs,total,complete,note};
    }
  }
  throw new Error('官网分页超过读取上限，已保留上次岗位。');
}
