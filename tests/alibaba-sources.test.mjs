import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchExtendedJobs} from '../server/alibaba-sources.mjs';

const json = data => new Response(JSON.stringify(data), {headers: {'content-type': 'application/json'}});
const row = (id, name = '阿里云-研发工程师') => ({id, name, description: '开发可靠的软件系统', requirement: '掌握 Java', workLocations: ['杭州']});
function aliFetcher(data, inspect = () => {}) {
  return async (url, options) => {
    inspect(url, options);
    if (url === 'https://talent.alibaba.com/') return new Response('window.__sysconfig = {__token__: "public-csrf"}', {headers: {'set-cookie': 'JSESSIONID=anonymous; Secure; HttpOnly'}});
    return json({success: true, content: {datas: data, totalCount: data.length}});
  };
}

test('unsupported source returns null without fetching', async () => {
  assert.equal(await fetchExtendedJobs({slug: 'unknown'}, {fetcher: () => assert.fail('unexpected network')}), null);
});

test('Alibaba uses fixed endpoints and its public CSRF session; subsidiaries do not duplicate', async () => {
  const urls = [];
  const result = await fetchExtendedJobs({slug: 'alibaba', company: 'spoof', careersUrl: 'https://evil.example'}, {
    fetcher: aliFetcher([row(1), row(2, '飞猪-产品经理'), row(3, '淘宝闪购-运营专家')], (url, options) => {
      urls.push(url);
      if (options.method === 'POST') {
        assert.equal(options.headers.Cookie, 'JSESSIONID=anonymous');
        assert.equal(JSON.parse(options.body).pageIndex, 1);
      }
    })});
  assert.deepEqual(urls, ['https://talent.alibaba.com/', 'https://talent.alibaba.com/position/search?_csrf=public-csrf']);
  assert.equal(result.jobs.length, 1);
  assert.equal(result.jobs[0].company, '阿里巴巴集团');
  assert.equal(result.jobs[0].companyId, 'alibaba');
  assert.equal(result.jobs[0].verificationStatus, 'official');
  assert.equal(result.jobs[0].descriptionKind, 'full');
  assert.equal(result.complete, true);
});

test('Fliggy verifies business ownership rather than importing incidental keyword mentions', async () => {
  const unrelated = {...row(2), description: '与飞猪协作开发项目'};
  const result = await fetchExtendedJobs({slug: 'fliggy'}, {fetcher: aliFetcher([row(1, '飞猪-研发工程师'), unrelated])});
  assert.deepEqual(result.jobs.map(j => j.id), ['official:fliggy:1']);
  assert.equal(result.complete, false);
  assert.equal(result.total, 2);
});

test('Ant paginates on its published API host and deduplicates overlapping results', async () => {
  let calls = 0;
  const result = await fetchExtendedJobs({slug: 'ant'}, {fetcher: async (url, options) => {
    assert.equal(url, 'https://hrcareersweb.antgroup.com/api/social/position/search');
    const body = JSON.parse(options.body);
    assert.equal(body.pageSize, 20);
    assert.equal(body.pageIndex, ++calls);
    return json({success: true, totalCount: 4, content: calls === 1 ? [row(1), row(2)] : [row(2), row(3)]});
  }});
  assert.equal(calls, 2);
  assert.equal(result.jobs.length, 3);
  assert.equal(result.complete, false);
  assert.match(result.note, /重叠/);
});

test('failed or repeated pages throw so callers retain previously synced jobs', async () => {
  await assert.rejects(fetchExtendedJobs({slug: 'ant'}, {fetcher: async () => json({success: false, errorCode: 'invalid_parameter'})}), /已保留/);
  await assert.rejects(fetchExtendedJobs({slug: 'ant'}, {fetcher: async () => json({success: true, totalCount: 3, content: [row(1)]})}), /重复返回同一页/);
  await assert.rejects(fetchExtendedJobs({slug: 'vivo'}, {fetcher: async () => json({code: 0, data: [], meta: {total: 10}})}), /已保留/);
});

test('vivo preserves full official descriptions and the actual job detail query key', async () => {
  const result = await fetchExtendedJobs({slug: 'vivo'}, {fetcher: async (url, options) => {
    assert.equal(url, 'https://hr.vivo.com/api/social/webSite/portal/page');
    assert.equal(JSON.parse(options.body).user_id, null);
    return json({code: 0, data: [{job_id: 'M123', job_title: '显示算法工程师', job_desc: '开发显示算法。要求掌握 C++。', job_location_list: [{city: '上海'}, {city: '上海'}]}], meta: {total: 1}});
  }});
  assert.equal(result.jobs[0].url, 'https://hr.vivo.com/job-detail?_irjid=M123');
  assert.equal(result.jobs[0].location, '上海');
  assert.equal(result.complete, true);
});

test('Huawei distinguishes campus summaries from social descriptions and preserves official detail IDs', async () => {
  const types = [];
  const result = await fetchExtendedJobs({slug: 'huawei'}, {fetcher: async (url, options) => {
    assert.equal(new URL(url).hostname, 'apigw-dgg-b0.huawei.com');
    assert.equal(options.headers.Referer, 'https://career.huawei.com/');
    const body = JSON.parse(options.body); types.push(body.jobType);
    return json({status: 'SUCCESS', data: {pageVO: {totalRows: 1}, result: [{advertisementId: body.jobType, jobName: '软件工程师', workPlace: '北京',
      mainBusiness: body.jobType === 'CR' ? '请您详见岗位意向中的岗位职责' : '开发操作系统', jobRequire: '熟悉 C++'}]}});
  }});
  assert.deepEqual(types, ['SR', 'CR']);
  assert.deepEqual(result.jobs.map(j => [j.track, j.descriptionKind]), [['experienced', 'full'], ['campus', 'summary']]);
  assert.equal(result.jobs[0].url, 'https://career.huawei.com/cn/job-details?advertisementId=SR');
  assert.equal(result.complete, true);
});

test('Huawei skips a real malformed nameless listing without clearing old jobs or losing valid rows', async () => {
  const result = await fetchExtendedJobs({slug: 'huawei'}, {fetcher: async (url, options) => {
    const type = JSON.parse(options.body).jobType;
    return json({status: 'SUCCESS', data: {pageVO: {totalRows: type === 'SR' ? 2 : 0}, result: type === 'SR' ? [
      {advertisementId: 1, jobName: '研发工程师', mainBusiness: '开发软件系统', jobRequire: '熟悉 C++'},
      {advertisementId: 2, jobName: null, mainBusiness: '执行测试'}] : []}});
  }});
  assert.equal(result.jobs.length, 1);
  assert.equal(result.total, 2);
  assert.equal(result.complete, false);
  assert.match(result.note, /1 条缺失名称/);
});
