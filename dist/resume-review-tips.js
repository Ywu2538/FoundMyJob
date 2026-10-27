// Review tips are display-only resume editing advice. Older saved notes were
// free-form warnings, so they must never be rendered as review tips.
const unsafeTopic = /(?:\b(?:JD|job|position|vacanc(?:y|ies)|recruit(?:er|ing|ment)?|hiring|eligib(?:le|ility)|qualif(?:y|ication|ied)|requirement|interview|apply|application|salary|compensation|risk|gap|lacks?|insufficient|verify|fact.?check|confirm|source|evidence|proof|prove|substantiat\w*|unsupported|warning|system|prompt|model|generated)\b|岗位|职位|招聘|雇主|录用|投递|申请|面试|薪资|匹配|胜任|资格|要求|年限|风险|不足|缺口|差距|核对|核实|确认|查证|证明|证据|真实|事实检查|原始资料|系统|提示词|模型|生成过程|\d+\s*(?:年经验|years? of experience))/i;
const unsafeFormatting = /[\r\n<>]|(?:https?:\/\/|www\.)|^\s*(?:#{1,6}|```)/i;
const zhAction = /(?:补充|写明|说明|精简|合并|删除|改写|突出|调整|排序|标注|列出|拆分|保留|压缩|统一|整理|概括|描述)/;
const zhTarget = /(?:简历|技能|工作经历|实习经历|项目经历|教育背景|教育经历|经历条目|项目条目|技能栏|工作条目|教育栏|要点|成果|职责|标题|时间|日期|工具|技术)/;
const enAction = /^(?:(?:In|For) (?:the )?(?:skills|experience|projects?|education|internships?) (?:section|bullets?),?\s*)?(?:Add|Clarify|Specify|Rewrite|Trim|Condense|Move|Highlight|Order|Replace|Show|Describe|Group|Separate|Keep|Remove|Use|List|Format)\b|^(?:Skills|Experience|Projects?|Education|Internships?):\s*(?:add|clarify|specify|rewrite|trim|condense|move|highlight|order|replace|show|describe|group|separate|keep|remove|use|list|format)\b/i;
const enTarget = /\b(?:resume|skills?|experience|internships?|projects?|education|bullets?|achievement|responsibilit(?:y|ies)|heading|title|dates?|tools?|technolog(?:y|ies))\b/i;

function languageOf(language) {return language==='en'?'en':'zh';}

// Only versioned notes should be passed here. Even then, accept a narrow,
// candidate-facing editing sentence rather than arbitrary model prose.
export function sanitizeReviewTips(notes, language='zh') {
  if(!Array.isArray(notes))return [];
  const en=languageOf(language)==='en',seen=new Set(),safe=[];
  for(const note of notes){
    if(typeof note!=='string'||note.length>240||unsafeFormatting.test(note))continue;
    const tip=note.trim().replace(/^(?:[-*•●]|\d+[.)])\s*/,'').trim();
    if(tip.length<12||tip.length>(en?200:120)||unsafeTopic.test(tip))continue;
    // A second sentence or semicolon can hide unrelated instructions after a
    // plausible editing tip. Keep only a single short recommendation.
    if(/[;；!?？！]/.test(tip)||/[。.]/.test(tip.replace(/[。.]+$/,'')))continue;
    if(en?!(enAction.test(tip)&&enTarget.test(tip)):!(zhAction.test(tip)&&zhTarget.test(tip)))continue;
    const key=tip.toLocaleLowerCase().replace(/[\s。.!！?？,，:：;；]/g,'');
    if(seen.has(key))continue;
    seen.add(key);safe.push(tip);
    if(safe.length===3)break;
  }
  return safe;
}

const sectionTips={
  zh:{
    skills:'技能：把已列出的技能按类别整理，删除重复项。',
    work:'工作经历：把笼统职责改成具体行动与已有成果，保持每条要点简短。',
    internship:'实习经历：写清每段实习中亲自完成的任务和使用的方法。',
    projects:'项目经历：在每个项目要点中写清个人贡献和使用的技术。',
    education:'教育背景：统一学校、专业、学位和时间的排列格式。',
    general:['精简简历中重复或冗长的表述，让内容更容易快速浏览。','统一简历标题和标点的格式，保持版面一致。']
  },
  en:{
    skills:'Skills: group the listed skills by category and remove duplicates.',
    work:'Experience: turn broad duties into specific actions and existing outcomes.',
    internship:'Internships: describe the tasks you completed and the methods you used.',
    projects:'Projects: state your contribution and the technologies used in each bullet.',
    education:'Education: use a consistent order for school, program, degree, and dates.',
    general:['Trim repeated or lengthy wording so the resume is easier to scan.','Keep headings and punctuation consistent throughout the resume.']
  }
};

const sectionKinds=[
  ['skills',/^(?:专业技能|个人技能|核心技能|技术技能|技能特长|专业特长|个人特长|核心能力|个人优势|技术栈|技能|特长|优势|(?:technical|core|professional)\s+skills?|skills?|strengths?|core\s+competenc(?:y|ies))/i],
  ['internship',/^(?:实习经历|实习经验|实习|internships?|internship experience)/i],
  ['work',/^(?:工作经历|工作经验|职业经历|任职经历|工作与实习经历|(?:work|professional) experience|employment|experience)/i],
  ['projects',/^(?:项目经历|项目经验|项目实践|校园项目|项目|projects?|academic projects?)/i],
  ['education',/^(?:教育背景|教育经历|学历背景|教育|学历|education|academic background)/i]
];

function fallbackTips(resume) {
  const language=languageOf(resume?.language),copy=sectionTips[language];
  const headings=String(resume?.content??'').match(/^#{2}\s+.+$/gm)??[];
  const kinds=[];
  for(const heading of headings){
    const title=heading.replace(/^##\s+/,'').replace(/\s+#+\s*$/,'').replace(/[*_`]/g,'').trim();
    const kind=sectionKinds.find(([,pattern])=>pattern.test(title))?.[0];
    if(kind&&!kinds.includes(kind))kinds.push(kind);
  }
  const result=kinds.slice(0,3).map(kind=>copy[kind]);
  for(const tip of copy.general){if(result.length>=2)break;result.push(tip);}
  return result;
}

export function resumeReviewTips(resume) {
  if(resume?.reviewTipsVersion===1){
    const tips=sanitizeReviewTips(resume.notes,resume.language);
    if(tips.length)return tips;
  }
  return fallbackTips(resume);
}
