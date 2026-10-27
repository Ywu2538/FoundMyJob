import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { profileSearchScope } from '../dist/core.js';
import {normalizeResumeLayout} from '../dist/resume-layouts.js';
import { COMPANY_SOURCES } from './company-sources.mjs';

export const blankProfile = () => ({label:'我的求职画像',market:'',resumeLanguage:'zh',name:'',email:'',phone:'',location:'',target:'',track:'campus',skills:[],education:'',experience:'',projects:'',preferences:''});
export class Store {
  constructor(filename = path.resolve('.runtime/foundmyjob.sqlite')) {
    if (filename !== ':memory:') mkdirSync(path.dirname(filename), {recursive:true});
    this.db = new DatabaseSync(filename);
    this.db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS config(key TEXT PRIMARY KEY, data TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE IF NOT EXISTS sources(id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, source_id TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS saved(job_id TEXT PRIMARY KEY REFERENCES jobs(id));
      CREATE TABLE IF NOT EXISTS resumes(id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES jobs(id), data TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE IF NOT EXISTS resume_versions(id INTEGER PRIMARY KEY, resume_id TEXT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS applications(id TEXT PRIMARY KEY, job_id TEXT NOT NULL UNIQUE REFERENCES jobs(id), data TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY, data TEXT NOT NULL);`);
    this.db.prepare('INSERT OR IGNORE INTO config(key,data) VALUES(?,?)').run('settings',JSON.stringify({language:'zh',provider:'cursor',model:'auto'}));
    if (this.db.prepare('PRAGMA user_version').get().user_version < 2) this.migrateProfiles();
    for (const s of [{id:'greenhouse:figma',provider:'greenhouse',slug:'figma',company:'Figma'},{id:'greenhouse:imc',provider:'greenhouse',slug:'imc',company:'IMC'},{id:'greenhouse:towerresearchcapital',provider:'greenhouse',slug:'towerresearchcapital',company:'Tower Research Capital'}]) this.db.prepare('INSERT OR IGNORE INTO sources VALUES(?,?)').run(s.id,JSON.stringify({...s,status:'未同步',count:0}));
    for(const source of COMPANY_SOURCES){
      const previous=this.get('sources',source.id);
      const updated=previous&&previous.adapter!==source.adapter?{status:'未同步',error:null,syncNote:''}:{};
      this.put('sources',{status:source.adapter==='pending'?'待接通':'未同步',count:0,...previous,...source,...updated});
    }
    for(const source of this.rows('sources'))if(source.status==='同步中')this.put('sources',{...source,status:'同步中断',error:'上次同步随服务中断，已保留岗位；可重新同步。'});
  }
  migrateProfiles() {
    this.transaction(()=>{
      this.db.exec('CREATE TABLE profiles(id TEXT PRIMARY KEY, data TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1)');
      const legacy=this.get('config','profile');
      const profile=this.createProfile({...blankProfile(),...legacy,label:'我的求职画像',resumeLanguage:this.get('config','settings').language||'zh'});
      // Preserve historical sourceProfile facts. Only attach their stable identity.
      for(const table of ['resumes','tasks']) for(const item of this.rows(table)) {
        const sourceProfile=item.sourceProfile?{...item.sourceProfile,id:profile.id,label:profile.label}:undefined;
        this.db.prepare(`UPDATE ${table} SET data=? WHERE id=?`).run(JSON.stringify({...item,profileId:profile.id,profileLabel:profile.label,...(sourceProfile?{sourceProfile}:{})}),item.id);
      }
      for(const row of this.db.prepare('SELECT id,data FROM resume_versions').all()) {
        const item=JSON.parse(row.data);
        this.db.prepare('UPDATE resume_versions SET data=? WHERE id=?').run(JSON.stringify({...item,profileId:profile.id,profileLabel:profile.label,...(item.sourceProfile?{sourceProfile:{...item.sourceProfile,id:profile.id,label:profile.label}}:{})}),row.id);
      }
      this.db.exec('ALTER TABLE applications RENAME TO legacy_applications; CREATE TABLE applications(id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES jobs(id), profile_id TEXT NOT NULL REFERENCES profiles(id), data TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, UNIQUE(job_id,profile_id))');
      for(const item of this.rows('legacy_applications')) this.db.prepare('INSERT INTO applications(id,job_id,profile_id,data,revision) VALUES(?,?,?,?,?)').run(item.id,item.jobId,profile.id,JSON.stringify({...item,profileId:profile.id,profileLabel:profile.label}),item.revision);
      this.db.exec("DROP TABLE legacy_applications; DELETE FROM config WHERE key='profile'; PRAGMA user_version=2");
    });
  }
  profile(id,{allowArchived=false}={}) {
    const profile=typeof id==='string'?this.get('profiles',id):null;
    if(!profile||(!allowArchived&&profile.archived))throw Object.assign(new Error('求职画像不存在或已归档，请重新选择。'),{status:404});
    return {...profile,searchScope:profileSearchScope(profile)};
  }
  createProfile(fields) {
    const {revision,...content}=fields;
    const profile={...blankProfile(),...content,id:randomUUID(),archived:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
    this.db.prepare('INSERT INTO profiles(id,data) VALUES(?,?)').run(profile.id,JSON.stringify(profile));
    return this.profile(profile.id);
  }
  editProfile(id,fields,revision) {
    const current=this.profile(id,{allowArchived:true});
    const next={...current,...fields,id,updatedAt:new Date().toISOString()};
    const result=this.db.prepare('UPDATE profiles SET data=?,revision=revision+1 WHERE id=? AND revision=?').run(JSON.stringify(next),id,revision);
    if(!result.changes)throw Object.assign(new Error('画像已在其他窗口更新，请刷新后重试。'),{status:409});
  }
  archiveProfile(id,archived,revision) {
    this.transaction(()=>{
      this.profile(id,{allowArchived:true});
      if(archived&&this.rows('profiles').filter(p=>!p.archived&&p.id!==id).length===0)throw new Error('请至少保留一份可用画像。');
      if(archived&&this.rows('tasks').some(t=>t.profileId===id&&t.status==='running'))throw new Error('此画像有简历正在生成，请完成后再归档。');
      this.editProfile(id,{archived},revision);
    });
  }
  recoverTasks() {for (const task of this.rows('tasks')) if (task.status==='running') this.put('tasks',{...task,status:'failed',error:'本地服务已重启，请重新生成。'});}
  rows(table) {return this.db.prepare(`SELECT * FROM ${table}`).all().map(r=>({...JSON.parse(r.data),...(r.revision?{revision:r.revision}:{})}));}
  get(table,id) {const r=this.db.prepare(`SELECT * FROM ${table} WHERE ${table==='config'?'key':'id'}=?`).get(id);return r?{...JSON.parse(r.data),...(r.revision?{revision:r.revision}:{})}:null;}
  put(table,data) {this.db.prepare(`INSERT INTO ${table}(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data`).run(data.id,JSON.stringify(data));return data;}
  config(key,data,revision) {const r=this.db.prepare('UPDATE config SET data=?,revision=revision+1 WHERE key=? AND revision=?').run(JSON.stringify(data),key,revision);if(!r.changes)throw Object.assign(new Error('数据已在其他窗口更新，请刷新后重试。'),{status:409});}
  transaction(fn) {this.db.exec('BEGIN IMMEDIATE');try{const r=fn();this.db.exec('COMMIT');return r;}catch(e){this.db.exec('ROLLBACK');throw e;}}
  snapshot() {return {version:3,profiles:this.rows('profiles').map(p=>({...p,searchScope:profileSearchScope(p)})),settings:this.get('config','settings'),jobs:this.db.prepare('SELECT data,active FROM jobs').all().map(r=>({...JSON.parse(r.data),active:!!r.active})),saved:this.db.prepare('SELECT job_id FROM saved').all().map(r=>r.job_id),resumes:this.rows('resumes').reverse(),applications:this.rows('applications').reverse(),sources:this.rows('sources'),tasks:this.rows('tasks').reverse().slice(0,50)};}
  upsertJobs(source,jobs,{complete=true,total,note=''}={}) {
    if(!Array.isArray(jobs)||jobs.some(j=>!j.id||j.source!==source.id||!j.title||!j.url)||new Set(jobs.map(j=>j.id)).size!==jobs.length)throw new Error('岗位数据无效，已保留上次结果。');
    this.transaction(()=>{
      if(complete)this.db.prepare('UPDATE jobs SET active=0 WHERE source_id=?').run(source.id);
      const q=this.db.prepare('INSERT INTO jobs(id,source_id,active,data) VALUES(?,?,1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,active=1');
      for(const j of jobs)q.run(j.id,source.id,JSON.stringify(j));
      const active=this.db.prepare('SELECT count(*) AS n FROM jobs WHERE source_id=? AND active=1').get(source.id).n;
      this.put('sources',{...source,status:complete?'已同步':'部分同步',count:active,lastFetchedCount:jobs.length,total:total??null,complete,syncNote:note,syncedAt:new Date().toISOString(),error:null});
    });
  }
  addJob(job) {
    const existing=this.db.prepare("SELECT id FROM jobs WHERE json_extract(data,'$.url')=?").get(job.url);
    if(existing)return existing.id;
    this.db.prepare('INSERT INTO jobs VALUES(?,?,1,?)').run(job.id,'manual',JSON.stringify(job));
    return job.id;
  }
  createResume(resume) {this.transaction(()=>{this.db.prepare('INSERT INTO resumes(id,job_id,data) VALUES(?,?,?)').run(resume.id,resume.jobId,JSON.stringify(resume));this.db.prepare('INSERT INTO resume_versions(resume_id,data) VALUES(?,?)').run(resume.id,JSON.stringify(resume));});}
  editResume(id,{content,review,revision,layout}) {
    const r=this.get('resumes',id);if(!r)throw new Error('简历不存在。');
    const contentChanged=content!==r.content,nextLayout=normalizeResumeLayout(layout??r.layout);
    const next={...r,content,layout:nextLayout,status:review?'reviewed':contentChanged?'draft':r.status,reviewedAt:review?new Date().toISOString():contentChanged?null:r.reviewedAt,...(contentChanged?{notes:[],reviewTipsVersion:0}:{})};
    this.transaction(()=>{
      const change=this.db.prepare('UPDATE resumes SET data=?,revision=revision+1 WHERE id=? AND revision=?').run(JSON.stringify(next),id,revision);
      if(!change.changes)throw Object.assign(new Error('简历已被更新，请重新打开再编辑。'),{status:409});
      if(contentChanged||nextLayout!==normalizeResumeLayout(r.layout))this.db.prepare('INSERT INTO resume_versions(resume_id,data) VALUES(?,?)').run(id,JSON.stringify(next));
    });
  }
  track(jobId,profileId) {if(!this.db.prepare('SELECT id FROM jobs WHERE id=?').get(jobId))throw new Error('岗位不存在。');const profile=this.profile(profileId),a={id:randomUUID(),jobId,profileId,profileLabel:profile.label,status:'准备中',createdAt:new Date().toISOString()};this.db.prepare('INSERT OR IGNORE INTO applications(id,job_id,profile_id,data) VALUES(?,?,?,?)').run(a.id,jobId,profileId,JSON.stringify(a));}
  close() {this.db.close();}
}
