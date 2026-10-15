import {cleanText, normalizeJob, readJson} from './jobs.mjs';
import {officialSource} from './company-sources.mjs';

const supported = new Set(['alibaba', 'eleme', 'fliggy', 'ant', 'vivo', 'huawei']);
const invalid = () => { throw new Error('官网职位数据格式改变，已保留上次岗位。'); };
function count(value) {
  if (!['string', 'number'].includes(typeof value) || value === '' || !Number.isSafeInteger(Number(value)) || Number(value) < 0 || Number(value) > 30000) invalid();
  return Number(value);
}
function normalize(source, {id, title, location, description, url, updatedAt, summary = false}) {
  if (id == null || !String(id) || !cleanText(title) || !cleanText(description)) invalid();
  return {...normalizeJob({id, title, location, description, url, updated_at: updatedAt}, source),
    companyId: source.slug, sourceKind: 'synced', verificationStatus: 'official',
    descriptionKind: summary ? 'summary' : 'full', track: /实习|校招|应届/.test(title) ? 'campus' : 'experienced'};
}
// Match an explicit company name in the position title/organization, never a
// mention buried in the duties (e.g. a group role working with Fliggy).
function subsidiary(row) {
  const label = [row.name, row.department, ...(row.circleNames || [])].filter(Boolean).join(' ');
  if (/(?:^|\s|[-—_·|/])(?:飞猪|Fliggy)(?:[-—_·|/\s]|$)/i.test(label)) return 'fliggy';
  if (/(?:^|\s|[-—_·|/])(?:淘宝闪购|饿了么|Ele\.me)(?:[-—_·|/\s]|$)/i.test(label)) return 'eleme';
  return null;
}

export async function fetchExtendedJobs(input, {fetcher = fetch} = {}) {
  if (!supported.has(input.slug)) return null;
  // Caller-supplied URLs/company names never determine a network destination.
  const source = officialSource(input.slug);
  const overall = AbortSignal.timeout(180000);
  const request = (url, options = {}) => fetcher(url, {...options,
    signal: AbortSignal.any([overall, AbortSignal.timeout(18000)]), redirect: 'error'});
  const json = async (url, body, headers = {}) => readJson(await request(url, {
    method: 'POST', headers: {'Content-Type': 'application/json', ...headers}, body: JSON.stringify(body)}));

  if (source.slug === 'huawei') {
    // Public gateway and application ID are published by career.huawei.com's
    // current common.js. The Referer is required by that public gateway.
    const rows = []; let total = 0, complete = true, skipped = 0;
    for (const type of ['SR', 'CR']) {
      const branch = [], pages = new Set(); let expected, fetched = 0;
      for (let page = 1; page <= 300; page++) {
        const data = await json('https://apigw-dgg-b0.huawei.com/api/apig/channelhw/recruitmentPosition/pub/getJobPage?X-HW-ID=app_000000035886',
          {curPage: page, pageSize: 100, jobType: type}, {
            'x-jalor-tenantAlias': 'hcm', 'x-language': 'zh_CN', 'x-Referer': 'https://career.huawei.com/cn',
            'x-alb-gray': 'prod', Referer: 'https://career.huawei.com/', Origin: 'https://career.huawei.com'});
        if (data.status !== 'SUCCESS' || !Array.isArray(data.data?.result)) invalid();
        expected ??= count(data.data.pageVO?.totalRows);
        const batch = data.data.result, signature = batch.map(r => r.advertisementId).join(',');
        if (pages.has(signature)) throw new Error('华为官网重复返回同一页，已保留上次岗位。');
        pages.add(signature); fetched += batch.length;
        // The live list occasionally contains a position with a null title.
        // Do not invent one or reject the remaining valid public positions.
        const valid = batch.filter(r => r.advertisementId != null && cleanText(r.jobName));
        skipped += batch.length - valid.length;
        branch.push(...valid.map(r => ({...normalize(source, {id: r.advertisementId, title: r.jobName,
          location: r.workPlace, description: [r.deptName ? `招聘部门：${r.deptName}` : '', r.mainBusiness, r.jobRequire].filter(Boolean).join('\n\n'),
          url: `https://career.huawei.com/cn/job-details?advertisementId=${encodeURIComponent(r.advertisementId)}`,
          updatedAt: r.lastUpdateDate || null,
          summary: !r.mainBusiness || !r.jobRequire || /详见岗位意向/.test(`${r.mainBusiness}${r.jobRequire}`)}),
          track: type === 'CR' ? 'campus' : 'experienced'})));
        if (fetched >= expected) break;
        if (!batch.length || page === 300) invalid();
      }
      if (new Set(branch.map(r => r.id)).size !== expected) complete = false;
      total += expected; rows.push(...branch);
    }
    const jobs = [...new Map(rows.map(j => [j.id, j])).values()];
    return {jobs, total, complete: complete && jobs.length === total,
      note: '已读取华为官网社会招聘与校园招聘公开列表；官网仅给出岗位意向提示的校招职位标记为摘要，请在原文查看具体方向要求。' +
        (skipped ? `官网有 ${skipped} 条缺失名称或标识的记录，暂未导入，历史岗位予以保留。` : '')};
  }

  if (source.slug === 'vivo') {
    const rows = [], pages = new Set(); let total;
    for (let page = 1; page <= 300; page++) {
      const data = await json('https://hr.vivo.com/api/social/webSite/portal/page', {
        city_code_list: [], company_id: 1, group_id: 1, user_id: null,
        job_category_id_list: [], keyword: '', max_results: 100, page, yoe_list: []});
      if (data.code !== 0 || !Array.isArray(data.data)) invalid();
      total ??= count(data.meta?.total);
      const signature = data.data.map(r => r.job_id).join(',');
      if (pages.has(signature)) throw new Error('vivo 官网重复返回同一页，已保留上次岗位。');
      pages.add(signature);
      rows.push(...data.data.map(r => normalize(source, {id: r.job_id, title: r.job_title,
        location: [...new Set((r.job_location_list || []).map(l => l.city).filter(Boolean))].join('、'),
        description: r.job_desc, url: `https://hr.vivo.com/job-detail?_irjid=${encodeURIComponent(r.job_id)}`,
        updatedAt: r.publish_timestamp ? new Date(r.publish_timestamp).toISOString() : null})));
      if (rows.length >= total) {
        const jobs = [...new Map(rows.map(j => [j.id, j])).values()];
        return {jobs, total, complete: jobs.length === total,
          note: '已读取 vivo 官网社会招聘公开列表及职位说明。' + (jobs.length === total ? '' : '分页有重叠，已保留历史岗位。')};
      }
      if (!data.data.length) invalid();
    }
    throw new Error('vivo 官网分页超过限制，已保留上次岗位。');
  }

  const isAnt = source.slug === 'ant';
  const host = isAnt ? 'https://hrcareersweb.antgroup.com' : 'https://talent.alibaba.com';
  let endpoint = `${host}/api/social/position/search`, headers = {};
  if (!isAnt) {
    // Use the ordinary public page's CSRF token and anonymous session exactly as
    // its recruiting UI does. No login, CAPTCHA, or anti-bot signature is used.
    const response = await request(`${host}/`);
    if (!response.ok) throw new Error(`阿里招聘官网返回 HTTP ${response.status}，已保留上次岗位。`);
    const html = await response.text();
    if (html.length > 2000000) invalid();
    const token = html.match(/__token__\s*:\s*"([a-zA-Z0-9-]{1,120})"/)?.[1];
    if (!token) invalid();
    const cookies = response.headers.getSetCookie?.() || [];
    const cookie = cookies.map(c => c.split(';', 1)[0]).join('; ');
    headers = {Origin: host, Referer: `${host}/`, ...(cookie ? {Cookie: cookie} : {})};
    endpoint = `${host}/position/search?_csrf=${encodeURIComponent(token)}`;
  }
  const keyword = source.slug === 'fliggy' ? '飞猪' : source.slug === 'eleme' ? '淘宝闪购' : '';
  const rawRows = [], pages = new Set(); let total;
  for (let page = 1; page <= 300; page++) {
    // Ant's public endpoint rejects large page sizes; its UI supports 20.
    const data = await json(endpoint, {channel: 'group_official_site', language: 'zh_CN',
      pageIndex: page, pageSize: isAnt ? 20 : 100, key: keyword, categories: '', regions: '', deptCodes: []}, headers);
    if (data.success !== true) throw new Error(`${source.company}官网暂未返回可用职位（${cleanText(data.errorCode || data.errorMsg || '请求失败')}），已保留上次岗位。`);
    const batch = isAnt ? data.content : data.content?.datas;
    if (!Array.isArray(batch)) invalid();
    total ??= count(isAnt ? data.totalCount : data.content.totalCount);
    const signature = batch.map(r => r.id).join(',');
    if (pages.has(signature)) throw new Error(`${source.company}官网重复返回同一页，已保留上次岗位。`);
    pages.add(signature); rawRows.push(...batch);
    if (rawRows.length >= total) {
      const distinct = [...new Map(rawRows.map(r => [r.id, r])).values()];
      const selected = isAnt ? distinct : distinct.filter(r => source.slug === 'alibaba' ? !subsidiary(r) : subsidiary(r) === source.slug);
      const jobs = selected.map(r => normalize(source, {id: r.id, title: r.name,
        location: r.workLocations?.join('、'),
        description: [r.description, r.requirement].filter(Boolean).join('\n\n任职要求\n'),
        url: isAnt ? `https://talent.antgroup.com/off-campus-position?positionId=${encodeURIComponent(r.id)}` :
          `https://talent.alibaba.com/off-campus/position-detail?positionId=${encodeURIComponent(r.id)}`,
        updatedAt: r.modifyTime || r.publishTime ? new Date(r.modifyTime || r.publishTime).toISOString() : null,
        summary: !r.description || !r.requirement}));
      const complete = distinct.length === total && (isAnt || source.slug === 'alibaba');
      return {jobs, complete, total: source.slug === 'alibaba' ? jobs.length : total,
        note: isAnt ? '已读取蚂蚁招聘官网社会招聘列表及职位说明。' + (complete ? '' : '分页有重叠，已去重并保留未读取的历史岗位。') : source.slug === 'alibaba' ?
          '已读取阿里招聘官网社会招聘列表；飞猪、淘宝闪购岗位归入各自公司，避免重复。' :
          `已从阿里招聘官网按“${keyword}”检索，并核验职位名称/组织归属；这是业务关键词覆盖，可能并非该公司全部岗位。`};
    }
    if (!batch.length) invalid();
  }
  throw new Error(`${source.company}官网分页超过限制，已保留上次岗位。`);
}
