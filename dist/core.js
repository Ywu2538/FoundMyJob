import {OVERSEAS_COMPANIES,companyKey,companyNames,matchesCompany,inCollection} from './company-catalog.js';
import {resolvedJobPreferences,preferenceRegion,jobInCity,jobInWork,WORK_PREFERENCES} from './job-preferences.js';
import {profileFocusField} from './profile-track.js';
import {renderResumeMarkdown} from './resume-markdown.js';
export const GENERATION_COST = 20;
export const STORAGE_KEY = 'foundmyjob:demo:v1';
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const uid = () => globalThis.crypto.randomUUID();
export function profileSearchScope(profile={}) {
  const {country}=resolvedJobPreferences(profile);
  if(country)return country==='cn'?'domestic':'overseas';
  if(['domestic','overseas','all'].includes(profile.searchScope))return profile.searchScope;
  return profile.market==='cn'?'domestic':profile.market?'overseas':'all';
}
export function defaultJobFilters() {
  return {query:'',company:'',region:'',city:'',companyCountry:'',companyCategory:'',track:'',work:'',workUnknown:true,sourceKind:'',sort:'match',targetOnly:false,savedOnly:false,pageSize:25,limit:25};
}
export function profileJobFilters(profile={}){
  const prefs=resolvedJobPreferences(profile),region=preferenceRegion(profile);
  return {...defaultJobFilters(),region,city:prefs.city,work:WORK_PREFERENCES[prefs.work]?.[0]||'',companyCountry:['ca','us','jp','gb','fr','au','sg'].includes(region)?region:''};
}
export const profileSearchSignature=profile=>JSON.stringify([profileSearchScope(profile),resolvedJobPreferences(profile),profile.market]);
export function discoveryGroups(profile) {
  const scope=profileSearchScope(profile);
  return scope==='all'?['domestic','overseas']:[scope];
}
// Directory groups describe the company collection, not each job's location.
export function companyDiscoveryGroups(sources,profile,filters={}) {
  const matches=(source,entry)=>(entry.id&&source.id===entry.id)||matchesCompany(entry,source.company);
  const companies=new Map();
  for(const source of sources){
    const entry=OVERSEAS_COMPANIES.find(item=>matches(source,item));
    if(!source.featured&&!entry)continue;
    const company={...entry,...source,company:entry?.company||source.company,aliases:[...(entry?.aliases||[]),source.company],careersUrl:source.careersUrl||entry?.careersUrl,directoryScope:source.directoryScope||(entry?'overseas':'domestic'),sourceId:source.id};
    companies.set(companyKey(company.company),company);
  }
  for(const entry of OVERSEAS_COMPANIES)if(![...companies.values()].some(company=>matches(company,entry)))companies.set(companyKey(entry.company),{...entry,sourceId:null});
  return discoveryGroups(profile).map(scope=>({scope,companies:[...companies.values()].filter(company=>company.directoryScope===scope&&(scope==='domestic'?!filters.country&&!filters.category:inCollection(company,filters)))})).filter(group=>group.companies.length);
}
export function directoryJobFilters(sources,profile,filters={}) {
  // A location filter must also retain jobs from employers outside the curated directory.
  if(!filters.companyCategory)return {...filters,region:filters.companyCountry||filters.region};
  const companies=companyDiscoveryGroups(sources,profile,{country:filters.companyCountry,category:filters.companyCategory}).flatMap(group=>group.companies.flatMap(companyNames));
  return {...filters,companies,region:filters.companyCountry||filters.region};
}
export function jobSourceKind(job) {
  return job.sourceKind||(job.source==='manual'?'manual':'synced');
}

export function initialState(profile) {
  return { version:1, profile:structuredClone(profile), saved:['j1','j3'], resumes:[], applications:[], credits:200, transactions:[{id:'welcome',type:'gift',amount:200,label:'欢迎体验 · 演示积分',date:new Date().toISOString()}], settings:{language:'zh', model:'auto', provider:'demo'} };
}
export function validateState(state) {
  if (!state || state.version !== 1 || !state.profile || !Array.isArray(state.profile.skills) || !Array.isArray(state.saved) || !Array.isArray(state.resumes) || !Array.isArray(state.applications) || !Array.isArray(state.transactions) || !Number.isSafeInteger(state.credits) || state.credits < 0 || !state.settings) throw new Error('本地数据格式不正确。');
  const assert=condition=>{if(!condition)throw new Error('本地数据格式不正确，请导入有效备份或重置演示。');};
  const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(id);
  const validJob=id=>typeof id==='string'&&/^j(?:[1-9]|1[0-2])$/.test(id);
  for(const key of ['name','email','phone','location','target','education','experience','projects','preferences'])assert(typeof state.profile[key]==='string'&&state.profile[key].length<=20000);
  assert(state.profile.skills.length<=50&&state.profile.skills.every(s=>typeof s==='string'&&s.length<=1000));
  assert(['campus','experienced'].includes(state.profile.track));
  assert(state.saved.every(validJob)&&new Set(state.saved).size===state.saved.length);
  assert(state.resumes.length<=500&&state.resumes.every(r=>validId(r.id)&&validJob(r.jobId)&&typeof r.title==='string'&&typeof r.content==='string'&&r.content.length<=40000&&Array.isArray(r.notes)&&r.notes.every(n=>typeof n==='string')&&['draft','reviewed'].includes(r.status)&&['zh','en'].includes(r.language)&&Number.isFinite(Date.parse(r.createdAt))));
  assert(state.applications.length<=12&&state.applications.every(a=>validId(a.id)&&validJob(a.jobId)&&['准备中','已投递','面试中','已结束'].includes(a.status)));
  assert(state.transactions.length<=2000&&state.transactions.every(t=>validId(t.id)&&typeof t.label==='string'&&Number.isSafeInteger(t.amount)&&Number.isFinite(Date.parse(t.date))));
  assert(['zh','en'].includes(state.settings.language));
  return state;
}
export function profileCompletion(p) {
  const prefs=resolvedJobPreferences(p),hasPreferences=!!p.preferences?.trim()||Object.values(prefs).some(Boolean);
  const fields=['name','email','location','target','education',profileFocusField(p.track)];
  return Math.round((fields.filter(k=>p[k]?.trim()).length+(hasPreferences?1:0)+(p.skills.length?1:0))/8*100);
}
// Match job titles, not incidental mentions of tools in a job description.
const roleFamilies = [
  /数据分析|數據分析|data\s*analyst|data\s*analytics|business\s*intelligence|\bbi\s*analyst\b/i,
  /商业分析|商業分析|业务分析|business\s*analyst|business\s*analytics/i,
  /数据工程|大数据开发|数据开发|数据仓库|数仓|data\s*engineer|data\s*warehouse/i,
  /数据科学|data\s*scien(?:tist|ce)/i,
  /软件|软件开发师|software\s*(?:engineer|developer)|开发工程师/i,
  /产品设计|product\s*design|\bux\b|\bui\b|用户体验/i,
];
// Only expand whole role names; preserve qualifiers such as Senior, Python or a company.
// Both official searches and local filtering use these same bilingual aliases.
const searchRoles = [
  ['data engineer', /^(?:data\s+engineer(?:s|ing)?|data\s+warehouse(?:\s+engineer)?|数据工程(?:师)?|數據工程(?:師)?|(?:大数据|数据)开发(?:工程师)?|大数据(?:工程师)?|数仓(?:工程师)?|数据仓库(?:工程师)?)$/i],
  ['data analyst', /^(?:data\s+analyst(?:s)?|data\s+analytics|数据分析(?:师)?|數據分析(?:師)?)$/i],
  ['data scientist', /^(?:data\s+scien(?:tist|ce)|数据科学(?:家|工程师)?)$/i],
  ['software engineer', /^(?:software\s+(?:engineer|developer)|软件(?:开发)?(?:工程师)?|软件开发师|开发工程师)$/i],
  ['business analyst', /^(?:business\s+analyst|商业分析(?:师)?|业务分析(?:师)?)$/i],
  ['product manager', /^(?:product\s+manager|产品经理)$/i],
  ['designer', /^(?:designer|设计师|设计)$/i],
];
const searchRole = query => searchRoles.find(([,pattern])=>pattern.test(query.trim()))?.[0];
export const canonicalSearchQuery = query => searchRole(query)||query.trim();
export function matchesJobQuery(job, query='') {
  const text=query.trim().replace(/\s+/g,' ').toLowerCase();
  if(!text)return true;
  if([job.title,job.company,job.location,...(job.tags||[])].join(' ').toLowerCase().includes(text))return true;
  const role=searchRole(text);
  return !!role&&matchesTarget(job,role);
}
export function matchesTarget(job, target='') {
  const text=target.trim();
  if(!text)return true;
  const families=roleFamilies.filter(pattern=>pattern.test(text));
  if(families.length)return families.some(pattern=>pattern.test(job.title||''));
  return (job.title||'').toLowerCase().includes(text.toLowerCase());
}
export function matchJob(job, profile) {
  const skills = (profile.skills||[]).map(s=>s.toLowerCase().trim()),tags=job.tags||[];
  const matched = [...new Set(tags.filter(tag=>skills.includes(tag.toLowerCase())))];
  const missing = tags.filter(tag=>!skills.includes(tag.toLowerCase()));
  const sameTrack = job.track === profile.track;
  const text = (profile.target || '').toLowerCase();
  const targetCategory=/数据|data/.test(text)?'数据':/设计|design/.test(text)?'设计':/产品|product/.test(text)?'产品':/研发|开发|软件|software|engineer|developer/.test(text)?'研发':null;
  const role = job.title && text ? matchesTarget(job,profile.target) : job.category===targetCategory;
  const score = Math.min(text&&!role?40:98, Math.round((tags.length?matched.length/tags.length*70:0) + (sameTrack?15:0) + (role?13:0)));
  return { score, matched, missing, sameTrack, role };
}
// Country inference is a search aid; unknown or remote-only locations stay unknown.
export function jobMarkets(job) {
  if(['cn','ca','us','jp','gb','fr','au','sg'].includes(job.market))return [job.market];
  const location=job.location||'',markets=[];
  if(/\b(?:China|Shanghai|Beijing|Shenzhen|Guangzhou|Hangzhou|Chengdu|Wuhan|Nanjing|Suzhou|Xian|Xi'an|Dongguan|Tianjin|Chongqing)\b|中国|上海|北京|深圳|广州|杭州|成都|武汉|南京|苏州|西安|东莞|天津|重庆/i.test(location))markets.push('cn');
  if(/\b(?:Canada|Toronto|Vancouver|Montreal|Montréal|Ottawa|Calgary|Waterloo|Mississauga|Edmonton|Quebec|Québec|Winnipeg|Halifax)\b|加拿大|多伦多|温哥华/i.test(location))markets.push('ca');
  if(/\b(?:United States|USA|US|New York|San Francisco|Seattle|Chicago|Austin|Boston|Los Angeles|NYC)\b|美国/i.test(location))markets.push('us');
  if(/\b(?:Japan|Tokyo|Osaka|Kyoto|Yokohama|Nagoya|Fukuoka)\b|日本|東京|东京|大阪|京都/i.test(location))markets.push('jp');
  if(/\b(?:United Kingdom|UK|Great Britain|England|Scotland|Wales|Edinburgh|Manchester|Birmingham|Bristol|Belfast)\b|英国|英國|爱丁堡/i.test(location)||(/\bLondon\b|伦敦/i.test(location)&&!markets.includes('ca')&&!/Ontario|加拿大|安大略/i.test(location)))markets.push('gb');
  if(/\b(?:France|Lyon|Toulouse|Marseille|Grenoble|Bordeaux)\b|法国|法國|巴黎/i.test(location)||(/\bParis\b/i.test(location)&&!/Texas|\bTX\b|Ontario|Canada|United States/i.test(location)))markets.push('fr');
  if(/\b(?:Australia|Sydney|Melbourne|Brisbane|Perth|Adelaide|Canberra)\b|澳大利亚|澳洲|悉尼|墨尔本/i.test(location))markets.push('au');
  if(/\bSingapore\b|新加坡/i.test(location))markets.push('sg');
  if(/\b(?:Singapore|London|United Kingdom|UK|Amsterdam|Netherlands|Dublin|Ireland|Sydney|Australia|Tokyo|Japan|Seoul|Korea|India|Mumbai|Bengaluru|Gurugram|Gurgaon|Paris|France|Berlin|Germany|Warsaw|Poland|Zurich|Switzerland|Dubai|UAE|Hanoi|Vietnam|Aarhus|Denmark|Brazil|Israel|Cayman Islands|Grand Cayman|New Zealand|Europe)\b|新加坡|英国|伦敦|荷兰|澳大利亚|日本|印度|德国|法国|丹麦|巴西|以色列|新西兰|欧洲/i.test(location))markets.push('overseas');
  if(!markets.length&&['cn','ca','us','jp','gb','fr','au','sg'].includes(job.region))markets.push(job.region);
  return markets;
}
export function jobInRegion(job,region) {
  if(!region)return true;
  const markets=jobMarkets(job);
  if(region==='overseas')return markets.some(m=>['ca','us','jp','gb','fr','au','sg','overseas'].includes(m))||job.region==='na';
  if(region==='na')return job.region==='na'||markets.some(m=>m==='ca'||m==='us');
  if(region==='other')return job.region==='other'&&!markets.some(m=>['cn','ca','us','jp','gb','fr','au','sg'].includes(m));
  return markets.includes(region);
}
export function filterJobs(jobs, profile, filters={}) {
  const query = filters.query || '';
  const selected=OVERSEAS_COMPANIES.find(company=>matchesCompany(company,filters.company));
  const allowed=filters.companies&&new Set(filters.companies.map(companyKey));
  // Cache within this search only: sorting compares the same job many times.
  const fits=new Map();
  const fit=job=>{if(!fits.has(job))fits.set(job,matchJob(job,profile));return fits.get(job);};
  const byMatch=(a,b)=>{const left=fit(a),right=fit(b);return Number(right.role)-Number(left.role)||right.score-left.score;};
  return jobs.filter(j => (!filters.company||(selected?matchesCompany(selected,j.company):j.company===filters.company)) && (!allowed||allowed.has(companyKey(j.company))) && matchesJobQuery(j,query) && jobInRegion(j,filters.region) && jobInCity(j,filters.city,filters.region) && (!filters.targetOnly || matchesTarget(j,profile.target)) && (!filters.sourceKind || jobSourceKind(j)===filters.sourceKind) && (!filters.track || j.track===filters.track) && jobInWork(j,filters.work,filters.workUnknown) && (!filters.savedOnly || filters.saved?.includes(j.id))).sort((a,b)=> filters.sort==='new' ? (Date.parse(b.syncedAt)||0)-(Date.parse(a.syncedAt)||0)||a.age-b.age : byMatch(a,b));
}
export function companyJobMatches(jobs,profile,companies,filters={}){
  const allowed=new Set(companies.flatMap(companyNames).map(companyKey));
  const candidates=filterJobs(jobs.filter(job=>job.active&&allowed.has(companyKey(job.company))),profile,{...filters,company:'',targetOnly:false,savedOnly:false,sort:'match'});
  const matches=candidates.filter(job=>{
    const fit=matchJob(job,profile);
    return (!!profile.target?.trim()&&matchesTarget(job,profile.target))||fit.matched.length>=2;
  });
  return {total:matches.length,jobs:matches.slice(0,10),matches};
}
export function companyJobRecommendations(jobs,profile,companies,filters={}){
  const exact=companyJobMatches(jobs,profile,companies,filters);
  const alternatives=filters.work?companyJobMatches(jobs,profile,companies,{...filters,work:''}).matches.filter(job=>!jobInWork(job,filters.work,filters.workUnknown)):[];
  return {...exact,alternativeTotal:alternatives.length,alternatives:alternatives.slice(0,Math.max(0,10-exact.jobs.length))};
}
export function discoverySummary(jobs,profile,filters={}) {
  const active=jobs.filter(j=>j.active);
  const results=filterJobs(filters.savedOnly?jobs:active,profile,filters);
  return {active:active.length,archived:jobs.length-active.length,synced:active.filter(j=>jobSourceKind(j)==='synced').length,pending:active.filter(j=>jobSourceKind(j)==='discovered').length,manual:active.filter(j=>jobSourceKind(j)==='manual').length,region:active.filter(j=>jobInRegion(j,filters.region)).length,companies:new Set(active.map(j=>j.company)).size,results,visible:Math.min(results.length,filters.limit??results.length)};
}
export function makeDemoResume(profile, job, language='zh') {
  if (!profile.name?.trim() || !profile.education?.trim() || (!profile.experience?.trim() && !profile.projects?.trim())) throw new Error('请先填写姓名、教育经历，以及至少一项工作经历或项目经历。');
  const english = language==='en';
  const fit = matchJob(job,profile);
  const orderedSkills = [...fit.matched,...profile.skills.filter(s=>!fit.matched.includes(s))];
  const parts = [
    `# ${profile.name}`,
    [profile.email,profile.phone,profile.location].filter(Boolean).join(' · '),
    `## ${english?'Target role':'求职意向'}\n${job.title} · ${job.company}`,
    `## ${english?'Skills':'专业技能'}\n${orderedSkills.join(' · ')}`,
    `## ${english?'Education':'教育经历'}\n${profile.education}`,
    profile.experience && `## ${english?'Experience':'工作与实习经历'}\n${profile.experience}`,
    profile.projects && `## ${english?'Projects':'项目经历'}\n${profile.projects}`,
  ];
  const notes = ['演示版本使用规则整理档案并优先排列相关技能，未调用 AI，也未新增任何经历。', ...fit.missing.map(s=>`岗位提到「${s}」，档案中尚无对应技能。确认有真实经验后再补充。`), ...(!fit.sameTrack?['该岗位的校招／社招类型与当前档案不同，请核实年限与资格要求。']:[]), ...(english?['英文演示仅切换栏目标题，保留原始经历语言；真实英文改写需要连接模型。']:[])];
  return { id:uid(), jobId:job.id, title:`${job.company} · ${job.title}`, content:parts.filter(Boolean).join('\n\n'), language, status:'draft', reviewedAt:null, createdAt:new Date().toISOString(), notes, mode:'demo' };
}
export function chargeGeneration(state, resume) {
  if (state.credits < GENERATION_COST) throw new Error('演示积分不足，请到「积分与套餐」体验充值。');
  if (state.resumes.some(r=>r.id===resume.id)) return state;
  return { ...state, credits:state.credits-GENERATION_COST, resumes:[resume,...state.resumes], transactions:[{id:uid(),type:'generation',amount:-GENERATION_COST,label:resume.title,date:new Date().toISOString()},...state.transactions] };
}
export function topUp(state, plan) {
  if (!Number.isSafeInteger(plan.credits) || plan.credits <= 0) throw new Error('积分套餐无效。');
  return {...state,credits:state.credits+plan.credits,transactions:[{id:uid(),type:'topup',amount:plan.credits,label:`${plan.name} · 模拟充值（未付款）`,date:new Date().toISOString()},...state.transactions]};
}
export function editResume(resume, content) {
  if (!content.trim()) throw new Error('简历内容不能为空。');
  return { ...resume, content, status:'draft', reviewedAt:null };
}
export function markdownToHtml(markdown,layout='classic') {
  return renderResumeMarkdown(markdown,layout);
}
