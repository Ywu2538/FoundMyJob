import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export const blankProfile = () => ({name:'',email:'',phone:'',location:'',target:'',track:'campus',skills:[],education:'',experience:'',projects:'',preferences:''});
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
      CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY, data TEXT NOT NULL);
      PRAGMA user_version=1;`);
    for (const [key,data] of [['profile',blankProfile()],['settings',{language:'zh',provider:'cursor',model:'auto'}]]) this.db.prepare('INSERT OR IGNORE INTO config(key,data) VALUES(?,?)').run(key,JSON.stringify(data));
    for (const s of [{id:'greenhouse:figma',provider:'greenhouse',slug:'figma',company:'Figma'},{id:'greenhouse:imc',provider:'greenhouse',slug:'imc',company:'IMC'},{id:'greenhouse:towerresearchcapital',provider:'greenhouse',slug:'towerresearchcapital',company:'Tower Research Capital'}]) this.db.prepare('INSERT OR IGNORE INTO sources VALUES(?,?)').run(s.id,JSON.stringify({...s,status:'未同步',count:0}));
  }
  recoverTasks() {for (const task of this.rows('tasks')) if (task.status==='running') this.put('tasks',{...task,status:'failed',error:'本地服务已重启，请重新生成。'});}
  rows(table) {return this.db.prepare(`SELECT * FROM ${table}`).all().map(r=>({...JSON.parse(r.data),...(r.revision?{revision:r.revision}:{})}));}
  get(table,id) {const r=this.db.prepare(`SELECT * FROM ${table} WHERE ${table==='config'?'key':'id'}=?`).get(id);return r?{...JSON.parse(r.data),...(r.revision?{revision:r.revision}:{})}:null;}
  put(table,data) {this.db.prepare(`INSERT INTO ${table}(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data`).run(data.id,JSON.stringify(data));return data;}
  config(key,data,revision) {const r=this.db.prepare('UPDATE config SET data=?,revision=revision+1 WHERE key=? AND revision=?').run(JSON.stringify(data),key,revision);if(!r.changes)throw Object.assign(new Error('数据已在其他窗口更新，请刷新后重试。'),{status:409});}
  transaction(fn) {this.db.exec('BEGIN IMMEDIATE');try{const r=fn();this.db.exec('COMMIT');return r;}catch(e){this.db.exec('ROLLBACK');throw e;}}
  snapshot() {return {version:2,profile:this.get('config','profile'),settings:this.get('config','settings'),jobs:this.db.prepare('SELECT data,active FROM jobs').all().map(r=>({...JSON.parse(r.data),active:!!r.active})),saved:this.db.prepare('SELECT job_id FROM saved').all().map(r=>r.job_id),resumes:this.rows('resumes').reverse(),applications:this.rows('applications').reverse(),sources:this.rows('sources'),tasks:this.rows('tasks').reverse().slice(0,50)};}
  upsertJobs(source,jobs) {this.transaction(()=>{this.db.prepare('UPDATE jobs SET active=0 WHERE source_id=?').run(source.id);const q=this.db.prepare('INSERT INTO jobs(id,source_id,active,data) VALUES(?,?,1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,active=1');for(const j of jobs)q.run(j.id,source.id,JSON.stringify(j));this.put('sources',{...source,status:'已同步',count:jobs.length,syncedAt:new Date().toISOString(),error:null});});}
  addJob(job) {this.db.prepare('INSERT INTO jobs VALUES(?,?,1,?)').run(job.id,'manual',JSON.stringify(job));}
  createResume(resume) {this.transaction(()=>{this.db.prepare('INSERT INTO resumes(id,job_id,data) VALUES(?,?,?)').run(resume.id,resume.jobId,JSON.stringify(resume));this.db.prepare('INSERT INTO resume_versions(resume_id,data) VALUES(?,?)').run(resume.id,JSON.stringify(resume));});}
  editResume(id,{content,review,revision}) {const r=this.get('resumes',id);if(!r)throw new Error('简历不存在。');const next={...r,content,status:review?'reviewed':content===r.content?r.status:'draft',reviewedAt:review?new Date().toISOString():content===r.content?r.reviewedAt:null};this.transaction(()=>{const change=this.db.prepare('UPDATE resumes SET data=?,revision=revision+1 WHERE id=? AND revision=?').run(JSON.stringify(next),id,revision);if(!change.changes)throw Object.assign(new Error('简历已被更新，请重新打开再编辑。'),{status:409});if(content!==r.content)this.db.prepare('INSERT INTO resume_versions(resume_id,data) VALUES(?,?)').run(id,JSON.stringify(next));});}
  track(jobId) {if(!this.db.prepare('SELECT id FROM jobs WHERE id=?').get(jobId))throw new Error('岗位不存在。');const a={id:randomUUID(),jobId,status:'准备中',createdAt:new Date().toISOString()};this.db.prepare('INSERT OR IGNORE INTO applications(id,job_id,data) VALUES(?,?,?)').run(a.id,jobId,JSON.stringify(a));}
  close() {this.db.close();}
}
