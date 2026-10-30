import {Worker} from 'node:worker_threads';

export const MAX_IMPORT_BYTES=10*1024*1024;
export const MAX_IMPORT_TEXT=100000;
export const importError=(message,status=400)=>Object.assign(new Error(message),{status});
export function importFormat(filename){
  const extension=typeof filename==='string'&&filename.match(/\.([a-z0-9]+)$/i)?.[1].toLowerCase();
  if(!['txt','md','doc','docx','pdf','png','jpg','jpeg','webp','bmp'].includes(extension))throw importError('请选择 Word、PDF、TXT、Markdown 或 PNG / JPG / WebP / BMP 图片。',415);
  return extension;
}

let active=0;
export async function extractDocument(filename,buffer){
  const format=importFormat(filename);
  if(!buffer.length)throw importError('文件为空，请选择有内容的文件。');
  if(buffer.length>MAX_IMPORT_BYTES)throw importError('文件不能超过 10 MB。',413);
  if(active>=2)throw importError('正在解析其他文件，请稍后重试。',429);
  active++;
  try {
    return await new Promise((resolve,reject)=>{
      const worker=new Worker(new URL('./document-import-worker.mjs',import.meta.url),{
        workerData:{format,buffer},resourceLimits:{maxOldGenerationSizeMb:384},execArgv:[],
      });
      const timer=setTimeout(()=>finish(importError('文件解析或 OCR 超时，请拆分文件或另存为较小的文件后重试。')),180000);
      let done=false;
      function finish(error,result){
        if(done)return;done=true;clearTimeout(timer);
        worker.terminate().finally(()=>error?reject(error):resolve(result));
      }
      worker.once('message',message=>finish(message.error?importError(message.error):null,message.result));
      worker.once('error',()=>finish(importError('文件解析失败，请另存为新的 Word 或 PDF 文件后重试。')));
      worker.once('exit',()=>{if(!done)finish(importError('文件解析中断，请检查文件后重试。'));});
    });
  }finally{active--;}
}

export async function readImportBody(req){
  if(Number(req.headers['content-length'])>MAX_IMPORT_BYTES)throw importError('文件不能超过 10 MB。',413);
  const chunks=[];let size=0;
  for await(const chunk of req){
    size+=chunk.length;
    if(size>MAX_IMPORT_BYTES)throw importError('文件不能超过 10 MB。',413);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
