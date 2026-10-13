import {mkdirSync,createWriteStream,writeFileSync,readFileSync,unlinkSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const projectRoot=fileURLToPath(new URL('../',import.meta.url));
process.chdir(projectRoot);
mkdirSync('.runtime',{recursive:true});
const log=createWriteStream('.runtime/background-server.log',{flags:'a'});
process.stdout.write=log.write.bind(log);
process.stderr.write=log.write.bind(log);
const {createServer}=await import('../server/index.mjs');
const server=createServer();
const pidFile=path.join(projectRoot,'.runtime','background-server.pid');
server.on('error',error=>{
  console.error(`${new Date().toISOString()} Server failed: ${error.code||'UNKNOWN'}`);
  log.end(()=>process.exit(1));
});
server.listen(4173,'127.0.0.1',()=>{
  writeFileSync(pidFile,String(process.pid));
  console.log(`${new Date().toISOString()} FoundMyJob ready at http://127.0.0.1:4173 (PID ${process.pid})`);
});
process.on('exit',()=>{
  try {if(readFileSync(pidFile,'utf8').trim()===String(process.pid))unlinkSync(pidFile);}catch{}
});
