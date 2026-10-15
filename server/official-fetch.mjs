import {spawn} from 'node:child_process';
import path from 'node:path';

// Windows' certificate-verified TLS stack supports a few older official sites
// that Node/OpenSSL cannot negotiate with. Never weaken TLS validation.
const legacyHosts=new Set(['campus.duxiaoman.com','job.ccb.com','job2.ccb.com','job.10086.cn']);
export async function officialFetch(url,options={}) {
  try{return await fetch(url,options);}catch(error){
    const target=new URL(url);
    if(process.platform!=='win32'||target.protocol!=='https:'||!legacyHosts.has(target.hostname)||error.cause?.code!=='ERR_SSL_UNSAFE_LEGACY_RENEGOTIATION_DISABLED')throw error;
    return nativeRequest(target,options);
  }
}
function nativeRequest(url,options) {
  if(url.username||url.password)throw new Error('招聘源地址无效。');
  const method=options.method||'GET';
  if(!['GET','POST','HEAD'].includes(method))throw new Error('招聘源请求方式无效。');
  const args=['--silent','--show-error','--include','--proto','=https','--max-time','25','--max-filesize','8000000','--request',method];
  for(const [key,value] of new Headers(options.headers))args.push('--header',key+': '+value);
  if(options.body!=null)args.push('--data-binary','@-');
  args.push(url.href);
  return new Promise((resolve,reject)=>{
    const child=spawn(path.join(process.env.SystemRoot||'C:\\Windows','System32','curl.exe'),args,{windowsHide:true,stdio:['pipe','pipe','pipe'],signal:options.signal});
    let size=0,overflow=false;const chunks=[];
    child.stdout.on('data',chunk=>{size+=chunk.length;if(size>8500000){overflow=true;child.kill();}else chunks.push(chunk);});
    child.stderr.resume();child.on('error',reject);
    child.on('close',code=>{
      if(overflow||code!==0)return reject(new Error('官网安全连接失败，已保留上次岗位。'));
      try{
        let data=Buffer.concat(chunks),status,headers;
        do{
          const end=data.indexOf('\r\n\r\n');if(end<0)throw new Error('官网响应格式改变。');
          const lines=data.subarray(0,end).toString('utf8').split('\r\n');
          status=Number(lines.shift().match(/^HTTP\/\S+\s+(\d{3})/)?.[1]);headers=new Headers();
          for(const line of lines){const at=line.indexOf(':');if(at>0)headers.append(line.slice(0,at),line.slice(at+1).trim());}
          data=data.subarray(end+4);
        }while(status===100||data.subarray(0,5).toString()==='HTTP/');
        if(status>=300&&status<400&&options.redirect==='error')throw new Error('官网发生重定向，请更新招聘源。');
        // No automatic redirects: callers must explicitly validate destinations.
        resolve(new Response([204,205,304].includes(status)?null:data,{status,headers}));
      }catch(error){reject(error);}
    });
    child.stdin.on('error',()=>{});child.stdin.end(options.body==null?undefined:String(options.body));
  });
}
