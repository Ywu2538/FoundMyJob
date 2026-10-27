import {profileFocusField} from './profile-track.js';
export const GENERATION_COST = 20;
export const STORAGE_KEY = 'foundmyjob:demo:v1';
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const uid = () => globalThis.crypto.randomUUID();
export function profileSearchScope(profile={}) {
  if(['domestic','overseas','all'].includes(profile.searchScope))return profile.searchScope;
  return profile.market==='cn'?'domestic':profile.market?'overseas':'all';
}
export function defaultJobFilters() {
  return {query:'',company:'',region:'',track:'',work:'',sourceKind:'',sort:'match',targetOnly:false,savedOnly:false,pageSize:25,limit:25};
}
export function discoveryGroups(profile) {
  const scope=profileSearchScope(profile);
  return scope==='all'?['domestic','overseas']:[scope];
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
  const fields=['name','email','location','target','education',profileFocusField(p.track),'preferences'];
  return Math.round((fields.filter(k=>p[k]?.trim()).length+(p.skills.length?1:0))/8*100);
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
export function matchesTarget(job, target='') {
  const text=target.trim();
  if(!text)return true;
  const families=roleFamilies.filter(pattern=>pattern.test(text));
  if(families.length)return families.some(pattern=>pattern.test(job.title||''));
  return (job.title||'').toLowerCase().includes(text.toLowerCase());
}
export function matchJob(job, profile) {
  const skills = profile.skills.map(s=>s.toLowerCase().trim());
  const matched = job.tags.filter(tag=>skills.includes(tag.toLowerCase()));
  const missing = job.tags.filter(tag=>!skills.includes(tag.toLowerCase()));
  const sameTrack = job.track === profile.track;
  const text = (profile.target || '').toLowerCase();
  const targetCategory=/数据|data/.test(text)?'数据':/设计|design/.test(text)?'设计':/产品|product/.test(text)?'产品':/研发|开发|软件|software|engineer|developer/.test(text)?'研发':null;
  const role = job.title && text ? matchesTarget(job,profile.target) : job.category===targetCategory;
  const score = Math.min(text&&!role?40:98, Math.round((job.tags.length?matched.length/job.tags.length*70:0) + (sameTrack?15:0) + (role?13:0)));
  return { score, matched, missing, sameTrack, role };
}
// Country inference is a search aid; unknown or remote-only locations stay unknown.
export function jobMarkets(job) {
  if(job.market)return [job.market];
  const location=job.location||'',markets=[];
  if(/\b(?:China|Shanghai|Beijing|Shenzhen|Guangzhou|Hangzhou|Chengdu|Wuhan|Nanjing|Suzhou|Xian|Xi'an|Dongguan|Tianjin|Chongqing)\b|中国|上海|北京|深圳|广州|杭州|成都|武汉|南京|苏州|西安|东莞|天津|重庆/i.test(location))markets.push('cn');
  if(/\b(?:Canada|Toronto|Vancouver|Montreal|Montréal|Ottawa|Calgary|Waterloo|Mississauga|Edmonton|Quebec|Québec|Winnipeg|Halifax)\b|加拿大|多伦多|温哥华/i.test(location))markets.push('ca');
  if(/\b(?:United States|USA|US|New York|San Francisco|Seattle|Chicago|Austin|Boston|Los Angeles|NYC)\b|美国/i.test(location))markets.push('us');
  if(/\b(?:Singapore|London|United Kingdom|UK|Amsterdam|Netherlands|Dublin|Ireland|Sydney|Australia|Tokyo|Japan|Seoul|Korea|India|Mumbai|Bengaluru|Gurugram|Gurgaon|Paris|France|Berlin|Germany|Warsaw|Poland|Zurich|Switzerland|Dubai|UAE|Hanoi|Vietnam|Aarhus|Denmark|Brazil|Israel|Cayman Islands|Grand Cayman|New Zealand|Europe)\b|新加坡|英国|伦敦|荷兰|澳大利亚|日本|印度|德国|法国|丹麦|巴西|以色列|新西兰|欧洲/i.test(location))markets.push('overseas');
  if(!markets.length&&job.region==='cn')markets.push('cn');
  return markets;
}
export function jobInRegion(job,region) {
  if(!region)return true;
  const markets=jobMarkets(job);
  if(region==='overseas')return markets.some(m=>['ca','us','overseas'].includes(m))||job.region==='na';
  if(region==='na')return job.region==='na'||markets.some(m=>m==='ca'||m==='us');
  if(region==='other')return job.region==='other'&&!markets.some(m=>['cn','ca','us'].includes(m));
  return markets.includes(region);
}
export function filterJobs(jobs, profile, filters={}) {
  const query = (filters.query || '').trim().toLowerCase();
  return jobs.filter(j => (!filters.company||j.company===filters.company) && (!query || [j.title,j.company,j.location,...j.tags].join(' ').toLowerCase().includes(query)) && jobInRegion(j,filters.region) && (!filters.targetOnly || matchesTarget(j,profile.target)) && (!filters.sourceKind || jobSourceKind(j)===filters.sourceKind) && (!filters.track || j.track===filters.track) && (!filters.work || j.work===filters.work) && (!filters.savedOnly || filters.saved?.includes(j.id))).sort((a,b)=> filters.sort==='new' ? (Date.parse(b.syncedAt)||0)-(Date.parse(a.syncedAt)||0)||a.age-b.age : matchJob(b,profile).score-matchJob(a,profile).score);
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
export function markdownToHtml(markdown) {
  return markdown.split('\n').map(line=>{
    if (line.startsWith('## ')) return `<h2>${escapeHtml(line.slice(3))}</h2>`;
    if (line.startsWith('# ')) return `<h1>${escapeHtml(line.slice(2))}</h1>`;
    if (/^[-*] /.test(line)) return `<p class="resume-bullet">• ${escapeHtml(line.slice(2))}</p>`;
    return line.trim() ? `<p>${escapeHtml(line)}</p>` : '';
  }).join('');
}
