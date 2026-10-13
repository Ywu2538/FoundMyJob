import { spawn } from 'node:child_process';
import { createServer } from '../server/index.mjs';

const url='http://127.0.0.1:4173';
function openBrowser() {
  const command=process.platform==='win32'?'explorer.exe':process.platform==='darwin'?'open':'xdg-open';
  const child=spawn(command,[url],{stdio:'ignore',detached:true,windowsHide:true,shell:false});
  child.on('error',()=>console.log(`请在浏览器打开 ${url}`));
  child.unref();
}

let running=false;
try {
  const response=await fetch(`${url}/api/health`,{signal:AbortSignal.timeout(1200)});
  const health=await response.json();
  running=response.ok&&health.app==='foundmyjob';
}catch{}

if(running) {
  console.log(`FoundMyJob 已在运行：${url}`);
  openBrowser();
}else {
  const server=createServer();
  server.on('error',error=>{
    console.error(error.code==='EADDRINUSE'?'端口 4173 被其他程序占用。请关闭占用该端口的程序，或在项目目录设置 PORT 后运行 npm start。':'本地服务启动失败，请使用 Node.js 24 LTS。');
    process.exitCode=1;
  });
  server.listen(4173,'127.0.0.1',()=>{
    console.log(`FoundMyJob 已启动：${url}\nSQLite 已连接。生成简历请先配置本机 Cursor 或自己的 API Key。\n请保留此窗口；关闭窗口或按 Ctrl+C 会停止服务。`);
    openBrowser();
  });
}
