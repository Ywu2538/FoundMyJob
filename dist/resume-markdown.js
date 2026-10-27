// Render the small Markdown subset used by generated resumes. All candidate text is
// escaped before formatting marks are introduced, so source HTML is never trusted.
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
}[char]));

function inline(text) {
  return escapeHtml(text)
    .replace(/\*\*(\S(?:.*?\S)?)\*\*/g,'<strong>$1</strong>')
    .replace(/__(\S(?:.*?\S)?)__/g,'<strong>$1</strong>')
    .replace(/(?<!\*)\*(?!\*)(\S(?:.*?\S)?)\*(?!\*)/g,'<em>$1</em>')
    .replace(/(?<!_)_(?!_)(\S(?:.*?\S)?)_(?!_)/g,'<em>$1</em>');
}

function blocks(markdown) {
  return String(markdown ?? '').replace(/\r\n?/g,'\n').split('\n').flatMap(raw => {
    const line=raw.trim();
    if(!line)return [];
    const heading=/^#{1,6}\s+(.+?)\s*#*\s*$/.exec(line);
    if(heading)return [{kind:'heading',level:Math.min((line.match(/^#+/)||[''])[0].length,3),text:heading[1]}];
    const unordered=/^(?:[-*+]\s+|[•●]\s*)(.+)$/.exec(line);
    if(unordered)return [{kind:'ul',text:unordered[1]}];
    const ordered=/^\d+[.)]\s+(.+)$/.exec(line);
    if(ordered)return [{kind:'ol',text:ordered[1]}];
    return [{kind:'paragraph',text:line}];
  });
}

function renderBlocks(items) {
  let html='',list='';
  for(const item of items){
    const nextList=item.kind==='ul'||item.kind==='ol'?item.kind:'';
    if(list&&nextList!==list){html+=`</${list}>`;list='';}
    if(nextList){
      if(!list){html+=`<${nextList}>`;list=nextList;}
      html+=`<li>${inline(item.text)}</li>`;
    }else if(item.kind==='heading'){
      html+=`<h${item.level}>${inline(item.text)}</h${item.level}>`;
    }else{
      html+=`<p>${inline(item.text)}</p>`;
    }
  }
  if(list)html+=`</${list}>`;
  return html;
}

function renderSection(items) {
  const segments=[];
  let current=[];
  let entry=false;
  for(const item of items){
    if(item.kind==='heading'&&item.level===3){
      if(current.length)segments.push({entry,items:current});
      current=[];entry=true;
    }
    current.push(item);
  }
  if(current.length)segments.push({entry,items:current});
  return segments.map(segment=>segment.entry
    ? `<div class="resume-entry">${renderBlocks(segment.items)}</div>`
    : renderBlocks(segment.items)).join('');
}

export function renderResumeMarkdown(markdown,layout='classic') {
  const items=blocks(markdown),firstSection=items.findIndex(item=>item.kind==='heading'&&item.level===2);
  const headerEnd=firstSection>=0?firstSection:items.some(item=>item.kind==='heading'&&item.level===1)?items.length:0;
  const header=headerEnd?`<header class="resume-header">${renderBlocks(items.slice(0,headerEnd))}</header>`:'';
  const sections=[];
  let current=[];
  for(const item of items.slice(headerEnd)){
    if(item.kind==='heading'&&item.level===2&&current.length){sections.push(current);current=[];}
    current.push(item);
  }
  if(current.length)sections.push(current);
  const html=section=>`<section class="resume-section">${renderSection(section)}</section>`;
  const side=section=>/技能|技术栈|教育|学历|证书|语言能力|联系方式|skills|education|certif|languages|contact/i.test(section.find(item=>item.kind==='heading'&&item.level===2)?.text||'');
  if(layout==='sidebar'&&sections.some(side)&&sections.some(section=>!side(section))){
    return `<div class="resume-document"><aside class="resume-sidebar">${header}${sections.filter(side).map(html).join('')}</aside><div class="resume-body">${sections.filter(section=>!side(section)).map(html).join('')}</div></div>`;
  }
  return `<div class="resume-document">${header}<div class="resume-body">${sections.map(html).join('')}</div></div>`;
}
