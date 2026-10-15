import {createDecipheriv} from 'node:crypto';
import {normalizeJob,readJson} from './jobs.mjs';
import {officialSource} from './company-sources.mjs';

const SITES={
  zte:{origin:'https://app.mokahr.com',org:'zte',site:47588},
  wanmei:{origin:'https://app.mokahr.com',org:'pwrd',site:142341},
  fulltruck:{origin:'https://jobs.fulltruckalliance.com',org:'manbang',site:46269},
};
const invalid=()=>{throw new Error('招聘官网职位数据格式改变，已保留上次岗位。');};
function decodeAttribute(text) {
  return text.replace(/&(?:quot|apos|lt|gt|amp);|&#(?:x[0-9a-f]+|\d+);/gi,part=>{
    const named={'&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>','&amp;':'&'};
    if(named[part])return named[part];
    const n=part[2].toLowerCase()==='x'?parseInt(part.slice(3),16):parseInt(part.slice(2),10);
    return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';
  });
}
async function readText(response) {
  if(!response.ok)throw new Error(`官网返回 HTTP ${response.status}，已保留上次岗位。`);
  const chunks=[];let size=0;
  for await(const chunk of response.body){size+=chunk.length;if(size>8000000)invalid();chunks.push(chunk);}
  return Buffer.concat(chunks).toString('utf8');
}
// Moka wraps public job JSON using a key in the response and an IV in the
// anonymous page. This reproduces the public site's decode, without executing JS.
function decodePayload(payload,iv) {
  if(!payload?.necromancer)return payload;
  if(typeof payload.necromancer!=='string'||typeof payload.data!=='string'||typeof iv!=='string')invalid();
  const key=Buffer.from(payload.necromancer),initial=Buffer.from(iv);
  if(![16,24,32].includes(key.length)||initial.length!==16)invalid();
  try {
    const decoder=createDecipheriv(`aes-${key.length*8}-cbc`,key,initial);
    return JSON.parse(Buffer.concat([decoder.update(Buffer.from(payload.data,'base64')),decoder.final()]).toString('utf8'));
  }catch{invalid();}
}
function normalize(source,site,row) {
  if(row.orgId!==site.org||row.status!=='open'||!row.id||!/^[\w-]{1,100}$/.test(String(row.id))||typeof row.title!=='string'||!row.title.trim())invalid();
  const location=(row.locations||[]).map(l=>[l.country,l.provinceName,l.cityName].filter(Boolean).join(' · ')).join('、')||'未注明';
  const detail=[row.description,row.requirement].filter(s=>typeof s==='string'&&s.trim()).join('\n\n任职要求\n');
  const description=detail||[`官网公开职位：${row.title}`,`工作地点：${location}`,row.commitment?`工作性质：${row.commitment}`:'',row.zhineng?.name?`岗位类别：${row.zhineng.name}`:'','官网列表未提供完整职责和要求，请查看岗位原文。'].filter(Boolean).join('\n');
  const job=normalizeJob({id:row.id,title:row.title,description,location,updated_at:row.publishedAt||row.updatedAt,
    url:`${site.origin}/social-recruitment/${site.org}/${site.site}#/job/${encodeURIComponent(row.id)}`},source);
  return {...job,track:row.showIsCampus?'campus':'experienced',sourceKind:'synced',verificationStatus:'official',
    descriptionKind:detail?'full':'summary',companyId:source.slug};
}

export async function fetchMokaJobs(input,{fetcher=fetch}={}) {
  const site=SITES[input?.slug];if(!site)return null;
  const source=officialSource(input.slug),overall=AbortSignal.timeout(180000),cookies=new Map();
  const path=`/social-recruitment/${site.org}/${site.site}`,home=site.origin+path;
  const request=async(url,body)=>{
    const headers={...(cookies.size?{Cookie:[...cookies].map(([k,v])=>`${k}=${v}`).join('; ')}:{}),
      ...(body===undefined?{}:{'Content-Type':'application/json',Origin:site.origin,Referer:home})};
    const response=await fetcher(url,{method:body===undefined?'GET':'POST',headers,
      ...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:'manual',signal:AbortSignal.any([overall,AbortSignal.timeout(20000)])});
    for(const raw of response.headers.getSetCookie()){
      const pair=raw.split(';')[0],index=pair.indexOf('=');
      if(index>0&&!/[\r\n]/.test(pair))cookies.set(pair.slice(0,index),pair.slice(index+1));
    }
    return response;
  };
  let bootstrap,url=home;
  for(let i=0;i<3;i++){
    const response=await request(url);
    if([301,302,303,307,308].includes(response.status)){
      const destination=new URL(response.headers.get('location'),url);
      if(destination.origin!==site.origin||![path,path+'/'].includes(destination.pathname)||destination.search||destination.hash)throw new Error('官网跳转至未核验地址，已保留上次岗位。');
      url=destination.href;continue;
    }
    const html=await readText(response),match=html.match(/<input\b[^>]*\bid="init-data"[^>]*\bvalue="([^"]+)"/);
    if(!match)invalid();
    bootstrap=JSON.parse(decodeAttribute(match[1]));break;
  }
  if(!bootstrap||bootstrap.org?.id!==site.org||Number(bootstrap.siteId)!==site.site)invalid();
  const rows=[],seenPages=new Set(),allIds=new Set(),pausedIds=new Set();let first,total,changed=false;
  for(let offset=0,page=0;page<300;page++){
    const response=await request(site.origin+'/api/outer/ats-apply/website/jobs/v2',{orgId:site.org,siteId:site.site,limit:30,offset,needStat:true,site:'social',locale:'zh-CN'});
    const data=decodePayload(await readJson(response),bootstrap.aesIv);
    if(![0,200].includes(data?.code)||!Array.isArray(data.data?.jobs)||data.data.jobStats?.orgId!==site.org)invalid();
    const current=data.data.jobStats.total,batch=data.data.jobs;
    if(!Number.isSafeInteger(current)||current<0||current>9000||batch.length>30)invalid();
    first??=current;total=Math.max(total||0,current);changed||=first!==current;
    if(!batch.length&&offset<total)invalid();
    const signature=batch.map(r=>r.id).join(',');
    if(seenPages.has(signature))throw new Error('官网重复返回同一页，已保留上次岗位。');
    seenPages.add(signature);
    for(const row of batch){
      if(row.orgId!==site.org||!row.id||!['open','pause','closed'].includes(row.status))invalid();
      allIds.add(row.id);
      if(row.status==='open')rows.push(normalize(source,site,row));else pausedIds.add(row.id);
    }
    offset+=batch.length;
    if(offset>=total){
      const jobs=[...new Map(rows.map(row=>[row.id,row])).values()],complete=!changed&&allIds.size===total;
      return {jobs,total,complete,note:'已读取官网社会招聘职位摘要，完整职责和要求见岗位原文；不代表校招职位全量。'+(pausedIds.size?`已排除 ${pausedIds.size} 条官网标记暂停或关闭的职位。`:'')+(complete?'':'同步期间列表有变化或重叠，已保留未读取的历史岗位。')};
    }
  }
  throw new Error('官网分页超过读取上限，已保留上次岗位。');
}
