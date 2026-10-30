import {mkdir,copyFile,rename,rm} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {createRequire} from 'node:module';
import yauzl from 'yauzl';
import {SaxesParser} from 'saxes';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {importError} from './document-import.mjs';

const require=createRequire(import.meta.url);
export async function openWordPackage(buffer){
 return new Promise((resolve,reject)=>yauzl.fromBuffer(buffer,{lazyEntries:true},(error,zip)=>{
  if(error)return reject(error);
  const entries=new Map();let total=0,count=0,done=false;
  const fail=error=>{if(done)return;done=true;zip.close();reject(error);};
  zip.on('error',fail);zip.on('end',()=>{if(!done){done=true;resolve(entries);}});
  zip.on('entry',entry=>{
   total+=entry.uncompressedSize;
   if(++count>3000||total>60*1024*1024)return fail(importError('Word 解压内容过大，请精简后重试。'));
   if(!/^word\/(document\.xml|(?:header|footer)\d*\.xml|footnotes\.xml|endnotes\.xml|media\/[^/]+)$/.test(entry.fileName)){zip.readEntry();return;}
   if(entry.uncompressedSize>15*1024*1024)return fail(importError('Word 中单个附件过大。'));
   zip.openReadStream(entry,(error,stream)=>{
    if(error)return fail(error);const chunks=[];let size=0;
    stream.on('error',fail);stream.on('data',chunk=>{size+=chunk.length;if(size>15*1024*1024){stream.destroy();fail(importError('Word 中单个附件过大。'));}else chunks.push(chunk);});
    stream.on('end',()=>{if(done)return;entries.set(entry.fileName,Buffer.concat(chunks));zip.readEntry();});
   });
  });zip.readEntry();
 }));
}

export function wordXmlText(buffer){
 const parser=new SaxesParser(),stack=[];let text='',skip=0;
 parser.on('doctype',()=>{throw importError('Word XML 不支持外部实体。');});
 parser.on('opentag',tag=>{
  stack.push(tag.name);
  if(skip){skip++;return;}
  if(['mc:Fallback','w:del'].includes(tag.name)){skip=1;return;}
  if(tag.name==='w:tab')text+='\t';
  if(['w:br','w:cr'].includes(tag.name))text+='\n';
  if(tag.name==='w:sym')text+=' ◇ ';
 });
 parser.on('text',value=>{if(!skip&&stack.at(-1)==='w:t')text+=value;});
 parser.on('closetag',tag=>{
  if(skip)skip--;else if(tag.name==='w:p')text+='\n';
  else if(tag.name==='w:tc')text=text.replace(/\n+$/,'')+'\t';
  else if(tag.name==='w:tr')text=text.replace(/\t+$/,'')+'\n';
  stack.pop();
 });
 parser.write(buffer.toString('utf8')).close();return text.trim();
}

export async function decodedImage(buffer){
 if(!buffer.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'))&&!buffer.subarray(0,3).equals(Buffer.from('ffd8ff','hex'))&&!/^GIF8[79]a/.test(buffer.subarray(0,6).toString())&&buffer.subarray(0,2).toString()!=='BM'&&!(buffer.subarray(0,4).toString()==='RIFF'&&buffer.subarray(8,12).toString()==='WEBP'))throw importError('图片内容与格式不符，请重新导出 PNG 或 JPG。');
 // Bound common raster dimensions before native decoding.
 if(buffer.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'))&&buffer.length>=24&&buffer.readUInt32BE(16)*buffer.readUInt32BE(20)>40000000)throw importError('图片尺寸超过 4000 万像素，请缩小后重试。');
 const image=await loadImage(buffer);
 if(!image.width||!image.height||image.width*image.height>40000000)throw importError('图片尺寸过大或无法读取。');
 return image;
}
export function ocrImageBuffer(image){
 // Keep original glyph detail; unnecessary upscaling can reduce Chinese accuracy.
 const scale=Math.min(1,3200/Math.max(image.width,image.height)),canvas=createCanvas(Math.max(1,Math.round(image.width*scale)),Math.max(1,Math.round(image.height*scale)));
 const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);return canvas.toBuffer('image/png');
}
export function imagePreview(image){
 const scale=Math.min(1,240/Math.max(image.width,image.height)),canvas=createCanvas(Math.max(1,Math.round(image.width*scale)),Math.max(1,Math.round(image.height*scale)));
 const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
 return canvas.toDataURL('image/jpeg',.75);
}

export class LocalOcr {
 worker=null;
 async recognize(buffer){
  if(!this.worker){
   const {createWorker}=await import('tesseract.js');
   const langPath=path.resolve('.runtime/ocr-languages');await mkdir(langPath,{recursive:true});
   await Promise.all(['eng','chi_sim'].map(async code=>{
    const target=path.join(langPath,code+'.traineddata.gz'),temporary=target+'.'+randomUUID()+'.tmp';
    try{
     await copyFile(path.join(require('@tesseract.js-data/'+code).langPath,'../4.0.0_best_int',code+'.traineddata.gz'),temporary);
     // Concurrent imports must never read a partially copied language model.
     await rename(temporary,target);
    }finally{await rm(temporary,{force:true});}
   }));
   this.worker=await createWorker('eng+chi_sim',1,{langPath,cacheMethod:'none',errorHandler:()=>{}},{tessedit_load_sublangs:''});
   await this.worker.setParameters({tessedit_pageseg_mode:'3',preserve_interword_spaces:'1'});
  }
  const {data}=await this.worker.recognize(buffer);
  return {text:data.text.trim(),confidence:Math.round(data.confidence)};
 }
 async close(){if(this.worker)await this.worker.terminate();}
}

export async function wordImages(entries,ocr){
 const images=[],warnings=[];let text='';
 const media=[...entries].filter(([name])=>name.startsWith('word/media/'));
 for(const [name,bytes] of media.slice(0,20)){
  if(!/\.(png|jpe?g|webp|bmp|gif)$/i.test(name)){warnings.push('有矢量图形未转换；请在原文中核对。');continue;}
  try{
   const image=await decodedImage(bytes),small=image.width<80||image.height<60;
   const item={name:name.split('/').pop(),kind:small?'icon':'image',width:image.width,height:image.height,preview:imagePreview(image)};
   images.push(item);
   if(!small){const result=await ocr.recognize(ocrImageBuffer(image));if(result.text.length>=3&&result.confidence>=45){item.text=result.text;item.confidence=result.confidence;text+='\n\n[图片文字 '+item.name+']\n'+result.text;}}
  }catch{warnings.push('部分嵌入图片无法识别，已保留可读取的正文。');}
 }
 if(media.length>20)warnings.push('仅预览和识别前 20 张嵌入图片，请核对剩余图片。');
 return {images,text,warnings:[...new Set(warnings)]};
}
