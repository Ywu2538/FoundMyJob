import {COUNTRIES} from './company-catalog.js';

export const JOB_COUNTRIES={cn:['中国大陆','China'],...COUNTRIES};
export const WORK_PREFERENCES={onsite:['现场办公','On-site'],hybrid:['混合办公','Hybrid'],remote:['远程办公','Remote']};
// Canonical values stay in English; labels and aliases support both interfaces.
const cityRows={
 cn:[['北京','Beijing'],['上海','Shanghai'],['深圳','Shenzhen'],['广州','Guangzhou'],['杭州','Hangzhou'],['成都','Chengdu'],['武汉','Wuhan'],['南京','Nanjing'],['苏州','Suzhou'],['西安',"Xi’an","Xi'an|Xian"],['天津','Tianjin'],['重庆','Chongqing']],
 ca:[['多伦多','Toronto','North York|Scarborough|Etobicoke|Greater Toronto Area'],['温哥华','Vancouver'],['蒙特利尔','Montreal','Montréal'],['渥太华','Ottawa'],['滑铁卢','Waterloo'],['密西沙加','Mississauga'],['卡尔加里','Calgary'],['埃德蒙顿','Edmonton'],['伦敦（加拿大）','London, Ontario'],['魁北克城','Quebec City','Québec City']],
 us:[['纽约','New York','NYC'],['旧金山','San Francisco'],['西雅图','Seattle'],['波士顿','Boston'],['芝加哥','Chicago'],['奥斯汀','Austin'],['洛杉矶','Los Angeles'],['圣何塞','San Jose'],['华盛顿','Washington, DC']],
 jp:[['东京','Tokyo','東京'],['大阪','Osaka'],['京都','Kyoto'],['横滨','Yokohama'],['名古屋','Nagoya'],['福冈','Fukuoka']],
 gb:[['伦敦','London'],['曼彻斯特','Manchester'],['爱丁堡','Edinburgh'],['伯明翰','Birmingham'],['布里斯托尔','Bristol'],['格拉斯哥','Glasgow']],
 fr:[['巴黎','Paris'],['里昂','Lyon'],['图卢兹','Toulouse'],['马赛','Marseille'],['波尔多','Bordeaux'],['里尔','Lille']],
 au:[['悉尼','Sydney'],['墨尔本','Melbourne'],['布里斯班','Brisbane'],['珀斯','Perth'],['阿德莱德','Adelaide'],['堪培拉','Canberra']],
 sg:[['新加坡','Singapore']],
};
export const JOB_CITIES=Object.entries(cityRows).flatMap(([country,rows])=>rows.map(([zh,en,aliases=''])=>({country,value:en,labels:[zh,en],aliases:[zh,en,...aliases.split('|').filter(Boolean)]})));
const normalized=text=>String(text||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
function contains(text,phrase){
 const source=normalized(text),part=normalized(phrase);
 if(!part)return false;
 if(/[^\x00-\x7f]/.test(part))return source.includes(part);
 return new RegExp(`(^|[^a-z0-9])${part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}($|[^a-z0-9])`,'i').test(source);
}
export function cityEntry(city,country=''){
 return JOB_CITIES.find(entry=>(!country||entry.country===country)&&entry.aliases.some(alias=>normalized(alias)===normalized(city)));
}
export function canonicalCity(city,country=''){return cityEntry(city,country)?.value||String(city||'').trim();}
export function cityOptions(country=''){return JOB_CITIES.filter(city=>!country||city.country===country);}
export function normalizeWork(value=''){
 if(Object.hasOwn(WORK_PREFERENCES,value))return value;
 const text=String(value);
 if(/hybrid|混合/i.test(text))return 'hybrid';
 if(/remote|远程|居家|work\s*from\s*home/i.test(text))return 'remote';
 if(/on[\s-]?site|in[\s-]?office|现场办公|坐班|到岗|到办公室/i.test(text))return 'onsite';
 return '';
}
export function resolvedJobPreferences(profile={}){
 if(profile.jobPreferences&&typeof profile.jobPreferences==='object'){
  const p=profile.jobPreferences;
  return {country:Object.hasOwn(JOB_COUNTRIES,p.country)?p.country:'',city:canonicalCity(p.city,p.country),work:normalizeWork(p.work)};
 }
 const text=profile.preferences||'';
 let country=Object.entries(JOB_COUNTRIES).find(([,names])=>names.some(name=>contains(text,name)))?.[0]||'';
 if(!country&&/\b(?:USA|United States)\b|美国/i.test(text))country='us';
 if(!country&&/\b(?:UK|United Kingdom)\b|英国/i.test(text))country='gb';
 const cities=JOB_CITIES.filter(c=>(!country||c.country===country)&&c.aliases.some(alias=>contains(text,alias)));
 const specific=cities.find(c=>c.value==='London, Ontario');
 const city=specific||cities[0];
 // Only migrate an unambiguous single city. Keep complex preferences as notes.
 const unique=cities.filter(c=>!specific||c.country!=='gb');
 if(!country&&city&&new Set(unique.map(c=>c.country)).size===1)country=city.country;
 return {country,city:unique.length===1?city.value:'',work:normalizeWork(text)};
}
export function jobInCity(job,city,country=''){
 if(!city)return true;
 const entry=cityEntry(city,country),location=job.location||'';
 return (entry?.aliases||[city]).some(alias=>contains(location,alias));
}
export function jobInWork(job,work='',includeUnknown=false){
 if(!work)return true;
 const expected=normalizeWork(work);
 const actual=normalizeWork(job.work)||normalizeWork(job.workplaceType);
 return expected?(actual===expected||(!actual&&includeUnknown)):job.work===work;
}
export function preferenceRegion(profile={}){
 const {country}=resolvedJobPreferences(profile);
 if(country)return country;
 if(profile.searchScope==='all')return '';
 if(profile.searchScope==='domestic')return 'cn';
 if(profile.searchScope==='overseas')return JOB_COUNTRIES[profile.market]&&profile.market!=='cn'?profile.market:'overseas';
 return JOB_COUNTRIES[profile.market]?profile.market:profile.market?'overseas':'';
}
