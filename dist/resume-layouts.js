export const DEFAULT_RESUME_LAYOUT='classic';

// Layout changes presentation only. Markdown remains the editable source of truth.
export const RESUME_LAYOUTS=Object.freeze([
  {id:'classic',nameZh:'经典 ATS',nameEn:'Classic ATS',descriptionZh:'黑白单栏 · 通用投递',descriptionEn:'Black and white · single column',ats:true},
  {id:'campus',nameZh:'校招清爽',nameEn:'Campus clean',descriptionZh:'蓝灰细线 · 紧凑单栏',descriptionEn:'Blue and gray · compact single column',ats:true},
  {id:'modern',nameZh:'现代商务',nameEn:'Modern business',descriptionZh:'藏蓝重点色 · 宽松单栏',descriptionEn:'Navy accents · spacious single column',ats:true},
  {id:'modular',nameZh:'欧式模块',nameEn:'European modular',descriptionZh:'清晰分区 · 线性阅读',descriptionEn:'Distinct sections · linear reading order',ats:true},
  {id:'sidebar',nameZh:'创意侧栏',nameEn:'Creative sidebar',descriptionZh:'双栏视觉 · 适合人工阅读',descriptionEn:'Two-column look · best for human review',ats:false},
]);

export const isResumeLayout=id=>RESUME_LAYOUTS.some(layout=>layout.id===id);
export const normalizeResumeLayout=id=>isResumeLayout(id)?id:DEFAULT_RESUME_LAYOUT;

const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export function resumeLayoutPickerHtml(selected,translate=(zh)=>zh){
  const active=normalizeResumeLayout(selected);
  return `<fieldset class="resume-template-picker"><legend>${translate('选择简历布局','Choose resume layout')}</legend><div class="resume-template-options">${RESUME_LAYOUTS.map(layout=>`<label class="resume-template-option" data-layout="${layout.id}"><input type="radio" name="resume-template" value="${layout.id}" ${active===layout.id?'checked':''}/><span class="resume-template-thumbnail" aria-hidden="true"><i></i><i></i><i></i></span><strong>${translate(layout.nameZh,layout.nameEn)}</strong><small>${translate(layout.descriptionZh,layout.descriptionEn)}</small><em>${layout.ats?translate('单栏 · ATS 友好','Single column · ATS friendly'):translate('人工阅读优先','Best for human review')}</em></label>`).join('')}</div><p class="resume-template-help">${translate('布局只改变展示，不改写经历；双栏版适合直接发送给招聘者，在线系统优先使用单栏。','Layouts change presentation only. Use a single-column layout for online application systems; the sidebar suits direct human review.')}</p></fieldset>`;
}

export function resumePrintDocumentHtml({title,content,layout,buttonLabel},renderMarkdown){
  const selected=normalizeResumeLayout(layout);
  return `<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><link rel="stylesheet" href="/resume.css"></head><body class="resume-print-page"><div class="resume-print-actions"><button id="print" type="button">${escapeHtml(buttonLabel)}</button></div><article class="resume-paper layout-${selected}">${renderMarkdown(content,selected)}</article></body></html>`;
}
