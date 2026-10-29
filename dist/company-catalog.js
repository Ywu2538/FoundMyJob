// Editorial employer collections, reviewed 2026-10-16. See docs/OVERSEAS_COMPANIES.md.
export const CATALOG_DATE='2026-10-16';
export const FORTUNE_YEAR=2026;
export const FORTUNE_URL='https://www.caifuzhongwen.com/fortune500/rankings/global500/2026/';
export const COUNTRIES={ca:['加拿大','Canada'],us:['美国','United States'],jp:['日本','Japan'],gb:['英国','United Kingdom'],fr:['法国','France'],au:['澳大利亚','Australia'],sg:['新加坡','Singapore']};
export const INDUSTRIES={technology:['科技与互联网','Technology & internet'],automotive:['汽车与出行','Automotive'],energy:['能源','Energy'],retail:['零售与消费','Retail & consumer'],health:['医疗与医药','Healthcare'],insurance:['保险与综合金融','Insurance & financial services'],industrial:['工业与航空航天','Industrial & aerospace'],telecom:['电信','Telecommunications'],transport:['运输与物流','Transport & logistics'],materials:['材料与化工','Materials & chemicals']};
const sectorRows={
 technology:[
 ['apple','Apple','https://jobs.apple.com/'],
 ['google','Google / Alphabet','https://www.google.com/about/careers/applications/jobs/results/','Google|Alphabet'],
 ['microsoft','Microsoft','https://careers.microsoft.com/'],
 ['samsung','Samsung Electronics','https://research.samsung.com/careers/','Samsung'],
 ['nvidia','NVIDIA','https://www.nvidia.com/en-us/about-nvidia/careers/'],
 ['meta','Meta','https://www.metacareers.com/','Meta Platforms|Facebook'],
 ],
 automotive:[
 ['toyota','Toyota','https://careers.toyota.com/','Toyota Motor'],
 ['volkswagen','Volkswagen','https://jobs.volkswagen-group.com/?locale=en_GB','Volkswagen Group'],
 ['mercedes','Mercedes-Benz','https://jobs.mercedes-benz.com/','Mercedes-Benz Group'],
 ['bmw','BMW','https://www.bmwgroup.jobs/','BMW Group'],
 ['honda','Honda','https://global.honda/jp/jobs/','Honda Motor'],
 ['ford','Ford','https://careers.ford.com/','Ford Motor'],
 ],
 energy:[
 ['exxon','ExxonMobil','https://jobs.exxonmobil.com/'],
 ['shell','Shell','https://www.shell.com/careers.html'],
 ['bp','BP','https://www.bp.com/en/global/corporate/careers.html'],
 ['chevron','Chevron','https://careers.chevron.com/'],
 ['totalenergies','TotalEnergies','https://careers.totalenergies.com/'],
 ['equinor','Equinor','https://www.equinor.com/careers'],
 ],
 retail:[
 ['amazon','Amazon','https://www.amazon.jobs/','Amazon.com'],
 ['walmart','Walmart','https://careers.walmart.com/'],
 ['costco','Costco','https://careers.costco.com/','Costco Wholesale'],
 ['homedepot','The Home Depot','https://careers.homedepot.com/','Home Depot'],
 ['carrefour','Carrefour','https://www.carrefour.com/en/group/careers'],
 ['tesco','Tesco','https://www.tesco-careers.com/'],
 ],
 health:[
 ['unitedhealth','UnitedHealth Group','https://careers.unitedhealthgroup.com/','UnitedHealth|Optum'],
 ['cvs','CVS Health','https://jobs.cvshealth.com/'],
 ['mckesson','McKesson','https://careers.mckesson.com/'],
 ['cencora','Cencora','https://careers.cencora.com/'],
 ['jnj','Johnson & Johnson','https://www.careers.jnj.com/','J&J'],
 ['roche','Roche','https://careers.roche.com/','Roche Group'],
 ],
 insurance:[
 ['berkshire','Berkshire Hathaway','https://www.berkshirehathaway.com/jobs.html'],
 ['allianz','Allianz','https://careers.allianz.com/'],
 ['axa','AXA','https://careers.axa.com/'],
 ['zurich','Zurich Insurance','https://www.careers.zurich.com/','Zurich Insurance Group'],
 ['metlife','MetLife','https://www.metlifecareers.com/'],
 ['prudential','Prudential Financial','https://jobs.prudential.com/'],
 ],
 industrial:[
 ['siemens','Siemens','https://jobs.siemens.com/'],
 ['ge','GE Aerospace','https://careers.geaerospace.com/'],
 ['boeing','Boeing','https://jobs.boeing.com/'],
 ['airbus','Airbus','https://www.airbus.com/en/careers'],
 ['hitachi','Hitachi','https://careers.hitachi.com/'],
 ['caterpillar','Caterpillar','https://careers.caterpillar.com/'],
 ],
 telecom:[
 ['att','AT&T','https://www.att.jobs/'],
 ['verizon','Verizon','https://mycareer.verizon.com/','Verizon Communications'],
 ['telekom','Deutsche Telekom','https://www.telekom.com/en/careers'],
 ['ntt','NTT','https://group.ntt/en/careers/','Nippon Telegraph and Telephone'],
 ['kddi','KDDI','https://career.kddi.com/'],
 ['orange','Orange','https://orange.jobs/'],
 ],
 transport:[
 ['dhl','DHL Group','https://careers.dhl.com/','DHL'],
 ['ups','UPS','https://www.jobs-ups.com/','United Parcel Service'],
 ['fedex','FedEx','https://careers.fedex.com/'],
 ['maersk','Maersk','https://www.maersk.com/careers','A.P. Moller - Maersk|Maersk Group'],
 ['delta','Delta Air Lines','https://www.delta.com/content/www/us/en/careers/overview.html','Delta'],
 ['united','United Airlines','https://careers.united.com/','United Airlines Holdings'],
 ],
 materials:[
 ['basf','BASF','https://www.basf.com/global/en/careers'],
 ['dow','Dow','https://corporate.dow.com/en-us/careers.html'],
 ['bhp','BHP','https://careers.bhp.com/','BHP Group'],
 ['riotinto','Rio Tinto','https://www.riotinto.com/en/careers','Rio Tinto Group'],
 ['arcelor','ArcelorMittal','https://corporate.arcelormittal.com/careers'],
 ['saintgobain','Saint-Gobain','https://joinus.saint-gobain.com/'],
 ],
};
// Five editorial career picks in each market, not an objective popularity/asset ranking.
const investmentRows={
 ca:[['cpp','CPP Investments','https://www.cppinvestments.com/careers/'],['brookfield','Brookfield','https://www.brookfield.com/careers'],['otpp',"Ontario Teachers’ Pension Plan",'https://www.otpp.com/en-ca/careers/'],['cdpq','La Caisse / CDPQ','https://www.lacaisse.com/en/careers','CDPQ|La Caisse'],['onex','Onex','https://www.onex.com/careers']],
 us:[['goldmansachs','Goldman Sachs','https://www.goldmansachs.com/careers'],['morganstanley','Morgan Stanley','https://www.morganstanley.com/people-opportunities'],['blackstone','Blackstone','https://www.blackstone.com/careers/'],['kkr','KKR','https://www.kkr.com/careers'],['blackrock','BlackRock','https://careers.blackrock.com/']],
 jp:[['nomura','Nomura','https://www.nomura.com/careers/'],['daiwa','Daiwa Securities','https://www.daiwa-grp.jp/recruit/'],['sbi','SBI Holdings','https://www.sbigroup.co.jp/english/careers/'],['jafco','JAFCO','https://www.jafco.co.jp/english/recruit/'],['advantage','Advantage Partners','https://www.advantagepartners.com/en/recruiting/']],
 gb:[['schroders','Schroders','https://www.schroders.com/en/global/individual/careers/'],['man','Man Group','https://www.man.com/careers'],['3i','3i','https://www.3i.com/careers/'],['cvc','CVC','https://www.cvc.com/about/working-at-cvc/'],['bridgepoint','Bridgepoint','https://www.bridgepointgroup.com/careers']],
 fr:[['ardian','Ardian','https://www.ardian.com/join-us'],['eurazeo','Eurazeo','https://www.eurazeo.com/en/talents'],['tikehau','Tikehau Capital','https://www.tikehaucapital.com/en/careers'],['natixisim','Natixis Investment Managers','https://www.im.natixis.com/en-intl/about/open-positions'],['amundi','Amundi','https://about.amundi.com/join-us']],
 au:[['macquarie','Macquarie','https://www.macquarie.com/au/en/careers.html'],['ifm','IFM Investors','https://www.ifminvestors.com/about-us/careers-at-ifm/'],['qic','QIC','https://www.qic.com/about-us/careers'],['australiansuper','AustralianSuper','https://www.australiansuper.com/careers'],['barrenjoey','Barrenjoey','https://barrenjoey.com/careers/']],
 sg:[['gic','GIC','https://careers.gic.com.sg/'],['temasek','Temasek','https://www.temasek.com.sg/en/people/careers'],['keppel','Keppel','https://www.keppel.com/careers'],['capitaland','CapitaLand Investment','https://www.capitaland.com/en/about-capitaland/careers.html'],['fullerton','Fullerton Fund Management','https://www.fullertonfund.com/about-fullerton/careers/']],
};
const bankRows={
 ca:[['rbc','RBC','https://jobs.rbc.com/','Royal Bank of Canada'],['td','TD Bank','https://careers.td.com/','TD|Toronto-Dominion Bank'],['scotiabank','Scotiabank','https://jobs.scotiabank.com/'],['bmo','BMO','https://jobs.bmo.com/','Bank of Montreal'],['cibc','CIBC','https://www.cibc.com/en/about-cibc/careers.html']],
 us:[['jpmorgan','JPMorgan Chase','https://careers.jpmorgan.com/','J.P. Morgan|JPMorgan|JPMorgan Chase & Co.'],['bofa','Bank of America','https://careers.bankofamerica.com/'],['citi','Citi','https://jobs.citi.com/','Citigroup|Citibank'],['wellsfargo','Wells Fargo','https://www.wellsfargojobs.com/'],['goldmansachs','Goldman Sachs','https://www.goldmansachs.com/careers']],
 jp:[['mufg','MUFG','https://www.mufg.jp/english/careers/','Mitsubishi UFJ Financial Group'],['smbc','SMBC','https://www.smfg.co.jp/recruit/','Sumitomo Mitsui Financial Group'],['mizuho','Mizuho','https://www.mizuhogroup.com/careers','Mizuho Financial Group'],['japanpostbank','Japan Post Bank','https://www.jp-bank.japanpost.jp/recruit/'],['resona','Resona','https://www.resona-saiyo.com/index.html']],
 gb:[['hsbc','HSBC','https://www.hsbc.com/careers'],['barclays','Barclays','https://search.jobs.barclays/'],['lloyds','Lloyds Banking Group','https://www.lloydsbankinggroup.com/careers.html'],['natwest','NatWest Group','https://jobs.natwestgroup.com/'],['standardchartered','Standard Chartered','https://www.sc.com/en/global-careers/']],
 fr:[['bnpparibas','BNP Paribas','https://group.bnpparibas/en/careers'],['creditagricole','Crédit Agricole','https://www.credit-agricole.com/candidat','Credit Agricole'],['socgen','Société Générale','https://careers.societegenerale.com/en','Societe Generale'],['bpce','Groupe BPCE','https://recrutement.bpce.fr/','BPCE'],['creditmutuel','Crédit Mutuel','https://www.creditmutuel.com/fr/travailler-pour-un-employeur-different-ca-change-tout-filiale-assurance.html','Credit Mutuel']],
 au:[['cba','Commonwealth Bank','https://www.commbank.com.au/about-us/careers.html','Commonwealth Bank of Australia'],['nab','NAB','https://careers.nab.com.au/','National Australia Bank'],['westpac','Westpac','https://www.westpac.com.au/about-westpac/careers/'],['anz','ANZ','https://careers.anz.com/'],['macquarie','Macquarie','https://www.macquarie.com/au/en/careers.html']],
 sg:[['dbs','DBS','https://www.dbs.com/careers/','DBS Bank'],['ocbc','OCBC','https://www.ocbc.com/group/careers/','OCBC Bank'],['uob','UOB','https://www.uobgroup.com/careers/index.page','United Overseas Bank'],['hsbc','HSBC','https://www.hsbc.com/careers'],['citi','Citi','https://jobs.citi.com/','Citigroup|Citibank']],
};
const catalog=new Map();
function add(row,collection){
 const [slug,company,careersUrl,aliases='']=row;
 const previous=catalog.get(slug);
 if(previous){previous.collections.push(collection);return;}
 catalog.set(slug,{slug,company,careersUrl,aliases:aliases.split('|').filter(Boolean),collections:[collection],directoryScope:'overseas'});
}
for(const [industry,rows] of Object.entries(sectorRows))for(const row of rows)add(row,{kind:'global500',industry,year:FORTUNE_YEAR});
for(const [country,rows] of Object.entries(investmentRows))rows.forEach((row,index)=>add(row,{kind:'investment',country,order:index+1}));
for(const [country,rows] of Object.entries(bankRows))rows.forEach((row,index)=>add(row,{kind:'bank',country,order:index+1}));
for(const row of [['figma','Figma','https://www.figma.com/careers/'],['imc','IMC','https://job-boards.greenhouse.io/imc'],['towerresearchcapital','Tower Research Capital','https://tower-research.com/open-positions/']]){
 add(row,{kind:'additional'});catalog.get(row[0]).id=`greenhouse:${row[0]}`;
}
export const OVERSEAS_COMPANIES=[...catalog.values()];
export const companyKey=name=>String(name||'').trim().toLowerCase();
export const companyNames=company=>[company.company,...(company.aliases||[])];
export const matchesCompany=(company,name)=>companyNames(company).some(alias=>companyKey(alias)===companyKey(name));
export function inCollection(company,{country='',category=''}={}){
 return (company.collections?.length?company.collections:[{kind:'additional'}]).some(collection=>(!category||category===collection.kind||category===collection.industry)&&(!country||!collection.country||collection.country===country));
}
export function companyCareersLink(company,country=''){
 // Only confirmed country filters are constructed. Other official sites stay at their verified root.
 const countryName=COUNTRIES[country]?.[1];
 if(!countryName)return {url:company.careersUrl,countryFiltered:false};
 if(company.slug==='google')return {url:`https://www.google.com/about/careers/applications/jobs/results/?location=${encodeURIComponent(countryName)}`,countryFiltered:true};
 if(company.slug==='amazon')return {url:`https://www.amazon.jobs/en/search?country=${{ca:'CAN',us:'USA',jp:'JPN',gb:'GBR',fr:'FRA',au:'AUS',sg:'SGP'}[country]}&loc_query=${encodeURIComponent(countryName)}`,countryFiltered:true};
 return {url:company.countryCareersUrls?.[country]||company.careersUrl,countryFiltered:!!company.countryCareersUrls?.[country]};
}
