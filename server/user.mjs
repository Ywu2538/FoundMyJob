// Avatars are resized and re-encoded as JPEG by the browser before local storage.
export function validateAvatar(value){
  const fail=()=>{throw new Error('头像格式无效，请重新选择 JPG、PNG 或 WebP 图片。');};
  if(value==='')return '';
  if(typeof value!=='string'||value.length>180000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value))fail();
  const bytes=Buffer.from(value.slice(23),'base64');
  if(bytes.toString('base64')!==value.slice(23)||bytes.length<10||bytes.readUInt16BE(0)!==0xffd8||bytes.readUInt16BE(bytes.length-2)!==0xffd9)fail();
  let offset=2,dimensions=false;
  while(offset+4<=bytes.length){
    if(bytes[offset++]!==0xff)fail();
    while(bytes[offset]===0xff)offset++;
    const marker=bytes[offset++];
    if(marker===0xda)break;
    if(offset+2>bytes.length)fail();
    const size=bytes.readUInt16BE(offset);
    if(size<2||offset+size>bytes.length)fail();
    if([0xc0,0xc1,0xc2].includes(marker)){
      if(size<8)fail();
      const height=bytes.readUInt16BE(offset+3),width=bytes.readUInt16BE(offset+5);
      if(!width||!height||width>512||height>512)fail();
      dimensions=true;
    }
    offset+=size;
  }
  if(!dimensions)fail();
  return value;
}
