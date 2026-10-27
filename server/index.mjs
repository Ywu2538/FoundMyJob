import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { generateWithCursor, runProcess, cursorExecutable, buildPrompt } from './cursor.mjs';
import { Store, blankProfile } from './db.mjs';
import { fetchJobs, manualJob } from './jobs.mjs';
import { Providers } from './providers.mjs';
import {COMPANY_LOGOS} from '../dist/company-logos.js';
import { profileSearchScope } from '../dist/core.js';
import {DEFAULT_RESUME_LAYOUT,isResumeLayout} from '../dist/resume-layouts.js';

const root=fileURLToPath(new URL('../dist/',import.meta.url));
const files={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/core.js':'core.js','/styles.css':'styles.css','/favicon.svg':'favicon.svg'};
files['/company-logos.js']='company-logos.js';
files['/profile-track.js']='profile-track.js';
files['/resume-markdown.js']='resume-markdown.js';
files['/resume-layouts.js']='resume-layouts.js';
files['/resume.css']='resume.css';
for(const asset of Object.values(COMPANY_LOGOS))files[asset]=asset.slice(1);
const types={'.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const string=(v,max,required=false)=>{if(typeof v!=='string'||v.length>max||(required&&!v.trim()))fail('输入字段为空或超过长度限制。');return v.trim();};
const enumeration=(v,values)=>values.includes(v)?v:fail('选项无效。');
function syncError(error) {
  if(error.cause?.code==='ERR_SSL_UNSAFE_LEGACY_RENEGOTIATION_DISABLED')return '官网使用不受当前 Node.js 支持的旧版 TLS 协商，暂时无法安全连接；已保留岗位。';
  if(error.name==='TimeoutError'||error.name==='AbortError')return '官网响应超时，请稍后重试；已保留上次岗位。';
  if(error.message==='fetch failed')return '官网连接失败，请稍后重试或打开招聘官网；已保留上次岗位。';
  return String(error.message).slice(0,240);
}
function searchLocation(input,source={}) {
  const market=enumeration(input.market??source.market??'',['','cn','ca','us','other','overseas']);
  const searchScope=enumeration(input.searchScope??(input.market!==undefined?profileSearchScope({market}):profileSearchScope(source)),['domestic','overseas','all']);
  return {searchScope,market:searchScope==='all'?'':searchScope==='domestic'?'cn':['ca','us','other','overseas'].includes(market)?market:'overseas'};
}
export function createServer({store=new Store(),cursorEnabled=process.env.FMJ_ALLOW_CURSOR==='1',generator=generateWithCursor,providers=new Providers(),jobFetcher=fetchJobs}={}) {
  if(process.env.FMJ_DEPLOYMENT&&process.env.FMJ_DEPLOYMENT!=='local')throw new Error('当前版本仅支持单用户本机运行；云部署需要独立账户、额度和密钥隔离服务。');
  const token=randomBytes(32).toString('hex');let busy=false,syncing=false;const lastSync=new Map();
  const snapshot=()=>({...store.snapshot(),token,syncing,providers:providers.list(),capabilities:{cursor:cursorEnabled,platformCredits:false}});
  const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
  const server=http.createServer(async(req,res)=>{
    try {
      const port=res.socket.localPort,hosts=new Set([`127.0.0.1:${port}`,`localhost:${port}`]);
      if(!hosts.has(req.headers.host))return json(res,403,{error:'只允许本地访问。'});
      if(req.headers.origin&&!new Set([...hosts].map(h=>`http://${h}`)).has(req.headers.origin))return json(res,403,{error:'不接受跨站请求。'});
      if(req.headers['sec-fetch-site']==='cross-site')return json(res,403,{error:'不接受跨站请求。'});
      const url=new URL(req.url,'http://localhost'),p=url.pathname;
      if(p==='/api/health'&&req.method==='GET')return json(res,200,{app:'foundmyjob',mode:'local',database:'sqlite'});
      if(p==='/api/state'&&req.method==='GET')return json(res,200,snapshot());
      if(p==='/api/cursor/status'&&req.method==='GET') {
        if(!cursorEnabled)return json(res,200,{enabled:false,message:'本机 Cursor 开关未开启。请在本机 .env.local 配置 FMJ_ALLOW_CURSOR=1 后重启。'});
        try{const cli=cursorExecutable();const {stdout}=await runProcess(cli.command,[...cli.args,'status','--format','json'],{timeout:10000});const s=JSON.parse(stdout);return json(res,200,{enabled:!!s.isAuthenticated,message:s.isAuthenticated?'Cursor CLI 已登录，可使用本机账号生成简历。':'Cursor CLI 尚未登录。请双击 Login-Cursor.cmd 完成官方登录。'});}catch{return json(res,200,{enabled:false,message:'未找到可用 CLI。请安装 Cursor CLI 并双击 Login-Cursor.cmd 登录。'});}
      }
      if(p.startsWith('/api/tasks/')&&req.method==='GET') {const task=store.get('tasks',p.slice(11));if(!task)fail('任务不存在。',404);return json(res,200,task);}
      if(p==='/api/models'&&req.method==='GET') {if(req.headers['x-fmj-token']!==token)fail('本地会话验证失败，请刷新页面。',403);return json(res,200,{models:await providers.models(url.searchParams.get('provider'))});}
      if(p.startsWith('/api/')&&req.method==='POST') {
        if(req.headers['x-fmj-token']!==token)fail('本地会话验证失败，请刷新页面。',403);
        if(!req.headers['content-type']?.startsWith('application/json'))fail('仅支持 JSON。',415);
        let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>256000)fail('请求过大。',413);}let input;try{input=JSON.parse(body);}catch{fail('请求 JSON 无效。');}if(!input||typeof input!=='object'||Array.isArray(input))fail('请求格式无效。');
        if(p==='/api/profiles/create') {
          const source=input.copyFrom?store.profile(string(input.copyFrom,80,true)):blankProfile();
          const profile=store.createProfile({...source,label:string(input.label,100,true),...searchLocation(input,source),resumeLanguage:enumeration(input.resumeLanguage??source.resumeLanguage,['zh','en'])});
          return json(res,201,{...snapshot(),createdProfileId:profile.id});
        }else if(p==='/api/profiles/archive') {
          if(typeof input.archived!=='boolean')fail('归档选项无效。');
          store.archiveProfile(string(input.id,80,true),input.archived,input.revision);
        }else if(p==='/api/profile'||p==='/api/profiles/save') {
          const profile=blankProfile();for(const k of Object.keys(profile))if(k!=='skills')profile[k]=string(input[k],['education','experience','projects','preferences'].includes(k)?12000:200,['name','education'].includes(k));
          profile.label=string(input.label,100,true);Object.assign(profile,searchLocation(input));enumeration(profile.resumeLanguage,['zh','en']);
          enumeration(profile.track,['campus','experienced']);if(!Array.isArray(input.skills)||input.skills.length>50)fail('最多填写 50 项技能。');profile.skills=[...new Set(input.skills.map(s=>string(s,100,true)))];store.profile(input.id);store.editProfile(input.id,profile,input.revision);
        }else if(p==='/api/settings') {
          const provider=enumeration(input.provider,['cursor',...providers.list().map(p=>p.id)]),language=enumeration(input.language,['zh','en']);
          const model=string(input.model,200,true);store.config('settings',{provider,language,model,freeOnly:input.freeOnly===true},input.revision);
        }else if(p==='/api/credentials') {if(input.remove)providers.clearKey(input.provider);else providers.setKey(input.provider,input.key);
        }else if(p==='/api/jobs/import') {store.addJob(manualJob(input));
        }else if(p==='/api/jobs/save') {if(!store.get('jobs',input.id))fail('岗位不存在。');if(input.saved===true)store.db.prepare('INSERT OR IGNORE INTO saved VALUES(?)').run(input.id);else store.db.prepare('DELETE FROM saved WHERE job_id=?').run(input.id);
        }else if(p==='/api/sources') {
          const provider=enumeration(input.provider,['greenhouse','lever']),slug=string(input.slug,80,true),company=string(input.company,100,true);if(!/^[a-zA-Z0-9_-]+$/.test(slug))fail('招聘板标识仅支持字母、数字、横线和下划线。');const id=`${provider}:${slug}`,existing=store.get('sources',id);if(!existing&&store.rows('sources').filter(s=>!s.featured).length>=50)fail('最多添加 50 个自定义岗位源。');store.put('sources',{status:'未同步',count:0,...existing,id,provider,slug,company});
        }else if(p==='/api/jobs/sync') {
          if(syncing)fail('岗位正在同步。',409);
          let sources=store.rows('sources');
          if(input.sourceId!==undefined){const source=store.get('sources',string(input.sourceId,160,true));if(!source)fail('岗位来源不存在。',404);sources=[source];}
          if(sources.some(s=>Date.now()-(lastSync.get(s.id)||0)<30000))fail('请等待 30 秒后再次同步同一来源。',429);
          syncing=true;
          try{for(let i=0;i<sources.length;i+=3)await Promise.all(sources.slice(i,i+3).map(async s=>{
            lastSync.set(s.id,Date.now());const attemptedAt=new Date().toISOString();store.put('sources',{...s,status:'同步中',attemptedAt});
            try{const result=await jobFetcher(s);store.upsertJobs({...s,attemptedAt},Array.isArray(result)?result:result.jobs,Array.isArray(result)?{}:result);}
            catch(error){store.put('sources',{...s,attemptedAt,status:error.code==='SOURCE_PENDING'?'待接通':'同步失败',error:s.provider==='official'?syncError(error):'网络或接口异常，已保留上次岗位。'});}
          }));}finally{syncing=false;}
        }else if(p==='/api/applications') {store.track(input.jobId,input.profileId);
        }else if(p==='/api/applications/status') {
          const a=store.get('applications',input.id);if(!a)fail('投递记录不存在。');const status=enumeration(input.status,['准备中','已投递','面试中','已结束']);
          if(['已投递','面试中'].includes(status)&&!store.rows('resumes').some(r=>r.jobId===a.jobId&&r.profileId===a.profileId&&r.status==='reviewed'))fail('请先完成该岗位、该画像的简历审核。');
          const r=store.db.prepare('UPDATE applications SET data=?,revision=revision+1 WHERE id=? AND revision=?').run(JSON.stringify({...a,status,updatedAt:new Date().toISOString()}),input.id,input.revision);if(!r.changes)fail('投递记录已更新，请刷新重试。',409);
        }else if(p==='/api/resumes/save') {if(input.layout!==undefined&&!isResumeLayout(input.layout))fail('简历布局无效。');store.editResume(input.id,{content:string(input.content,40000,true),review:input.review===true,revision:input.revision,layout:input.layout});
        }else if(p==='/api/resumes/delete') {store.db.prepare('DELETE FROM resumes WHERE id=?').run(input.id);
        }else if(p==='/api/generate') {
          const provider=enumeration(input.provider,['cursor','platform',...providers.list().map(p=>p.id)]);
          if(provider==='platform')fail('平台积分服务尚未开放；购买、账户和服务端余额验证接通后才能使用。',403);
          if(provider==='cursor'&&!cursorEnabled)fail('此实例没有启用本机 Cursor。',403);
          if(input.consent!==true)fail('请确认将档案和岗位要求发送给所选服务，并使用该账户额度。');
          const profileId=string(input.profileId,80,true);
          const id=string(input.requestId,80,true);if(!/^[a-zA-Z0-9-]+$/.test(id))fail('任务标识无效。');const existing=store.get('tasks',id);if(existing){if(existing.profileId!==profileId||existing.jobId!==input.jobId)fail('此任务标识已用于其他画像或岗位，请重新生成。',409);return json(res,200,existing);}
          if(busy)fail('已有生成任务运行中，请等待完成。',409);
          const job=store.get('jobs',input.jobId),profile=store.profile(profileId),language=enumeration(input.language??profile.resumeLanguage,['zh','en']),model=string(input.model,200,true);if(!job)fail('岗位不存在。');
          if(input.profileRevision!==profile.revision)fail('画像已更新，请重新打开岗位详情，确认画像后再生成。',409);buildPrompt(profile,job,language);
          if(provider!=='cursor'&&!providers.keys.has(provider))fail('请在 AI 设置中输入你自己的 API Key。');
          busy=true;const task={id,status:'running',jobId:job.id,profileId,profileLabel:profile.label,profileRevision:profile.revision,language,sourceProfile:profile,provider,model,createdAt:new Date().toISOString()};store.put('tasks',task);
          Promise.resolve().then(()=>provider==='cursor'?generator({profile,job,language},{model}):providers.generate({profile,job,language,provider,model,freeOnly:input.freeOnly===true})).then(result=>{
            const resume={...result,id:randomUUID(),jobId:job.id,profileId,profileLabel:profile.label,profileRevision:profile.revision,title:`${job.company} · ${job.title}`,language,layout:DEFAULT_RESUME_LAYOUT,status:'draft',reviewedAt:null,createdAt:new Date().toISOString(),sourceProfile:profile,sourceJob:job};
            store.transaction(()=>{store.db.prepare('INSERT INTO resumes(id,job_id,data) VALUES(?,?,?)').run(resume.id,job.id,JSON.stringify(resume));store.db.prepare('INSERT INTO resume_versions(resume_id,data) VALUES(?,?)').run(resume.id,JSON.stringify(resume));store.put('tasks',{...task,status:'completed',resumeId:resume.id,finishedAt:new Date().toISOString()});});
          }).catch(error=>store.put('tasks',{...task,status:'failed',error:error.message,finishedAt:new Date().toISOString()})).finally(()=>{busy=false;});
          return json(res,202,task);
        }else fail('接口不存在。',404);
        return json(res,200,snapshot());
      }
      if(p.startsWith('/api/'))fail('接口不存在。',404);
      if(!['GET','HEAD'].includes(req.method))fail('Method not allowed',405);
      const file=files[p];if(!file)fail('Not found',404);
      const content=await readFile(path.join(root,file));res.writeHead(200,{'Content-Type':types[path.extname(file)],'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cache-Control':'no-cache','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"});res.end(req.method==='HEAD'?undefined:content);
    }catch(error){if(!res.headersSent)json(res,error.status||400,{error:error.message?.includes('SQLITE')?'数据库操作未完成，请重试。':error.message||'服务暂时不可用。'});else res.end();}
  });
  // Recover only after binding succeeds; a second launch on an occupied port must not interrupt tasks.
  server.on('listening',()=>store.recoverTasks());
  server.on('close',()=>{if(!busy)store.close();else {const t=setInterval(()=>{if(!busy){clearInterval(t);store.close();}},100);t.unref();}});
  return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const port=Number(process.env.PORT||4173),server=createServer();
  server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`端口 ${port} 已被占用。`:'无法启动本地服务。');process.exitCode=1;});
  server.listen(port,'127.0.0.1',()=>console.log(`FoundMyJob: http://127.0.0.1:${port}\nSQLite 已连接；仅接受本机连接。`));
}
