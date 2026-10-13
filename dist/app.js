import { DEFAULT_PROFILE, JOBS, PLANS } from './data.js';
import { GENERATION_COST, STORAGE_KEY, escapeHtml as e, uid, initialState, validateState, profileCompletion, matchJob, filterJobs, makeDemoResume, chargeGeneration, topUp, editResume, markdownToHtml } from './core.js';

const paths = {
  grid:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  search:'m21 21-4.5-4.5M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0',
  file:'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5',
  briefcase:'M8 7V4h8v3M3 7h18v14H3zM3 12c6 4 12 4 18 0M10 13h4v3h-4z',
  user:'M20 21v-2a7 7 0 0 0-14 0v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  coin:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M9 8h6M9 12h6M12 8v9',
  settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z',
  arrow:'M4 12h16m-6-6 6 6-6 6',
  chevron:'m9 5 7 7-7 7',
  down:'m6 9 6 6 6-6',
  spark:'m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5zM20 2v4M18 4h4',
  bookmark:'M5 3h14v18l-7-4-7 4z',
  pin:'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  clock:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 7v5l3 2',
  check:'m5 12 4 4L19 6',
  close:'m6 6 12 12M6 18 18 6',
  plus:'M12 5v14M5 12h14',
  download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  external:'M14 3h7v7m0-7L10 14M10 3H3v18h18v-7',
  mail:'M3 5h18v14H3zM3 5l9 8 9-8',
  bell:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
  globe:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18',
  shield:'m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6zM8 12l3 3 5-6',
  bolt:'m13 2-9 12h7l-1 8 10-13h-8z',
  edit:'m16 3 5 5-12 12-6 1 1-6zM14 5l5 5',
  menu:'M3 6h18M3 12h18M3 18h18',
  book:'M3 3h7l2 2 2-2h7v17h-7l-2 2-2-2H3zM12 5v17',
  info:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 11v6M12 7v1',
  trash:'M3 6h18M8 6V3h8v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
};
const icon = (name, cls='') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.spark}"/></svg>`;
const $ = s=>document.querySelector(s);
let storageWarning = '';
function readState() {
  try { const data = localStorage.getItem(STORAGE_KEY); return data?validateState(JSON.parse(data)):initialState(DEFAULT_PROFILE); }
  catch { storageWarning = '无法读取本地记录，当前使用临时演示数据。可在设置中导出备份或重置演示。'; return initialState(DEFAULT_PROFILE); }
}
let state = readState();
const routes = {dashboard:'工作台',jobs:'发现岗位',resumes:'我的简历',tracker:'投递追踪',profile:'个人档案',credits:'积分与套餐',settings:'设置'};
const ui = {route:routes[location.hash.slice(1)]?location.hash.slice(1):'jobs',query:'',region:'',track:'',work:'',sort:'match',savedOnly:false,generating:false,modal:null,mobileMenu:false};
async function mutate(fn) {
  const action = ()=> {
    // Re-read within a lock to avoid double spends across tabs.
    const current = storageWarning ? state : readState();
    const next = validateState(fn(structuredClone(current)));
    try { localStorage.setItem(STORAGE_KEY,JSON.stringify(next)); }
    catch { storageWarning = '浏览器存储不可用，修改仅保留在当前页面。请导出备份。'; }
    state=next;
  };
  if(navigator.locks) await navigator.locks.request(STORAGE_KEY,action); else action();
}
const money = n=>n.toLocaleString('zh-CN');
const date = d=>new Date(d).toLocaleDateString('zh-CN',{month:'2-digit',day:'2-digit'});
const jobById = id=>JOBS.find(j=>j.id===id);
function toast(message) { const el=$('#toast'); el.textContent=message; el.classList.add('visible'); clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.classList.remove('visible'),4000); }
function go(route) { if(!routes[route])return; ui.route=route;ui.mobileMenu=false;location.hash=route;render();window.scrollTo(0,0); }
window.addEventListener('hashchange',()=>{if(routes[location.hash.slice(1)]){ui.route=location.hash.slice(1);render();}});
window.addEventListener('storage',event=>{if(event.key===STORAGE_KEY){state=readState();render();}});

function sidebar() {
  return `<aside class="sidebar ${ui.mobileMenu?'is-open':''}">
    <a class="brand" href="#jobs"><img src="/favicon.svg" alt=""/><span>FoundMyJob<span class="brand-dot">.</span></span></a>
    <div class="workspace"><span class="workspace-icon">${icon('briefcase')}</span><div><strong>我的求职空间</strong><small>让每一份努力，更有方向</small></div><span class="workspace-tag">DEMO</span></div>
    <div class="nav-caption">求职旅程</div>
    <nav aria-label="主导航">${[['dashboard','grid'],['jobs','search'],['resumes','file'],['tracker','briefcase']].map(([route,ico])=>navItem(route,ico)).join('')}</nav>
    <div class="nav-divider"></div><div class="nav-caption">个人中心</div>
    <nav aria-label="个人中心">${[['profile','user'],['credits','coin'],['settings','settings']].map(([route,ico])=>navItem(route,ico)).join('')}</nav>
    <div class="sidebar-bottom"><div class="credit-card"><span class="credit-orbit"></span><div class="credit-card-top">${icon('spark')} 给下一站，多一点可能</div><p><b>${money(state.credits)}</b><span>演示积分</span></p><small>每份简历 20 积分 · 仅模拟扣费</small><button class="credit-cta" data-action="nav" data-route="credits">探索积分套餐 ${icon('arrow')}</button></div>
    <button class="sidebar-user" data-action="nav" data-route="profile"><span class="avatar">${e(state.profile.name?.[0]||'你')}</span><span><strong>${e(state.profile.name||'我的档案')}</strong><small>${state.profile.track==='campus'?'校招求职者':'社招求职者'}</small></span>${icon('chevron')}</button></div>
  </aside>`;
}
function navItem(route,ico) {return `<button class="nav-item ${ui.route===route?'active':''}" data-action="nav" data-route="${route}" ${ui.route===route?'aria-current="page"':''}>${icon(ico)}<span>${routes[route]}</span>${route==='jobs'?'<em>12</em>':route==='resumes'&&state.resumes.length?`<em>${state.resumes.length}</em>`:''}</button>`;}
function header() {return `<header class="topbar"><div class="breadcrumb"><button class="icon-button mobile-only" data-action="menu" aria-label="展开导航">${icon('menu')}</button><span>我的求职空间</span>${icon('chevron')}<strong>${routes[ui.route]}</strong></div><div class="topbar-right"><span class="demo-pill"><i></i> 交互演示版</span><button class="icon-button" data-action="notifications" aria-label="查看演示说明">${icon('bell')}<i class="notification-dot"></i></button><button class="avatar small" data-action="nav" data-route="profile" aria-label="打开个人档案">${e(state.profile.name?.[0]||'你')}</button></div></header>`;}
function title(heading,sub,button='') {return `<div class="page-title"><div><div class="eyebrow">YOUR NEXT CHAPTER</div><h1>${heading}</h1><p>${sub}</p></div>${button}</div>`;}
function empty(heading,sub,action='jobs',label='发现适合我的岗位') {return `<div class="empty-state"><span class="empty-icon">${icon('file')}</span><h3>${heading}</h3><p>${sub}</p><button class="button primary" data-action="nav" data-route="${action}">${label}${icon('arrow')}</button></div>`;}
function stat(iconName,label,value,note,tone='purple') {return `<div class="stat"><span class="stat-icon ${tone}">${icon(iconName)}</span><div><span class="stat-label">${label}</span><strong>${value}</strong><small>${note}</small></div></div>`;}

function jobsPage() {
 const jobs=filterJobs(JOBS,state.profile,{...ui,saved:state.saved});
 return `${title('让下一份工作，更适合你。','从你的经历出发，发现机会，准备一份真正属于你的简历。',`<button class="button secondary" data-action="nav" data-route="profile">${icon('user')} 编辑我的档案</button>`)}
 <section class="discovery-banner"><div class="banner-copy"><span class="tiny-pill">${icon('spark')} 每一段经历，都值得被看见</span><h2>好机会，从了解你开始。</h2><p>把你的闪光点，变成下一份工作的起点。<br/>完善档案，解锁更贴合你的岗位推荐。</p><button class="button dark" data-action="nav" data-route="profile">完善求职档案 ${icon('arrow')}</button></div>
 <div class="banner-art" aria-hidden="true"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><span class="art-star star-one">✦</span><span class="art-star star-two">✧</span><div class="floating-label label-one"><span class="art-icon green">${icon('check')}</span>你的经历，刚好匹配</div><div class="art-resume"><div class="art-resume-head"><span class="art-avatar">${icon('user')}</span><span><i></i><i></i></span><b>✦</b></div><div class="art-lines"><i></i><i></i><i></i></div><div class="art-tags"><span>潜力</span><span>热爱</span><span>成长</span></div><div class="art-match">${icon('spark')} 下一站，有更多可能</div></div><div class="floating-label label-two"><span class="art-icon purple">${icon('file')}</span>为每个机会，认真准备</div></div></section>
 <section class="stats-row" aria-label="求职概览">${stat('briefcase','精选示例岗位',JOBS.length,'中国 & 北美','purple')}${stat('user','档案完整度',`${profileCompletion(state.profile)}<span>%</span>`,'越完整，匹配越精准','blue')}${stat('bookmark','已收藏岗位',state.saved.length,'留住每一个心动机会','peach')}${stat('file','专属简历',state.resumes.length,'每一次投递都有准备','green')}</section>
 <section class="job-section"><div class="section-heading"><div class="section-tabs"><button class="section-tab ${!ui.savedOnly?'selected':''}" data-action="saved-filter" data-value="all">为你推荐 <span>${JOBS.length}</span></button><button class="section-tab ${ui.savedOnly?'selected':''}" data-action="saved-filter" data-value="saved">我的收藏 <span>${state.saved.length}</span></button></div><div class="matching-note">${icon('spark')} 根据个人档案计算匹配度</div></div>
 <form class="filter-bar" id="job-search"><label class="search-field">${icon('search')}<input name="query" placeholder="搜索职位、公司或技能…" value="${e(ui.query)}" aria-label="搜索职位、公司或技能"/></label><select name="region" aria-label="岗位地区"><option value="">全部地区</option><option value="cn" ${ui.region==='cn'?'selected':''}>中国大陆</option><option value="na" ${ui.region==='na'?'selected':''}>加拿大 / 美国</option></select><select name="track" aria-label="招聘类型"><option value="">校招 & 社招</option><option value="campus" ${ui.track==='campus'?'selected':''}>校园招聘</option><option value="experienced" ${ui.track==='experienced'?'selected':''}>社会招聘</option></select><select name="work" aria-label="办公方式"><option value="">办公方式</option>${['远程办公','混合办公','现场办公'].map(x=>`<option ${ui.work===x?'selected':''}>${x}</option>`).join('')}</select><button class="button primary" type="submit">${icon('search')} 搜索</button></form>
 <div class="results-line"><span>发现 <b>${jobs.length}</b> 个机会 <span class="muted">· 全部为演示岗位</span></span><label>排序：<select id="job-sort" aria-label="岗位排序"><option value="match" ${ui.sort==='match'?'selected':''}>匹配度优先</option><option value="new" ${ui.sort==='new'?'selected':''}>示例发布顺序</option></select></label></div>
 <div class="jobs-grid">${jobs.length?jobs.map(jobCard).join(''):`<div class="no-results">${icon('search')}<h3>还没有找到符合条件的岗位</h3><p>试试其他关键词，或放宽筛选条件。</p><button class="button secondary" data-action="clear-filters">清除筛选</button></div>`}</div>
 <div class="list-footer"><span class="footer-line"></span><span>好机会值得等待，更值得准备 ${icon('spark')}</span><span class="footer-line"></span></div>
 <p class="data-disclaimer">${icon('info')} 岗位、薪资及招聘要求均为产品演示编写，非实时招聘信息；匹配度为规则计算，不代表录用概率。</p></section>`;
}
function jobCard(j) {
 const fit=matchJob(j,state.profile);const saved=state.saved.includes(j.id);
 return `<article class="job-card"><div class="job-card-top"><span class="company-logo" style="--logo-bg:${j.bg};--logo-color:${j.color}">${e(j.logo)}</span><span class="job-type">${j.track==='campus'?'校招 / 应届':'社会招聘'}</span><button class="icon-button bookmark ${saved?'saved':''}" data-action="save-job" data-id="${j.id}" aria-label="${saved?'取消收藏':'收藏'} ${e(j.title)}" aria-pressed="${saved}">${icon('bookmark')}</button></div><button class="job-title" data-action="job-detail" data-id="${j.id}">${e(j.title)}</button><div class="company-name">${e(j.company)} <span>· ${j.category}</span></div><div class="job-meta"><span>${icon('pin')}${e(j.location)}</span><span>${icon('briefcase')}${j.work}</span></div><div class="salary">${e(j.salary)} <small>${j.currency}</small></div><div class="tags">${j.tags.map(t=>`<span class="${fit.matched.includes(t)?'tag-match':''}">${e(t)}</span>`).join('')}</div><div class="job-card-bottom"><div class="match-label">${icon('spark')}<strong>${fit.score}%</strong><span>匹配度</span></div><button class="job-detail-link" data-action="job-detail" data-id="${j.id}" aria-label="查看 ${e(j.title)} 详情">查看详情 ${icon('arrow')}</button></div></article>`;
}
function dashboardPage() {
 const recommended=filterJobs(JOBS,state.profile).slice(0,3);
 return `${title(`你好，${e(state.profile.name||'求职者')}。`,'你的每一步，都在靠近更合适的下一站。',`<button class="button primary" data-action="nav" data-route="jobs">发现新机会 ${icon('arrow')}</button>`)}<div class="stats-row">${stat('bookmark','收藏机会',state.saved.length,'已经心动的岗位')}${stat('file','已生成简历',state.resumes.length,'逐一为机会做准备','blue')}${stat('check','已审核简历',state.resumes.filter(r=>r.status==='reviewed').length,'可以进入投递流程','green')}${stat('briefcase','投递记录',state.applications.length,'记录你的求职旅程','peach')}</div>
 <section class="panel journey-panel"><div class="section-title"><h2>你的求职路径</h2><span class="muted">一步一步，把机会变成可能</span></div><div class="journey-steps">${[['user','01','建立个人档案','让你的经历成为推荐的起点','profile'],['search','02','发现心动岗位','从中国到北美，找到你的方向','jobs'],['file','03','准备专属简历','围绕岗位要求，突出真实经历','resumes'],['briefcase','04','审核并投递','确认每个细节，再迈出下一步','tracker']].map(([i,n,h,p,r])=>`<button class="journey-step" data-action="nav" data-route="${r}"><span class="step-number">${n}</span>${icon(i)}<h3>${h}</h3><p>${p}</p></button>`).join('')}</div></section>
 <div class="section-title margin-top"><h2>值得关注的机会 <span class="count">${recommended.length}</span></h2><button class="text-button" data-action="nav" data-route="jobs">查看全部 ${icon('arrow')}</button></div><div class="jobs-grid">${recommended.map(jobCard).join('')}</div><p class="data-disclaimer">以上为产品演示岗位，不代表正在招聘。</p>`;
}
function profilePage() {
 const p=state.profile;
 return `${title('让机会，先认识你。','填写真实经历，之后每一份简历都从这里出发。')}<form id="profile-form" class="profile-layout"><div class="profile-form panel"><div class="section-title"><h2>${icon('user')} 基本信息</h2><span class="badge lilac">${profileCompletion(p)}% 已完善</span></div><div class="form-grid"><label>姓名 <span class="required">*</span><input name="name" required maxlength="80" value="${e(p.name)}"/></label><label>联系邮箱 <span class="required">*</span><input name="email" required type="email" maxlength="120" value="${e(p.email)}"/></label><label>所在城市<input name="location" maxlength="120" value="${e(p.location)}"/></label><label>联系电话 <span class="optional">选填</span><input name="phone" maxlength="60" value="${e(p.phone)}" placeholder="用于简历联系方式"/></label><label>求职阶段<select name="track"><option value="campus" ${p.track==='campus'?'selected':''}>校园招聘 / 实习</option><option value="experienced" ${p.track==='experienced'?'selected':''}>社会招聘</option></select></label><label>目标职位<input name="target" maxlength="160" value="${e(p.target)}" placeholder="例如：产品经理 / 数据分析师"/></label></div><div class="form-section"><h2>${icon('bolt')} 专业技能</h2><label><span class="field-help">使用逗号分隔，岗位匹配会参考这些技能</span><input name="skills" maxlength="1000" value="${e(p.skills.join(', '))}" placeholder="Figma, SQL, Python, 用户研究"/></label></div>${[['education','book','教育经历','学校、专业、学位、时间、相关课程'],['experience','briefcase','工作与实习经历','公司、职位、时间，以及你实际承担的职责和成果'],['projects','file','项目经历','项目名称、你的角色、使用的技能和真实成果'],['preferences','globe','求职偏好','期望城市、行业、办公方式或其他条件']].map(([key,ico,label,placeholder])=>`<div class="form-section"><h2>${icon(ico)} ${label}</h2><textarea name="${key}" rows="${key==='preferences'?3:5}" maxlength="12000" ${key==='education'?'required':''} placeholder="${placeholder}" aria-label="${label}">${e(p[key])}</textarea></div>`).join('')}<div class="form-footer"><span>${icon('shield')} 档案保存在当前浏览器</span><button class="button primary" type="submit">${icon('check')} 保存个人档案</button></div></div><aside class="profile-aside"><div class="panel tips-panel"><span class="tip-icon">${icon('spark')}</span><h3>你的经历，就是最好的起点。</h3><p>无需一次写得完美。先记录事实，再为不同岗位选择最相关的内容。</p><ul><li>用清晰的动词说明你做了什么</li><li>写出能够核实的成果或数据</li><li>校招可以突出课程与项目</li><li>社招可以突出职责与工作成果</li></ul></div><div class="notice"><b>当前预填的是示例档案</b><p>展示时可以修改任意字段。请勿把示例经历当作自己的实际经历投递。</p></div><button class="button secondary full-width" type="button" data-action="import-text">${icon('download')} 导入经历文本</button><input type="file" id="profile-file" accept=".txt,.md,text/plain,text/markdown" hidden/></aside></form>`;
}
function resumesPage() {
 return `${title('每个机会，都有专属表达。','从真实经历出发，整理、审核，再安心投递。',`<button class="button primary" data-action="nav" data-route="jobs">${icon('plus')} 为新岗位准备简历</button>`)}${state.resumes.length?`<div class="resume-list">${state.resumes.map(r=>`<article class="resume-card panel"><div class="resume-mini">${icon('file')}<span></span><span></span><span></span></div><div class="resume-card-info"><span class="badge ${r.status==='reviewed'?'mint':'lilac'}">${r.status==='reviewed'?'已审核':'待审核'}</span><h3>${e(r.title)}</h3><p>${r.language==='en'?'英文栏目':'中文'} · ${date(r.createdAt)} 创建 · ${r.mode==='demo'?'规则整理演示':'Cursor 生成'}</p><div class="resume-card-actions"><button class="button secondary" data-action="resume-detail" data-id="${r.id}">${icon('edit')} 编辑与审核</button><button class="icon-button danger-text" data-action="delete-resume" data-id="${r.id}" aria-label="删除 ${e(r.title)}">${icon('trash')}</button></div></div></article>`).join('')}</div>`:empty('你的第一份专属简历，正在等你。','先选择一个心动的岗位，再点击「生成专属简历」。')}`;
}
function trackerPage() {
 return `${title('每次出发，都留下足迹。','记录进度、整理反馈，让下一次投递更从容。',`<button class="button secondary" data-action="nav" data-route="jobs">${icon('plus')} 添加求职机会</button>`)}${state.applications.length?`<div class="tracker-grid">${['准备中','已投递','面试中','已结束'].map(status=>`<section class="tracker-column"><h2><i class="status-dot status-${status}"></i>${status}<span>${state.applications.filter(a=>a.status===status).length}</span></h2>${state.applications.filter(a=>a.status===status).map(a=>{const j=jobById(a.jobId);return `<article class="application-card"><div class="application-company"><span class="company-logo mini" style="--logo-bg:${j.bg};--logo-color:${j.color}">${e(j.logo)}</span><strong>${e(j.company)}</strong></div><h3>${e(j.title)}</h3><small>${icon('pin')} ${e(j.location)}</small><label>更新进度<select data-application="${a.id}" aria-label="${e(j.company)} 投递状态">${['准备中','已投递','面试中','已结束'].map(s=>`<option ${s===a.status?'selected':''}>${s}</option>`).join('')}</select></label><button class="text-button" data-action="job-detail" data-id="${j.id}">岗位与简历 ${icon('arrow')}</button></article>`;}).join('')||'<p class="column-empty">下一个机会，即将到来</p>'}</section>`).join('')}</div><p class="data-disclaimer">进度由你手动记录。标记「已投递」前需要审核该岗位简历；本产品不会自动提交求职申请。</p>`:empty('把求职进度，放在同一个地方。','在岗位详情中点击「加入投递计划」，开始记录下一次机会。')}`;
}
function creditsPage() {
 return `${title('为下一站，储备一点能量。','按需购买积分，每次生成都清晰可见。')}<div class="balance-banner"><div><span>${icon('coin')} 可用演示积分</span><strong>${money(state.credits)} <small>积分</small></strong><p>可体验约 ${Math.floor(state.credits/GENERATION_COST)} 次简历生成</p></div><div class="balance-note">${icon('shield')}<div><b>当前为产品演示</b><p>套餐价格仅展示，不会收款。<br/>点击充值只增加本地演示积分。</p></div></div></div><div class="section-title margin-top"><h2>选择适合你的求职节奏</h2><span class="badge lilac">演示定价 · 非真实销售</span></div><div class="plans-grid">${PLANS.map(p=>`<article class="plan-card ${p.popular?'popular':''}">${p.popular?'<span class="popular-label">推荐方案</span>':''}<h3>${p.name}</h3><p>${p.desc}</p><div class="plan-price"><span>¥</span>${p.price}<small> / 演示套餐</small></div><div class="plan-credits">${icon('coin')} ${money(p.credits)} 积分</div><button class="button ${p.popular?'primary':'secondary'} full-width" data-action="buy-plan" data-id="${p.id}">体验模拟充值 ${icon('arrow')}</button><ul>${p.features.map(f=>`<li>${icon('check')}${f}</li>`).join('')}</ul></article>`).join('')}</div><div class="panel transactions"><div class="section-title"><h2>积分明细</h2><span class="muted">生成成功后扣除 20 演示积分</span></div><div class="table-scroll"><table><thead><tr><th>记录</th><th>日期</th><th>积分变动</th><th>状态</th></tr></thead><tbody>${state.transactions.map(t=>`<tr><td><span class="transaction-icon ${t.amount>0?'green':'purple'}">${icon(t.amount>0?'plus':'file')}</span>${e(t.label)}</td><td>${date(t.date)}</td><td class="${t.amount>0?'positive':''}">${t.amount>0?'+':''}${money(t.amount)}</td><td><span class="badge neutral">模拟记录</span></td></tr>`).join('')}</tbody></table></div></div><p class="data-disclaimer">产品积分是使用额度，与模型 token 不是一比一兑换。真实计费、支付和服务端账本将在正式版本中接入。</p>`;
}
function settingsPage() {
 return `${title('按你的方式，准备下一站。','管理生成偏好、演示数据和未来的 AI 接入。')}<div class="settings-layout"><form id="settings-form" class="panel settings-panel"><h2>${icon('spark')} 简历偏好</h2><label>默认简历语言<select name="language"><option value="zh" ${state.settings.language==='zh'?'selected':''}>中文</option><option value="en" ${state.settings.language==='en'?'selected':''}>英文栏目（原文保留）</option></select></label><p class="field-help">演示版只整理原有内容；完整翻译和改写需要真实模型。</p><button class="button primary" type="submit">保存偏好</button></form><section class="panel settings-panel"><h2>${icon('bolt')} AI 生成方式</h2><div class="provider-row"><div><b>规则整理 · Demo</b><p>不发送数据，不消耗 Cursor 额度</p></div><span class="badge mint">当前启用</span></div><div class="provider-row"><div><b>Cursor CLI · 本地内测</b><p>通过本地服务接入你自己的 Cursor 登录</p></div><span class="badge neutral">可选接入</span></div><button class="button secondary" data-action="cursor-status">检查本地连接</button><p id="cursor-status" class="field-help">当前所有生成均为演示。正式版用户额度由服务端统一管理。</p></section><section class="panel settings-panel"><h2>${icon('shield')} 本地演示数据</h2><p>档案、简历和积分记录只保存在这个浏览器。导出备份后，可以在同一 Demo 中恢复。</p><div class="button-row"><button class="button secondary" data-action="export-backup">${icon('download')} 导出备份</button><button class="button secondary" data-action="import-backup">导入备份</button><input id="backup-file" type="file" accept="application/json,.json" hidden/></div><button class="text-button danger-text" data-action="reset-demo">重置为初始演示数据</button></section><section class="panel settings-panel product-roadmap"><h2>${icon('globe')} 从 Demo，到真正的产品</h2><ol><li><b>当前 · 产品体验</b><span>岗位筛选、简历审核、积分流程演示</span></li><li><b>下一步 · 真实生成</b><span>Cursor 内测、生成质量验证、真实岗位源</span></li><li><b>正式上线 · 商业服务</b><span>账号系统、支付、服务端计费和用户数据隔离</span></li></ol></section></div>`;
}
function render() {
 const page={jobs:jobsPage,dashboard:dashboardPage,profile:profilePage,resumes:resumesPage,tracker:trackerPage,credits:creditsPage,settings:settingsPage}[ui.route];
 $('#app').innerHTML=`${sidebar()}<div class="app-content">${header()}<main id="main">${storageWarning?`<div class="notice warning">${e(storageWarning)}</div>`:''}${page()}<footer class="app-footer"><span>FoundMyJob<span class="brand-dot">.</span> <span class="footer-motto">属于你的机会，正在前方。</span></span><span>Made for your next chapter <span class="footer-star">✦</span></span></footer></main></div>`;
 document.title=`${routes[ui.route]} · FoundMyJob`;
}

let returnFocus;
function modal(title,html,wide=false) {
 returnFocus=document.activeElement;
 $('#modal-root').innerHTML=`<dialog class="modal ${wide?'wide':''}" aria-labelledby="modal-title"><div class="modal-header"><h2 id="modal-title">${title}</h2><button class="icon-button" data-action="close-modal" aria-label="关闭对话框">${icon('close')}</button></div>${html}</dialog>`;
 const dialog=$('dialog');dialog.showModal();dialog.addEventListener('click',event=>{if(event.target===dialog){const b=dialog.getBoundingClientRect();if(event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom)closeModal();}});dialog.addEventListener('cancel',event=>{if(ui.generating)event.preventDefault();else ui.modal=null;});
}
function closeModal() {if(ui.generating){toast('正在整理简历，请稍等片刻。');return;} $('dialog')?.close();$('#modal-root').innerHTML='';ui.modal=null;returnFocus?.focus();}
function showJob(id) {
 const j=jobById(id);if(!j)return;ui.modal={type:'job',id};const fit=matchJob(j,state.profile);
 const existing=state.resumes.filter(r=>r.jobId===id);
 modal('机会详情',`<div class="job-modal-body"><div class="detail-title"><span class="company-logo" style="--logo-bg:${j.bg};--logo-color:${j.color}">${e(j.logo)}</span><div><h3>${e(j.title)}</h3><p>${e(j.company)} · ${e(j.location)}</p></div><span class="badge lilac">示例岗位</span></div><div class="detail-meta"><span>${e(j.salary)}</span><span>${j.work}</span><span>${j.track==='campus'?'校园招聘':'社会招聘'}</span></div><div class="detail-columns"><div><h4>关于这个机会</h4><p>${e(j.description)}</p><h4>我们期待的你</h4><ul>${j.requirements.map(r=>`<li>${e(r)}</li>`).join('')}</ul><a class="text-button" href="${e(j.url)}" target="_blank" rel="noopener noreferrer">公司招聘官网 ${icon('external')}</a><p class="field-help">链接为公司招聘首页；此处职位及薪资仅用于演示。</p></div><aside class="fit-panel"><span>${icon('spark')} 与你的档案匹配</span><strong>${fit.score}<small>%</small></strong><div class="progress-bar"><i style="width:${fit.score}%"></i></div><p>技能重合 ${fit.matched.length}/${j.tags.length} · ${fit.sameTrack?'求职阶段一致':'求职阶段不同'}</p><div class="tags">${fit.matched.map(t=>`<span class="tag-match">✓ ${e(t)}</span>`).join('')}</div>${fit.missing.length?`<h5>可以进一步确认</h5><p>${fit.missing.map(e).join('、')}</p>`:''}<small>基于技能、目标方向与求职阶段的规则计算，不代表录用概率。</small></aside></div>${existing.length?`<div class="existing-resumes"><h4>已为这个岗位准备 ${existing.length} 份简历</h4>${existing.map(r=>`<button class="text-button" data-action="resume-detail" data-id="${r.id}">${icon('file')}${date(r.createdAt)} · ${r.status==='reviewed'?'已审核':'待审核'}${icon('arrow')}</button>`).join('')}</div>`:''}<div class="generation-controls"><label>简历语言<select id="resume-language"><option value="zh" ${state.settings.language==='zh'?'selected':''}>中文</option><option value="en" ${state.settings.language==='en'?'selected':''}>英文栏目（保留原文）</option></select></label><p>${icon('info')} 规则整理演示 · ${GENERATION_COST} 演示积分 / 份</p></div></div><div class="modal-footer"><button class="button secondary" data-action="track-job" data-id="${id}">${icon('plus')} ${state.applications.some(a=>a.jobId===id)?'已加入投递计划':'加入投递计划'}</button><button class="button primary" data-action="generate" data-id="${id}">${icon('spark')} 生成专属简历 <span class="button-cost">20 积分</span></button></div>`,true);
}
function showResume(id) {
 const r=state.resumes.find(x=>x.id===id);if(!r)return;ui.modal={type:'resume',id};
 modal('简历工作室',`<div class="studio-toolbar"><div><strong>${e(r.title)}</strong><span class="badge ${r.status==='reviewed'?'mint':'lilac'}">${r.status==='reviewed'?'已审核':'待审核'}</span></div><span class="muted">${r.mode==='demo'?'规则整理演示 · 未调用 AI':'Cursor 生成'}</span></div><div class="studio"><section class="studio-editor"><div class="editor-label">${icon('edit')} 编辑内容 <span>支持简单 Markdown</span></div><textarea id="resume-editor" aria-label="简历内容" maxlength="40000" spellcheck="false">${e(r.content)}</textarea><div class="review-notes"><h4>${icon('info')} 审核提示</h4><ul>${r.notes.map(n=>`<li>${e(n)}</li>`).join('')}</ul></div></section><section class="studio-preview"><div class="preview-label">简历预览 <span>A4 · 可打印为 PDF</span></div><article class="resume-paper" id="resume-preview">${markdownToHtml(r.content)}</article></section></div><div class="review-check"><label><input type="checkbox" id="review-confirm" ${r.status==='reviewed'?'checked':''}/> 我已逐项确认经历、技能和联系方式真实准确</label><small>修改内容后需重新审核；导出不代表已投递。</small></div><div class="modal-footer studio-footer"><div class="button-row"><button class="button secondary" data-action="save-resume" data-id="${id}">保存修改</button><button class="button secondary" data-action="download-resume" data-id="${id}">${icon('download')} Markdown</button><button class="button secondary" data-action="print-resume" data-id="${id}">${icon('download')} PDF / 打印</button></div><button class="button primary" data-action="review-resume" data-id="${id}">${icon('check')} 确认审核完成</button></div>`,true);
}
function download(name,text,type='text/plain;charset=utf-8') { const url=URL.createObjectURL(new Blob([text],{type}));const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
async function saveCurrentResume(id) {
 const content=$('#resume-editor')?.value;
 if(content!==undefined) await mutate(s=>({...s,resumes:s.resumes.map(r=>r.id===id&&r.content!==content?editResume(r,content):r)}));
 return state.resumes.find(r=>r.id===id);
}
async function generate(id) {
 if(ui.generating)return;
 const language=$('#resume-language')?.value||state.settings.language;
 const resume=makeDemoResume(state.profile,jobById(id),language);
 if(state.credits<GENERATION_COST)throw new Error('演示积分不足，请先到积分与套餐体验充值。');
 ui.generating=true;
 modal('正在准备你的专属简历',`<div class="generation-progress"><div class="loading-orb">${icon('spark')}</div><h3>让你的经历，更贴近这个机会。</h3><p>正在读取档案、排列相关技能并整理简历…</p><span class="badge lilac">规则整理演示 · 不消耗 Cursor 额度</span></div>`);
 try { await new Promise(resolve=>setTimeout(resolve,1100));await mutate(s=>chargeGeneration(s,resume));ui.generating=false;render();showResume(resume.id);toast('专属简历已整理，扣除 20 演示积分。请审核内容。'); }
 finally {ui.generating=false;}
}
const actions = {
 'nav':el=>go(el.dataset.route),
 'menu':()=>{ui.mobileMenu=!ui.mobileMenu;render();},
 'notifications':()=>modal('欢迎体验 FoundMyJob',`<div class="dialog-content"><span class="tip-icon">${icon('spark')}</span><h3>从找到机会，到做好准备。</h3><p>这是一份可操作的产品 Demo。你可以修改档案、筛选示例岗位、整理简历、审核导出，并体验积分套餐。</p><div class="notice"><p>所有岗位、预填经历、积分与价格都用于演示。没有真实付款、模型调用或自动投递。</p></div><button class="button primary" data-action="close-modal">开始探索 ${icon('arrow')}</button></div>`),
 'saved-filter':el=>{ui.savedOnly=el.dataset.value==='saved';render();},
 'clear-filters':()=>{Object.assign(ui,{query:'',region:'',track:'',work:'',savedOnly:false});render();},
 'save-job':async el=>{await mutate(s=>({...s,saved:s.saved.includes(el.dataset.id)?s.saved.filter(id=>id!==el.dataset.id):[...s.saved,el.dataset.id]}));render();},
 'job-detail':el=>showJob(el.dataset.id),
 'close-modal':closeModal,
 'generate':el=>generate(el.dataset.id),
 'resume-detail':el=>showResume(el.dataset.id),
 'track-job':async el=>{const id=el.dataset.id;await mutate(s=>s.applications.some(a=>a.jobId===id)?s:{...s,applications:[{id:uid(),jobId:id,status:'准备中',createdAt:new Date().toISOString()},...s.applications]});render();showJob(id);toast('已加入投递计划，可在「投递追踪」查看。');},
 'save-resume':async el=>{await saveCurrentResume(el.dataset.id);render();showResume(el.dataset.id);toast('修改已保存；如有内容变动，请重新审核。');},
 'review-resume':async el=>{if(!$('#review-confirm').checked)throw new Error('请先勾选确认，逐项核实简历内容。');await saveCurrentResume(el.dataset.id);await mutate(s=>({...s,resumes:s.resumes.map(r=>r.id===el.dataset.id?{...r,status:'reviewed',reviewedAt:new Date().toISOString()}:r)}));render();showResume(el.dataset.id);toast('审核完成，你可以导出并自行投递。');},
 'download-resume':async el=>{const r=await saveCurrentResume(el.dataset.id);download(`FoundMyJob-${r.title.replace(/[<>:"/\\|?*]/g,'-')}.md`,r.content,'text/markdown;charset=utf-8');render();toast('简历 Markdown 已导出。');},
 'print-resume':async el=>{
   // Open synchronously from the user's click to preserve popup permission.
   const win=window.open('','_blank');if(!win)throw new Error('请允许此页面打开打印窗口后重试。');
   try {const r=await saveCurrentResume(el.dataset.id);win.document.write(`<!doctype html><html lang="${r.language==='en'?'en':'zh-CN'}"><head><meta charset="UTF-8"><title>${e(r.title)}</title><style>body{font-family:Arial,"Microsoft YaHei",sans-serif;max-width:720px;margin:40px auto;color:#202329;line-height:1.65;font-size:12px}h1{font-size:27px;margin-bottom:6px}h2{font-size:15px;border-bottom:1px solid #aaa;padding-bottom:4px;margin-top:24px}p{margin:5px 0;overflow-wrap:anywhere}@page{size:A4;margin:18mm}h2{break-after:avoid}p{orphans:3;widows:3}.print-controls{margin-bottom:24px;padding:12px;background:#f1edff}.print-controls button{padding:8px 16px;cursor:pointer}@media print{body{margin:0}.print-controls{display:none}}</style></head><body><div class="print-controls">请选择打印窗口中的“另存为 PDF”。 <button id="print">打印 / 保存 PDF</button></div>${markdownToHtml(r.content)}</body></html>`);win.document.close();win.document.getElementById('print').addEventListener('click',()=>win.print());win.opener=null;render();win.print();}catch(error){win.close();throw error;}
 },
 'buy-plan':el=>{const p=PLANS.find(x=>x.id===el.dataset.id);modal('体验积分充值',`<div class="dialog-content"><span class="tip-icon">${icon('coin')}</span><h3>${p.name} · ${money(p.credits)} 积分</h3><p>页面展示价格 ¥${p.price}。这是模拟充值，不会发起付款或扣款。</p><button class="button primary full-width" data-action="confirm-buy" data-id="${p.id}">确认模拟充值 · 不收费</button></div>`);},
 'confirm-buy':async el=>{el.disabled=true;await mutate(s=>topUp(s,PLANS.find(p=>p.id===el.dataset.id)));closeModal();render();toast('模拟充值成功，未产生真实付款。');},
 'delete-resume':el=>modal('删除这份演示简历？',`<div class="dialog-content"><p>删除后无法撤回。已消耗的演示积分不会返还，投递记录会保留。</p><button class="button danger" data-action="confirm-delete" data-id="${el.dataset.id}">确认删除</button></div>`),
 'confirm-delete':async el=>{await mutate(s=>({...s,resumes:s.resumes.filter(r=>r.id!==el.dataset.id)}));closeModal();render();toast('简历已删除。');},
 'import-text':()=>$('#profile-file').click(),
 'export-backup':()=>{download('FoundMyJob-demo-backup.json',JSON.stringify(state,null,2),'application/json');toast('备份已导出，包含个人档案和简历内容。');},
 'import-backup':()=>$('#backup-file').click(),
 'reset-demo':()=>modal('重置演示数据？',`<div class="dialog-content"><p>这会清除当前浏览器里的档案修改、简历、投递记录和模拟积分记录，并恢复初始示例。建议先导出备份。</p><button class="button danger" data-action="confirm-reset">确认重置</button></div>`),
 'confirm-reset':async()=>{await mutate(()=>initialState(DEFAULT_PROFILE));storageWarning='';closeModal();render();toast('已恢复初始演示数据。');},
 'cursor-status':async el=>{el.disabled=true;const target=$('#cursor-status');target.textContent='正在检查本地桥接服务…';try{const response=await fetch('/api/cursor/status',{signal:AbortSignal.timeout(8000)});if(!response.ok)throw new Error();const status=await response.json();target.textContent=status.message;}catch{target.textContent='当前为静态演示，未连接本地 Cursor 服务。下载项目后运行 npm start 可检查本地接入。';}finally{el.disabled=false;}},
};
document.addEventListener('click',async event=>{const el=event.target.closest('[data-action]');if(!el||el.disabled)return;try{await actions[el.dataset.action]?.(el);}catch(error){toast(error.message||'操作未完成，请重试。');}});
document.addEventListener('submit',async event=>{
 event.preventDefault();const form=event.target;const data=Object.fromEntries(new FormData(form));
 try {
  if(form.id==='job-search'){Object.assign(ui,data);render();}
  if(form.id==='profile-form'){await mutate(s=>({...s,profile:{...s.profile,...data,skills:data.skills.split(/[,，\n]/).map(x=>x.trim()).filter(Boolean).filter((x,i,a)=>a.indexOf(x)===i).slice(0,50)}}));render();toast('档案已保存，岗位匹配度已更新。');}
  if(form.id==='settings-form'){await mutate(s=>({...s,settings:{...s.settings,language:data.language}}));toast('简历偏好已保存。');}
 }catch(error){toast(error.message);}
});
document.addEventListener('change',async event=>{
 const el=event.target;
 try {
  if(el.id==='job-sort'){ui.sort=el.value;render();}
  if(el.closest('#job-search')&&el.tagName==='SELECT'){Object.assign(ui,Object.fromEntries(new FormData($('#job-search'))));render();}
  if(el.dataset.application){const status=el.value;await mutate(s=>{const app=s.applications.find(a=>a.id===el.dataset.application);if(['已投递','面试中'].includes(status)&&!s.resumes.some(r=>r.jobId===app.jobId&&r.status==='reviewed'))throw new Error('请先为这个岗位生成简历并完成审核。');return {...s,applications:s.applications.map(a=>a.id===app.id?{...a,status}:a)};});render();toast('投递进度已更新。');}
  if(el.id==='profile-file'&&el.files[0]){if(el.files[0].size>100000)throw new Error('请导入小于 100 KB 的 .txt 或 .md 文件。');$('#profile-form [name="experience"]').value=await el.files[0].text();toast('文本已填入工作与实习经历，检查后点击保存。');}
  if(el.id==='backup-file'&&el.files[0]){if(el.files[0].size>2000000)throw new Error('备份文件过大。');const imported=validateState(JSON.parse(await el.files[0].text()));validateImported(imported);ui.pendingImport=imported;modal('恢复演示备份？',`<div class="dialog-content"><p>将用备份替换当前浏览器数据，包括 ${imported.resumes.length} 份简历和 ${imported.credits} 演示积分。</p><button class="button primary" data-action="confirm-import">确认恢复</button></div>`);}
 }catch(error){toast(error.message||'文件格式不正确。');if(el.dataset.application)render();}
});
actions['confirm-import']=async()=>{await mutate(()=>ui.pendingImport);ui.pendingImport=null;closeModal();render();toast('备份已恢复。');};
function validateImported(s) {
 const assert=(condition)=>{if(!condition)throw new Error('备份字段不正确，请使用此 Demo 导出的备份。');};
 for(const key of Object.keys(DEFAULT_PROFILE))if(key!=='skills')assert(typeof s.profile[key]==='string');
 assert(s.profile.skills.every(x=>typeof x==='string')&&['campus','experienced'].includes(s.profile.track));
 assert(s.saved.every(id=>jobById(id))&&s.saved.length<=JOBS.length);
 assert(s.resumes.length<500&&s.applications.length<=JOBS.length&&s.transactions.length<2000);
 assert(s.resumes.every(r=>typeof r.id==='string'&&jobById(r.jobId)&&typeof r.title==='string'&&typeof r.content==='string'&&r.content.length<=40000&&Array.isArray(r.notes)&&r.notes.every(n=>typeof n==='string')&&['draft','reviewed'].includes(r.status)&&['zh','en'].includes(r.language)&&Number.isFinite(Date.parse(r.createdAt))));
 assert(s.applications.every(a=>typeof a.id==='string'&&jobById(a.jobId)&&['准备中','已投递','面试中','已结束'].includes(a.status)));
 assert(s.transactions.every(t=>typeof t.label==='string'&&Number.isSafeInteger(t.amount)&&Number.isFinite(Date.parse(t.date))));
 assert(['zh','en'].includes(s.settings.language));
}
document.addEventListener('input',event=>{if(event.target.id==='resume-editor'){$('#resume-preview').innerHTML=markdownToHtml(event.target.value);$('#review-confirm').checked=false;}});
render();
