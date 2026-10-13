import { randomUUID } from 'node:crypto';

export function cleanText(value) {
  let s=String(value||'');
  for(let i=0;i<2;i++)s=s.replace(/&(?:amp|lt|gt|quot|apos|nbsp);|&#(?:x[0-9a-f]+|\d+);/gi,m=>{const named={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' '};if(named[m])return named[m];const n=m[2].toLowerCase()==='x'?parseInt(m.slice(3),16):parseInt(m.slice(2),10);return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';});
  return s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<\/(p|div|li|h[1-6])>|<br\s*\/?\s*>/gi,'\n').replace(/<[^>]+>/g,'').replace(/[ \t]+/g,' ').replace(/\n\s*\n/g,'\n\n').trim();
}
export function safeUrl(value) {try {const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)throw 0;return u.href;}catch{throw new Error('请填写有效的 HTTPS 岗位原文链接。');}}
export function normalizeJob(raw,source) {
  const location=cleanText(raw.location?.name||raw.categories?.location||raw.location||'未注明');
  const title=cleanText(raw.title||raw.text);
  const description=cleanText(raw.content||raw.descriptionPlain||raw.description||'').slice(0,24000);
  const tags=['Python','SQL','JavaScript','TypeScript','React','Java','C++','Figma','Excel','Tableau','AWS','Kubernetes','Linux','用户研究','数据分析'].filter(t=>new RegExp(`(^|[^a-z])${t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}([^a-z]|$)`,'i').test(description));
  const track=/intern|graduate|new grad|campus|校招|应届|实习/i.test(title)?'campus':/senior|staff|lead|principal|experienced|资深|高级/i.test(title)?'experienced':'unknown';
  const region=/China|Shanghai|Beijing|Shenzhen|Guangzhou|中国|上海|北京|深圳/i.test(location)?'cn':/United States|USA|Canada|Toronto|Vancouver|Montreal|New York|San Francisco|Seattle|Chicago|Austin|Boston|Los Angeles|US[ ,;/)-]|SF|NYC/i.test(location)?'na':'other';
  return {id:`${source.provider}:${source.slug}:${encodeURIComponent(String(raw.id))}`,title,company:source.company,location,description,requirements:[],tags,track,region,category:/design|设计/i.test(title)?'设计':/product|产品/i.test(title)?'产品':/data|数据/i.test(title)?'数据':/engineer|developer|研发/i.test(title)?'研发':'其他',work:raw.workplaceType==='remote'||/^remote$/i.test(location)?'远程办公':raw.workplaceType==='hybrid'?'混合办公':'未注明',salary:'以岗位原文为准',currency:'',url:safeUrl(raw.absolute_url||raw.hostedUrl||raw.url),source:source.id,sourceName:source.company,sourceUpdatedAt:raw.updated_at||null,syncedAt:new Date().toISOString(),age:0,logo:source.company.slice(0,2),bg:'#eeeafd',color:'#6750c7'};
}
export async function readJson(response,limit=25000000) {
  if(!response.ok)throw new Error(`服务返回 HTTP ${response.status}`);
  const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;if(size>limit)throw new Error('响应内容超过限制。');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export async function fetchJobs(source,{fetcher=fetch}={}) {
  if(!/^[a-zA-Z0-9_-]{1,80}$/.test(source.slug)||!['greenhouse','lever'].includes(source.provider))throw new Error('岗位源格式无效。');
  const url=source.provider==='greenhouse'?`https://boards-api.greenhouse.io/v1/boards/${source.slug}/jobs?content=true`:`https://api.lever.co/v0/postings/${source.slug}?mode=json`;
  const data=await readJson(await fetcher(url,{signal:AbortSignal.timeout(25000),redirect:'error'}));
  const rows=source.provider==='greenhouse'?data.jobs:data;
  if(!Array.isArray(rows)||rows.length>10000)throw new Error('岗位源返回格式异常。');
  return rows.map(r=>normalizeJob(r,source));
}
export function manualJob(input) {
  for(const k of ['title','company','description','location'])if(typeof input[k]!=='string'||!input[k].trim()||input[k].length>(k==='description'?24000:200))throw new Error(`请填写有效的 ${k}。`);
  if(!['cn','na','other'].includes(input.region)||!['campus','experienced','unknown'].includes(input.track))throw new Error('请选择地区和招聘类型。');
  return {...normalizeJob({...input,id:randomUUID()},{provider:'manual',slug:'user',company:input.company,id:'manual'}),region:input.region,track:input.track,sourceName:'手动导入（请核对原文）'};
}
