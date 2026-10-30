import {t as tr} from './i18n.js';

export async function prepareAvatar(file,{width=256,height=256}={}){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error(tr('请选择 JPG、PNG 或 WebP 头像图片。','Choose a JPG, PNG or WebP avatar image.'));
  if(!file.size||file.size>5*1024*1024)throw new Error(tr('头像图片不能为空，且不能超过 5 MB。','Choose a non-empty avatar image no larger than 5 MB.'));
  const unreadable=()=>new Error(tr('图片无法读取，请换一张图片。','This image could not be read. Choose another image.'));
  // Data URLs are already permitted by the app's image policy; blob URLs are not.
  const source=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(unreadable());reader.onabort=()=>reject(unreadable());reader.readAsDataURL(file);});
  const image=new Image();
  await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(unreadable());image.src=source;});
  if(!image.naturalWidth||!image.naturalHeight||image.naturalWidth*image.naturalHeight>40000000)throw new Error(tr('图片尺寸过大，请缩小后再上传。','This image is too large. Resize it before uploading.'));
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d'),scale=Math.max(width/image.naturalWidth,height/image.naturalHeight),cropWidth=width/scale,cropHeight=height/scale;
  ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);
  ctx.drawImage(image,(image.naturalWidth-cropWidth)/2,(image.naturalHeight-cropHeight)/2,cropWidth,cropHeight,0,0,width,height);
  return canvas.toDataURL('image/jpeg',.85);
}
export const prepareResumePhoto=file=>prepareAvatar(file,{width:300,height:420});
