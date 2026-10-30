import {COUNTRIES,INDUSTRIES,FORTUNE_URL,FORTUNE_YEAR,companyNames,companyKey,companyCareersLink} from './company-catalog.js';
import {t as tr,getLocale,setLocale,localizedLabel} from './i18n.js';
import {COMPANY_LOGOS} from './company-logos.js';
import {profileTrackFields} from './profile-track.js';
import {previewDocumentImport} from './profile-import.js';
import {prepareAvatar} from './user-avatar.js';
import {normalizeResumeLayout,resumeLayoutPickerHtml,resumePrintDocumentHtml} from './resume-layouts.js';
import {orderResumeMarkdown} from './resume-markdown.js';
import {resumeReviewTips} from './resume-review-tips.js';
import {evidencePanelHtml} from './job-evidence-view.js';
import {syncProgressHtml,syncDockHtml,syncDuration,observeSyncDock,dismissSyncProgress} from './sync-progress.js';
import {JOB_COUNTRIES,WORK_PREFERENCES,resolvedJobPreferences,cityOptions,cityEntry,jobInCity,jobInWork} from './job-preferences.js';
import { escapeHtml as e, uid, profileCompletion, matchJob, filterJobs, discoverySummary, profileSearchScope, profileJobFilters, profileSearchSignature, defaultJobFilters, companyDiscoveryGroups, companyJobMatches, companyJobRecommendations, directoryJobFilters, jobInRegion, jobSourceKind, markdownToHtml } from './core.js';

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
const routes={dashboard:'工作台',jobs:'发现岗位',resumes:'我的简历',tracker:'投递追踪',profile:'求职画像',account:'用户中心',credits:'生成记录',settings:'AI 与数据设置'};
const ui={profileId:null,drafts:{},recordProfileId:'',route:routes[location.hash.slice(1)]?location.hash.slice(1):'dashboard',...defaultJobFilters(),companiesOpen:false,generating:false,modal:null,mobileMenu:false,models:[],provider:'cursor',syncing:false,syncProgress:null,syncMonitor:null};
let currentJobResults=[],jobsObserver,syncDockCleanup,avatarSequence=0;
async function api(path,body) {
 const response=await fetch(path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(state?.token?{'X-FMJ-Token':state.token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 let result;try{result=await response.json();}catch{throw new Error(tr('本地后端未响应，请重新运行 Start-FoundMyJob.cmd。'));}
 if(!response.ok)throw new Error(result.error||tr('请求失败。'));return result;
}
function accept(next){
 const previousSearch=state?.profile&&profileSearchSignature(state.profile);
 state=next;JOBS=state.jobs;
 if(!state.profiles)throw new Error(tr('服务需要升级，请停止并重新启动 FoundMyJob。'));
 const previous=ui.profileId;
 if(!ui.profileId){try{ui.profileId=sessionStorage.getItem('foundmyjob:profile');}catch{}}
 state.profile=state.profiles.find(p=>p.id===ui.profileId&&!p.archived)||state.profiles.find(p=>!p.archived);
 ui.profileId=state.profile.id;
 if(previous!==ui.profileId||previousSearch!==profileSearchSignature(state.profile))resetProfileSearch();
}
const marketNames={'':'全部地区',cn:'中国大陆',overseas:'国外',ca:'加拿大',us:'美国',jp:'日本',gb:'英国',fr:'法国',au:'澳大利亚',sg:'新加坡',na:'北美',other:'其他 / 未注明'};
const scopeNames={domestic:'国内',overseas:'国外',all:'国内外均考虑'};
const scopeOptions=profile=>Object.entries(scopeNames).map(([id,label])=>'<option value="'+id+'" '+(profileSearchScope(profile)===id?'selected':'')+'>'+tr(label)+'</option>').join('');
function resetProfileSearch(){Object.assign(ui,profileJobFilters(state.profile));}
function citySelectOptions(country,city='',custom=false){
 const options=cityOptions(country),known=options.some(entry=>entry.value===city);
 return `<option value="">${tr('全部城市','All cities')}</option>${options.map(entry=>`<option value="${e(entry.value)}" ${city===entry.value?'selected':''}>${localizedLabel(entry.labels)}</option>`).join('')}${custom?`<option value="__custom" ${city&&!known?'selected':''}>${tr('其他城市（填写）','Other city (enter name)')}</option>`:city&&!known?`<option value="${e(city)}" selected>${e(city)}</option>`:''}`;
}
function preferenceSummary(profile){
 const prefs=resolvedJobPreferences(profile);
 return [localizedLabel(JOB_COUNTRIES[prefs.country]),prefs.city&&(localizedLabel(cityEntry(prefs.city,prefs.country)?.labels)||prefs.city),localizedLabel(WORK_PREFERENCES[prefs.work])].filter(Boolean).join(' · ');
}
function profileFormData(data){
 const {preferenceCountry,preferenceCity,preferenceCityCustom,preferenceWork,...fields}=data;
 return {...fields,jobPreferences:{country:preferenceCountry||'',city:preferenceCity==='__custom'?preferenceCityCustom||'':preferenceCity||'',work:preferenceWork||''},skills:data.skills.split(/[,，\n]/).map(x=>x.trim()).filter(Boolean)};
}
function jobPreferencesForm(profile){
 const p=resolvedJobPreferences(profile),custom=p.city&&!cityEntry(p.city,p.country);
 return `<div class="form-section job-preferences"><h2>${icon('globe')} ${tr('求职偏好','Job preferences')}</h2><p class="field-help">${tr('保存后，岗位库和热门公司将使用相同的国家、城市和办公方式筛选。','After saving, the job library and featured companies use the same country, city and work arrangement.')}</p><div class="form-grid"><label>${tr('期望国家','Preferred country')}<select name="preferenceCountry"><option value="">${tr('不限国家（按招聘地点范围）','Any country in search scope')}</option>${Object.entries(JOB_COUNTRIES).map(([id,labels])=>`<option value="${id}" ${p.country===id?'selected':''}>${localizedLabel(labels)}</option>`).join('')}</select></label><label>${tr('期望城市','Preferred city')}<select name="preferenceCity" ${p.country?'':'disabled'}>${citySelectOptions(p.country,p.city,true)}</select></label><label ${custom?'':'hidden'}>${tr('其他城市名称','Other city name')}<input name="preferenceCityCustom" value="${custom?e(p.city):''}" maxlength="120" ${custom?'required':''}/></label><label>${tr('办公方式','Work arrangement')}<select name="preferenceWork"><option value="">${tr('不限办公方式','Any work arrangement')}</option>${Object.entries(WORK_PREFERENCES).map(([id,labels])=>`<option value="${id}" ${p.work===id?'selected':''}>${localizedLabel(labels)}</option>`).join('')}</select></label></div><label class="preference-notes">${tr('其他偏好 / 原有备注','Other preferences / existing notes')}<textarea name="preferences" rows="3" maxlength="12000" placeholder="${tr('行业、薪资或其他补充条件','Industry, salary or other preferences')}">${e(profile.preferences)}</textarea></label><p class="field-help">${tr('备注保留原文；地点与办公方式以以上选项为准。','Notes are preserved; the selections above control location and work arrangement.')}</p></div>`;
}
function chooseProfile(id){
 const profile=state.profiles.find(p=>p.id===id&&!p.archived);if(!profile)throw new Error(tr('画像不可用，请刷新。'));
 ui.profileId=id;state.profile=profile;resetProfileSearch();
 try{sessionStorage.setItem('foundmyjob:profile',id);}catch{}
}
function profileOptions(id,includeArchived=false){return state.profiles.filter(p=>includeArchived||!p.archived).map(p=>`<option value="${p.id}" ${p.id===id?'selected':''}>${e(p.label)}${p.archived?tr('（已归档）'):''}</option>`).join('');}
function profileSelector(context='search'){
 const p=state.profile;
 return `<section class="profile-context panel"><label>${context==='edit'?tr('正在编辑的画像'):tr('用于岗位搜索的画像')}<select data-profile-select="${context}">${profileOptions(p.id)}</select></label><div class="profile-context-summary"><strong>${e(p.target||tr('请填写目标职位'))}</strong><span>${e(preferenceSummary(p)||tr(scopeNames[profileSearchScope(p)]))} · ${trackName(p.track)} · ${p.resumeLanguage==='en'?tr('英文'):tr('中文')}${tr("简历")}</span><small>${tr("岗位库和热门公司已同步求职偏好；可临时调整筛选，或恢复画像偏好。","The job library and featured companies follow your preferences. Adjust filters below or restore profile preferences.")}</small></div><button class="button secondary" data-action="nav" data-route="profile">${icon('edit')} ${tr("管理画像")}</button></section>`;
}
function recordFilter(){return `<label class="record-filter">${tr("按来源画像查看")}<select id="record-profile"><option value="">${tr("全部画像")}</option>${profileOptions(ui.recordProfileId,true)}</select></label>`;}
const records=items=>items.filter(item=>!ui.recordProfileId||item.profileId===ui.recordProfileId);
const sourceLabel=item=>item.profileLabel||item.sourceProfile?.label||tr('原求职画像');
function profileDialog(copy=false){
 if(copy&&ui.drafts[ui.profileId])throw new Error(tr('请先保存当前画像的修改，再复制。'));
 const p=state.profile;
 modal(copy?tr('复制求职画像'):tr('新建求职画像'),`<form id="create-profile-form" class="dialog-content"><input type="hidden" name="copyFrom" value="${copy?p.id:''}"/><label>${tr("画像名称")}<input name="label" required maxlength="100" placeholder="${tr("例如：加拿大 · Data Engineer")}" value="${copy?e(p.label.slice(0,94)+tr(' · 副本')):''}"/></label><label>${tr("招聘地点范围")}<select name="searchScope">${scopeOptions(copy?p:{})}</select></label><input type="hidden" name="market" value="${copy?e(p.market):''}"/><label>${tr("默认简历语言")}<select name="resumeLanguage"><option value="zh" ${(copy?p.resumeLanguage:state.settings.language)==='en'?'':'selected'}>${tr("中文")}</option><option value="en" ${(copy?p.resumeLanguage:state.settings.language)==='en'?'selected':''}>English</option></select></label><p>${copy?tr('复制已保存的真实经历，之后两份画像分别编辑、互不覆盖。'):tr('新画像从空白开始，也可以复制已有画像后调整职位方向。')}</p><button class="button primary" type="submit">${copy?tr('复制画像'):tr('创建画像')}</button></form>`);
}
async function update(path,body){accept(await api(path,body));}
async function refresh(){accept(await api('/api/state'));}
const providerName=id=>id==='cursor'?tr('本机 Cursor'):state.providers.find(p=>p.id===id)?.name||id;
const trackName=kind=>kind==='campus'?tr('校招 / 实习'):kind==='experienced'?tr('社会招聘'):tr('类型未注明');

const money = n=>n.toLocaleString('zh-CN');
const date = d=>new Date(d).toLocaleDateString(getLocale()==='en'?'en-CA':'zh-CN',{month:'2-digit',day:'2-digit'});
const jobById = id=>JOBS.find(j=>j.id===id);
function toast(message) { const el=$('#toast'); el.textContent=tr(message); el.classList.add('visible'); clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.classList.remove('visible'),4000); }
function go(route) { if(!routes[route])return; ui.route=route;ui.mobileMenu=false;location.hash=route;render();window.scrollTo(0,0); }
window.addEventListener('hashchange',()=>{ui.route=routes[location.hash.slice(1)]?location.hash.slice(1):'dashboard';render();});


function userName(user=state.user){return user?.username||tr('求职者');}
function avatarContents(user=state.user){return user?.avatar&&/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(user.avatar)?`<img src="${e(user.avatar)}" alt=""/>`:e(Array.from(userName(user))[0]);}
function userHasDraft(){return !!ui.userDraft&&(ui.userDraft.username!==state?.user?.username||ui.userDraft.avatar!==state?.user?.avatar);}
function accountPage(){
 const user=ui.userDraft||state.user||{username:'',avatar:''},p=ui.drafts[ui.profileId]||state.profile;
 return `<div class="account-page">${title(tr('用户中心','User center'),tr('管理个人信息和当前使用的求职画像。','Manage your personal details and the career profile you are using.'),`<button class="button primary" data-action="manage-resumes">${icon('file')} ${tr('简历管理','Manage resumes')} ${icon('arrow')}</button>`)}
 <section class="panel account-identity"><form id="user-form"><div class="account-avatar-area"><span class="avatar account-avatar">${avatarContents(user)}</span><div class="button-row"><button type="button" class="button secondary" data-action="upload-avatar" ${ui.avatarBusy?'disabled':''}>${tr('上传头像','Upload avatar')}</button><button type="button" class="text-button" data-action="remove-avatar" ${user.avatar?'':'disabled'}>${tr('移除头像','Remove avatar')}</button></div><input id="user-avatar-file" type="file" accept="image/jpeg,image/png,image/webp" hidden/><p class="field-help" role="status" id="avatar-status">${ui.avatarBusy?tr('正在处理头像…','Processing avatar…'):tr('JPG、PNG 或 WebP，最大 5 MB。','JPG, PNG or WebP, up to 5 MB.')}</p></div>
 <div class="account-user-fields"><h2>${tr('用户信息','User information')}</h2><label>${tr('用户名','Username')}<input name="username" value="${e(user.username)}" maxlength="80" required autocomplete="nickname" placeholder="${tr('输入你希望显示的名字','Enter your display name')}"/></label><p class="field-help">${tr('用户名和头像用于你的个人空间，切换求职画像后保持不变。','Your username and avatar identify your personal workspace and stay the same when switching profiles.')}</p><div class="button-row"><button type="submit" class="button primary" ${ui.avatarBusy?'disabled':''}>${tr('保存用户信息','Save user information')}</button><button type="button" class="text-button" data-action="discard-user">${tr('恢复已保存信息','Restore saved information')}</button></div></div></form></section>
 <section class="profile-context panel account-profile-context"><label>${tr('当前使用的求职画像','Current career profile')}<select data-profile-select="account">${profileOptions(ui.profileId)}</select></label><div class="profile-context-summary"><strong>${e(state.profile.target||tr('请填写目标职位'))}</strong><span>${e(preferenceSummary(state.profile)||tr(scopeNames[profileSearchScope(state.profile)]))}</span></div><button class="button secondary" data-action="nav" data-route="profile">${tr('完整求职画像','Full career profile')} ${icon('arrow')}</button></section>
 <form id="profile-form" class="panel profile-form account-profile-form" data-mode="basics" data-id="${p.id}" data-revision="${p.revision}"><div class="section-title"><h2>${icon('user')} ${tr('基础信息','Basic information')}</h2><span class="badge lilac">${e(p.label)}</span></div><p class="field-help" id="profile-draft-note">${ui.drafts[p.id]?tr('有未保存修改；搜索和生成使用已保存版本。'):tr('编辑当前画像的基础信息、专业技能和求职偏好。','Edit the basic information, skills and preferences of your current profile.')}</p>${profileBasicFields(p)}${profileSkillsField(p)}${jobPreferencesForm(p)}<div class="form-footer"><span>${tr('修改仅用于当前选择的求职画像。','Changes apply to the selected career profile.')}</span><button class="button primary" type="submit">${icon('check')} ${tr('保存当前画像')}</button></div></form></div>`;
}
function sidebar() {
  return `<aside class="sidebar ${ui.mobileMenu?'is-open':''}">
    <a class="brand" href="#dashboard"><img src="/favicon.svg" alt=""/><span>FoundMyJob<span class="brand-dot">.</span></span></a>
    <div class="sidebar-navigation"><div class="nav-group"><div class="nav-caption">${tr("求职旅程")}</div>
    <nav aria-label="${tr("主导航")}">${[['dashboard','grid'],['jobs','search'],['resumes','file'],['tracker','briefcase']].map(([route,ico])=>navItem(route,ico)).join('')}</nav>
    </div><div class="nav-group"><div class="nav-caption">${tr("个人中心")}</div>
    <nav aria-label="${tr("个人中心")}">${[['profile','user'],['credits','coin'],['settings','settings']].map(([route,ico])=>navItem(route,ico)).join('')}</nav>
    </div></div>
    <div class="sidebar-bottom">
    <button class="sidebar-user ${ui.route==='account'?'is-current':''}" data-action="nav" data-route="account" aria-label="${tr('打开用户中心','Open user center')}"><span class="avatar">${avatarContents()}</span><span class="sidebar-user-info"><strong>${e(userName())}</strong><small>${e(state.profile.label)}</small></span>${icon('chevron')}</button></div>
  </aside>`;
}
function navItem(route,ico) {return `<button class="nav-item ${ui.route===route?'active':''}" data-action="nav" data-route="${route}" ${ui.route===route?'aria-current="page"':''}>${icon(ico)}<span>${tr(routes[route])}</span>${route==='jobs'?`<em>${JOBS.filter(j=>j.active).length}</em>`:route==='resumes'&&state.resumes.length?`<em>${state.resumes.length}</em>`:''}</button>`;}
function header() {return `<header class="topbar"><div class="breadcrumb"><button class="icon-button mobile-only" data-action="menu" aria-label="${tr("展开导航")}">${icon('menu')}</button><span>${tr("我的求职空间")}</span>${icon('chevron')}<strong>${tr(routes[ui.route])}</strong></div><div class="topbar-right"><label class="language-switch">${icon('globe')}<select id="ui-language" aria-label="${tr("Interface language / 界面语言")}"><option value="zh" ${getLocale()==='zh'?'selected':''}>${tr("中文")}</option><option value="en" ${getLocale()==='en'?'selected':''}>English</option></select></label><span class="demo-pill"><i></i> ${tr("本地数据库已连接")}</span><button class="icon-button" data-action="notifications" aria-label="${tr("查看使用说明")}">${icon('bell')}<i class="notification-dot"></i></button><button class="avatar small" data-action="nav" data-route="account" aria-label="${tr("打开用户中心","Open user center")}">${avatarContents()}</button></div></header>`;}
function title(heading,sub,button='') {return `<div class="page-title"><div><div class="eyebrow">YOUR NEXT CHAPTER</div><h1>${heading}</h1><p>${sub}</p></div>${button}</div>`;}
function empty(heading,sub,action='jobs',label=tr('发现适合我的岗位')) {return `<div class="empty-state"><span class="empty-icon">${icon('file')}</span><h3>${heading}</h3><p>${sub}</p><button class="button primary" data-action="nav" data-route="${action}">${label}${icon('arrow')}</button></div>`;}
function stat(iconName,label,value,note,tone='purple') {return `<div class="stat"><span class="stat-icon ${tone}">${icon(iconName)}</span><div><span class="stat-label">${label}</span><strong>${value}</strong><small>${note}</small></div></div>`;}


function continueDiscovery(groups) {
 const country=localizedLabel(COUNTRIES[ui.companyCountry]);
 return `<section class="domestic-discovery" aria-label="${tr('招聘官网入口','Official career sites')}">
 <h3>${tr('去招聘官网，继续找机会','Continue exploring on official career sites')}</h3>
 <p>${country?tr('当前国家：','Selected country: ')+country:tr('官网入口与上方公司目录保持一致。','These links match the company directory above.')}</p>
 ${country?`<p class="field-help">${tr('标注国家直达的入口已带国家条件；其余入口请在官网内选择国家。目录不代表该公司目前在所选国家有空缺。','Links marked country search include the country filter. On other sites, choose the country after opening. A directory listing does not confirm current openings in that country.')}</p>`:''}
 <div class="career-links-scroll">${groups.map(group=>`<div class="discovery-group"><h4>${tr(group.scope==='domestic'?tr('国内招聘官网'):tr('国外招聘官网'))}</h4><div class="button-row">${group.companies.map(company=>{
 const link=companyCareersLink(company,ui.companyCountry);
 return `<a class="button secondary" href="${e(link.url)}" target="_blank" rel="noopener noreferrer" title="${e(country?(link.countryFiltered?tr('国家直达：','Country search: '):tr('官网内筛选：','Select on site: '))+country:company.company)}">${e(company.company)} ${link.countryFiltered?`<small>${e(country)}</small>`:''}${icon('external')}</a>`;
 }).join('')}</div></div>`).join('')}</div>
 <p class="field-help">${tr('可在官网确认招聘状态，也可以把找到的岗位导入这里。','Check the current hiring status on the official site, or import a job here.')}</p></section>`;
}

function companyLogo(item,mini=false) {
 const slug=item.companyId||item.slug||String(item.source||'').split(':')[1]||state.sources.find(s=>s.company===item.company)?.slug;
 const url=COMPANY_LOGOS[slug];
 return '<span class="company-logo'+(mini?' mini':'')+(url?' brand-logo':'')+'">'+(url?'<img src="'+e(url)+'" alt="" decoding="async" loading="lazy"/>':e(item.logo||item.company?.slice(0,2)||tr('企')))+'</span>';
}
function companyCountLabel(source,total) {
 if(total)return total+tr(' 条岗位');
 if(!source.sourceId)return tr('尚未接入岗位源 · 官网查看','Job feed not connected · career site');
 if(source.status==='同步中')return tr('正在同步');
 if(source.adapter==='pending'||source.status==='待接通')return tr('待接通 · 官网查看');
 if(source.status==='同步失败')return tr('暂时无法同步');
 if(!source.syncedAt)return tr('待同步');
 return source.status==='部分同步'?tr('当前读取范围暂无岗位'):tr('当前公开列表暂无岗位');
}
function featuredJobRow(job,alternative=false){
 const fit=matchJob(job,state.profile);
 return `<button class="featured-job" data-action="job-detail" data-id="${e(job.id)}">${companyLogo(job,true)}<span class="featured-job-copy"><strong>${e(job.title)}</strong><span>${e(job.company)} · ${e(job.location)} · ${e(tr(job.work||'未注明'))}</span><small>${alternative?tr('办公方式与偏好不同','Work arrangement differs from preference'):job.work==='未注明'?tr('办公方式待核实','Work arrangement not specified'):fit.role?tr('目标职位匹配','Target role match'):tr('相关技能：','Shared skills: ')+e(fit.matched.join(', '))} · ${tr(jobSourceKind(job)==='discovered'?'官网检索 · 招聘状态待核验':jobSourceKind(job)==='manual'?'手动导入 · 请核对原文':'官网同步')}</small></span>${icon('arrow')}</button>`;
}
function featuredCompanyJobs(result){
 const alternatives=result.alternatives||[];
 return `<section class="featured-jobs" aria-label="${tr('热门公司匹配岗位','Matching jobs at featured companies')}"><div class="section-title"><div><h3>${tr('为此画像匹配的岗位','Jobs matching this profile')}</h3><p>${result.total?`${tr('匹配到','Matched')} ${result.total} ${tr('个岗位，展示','jobs; showing')} ${result.jobs.length} ${tr('个（最多 10 个）','(up to 10)')}`:tr('当前筛选无精确结果','No exact results for these filters')}</p></div><button class="text-button" data-action="search-official-jobs" ${state.syncing||ui.syncing?'disabled':''}>${tr('搜索官网岗位','Search official jobs')}</button></div>${result.jobs.length?`<div class="featured-job-list">${result.jobs.map(job=>featuredJobRow(job)).join('')}</div>`:`<div class="featured-empty" role="status">${icon('search')}<div><strong>${tr('已收录岗位未匹配当前全部条件','No stored jobs match every current filter')}</strong><p>${tr('这不是全网搜索结论。公司可能尚未接入，或岗位被公司、城市、办公方式筛选排除。可搜索官网，或查看下方相关岗位。','This is not a market-wide search result. A company may not be connected, or company, city and work filters may exclude jobs. Search official sources or review related roles below.')}</p></div></div>`}${alternatives.length?`<div class="related-jobs"><div class="section-title"><div><h3>${tr('同一地点的相关岗位 · 办公方式不同','Related roles in this location · different work arrangement')}</h3><p>${tr('保留国家、城市和公司条件；以下岗位不计入精确匹配。','Country, city and company filters are retained. These roles are not counted as exact matches.')}</p></div><button class="text-button" data-action="relax-work">${tr('查看全部办公方式','Show all work arrangements')}</button></div><div class="featured-job-list">${alternatives.map(job=>featuredJobRow(job,true)).join('')}</div></div>`:''}</section>`;
}
const syncPause=()=>new Promise(resolve=>setTimeout(resolve,3000));
function tickSyncElapsed(){
 document.querySelectorAll('[data-sync-start]').forEach(el=>{el.textContent=syncDuration(el.dataset.syncStart);});
}
function updateSyncProgress(progress){
 ui.syncProgress=progress;
 document.querySelectorAll('[data-sync-progress]').forEach(el=>{el.outerHTML=syncProgressHtml(progress);});
 document.querySelectorAll('[data-sync-dock]').forEach(el=>{el.innerHTML=syncDockHtml(progress);});
}
function syncProgressMarkup(){
 const progress=ui.syncProgress||((state.syncing||ui.syncing)?{status:'running'}:null);
 if(progress?.status!=='running')return '';
 return `<div class="sync-shell" data-sync-shell><div>${syncProgressHtml(progress)}</div></div><div class="sync-dock" data-sync-dock aria-hidden="true">${syncDockHtml(progress)}</div>`;
}
function watchJobSync(context={}){
 if(ui.syncMonitor)return ui.syncMonitor;
 ui.syncMonitor=(async()=>{
  const elapsedTimer=setInterval(tickSyncElapsed,1000);
  try{
   let failures=0,warned=false;
   for(;;){
    let progress;
    try{progress=await api('/api/jobs/sync/status');failures=0;warned=false;}
    catch(error){updateSyncProgress({...ui.syncProgress,connectionLost:true});if(++failures>=3&&!warned){warned=true;toast(tr('同步进度暂时无法读取，正在重试。','Sync progress is temporarily unavailable; retrying.'));}await syncPause();continue;}
    if(progress.status!=='running'){
     ui.syncProgress=progress;
     syncDockCleanup?.();syncDockCleanup=null;
     await Promise.all([dismissSyncProgress($('[data-sync-shell]'),$('[data-sync-dock]')),refresh()]);
     ui.syncing=false;ui.syncProgress=null;render();
     if(progress.status==='failed')toast(progress.error||tr('同步未完成，请查看来源状态。','Sync did not complete; check source status.'));
     else if(context.search){
      const sources=state.sources.filter(s=>context.sourceId?s.id===context.sourceId:s.provider==='workday');
      toast(sources.some(s=>['已同步','部分同步'].includes(s.status))?tr('官网搜索完成，结果已更新。','Official-source search finished. Results updated.'):tr('官网搜索暂时失败，已保留原有岗位。','Official-source search failed. Previously collected jobs are retained.'));
     }else if(progress.status==='completed')toast(tr('岗位同步完成，列表已更新。','Job sync finished; the list is updated.'));
     return;
    }
    updateSyncProgress(progress);
    await syncPause();
   }
  }catch(error){
   ui.syncing=false;ui.syncProgress=null;
   try{await refresh();render();}catch{}
   toast(tr('无法读取同步进度，请刷新页面查看结果。','Could not read sync progress; refresh to check the result.'));
  }finally{clearInterval(elapsedTimer);ui.syncMonitor=null;}
 })();
 return ui.syncMonitor;
}
async function startJobSync(path,body,context={}){
 if(state.syncing||ui.syncing)throw new Error(tr('岗位正在同步，请稍候。'));
 ui.syncing=true;ui.syncProgress={status:'running',mode:context.search?'search':'sync',startedAt:new Date().toISOString()};render();
 try{
  const response=await api(path,body);
  updateSyncProgress(response.sync||response);
  void watchJobSync(context);
 }catch(error){ui.syncing=false;ui.syncProgress=null;render();throw error;}
}
async function searchOfficialJobs(){
 const selected=companyDiscoveryGroups(state.sources,state.profile).flatMap(group=>group.companies).find(company=>company.company===ui.company);
 if(selected&&!selected.sourceId)throw new Error(tr('这家公司尚未接入岗位源，请使用招聘官网入口。','This company has no connected job feed yet. Use its official career link.'));
 const query=ui.query.trim()||state.profile.target.trim();
 if(!query)throw new Error(tr('请填写目标职位或搜索关键词。','Enter a target role or search keyword.'));
 await startJobSync('/api/jobs/search',{profileId:ui.profileId,query,...(selected?{sourceId:selected.sourceId}:{})},{search:true,sourceId:selected?.sourceId});
}
function applyJobSearch(data){
 const changed=data.region!==undefined&&data.region!==ui.region;
 Object.assign(ui,data,{limit:ui.pageSize});
 if(changed){ui.city='';ui.company='';ui.companyCategory='';}
 ui.companyCountry=COUNTRIES[ui.region]?ui.region:'';
}

function companyDirectory() {
 const overseas=profileSearchScope(state.profile)!=='domestic';
 const groups=companyDiscoveryGroups(state.sources,state.profile,{country:ui.companyCountry,category:ui.companyCategory});
 const sources=groups.flatMap(group=>group.companies),counts=new Map();
 const region=ui.companyCountry||ui.region;
 for(const j of JOBS)if(j.active&&jobInRegion(j,region)&&jobInCity(j,ui.city,region)&&jobInWork(j,ui.work,ui.workUnknown))counts.set(companyKey(j.company),(counts.get(companyKey(j.company))||0)+1);
 const total=company=>[...new Set(companyNames(company).map(companyKey))].reduce((sum,name)=>sum+(counts.get(name)||0),0);
 const selected=sources.find(s=>s.company===ui.company);
 const synced=sources.filter(s=>total(s)>0).length;
 const featured=companyJobRecommendations(JOBS,state.profile,selected?[selected]:sources,{region,city:ui.city,work:ui.work,workUnknown:ui.workUnknown,track:ui.track,query:ui.query,sourceKind:ui.sourceKind});
 const heading=tr({domestic:tr('国内热门公司'),overseas:tr('国外热门公司'),all:tr('全球热门公司')}[profileSearchScope(state.profile)]);
 const link=selected&&companyCareersLink(selected,ui.companyCountry);
 const categoryOptions=[['',tr('全部行业与机构'),'All industries & institutions'],['global500',tr('世界500强精选'),'Global 500 picks'],...Object.entries(INDUSTRIES).map(([id,pair])=>[id,...pair]),['investment',tr('投资机构 · 求职精选'),'Investment firms · career picks'],['bank',tr('银行 · 求职精选'),'Banks · career picks'],['additional',tr('其他已接入公司'),'Other connected employers']];
 return `<section class="company-directory panel" aria-label="${heading}">
 <h2 class="company-heading"><button class="company-toggle" data-action="toggle-companies" aria-expanded="${ui.companiesOpen}" aria-controls="company-content"><span class="company-heading-copy"><span class="company-heading-title">${heading}</span><span class="company-heading-summary">${sources.length} ${tr('家公司','companies')} · ${featured.total} ${tr('个匹配岗位','matching jobs')}${selected?' · '+tr('已选','Selected')+' '+e(selected.company):''}</span></span><span class="company-toggle-hint"><span data-company-toggle-label>${tr(ui.companiesOpen?tr('收起'):tr('展开'))}</span>${icon('down')}</span></button></h2>
 <div id="company-content" ${ui.companiesOpen?'':'hidden'}>
 ${overseas?`<div class="directory-filters"><label>${tr('岗位所在国家','Job country')}<select id="company-country"><option value="">${tr('全部国外地区','All overseas locations')}</option>${Object.entries(COUNTRIES).map(([id,names])=>`<option value="${id}" ${ui.companyCountry===id?'selected':''}>${localizedLabel(names)}</option>`).join('')}</select></label><label>${tr('行业 / 机构类型','Industry / institution')}<select id="company-category">${categoryOptions.map(([id,zh,en])=>`<option value="${id}" ${ui.companyCategory===id?'selected':''}>${tr(zh,en)}</option>`).join('')}</select></label></div>
 <p class="directory-help">${tr('国家、城市和办公方式与岗位库同步。以下推荐按目标职位或至少两项技能匹配。','Country, city and work arrangement stay in sync with the job library. Recommendations match your target role or at least two skills.')}</p>
 <details class="directory-method"><summary>${tr('公司名单如何选取','How employers are selected')}</summary><p><a href="${FORTUNE_URL}" target="_blank" rel="noopener noreferrer">${FORTUNE_YEAR} ${tr('财富世界500强','Fortune Global 500')}</a> · ${tr('按10个求职行业各选6家；每个国家另选5家投资机构和5家银行，按求职知名度编辑，不是官方热度或资产排名。同一公司可属于多个集合，列表已去重。','Six employers in each of 10 career sectors, plus five investment firms and five banks per country. Financial picks are editorial selections for job seekers, not an official popularity or asset ranking. Employers can belong to multiple collections and are deduplicated.')}</p></details>`:''}
 ${featuredCompanyJobs(featured)}
 <div class="section-title"><div><h3>${tr('按公司查看岗位','Browse jobs by company')}</h3><p>${synced} ${tr('家已有岗位 · 点击公司筛选下方列表','companies with stored jobs · select a company to filter the list')}</p></div><button class="text-button" data-action="company-filter" data-company="" aria-pressed="${!ui.company}">${tr('全部公司','All companies')}</button></div>
 <div class="company-grid company-grid-scroll">${sources.map(s=>`<button class="company-chip ${ui.company===s.company?'selected':''}" data-action="company-filter" data-company="${e(s.company)}" aria-pressed="${ui.company===s.company}">${companyLogo(s,true)}<span class="company-chip-copy"><strong>${e(s.company)}</strong><span>${total(s)?total(s)+' '+tr('条岗位','jobs'):!s.sourceId||!s.count?companyCountLabel(s,0):tr('已有收录 · 当前筛选无结果','Jobs collected · none match filters')}</span></span></button>`).join('')}</div>
 ${selected?`<div class="company-selection"><div><strong>${e(selected.company)}</strong><p>${selected.sourceId?e(selected.error||(selected.provider==='workday'&&selected.lastQuery?tr('最近搜索：','Last search: ')+selected.lastQuery+tr(' · 已收录 ',' · Collected ')+selected.count+tr(' 条岗位；仅覆盖关键词搜索。',' jobs; keyword search coverage only.'):selected.syncNote)||selected.note||(selected.syncedAt?tr('最近同步：','Last synced: ')+new Date(selected.syncedAt).toLocaleString(getLocale()==='en'?'en-CA':'zh-CN'):tr('点击同步获取公开职位。','Sync to retrieve publicly listed jobs.'))):tr('此公司提供官网入口，尚未接入自动岗位同步。','This employer has an official career link; automatic job sync is not connected.')}</p>${!total(selected)?`<p>${tr('尚无符合当前地点和办公方式的已收录岗位，可前往官网继续查找。','No stored jobs match this location and work arrangement. Continue on the official site.')}</p>`:''}</div><div class="button-row">${selected.sourceId?`<button class="button primary" data-action="sync-jobs" data-id="${e(selected.sourceId)}" ${state.syncing||ui.syncing?'disabled':''}>${tr('同步这家公司','Sync this company')}</button>`:''}<a class="button secondary" href="${e(link.url)}" target="_blank" rel="noopener noreferrer">${tr(link.countryFiltered?tr('国家岗位直达'):tr('招聘官网'))} ${icon('external')}</a></div></div>`:''}
 ${continueDiscovery(groups)}</div></section>`;
}

function jobsPage() {
 const summary=discoverySummary(JOBS,state.profile,directoryJobFilters(state.sources,state.profile,{...ui,saved:state.saved})),jobs=summary.results;
 currentJobResults=jobs;
 return `${title(tr('发现适合你的真实岗位。'),tr('按你的方向发现机会，向下滚动，继续浏览更多岗位。'),`<div class="button-row"><button class="button secondary" data-action="import-job">${icon('plus')} ${tr("导入岗位")}</button><button class="button primary" data-action="sync-jobs" ${state.syncing||ui.syncing?'disabled':''}>${icon('globe')} ${ui.company?tr('同步当前公司','Sync selected company'):tr('同步真实岗位')}</button></div>`)}
 ${profileSelector()}${companyDirectory()}<section class="discovery-banner"><div class="banner-copy"><span class="tiny-pill">${icon('spark')} ${tr("每一段经历，都值得被看见")}</span><h2>${tr("好机会，从了解你开始。")}</h2><p>${tr("把你的闪光点，变成下一份工作的起点。")}<br/>${tr("完善档案，解锁更贴合你的岗位推荐。")}</p><button class="button dark" data-action="nav" data-route="profile">${tr("完善求职档案")} ${icon('arrow')}</button></div>
 <div class="banner-art" aria-hidden="true"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><span class="art-star star-one">✦</span><span class="art-star star-two">✧</span><div class="floating-label label-one"><span class="art-icon green">${icon('check')}</span>${tr("你的经历，刚好匹配")}</div><div class="art-resume"><div class="art-resume-head"><span class="art-avatar">${icon('user')}</span><span><i></i><i></i></span><b>✦</b></div><div class="art-lines"><i></i><i></i><i></i></div><div class="art-tags"><span>${tr("潜力")}</span><span>${tr("热爱")}</span><span>${tr("成长")}</span></div><div class="art-match">${icon('spark')} ${tr("下一站，有更多可能")}</div></div><div class="floating-label label-two"><span class="art-icon purple">${icon('file')}</span>${tr("为每个机会，认真准备")}</div></div></section>
 <section class="stats-row" aria-label="${tr("求职概览")}">${stat('briefcase',tr('当前筛选结果'),jobs.length,`${tr("已显示")} <span data-job-visible>${summary.visible}</span> ${tr("条岗位")}`,'purple')}${stat('user',tr('档案完整度'),`${profileCompletion(state.profile)}<span>%</span>`,tr('越完整，匹配越精准'),'blue')}${stat('bookmark',tr('已收藏岗位'),state.saved.length,tr('留住每一个心动机会'),'peach')}${stat('file',tr('专属简历'),state.resumes.length,tr('每一次投递都有准备'),'green')}</section>
 <section class="job-section"><div class="section-heading"><div class="section-tabs"><button class="section-tab ${!ui.savedOnly?'selected':''}" data-action="saved-filter" data-value="all">${tr("岗位库")} <span>${summary.active}</span></button><button class="section-tab ${ui.savedOnly?'selected':''}" data-action="saved-filter" data-value="saved">${tr("我的收藏")} <span>${state.saved.length}</span></button></div><div class="matching-note">${icon('spark')} ${tr("按「")}${e(state.profile.label)}${tr("」计算匹配度")}</div></div>
 <form class="filter-bar" id="job-search"><label class="search-field">${icon('search')}<input name="query" placeholder="${tr("搜索职位、公司或技能…")}" value="${e(ui.query)}" aria-label="${tr("搜索职位、公司或技能")}"/></label><select name="region" aria-label="${tr("岗位地区")}"><option value="">${tr("全部地区")}</option><option value="cn" ${ui.region==='cn'?'selected':''}>${tr("中国大陆")}</option><option value="overseas" ${ui.region==='overseas'?'selected':''}>${tr("国外")}</option>${Object.entries(COUNTRIES).map(([id,names])=>`<option value="${id}" ${ui.region===id?'selected':''}>${localizedLabel(names)}</option>`).join('')}<option value="na" ${ui.region==='na'?'selected':''}>${tr("北美（含国家未注明）")}</option><option value="other" ${ui.region==='other'?'selected':''}>${tr("其他 / 未注明")}</option></select><select name="city" aria-label="${tr("岗位城市","Job city")}">${citySelectOptions(ui.region,ui.city)}</select><select name="track" aria-label="${tr("招聘类型")}"><option value="">${tr("全部招聘类型")}</option><option value="campus" ${ui.track==='campus'?'selected':''}>${tr("校园招聘")}</option><option value="experienced" ${ui.track==='experienced'?'selected':''}>${tr("社会招聘")}</option><option value="unknown" ${ui.track==='unknown'?'selected':''}>${tr("未注明")}</option></select><select name="work" aria-label="${tr("办公方式")}"><option value="">${tr("办公方式")}</option>${['远程办公','混合办公','现场办公','未注明'].map(x=>`<option value="${e(x)}" ${ui.work===x?'selected':''}>${tr(x)}</option>`).join('')}</select><button class="button primary" type="submit">${icon('search')} ${tr('搜索岗位库','Search job library')}</button></form>
 <div class="active-filters"><label class="inline-check"><input id="target-only" type="checkbox" ${ui.targetOnly?'checked':''} ${state.profile.target.trim()?'':'disabled'}/> ${tr("仅显示目标职位：")}${e(state.profile.target||tr('尚未填写'))}</label><span>${tr("公司：")}${e(ui.company||tr('全部'))}${ui.company?` <button class="text-button" data-action="company-filter" data-company="">${tr("取消公司筛选","Clear company filter")}</button>`:''} ${tr("· 地区：")}${e(tr(marketNames[ui.region]))}${ui.city?" · "+e(localizedLabel(cityEntry(ui.city,ui.region)?.labels)||ui.city):""}${ui.work?" · "+e(tr(ui.work)):""} ${tr("· 类型：")}${ui.track?trackName(ui.track):tr('全部')}${ui.query?tr(' · 关键词：')+e(ui.query):''}</span><button class="text-button" data-action="profile-filters">${tr("恢复画像偏好","Restore profile preferences")}</button><button class="text-button" data-action="clear-filters">${tr("查看全部库内岗位 / 清除筛选")}</button></div><div class="results-line"><span>${tr("找到")} <b>${jobs.length}</b> ${tr("个岗位 · 已显示")} <b data-job-visible>${summary.visible}</b> ${tr("条")}</span><label>${tr("排序：")}<select id="job-sort" aria-label="${tr("岗位排序")}"><option value="match" ${ui.sort==='match'?'selected':''}>${tr("匹配度优先")}</option><option value="new" ${ui.sort==='new'?'selected':''}>${tr("最近同步优先")}</option></select></label><label>${tr("显示数量：")}<select id="job-page-size" aria-label="${tr("显示数量")}"><option value="25" ${ui.pageSize===25?'selected':''}>${tr("25 条")}</option><option value="50" ${ui.pageSize===50?'selected':''}>${tr("50 条")}</option></select></label><label>${tr("来源：")}<select id="job-source-kind" aria-label="${tr("岗位来源")}"><option value="">${tr("全部来源")}</option><option value="synced" ${ui.sourceKind==='synced'?'selected':''}>${tr("官网同步")}</option><option value="discovered" ${ui.sourceKind==='discovered'?'selected':''}>${tr("官网检索 · 待核验")}</option><option value="manual" ${ui.sourceKind==='manual'?'selected':''}>${tr("手动导入")}</option></select></label></div>
 <div class="jobs-grid">${jobs.length?jobs.slice(0,summary.visible).map(jobCard).join(''):`<div class="no-results">${icon('search')}<h3>${tr("还没有找到符合条件的岗位")}</h3><p>${tr('已收录岗位未匹配当前条件。可调整筛选，或同步当前范围的官网岗位。','No stored jobs match these filters. Adjust the filters or sync official jobs in the current scope.')}</p><button class="button secondary" data-action="clear-filters">${tr("清除筛选")}</button></div>`}</div>
 <div id="jobs-load-more" class="jobs-load-more">${jobLoadMoreContent()}</div><div class="list-footer"><span class="footer-line"></span><span>${tr("好机会值得等待，更值得准备")} ${icon('spark')}</span><span class="footer-line"></span></div>
 <p class="data-disclaimer">${icon('info')} ${tr("岗位以企业原文为准，可能下架；匹配度是技能与目标方向的规则参考，不代表录用概率。官网检索岗位标注待核验，详情中的摘要不能替代完整 JD。")}</p></section>`;
}
function jobLoadMoreContent() {
 const total=currentJobResults.length,visible=Math.min(ui.limit,total),remaining=total-visible;
 if(!total)return '';
 return `<p role="status">${tr("已显示")} ${visible} / ${total} ${tr("条")}${remaining?tr(' · 向下滚动，自动加载更多'):tr(' · 已浏览全部岗位')}</p>${remaining?`<button class="button secondary" data-action="more-jobs">${tr("继续加载")} ${Math.min(ui.pageSize,remaining)} ${tr("条")} ${icon('down')}</button>`:''}`;
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
 const applied=state.applications.some(a=>a.jobId===j.id&&['已投递','面试中','已结束'].includes(a.status));
 const sourceKind=jobSourceKind(j);
 const provenance=!j.active?tr('已下架 · 历史记录'):sourceKind==='discovered'?tr('官网检索 · 招聘状态待核验'):sourceKind==='manual'?tr('手动导入 · 请核对原文'):j.descriptionKind==='summary'?tr('职位摘要','Job summary'):'';
 const work=j.work&&j.work!=='未注明'?`<span>${icon('briefcase')}${e(tr(j.work))}</span>`:'';
 const salary=j.salary&&j.salary!=='以岗位原文为准'?`<div class="salary">${e(tr(j.salary))} <small>${e(j.currency)}</small></div>`:'';
 return `<article class="job-card"><div class="job-card-top">${companyLogo(j)}<div class="job-card-labels"><span class="job-type">${trackName(j.track)}</span>${applied?`<span class="job-applied">${icon('check')} ${tr('已投递')}</span>`:''}</div><button class="icon-button bookmark ${saved?'saved':''}" data-action="save-job" data-id="${j.id}" aria-label="${saved?tr('取消收藏'):tr('收藏')} ${e(j.title)}" aria-pressed="${saved}">${icon('bookmark')}</button></div><button class="job-title" data-action="job-detail" data-id="${j.id}">${e(j.title)}</button><div class="company-name">${e(j.company)} <span>· ${e(tr(j.category))}</span></div><div class="job-meta"><span>${icon('pin')}${e(j.location)}</span>${work}</div>${provenance?`<p class="job-provenance ${sourceKind==='discovered'?'pending':''}">${provenance}</p>`:''}${salary}<div class="tags">${j.tags.map(t=>`<span class="${fit.matched.includes(t)?'tag-match':''}">${e(t)}</span>`).join('')}</div><div class="job-card-bottom"><div class="match-label">${icon('spark')}<strong>${fit.score}%</strong><span>${fit.role?tr('规则匹配'):tr('职位方向不同')}</span></div><button class="job-detail-link" data-action="job-detail" data-id="${j.id}" aria-label="${tr("查看")} ${e(j.title)} ${tr("详情")}">${tr("查看详情")} ${icon('arrow')}</button></div></article>`;
}
function dashboardPage() {
 const recommended=filterJobs(JOBS.filter(j=>j.active),state.profile,profileJobFilters(state.profile)).slice(0,3);
 return `<div class="dashboard-page">${title(`${tr("你好，")}${e(state.profile.name||tr('求职者'))}。`,tr('你的每一步，都在靠近更合适的下一站。'),`<button class="button primary" data-action="nav" data-route="jobs">${tr("发现新机会")} ${icon('arrow')}</button>`)}<div class="stats-row">${stat('bookmark',tr('收藏机会'),state.saved.length,tr('已经心动的岗位'))}${stat('file',tr('已生成简历'),state.resumes.length,tr('逐一为机会做准备'),'blue')}${stat('check',tr('已审核简历'),state.resumes.filter(r=>r.status==='reviewed').length,tr('可以进入投递流程'),'green')}${stat('briefcase',tr('投递记录'),state.applications.length,tr('记录你的求职旅程'),'peach')}</div>
 <section class="panel journey-panel"><div class="section-title"><h2>${tr("你的求职路径")}</h2><span class="muted">${tr("一步一步，把机会变成可能")}</span></div><div class="journey-steps">${[['user','01',tr('建立个人档案'),tr('让你的经历成为推荐的起点'),'profile'],['search','02',tr('发现心动岗位'),tr('从中国到北美，找到你的方向'),'jobs'],['file','03',tr('准备专属简历'),tr('围绕岗位要求，突出真实经历'),'resumes'],['briefcase','04',tr('审核并投递'),tr('确认每个细节，再迈出下一步'),'tracker']].map(([i,n,h,p,r])=>`<button class="journey-step" data-action="nav" data-route="${r}"><span class="step-number">${n}</span>${icon(i)}<h3>${h}</h3><p>${p}</p></button>`).join('')}</div></section>
 <section class="dashboard-opportunities" aria-labelledby="dashboard-opportunities-title"><div class="section-title"><h2 id="dashboard-opportunities-title">${tr("值得关注的机会")} <span class="count">${recommended.length}</span></h2><button class="text-button" data-action="nav" data-route="jobs">${tr("查看全部")} ${icon('arrow')}</button></div>${recommended.length?`<div class="jobs-grid">${recommended.map(jobCard).join('')}</div><p class="data-disclaimer">${tr("请在岗位原文中核实最新招聘状态。")}</p>`:empty(tr('暂无符合当前偏好的机会','No opportunities match your preferences yet'),tr('前往发现岗位，调整筛选或同步最新岗位。','Explore jobs to adjust your filters or sync the latest openings.'))}</section></div>`;
}
function profileBasicFields(p){return `<div class="form-grid"><label>${tr("画像名称")} <span class="required">*</span><input name="label" required maxlength="100" value="${e(p.label)}" placeholder="${tr("例如：加拿大 · Data Engineer")}"/></label><label>${tr("招聘地点范围")}<select name="searchScope">${scopeOptions(p)}</select></label><input type="hidden" name="market" value="${e(p.market)}"/><label>${tr("默认简历语言")}<select name="resumeLanguage"><option value="zh" ${p.resumeLanguage==='zh'?'selected':''}>${tr("中文")}</option><option value="en" ${p.resumeLanguage==='en'?'selected':''}>English</option></select></label><label>${tr("姓名")} <span class="required">*</span><input name="name" required maxlength="80" value="${e(p.name)}"/></label><label>${tr("联系邮箱")} <span class="required">*</span><input name="email" required type="email" maxlength="120" value="${e(p.email)}"/></label><label>${tr("所在城市")}<input name="location" maxlength="120" value="${e(p.location)}"/></label><label>${tr("联系电话")} <span class="optional">${tr("选填")}</span><input name="phone" maxlength="60" value="${e(p.phone)}" placeholder="${tr("用于简历联系方式")}"/></label><label>${tr("求职阶段")}<select name="track"><option value="campus" ${p.track==='campus'?'selected':''}>${tr("校园招聘 / 实习")}</option><option value="experienced" ${p.track==='experienced'?'selected':''}>${tr("社会招聘")}</option></select></label><label>${tr("目标职位")}<input name="target" maxlength="160" value="${e(p.target)}" placeholder="${tr("例如：Data Engineer / Software Engineer")}"/></label></div>`;}
function profileSkillsField(p){return `<div class="form-section"><h2>${icon('bolt')} ${tr("专业技能")}</h2><label><span class="field-help">${tr("使用逗号分隔，岗位匹配会参考这些技能")}</span><input name="skills" maxlength="1000" value="${e(p.skills.join(', '))}" placeholder="${tr("Figma, SQL, Python, 用户研究")}"/></label></div>`;}
function profilePage() {
 const p=ui.drafts[ui.profileId]||state.profile;
 const trackFields=profileTrackFields(p.track,tr);
 return `${title(tr('一个你，可以有多个求职方向。'),tr('按市场和职位分别整理画像，让每份简历都有明确的出发点。'),`<div class="button-row"><button class="button secondary" data-action="copy-profile">${tr("复制当前画像")}</button><button class="button primary" data-action="new-profile">${icon('plus')} ${tr("新建画像")}</button></div>`)}${profileSelector('edit')}<div class="profile-management"><span>${tr("共")} ${state.profiles.filter(p=>!p.archived).length} ${tr("份可用画像")}</span><button class="text-button" data-action="archive-profile" ${state.profiles.filter(p=>!p.archived).length<2?'disabled':''}>${tr("归档当前画像")}</button></div>${state.profiles.some(p=>p.archived)?`<details class="archived-profiles"><summary>${tr("已归档画像（保留历史简历和记录）")}</summary>${state.profiles.filter(p=>p.archived).map(p=>`<div><span>${e(p.label)}</span><button class="text-button" data-action="restore-profile" data-id="${p.id}">${tr("恢复使用")}</button></div>`).join('')}</details>`:''}<form id="profile-form" data-id="${p.id}" data-revision="${p.revision}" class="profile-layout"><div class="profile-form panel"><div class="section-title"><h2>${icon('user')} ${e(p.label)}</h2><span class="badge lilac">${profileCompletion(p)}${tr("% 已完善")}</span></div><p class="field-help" id="profile-draft-note">${ui.drafts[p.id]?tr('有未保存修改；搜索和生成使用已保存版本。'):tr('每份画像独立保存。可以复制真实经历，再调整面向不同岗位的重点。')}</p>${profileBasicFields(p)}<p class="field-help">${trackFields.guide}</p>${profileSkillsField(p)}${[['education','book',tr('教育经历'),tr('学校、专业、学位、时间、相关课程')],['experience','briefcase',...trackFields.experience],['projects','file',...trackFields.projects]].map(([key,ico,label,placeholder])=>`<div class="form-section"><h2>${icon(ico)} ${label}</h2><textarea name="${key}" rows="5" maxlength="12000" ${key==='education'?'required':''} placeholder="${placeholder}" aria-label="${label}">${e(p[key])}</textarea></div>`).join('')}${jobPreferencesForm(p)}<div class="form-footer"><span>${icon('shield')} ${tr("档案保存在本机 SQLite 数据库")}</span><button class="button primary" type="submit">${icon('check')} ${tr("保存当前画像")}</button></div></div><aside class="profile-aside"><div class="panel tips-panel"><span class="tip-icon">${icon('spark')}</span><h3>${tr("你的经历，就是最好的起点。")}</h3><p>${tr("无需一次写得完美。先记录事实，再为不同岗位选择最相关的内容。")}</p><ul><li>${tr("用清晰的动词说明你做了什么")}</li><li>${tr("写出能够核实的成果或数据")}</li><li>${tr("校招可以突出课程与项目")}</li><li>${tr("社招可以突出职责与工作成果")}</li></ul></div><div class="notice"><b>${tr("请填写你自己的真实经历")}</b><p>${tr("这里不会预填虚构经历。点击生成前，会让你确认将哪些数据发给所选 AI 服务。")}</p></div><button class="button secondary full-width" type="button" data-action="import-text">${icon('download')} ${tr("导入经历文件","Import experience file")}</button><input type="file" id="profile-file" accept=".docx,.doc,.pdf,.txt,.md,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,application/pdf,text/plain,text/markdown" hidden/><p class="field-help">${tr("支持 Word（.docx / .doc）、PDF、TXT、Markdown，最大 10 MB。扫描件请先做 OCR。","Word (.docx / .doc), PDF, TXT and Markdown, up to 10 MB. Scans require OCR first.")}</p></aside></form>`;
}
function resumesPage() {
 const resumes=records(state.resumes);
 return `${title(tr('每个机会，都有专属表达。'),tr('从真实经历出发，整理、审核，再安心投递。'),`<button class="button primary" data-action="nav" data-route="jobs">${icon('plus')} ${tr("为新岗位准备简历")}</button>`)}${recordFilter()}${resumes.length?`<div class="resume-list">${resumes.map(r=>`<article class="resume-card panel"><div class="resume-mini">${icon('file')}<span></span><span></span><span></span></div><div class="resume-card-info"><span class="badge ${r.status==='reviewed'?'mint':'lilac'}">${r.status==='reviewed'?tr('已审核'):tr('待审核')}</span><h3>${e(r.title)}</h3><p class="source-profile">${tr("来源画像：")}${e(sourceLabel(r))}</p><p>${r.language==='en'?'English':tr('中文')} · ${date(r.createdAt)} ${tr("创建 ·")} ${e(providerName(r.mode))} ${tr("生成")}</p><div class="resume-card-actions"><button class="button secondary" data-action="resume-detail" data-id="${r.id}">${icon('file')} ${r.status==='reviewed'?tr("导出简历","Export resume"):tr("编辑与审核")}</button><button class="icon-button danger-text" data-action="delete-resume" data-id="${r.id}" aria-label="${tr("删除")} ${e(r.title)}">${icon('trash')}</button></div></div></article>`).join('')}</div>`:empty(tr('你的第一份专属简历，正在等你。'),tr('先选择一个心动的岗位，再点击「生成专属简历」。'))}`;
}
function trackerPage() {
 const applications=records(state.applications);
 return `${title(tr('每次出发，都留下足迹。'),tr('记录进度、整理反馈，让下一次投递更从容。'),`<button class="button secondary" data-action="nav" data-route="jobs">${icon('plus')} ${tr("添加求职机会")}</button>`)}${recordFilter()}${applications.length?`<div class="tracker-grid">${['准备中','已投递','面试中','已结束'].map(status=>`<section class="tracker-column"><h2><i class="status-dot status-${status}"></i>${tr(status)}<span>${applications.filter(a=>a.status===status).length}</span></h2>${applications.filter(a=>a.status===status).map(a=>{const j=jobById(a.jobId);return `<article class="application-card"><div class="application-company">${companyLogo(j,true)}<strong>${e(j.company)}</strong></div><h3>${e(j.title)}</h3><p class="source-profile">${e(sourceLabel(a))}</p><small>${icon('pin')} ${e(j.location)}</small><label>${tr("更新进度")}<select data-application="${a.id}" aria-label="${e(j.company)} ${tr("投递状态")}">${['准备中','已投递','面试中','已结束'].map(s=>`<option value="${e(s)}" ${s===a.status?'selected':''}>${tr(s)}</option>`).join('')}</select></label><button class="text-button" data-action="job-detail" data-profile-id="${a.profileId}" data-id="${j.id}">${tr("岗位与简历")} ${icon('arrow')}</button></article>`;}).join('')||tr('<p class="column-empty">下一个机会，即将到来</p>')}</section>`).join('')}</div><p class="data-disclaimer">${tr("进度由你手动记录。标记「已投递」前需要审核该岗位、该画像的简历；本产品不会自动提交求职申请。")}</p>`:empty(tr('把求职进度，放在同一个地方。'),tr('在岗位详情中点击「加入投递计划」，开始记录下一次机会。'))}`;
}
function creditsPage() {
 return `${title(tr('每次生成，都有记录。'),tr('任务状态由后端保存；刷新页面后可以继续查看。'))}${recordFilter()}<div class="panel transactions"><div class="table-scroll"><table><thead><tr><th>${tr("岗位 / 来源画像")}</th><th>${tr("服务 / 模型")}</th><th>${tr("时间")}</th><th>${tr("结果")}</th></tr></thead><tbody>${records(state.tasks).map(t=>`<tr><td>${e(jobById(t.jobId)?.title||t.jobId)}<br/><small>${e(sourceLabel(t))}</small></td><td>${e(providerName(t.provider))}<br/><small>${e(t.model)}</small></td><td>${date(t.createdAt)}</td><td>${t.status==='completed'?`<button class="text-button" data-action="resume-detail" data-id="${t.resumeId}">${tr("打开简历")}</button>`:t.status==='running'?`<button class="text-button" data-action="resume-task" data-id="${t.id}">${tr("生成中 · 查看")}</button>`:`<span class="danger-text">${e(t.error)}</span>`}</td></tr>`).join('')||tr('<tr><td colspan="4">还没有生成任务。</td></tr>')}</tbody></table></div></div><div class="notice margin-top"><b>${tr("平台积分购买暂未开放")}</b><p>${tr("本机 Cursor 使用本机账号额度；自带 Key 使用对应厂商账户额度。平台计费功能在接通账户、支付及服务端余额校验后开放。")}</p></div><button class="button secondary" data-action="refresh">${tr("刷新任务状态")}</button>`;
}
function settingsPage() {
 const current=state.settings, selected=ui.provider||current.provider;
 const p=state.providers.find(p=>p.id===selected);
 const models=ui.models.filter(m=>!ui.freeOnly||m.free);
 return `${title(tr('让 AI 按你的方式工作。'),tr('本机 Cursor 与用户自带 Key 分开使用，平台代付功能尚未开放。'))}<div class="settings-layout"><form id="settings-form" class="panel settings-panel"><h2>${icon('spark')} ${tr("生成设置")}</h2><label>${tr("使用方式")}<select name="provider" id="provider-select"><option value="cursor" ${selected==='cursor'?'selected':''}>${tr("本机 Cursor（使用自己的订阅）")}</option>${state.providers.map(p=>`<option value="${p.id}" ${selected===p.id?'selected':''}>${p.name} ${tr("· 自带 Key")}</option>`).join('')}<option disabled>${tr("平台积分 · 尚未开放")}</option></select></label>${selected==='cursor'?`<div class="notice"><b>${tr("仅使用本机 Cursor 登录")}</b><p>${tr("克隆代码不会带走你的登录信息。生成需要本机配置开启且 CLI 已登录。")}</p></div><button type="button" class="button secondary" data-action="cursor-status">${tr("检查 Cursor 登录")}</button><p id="cursor-status" class="field-help">${tr("未检测登录状态")}</p><input name="model" value="auto" type="hidden"/>`:`<p class="field-help">${e(p.note)}</p><label>${tr("你的 API Key")} <span class="badge ${p.configured?'mint':'neutral'}">${p.configured?tr('已配置（本次运行）'):tr('未配置')}</span><input id="api-key" type="password" autocomplete="new-password" spellcheck="false" placeholder="${tr("输入你自己的 Key，保存后立即清空输入框")}" maxlength="2048"/></label><div class="button-row"><button type="button" class="button secondary" data-action="save-key">${tr("保存 Key")}</button><button type="button" class="text-button" data-action="clear-key">${tr("清除 Key")}</button><a class="text-button" href="${p.console}" target="_blank" rel="noopener noreferrer">${tr("获取自己的 Key ↗")}</a></div><p class="field-help">${tr("Key 仅保存在当前后端进程内存；不写入数据库、浏览器存储、备份或 Git。服务重启需重新输入。")}</p><div class="button-row"><button type="button" class="button secondary" data-action="load-models">${tr("加载可用模型")}</button><a class="text-button" href="${p.pricing}" target="_blank" rel="noopener noreferrer">${tr("厂商价格 / 限额 ↗")}</a></div>${selected==='openrouter'?`<label class="inline-check"><input type="checkbox" id="free-models" ${ui.freeOnly?'checked':''}/> ${tr("只显示并调用已确认免费的模型")}</label>`:''}<label>${tr("选择模型")}<select name="model" required><option value="">${tr("请先加载模型并选择")}</option>${current.provider===selected&&current.model!=='auto'&&!models.some(m=>m.id===current.model)?`<option selected value="${e(current.model)}">${e(current.model)}${tr("（已保存）")}</option>`:''}${models.map(m=>`<option value="${e(m.id)}" ${m.id===current.model?'selected':''}>${e(m.name)}${m.free?tr(' · 免费（有限额）'):''}</option>`).join('')}</select></label><p class="field-help">${tr("不会自动切换厂商或付费模型。免费模型可能限流、下架或更改价格。")}</p>`}<label>${tr("新画像初始语言（已有画像使用自身设置）")}<select name="language"><option value="zh" ${current.language==='zh'?'selected':''}>${tr("中文")}</option><option value="en" ${current.language==='en'?'selected':''}>English</option></select></label><button class="button primary" type="submit">${tr("保存生成设置")}</button></form><section class="panel settings-panel"><h2>${icon('globe')} ${tr("真实岗位来源")}</h2>${state.sources.map(s=>`<div class="provider-row"><div><b>${e(s.company)}</b><p>${e(s.provider)} / ${e(s.slug)}<br/>${e(tr(s.status))} · ${s.count} ${tr("个岗位")}${s.syncNote?'<br/>'+e(s.syncNote):''}${s.note?'<br/>'+e(s.note):''} ${s.syncedAt?'· '+date(s.syncedAt):''}${s.error?'<br/>'+e(s.error):''}</p></div></div>`).join('')}<div class="button-row"><button class="button primary" data-action="sync-jobs" data-all="true">${tr("同步所有岗位源")}</button><button class="button secondary" data-action="add-source">${tr("添加企业招聘板")}</button></div><p class="field-help">${tr("内置热门公司官网来源，并支持新增 Greenhouse / Lever 招聘板。已同步、部分同步、待接通和失败分别显示；同步失败保留上次数据。")}</p></section><section class="panel settings-panel"><h2>${icon('shield')} ${tr("本地数据与备份")}</h2><p>${tr("SQLite 保存档案、岗位、简历版本与投递记录。旧演示记录仍保留在原浏览器存储中，不会自动混入真实档案。")}</p><div class="button-row"><button class="button secondary" data-action="export-backup">${tr("导出数据 JSON")}</button><button class="button secondary" data-action="export-legacy">${tr("导出旧演示记录")}</button></div><p class="field-help">${tr("完整恢复：关闭程序后备份 .runtime/foundmyjob.sqlite 文件。JSON 导出用于阅读和迁移，不包含密钥。")}</p></section><section class="panel settings-panel"><h2>${tr("运行范围")}</h2><p>${tr("当前版本用于单用户本机。网页只连接 127.0.0.1；其他用户在自己的电脑上配置自己的账号。")}</p><p>${tr("在线多人版本需要独立账户、加密密钥库、支付回调和服务端额度账本，当前不开放平台代付。")}</p></section></div>`;
}
function render() {
 jobsObserver?.disconnect();jobsObserver=null;
 syncDockCleanup?.();syncDockCleanup=null;
 const page={jobs:jobsPage,dashboard:dashboardPage,profile:profilePage,account:accountPage,resumes:resumesPage,tracker:trackerPage,credits:creditsPage,settings:settingsPage}[ui.route];
 $('#app').innerHTML=`${sidebar()}<div class="app-content">${header()}<main id="main" class="${ui.route==='dashboard'?'dashboard-main':''}">${storageWarning?`<div class="notice warning">${e(storageWarning)}</div>`:''}${syncProgressMarkup()}${page()}<footer class="app-footer"><span>FoundMyJob<span class="brand-dot">.</span> <span class="footer-motto">${tr("属于你的机会，正在前方。")}</span></span><span>Made for your next chapter <span class="footer-star">✦</span></span></footer></main></div>`;
 if($('[data-sync-shell]'))syncDockCleanup=observeSyncDock($('[data-sync-shell]'),$('[data-sync-dock]'));
 if(state.syncing||ui.syncing)document.querySelectorAll('[data-action="sync-jobs"],[data-action="search-official-jobs"]').forEach(el=>{el.disabled=true;});
 document.title=`${tr(routes[ui.route])} · FoundMyJob`;
 document.documentElement.lang=getLocale()==='en'?'en':'zh-CN';
 $('.skip-link').textContent=tr('跳到主要内容');
 if(ui.route==='jobs')observeJobList();
}

let returnFocus;
function modal(title,html,wide=false) {
 closeEvidence(false);
 if(!$('dialog'))returnFocus=document.activeElement;
 $('#modal-root').innerHTML=`<dialog class="modal ${wide?'wide':''}" aria-labelledby="modal-title"><div class="modal-header"><h2 id="modal-title">${title}</h2><button class="icon-button" data-action="close-modal" aria-label="${tr("关闭对话框")}">${icon('close')}</button></div>${html}</dialog>`;
 const dialog=$('dialog');dialog.showModal();dialog.addEventListener('click',event=>{if(event.target===dialog){const b=dialog.getBoundingClientRect();if(event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom)closeModal();}});dialog.addEventListener('cancel',event=>{if(ui.generating)event.preventDefault();else{ui.modal=null;observeJobList();}});
}
function closeModal() {if(ui.generating){toast(tr('正在整理简历，请稍等片刻。'));return;}if(ui.evidence){closeEvidence();return;} $('dialog')?.close();$('#modal-root').innerHTML='';ui.modal=null;returnFocus?.focus();observeJobList();}
function closeEvidence(restoreFocus=true) {
 const context=ui.evidence;ui.evidence=null;
 const dialog=$('#evidence-dialog');dialog?.close();dialog?.remove();
 if(restoreFocus&&context?.returnFocus?.isConnected)context.returnFocus.focus();
}
function showJobEvidence(profileId=ui.modal?.profileId) {
 if(ui.modal?.type!=='job')return;
 const job=jobById(ui.modal.id),profile=state.profiles.find(p=>p.id===profileId);if(!job||!profile)return;
 const focus=ui.evidence?.returnFocus||document.activeElement;
 closeEvidence(false);
 const context={id:job.id,profileId:profile.id,profileRevision:profile.revision,returnFocus:focus};ui.evidence=context;
 $('#modal-root').insertAdjacentHTML('beforeend',`<dialog id="evidence-dialog" class="modal evidence-dialog" aria-labelledby="evidence-dialog-title"><div class="modal-header"><h2 id="evidence-dialog-title">${tr('经历对比','Experience comparison')}</h2><button type="button" class="icon-button" data-action="close-evidence" aria-label="${tr('关闭对照','Close comparison')}">${icon('close')}</button></div><p class="evidence-job-name">${e(job.title)} · ${e(job.company)}</p><div class="evidence-toolbar"><label for="evidence-profile">${tr('对照画像','Compare profile')}</label><select id="evidence-profile">${profileOptions(profile.id)}${profile.archived?`<option value="${e(profile.id)}" selected>${e(profile.label)}${tr('（已归档）')}</option>`:''}</select><button type="button" class="text-button" data-action="refresh-evidence">${tr('刷新','Refresh')}</button></div><section id="job-evidence" class="job-evidence" aria-label="${tr('对照结果','Comparison results')}"></section></dialog>`);
 const dialog=$('#evidence-dialog');dialog.showModal();
 dialog.addEventListener('cancel',event=>{event.preventDefault();closeEvidence();});
 dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const b=dialog.getBoundingClientRect();if(event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom)closeEvidence();});
 void loadJobEvidence(context);
}
async function loadJobEvidence(context=ui.evidence) {
 const panel=$('#job-evidence');if(!panel||!context)return;
 const request={};context.evidenceRequest=request;
 panel.setAttribute('aria-busy','true');
 panel.innerHTML=`<p role="status">${tr('正在核对已保存的岗位与画像…','Comparing the saved job and profile…')}</p>`;
 try {
  const result=await api('/api/jobs/match',{jobId:context.id,profileId:context.profileId,profileRevision:context.profileRevision});
  if(ui.evidence!==context||context.evidenceRequest!==request||!panel.isConnected)return;
  panel.innerHTML=evidencePanelHtml(result,state.profiles.find(p=>p.id===context.profileId)?.label||'',{hasDraft:!!ui.drafts[context.profileId]});
 } catch(error) {
  if(ui.evidence!==context||context.evidenceRequest!==request||!panel.isConnected)return;
  panel.innerHTML=`<p role="alert">${e(tr(error.message))}</p><p>${tr('可点击上方刷新重试。','Use Refresh above to try again.')}</p>`;
 } finally {if(panel.isConnected&&context.evidenceRequest===request)panel.setAttribute('aria-busy','false');}
}
function showJob(id,profileId=ui.profileId) {
 const j=jobById(id);if(!j)return;const p=state.profiles.find(p=>p.id===profileId);if(!p)return;ui.modal={type:'job',id,profileId:p.id,profileRevision:p.revision};const fit=matchJob(j,p);
 const existing=state.resumes.filter(r=>r.jobId===id&&r.profileId===p.id);
 modal(tr('机会详情'),`<div class="job-modal-body"><div class="detail-title">${companyLogo(j)}<div><h3>${e(j.title)}</h3><p>${e(j.company)} · ${e(j.location)}</p></div><span class="badge lilac">${j.active?e(tr(j.sourceName)):tr('上次同步已下架')}</span></div><div class="detail-meta"><span>${e(tr(j.salary))}</span><span>${e(tr(j.work))}</span><span>${trackName(j.track)}</span></div><div class="detail-columns"><div><h4>${j.descriptionKind==='summary'?tr('岗位摘要'):tr('关于这个机会')}</h4>${j.descriptionKind==='summary'?tr('<div class="notice"><b>岗位摘要 · 申请前请核验原文</b><p>以下为官网职位的摘要，完整职责、要求和当前招聘状态请打开原文确认。</p></div>'):''}<p class="job-description">${e(j.description)}</p><h4>${tr("我们期待的你")}</h4><ul>${j.requirements.map(r=>`<li>${e(r)}</li>`).join('')}</ul><a class="text-button" href="${e(j.url)}" target="_blank" rel="noopener noreferrer">${tr("打开岗位原文")} ${icon('external')}</a><p class="field-help">${tr("来源：")}${e(tr(j.sourceName))} · ${jobSourceKind(j)==='synced'?tr('同步于'):tr('收录于')} ${date(j.syncedAt)}${tr("。申请前请核对原文是否仍在招聘。")}</p></div><aside class="fit-panel"><span>${icon('spark')} ${tr("与「")}${e(p.label)}${tr("」匹配")}</span><strong>${fit.score}<small>%</small></strong><div class="progress-bar"><i style="width:${fit.score}%"></i></div><p>${tr("职位方向")}${fit.role?tr('相符'):tr('不同')} ${tr("· 技能重合")} ${fit.matched.length}/${j.tags.length} · ${fit.sameTrack?tr('求职阶段一致'):tr('求职阶段不同')}</p><div class="tags">${fit.matched.map(t=>`<span class="tag-match">✓ ${e(t)}</span>`).join('')}</div>${fit.missing.length?`<h5>${tr("可以进一步确认")}</h5><p>${fit.missing.map(e).join('、')}</p>`:''}<small>${tr("基于技能、目标方向与求职阶段的规则计算，不代表录用概率。")}</small></aside></div>${existing.length?`<div class="existing-resumes"><h4>「${e(p.label)}${tr("」已为这个岗位准备")} ${existing.length} ${tr("份简历")}</h4>${existing.map(r=>`<button class="text-button" data-action="resume-detail" data-id="${r.id}">${icon('file')}${date(r.createdAt)} · ${r.status==='reviewed'?tr('已审核'):tr('待审核')}${icon('arrow')}</button>`).join('')}</div>`:''}<div class="generation-controls"><label class="generation-profile">${tr("生成使用的画像")}<select id="generation-profile">${profileOptions(p.id)}${p.archived?`<option value="${p.id}" selected>${e(p.label)}${tr("（已归档）")}</option>`:''}</select></label><p class="profile-generation-note">${e(p.target||tr('未填写目标职位'))} · ${tr(scopeNames[profileSearchScope(p)])} ${tr("· 仅使用这份画像已保存的经历")}${p.archived?tr('（请先恢复画像再生成）'):''}</p><label>${tr("简历语言")}<select id="resume-language"><option value="zh" ${p.resumeLanguage==='zh'?'selected':''}>${tr("中文")}</option><option value="en" ${p.resumeLanguage==='en'?'selected':''}>English</option></select></label><p>${icon('info')} ${e(providerName(state.settings.provider))} · ${e(state.settings.model)}</p><label class="inline-check"><input type="checkbox" id="generation-consent"/> ${tr("我同意把「")}${e(p.label)}${tr("」与岗位要求发送给该服务，并使用该账户额度")}</label></div></div><div class="modal-footer"><button class="button secondary" data-action="track-job" data-id="${id}">${icon('plus')} ${state.applications.some(a=>a.jobId===id&&a.profileId===p.id)?tr('已加入投递计划'):tr('加入投递计划')}</button><button class="button primary" data-action="generate" data-id="${id}" ${p.archived?'disabled':''}>${icon('spark')} ${tr("生成专属简历")} </button></div>`,true);
 const work=$('.detail-meta span:nth-child(2)');
 work.textContent=!j.work||j.work==='未注明'?tr('办公方式未注明','Work arrangement not specified'):`${tr('办公方式','Work arrangement')}：${tr(j.work)}`;
 work.title=tr('岗位原文中的现场、混合或远程办公安排；未注明时需向招聘方确认。','On-site, hybrid or remote work as stated in the listing. Confirm with the employer when unspecified.');
 $('.detail-meta').insertAdjacentHTML('beforeend',`<button type="button" class="button secondary evidence-entry-button" data-action="open-evidence">${icon('file')}${tr('经历对比','Compare experience')}</button>`);
}
function showResume(id,view='auto') {
 const r=state.resumes.find(x=>x.id===id);if(!r){toast(tr('这份简历已被删除。'));return;}
 const exportView=r.status==='reviewed'&&view!=='edit';
 ui.modal={type:'resume',id,view:exportView?'export':'edit'};
 if(exportView){
  const layout=normalizeResumeLayout(r.layout);
  modal(tr('已审核'),`
   <div class="resume-export-intro"><span class="badge mint">${tr('已审核')}</span><strong>${e(r.title)}</strong><p>${tr('已审核，可以导出并自行投递。')}</p></div>
   <div class="resume-export-preview"><article class="resume-paper layout-${layout}">${markdownToHtml(r.content,layout)}</article></div>
   <div class="modal-footer studio-footer"><button class="button secondary" data-action="edit-reviewed-resume" data-id="${id}">${icon('edit')} ${tr('编辑内容')}</button><div class="button-row"><button class="button secondary" data-action="download-resume" data-id="${id}">${icon('download')} ${tr('保存 Markdown','Save Markdown')}</button><button class="button primary" data-action="print-resume" data-id="${id}">${icon('download')} ${tr('保存 PDF / 打印','Save PDF / Print')}</button></div></div>`,true);
  return;
 }
 const layout=normalizeResumeLayout(r.layout);
 modal(tr('简历工作室'),`
  <div class="studio-toolbar"><div><strong>${e(r.title)}</strong><p class="source-profile">${tr('来源画像：')}${e(sourceLabel(r))}${r.profileRevision?` ${tr('· 版本')} ${r.profileRevision}`:''}</p><span class="badge ${r.status==='reviewed'?'mint':'lilac'}">${r.status==='reviewed'?tr('已审核'):tr('待审核')}</span></div><span class="muted">${e(providerName(r.mode))} ${tr('生成 · 需核实事实')}</span></div>
  ${resumeLayoutPickerHtml(r.layout,tr)}
  <div class="studio"><section class="studio-editor"><div class="editor-label">${icon('edit')} ${tr('编辑内容')} <span>${tr('支持简单 Markdown')}</span></div><textarea id="resume-editor" aria-label="${tr('简历内容')}" maxlength="40000" spellcheck="false">${e(r.content)}</textarea><div class="review-notes"><h4>${icon('info')} ${tr('简历修改提示','Resume editing tips')}</h4><ul>${resumeReviewTips(r).map(n=>`<li>${e(n)}</li>`).join('')}</ul></div></section><section class="studio-preview"><div class="preview-label">${tr('简历预览')} <span>${tr('A4 · 可打印为 PDF')}</span></div><article class="resume-paper layout-${layout}" id="resume-preview">${markdownToHtml(r.content,layout)}</article></section></div>
  <div class="review-check"><label><input type="checkbox" id="review-confirm" ${r.status==='reviewed'?'checked':''}/> ${tr('我已逐项确认经历、技能和联系方式真实准确')}</label><small>${tr('修改内容后需重新审核；导出不代表已投递。')}</small></div>
  <div class="modal-footer studio-footer"><button class="button secondary" data-action="save-resume" data-id="${id}">${tr('保存修改')}</button><button class="button primary" data-action="review-resume" data-id="${id}">${icon('check')} ${tr('确认审核完成')}</button></div>`,true);
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
 modal(tr('正在生成专属简历'),`<div class="generation-progress"><div class="loading-orb">${icon('spark')}</div><h3>${tr("正在结合岗位要求整理真实经历")}</h3><p>${tr("模型通常需要一到两分钟。任务已保存，刷新后可在「生成记录」查看。")}</p></div>`);
 try {let task;for(;;){task=await api('/api/tasks/'+encodeURIComponent(id));if(task.status!=='running')break;await new Promise(r=>setTimeout(r,1800));}await refresh();ui.generating=false;closeModal();render();if(task.status==='failed')throw new Error(task.error);showResume(task.resumeId);toast(tr('简历已保存到数据库，请审核每一项事实。'));}
 finally{ui.generating=false;}
}
async function generate(id) {
 if(ui.generating)return;
 if(!$('#generation-consent')?.checked)throw new Error(tr('请先确认数据发送与账户额度使用。'));
 const task=await api('/api/generate',{...state.settings,language:$('#resume-language').value,jobId:id,profileId:ui.modal.profileId,profileRevision:ui.modal.profileRevision,requestId:uid(),consent:true});
 await pollTask(task.id);
}
async function printResume(id) {
 const r=state.resumes.find(resume=>resume.id===id);
 if(r?.status!=='reviewed')throw new Error(tr('请先逐项审核并勾选确认。'));
 const win=window.open('','_blank');if(!win)throw new Error(tr('请允许打印窗口后重试。'));
 try {
  let printRequested=false;
  const requestPrint=()=>{if(printRequested)return;printRequested=true;win.print();};
  win.addEventListener('load',requestPrint,{once:true});
  win.document.write(resumePrintDocumentHtml({...r,buttonLabel:tr('打印 / 保存 PDF')},markdownToHtml));
  win.document.close();
  win.document.getElementById('print').addEventListener('click',requestPrint);
  if(win.document.readyState==='complete')requestPrint();
  win.opener=null;
 }catch(err){win.close();throw err;}
}
function importJob() {modal(tr('导入真实岗位'),`<form id="import-job-form" class="dialog-content"><div class="form-grid"><label>${tr("公司")}<input name="company" required maxlength="200"/></label><label>${tr("职位")}<input name="title" required maxlength="200"/></label><label>${tr("地点")}<input name="location" required maxlength="200"/></label><label>${tr("岗位原文链接")}<input name="url" type="url" required placeholder="https://..."/></label><label>${tr("地区")}<select name="region"><option value="cn">${tr("中国大陆")}</option>${Object.entries(COUNTRIES).map(([id,names])=>`<option value="${id}">${localizedLabel(names)}</option>`).join('')}<option value="na">${tr("北美（国家未注明）")}</option><option value="other">${tr("其他")}</option></select></label><label>${tr("类型")}<select name="track"><option value="unknown">${tr("未注明")}</option><option value="campus">${tr("校招 / 实习")}</option><option value="experienced">${tr("社招")}</option></select></label></div><label>${tr("完整岗位描述")}<textarea name="description" required rows="10" maxlength="24000" placeholder="${tr("粘贴职责、要求和申请条件；不会自动绕过招聘网站登录")}"></textarea></label><button class="button primary" type="submit">${tr("保存到岗位库")}</button></form>`,true);}

const actions={
 'manage-resumes':()=>{ui.recordProfileId='';go('resumes');},
 'upload-avatar':()=>$('#user-avatar-file').click(),
 'remove-avatar':()=>{avatarSequence++;ui.avatarBusy=false;ui.userDraft={...(ui.userDraft||state.user),avatar:''};render();},
 'discard-user':()=>{avatarSequence++;ui.avatarBusy=false;ui.userDraft=null;render();},
 'new-profile':()=>profileDialog(),
 'copy-profile':()=>profileDialog(true),
 'archive-profile':async()=>{if(ui.drafts[ui.profileId])throw new Error(tr('请先保存当前画像再归档。'));await update('/api/profiles/archive',{id:ui.profileId,revision:state.profile.revision,archived:true});render();toast(tr('画像已归档，历史简历与记录保留，可随时恢复。'));},
 'restore-profile':async el=>{const p=state.profiles.find(p=>p.id===el.dataset.id);await update('/api/profiles/archive',{id:p.id,revision:p.revision,archived:false});chooseProfile(p.id);render();toast(tr('画像已恢复。'));},
 'nav':el=>go(el.dataset.route),
 'menu':()=>{ui.mobileMenu=!ui.mobileMenu;$('.sidebar').classList.toggle('is-open',ui.mobileMenu);},
 'notifications':()=>modal(tr('本地使用流程'),tr('<div class="dialog-content"><p>填写个人档案 → 同步或导入真实岗位 → 选择 AI 服务 → 生成、编辑与审核简历 → 导出并自行投递。</p><p>档案与简历保存在本机数据库。只有点击生成并确认后，才会将档案发送给所选 AI 服务。</p></div>')),
 'saved-filter':el=>{ui.savedOnly=el.dataset.value==='saved';ui.limit=ui.pageSize;render();},
 'company-filter':el=>{ui.company=el.dataset.company||'';ui.limit=ui.pageSize;render();},
 'search-official-jobs':()=>searchOfficialJobs(),
 'relax-work':()=>{ui.work='';ui.limit=ui.pageSize;render();},
 'profile-filters':()=>{resetProfileSearch();render();},
 'clear-filters':()=>{const pageSize=ui.pageSize;Object.assign(ui,defaultJobFilters(),{pageSize,limit:pageSize});render();},
 'toggle-companies':el=>{ui.companiesOpen=!ui.companiesOpen;el.setAttribute('aria-expanded',String(ui.companiesOpen));$('#company-content').hidden=!ui.companiesOpen;el.querySelector('[data-company-toggle-label]').textContent=ui.companiesOpen?tr('收起'):tr('展开');},
 'more-jobs':()=>loadMoreJobs(),
 'refresh':async()=>{await refresh();render();},
 'save-job':async el=>{await update('/api/jobs/save',{id:el.dataset.id,saved:!state.saved.includes(el.dataset.id)});render();},
 'job-detail':el=>showJob(el.dataset.id,el.dataset.profileId||ui.profileId), 'close-modal':closeModal, 'generate':el=>generate(el.dataset.id),
 'open-evidence':()=>showJobEvidence(), 'close-evidence':()=>closeEvidence(),
 'refresh-evidence':async()=>{const context=ui.evidence;await refresh();if(ui.evidence===context&&context)showJobEvidence(context.profileId);},
 'edit-evidence-profile':()=>{const id=ui.evidence.profileId;chooseProfile(id);closeEvidence(false);closeModal();go('profile');},
 'resume-detail':el=>showResume(el.dataset.id), 'resume-task':el=>pollTask(el.dataset.id),
 'track-job':async el=>{const profileId=ui.modal.profileId;await update('/api/applications',{jobId:el.dataset.id,profileId});render();showJob(el.dataset.id,profileId);toast(tr('已加入投递计划。'));},
 'save-resume':async el=>{await saveCurrentResume(el.dataset.id);render();showResume(el.dataset.id,'edit');toast(tr('简历已保存。内容变更后需要重新审核。'));},
 'review-resume':async el=>{if(!$('#review-confirm').checked)throw new Error(tr('请先逐项审核并勾选确认。'));await saveCurrentResume(el.dataset.id,true);render();showResume(el.dataset.id,'export');toast(tr('已审核，可以导出并自行投递。'));},
 'edit-reviewed-resume':el=>showResume(el.dataset.id,'edit'),
 'download-resume':el=>{const r=state.resumes.find(resume=>resume.id===el.dataset.id);if(r?.status!=='reviewed')throw new Error(tr('请先逐项审核并勾选确认。'));download(`FoundMyJob-${r.title.replace(/[<>:"/\\|?*]/g,'-')}.md`,orderResumeMarkdown(r.content,normalizeResumeLayout(r.layout)),'text/markdown;charset=utf-8');toast(tr('简历已导出。'));},
 'print-resume':el=>printResume(el.dataset.id),
 'delete-resume':el=>modal(tr('删除这份简历？'),`<div class="dialog-content"><p>${tr("此简历及历史版本将被删除，投递记录保留。")}</p><button class="button danger" data-action="confirm-delete" data-id="${el.dataset.id}">${tr("确认删除")}</button></div>`),
 'confirm-delete':async el=>{await update('/api/resumes/delete',{id:el.dataset.id});closeModal();render();toast(tr('简历已删除。'));},
 'import-text':()=>$('#profile-file').click(), 'import-job':importJob,
 'export-backup':()=>{const {token,providers,capabilities,profile,...data}=state;download('FoundMyJob-data.json',JSON.stringify(data,null,2),'application/json');toast(tr('已导出数据，不包含 Key 或登录信息。'));},
 'export-legacy':()=>{const old=localStorage.getItem('foundmyjob:demo:v1');if(!old)throw new Error(tr('当前浏览器没有旧演示记录。'));download('FoundMyJob-legacy-demo.json',old,'application/json');},
 'cursor-status':async()=>{$('#cursor-status').textContent=tr('正在检查…');const r=await api('/api/cursor/status');$('#cursor-status').textContent=r.message;},
 'save-key':async()=>{const key=$('#api-key').value;await update('/api/credentials',{provider:ui.provider,key});$('#api-key').value='';render();toast(tr('Key 已存入本机服务内存，不会写入文件。'));},
 'clear-key':async()=>{await update('/api/credentials',{provider:ui.provider,remove:true});render();toast(tr('已清除当前服务的 Key。'));},
 'load-models':async()=>{toast(tr('正在获取厂商模型列表…'));ui.models=(await api('/api/models?provider='+ui.provider)).models;render();toast(`${tr("获取")} ${ui.models.length} ${tr("个模型，请选择并保存。")}`);},
 'sync-jobs':async el=>{
  const all=el.dataset.all==='true';
  let sourceId=el.dataset.id;
  if(!all&&!sourceId&&ui.route==='jobs'&&ui.company){
   const selected=companyDiscoveryGroups(state.sources,state.profile).flatMap(group=>group.companies).find(company=>company.company===ui.company);
   if(!selected?.sourceId)throw new Error(tr('这家公司尚未接入岗位源，请使用招聘官网入口。','This company has no connected job feed yet. Use its official career link.'));
   sourceId=selected.sourceId;
  }
  await startJobSync('/api/jobs/sync',{profileId:ui.profileId,...(all?{all:true}:{region:ui.region}),...(sourceId?{sourceId}:{})});
 },
 'add-source':()=>modal(tr('添加企业招聘板'),`<form id="source-form" class="dialog-content"><label>${tr("招聘系统")}<select name="provider"><option value="greenhouse">Greenhouse</option><option value="lever">Lever</option></select></label><label>${tr("公司名称")}<input name="company" required maxlength="100"/></label><label>${tr("招聘板标识")}<input name="slug" required pattern="[a-zA-Z0-9_-]+" placeholder="${tr("例如 figma，不是完整网址")}" maxlength="80"/></label><p class="field-help">${tr("从公司官方招聘链接中找到 board token；此处不会抓取任意网址。")}</p><button class="button primary" type="submit">${tr("添加来源")}</button></form>`),
};
document.addEventListener('click',async event=>{const el=event.target.closest('[data-action]');if(!el||el.disabled)return;el.disabled=true;try{await actions[el.dataset.action]?.(el);}catch(error){toast(error.message||tr('操作失败。'));}finally{el.disabled=false;}});
document.addEventListener('submit',async event=>{
 event.preventDefault();const form=event.target,data=Object.fromEntries(new FormData(form)),button=form.querySelector('[type="submit"]');if(button)button.disabled=true;
 try {
  if(form.id==='job-search'){applyJobSearch(data);render();}
  if(form.id==='user-form'){
   if(ui.avatarBusy)throw new Error(tr('请等待头像处理完成。','Wait for the avatar to finish processing.'));
   const draft=ui.userDraft,user=draft||state.user;
   await update('/api/user',{username:data.username,avatar:user.avatar,revision:user.revision});
   if(ui.userDraft===draft)ui.userDraft=null;else if(ui.userDraft)ui.userDraft={...ui.userDraft,revision:state.user.revision};
   render();toast(tr('用户信息已保存。','User information saved.'));
  }
  if(form.id==='profile-form'){
   const basics=form.dataset.mode==='basics',draft=ui.drafts[form.dataset.id];
   await update(basics?'/api/profiles/basics':'/api/profiles/save',{...profileFormData(data),id:form.dataset.id,revision:Number(form.dataset.revision)});
   const saved=state.profiles.find(p=>p.id===form.dataset.id);
   const pending=basics&&draft?Object.fromEntries(['education','experience','projects'].filter(key=>draft[key]!==saved[key]).map(key=>[key,draft[key]])):{};
   if(Object.keys(pending).length)ui.drafts[form.dataset.id]={...saved,...pending};else delete ui.drafts[form.dataset.id];
   resetProfileSearch();render();toast(tr('当前画像已保存，其他画像不受影响。'));
  }
  if(form.id==='create-profile-form'){const next=await api('/api/profiles/create',data);accept(next);chooseProfile(next.createdProfileId);closeModal();go('profile');toast(tr('画像已创建，请填写或调整真实经历后保存。'));}
  if(form.id==='settings-form'){await update('/api/settings',{...data,revision:state.settings.revision,freeOnly:ui.provider==='openrouter'&&ui.freeOnly===true});toast(tr('生成设置已保存。'));}
  if(form.id==='import-job-form'){await update('/api/jobs/import',data);closeModal();go('jobs');toast(tr('岗位已保存。'));}
  if(form.id==='source-form'){await update('/api/sources',data);closeModal();render();toast(tr('来源已添加，点击同步即可获取岗位。'));}
 }catch(err){toast(err.message);}finally{if(button)button.disabled=false;}
});
document.addEventListener('change',async event=>{
 const el=event.target;
 if(el.name==='resume-template'){const preview=$('#resume-preview');if(preview){const layout=normalizeResumeLayout(el.value);preview.className=`resume-paper layout-${layout}`;preview.innerHTML=markdownToHtml($('#resume-editor').value,layout);}}
 try {
  if(el.id==='user-avatar-file'&&el.files[0]){
   const file=el.files[0],sequence=++avatarSequence;el.value='';
   ui.userDraft={...(ui.userDraft||state.user)};ui.avatarBusy=true;render();
   try{const avatar=await prepareAvatar(file);if(sequence===avatarSequence)ui.userDraft={...ui.userDraft,avatar};}
   finally{if(sequence===avatarSequence){ui.avatarBusy=false;if(ui.route==='account')render();}}
  }
  if(el.dataset.profileSelect){chooseProfile(el.value);render();}
  if(el.id==='generation-profile'){const id=ui.modal.id;chooseProfile(el.value);render();showJob(id);}
  if(el.id==='evidence-profile')showJobEvidence(el.value);
  if(el.id==='record-profile'){ui.recordProfileId=el.value;render();}
  if(el.closest('#profile-form')&&el.type!=='file'){
   const form=el.closest('#profile-form');
   if(el.name==='preferenceCountry'){
    form.elements.preferenceCity.value='';form.elements.preferenceCityCustom.value='';form.elements.market.value=el.value;
    if(el.value)form.elements.searchScope.value=el.value==='cn'?'domestic':'overseas';
   }
   if(el.name==='searchScope'){
    const country=form.elements.preferenceCountry.value;
    if(country&&(el.value==='all'||(el.value==='domestic')!==(country==='cn'))){form.elements.preferenceCountry.value='';form.elements.preferenceCity.value='';form.elements.preferenceCityCustom.value='';}
    form.elements.market.value=el.value==='domestic'?'cn':el.value==='all'?'':form.elements.preferenceCountry.value||'overseas';
   }
   if(el.name==='preferenceCity'&&el.value==='__custom'){form.elements.preferenceCityCustom.closest('label').hidden=false;form.elements.preferenceCityCustom.required=true;form.elements.preferenceCityCustom.focus();}
   rememberProfileDraft(form);
   if(el.name==='track'){render();return;}
   if(['preferenceCountry','searchScope'].includes(el.name)||(el.name==='preferenceCity'&&el.value!=='__custom'))render();
  }
  if(el.id==='ui-language'){
   // Keep unsaved form values in this render only; never persist credential inputs.
   const fields=[...document.querySelectorAll('#app input, #app textarea, #app select')].filter(field=>field.id!=='ui-language'&&field.type!=='file').map(field=>({id:field.id,name:field.name,value:field.value,checked:field.checked}));
   if($('#job-search'))Object.assign(ui,Object.fromEntries(new FormData($('#job-search'))));
   setLocale(el.value);render();
   for(const field of document.querySelectorAll('#app input, #app textarea, #app select')){
    const previous=fields.find(item=>field.id?item.id===field.id:field.name&&item.name===field.name);
    if(previous){field.value=previous.value;if(field.type==='checkbox'||field.type==='radio')field.checked=previous.checked;}
   }
  }
  if(el.id==='company-country'||el.id==='company-category'){
   if(el.id==='company-country'){ui.companyCountry=el.value;ui.region=el.value||(profileSearchScope(state.profile)==='overseas'?'overseas':'');ui.city='';}
   else ui.companyCategory=el.value;
   ui.company='';ui.limit=ui.pageSize;render();
  }
  if(el.id==='job-sort'){ui.sort=el.value;ui.limit=ui.pageSize;render();}
 if(el.id==='job-page-size'){ui.pageSize=el.value==='50'?50:25;ui.limit=ui.pageSize;render();}
 if(el.id==='job-source-kind'){ui.sourceKind=el.value;ui.limit=ui.pageSize;render();}
 if(el.id==='target-only'){ui.targetOnly=el.checked;ui.limit=ui.pageSize;render();}
  if(el.closest('#job-search')&&el.tagName==='SELECT'){applyJobSearch(Object.fromEntries(new FormData($('#job-search'))));render();}
  if(el.dataset.application){const a=state.applications.find(a=>a.id===el.dataset.application);await update('/api/applications/status',{id:a.id,status:el.value,revision:a.revision});render();toast(tr('投递进度已保存。'));}
  if(el.id==='profile-file'&&el.files[0]){
   const file=el.files[0],profileId=el.closest('#profile-form').dataset.id;el.value='';
   const currentForm=()=>{const form=$('#profile-form');if(!form||form.dataset.id!==profileId)throw new Error(tr('画像已切换，请重新选择文件。','The profile changed. Please select the file again.'));return form;};
   await previewDocumentImport(file,{token:state.token,profileLabel:state.profile.label,showModal:modal,closeModal,
    readField:key=>currentForm().elements[key].value,
    writeFields:changes=>{const form=currentForm();for(const [key,text] of Object.entries(changes))form.elements[key].value=text;rememberProfileDraft(form);toast(tr('已填入所选画像的经历草稿，请检查并保存。'));},
   });
  }
  if(el.id==='provider-select'){ui.provider=el.value;ui.models=[];ui.freeOnly=el.value==='openrouter';render();}
  if(el.id==='free-models'){ui.freeOnly=el.checked;render();}
 }catch(err){toast(err.message);if(el.dataset.application)render();}
});

function rememberProfileDraft(form=$('#profile-form')){
 if(!form)return;
 const data=Object.fromEntries(new FormData(form));
 ui.drafts[form.dataset.id]={...(ui.drafts[form.dataset.id]||state.profiles.find(p=>p.id===form.dataset.id)),...profileFormData(data),id:form.dataset.id,revision:Number(form.dataset.revision)};
 form.querySelector('#profile-draft-note').textContent=tr('有未保存修改；搜索和生成使用已保存版本。');
}
window.addEventListener('beforeunload',event=>{if(Object.keys(ui.drafts).length||userHasDraft()||ui.avatarBusy){event.preventDefault();event.returnValue='';}});
document.addEventListener('input',event=>{if(event.target.closest('#user-form')&&event.target.name==='username')ui.userDraft={...(ui.userDraft||state.user),username:event.target.value};if(event.target.closest('#profile-form')&&event.target.type!=='file')rememberProfileDraft();if(event.target.id==='resume-editor'){$('#resume-preview').innerHTML=markdownToHtml(event.target.value,normalizeResumeLayout(document.querySelector('input[name="resume-template"]:checked')?.value));$('#review-confirm').checked=false;}});

async function boot() {
 try{await refresh();ui.provider=state.settings.provider;ui.freeOnly=state.settings.freeOnly===true;ui.syncing=state.syncing;render();if(state.syncing)void watchJobSync();}
 catch(error){$('#app').innerHTML=`<main class="panel" style="margin:48px"><h1>${tr("本地后端未连接")}</h1><p>${e(error.message)}</p><p>${tr("请双击项目中的 Start-FoundMyJob.cmd 启动，再刷新页面。")}</p><button id="retry" class="button primary">${tr("重新连接")}</button></main>`;$('#retry').addEventListener('click',boot);}
}
boot();
