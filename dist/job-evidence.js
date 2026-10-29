// Conservative, local evidence comparison. Text remains source data, never instructions.
export const EVIDENCE_VERSION = 1;
const escapePattern = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const term = value => new RegExp(`(?<![a-z0-9])${escapePattern(value)}(?![a-z0-9])`, 'i');
const vocabulary = [
  ['SQL',['SQL']], ['Python',['Python']], ['JavaScript',['JavaScript']], ['TypeScript',['TypeScript']],
  ['Java',['Java']], ['C++',['C++']], ['C#',['C#']], ['React',['React']], ['Vue',['Vue','Vue.js']],
  ['Node.js',['Node.js','NodeJS']], ['AWS',['AWS','Amazon Web Services']], ['Azure',['Azure']],
  ['GCP',['GCP','Google Cloud']], ['Spark',['Spark','PySpark']], ['Hadoop',['Hadoop']],
  ['Docker',['Docker']], ['Kubernetes',['Kubernetes','K8s']], ['Linux',['Linux']], ['Git',['Git']],
  ['PostgreSQL',['PostgreSQL','Postgres']], ['MySQL',['MySQL']], ['MongoDB',['MongoDB']],
  ['Excel',['Excel']], ['Tableau',['Tableau']], ['Power BI',['Power BI','PowerBI']], ['Figma',['Figma']],
  ['ETL',['ETL']], ['云平台',['云平台','云服务','cloud platform','cloud platforms']],
  ['用户研究',['用户研究','user research']], ['数据分析',['数据分析','data analysis']],
].map(([name,aliases])=>({name,patterns:aliases.map(term)}));
const has = (text,skill) => skill.patterns.some(pattern=>pattern.test(text));
const skillsIn = text => vocabulary.filter(skill=>has(text,skill));
const preferred = /优先|加分|优选|更佳|最好|preferred|nice[ -]to[ -]have|bonus|a plus|an asset|desirable/i;
const required = /必须|必备|至少|要求|需具备|required|must\b|minimum|essential|mandatory/i;
const qualification = /熟悉|掌握|具备|经验|学历|学位|本科|硕士|博士|能力|能够|资格|要求|优先|experience|proficien|knowledge|familiar|ability|degree|qualification|required|must\b|preferred|skills?\b|certif|fluent|expertise/i;
const sectionRequired = /^(?:任职要求|岗位要求|任职资格|职位要求|基本要求|必备条件|必要条件|基本资格|requirements|qualifications|minimum qualifications|required qualifications|essential skills|what you (?:bring|need)|what we(?:'re| are) looking for|your (?:skills|qualifications))$/i;
const sectionPreferred = /^(?:加分项|加分条件|优先条件|优先资格|preferred qualifications|preferred skills|nice[ -]to[ -]have|bonus(?: points)?)$/i;
const sectionOther = /^(?:岗位职责|工作职责|职位描述|工作内容|关于我们|福利|responsibilities|about(?: us| the (?:role|team|company))?|benefits|what you(?:'ll| will) do|job description)$/i;
const action = /使用|运用|采用|开发|搭建|构建|实现|完成|分析|维护|部署|设计|编写|负责|参与|实操|实践|\b(?:used?|using|built|developed|implemented|analy[sz]ed|maintained|deployed|designed|created|worked|managed|implemented)\b/i;
const uncertain = /计划|希望|打算|想要|准备学习|正在学习|学习中|入门|尚在|需要|将使用|将会|待完成|[?？]|\b(?:plan|planned|planning|want|aspire|learning|beginner|intend|aim|will|would|could|should|must|required)\b/i;
const negative = /(?:没有|暂无|尚无|缺乏|不具备|未曾|从未|未使用|不使用|没用过|未接触|不会|不熟悉)|\b(?:no|never|without|lack|lacking|haven't|don't|didn't|doesn't)\b|\bnot\b(?!\s+only)/i;
const complex = /精通|熟练|深入|丰富|大型|大规模|生产环境|商业|专业工作|带领|管理团队|架构|\b(?:advanced|expert|proficien|extensive|strong|deep|large.scale|production|commercial|professional|leadership|architect|at scale)\b/i;
const alternatives = /或|或者|\bor\b|and\/or|equivalent/i;

// Offsets refer to the saved string, including punctuation; every quotation is recoverable.
function segments(text, clauses=false) {
  const value=String(text||'');
  const pattern=clauses?/[^\n。；;，,!?！？]+(?:[。；;，,!?！？]|\.(?=\s|$))?/g:/[^\n。；;!?！？]+[。；;!?！？]?/g;
  return [...value.matchAll(pattern)].flatMap(match=>{
    // Periods delimit English sentences, except inside tool names and decimals.
    const chunks=[...match[0].matchAll(/.+?(?:\.(?=\s|$)|$)/g)].filter(m=>m[0].trim());
    return chunks.map(chunk=>{
      const raw=chunk[0],leading=raw.length-raw.trimStart().length;
      const quote=raw.trim(),start=match.index+chunk.index+leading;
      return {quote,start,end:start+quote.length};
    });
  });
}
const headingText = quote => quote.replace(/^[\s#*•\-\d.)、]+/,'').replace(/[：:。.;；\s]+$/,'').trim();

export function extractRequirements(job={}) {
  const rows=[],seen=new Set();
  const add=(source,kind)=>{
    const key=source.quote.replace(/^[\s•*\-\d.)、]+/,'').replace(/\s+/g,' ').toLowerCase();
    if(!key||seen.has(key))return;
    seen.add(key);rows.push({source,kind,requirement:source.quote});
  };
  const scan=(value,field,index,defaultKind,all)=>{
    let group=defaultKind;
    for(const part of segments(value)){
      let source={...part,field,...(index===undefined?{}:{index})};
      let title=headingText(part.quote);
      // A heading may share a line with its first requirement.
      const colon=part.quote.search(/[:：]/);
      const label=colon<0?title:headingText(part.quote.slice(0,colon));
      const recognized=sectionPreferred.test(label)?'preferred':sectionRequired.test(label)?'required':sectionOther.test(label)?'other':null;
      if(recognized){
        group=recognized;
        if(colon<0||!part.quote.slice(colon+1).trim())continue;
        const rest=part.quote.slice(colon+1),space=rest.length-rest.trimStart().length;
        source={...source,quote:rest.trim(),start:part.start+colon+1+space};source.end=source.start+source.quote.length;
      }
      const text=source.quote;
      if(group==='other')continue;
      if(!all&&group==='unspecified'&&!qualification.test(text))continue;
      const optional=/不要求|无需|不必|非必需|not required|optional|no .*required/i.test(text);
      const kind=optional||(preferred.test(text)&&required.test(text))?'unspecified':preferred.test(text)?'preferred':required.test(text)?'required':group;
      add(source,['required','preferred'].includes(kind)?kind:'unspecified');
    }
  };
  scan(job.description,'description',undefined,'unspecified',false);
  for(const [index,value] of (Array.isArray(job.requirements)?job.requirements:[]).entries()){
    if(typeof value==='string')scan(value,'requirements',index,'unspecified',true);
  }
  return {rows:rows.slice(0,60),truncated:rows.length>60};
}

function candidateEvidence(profile) {
  return ['experience','projects','education'].flatMap(field=>segments(profile[field],true).map(part=>({...part,field})));
}
const number = value => ({一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9,十:10}[value]??Number(value));
// Only explicit total work experience is comparable. Dates and project durations are never summed.
function totalYears(text) {
  const match=text.match(/([\d]+(?:\.\d+)?|[一二两三四五六七八九十])\s*(?:[+＋]|年(?:以上|及以上))?\s*(?:年\s*(?:的)?\s*(?:全职)?工作经验|years?\s+(?:of\s+)?(?:total\s+|full[ -]time\s+)?work(?:ing)?\s+experience)/i)
    ||text.match(/([\d]+(?:\.\d+)?|[一二两三四五六七八九十])\s*年(?:以上|及以上)?(?:的)?(?:全职)?工作经验/);
  if(!match)return null;
  const value=number(match[1]);
  if(!Number.isFinite(value)||value<0||value>60)return null;
  const before=text.slice(0,match.index),after=text.slice(match.index+match[0].length);
  // Ranges, upper bounds and scoped years cannot establish an exact total.
  if(/[\d一二三四五六七八九十]\s*[-–—~至到]\s*$/.test(before)||/不足|少于|最多|超过|over\b|under\b|less than|up to/i.test(before)||/以下/.test(after))return null;
  if(skillsIn(text).length||/相关|行业|领域|开发|工程|设计|分析|\b(?:in|with|related|engineering|development|industry)\b/i.test(after))return null;
  const extra=(before+after).replace(/总计|累计|总共|共有|拥有|具备|至少|要求|需要|另有|共|的|\b(?:i|have|has|with|a|an|total|at least|minimum|required|experience)\b/gi,'').replace(/[\s。.,，:：;；()（）*•\-]+/g,'');
  if(extra)return null;
  return {value,lowerBound:/[+＋]|以上|at least|minimum/i.test(match[0]+before),fullTime:/全职|full[ -]time/i.test(match[0])};
}

function assess(row,evidence,profile) {
  const text=row.requirement,skills=skillsIn(text),years=totalYears(text);
  const base={...row,status:'unknown',reason:'not_recorded',evidence:[]};
  if(years){
    const facts=evidence.filter(item=>item.field==='experience'&&!uncertain.test(item.quote)&&!negative.test(item.quote)&&!/[?？]|要求|至少需|must|required/i.test(item.quote))
      .map(item=>({item,years:totalYears(item.quote)})).filter(item=>item.years);
    if(facts.length===1&&!alternatives.test(text)){
      const fact=facts[0],moreConditions=skills.length>0||complex.test(text)||/且|并|以及|\band\b/i.test(text)||(years.fullTime&&!fact.years.fullTime);
      base.evidence=[fact.item];
      if(!moreConditions&&fact.years.value>=years.value)return {...base,status:'supported',reason:'explicit_years'};
      if(!moreConditions&&!fact.years.lowerBound&&fact.years.value<years.value)return {...base,status:'gap',reason:'years_gap'};
      return {...base,reason:'needs_context'};
    }
    return {...base,evidence:facts.map(f=>f.item),reason:'years_unknown'};
  }
  if(!skills.length)return {...base,reason:'manual_check'};
  const matches=skills.map(skill=>{
    const mentioned=evidence.filter(item=>has(item.quote,skill));
    // Skill declarations and coursework are supporting context, not proof of applied experience.
    const applied=mentioned.filter(item=>['experience','projects'].includes(item.field)&&action.test(item.quote)&&!negative.test(item.quote)&&!uncertain.test(item.quote));
    const denied=mentioned.filter(item=>{
      const neg=item.quote.search(negative),at=Math.min(...skill.patterns.map(p=>item.quote.search(p)).filter(i=>i>=0));
      return neg>=0&&neg<at&&at-neg<80&&!/但|但是|不过|\b(?:but|however|although)\b/i.test(item.quote.slice(neg,at))&&!uncertain.test(item.quote);
    });
    const declared=(profile.skills||[]).filter(value=>typeof value==='string'&&has(value,skill)).map(quote=>({field:'skills',quote}));
    return {skill,applied,denied,all:[...mentioned,...declared]};
  });
  base.evidence=[...new Map(matches.flatMap(match=>match.all).map(item=>[JSON.stringify(item),item])).values()].slice(0,8);
  const qualified=complex.test(text)||alternatives.test(text)||/\d|[一二三四五六七八九十]年|证书|认证|学历|本科|硕士|博士|\b(?:degree|certif|years?|months?)\b/i.test(text);
  // A known term in a longer sentence only establishes relevance, not every additional condition.
  const residual=skills.reduce((value,skill)=>skill.patterns.reduce((s,pattern)=>s.replace(new RegExp(pattern.source,'gi'),''),value),text)
    .replace(/^[\s\d.)、*•\-]+/,'').replace(/必须|要求|具备|有|使用|了解|熟悉|掌握|能够|经验|开发|实践|知识|能力|技能|优先|加分|相关|至少|的|和|及|与|或|\b(?:experience|knowledge|familiarity|familiar|with|in|of|using|use|and|required|preferred|skills?|must|have|working|hands[ -]on|practical|is|a|an|plus|bonus)\b/gi,'').replace(/[\s,，。.;；:：/()（）+&\-]+/g,'');
  const simple=!qualified&&!residual;
  const conflict=matches.some(m=>m.denied.length&&m.applied.length);
  if(simple&&!conflict&&matches.every(m=>m.applied.length))return {...base,status:'supported',reason:'applied_evidence'};
  if(simple&&!conflict&&matches.some(m=>m.denied.length&&!m.applied.length))return {...base,status:'gap',reason:'explicit_absence'};
  if(conflict)return {...base,reason:'conflicting_evidence'};
  if(matches.some(m=>m.applied.length))return {...base,reason:'needs_context'};
  return {...base,reason:base.evidence.length?'mention_only':'not_recorded'};
}

export function analyzeJobEvidence(job={},profile={}) {
  const extracted=extractRequirements(job),evidence=candidateEvidence(profile);
  const rows=extracted.rows.map((row,index)=>({id:`requirement-${index+1}`,...assess(row,evidence,profile)}));
  const counts={supported:0,unknown:0,gap:0};for(const row of rows)counts[row.status]++;
  return {version:EVIDENCE_VERSION,rows,counts,truncated:extracted.truncated,summaryOnly:job.descriptionKind==='summary'};
}
