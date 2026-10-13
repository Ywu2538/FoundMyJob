import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { generateWithCursor, runProcess } from './cursor.mjs';

const root=fileURLToPath(new URL('../dist/',import.meta.url));
const files={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/core.js':'core.js','/data.js':'data.js','/styles.css':'styles.css','/favicon.svg':'favicon.svg'};
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
export function createServer({cursorEnabled=false,cursorCommand=process.env.CURSOR_CLI_PATH||'agent',generator=generateWithCursor}={}) {
 const token=randomBytes(32).toString('hex');let busy=false;
 const json=(response,status,data)=>{response.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});response.end(JSON.stringify(data));};
 return http.createServer(async(request,response)=>{
  try{
   const port=response.socket.localPort;
   const hosts=new Set([`127.0.0.1:${port}`,`localhost:${port}`]);
   if(!hosts.has(request.headers.host))return json(response,403,{error:'只允许本地访问。'});
   if(request.headers.origin&&!new Set([...hosts].map(h=>`http://${h}`)).has(request.headers.origin))return json(response,403,{error:'不接受跨站请求。'});
   const pathname=new URL(request.url,'http://localhost').pathname;
   if(pathname==='/api/cursor/status'&&request.method==='GET') {
    if(!cursorEnabled)return json(response,200,{enabled:false,message:'当前为演示模式，未调用 Cursor。可选本地桥接代码已保留，但未安装或启用 CLI。'});
    try{await runProcess(cursorCommand,['status'],{timeout:6000});return json(response,200,{enabled:true,token,message:'CLI 状态命令可运行；请在终端确认已登录。Demo 页面仍使用规则整理，不消耗额度。'});}
    catch{return json(response,200,{enabled:false,message:'未找到可用的 Cursor CLI，请安装并运行 agent login。'});}
   }
   if(pathname==='/api/cursor/generate'&&request.method==='POST') {
    if(!cursorEnabled)return json(response,403,{error:'演示模式禁止真实模型调用。'});
    if(request.headers['x-fmj-token']!==token)return json(response,403,{error:'本地会话验证失败。'});
    if(!request.headers['content-type']?.startsWith('application/json'))return json(response,415,{error:'仅支持 JSON。'});
    if(busy)return json(response,429,{error:'已有生成任务运行中。'});
    busy=true;
    try{let body='';for await(const chunk of request){body+=chunk;if(Buffer.byteLength(body)>65536){json(response,413,{error:'请求过大。'});return;}}let input;try{input=JSON.parse(body);}catch{return json(response,400,{error:'请求 JSON 无效。'});}if(input.consent!==true)return json(response,400,{error:'请明确同意发送档案到 Cursor 并消耗账号额度。'});const result=await generator(input,{command:cursorCommand});return json(response,200,result);}
    catch(error){return json(response,400,{error:error.message});}finally{busy=false;}
   }
   if(request.method!=='GET'&&request.method!=='HEAD')return json(response,405,{error:'Method not allowed'});
   const file=files[pathname];if(!file)return json(response,404,{error:'Not found'});
   const content=await readFile(path.join(root,file));response.writeHead(200,{'Content-Type':types[path.extname(file)],'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Cache-Control':'no-cache','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'"});response.end(request.method==='HEAD'?undefined:content);
  }catch{if(!response.headersSent)json(response,500,{error:'服务暂时不可用。'});else response.end();}
 });
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const port=Number(process.env.PORT||4173);
 const server=createServer({cursorEnabled:process.env.ENABLE_CURSOR==='true'});
 server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`端口 ${port} 已被占用，请设置其他 PORT。`:'无法启动本地服务。');process.exitCode=1;});
 server.listen(port,'127.0.0.1',()=>console.log(`FoundMyJob demo: http://127.0.0.1:${port}\nDemo mode: no payments or AI calls from the browser.`));
}
