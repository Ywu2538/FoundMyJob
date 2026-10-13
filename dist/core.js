export const GENERATION_COST = 20;
export const STORAGE_KEY = 'foundmyjob:demo:v1';
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const uid = () => globalThis.crypto.randomUUID();

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
  return Math.round(['name','email','location','target','education','experience','projects','preferences'].filter(k=>p[k]?.trim()).length/9*100 + (p.skills.length ? 100/9 : 0));
}
export function matchJob(job, profile) {
  const skills = profile.skills.map(s=>s.toLowerCase().trim());
  const matched = job.tags.filter(tag=>skills.includes(tag.toLowerCase()));
  const missing = job.tags.filter(tag=>!skills.includes(tag.toLowerCase()));
  const sameTrack = job.track === profile.track;
  const text = (profile.target || '').toLowerCase();
  const role = (job.category==='设计' && /设计|design/.test(text)) || (job.category==='产品' && /产品|product/.test(text)) || (job.category==='数据' && /数据|data/.test(text)) || (job.category==='研发' && /研发|开发|engineer/.test(text));
  const score = Math.min(98, Math.round((job.tags.length?matched.length/job.tags.length*70:0) + (sameTrack?15:0) + (role?13:0)));
  return { score, matched, missing, sameTrack };
}
export function filterJobs(jobs, profile, filters={}) {
  const query = (filters.query || '').trim().toLowerCase();
  return jobs.filter(j => (!query || [j.title,j.company,j.location,...j.tags].join(' ').toLowerCase().includes(query)) && (!filters.region || j.region===filters.region) && (!filters.track || j.track===filters.track) && (!filters.work || j.work===filters.work) && (!filters.savedOnly || filters.saved?.includes(j.id))).sort((a,b)=> filters.sort==='new' ? (Date.parse(b.syncedAt)||0)-(Date.parse(a.syncedAt)||0)||a.age-b.age : matchJob(b,profile).score-matchJob(a,profile).score);
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
