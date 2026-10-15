// Official recruiting sites checked on 2026-10-15. A directory entry is not a job.
// Only adapters that return concrete positions can populate the shared job library.
const companies = [
  ['meituan','美团','https://zhaopin.meituan.com/','meituan'],
  ['alibaba','阿里巴巴集团','https://talent.alibaba.com/', 'extended'],
  ['jd','京东','https://zhaopin.jd.com/','jd'],
  ['huawei','华为','https://career.huawei.com/', 'extended'],
  ['trip','携程','https://careers.ctrip.com/','trip'],
  ['xiaomi','小米集团','https://hr.xiaomi.com/website/opportunities.html','xiaomi'],
  ['ant','蚂蚁集团','https://talent.antgroup.com/', 'extended'],
  ['oppo','OPPO','https://careers.oppo.com/','oppo'],
  ['xiaohongshu','小红书','https://job.xiaohongshu.com/','xiaohongshu'],
  ['bytedance','字节跳动','https://jobs.bytedance.com/experienced/position','feishu'],
  ['vivo','vivo','https://hr.vivo.com/', 'extended'],
  ['didi','滴滴','https://talent.didiglobal.com/social/','didi'],
  ['kuaishou','快手','https://zhaopin.kuaishou.cn/','pending','公开职位请求返回校验错误，暂未自动获取职位。'],
  ['lenovo','联想','https://jobs.lenovo.com/en_US/careers/SearchJobs','lenovo'],
  ['tencent','腾讯','https://careers.tencent.com/','tencent'],
  ['iflytek','科大讯飞','https://iflytek.zhiye.com/', 'enterprise'],
  ['unicom','中国联通','https://zglt.zhaopin.com/scjobs/index.html', 'enterprise'],
  ['mobile','中国移动','https://job.10086.cn/','mobile'],
  ['zte','中兴通讯','https://job.zte.com.cn/', 'moka'],
  ['eleme','淘宝闪购','https://talent.ele.me/', 'extended'],
  ['nio','蔚来','https://nio.jobs.feishu.cn/','feishu'],
  ['li','理想汽车','https://li.jobs.feishu.cn/','feishu'],
  ['duxiaoman','度小满','https://campus.duxiaoman.com/051736','feishu'],
  ['ireader','掌阅科技','https://q7w8vltyes.jobs.feishu.cn/','feishu'],
  ['fliggy','飞猪','https://talent.alibaba.com/', 'extended'],
  ['baidu','百度','https://talent.baidu.com/jobs/social-list','baidu'],
  ['qunar','去哪儿旅行','https://hf7l9aiqzx.jobs.feishu.cn/704852','feishu'],
  ['wanmei','完美世界','https://jobs.games.wanmei.com/', 'moka'],
  ['tal','好未来','https://job.tal.com/campus/positions','tal'],
  ['sangfor','深信服','https://hr.sangfor.com/', 'enterprise'],
  ['4399','4399游戏','https://u.4399.com/hr/zhaopin','4399'],
  ['yonyou','用友','https://career.yonyou.com/', 'enterprise'],
  ['ccbft','建信金科','https://job.ccb.com/cn/job/job_list.html?orgId=8ba3bc9962e2c55501636c1220b10648','bank'],
  ['bocom','交银金科','https://www.bocomfintech.com.cn/','pending','官网连接超时；旧招聘专题的申请链接已跳转下载页，无法核验当前在招状态，暂未导入。'],
  ['qianxin','奇安信','https://campus.qianxin.com/','qianxin'],
  ['fulltruck','满帮集团','https://jobs.fulltruckalliance.com/social-recruitment/manbang/46269/', 'moka'],
];
export const COMPANY_SOURCES = companies.map(([slug,company,careersUrl,adapter,note])=>({
  id:`official:${slug}`,provider:'official',slug,company,careersUrl,adapter,note:note||'',featured:true,
}));
export function officialSource(slug) {
  const source=COMPANY_SOURCES.find(s=>s.slug===slug);
  if(!source)throw new Error('未知的官方招聘源。');
  return source;
}
