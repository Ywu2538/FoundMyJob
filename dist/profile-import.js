import {t as tr} from './i18n.js';
import {escapeHtml as e} from './core.js';

export async function previewDocumentImport(file,{token,profileLabel,showModal,closeModal,readField,writeFields}){
  if(!/\.(docx?|pdf|txt|md|png|jpe?g|webp|bmp)$/i.test(file.name))throw new Error(tr('请选择 Word、PDF、TXT、Markdown 或 PNG / JPG / WebP / BMP 图片。','Choose Word, PDF, text or PNG / JPG / WebP / BMP images.'));
  if(file.size>10*1024*1024)throw new Error(tr('文件不能超过 10 MB。'));
  if(!file.size)throw new Error(tr('文件为空，请选择有内容的文件。'));
  showModal(tr('导入经历文件','Import experience file'),`<div class="dialog-content"><p>${e(file.name)}</p><p role="status">${tr('正在提取文字，请稍候…','Extracting text, please wait…')}</p><p class="field-help">${tr('文件仅在本机解析，不会发送给 AI 服务。','Files are processed on this device and are not sent to an AI service.')}</p><button type="button" class="button secondary" data-action="close-modal">${tr('取消','Cancel')}</button></div>`,true);
  const dialog=document.querySelector('#modal-root dialog'),controller=new AbortController();
  dialog.addEventListener('close',()=>controller.abort(),{once:true});
  try{
    const response=await fetch('api/profiles/import-document?filename='+encodeURIComponent(file.name),{
      method:'POST',headers:{'Content-Type':'application/octet-stream','X-FMJ-Token':token},body:file,signal:controller.signal,
    });
    const result=await response.json();if(!response.ok)throw new Error(tr(result.error||'文件解析失败，请另存为新的 Word 或 PDF 文件后重试。'));
    if(!dialog.open||!dialog.isConnected)return;
    const fields=[['skills',tr('专业技能'),1000],['education',tr('教育经历')],['experience',tr('工作 / 实习经历','Work / internship experience')],['projects',tr('项目经历','Projects')]];
    const original=Object.fromEntries(fields.map(([key])=>[key,readField(key)]));
    dialog.classList.add('profile-import-modal');
    dialog.querySelector('.dialog-content').innerHTML=`<form id="profile-import-form">
      <div class="import-intro"><p class="import-file"><strong>${e(file.name)}</strong> · ${e(profileLabel)}</p>
      <p class="field-help">${tr('从原文选中段落，复制粘贴到对应栏目；也可以点击「填入选中文字」。各栏可自由编辑，确认后再保存当前画像。','Select passages in the source and copy/paste them into the matching fields, or use “Insert selected text”. Edit each field, then apply and save the profile.')}</p>
      ${result.ocrUsed?`<p class="notice">${tr('已使用本地 Tesseract OCR（中文 + English）。请核对人名、日期、数字和分栏顺序。','Processed with local Tesseract OCR (Chinese + English). Check names, dates, numbers and column order.')}</p>`:''}
      ${(result.warnings||[]).map(message=>`<p class="notice warning">${e(tr(message))}</p>`).join('')}
      ${result.emptyPages?.length?`<p class="notice warning">${tr('OCR 后仍未识别出文字的页：','Pages with no readable text after OCR: ')}${result.emptyPages.join(', ')}</p>`:''}
      </div><div class="import-workspace"><section class="import-source">
        <label for="import-source-text">${tr('提取的原文','Extracted source text')}</label>
        <p class="field-help">${tr('选中文字后 Ctrl+C 复制，在目标栏目中 Ctrl+V 粘贴。','Select text and press Ctrl+C to copy, then Ctrl+V in the destination field.')}</p>
        <textarea id="import-source-text" name="sourceText" rows="18" readonly spellcheck="false">${e(result.text)}</textarea>
        <p class="field-help" id="import-selection" role="status"></p>
      </section><section class="import-fields" aria-label="${tr('分栏整理经历','Organize experience by section')}">
        <p class="field-help import-existing-note">${tr('各栏已保留当前内容。选好粘贴位置后填入，也可选中原有文字后替换。','Your current text is included. Place the cursor to insert, or select existing text to replace it.')}</p>
        ${fields.map(([key,label])=>`<div class="import-field"><div class="import-field-heading"><label for="import-${key}">${label}</label><button class="text-button" type="button" data-insert-field="${key}" aria-label="${e(tr('填入选中文字：','Insert selected text: ')+label)}" disabled>${tr('填入选中文字','Insert selected text')}</button></div>${key==='skills'?`<p class="field-help" id="import-skills-help">${tr('用逗号、分号或换行分隔技能；最多 50 项，每项最多 100 字符，总计最多 1,000 字符。','Separate skills with commas, semicolons or line breaks. Up to 50 skills, 100 characters each and 1,000 characters total.')}</p>`:''}<textarea id="import-${key}" name="${key}" rows="${key==='skills'?2:4}" aria-describedby="import-${key}-count${key==='skills'?' import-skills-help':''}" placeholder="${key==='skills'?'Python, SQL, Figma':tr('将相关段落粘贴到这里，也可以直接输入。','Paste relevant passages here, or type directly.')}">${e(original[key])}</textarea><p class="field-help import-field-count" id="import-${key}-count"></p></div>`).join('')}
      </section></div>
      <div class="import-footer"><p class="notice warning" id="import-error" role="alert" hidden></p>
      <div class="button-row"><span class="field-help">${tr('确认前不会修改画像；原文会一直保留在此窗口。','Your profile stays unchanged until you apply. The source remains available in this window.')}</span><button class="button primary" type="submit">${tr('填入画像草稿','Add to profile draft')}</button><button class="button secondary" type="button" data-action="close-modal">${tr('取消','Cancel')}</button></div></div>
    </form>`;
    const form=dialog.querySelector('form'),error=form.querySelector('#import-error'),button=form.querySelector('[type="submit"]');
    const source=form.elements.sourceText;
    const selectedText=()=>source.value.slice(source.selectionStart,source.selectionEnd);
    function selectionChanged(){
      const text=selectedText();
      form.querySelector('#import-selection').textContent=text?tr('已选择字符数：','Selected characters: ')+text.length.toLocaleString():tr('选中原文中的一段文字，即可填入对应栏目。','Select a passage in the source to insert it into a field.');
      form.querySelectorAll('[data-insert-field]').forEach(el=>{el.disabled=!text;});
    }
    function check(){
      try{
        const problems=[],changes={};
        for(const [key,label,limit=12000] of fields){
          const text=form.elements[key].value;
          const skills=key==='skills'?[...new Set(text.split(/[,，;；、\r\n\t]+/).map(value=>value.trim()).filter(Boolean))]:null;
          const value=skills?skills.join(', '):text,tooLong=value.length>limit;
          const invalidSkills=skills&&(skills.length>50||skills.some(skill=>skill.length>100));
          form.querySelector('#import-'+key+'-count').textContent=(skills?skills.length+' / 50 · ':'')+value.length.toLocaleString()+' / '+limit.toLocaleString('en-US');
          form.elements[key].setAttribute('aria-invalid',String(!!(tooLong||invalidSkills)));
          if(tooLong)problems.push(label+tr('超过 ',' exceeds ')+limit.toLocaleString('en-US')+tr(' 字符，请精简后再填入。',' characters. Shorten the text before applying.'));
          if(invalidSkills)problems.push(tr('专业技能最多 50 项，每项最多 100 字符，请检查分隔方式或精简。','Use no more than 50 skills and 100 characters per skill. Check the separators or shorten the text.'));
          if(text!==original[key]){
            if(readField(key)!==original[key])throw new Error(tr('画像内容已变更，请关闭窗口并重新导入，以免覆盖新内容。','The profile text changed. Close this window and import again to avoid overwriting newer content.'));
            changes[key]=value;
          }
        }
        error.hidden=!problems.length;error.textContent=problems.join(' ');
        button.disabled=!!problems.length||!Object.keys(changes).length;
        return button.disabled?null:changes;
      }catch(err){error.hidden=false;error.textContent=err.message;button.disabled=true;}
    }
    source.addEventListener('select',selectionChanged);
    source.addEventListener('keyup',selectionChanged);
    source.addEventListener('pointerup',selectionChanged);
    form.querySelectorAll('[data-insert-field]').forEach(el=>el.addEventListener('click',()=>{
      const text=selectedText();if(!text)return;
      const target=form.elements[el.dataset.insertField];
      target.setRangeText(text,target.selectionStart,target.selectionEnd,'end');target.focus();check();
    }));
    form.addEventListener('input',check);form.addEventListener('change',check);
    form.addEventListener('submit',event=>{
      event.preventDefault();event.stopPropagation();
      try{
        const changes=check();if(!changes)return;
        writeFields(changes);closeModal();
      }catch(err){error.hidden=false;error.textContent=err.message;}
    });
    check();selectionChanged();source.focus({preventScroll:true});
  }catch(err){
    if(!dialog.open||!dialog.isConnected||err.name==='AbortError')return;
    dialog.querySelector('.dialog-content').innerHTML=`<p class="notice warning" role="alert">${e(err.message)}</p><button class="button secondary" data-action="close-modal">${tr('关闭','Close')}</button>`;
  }
}
