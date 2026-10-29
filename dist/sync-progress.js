import {escapeHtml as e} from './core.js';
import {t as tr} from './i18n.js';

export function syncDuration(start,end=Date.now()){
  const seconds=Math.max(0,Math.floor((new Date(end).getTime()-new Date(start).getTime())/1000));
  if(!Number.isFinite(seconds))return '0:00';
  return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
}
const count=value=>Number.isSafeInteger(value)&&value>=0?value:0;
export function syncProgressHtml(progress={},now=Date.now()){
  if(progress.status!=='running')return '';
  const running=progress.status==='running',search=progress.mode==='search',total=count(progress.total),completed=Math.min(count(progress.completed),total);
  const known=total>0,percent=known?Math.floor(completed/total*100):null;
  const failed=count(progress.failed),pending=count(progress.pending),partial=count(progress.partial),issues=failed+pending;
  const heading=progress.connectionLost?tr('连接暂时中断，正在重试','Connection interrupted. Retrying'):search?tr('正在搜索官网岗位','Searching official job sites'):tr('正在同步岗位','Syncing jobs');
  const elapsed=syncDuration(progress.startedAt,progress.finishedAt||now);
  return `<section class="sync-panel ${running?'is-running':'is-finished'} ${issues||progress.status==='failed'?'has-issues':''}" aria-label="${tr('岗位同步进度','Job sync progress')}" data-sync-progress>
    <div class="sync-heading"><div class="sync-title"><span class="sync-activity" aria-hidden="true">${running?'':issues||progress.status==='failed'?'!':'✓'}</span><div><h2>${heading}</h2><p>${known?tr(`已处理 ${completed} / ${total} 个招聘来源`,`Processed ${completed} / ${total} job sources`):running?tr('正在连接招聘来源…','Connecting to job sources…'):tr('没有可同步的招聘来源','No job sources to sync')}</p></div></div><div class="sync-number">${percent===null?'—':percent+'%'}<span>${tr('来源进度','Source progress')}</span></div></div>
    <div class="sync-track ${running&&!known?'is-indeterminate':''}" role="progressbar" aria-label="${tr('招聘来源处理进度','Job source processing progress')}" aria-valuemin="0" aria-valuemax="100" ${known?`aria-valuenow="${percent}" aria-valuetext="${e(tr(`已处理 ${completed} / ${total} 个来源`,`Processed ${completed} of ${total} sources`))}"`:''}><div class="sync-fill" style="width:${percent??0}%"></div>${running?'<div class="sync-shimmer" aria-hidden="true"></div>':''}</div>
    <div class="sync-metrics"><span>${tr('已用时','Elapsed')} <b ${running&&progress.startedAt?`data-sync-start="${e(progress.startedAt)}"`:''}>${elapsed}</b></span><span>${tr('已读取岗位','Jobs received')} <b>${count(progress.jobsReceived).toLocaleString()}</b></span><span>${tr('成功来源','Successful sources')} <b>${count(progress.succeeded)}</b>${partial?tr(`（${partial} 个覆盖有限）`,` (${partial} partial)`):''}</span>${issues?`<span class="sync-issue-count">${tr('失败 / 待接通','Failed / unavailable')} <b>${failed} / ${pending}</b></span>`:''}</div>
  </section>`;
}

export function syncDockHtml(progress={}){
  if(progress.status!=='running')return '';
  const total=count(progress.total),completed=Math.min(count(progress.completed),total),percent=total?Math.floor(completed/total*100):null;
  const heading=progress.connectionLost?tr('连接中断，正在重试','Connection interrupted. Retrying'):progress.mode==='search'?tr('正在搜索官网岗位','Searching official jobs'):tr('正在同步岗位','Syncing jobs');
  return `<div class="sync-dock-heading"><span><i aria-hidden="true"></i>${heading}</span><span class="sync-dock-count">${total?`${completed} / ${total}`:tr('正在连接…','Connecting…')}<b>${percent===null?'—':percent+'%'}</b></span></div><div class="sync-track ${total?'':'is-indeterminate'}" role="progressbar" aria-label="${tr('招聘来源处理进度','Job source processing progress')}" aria-valuemin="0" aria-valuemax="100" ${percent===null?'':`aria-valuenow="${percent}"`}><div class="sync-fill" style="width:${percent??0}%"></div><div class="sync-shimmer" aria-hidden="true"></div></div>`;
}

// Observe the stable shell, so polling can replace its contents without flickering the dock.
export function observeSyncDock(panel,dock,view=window){
  if(!panel||!dock)return ()=>{};
  let active=true;
  const update=()=>{
    if(!active)return;
    const visible=panel.getBoundingClientRect().bottom<=0;
    dock.classList.toggle('is-visible',visible);
    dock.setAttribute('aria-hidden',String(!visible));
  };
  update();
  if(view.IntersectionObserver){
    const observer=new view.IntersectionObserver(update,{threshold:0});
    observer.observe(panel);
    return ()=>{active=false;observer.disconnect();};
  }
  view.addEventListener('scroll',update,{passive:true});
  view.addEventListener('resize',update);
  return ()=>{active=false;view.removeEventListener('scroll',update);view.removeEventListener('resize',update);};
}

export async function dismissSyncProgress(panel,dock,view=window){
  panel?.classList.add('is-leaving');
  dock?.classList.remove('is-visible');
  dock?.setAttribute('aria-hidden','true');
  if((panel||dock)&&!view.matchMedia?.('(prefers-reduced-motion: reduce)').matches){
    await new Promise(resolve=>view.setTimeout(resolve,400));
  }
  panel?.remove();dock?.remove();
}
