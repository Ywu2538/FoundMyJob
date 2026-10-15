import {createHash,publicEncrypt,constants,randomBytes} from 'node:crypto';
import {normalizeJob,readJson} from './jobs.mjs';
import {officialSource} from './company-sources.mjs';
const BASE='https://job.10086.cn';
const invalid=()=>{throw new Error('中国移动官网职位数据格式改变，已保留上次岗位。');};
export async function fetchMobileJobs(input,{fetcher=fetch}={}){
 if(input.slug!=='mobile')return null;
 const source=officialSource(input.slug),overall=AbortSignal.timeout(180000);
 const request=(url,options={})=>fetcher(url,{...options,headers:{'User-Agent':'Mozilla/5.0',Referer:BASE+'/personal/job/',...options.headers},redirect:'error',signal:AbortSignal.any([overall,AbortSignal.timeout(18000)])});
 const response=await request(BASE+'/js/jsencrypt.min.js');
 if(!response.ok)throw new Error(`中国移动官网返回 HTTP ${response.status}。`);
 const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;if(size>1000000)invalid();chunks.push(chunk);}
 const key=Buffer.concat(chunks).toString('utf8').match(/\.pbkey="([A-Za-z0-9+/=]{200,1000})"/)?.[1];if(!key)invalid();
 // The public site creates a fresh random request nonce and encrypts it with
 // its published RSA public key. No login, user token or private key is used.
 const rows=[],pages=new Set();let first,total,changed=false;
 for(let page=1;page<=300;page++){
  const nonce=randomBytes(5).toString('hex'),timestamp=Date.now();
  const digest=Buffer.from(createHash('md5').update(timestamp+nonce).digest('hex')).toString('base64')+';'+publicEncrypt({key:'-----BEGIN PUBLIC KEY-----\n'+key+'\n-----END PUBLIC KEY-----',padding:constants.RSA_PKCS1_PADDING},Buffer.from(nonce)).toString('base64');
  const body={serviceName:'searchJobs',header:{version:'1.0',timestamp,digest,conversationId:new Date(timestamp).toISOString().replace(/\D/g,'')+String(randomBytes(4).readUInt32BE()%1000000).padStart(6,'0')},data:{pageNo:page,pageSize:20,key:'',companyId:'',type:'',category:'',subCategory:'',workYear:'',degree:'',publishTime:'',workType:'',workProvince:'',workCity:''}};
  let data=await readJson(await request(BASE+'/job-app/job/searchJobs.do',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));
  if(typeof data==='string')data=JSON.parse(data);
  if(data.code!=='0000'||!Array.isArray(data.data?.jobList)||!Number.isSafeInteger(data.data.total)||data.data.total<0||data.data.total>6000)invalid();
  const current=data.data.total,batch=data.data.jobList;first??=current;total=Math.max(total||0,current);changed||=first!==current;
  const signature=batch.map(r=>r.id).join(',');if(pages.has(signature))throw new Error('中国移动官网重复返回同一页，已保留上次岗位。');pages.add(signature);
  for(const r of batch){
   if(!r.id||!r.name||(r.status!=null&&![1,'1'].includes(r.status)))invalid();
   const location=[r.province,r.city].filter(Boolean).join(' · '),full=!!r.description&&!!r.dutyCondition;
   const description=[r.companyShortName,r.company,r.description||`官网公开职位：${r.name}\n工作地点：${location||'未注明'}\n官网列表未提供完整职责，请查看岗位原文。`,r.dutyCondition].filter(Boolean).join('\n\n');
   rows.push({...normalizeJob({id:r.id,title:r.name,location,description,url:`${BASE}/personal/job/detail.html?id=${encodeURIComponent(r.id)}${String(r.type)==='1'?'&typess=1':''}`,updated_at:r.startTime},source),companyId:source.slug,sourceKind:'synced',verificationStatus:'official',descriptionKind:full?'full':'summary',track:String(r.type)==='2'?'experienced':['1','3'].includes(String(r.type))?'campus':'unknown'});
  }
  if(rows.length>=total){const jobs=[...new Map(rows.map(j=>[j.id,j])).values()],complete=!changed&&jobs.length===total;return {jobs,total,complete,note:'已读取中国移动官网全局职位搜索的公开列表；缺少完整要求的记录标为摘要。'+(complete?'':'同步期间列表变化或重叠，已保留未读取的历史岗位。')};}
  if(!batch.length)invalid();
 }
 throw new Error('中国移动官网分页超过读取限制。');
}
