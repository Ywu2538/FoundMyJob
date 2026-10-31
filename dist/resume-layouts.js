export const DEFAULT_RESUME_LAYOUT='classic';

// Layout changes presentation only. Markdown remains the editable source of truth.
export const RESUME_LAYOUTS=Object.freeze([
  {id:'classic',nameZh:'经典 ATS',nameEn:'Classic ATS',descriptionZh:'黑白单栏 · 通用投递',descriptionEn:'Black and white · single column',ats:true},
  {id:'campus',nameZh:'校招清爽',nameEn:'Campus clean',descriptionZh:'蓝灰细线 · 紧凑单栏',descriptionEn:'Blue and gray · compact single column',ats:true},
  {id:'modern',nameZh:'现代商务',nameEn:'Modern business',descriptionZh:'藏蓝重点色 · 宽松单栏',descriptionEn:'Navy accents · spacious single column',ats:true},
  {id:'modular',nameZh:'欧式模块',nameEn:'European modular',descriptionZh:'清晰分区 · 线性阅读',descriptionEn:'Distinct sections · linear reading order',ats:true},
  {id:'sidebar',nameZh:'创意侧栏',nameEn:'Creative sidebar',descriptionZh:'双栏视觉 · 适合人工阅读',descriptionEn:'Two-column look · best for human review',ats:false},
  {id:'cn-formal',nameZh:'国内端正规范',nameEn:'China formal',descriptionZh:'证件照 · 深蓝分区',descriptionEn:'Portrait · navy section bars',ats:false,photo:true,market:'cn'},
  {id:'cn-campus',nameZh:'国内校招',nameEn:'China graduate',descriptionZh:'证件照 · 青绿细线',descriptionEn:'Portrait · teal accents',ats:false,photo:true,market:'cn'},
  {id:'cn-modern',nameZh:'国内现代履历',nameEn:'China contemporary',descriptionZh:'证件照 · 墨蓝侧栏',descriptionEn:'Portrait · ink blue sidebar',ats:false,photo:true,market:'cn'},
  {id:'international-photo',nameZh:'国际照片版',nameEn:'International portrait',descriptionZh:'可选证件照 · 灰色简约',descriptionEn:'Optional portrait · minimal gray',ats:false,photo:true,market:'international'},
  {id:'north-america',nameZh:'北美精简',nameEn:'North America concise',descriptionZh:'无照片 · 紧凑黑白',descriptionEn:'No photo · compact black and white',ats:true,market:'international'},
  {id:'editorial',nameZh:'英式雅致',nameEn:'Editorial CV',descriptionZh:'无照片 · 衬线标题',descriptionEn:'No photo · serif headings',ats:true,market:'international'},
  {id:'executive',nameZh:'资深专业',nameEn:'Senior professional',descriptionZh:'无照片 · 深棕横线',descriptionEn:'No photo · warm brown rules',ats:true,market:'international'},
].map(layout=>Object.freeze({market:'universal',photo:false,access:'free',creditCost:0,entitlementKey:'resume-template:'+layout.id,...layout})));

export const isResumeLayout=id=>RESUME_LAYOUTS.some(layout=>layout.id===id);
export const normalizeResumeLayout=id=>isResumeLayout(id)?id:DEFAULT_RESUME_LAYOUT;
export const resumeLayout=id=>RESUME_LAYOUTS.find(layout=>layout.id===id);
export const canUseResumeLayout=(id,entitlements=[],catalog=RESUME_LAYOUTS)=>{const layout=catalog.find(layout=>layout.id===id);return !!layout&&(layout.access==='free'||entitlements.includes(layout.entitlementKey));};

const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export function resumeLayoutPickerHtml(selected,translate=(zh)=>zh){
  const active=normalizeResumeLayout(selected),current=resumeLayout(active);
  return `<fieldset class="resume-template-picker"><legend>${translate('选择简历布局','Choose resume layout')}</legend><details id="resume-layout-menu"><summary><span data-layout-name>${translate(current.nameZh,current.nameEn)}</span><span>${RESUME_LAYOUTS.length} ${translate('套模板 · 点击切换','layouts · click to change')}</span></summary><div class="resume-template-options">${RESUME_LAYOUTS.map(layout=>`<label class="resume-template-option" data-layout="${layout.id}"><input type="radio" name="resume-template" value="${layout.id}" ${active===layout.id?'checked':''}/><span class="resume-template-thumbnail ${layout.photo?'with-photo':''}" aria-hidden="true"><i></i><i></i><i></i></span><strong>${translate(layout.nameZh,layout.nameEn)}</strong><small>${translate(layout.descriptionZh,layout.descriptionEn)}</small><em>${layout.photo?translate('带证件照 · ' ,'Portrait · '):''}${layout.ats?translate('单栏 · ATS 友好','Single column · ATS friendly'):translate('人工阅读优先','Best for human review')}</em></label>`).join('')}</div><p class="resume-template-help">${translate('全部模板当前免费。带照片模板适用于明确需要照片的投递；北美等无照片投递可选单栏。模板只改变排版，不改写经历。','All templates are currently free. Use portrait layouts when a photo is requested, or a photo-free single column for other applications. Layout changes do not rewrite your experience.')}</p></details></fieldset>`;
}

export function resumePrintDocumentHtml({title,content,layout,photo,buttonLabel},renderMarkdown){
  const selected=normalizeResumeLayout(layout);
  return `<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><link rel="stylesheet" href="resume.css"></head><body class="resume-print-page"><div class="resume-print-actions"><button id="print" type="button">${escapeHtml(buttonLabel)}</button></div><article class="resume-paper layout-${selected}">${renderMarkdown(content,selected,{photo})}</article></body></html>`;
}
