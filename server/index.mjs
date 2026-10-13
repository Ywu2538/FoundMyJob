import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { generateWithCursor, runProcess, cursorExecutable, buildPrompt } from './cursor.mjs';
import { Store, blankProfile } from './db.mjs';
import { fetchJobs, manualJob } from './jobs.mjs';
import { Providers } from './providers.mjs';

const root=fileURLToPath(new URL('../dist/',import.meta.url));
const files={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/core.js':'core.js','/styles.css':'styles.css','/favicon.svg':'favicon.svg'};
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const string=(v,max,required=false)=>{if(typeof v!=='string'||v.length>max||(required&&!v.trim()))fail('输入字段为空或超过长度限制。');return v.trim();};
const enumeration=(v,values)=>values.includes(v)?v:fail('选项无效。');
export function createServer({store=new Store(),cursorEnabled=process.env.FMJ_ALLOW_CURSOR==='1',generator=generateWithCursor,providers=new Providers(),jobFetcher=fetchJobs}={}) {
  if(process.env.FMJ_DEPLOYMENT&&process.env.FMJ_DEPLOYMENT!=='local')throw new Error('当前版本仅支持单用户本机运行；云部署需要独立账户、额度和密钥隔离服务。');
  const token=randomBytes(32).toString('hex');let busy=false,syncing=false,lastSync=0;
  const snapshot=()=>({...store.snapshot(),token,providers:providers.list(),capabilities:{cursor:cursorEnabled,platformCredits:false}});
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
        if(p==='/api/profile') {
          const profile=blankProfile();for(const k of Object.keys(profile))if(k!=='skills')profile[k]=string(input[k],['education','experience','projects','preferences'].includes(k)?12000:200,['name','education'].includes(k));
          enumeration(profile.track,['campus','experienced']);if(!Array.isArray(input.skills)||input.skills.length>50)fail('最多填写 50 项技能。');profile.skills=[...new Set(input.skills.map(s=>string(s,100,true)))];store.config('profile',profile,input.revision);
        }else if(p==='/api/settings') {
          const provider=enumeration(input.provider,['cursor',...providers.list().map(p=>p.id)]),language=enumeration(input.language,['zh','en']);
          const model=string(input.model,200,true);store.config('settings',{provider,language,model,freeOnly:input.freeOnly===true},input.revision);
        }else if(p==='/api/credentials') {if(input.remove)providers.clearKey(input.provider);else providers.setKey(input.provider,input.key);
        }else if(p==='/api/jobs/import') {store.addJob(manualJob(input));
        }else if(p==='/api/jobs/save') {if(!store.get('jobs',input.id))fail('岗位不存在。');if(input.saved===true)store.db.prepare('INSERT OR IGNORE INTO saved VALUES(?)').run(input.id);else store.db.prepare('DELETE FROM saved WHERE job_id=?').run(input.id);
        }else if(p==='/api/sources') {
          const provider=enumeration(input.provider,['greenhouse','lever']),slug=string(input.slug,80,true),company=string(input.company,100,true);if(!/^[a-zA-Z0-9_-]+$/.test(slug))fail('招聘板标识仅支持字母、数字、横线和下划线。');if(store.rows('sources').length>=20)fail('最多添加 20 个岗位源。');store.put('sources',{id:`${provider}:${slug}`,provider,slug,company,status:'未同步',count:0});
        }else if(p==='/api/jobs/sync') {
          if(syncing)fail('岗位正在同步。',409);if(Date.now()-lastSync<30000)fail('请等待 30 秒后再次同步。',429);syncing=true;lastSync=Date.now();
          try{const sources=store.rows('sources');for(let i=0;i<sources.length;i+=3)await Promise.all(sources.slice(i,i+3).map(async s=>{try{const jobs=await jobFetcher(s);store.upsertJobs(s,jobs);}catch{store.put('sources',{...s,status:'同步失败',error:'网络或接口异常，已保留上次岗位。'});}}));}finally{syncing=false;}
        }else if(p==='/api/applications') {store.track(input.jobId);
        }else if(p==='/api/applications/status') {
          const a=store.get('applications',input.id);if(!a)fail('投递记录不存在。');const status=enumeration(input.status,['准备中','已投递','面试中','已结束']);
          if(['已投递','面试中'].includes(status)&&!store.rows('resumes').some(r=>r.jobId===a.jobId&&r.status==='reviewed'))fail('请先完成该岗位简历审核。');
          const r=store.db.prepare('UPDATE applications SET data=?,revision=revision+1 WHERE id=? AND revision=?').run(JSON.stringify({...a,status,updatedAt:new Date().toISOString()}),input.id,input.revision);if(!r.changes)fail('投递记录已更新，请刷新重试。',409);
        }else if(p==='/api/resumes/save') {store.editResume(input.id,{content:string(input.content,40000,true),review:input.review===true,revision:input.revision});
        }else if(p==='/api/resumes/delete') {store.db.prepare('DELETE FROM resumes WHERE id=?').run(input.id);
        }else if(p==='/api/generate') {
          const provider=enumeration(input.provider,['cursor','platform',...providers.list().map(p=>p.id)]);
          if(provider==='platform')fail('平台积分服务尚未开放；购买、账户和服务端余额验证接通后才能使用。',403);
          if(provider==='cursor'&&!cursorEnabled)fail('此实例没有启用本机 Cursor。',403);
          if(input.consent!==true)fail('请确认将档案和岗位要求发送给所选服务，并使用该账户额度。');
          const id=string(input.requestId,80,true);if(!/^[a-zA-Z0-9-]+$/.test(id))fail('任务标识无效。');const existing=store.get('tasks',id);if(existing)return json(res,200,existing);
          if(busy)fail('已有生成任务运行中，请等待完成。',409);
          const job=store.get('jobs',input.jobId),profile=store.get('config','profile'),language=enumeration(input.language,['zh','en']),model=string(input.model,200,true);if(!job)fail('岗位不存在。');buildPrompt(profile,job,language);
          if(provider!=='cursor'&&!providers.keys.has(provider))fail('请在 AI 设置中输入你自己的 API Key。');
          busy=true;const task={id,status:'running',jobId:job.id,provider,model,createdAt:new Date().toISOString()};store.put('tasks',task);
          Promise.resolve().then(()=>provider==='cursor'?generator({profile,job,language},{model}):providers.generate({profile,job,language,provider,model,freeOnly:input.freeOnly===true})).then(result=>{
            const resume={...result,id:randomUUID(),jobId:job.id,title:`${job.company} · ${job.title}`,language,status:'draft',reviewedAt:null,createdAt:new Date().toISOString(),sourceProfile:profile,sourceJob:job};
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
