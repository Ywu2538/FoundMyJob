import {orderResumeMarkdown} from './resume-markdown.js';
import {COMPANY_LOGOS} from './company-logos.js';
import {normalizeResumeLayout,resumeLayoutPickerHtml,resumePrintDocumentHtml} from './resume-layouts.js';
import {profileTrackFields} from './profile-track.js';
import { escapeHtml as e, uid, profileCompletion, matchJob, filterJobs, discoverySummary, profileSearchScope, defaultJobFilters, discoveryGroups, jobSourceKind, markdownToHtml } from './core.js';

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
let state, JOBS=[], storageWarning='';
const routes={dashboard:'工作台',jobs:'发现岗位',resumes:'我的简历',tracker:'投递追踪',profile:'求职画像',credits:'生成记录',settings:'AI 与数据设置'};
const ui={profileId:null,drafts:{},recordProfileId:'',route:routes[location.hash.slice(1)]?location.hash.slice(1):'jobs',...defaultJobFilters(),companiesOpen:false,generating:false,modal:null,mobileMenu:false,models:[],provider:'cursor'};
let currentJobResults=[],jobsObserver;
async function api(path,body) {
 const response=await fetch(path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(state?.token?{'X-FMJ-Token':state.token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 let result;try{result=await response.json();}catch{throw new Error('本地后端未响应，请重新运行 Start-FoundMyJob.cmd。');}
 if(!response.ok)throw new Error(result.error||'请求失败。');return result;
}
function accept(next){
 state=next;JOBS=state.jobs;
 if(!state.profiles)throw new Error('服务需要升级，请停止并重新启动 FoundMyJob。');
 const previous=ui.profileId;
 if(!ui.profileId){try{ui.profileId=sessionStorage.getItem('foundmyjob:profile');}catch{}}
 state.profile=state.profiles.find(p=>p.id===ui.profileId&&!p.archived)||state.profiles.find(p=>!p.archived);
 ui.profileId=state.profile.id;
 if(previous!==ui.profileId)resetProfileSearch();
}
const marketNames={'':'全部地区',cn:'中国大陆',overseas:'国外',ca:'加拿大',us:'美国',na:'北美',other:'其他 / 未注明'};
const scopeNames={domestic:'国内',overseas:'国外',all:'国内外均考虑'};
const scopeOptions=profile=>Object.entries(scopeNames).map(([id,label])=>'<option value="'+id+'" '+(profileSearchScope(profile)===id?'selected':'')+'>'+label+'</option>').join('');
function resetProfileSearch(){Object.assign(ui,defaultJobFilters());}
function chooseProfile(id){
 const profile=state.profiles.find(p=>p.id===id&&!p.archived);if(!profile)throw new Error('画像不可用，请刷新。');
 ui.profileId=id;state.profile=profile;resetProfileSearch();
 try{sessionStorage.setItem('foundmyjob:profile',id);}catch{}
}
function profileOptions(id,includeArchived=false){return state.profiles.filter(p=>includeArchived||!p.archived).map(p=>`<option value="${p.id}" ${p.id===id?'selected':''}>${e(p.label)}${p.archived?'（已归档）':''}</option>`).join('');}
function profileSelector(context='search'){
 const p=state.profile;
 return `<section class="profile-context panel"><label>${context==='edit'?'正在编辑的画像':'用于岗位搜索的画像'}<select data-profile-select="${context}">${profileOptions(p.id)}</select></label><div class="profile-context-summary"><strong>${e(p.target||'请填写目标职位')}</strong><span>${scopeNames[profileSearchScope(p)]} · ${trackName(p.track)} · ${p.resumeLanguage==='en'?'英文':'中文'}简历</span><small>画像决定匹配排序和官网入口；默认浏览所有地区，向下滚动查看更多岗位。</small></div><button class="button secondary" data-action="nav" data-route="profile">${icon('edit')} 管理画像</button></section>`;
}
function recordFilter(){return `<label class="record-filter">按来源画像查看<select id="record-profile"><option value="">全部画像</option>${profileOptions(ui.recordProfileId,true)}</select></label>`;}
const records=items=>items.filter(item=>!ui.recordProfileId||item.profileId===ui.recordProfileId);
const sourceLabel=item=>item.profileLabel||item.sourceProfile?.label||'原求职画像';
function profileDialog(copy=false){
 if(copy&&ui.drafts[ui.profileId])throw new Error('请先保存当前画像的修改，再复制。');
 const p=state.profile;
 modal(copy?'复制求职画像':'新建求职画像',`<form id="create-profile-form" class="dialog-content"><input type="hidden" name="copyFrom" value="${copy?p.id:''}"/><label>画像名称<input name="label" required maxlength="100" placeholder="例如：加拿大 · Data Engineer" value="${copy?e(p.label.slice(0,94)+' · 副本'):''}"/></label><label>招聘地点范围<select name="searchScope">${scopeOptions(copy?p:{})}</select></label><input type="hidden" name="market" value="${copy?e(p.market):''}"/><label>默认简历语言<select name="resumeLanguage"><option value="zh" ${(copy?p.resumeLanguage:state.settings.language)==='en'?'':'selected'}>中文</option><option value="en" ${(copy?p.resumeLanguage:state.settings.language)==='en'?'selected':''}>English</option></select></label><p>${copy?'复制已保存的真实经历，之后两份画像分别编辑、互不覆盖。':'新画像从空白开始，也可以复制已有画像后调整职位方向。'}</p><button class="button primary" type="submit">${copy?'复制画像':'创建画像'}</button></form>`);
}
async function update(path,body){accept(await api(path,body));}
async function refresh(){accept(await api('/api/state'));}
const providerName=id=>id==='cursor'?'本机 Cursor':state.providers.find(p=>p.id===id)?.name||id;
const trackName=t=>t==='campus'?'校招 / 实习':t==='experienced'?'社会招聘':'类型未注明';

const money = n=>n.toLocaleString('zh-CN');
const date = d=>new Date(d).toLocaleDateString('zh-CN',{month:'2-digit',day:'2-digit'});
const jobById = id=>JOBS.find(j=>j.id===id);
function toast(message) { const el=$('#toast'); el.textContent=message; el.classList.add('visible'); clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.classList.remove('visible'),4000); }
function go(route) { if(!routes[route])return; ui.route=route;ui.mobileMenu=false;location.hash=route;render();window.scrollTo(0,0); }
window.addEventListener('hashchange',()=>{if(routes[location.hash.slice(1)]){ui.route=location.hash.slice(1);render();}});


function sidebar() {
  return `<aside class="sidebar ${ui.mobileMenu?'is-open':''}">
    <a class="brand" href="#jobs"><img src="/favicon.svg" alt=""/><span>FoundMyJob<span class="brand-dot">.</span></span></a>
    <div class="workspace"><span class="workspace-icon">${icon('briefcase')}</span><div><strong>我的求职空间</strong><small>让每一份努力，更有方向</small></div><span class="workspace-tag">LOCAL</span></div>
    <div class="nav-caption">求职旅程</div>
    <nav aria-label="主导航">${[['dashboard','grid'],['jobs','search'],['resumes','file'],['tracker','briefcase']].map(([route,ico])=>navItem(route,ico)).join('')}</nav>
    <div class="nav-divider"></div><div class="nav-caption">个人中心</div>
    <nav aria-label="个人中心">${[['profile','user'],['credits','coin'],['settings','settings']].map(([route,ico])=>navItem(route,ico)).join('')}</nav>
    <div class="sidebar-bottom"><div class="credit-card"><div class="credit-card-top">${icon('shield')} 你的本机求职空间</div><p><b>SQLite</b><span>持久保存</span></p><small>当前生成：${e(providerName(state.settings.provider))}</small><button class="credit-cta" data-action="nav" data-route="settings">AI 与数据设置 ${icon('arrow')}</button></div>
    <button class="sidebar-user" data-action="nav" data-route="profile"><span class="avatar">${e(state.profile.name?.[0]||'你')}</span><span><strong>${e(state.profile.name||'我的档案')}</strong><small>${e(state.profile.label)}</small></span>${icon('chevron')}</button></div>
  </aside>`;
}
function navItem(route,ico) {return `<button class="nav-item ${ui.route===route?'active':''}" data-action="nav" data-route="${route}" ${ui.route===route?'aria-current="page"':''}>${icon(ico)}<span>${routes[route]}</span>${route==='jobs'?`<em>${JOBS.filter(j=>j.active).length}</em>`:route==='resumes'&&state.resumes.length?`<em>${state.resumes.length}</em>`:''}</button>`;}
function header() {return `<header class="topbar"><div class="breadcrumb"><button class="icon-button mobile-only" data-action="menu" aria-label="展开导航">${icon('menu')}</button><span>我的求职空间</span>${icon('chevron')}<strong>${routes[ui.route]}</strong></div><div class="topbar-right"><span class="demo-pill"><i></i> 本地数据库已连接</span><button class="icon-button" data-action="notifications" aria-label="查看使用说明">${icon('bell')}<i class="notification-dot"></i></button><button class="avatar small" data-action="nav" data-route="profile" aria-label="打开个人档案">${e(state.profile.name?.[0]||'你')}</button></div></header>`;}
function title(heading,sub,button='') {return `<div class="page-title"><div><div class="eyebrow">YOUR NEXT CHAPTER</div><h1>${heading}</h1><p>${sub}</p></div>${button}</div>`;}
function empty(heading,sub,action='jobs',label='发现适合我的岗位') {return `<div class="empty-state"><span class="empty-icon">${icon('file')}</span><h3>${heading}</h3><p>${sub}</p><button class="button primary" data-action="nav" data-route="${action}">${label}${icon('arrow')}</button></div>`;}
function stat(iconName,label,value,note,tone='purple') {return `<div class="stat"><span class="stat-icon ${tone}">${icon(iconName)}</span><div><span class="stat-label">${label}</span><strong>${value}</strong><small>${note}</small></div></div>`;}


function sourceCoverage(summary) {
 const groupRows=(kind,label)=>{
  const rows=JOBS.filter(j=>j.active&&jobSourceKind(j)===kind);
  return rows.length?'<tr><td>'+label+'</td><td>'+rows.length+'</td><td>见岗位详情</td><td>招聘状态待核验</td></tr>':'';
 };
 return '<section class="source-coverage panel" aria-label="岗位库概览"><div class="section-title"><h2>岗位库概览</h2><button class="text-button" data-action="nav" data-route="jobs">浏览岗位 '+icon('arrow')+'</button></div><p class="source-coverage-total"><strong>'+summary.active+'</strong> 条可浏览记录 · '+summary.companies+' 家公司</p><p>企业接口 '+summary.synced+' 条 · 官网检索待核验 '+summary.pending+' 条 · 手动导入 '+summary.manual+' 条 · 历史已下架 '+summary.archived+' 条</p><details><summary>查看各来源数量与最近同步状态</summary><div class="table-scroll"><table><thead><tr><th>公司 / 来源</th><th>可浏览记录</th><th>最近同步</th><th>状态</th></tr></thead><tbody>'+state.sources.map(source=>{
 const rows=JOBS.filter(j=>j.active&&j.source===source.id);
 return '<tr><td>'+e(source.company)+'</td><td>'+rows.length+'</td><td>'+(source.syncedAt?e(new Date(source.syncedAt).toLocaleString('zh-CN')):'未同步')+'</td><td>'+e(source.status)+(source.error?' · '+e(source.error):'')+'</td></tr>';
 }).join('')+groupRows('discovered','官网检索发现')+groupRows('manual','手动导入')+'</tbody></table></div></details><p>统计涵盖整个岗位库。官网检索岗位带有待核验标记，招聘状态请以企业原文为准。</p></section>';
}
function continueDiscovery() {
 const groups=discoveryGroups(state.profile);
 const domestic=state.sources.filter(s=>s.featured).map(s=>[s.company,s.careersUrl]);
 const overseas=[['Google','https://www.google.com/about/careers/applications/jobs/results/'],['Microsoft','https://careers.microsoft.com/'],['Amazon','https://www.amazon.jobs/']];
 return '<section class="domestic-discovery" aria-label="招聘官网入口"><h3>去招聘官网，继续找机会</h3><p>按画像的「'+scopeNames[profileSearchScope(state.profile)]+'」偏好展示入口，直达公司官网查看更多职位。</p>'+groups.map(group=>'<div class="discovery-group"><h4>'+(group==='domestic'?'国内招聘官网':'国外招聘官网')+'</h4><div class="button-row">'+(group==='domestic'?domestic:overseas).map(([name,url])=>'<a class="button secondary" href="'+e(url)+'" target="_blank" rel="noopener noreferrer">'+name+' '+icon('external')+'</a>').join('')+'</div></div>').join('')+'<p class="field-help">可在官网选择城市、确认招聘状态，也可以把找到的岗位导入这里。</p></section>';
}

function companyLogo(item,mini=false) {
 const slug=item.companyId||item.slug||String(item.source||'').split(':')[1]||state.sources.find(s=>s.company===item.company)?.slug;
 const url=COMPANY_LOGOS[slug];
 return '<span class="company-logo'+(mini?' mini':'')+(url?' brand-logo':'')+'">'+(url?'<img src="'+e(url)+'" alt="" decoding="async" loading="lazy"/>':e(item.logo||item.company?.slice(0,2)||'企'))+'</span>';
}
function companyCountLabel(source,total) {
 if(total)return total+' 条岗位';
 if(source.status==='同步中')return '正在同步';
 if(source.adapter==='pending'||source.status==='待接通')return '待接通 · 官网查看';
 if(source.status==='同步失败')return '暂时无法同步';
 if(!source.syncedAt)return '待同步';
 return source.status==='部分同步'?'当前读取范围暂无岗位':'当前公开列表暂无岗位';
}

function companyDirectory() {
 const sources=state.sources.filter(s=>s.featured),counts=new Map();
 for(const j of JOBS)if(j.active)counts.set(j.company,(counts.get(j.company)||0)+1);
 const selected=sources.find(s=>s.company===ui.company);
 const synced=sources.filter(s=>(counts.get(s.company)||0)>0).length;
 return `<section class="company-directory panel" aria-label="热门公司岗位"><h2 class="company-heading"><button class="company-toggle" data-action="toggle-companies" aria-expanded="${ui.companiesOpen}" aria-controls="company-content"><span class="company-heading-copy"><span class="company-heading-title">热门公司岗位</span><span class="company-heading-summary">${sources.length} 家公司 · 筛选岗位与招聘官网入口${selected?' · 已选 '+e(selected.company):''}</span></span><span class="company-toggle-hint"><span data-company-toggle-label>${ui.companiesOpen?'收起':'展开'}</span>${icon('down')}</span></button></h2><div id="company-content" ${ui.companiesOpen?'':'hidden'}><div class="section-title"><div><h3>按公司查看岗位</h3><p>${synced} 家已有岗位 · 点击公司筛选下方列表</p></div><button class="text-button" data-action="company-filter" data-company="" aria-pressed="${!ui.company}">全部公司</button></div><div class="company-grid">${sources.map(s=>`<button class="company-chip ${ui.company===s.company?'selected':''}" data-action="company-filter" data-company="${e(s.company)}" aria-pressed="${ui.company===s.company}">${companyLogo(s,true)}<span class="company-chip-copy"><strong>${e(s.company)}</strong><span>${companyCountLabel(s,counts.get(s.company)||0)}</span></span></button>`).join('')}</div>${selected?`<div class="company-selection"><div><strong>${e(selected.company)}</strong><p>${e(selected.error||selected.syncNote||selected.note||(selected.syncedAt?'最近同步：'+new Date(selected.syncedAt).toLocaleString('zh-CN'):'点击同步获取公开职位。'))}</p>${!(counts.get(selected.company)||0)?'<p>尚无已入库职位，可以前往招聘官网查看。</p>':''}</div><div class="button-row"><button class="button primary" data-action="sync-jobs" data-id="${selected.id}" ${state.syncing||ui.syncing?'disabled':''}>同步这家公司</button><a class="button secondary" href="${e(selected.careersUrl)}" target="_blank" rel="noopener noreferrer">招聘官网 ${icon('external')}</a></div></div>`:''}${state.syncing||ui.syncing?'<p role="status">正在更新公司岗位…</p>':''}${continueDiscovery()}</div></section>`;
}

function jobsPage() {
 const summary=discoverySummary(JOBS,state.profile,{...ui,saved:state.saved}),jobs=summary.results;
 currentJobResults=jobs;
 return `${title('发现适合你的真实岗位。','按你的方向发现机会，向下滚动，继续浏览更多岗位。',`<div class="button-row"><button class="button secondary" data-action="import-job">${icon('plus')} 导入岗位</button><button class="button primary" data-action="sync-jobs" ${state.syncing||ui.syncing?'disabled':''}>${icon('globe')} 同步真实岗位</button></div>`)}
 ${profileSelector()}${companyDirectory()}<section class="discovery-banner"><div class="banner-copy"><span class="tiny-pill">${icon('spark')} 每一段经历，都值得被看见</span><h2>好机会，从了解你开始。</h2><p>把你的闪光点，变成下一份工作的起点。<br/>完善档案，解锁更贴合你的岗位推荐。</p><button class="button dark" data-action="nav" data-route="profile">完善求职档案 ${icon('arrow')}</button></div>
 <div class="banner-art" aria-hidden="true"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><span class="art-star star-one">✦</span><span class="art-star star-two">✧</span><div class="floating-label label-one"><span class="art-icon green">${icon('check')}</span>你的经历，刚好匹配</div><div class="art-resume"><div class="art-resume-head"><span class="art-avatar">${icon('user')}</span><span><i></i><i></i></span><b>✦</b></div><div class="art-lines"><i></i><i></i><i></i></div><div class="art-tags"><span>潜力</span><span>热爱</span><span>成长</span></div><div class="art-match">${icon('spark')} 下一站，有更多可能</div></div><div class="floating-label label-two"><span class="art-icon purple">${icon('file')}</span>为每个机会，认真准备</div></div></section>
 <section class="stats-row" aria-label="求职概览">${stat('briefcase','当前筛选结果',jobs.length,`已显示 <span data-job-visible>${summary.visible}</span> 条岗位`,'purple')}${stat('user','档案完整度',`${profileCompletion(state.profile)}<span>%</span>`,'越完整，匹配越精准','blue')}${stat('bookmark','已收藏岗位',state.saved.length,'留住每一个心动机会','peach')}${stat('file','专属简历',state.resumes.length,'每一次投递都有准备','green')}</section>
 <section class="job-section"><div class="section-heading"><div class="section-tabs"><button class="section-tab ${!ui.savedOnly?'selected':''}" data-action="saved-filter" data-value="all">岗位库 <span>${summary.active}</span></button><button class="section-tab ${ui.savedOnly?'selected':''}" data-action="saved-filter" data-value="saved">我的收藏 <span>${state.saved.length}</span></button></div><div class="matching-note">${icon('spark')} 按「${e(state.profile.label)}」计算匹配度</div></div>
 <form class="filter-bar" id="job-search"><label class="search-field">${icon('search')}<input name="query" placeholder="搜索职位、公司或技能…" value="${e(ui.query)}" aria-label="搜索职位、公司或技能"/></label><select name="region" aria-label="岗位地区"><option value="">全部地区</option><option value="cn" ${ui.region==='cn'?'selected':''}>中国大陆</option><option value="overseas" ${ui.region==='overseas'?'selected':''}>国外</option><option value="ca" ${ui.region==='ca'?'selected':''}>加拿大</option><option value="us" ${ui.region==='us'?'selected':''}>美国</option><option value="na" ${ui.region==='na'?'selected':''}>北美（含国家未注明）</option><option value="other" ${ui.region==='other'?'selected':''}>其他 / 未注明</option></select><select name="track" aria-label="招聘类型"><option value="">全部招聘类型</option><option value="campus" ${ui.track==='campus'?'selected':''}>校园招聘</option><option value="experienced" ${ui.track==='experienced'?'selected':''}>社会招聘</option><option value="unknown" ${ui.track==='unknown'?'selected':''}>未注明</option></select><select name="work" aria-label="办公方式"><option value="">办公方式</option>${['远程办公','混合办公','现场办公','未注明'].map(x=>`<option ${ui.work===x?'selected':''}>${x}</option>`).join('')}</select><button class="button primary" type="submit">${icon('search')} 搜索</button></form>
 <div class="active-filters"><label class="inline-check"><input id="target-only" type="checkbox" ${ui.targetOnly?'checked':''} ${state.profile.target.trim()?'':'disabled'}/> 仅显示目标职位：${e(state.profile.target||'尚未填写')}</label><span>公司：${e(ui.company||'全部')} · 地区：${e(marketNames[ui.region])} · 类型：${ui.track?trackName(ui.track):'全部'}${ui.query?' · 关键词：'+e(ui.query):''}</span><button class="text-button" data-action="clear-filters">查看全部库内岗位 / 清除筛选</button></div><div class="results-line"><span>找到 <b>${jobs.length}</b> 个岗位 · 已显示 <b data-job-visible>${summary.visible}</b> 条</span><label>排序：<select id="job-sort" aria-label="岗位排序"><option value="match" ${ui.sort==='match'?'selected':''}>匹配度优先</option><option value="new" ${ui.sort==='new'?'selected':''}>最近同步优先</option></select></label><label>显示数量：<select id="job-page-size" aria-label="显示数量"><option value="25" ${ui.pageSize===25?'selected':''}>25 条</option><option value="50" ${ui.pageSize===50?'selected':''}>50 条</option></select></label><label>来源：<select id="job-source-kind" aria-label="岗位来源"><option value="">全部来源</option><option value="synced" ${ui.sourceKind==='synced'?'selected':''}>官网同步</option><option value="discovered" ${ui.sourceKind==='discovered'?'selected':''}>官网检索 · 待核验</option><option value="manual" ${ui.sourceKind==='manual'?'selected':''}>手动导入</option></select></label></div>
 <div class="jobs-grid">${jobs.length?jobs.slice(0,summary.visible).map(jobCard).join(''):`<div class="no-results">${icon('search')}<h3>还没有找到符合条件的岗位</h3><p>已接入的岗位库暂无符合条件的结果，不代表市场上没有此类岗位。可查看上方官网入口，或清除筛选浏览全部岗位。</p><button class="button secondary" data-action="clear-filters">清除筛选</button></div>`}</div>
 <div id="jobs-load-more" class="jobs-load-more">${jobLoadMoreContent()}</div><div class="list-footer"><span class="footer-line"></span><span>好机会值得等待，更值得准备 ${icon('spark')}</span><span class="footer-line"></span></div>
 <p class="data-disclaimer">${icon('info')} 岗位以企业原文为准，可能下架；匹配度是技能与目标方向的规则参考，不代表录用概率。官网检索岗位标注待核验，详情中的摘要不能替代完整 JD。</p></section>`;
}
function jobLoadMoreContent() {
 const total=currentJobResults.length,visible=Math.min(ui.limit,total),remaining=total-visible;
 if(!total)return '';
 return `<p role="status">已显示 ${visible} / ${total} 条${remaining?' · 向下滚动，自动加载更多':' · 已浏览全部岗位'}</p>${remaining?`<button class="button secondary" data-action="more-jobs">继续加载 ${Math.min(ui.pageSize,remaining)} 条 ${icon('down')}</button>`:''}`;
}
function observeJobList() {
 jobsObserver?.disconnect();jobsObserver=null;
 const sentinel=$('#jobs-load-more');
 if(ui.route!=='jobs'||!sentinel||ui.limit>=currentJobResults.length||!('IntersectionObserver' in window))return;
 const observer=new IntersectionObserver(entries=>{
  if(jobsObserver===observer&&entries.some(entry=>entry.isIntersecting&&entry.target.isConnected))loadMoreJobs();
 },{rootMargin:'0px 0px 320px 0px'});
 jobsObserver=observer;observer.observe(sentinel);
}
function loadMoreJobs() {
 const grid=$('.job-section .jobs-grid'),sentinel=$('#jobs-load-more');
 if(ui.route!=='jobs'||ui.modal||!grid||!sentinel||ui.limit>=currentJobResults.length)return;
 const start=ui.limit,hadFocus=sentinel.contains(document.activeElement);
 jobsObserver?.disconnect();jobsObserver=null;
 ui.limit=Math.min(start+ui.pageSize,currentJobResults.length);
 // Append only the next batch so existing cards, focus and scroll stay in place.
 grid.insertAdjacentHTML('beforeend',currentJobResults.slice(start,ui.limit).map(jobCard).join(''));
 document.querySelectorAll('[data-job-visible]').forEach(el=>{el.textContent=String(ui.limit);});
 sentinel.innerHTML=jobLoadMoreContent();
 if(hadFocus)grid.children[start]?.querySelector('.job-title')?.focus({preventScroll:true});
 observeJobList();
}
function jobCard(j) {
 const fit=matchJob(j,state.profile);const saved=state.saved.includes(j.id);
 return `<article class="job-card"><div class="job-card-top">${companyLogo(j)}<span class="job-type">${trackName(j.track)}</span><button class="icon-button bookmark ${saved?'saved':''}" data-action="save-job" data-id="${j.id}" aria-label="${saved?'取消收藏':'收藏'} ${e(j.title)}" aria-pressed="${saved}">${icon('bookmark')}</button></div><button class="job-title" data-action="job-detail" data-id="${j.id}">${e(j.title)}</button><div class="company-name">${e(j.company)} <span>· ${e(j.category)}</span></div><div class="job-meta"><span>${icon('pin')}${e(j.location)}</span><span>${icon('briefcase')}${e(j.work)}</span></div><p class="job-provenance ${jobSourceKind(j)==='discovered'?'pending':''}">${!j.active?'已下架 · 历史记录':jobSourceKind(j)==='discovered'?'官网检索 · 招聘状态待核验':jobSourceKind(j)==='manual'?'手动导入 · 请核对原文':'官网同步'+(j.descriptionKind==='summary'?' · 职位摘要':'')}</p><div class="salary">${e(j.salary)} <small>${e(j.currency)}</small></div><div class="tags">${j.tags.map(t=>`<span class="${fit.matched.includes(t)?'tag-match':''}">${e(t)}</span>`).join('')}</div><div class="job-card-bottom"><div class="match-label">${icon('spark')}<strong>${fit.score}%</strong><span>${fit.role?'规则匹配':'职位方向不同'}</span></div><button class="job-detail-link" data-action="job-detail" data-id="${j.id}" aria-label="查看 ${e(j.title)} 详情">查看详情 ${icon('arrow')}</button></div></article>`;
}
function dashboardPage() {
 const recommended=filterJobs(JOBS.filter(j=>j.active),state.profile,{sort:'match'}).slice(0,3);
 return `${title(`你好，${e(state.profile.name||'求职者')}。`,'你的每一步，都在靠近更合适的下一站。',`<button class="button primary" data-action="nav" data-route="jobs">发现新机会 ${icon('arrow')}</button>`)}<div class="stats-row">${stat('bookmark','收藏机会',state.saved.length,'已经心动的岗位')}${stat('file','已生成简历',state.resumes.length,'逐一为机会做准备','blue')}${stat('check','已审核简历',state.resumes.filter(r=>r.status==='reviewed').length,'可以进入投递流程','green')}${stat('briefcase','投递记录',state.applications.length,'记录你的求职旅程','peach')}</div>
 <section class="panel journey-panel"><div class="section-title"><h2>你的求职路径</h2><span class="muted">一步一步，把机会变成可能</span></div><div class="journey-steps">${[['user','01','建立个人档案','让你的经历成为推荐的起点','profile'],['search','02','发现心动岗位','从中国到北美，找到你的方向','jobs'],['file','03','准备专属简历','围绕岗位要求，突出真实经历','resumes'],['briefcase','04','审核并投递','确认每个细节，再迈出下一步','tracker']].map(([i,n,h,p,r])=>`<button class="journey-step" data-action="nav" data-route="${r}"><span class="step-number">${n}</span>${icon(i)}<h3>${h}</h3><p>${p}</p></button>`).join('')}</div></section>
 ${sourceCoverage(discoverySummary(JOBS,state.profile))}<div class="section-title margin-top"><h2>值得关注的机会 <span class="count">${recommended.length}</span></h2><button class="text-button" data-action="nav" data-route="jobs">查看全部 ${icon('arrow')}</button></div><div class="jobs-grid">${recommended.map(jobCard).join('')}</div><p class="data-disclaimer">请在岗位原文中核实最新招聘状态。</p>`;
}
function profilePage() {
 const p=ui.drafts[ui.profileId]||state.profile;
 const trackFields=profileTrackFields(p.track);
 return `${title('一个你，可以有多个求职方向。','按市场和职位分别整理画像，让每份简历都有明确的出发点。',`<div class="button-row"><button class="button secondary" data-action="copy-profile">复制当前画像</button><button class="button primary" data-action="new-profile">${icon('plus')} 新建画像</button></div>`)}${profileSelector('edit')}<div class="profile-management"><span>共 ${state.profiles.filter(p=>!p.archived).length} 份可用画像</span><button class="text-button" data-action="archive-profile" ${state.profiles.filter(p=>!p.archived).length<2?'disabled':''}>归档当前画像</button></div>${state.profiles.some(p=>p.archived)?`<details class="archived-profiles"><summary>已归档画像（保留历史简历和记录）</summary>${state.profiles.filter(p=>p.archived).map(p=>`<div><span>${e(p.label)}</span><button class="text-button" data-action="restore-profile" data-id="${p.id}">恢复使用</button></div>`).join('')}</details>`:''}<form id="profile-form" data-id="${p.id}" data-revision="${p.revision}" class="profile-layout"><div class="profile-form panel"><div class="section-title"><h2>${icon('user')} ${e(p.label)}</h2><span class="badge lilac">${profileCompletion(p)}% 已完善</span></div><p class="field-help" id="profile-draft-note">${ui.drafts[p.id]?'有未保存修改；搜索和生成使用已保存版本。':'每份画像独立保存。可以复制真实经历，再调整面向不同岗位的重点。'}</p><div class="form-grid"><label>画像名称 <span class="required">*</span><input name="label" required maxlength="100" value="${e(p.label)}" placeholder="例如：加拿大 · Data Engineer"/></label><label>招聘地点范围<select name="searchScope">${scopeOptions(p)}</select></label><input type="hidden" name="market" value="${e(p.market)}"/><label>默认简历语言<select name="resumeLanguage"><option value="zh" ${p.resumeLanguage==='zh'?'selected':''}>中文</option><option value="en" ${p.resumeLanguage==='en'?'selected':''}>English</option></select></label><label>姓名 <span class="required">*</span><input name="name" required maxlength="80" value="${e(p.name)}"/></label><label>联系邮箱 <span class="required">*</span><input name="email" required type="email" maxlength="120" value="${e(p.email)}"/></label><label>所在城市<input name="location" maxlength="120" value="${e(p.location)}"/></label><label>联系电话 <span class="optional">选填</span><input name="phone" maxlength="60" value="${e(p.phone)}" placeholder="用于简历联系方式"/></label><label>求职阶段<select name="track"><option value="campus" ${p.track==='campus'?'selected':''}>校园招聘 / 实习</option><option value="experienced" ${p.track==='experienced'?'selected':''}>社会招聘</option></select></label><label>目标职位<input name="target" maxlength="160" value="${e(p.target)}" placeholder="例如：Data Engineer / Software Engineer"/></label></div><p class="field-help">${trackFields.guide}</p><div class="form-section"><h2>${icon('bolt')} 专业技能</h2><label><span class="field-help">使用逗号分隔，岗位匹配会参考这些技能</span><input name="skills" maxlength="1000" value="${e(p.skills.join(', '))}" placeholder="Figma, SQL, Python, 用户研究"/></label></div>${[['education','book','教育经历','学校、专业、学位、时间、相关课程'],['experience','briefcase',...trackFields.experience],['projects','file',...trackFields.projects],['preferences','globe','求职偏好','期望城市、行业、办公方式或其他条件']].map(([key,ico,label,placeholder])=>`<div class="form-section"><h2>${icon(ico)} ${label}</h2><textarea name="${key}" rows="${key==='preferences'?3:5}" maxlength="12000" ${key==='education'?'required':''} placeholder="${placeholder}" aria-label="${label}">${e(p[key])}</textarea></div>`).join('')}<div class="form-footer"><span>${icon('shield')} 档案保存在本机 SQLite 数据库</span><button class="button primary" type="submit">${icon('check')} 保存当前画像</button></div></div><aside class="profile-aside"><div class="panel tips-panel"><span class="tip-icon">${icon('spark')}</span><h3>你的经历，就是最好的起点。</h3><p>无需一次写得完美。先记录事实，再为不同岗位选择最相关的内容。</p><ul><li>用清晰的动词说明你做了什么</li><li>写出能够核实的成果或数据</li><li>校招可以突出课程与项目</li><li>社招可以突出职责与工作成果</li></ul></div><div class="notice"><b>请填写你自己的真实经历</b><p>这里不会预填虚构经历。点击生成前，会让你确认将哪些数据发给所选 AI 服务。</p></div><button class="button secondary full-width" type="button" data-action="import-text">${icon('download')} 导入经历文本</button><input type="file" id="profile-file" accept=".txt,.md,text/plain,text/markdown" hidden/></aside></form>`;
}
function resumesPage() {
 const resumes=records(state.resumes);
 return `${title('每个机会，都有专属表达。','从真实经历出发，整理、审核，再安心投递。',`<button class="button primary" data-action="nav" data-route="jobs">${icon('plus')} 为新岗位准备简历</button>`)}${recordFilter()}${resumes.length?`<div class="resume-list">${resumes.map(r=>`<article class="resume-card panel"><div class="resume-mini">${icon('file')}<span></span><span></span><span></span></div><div class="resume-card-info"><span class="badge ${r.status==='reviewed'?'mint':'lilac'}">${r.status==='reviewed'?'已审核':'待审核'}</span><h3>${e(r.title)}</h3><p class="source-profile">来源画像：${e(sourceLabel(r))}</p><p>${r.language==='en'?'English':'中文'} · ${date(r.createdAt)} 创建 · ${e(providerName(r.mode))} 生成</p><div class="resume-card-actions"><button class="button secondary" data-action="resume-detail" data-id="${r.id}">${icon('file')} ${r.status==='reviewed'?"导出简历":"编辑与审核"}</button><button class="icon-button danger-text" data-action="delete-resume" data-id="${r.id}" aria-label="删除 ${e(r.title)}">${icon('trash')}</button></div></div></article>`).join('')}</div>`:empty('你的第一份专属简历，正在等你。','先选择一个心动的岗位，再点击「生成专属简历」。')}`;
}
function trackerPage() {
 const applications=records(state.applications);
 return `${title('每次出发，都留下足迹。','记录进度、整理反馈，让下一次投递更从容。',`<button class="button secondary" data-action="nav" data-route="jobs">${icon('plus')} 添加求职机会</button>`)}${recordFilter()}${applications.length?`<div class="tracker-grid">${['准备中','已投递','面试中','已结束'].map(status=>`<section class="tracker-column"><h2><i class="status-dot status-${status}"></i>${status}<span>${applications.filter(a=>a.status===status).length}</span></h2>${applications.filter(a=>a.status===status).map(a=>{const j=jobById(a.jobId);return `<article class="application-card"><div class="application-company">${companyLogo(j,true)}<strong>${e(j.company)}</strong></div><h3>${e(j.title)}</h3><p class="source-profile">${e(sourceLabel(a))}</p><small>${icon('pin')} ${e(j.location)}</small><label>更新进度<select data-application="${a.id}" aria-label="${e(j.company)} 投递状态">${['准备中','已投递','面试中','已结束'].map(s=>`<option ${s===a.status?'selected':''}>${s}</option>`).join('')}</select></label><button class="text-button" data-action="job-detail" data-profile-id="${a.profileId}" data-id="${j.id}">岗位与简历 ${icon('arrow')}</button></article>`;}).join('')||'<p class="column-empty">下一个机会，即将到来</p>'}</section>`).join('')}</div><p class="data-disclaimer">进度由你手动记录。标记「已投递」前需要审核该岗位、该画像的简历；本产品不会自动提交求职申请。</p>`:empty('把求职进度，放在同一个地方。','在岗位详情中点击「加入投递计划」，开始记录下一次机会。')}`;
}
function creditsPage() {
 return `${title('每次生成，都有记录。','任务状态由后端保存；刷新页面后可以继续查看。')}${recordFilter()}<div class="panel transactions"><div class="table-scroll"><table><thead><tr><th>岗位 / 来源画像</th><th>服务 / 模型</th><th>时间</th><th>结果</th></tr></thead><tbody>${records(state.tasks).map(t=>`<tr><td>${e(jobById(t.jobId)?.title||t.jobId)}<br/><small>${e(sourceLabel(t))}</small></td><td>${e(providerName(t.provider))}<br/><small>${e(t.model)}</small></td><td>${date(t.createdAt)}</td><td>${t.status==='completed'?`<button class="text-button" data-action="resume-detail" data-id="${t.resumeId}">打开简历</button>`:t.status==='running'?`<button class="text-button" data-action="resume-task" data-id="${t.id}">生成中 · 查看</button>`:`<span class="danger-text">${e(t.error)}</span>`}</td></tr>`).join('')||'<tr><td colspan="4">还没有生成任务。</td></tr>'}</tbody></table></div></div><div class="notice margin-top"><b>平台积分购买暂未开放</b><p>本机 Cursor 使用本机账号额度；自带 Key 使用对应厂商账户额度。平台计费功能在接通账户、支付及服务端余额校验后开放。</p></div><button class="button secondary" data-action="refresh">刷新任务状态</button>`;
}
function settingsPage() {
 const current=state.settings, selected=ui.provider||current.provider;
 const p=state.providers.find(p=>p.id===selected);
 const models=ui.models.filter(m=>!ui.freeOnly||m.free);
 return `${title('让 AI 按你的方式工作。','本机 Cursor 与用户自带 Key 分开使用，平台代付功能尚未开放。')}<div class="settings-layout"><form id="settings-form" class="panel settings-panel"><h2>${icon('spark')} 生成设置</h2><label>使用方式<select name="provider" id="provider-select"><option value="cursor" ${selected==='cursor'?'selected':''}>本机 Cursor（使用自己的订阅）</option>${state.providers.map(p=>`<option value="${p.id}" ${selected===p.id?'selected':''}>${p.name} · 自带 Key</option>`).join('')}<option disabled>平台积分 · 尚未开放</option></select></label>${selected==='cursor'?`<div class="notice"><b>仅使用本机 Cursor 登录</b><p>克隆代码不会带走你的登录信息。生成需要本机配置开启且 CLI 已登录。</p></div><button type="button" class="button secondary" data-action="cursor-status">检查 Cursor 登录</button><p id="cursor-status" class="field-help">未检测登录状态</p><input name="model" value="auto" type="hidden"/>`:`<p class="field-help">${e(p.note)}</p><label>你的 API Key <span class="badge ${p.configured?'mint':'neutral'}">${p.configured?'已配置（本次运行）':'未配置'}</span><input id="api-key" type="password" autocomplete="new-password" spellcheck="false" placeholder="输入你自己的 Key，保存后立即清空输入框" maxlength="2048"/></label><div class="button-row"><button type="button" class="button secondary" data-action="save-key">保存 Key</button><button type="button" class="text-button" data-action="clear-key">清除 Key</button><a class="text-button" href="${p.console}" target="_blank" rel="noopener noreferrer">获取自己的 Key ↗</a></div><p class="field-help">Key 仅保存在当前后端进程内存；不写入数据库、浏览器存储、备份或 Git。服务重启需重新输入。</p><div class="button-row"><button type="button" class="button secondary" data-action="load-models">加载可用模型</button><a class="text-button" href="${p.pricing}" target="_blank" rel="noopener noreferrer">厂商价格 / 限额 ↗</a></div>${selected==='openrouter'?`<label class="inline-check"><input type="checkbox" id="free-models" ${ui.freeOnly?'checked':''}/> 只显示并调用已确认免费的模型</label>`:''}<label>选择模型<select name="model" required><option value="">请先加载模型并选择</option>${current.provider===selected&&current.model!=='auto'&&!models.some(m=>m.id===current.model)?`<option selected value="${e(current.model)}">${e(current.model)}（已保存）</option>`:''}${models.map(m=>`<option value="${e(m.id)}" ${m.id===current.model?'selected':''}>${e(m.name)}${m.free?' · 免费（有限额）':''}</option>`).join('')}</select></label><p class="field-help">不会自动切换厂商或付费模型。免费模型可能限流、下架或更改价格。</p>`}<label>新画像初始语言（已有画像使用自身设置）<select name="language"><option value="zh" ${current.language==='zh'?'selected':''}>中文</option><option value="en" ${current.language==='en'?'selected':''}>English</option></select></label><button class="button primary" type="submit">保存生成设置</button></form><section class="panel settings-panel"><h2>${icon('globe')} 真实岗位来源</h2>${state.sources.map(s=>`<div class="provider-row"><div><b>${e(s.company)}</b><p>${e(s.provider)} / ${e(s.slug)}<br/>${e(s.status)} · ${s.count} 个岗位${s.syncNote?'<br/>'+e(s.syncNote):''}${s.note?'<br/>'+e(s.note):''} ${s.syncedAt?'· '+date(s.syncedAt):''}${s.error?'<br/>'+e(s.error):''}</p></div></div>`).join('')}<div class="button-row"><button class="button primary" data-action="sync-jobs">同步所有岗位源</button><button class="button secondary" data-action="add-source">添加企业招聘板</button></div><p class="field-help">内置热门公司官网来源，并支持新增 Greenhouse / Lever 招聘板。已同步、部分同步、待接通和失败分别显示；同步失败保留上次数据。</p></section><section class="panel settings-panel"><h2>${icon('shield')} 本地数据与备份</h2><p>SQLite 保存档案、岗位、简历版本与投递记录。旧演示记录仍保留在原浏览器存储中，不会自动混入真实档案。</p><div class="button-row"><button class="button secondary" data-action="export-backup">导出数据 JSON</button><button class="button secondary" data-action="export-legacy">导出旧演示记录</button></div><p class="field-help">完整恢复：关闭程序后备份 .runtime/foundmyjob.sqlite 文件。JSON 导出用于阅读和迁移，不包含密钥。</p></section><section class="panel settings-panel"><h2>运行范围</h2><p>当前版本用于单用户本机。网页只连接 127.0.0.1；其他用户在自己的电脑上配置自己的账号。</p><p>在线多人版本需要独立账户、加密密钥库、支付回调和服务端额度账本，当前不开放平台代付。</p></section></div>`;
}
function render() {
 jobsObserver?.disconnect();jobsObserver=null;
 const page={jobs:jobsPage,dashboard:dashboardPage,profile:profilePage,resumes:resumesPage,tracker:trackerPage,credits:creditsPage,settings:settingsPage}[ui.route];
 $('#app').innerHTML=`${sidebar()}<div class="app-content">${header()}<main id="main">${storageWarning?`<div class="notice warning">${e(storageWarning)}</div>`:''}${page()}<footer class="app-footer"><span>FoundMyJob<span class="brand-dot">.</span> <span class="footer-motto">属于你的机会，正在前方。</span></span><span>Made for your next chapter <span class="footer-star">✦</span></span></footer></main></div>`;
 document.title=`${routes[ui.route]} · FoundMyJob`;
 if(ui.route==='jobs')observeJobList();
}

let returnFocus;
function modal(title,html,wide=false) {
 if(!$('dialog'))returnFocus=document.activeElement;
 $('#modal-root').innerHTML=`<dialog class="modal ${wide?'wide':''}" aria-labelledby="modal-title"><div class="modal-header"><h2 id="modal-title">${title}</h2><button class="icon-button" data-action="close-modal" aria-label="关闭对话框">${icon('close')}</button></div>${html}</dialog>`;
 const dialog=$('dialog');dialog.showModal();dialog.addEventListener('click',event=>{if(event.target===dialog){const b=dialog.getBoundingClientRect();if(event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom)closeModal();}});dialog.addEventListener('cancel',event=>{if(ui.generating)event.preventDefault();else{ui.modal=null;observeJobList();}});
}
function closeModal() {if(ui.generating){toast('正在整理简历，请稍等片刻。');return;} $('dialog')?.close();$('#modal-root').innerHTML='';ui.modal=null;returnFocus?.focus();observeJobList();}
function showJob(id,profileId=ui.profileId) {
 const j=jobById(id);if(!j)return;const p=state.profiles.find(p=>p.id===profileId);if(!p)return;ui.modal={type:'job',id,profileId:p.id,profileRevision:p.revision};const fit=matchJob(j,p);
 const existing=state.resumes.filter(r=>r.jobId===id&&r.profileId===p.id);
 modal('机会详情',`<div class="job-modal-body"><div class="detail-title">${companyLogo(j)}<div><h3>${e(j.title)}</h3><p>${e(j.company)} · ${e(j.location)}</p></div><span class="badge lilac">${j.active?e(j.sourceName):'上次同步已下架'}</span></div><div class="detail-meta"><span>${e(j.salary)}</span><span>${e(j.work)}</span><span>${trackName(j.track)}</span></div><div class="detail-columns"><div><h4>${j.descriptionKind==='summary'?'岗位摘要':'关于这个机会'}</h4>${j.descriptionKind==='summary'?'<div class="notice"><b>岗位摘要 · 申请前请核验原文</b><p>以下为官网职位的摘要，完整职责、要求和当前招聘状态请打开原文确认。</p></div>':''}<p class="job-description">${e(j.description)}</p><h4>我们期待的你</h4><ul>${j.requirements.map(r=>`<li>${e(r)}</li>`).join('')}</ul><a class="text-button" href="${e(j.url)}" target="_blank" rel="noopener noreferrer">打开岗位原文 ${icon('external')}</a><p class="field-help">来源：${e(j.sourceName)} · ${jobSourceKind(j)==='synced'?'同步于':'收录于'} ${date(j.syncedAt)}。申请前请核对原文是否仍在招聘。</p></div><aside class="fit-panel"><span>${icon('spark')} 与「${e(p.label)}」匹配</span><strong>${fit.score}<small>%</small></strong><div class="progress-bar"><i style="width:${fit.score}%"></i></div><p>职位方向${fit.role?'相符':'不同'} · 技能重合 ${fit.matched.length}/${j.tags.length} · ${fit.sameTrack?'求职阶段一致':'求职阶段不同'}</p><div class="tags">${fit.matched.map(t=>`<span class="tag-match">✓ ${e(t)}</span>`).join('')}</div>${fit.missing.length?`<h5>可以进一步确认</h5><p>${fit.missing.map(e).join('、')}</p>`:''}<small>基于技能、目标方向与求职阶段的规则计算，不代表录用概率。</small></aside></div>${existing.length?`<div class="existing-resumes"><h4>「${e(p.label)}」已为这个岗位准备 ${existing.length} 份简历</h4>${existing.map(r=>`<button class="text-button" data-action="resume-detail" data-id="${r.id}">${icon('file')}${date(r.createdAt)} · ${r.status==='reviewed'?'已审核':'待审核'}${icon('arrow')}</button>`).join('')}</div>`:''}<div class="generation-controls"><label class="generation-profile">生成使用的画像<select id="generation-profile">${profileOptions(p.id)}${p.archived?`<option value="${p.id}" selected>${e(p.label)}（已归档）</option>`:''}</select></label><p class="profile-generation-note">${e(p.target||'未填写目标职位')} · ${scopeNames[profileSearchScope(p)]} · 仅使用这份画像已保存的经历${p.archived?'（请先恢复画像再生成）':''}</p><label>简历语言<select id="resume-language"><option value="zh" ${p.resumeLanguage==='zh'?'selected':''}>中文</option><option value="en" ${p.resumeLanguage==='en'?'selected':''}>English</option></select></label><p>${icon('info')} ${e(providerName(state.settings.provider))} · ${e(state.settings.model)}</p><label class="inline-check"><input type="checkbox" id="generation-consent"/> 我同意把「${e(p.label)}」与岗位要求发送给该服务，并使用该账户额度</label></div></div><div class="modal-footer"><button class="button secondary" data-action="track-job" data-id="${id}">${icon('plus')} ${state.applications.some(a=>a.jobId===id&&a.profileId===p.id)?'已加入投递计划':'加入投递计划'}</button><button class="button primary" data-action="generate" data-id="${id}" ${p.archived?'disabled':''}>${icon('spark')} 生成专属简历 </button></div>`,true);
}
function showResume(id,view='auto') {
 const r=state.resumes.find(x=>x.id===id);if(!r){toast('这份简历已被删除。');return;}
 const exportView=r.status==='reviewed'&&view!=='edit';
 ui.modal={type:'resume',id,view:exportView?'export':'edit'};
 if(exportView){
  const layout=normalizeResumeLayout(r.layout);
  modal('已审核',`
   <div class="resume-export-intro"><span class="badge mint">已审核</span><strong>${e(r.title)}</strong><p>已审核，可以导出并自行投递。</p></div>
   <div class="resume-export-preview"><article class="resume-paper layout-${layout}">${markdownToHtml(r.content,layout)}</article></div>
   <div class="modal-footer studio-footer"><button class="button secondary" data-action="edit-reviewed-resume" data-id="${id}">${icon('edit')} 编辑内容</button><div class="button-row"><button class="button secondary" data-action="download-resume" data-id="${id}">${icon('download')} 保存 Markdown</button><button class="button primary" data-action="print-resume" data-id="${id}">${icon('download')} 保存 PDF / 打印</button></div></div>`,true);
  return;
 }
 const layout=normalizeResumeLayout(r.layout);
 modal('简历工作室',`
  <div class="studio-toolbar"><div><strong>${e(r.title)}</strong><p class="source-profile">来源画像：${e(sourceLabel(r))}${r.profileRevision?` · 版本 ${r.profileRevision}`:''}</p><span class="badge ${r.status==='reviewed'?'mint':'lilac'}">${r.status==='reviewed'?'已审核':'待审核'}</span></div><span class="muted">${e(providerName(r.mode))} 生成 · 需核实事实</span></div>
  ${resumeLayoutPickerHtml(r.layout)}
  <div class="studio"><section class="studio-editor"><div class="editor-label">${icon('edit')} 编辑内容 <span>支持简单 Markdown</span></div><textarea id="resume-editor" aria-label="简历内容" maxlength="40000" spellcheck="false">${e(r.content)}</textarea><div class="review-notes"><h4>${icon('info')} 审核提示</h4><ul>${r.notes.map(n=>`<li>${e(n)}</li>`).join('')}</ul></div></section><section class="studio-preview"><div class="preview-label">简历预览 <span>A4 · 可打印为 PDF</span></div><article class="resume-paper layout-${layout}" id="resume-preview">${markdownToHtml(r.content,layout)}</article></section></div>
  <div class="review-check"><label><input type="checkbox" id="review-confirm" ${r.status==='reviewed'?'checked':''}/> 我已逐项确认经历、技能和联系方式真实准确</label><small>修改内容后需重新审核；导出不代表已投递。</small></div>
  <div class="modal-footer studio-footer"><button class="button secondary" data-action="save-resume" data-id="${id}">保存修改</button><button class="button primary" data-action="review-resume" data-id="${id}">${icon('check')} 确认审核完成</button></div>`,true);
}
function download(name,text,type='text/plain;charset=utf-8') { const url=URL.createObjectURL(new Blob([text],{type}));const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
async function saveCurrentResume(id,review=false) {
 const r=state.resumes.find(r=>r.id===id),content=$('#resume-editor')?.value??r.content;
 const layout=normalizeResumeLayout(document.querySelector('input[name="resume-template"]:checked')?.value??r.layout);
 if(content!==r.content||layout!==normalizeResumeLayout(r.layout)||review)await update('/api/resumes/save',{id,content,layout,review,revision:r.revision});
 return state.resumes.find(r=>r.id===id);
}
async function pollTask(id) {
 ui.generating=true;
 modal('正在生成专属简历',`<div class="generation-progress"><div class="loading-orb">${icon('spark')}</div><h3>正在结合岗位要求整理真实经历</h3><p>模型通常需要一到两分钟。任务已保存，刷新后可在「生成记录」查看。</p></div>`);
 try {let task;for(;;){task=await api('/api/tasks/'+encodeURIComponent(id));if(task.status!=='running')break;await new Promise(r=>setTimeout(r,1800));}await refresh();ui.generating=false;closeModal();render();if(task.status==='failed')throw new Error(task.error);showResume(task.resumeId);toast('简历已保存到数据库，请审核每一项事实。');}
 finally{ui.generating=false;}
}
async function generate(id) {
 if(ui.generating)return;
 if(!$('#generation-consent')?.checked)throw new Error('请先确认数据发送与账户额度使用。');
 const task=await api('/api/generate',{...state.settings,language:$('#resume-language').value,jobId:id,profileId:ui.modal.profileId,profileRevision:ui.modal.profileRevision,requestId:uid(),consent:true});
 await pollTask(task.id);
}
async function printResume(id) {
 const r=state.resumes.find(resume=>resume.id===id);
 if(r?.status!=='reviewed')throw new Error('请先逐项审核并勾选确认。');
 const win=window.open('','_blank');if(!win)throw new Error('请允许打印窗口后重试。');
 try {
  let printRequested=false;
  const requestPrint=()=>{if(printRequested)return;printRequested=true;win.print();};
  win.addEventListener('load',requestPrint,{once:true});
  win.document.write(resumePrintDocumentHtml({...r,buttonLabel:'打印 / 保存 PDF'},markdownToHtml));
  win.document.close();
  win.document.getElementById('print').addEventListener('click',requestPrint);
  if(win.document.readyState==='complete')requestPrint();
  win.opener=null;
  closeModal();render();
 }catch(err){win.close();throw err;}
}
function importJob() {modal('导入真实岗位',`<form id="import-job-form" class="dialog-content"><div class="form-grid"><label>公司<input name="company" required maxlength="200"/></label><label>职位<input name="title" required maxlength="200"/></label><label>地点<input name="location" required maxlength="200"/></label><label>岗位原文链接<input name="url" type="url" required placeholder="https://..."/></label><label>地区<select name="region"><option value="cn">中国大陆</option><option value="ca">加拿大</option><option value="us">美国</option><option value="na">北美（国家未注明）</option><option value="other">其他</option></select></label><label>类型<select name="track"><option value="unknown">未注明</option><option value="campus">校招 / 实习</option><option value="experienced">社招</option></select></label></div><label>完整岗位描述<textarea name="description" required rows="10" maxlength="24000" placeholder="粘贴职责、要求和申请条件；不会自动绕过招聘网站登录"></textarea></label><button class="button primary" type="submit">保存到岗位库</button></form>`,true);}

const actions={
 'new-profile':()=>profileDialog(),
 'copy-profile':()=>profileDialog(true),
 'archive-profile':async()=>{if(ui.drafts[ui.profileId])throw new Error('请先保存当前画像再归档。');await update('/api/profiles/archive',{id:ui.profileId,revision:state.profile.revision,archived:true});render();toast('画像已归档，历史简历与记录保留，可随时恢复。');},
 'restore-profile':async el=>{const p=state.profiles.find(p=>p.id===el.dataset.id);await update('/api/profiles/archive',{id:p.id,revision:p.revision,archived:false});chooseProfile(p.id);render();toast('画像已恢复。');},
 'nav':el=>go(el.dataset.route),
 'menu':()=>{ui.mobileMenu=!ui.mobileMenu;$('.sidebar').classList.toggle('is-open',ui.mobileMenu);},
 'notifications':()=>modal('本地使用流程','<div class="dialog-content"><p>填写个人档案 → 同步或导入真实岗位 → 选择 AI 服务 → 生成、编辑与审核简历 → 导出并自行投递。</p><p>档案与简历保存在本机数据库。只有点击生成并确认后，才会将档案发送给所选 AI 服务。</p></div>'),
 'saved-filter':el=>{ui.savedOnly=el.dataset.value==='saved';ui.limit=ui.pageSize;render();},
 'company-filter':el=>{ui.company=el.dataset.company||'';ui.limit=ui.pageSize;render();},
 'clear-filters':()=>{const pageSize=ui.pageSize;Object.assign(ui,defaultJobFilters(),{pageSize,limit:pageSize});render();},
 'toggle-companies':el=>{ui.companiesOpen=!ui.companiesOpen;el.setAttribute('aria-expanded',String(ui.companiesOpen));$('#company-content').hidden=!ui.companiesOpen;el.querySelector('[data-company-toggle-label]').textContent=ui.companiesOpen?'收起':'展开';},
 'more-jobs':()=>loadMoreJobs(),
 'refresh':async()=>{await refresh();render();},
 'save-job':async el=>{await update('/api/jobs/save',{id:el.dataset.id,saved:!state.saved.includes(el.dataset.id)});render();},
 'job-detail':el=>showJob(el.dataset.id,el.dataset.profileId||ui.profileId), 'close-modal':closeModal, 'generate':el=>generate(el.dataset.id),
 'resume-detail':el=>showResume(el.dataset.id), 'resume-task':el=>pollTask(el.dataset.id),
 'track-job':async el=>{const profileId=ui.modal.profileId;await update('/api/applications',{jobId:el.dataset.id,profileId});render();showJob(el.dataset.id,profileId);toast('已加入投递计划。');},
 'save-resume':async el=>{await saveCurrentResume(el.dataset.id);render();showResume(el.dataset.id,'edit');toast('简历已保存。内容变更后需要重新审核。');},
 'review-resume':async el=>{if(!$('#review-confirm').checked)throw new Error('请先逐项审核并勾选确认。');await saveCurrentResume(el.dataset.id,true);render();showResume(el.dataset.id,'export');toast('已审核，可以导出并自行投递。');},
 'edit-reviewed-resume':el=>showResume(el.dataset.id,'edit'),
 'download-resume':el=>{const r=state.resumes.find(resume=>resume.id===el.dataset.id);if(r?.status!=='reviewed')throw new Error('请先逐项审核并勾选确认。');download(`FoundMyJob-${r.title.replace(/[<>:"/\\|?*]/g,'-')}.md`,orderResumeMarkdown(r.content,normalizeResumeLayout(r.layout)),'text/markdown;charset=utf-8');closeModal();render();toast('简历已导出。');},
 'print-resume':el=>printResume(el.dataset.id),
 'delete-resume':el=>modal('删除这份简历？',`<div class="dialog-content"><p>此简历及历史版本将被删除，投递记录保留。</p><button class="button danger" data-action="confirm-delete" data-id="${el.dataset.id}">确认删除</button></div>`),
 'confirm-delete':async el=>{await update('/api/resumes/delete',{id:el.dataset.id});closeModal();render();toast('简历已删除。');},
 'import-text':()=>$('#profile-file').click(), 'import-job':importJob,
 'export-backup':()=>{const {token,providers,capabilities,profile,...data}=state;download('FoundMyJob-data.json',JSON.stringify(data,null,2),'application/json');toast('已导出数据，不包含 Key 或登录信息。');},
 'export-legacy':()=>{const old=localStorage.getItem('foundmyjob:demo:v1');if(!old)throw new Error('当前浏览器没有旧演示记录。');download('FoundMyJob-legacy-demo.json',old,'application/json');},
 'cursor-status':async()=>{$('#cursor-status').textContent='正在检查…';const r=await api('/api/cursor/status');$('#cursor-status').textContent=r.message;},
 'save-key':async()=>{const key=$('#api-key').value;await update('/api/credentials',{provider:ui.provider,key});$('#api-key').value='';render();toast('Key 已存入本机服务内存，不会写入文件。');},
 'clear-key':async()=>{await update('/api/credentials',{provider:ui.provider,remove:true});render();toast('已清除当前服务的 Key。');},
 'load-models':async()=>{toast('正在获取厂商模型列表…');ui.models=(await api('/api/models?provider='+ui.provider)).models;render();toast(`获取 ${ui.models.length} 个模型，请选择并保存。`);},
 'sync-jobs':async el=>{
  if(ui.syncing||state.syncing)throw new Error('岗位正在同步，请稍候。');
  ui.syncing=true;render();toast('正在同步官网职位…');
  let polling=false;
  const timer=setInterval(async()=>{if(polling)return;polling=true;try{await refresh();if(['jobs','settings'].includes(ui.route)&&!ui.modal)render();}catch{}finally{polling=false;}},4000);
  try{await update('/api/jobs/sync',el.dataset.id?{sourceId:el.dataset.id}:{});const succeeded=state.sources.filter(s=>['已同步','部分同步'].includes(s.status)).length;toast('同步结束：'+succeeded+' 个来源已有职位，库内 '+JOBS.filter(j=>j.active).length+' 条。未接通来源请查看公司状态。');}
  finally{clearInterval(timer);ui.syncing=false;await refresh();render();}
 },
 'add-source':()=>modal('添加企业招聘板',`<form id="source-form" class="dialog-content"><label>招聘系统<select name="provider"><option value="greenhouse">Greenhouse</option><option value="lever">Lever</option></select></label><label>公司名称<input name="company" required maxlength="100"/></label><label>招聘板标识<input name="slug" required pattern="[a-zA-Z0-9_-]+" placeholder="例如 figma，不是完整网址" maxlength="80"/></label><p class="field-help">从公司官方招聘链接中找到 board token；此处不会抓取任意网址。</p><button class="button primary" type="submit">添加来源</button></form>`),
};
document.addEventListener('click',async event=>{const el=event.target.closest('[data-action]');if(!el||el.disabled)return;el.disabled=true;try{await actions[el.dataset.action]?.(el);}catch(error){toast(error.message||'操作失败。');}finally{el.disabled=false;}});
document.addEventListener('submit',async event=>{
 event.preventDefault();const form=event.target,data=Object.fromEntries(new FormData(form)),button=form.querySelector('[type="submit"]');if(button)button.disabled=true;
 try {
  if(form.id==='job-search'){Object.assign(ui,data,{limit:ui.pageSize});render();}
  if(form.id==='profile-form'){await update('/api/profiles/save',{...data,id:form.dataset.id,revision:Number(form.dataset.revision),skills:data.skills.split(/[,，\n]/).map(x=>x.trim()).filter(Boolean)});delete ui.drafts[form.dataset.id];resetProfileSearch();render();toast('当前画像已保存，其他画像不受影响。');}
  if(form.id==='create-profile-form'){const next=await api('/api/profiles/create',data);accept(next);chooseProfile(next.createdProfileId);closeModal();go('profile');toast('画像已创建，请填写或调整真实经历后保存。');}
  if(form.id==='settings-form'){await update('/api/settings',{...data,revision:state.settings.revision,freeOnly:ui.provider==='openrouter'&&ui.freeOnly===true});toast('生成设置已保存。');}
  if(form.id==='import-job-form'){await update('/api/jobs/import',data);closeModal();go('jobs');toast('岗位已保存。');}
  if(form.id==='source-form'){await update('/api/sources',data);closeModal();render();toast('来源已添加，点击同步即可获取岗位。');}
 }catch(err){toast(err.message);}finally{if(button)button.disabled=false;}
});
document.addEventListener('change',async event=>{
 const el=event.target;
 if(el.name==='resume-template'){const preview=$('#resume-preview');if(preview){const layout=normalizeResumeLayout(el.value);preview.className=`resume-paper layout-${layout}`;preview.innerHTML=markdownToHtml($('#resume-editor').value,layout);}}
 try {
  if(el.dataset.profileSelect){chooseProfile(el.value);render();}
  if(el.id==='generation-profile'){const id=ui.modal.id;chooseProfile(el.value);render();showJob(id);}
  if(el.id==='record-profile'){ui.recordProfileId=el.value;render();}
  if(el.closest('#profile-form')){rememberProfileDraft();if(el.name==='track'){render();return;}}
  if(el.id==='job-sort'){ui.sort=el.value;ui.limit=ui.pageSize;render();}
 if(el.id==='job-page-size'){ui.pageSize=el.value==='50'?50:25;ui.limit=ui.pageSize;render();}
 if(el.id==='job-source-kind'){ui.sourceKind=el.value;ui.limit=ui.pageSize;render();}
 if(el.id==='target-only'){ui.targetOnly=el.checked;ui.limit=ui.pageSize;render();}
  if(el.closest('#job-search')&&el.tagName==='SELECT'){Object.assign(ui,Object.fromEntries(new FormData($('#job-search'))),{limit:ui.pageSize});render();}
  if(el.dataset.application){const a=state.applications.find(a=>a.id===el.dataset.application);await update('/api/applications/status',{id:a.id,status:el.value,revision:a.revision});render();toast('投递进度已保存。');}
  if(el.id==='profile-file'&&el.files[0]){if(el.files[0].size>100000)throw new Error('请导入小于 100 KB 的文本文件。');const form=el.closest('#profile-form'),text=await el.files[0].text();form.querySelector('[name="experience"]').value=text;rememberProfileDraft(form);toast('已填入所选画像的经历草稿，请检查并保存。');}
  if(el.id==='provider-select'){ui.provider=el.value;ui.models=[];ui.freeOnly=el.value==='openrouter';render();}
  if(el.id==='free-models'){ui.freeOnly=el.checked;render();}
 }catch(err){toast(err.message);if(el.dataset.application)render();}
});

function rememberProfileDraft(form=$('#profile-form')){
 if(!form)return;
 const data=Object.fromEntries(new FormData(form));
 ui.drafts[form.dataset.id]={...data,id:form.dataset.id,revision:Number(form.dataset.revision),skills:data.skills.split(/[,，\n]/).map(x=>x.trim()).filter(Boolean)};
 form.querySelector('#profile-draft-note').textContent='有未保存修改；搜索和生成使用已保存版本。';
}
window.addEventListener('beforeunload',event=>{if(Object.keys(ui.drafts).length){event.preventDefault();event.returnValue='';}});
document.addEventListener('input',event=>{if(event.target.closest('#profile-form'))rememberProfileDraft();if(event.target.id==='resume-editor'){$('#resume-preview').innerHTML=markdownToHtml(event.target.value,normalizeResumeLayout(document.querySelector('input[name="resume-template"]:checked')?.value));$('#review-confirm').checked=false;}});

async function boot() {
 try{await refresh();ui.provider=state.settings.provider;ui.freeOnly=state.settings.freeOnly===true;render();}
 catch(error){$('#app').innerHTML=`<main class="panel" style="margin:48px"><h1>本地后端未连接</h1><p>${e(error.message)}</p><p>请双击项目中的 Start-FoundMyJob.cmd 启动，再刷新页面。</p><button id="retry" class="button primary">重新连接</button></main>`;$('#retry').addEventListener('click',boot);}
}
boot();
