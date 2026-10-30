import {parentPort,workerData} from 'node:worker_threads';
import {fileURLToPath} from 'node:url';
import {MAX_IMPORT_TEXT,importError} from './document-import.mjs';
import {openWordPackage,wordXmlText,wordImages,LocalOcr,decodedImage,imagePreview,ocrImageBuffer} from './document-images.mjs';
import {createCanvas} from '@napi-rs/canvas';

const {format}=workerData,buffer=Buffer.from(workerData.buffer);
const ole=Buffer.from('d0cf11e0a1b11ae1','hex');
const isPdf=buffer.subarray(0,1024).includes(Buffer.from('%PDF-'));
const isZip=buffer.subarray(0,4).equals(Buffer.from('504b0304','hex'));
const isOle=buffer.subarray(0,8).equals(ole);
const ocr=new LocalOcr();
function plainText(){
  if(isPdf||isZip||isOle)throw importError('文件内容与扩展名不符，请使用原始 Word 或 PDF 文件。');
  let text;
  if(buffer[0]===0xff&&buffer[1]===0xfe)text=new TextDecoder('utf-16le',{fatal:true}).decode(buffer);
  else if(buffer[0]===0xfe&&buffer[1]===0xff)text=new TextDecoder('utf-16be',{fatal:true}).decode(buffer);
  else {
    try{text=new TextDecoder('utf-8',{fatal:true}).decode(buffer);}
    catch{try{text=new TextDecoder('gb18030',{fatal:true}).decode(buffer);}catch{throw importError('无法识别文本编码，请另存为 UTF-8 文本后重试。');}}
  }
  if(/[\x00-\x08\x0b\x0e-\x1f]/.test(text))throw importError('文件不是可读取的纯文本，请使用原始 Word 或 PDF 文件。');
  return text;
}
async function wordText(){
  if((format==='docx'&&!isZip)||(format==='doc'&&!isOle))throw importError('文件内容与扩展名不符，请在 Word 中另存为 .docx 后重试。');
  if(format==='docx'){
    const entries=await openWordPackage(buffer);
    if(!entries.has('word/document.xml'))throw importError('无法读取 Word 正文。');
    const names=[...entries.keys()].filter(name=>/\.xml$/.test(name));
    names.sort((a,b)=>(a.includes('header')?0:a==='word/document.xml'?1:2)-(b.includes('header')?0:b==='word/document.xml'?1:2));
    const text=names.map(name=>wordXmlText(entries.get(name))).filter(Boolean).join('\n\n');
    const media=await wordImages(entries,ocr);
    return {text:text+media.text,images:media.images,warnings:media.warnings,ocrUsed:media.images.some(image=>image.text)};
  }
  const {default:WordExtractor}=await import('word-extractor');
  const doc=await new WordExtractor().extract(buffer);
  return {text:[doc.getHeaders({includeFooters:false}),doc.getBody(),doc.getTextboxes(),doc.getFootnotes(),doc.getEndnotes(),doc.getFooters()].filter(Boolean).join('\n\n')};
}
async function pdfText(){
  if(!isPdf)throw importError('这不是有效的 PDF 文件，请重新导出后重试。');
  const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
  // Read bundled CMaps/fonts locally, including Chinese PDFs; never fetch document URLs.
  const localAssets=new URL('./',import.meta.resolve('pdfjs-dist/package.json'));
  const loading=getDocument({data:new Uint8Array(buffer),isEvalSupported:false,useWorkerFetch:false,
    cMapUrl:fileURLToPath(new URL('cmaps/',localAssets)).replace(/\\/g,'/'),cMapPacked:true,
    standardFontDataUrl:fileURLToPath(new URL('standard_fonts/',localAssets)).replace(/\\/g,'/'),verbosity:0});
  try {
    const pdf=await loading.promise;
    if(pdf.numPages>100)throw importError('PDF 超过 100 页，请仅导入与经历有关的页面。');
    const pages=[],emptyPages=[],ocrPages=[],warnings=[];let length=0;
    for(let i=1;i<=pdf.numPages;i++){
      const page=await pdf.getPage(i),content=await page.getTextContent();
      let text='',previous;
      for(const item of content.items){
        if(typeof item.str!=='string')continue;
        if(previous&&!text.endsWith('\n')){
          const height=Math.max(Math.abs(item.height||0),Math.abs(previous.height||0),1);
          if(Math.abs(item.transform[5]-previous.transform[5])>height*.5)text+='\n';
          else if(item.transform[4]-(previous.transform[4]+previous.width)>height*.15&&!/\s$/.test(text)&&!/^\s/.test(item.str))text+=' ';
        }
        text+=item.str;if(item.hasEOL)text+='\n';previous=item;
      }
      if(text.trim().length<30){
        if(ocrPages.length>=20)throw importError('一次最多 OCR 20 页，请拆分扫描 PDF 后重试。');
        const base=page.getViewport({scale:1}),scale=Math.min(2.5,Math.sqrt(12000000/(base.width*base.height)));
        const viewport=page.getViewport({scale}),canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));
        await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
        const result=await ocr.recognize(canvas.toBuffer('image/png'));ocrPages.push(i);
        if(result.text.length>text.trim().length)text=result.text;
        if(result.confidence<60&&result.text)warnings.push('第 '+i+' 页 OCR 清晰度较低，请核对人名、日期及数字。');
      }
      length+=text.length;if(length>MAX_IMPORT_TEXT)throw importError('提取文字超过 100,000 字符，请拆分文件后导入。');
      if(!text.trim())emptyPages.push(i);pages.push(text.trim());page.cleanup();
    }
    if(emptyPages.length===pdf.numPages)throw importError('OCR 未识别到文字，请上传更清晰的扫描件或原始 Word 文件。');
    return {text:pages.join('\n\n'),pages:pdf.numPages,emptyPages,ocrPages,ocrUsed:ocrPages.length>0,warnings};
  }finally{await loading.destroy();}
}
try{
  let result;
  if(format==='pdf')result=await pdfText();
  else if(format==='txt'||format==='md')result={text:plainText()};
  else if(format==='doc'||format==='docx')result=await wordText();
  else{
    const image=await decodedImage(buffer),recognized=await ocr.recognize(ocrImageBuffer(image));
    result={...recognized,ocrUsed:true,images:[{name:'原始图片',kind:'image',width:image.width,height:image.height,preview:imagePreview(image)}]};
  }
  result.text=result.text.replace(/\r\n?/g,'\n').replace(/\f/g,'\n\n').replace(/[\x00-\x08\x0b\x0e-\x1f]/g,'').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
  if(!result.text)throw importError('文件中没有可提取的文字，请检查内容或先进行 OCR 文字识别。');
  if(result.text.length>MAX_IMPORT_TEXT)throw importError('提取文字超过 100,000 字符，请拆分文件后导入。');
  if(result.text.includes('\ufffd'))result.warnings=[...(result.warnings||[]),'部分字符无法解码，已用 � 标记；请对照原文修正后使用。'];
  parentPort.postMessage({result:{...result,format}});
}catch(error){
  const message=error.name==='PasswordException'?'PDF 已加密，请先解锁或导出无密码的副本后重试。':error.status?error.message:'无法读取文件，文件可能已损坏或加密。请另存为新的 Word 或 PDF 文件后重试。';
  parentPort.postMessage({error:message});
}finally{await ocr.close();}
