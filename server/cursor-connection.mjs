import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {cursorExecutable,runProcess} from './cursor.mjs';

export function cursorLoginUrl(text){
 for(const value of text.replace(/\x1b\[[0-9;]*m/g,'').match(/https:\/\/[^\s<>"']+/g)||[]){
  try{const url=new URL(value);if(url.protocol==='https:'&&!url.username&&!url.password&&(url.hostname==='cursor.com'||url.hostname.endsWith('.cursor.com')))return url.href;}catch{}
 }return null;
}

export class CursorConnection {
 constructor({runner=runProcess,resolveCli=cursorExecutable,spawnChild=spawn,platform=process.platform}={}){this.runner=runner;this.resolveCli=resolveCli;this.spawnChild=spawnChild;this.platform=platform;this.key='';this.login=null;this.installing=false;}
 environment(){const env={...process.env};if(this.key)env.CURSOR_API_KEY=this.key;return env;}
 setKey(key){if(typeof key!=='string'||key.length<8||key.length>2048||/[\s\x00-\x1f]/.test(key))throw new Error('API Key 格式无效。');this.key=key;}
 clearKey(){this.key='';}
 async status(){
  const flow=this.login?{phase:this.login.phase,loginUrl:this.login.url||null}:{};
  if(this.installing)return {installed:false,authenticated:false,phase:'installing',keyConfigured:!!this.key,message:'正在从 Cursor 官网安装连接工具…'};
  try{const cli=this.resolveCli();const {stdout}=await this.runner(cli.command,[...cli.args,'status','--format','json'],{timeout:10000,maxBytes:64000,env:this.environment()});
   const result=JSON.parse(stdout),authenticated=result.isAuthenticated===true;
   if(authenticated&&this.login){this.login.child?.kill();this.login=null;}
   return {installed:true,authenticated,keyConfigured:!!this.key,...(authenticated?{}:flow),message:authenticated?'Cursor 已连接，可以使用自己的账户生成简历。':flow.phase==='failed'?'Cursor 登录未完成，请重新连接。':'Cursor 已安装，请点击网页登录或填写自己的 Cursor API Key。'};
  }catch(error){
   let installed=false;
   if(error.code!=='CURSOR_CLI_PERMISSION')try{const cli=this.resolveCli();await this.runner(cli.command,[...cli.args,'--version'],{timeout:5000,maxBytes:16000});installed=true;}catch{}
   return {installed,authenticated:false,keyConfigured:!!this.key,...flow,message:error.code==='CURSOR_CLI_PERMISSION'?error.message:installed?'Cursor 已安装，但登录检查未通过。请重新网页登录或检查自己的 API Key。':'未检测到可用 Cursor CLI。可点击「安装连接工具」自动安装。'};
  }
 }
 async install(){
  if(this.installing)throw new Error('Cursor 连接工具正在安装，请稍候。');
  if((await this.status()).installed)return;
  if(this.platform!=='win32')throw new Error('此自动安装器支持 Windows；macOS / Linux 请通过 Cursor 官方安装器安装后点击检测连接。');
  this.installing=true;
  try{await this.runner('powershell.exe',['-NoProfile','-NonInteractive','-File',fileURLToPath(new URL('../scripts/install-cursor.ps1',import.meta.url))],{timeout:180000,maxBytes:64000});}
  finally{this.installing=false;}
  if(!(await this.status()).installed)throw new Error('安装未完成，请检查网络后重试。');
 }
 startLogin(){
  if(this.login?.phase==='waiting')return {phase:'waiting',loginUrl:this.login.url};
  const cli=this.resolveCli();if(/\.(cmd|bat|ps1)$/i.test(cli.command))throw new Error('请使用自动安装的 Cursor 连接工具。');
  const session={phase:'waiting',url:null,child:null};this.login=session;
  const child=this.spawnChild(cli.command,[...cli.args,'login'],{shell:false,windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...this.environment(),NO_OPEN_BROWSER:'1'}});session.child=child;
  let output='';const capture=chunk=>{output=(output+String(chunk)).slice(-16000);const url=cursorLoginUrl(output);if(url)session.url=url;};
  child.stdout.on('data',capture);child.stderr.on('data',capture);
  const timer=setTimeout(()=>{session.phase='expired';session.url=null;child.kill();},180000);timer.unref?.();
  child.on('error',()=>{session.phase='failed';session.url=null;clearTimeout(timer);});
  child.on('close',code=>{session.phase=code===0?'complete':'failed';session.url=null;clearTimeout(timer);});
  return {phase:session.phase,loginUrl:session.url};
 }
 close(){this.login?.child?.kill();this.login=null;this.key='';}
}
