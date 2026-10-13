# FoundMyJob

面向校招和社招的求职助手 **交互 Demo**。覆盖中国与北美示例岗位、基于档案的匹配、简历整理与审核、导出、投递跟踪、积分套餐和模拟充值。

## 运行

需要 Node.js 22 或以上，无需安装依赖。

```sh
npm start
```

打开 http://127.0.0.1:4173。前端是 `dist/` 中的原生 HTML、CSS、JavaScript，也可直接部署到静态托管服务。需要通过 HTTP 访问，不能用 `file://` 打开 ES modules。

```sh
npm run check
npm test
```

## 演示路线

1. **个人档案**：编辑姓名、校招／社招、技能、教育、经历和项目；支持导入 TXT / Markdown 经历文本。
2. **发现岗位**：按中国／北美、招聘类型、办公方式筛选；搜索关键词并收藏岗位。匹配度会随档案变化。
3. **岗位详情**：查看匹配依据与技能缺口，选择语言并生成简历，扣除 20 演示积分。
4. **简历工作室**：编辑内容、核实事实、确认审核；导出 Markdown 或通过浏览器打印为 PDF。
5. **投递追踪**：添加投递计划，手动更新进度。标记已投递／面试中前需有该岗位的已审核简历。
6. **积分与套餐**：体验套餐选择、模拟充值和扣费记录。初始赠送 200 演示积分。
7. **设置**：调整语言、导出和恢复 JSON 备份、重置演示。

## Demo 边界

- 所有职位、薪资、招聘要求与预填经历均为演示编写，**非实时招聘**。公司链接仅指向招聘官网，不代表相应职位真实存在。
- 简历生成是确定性规则整理：保留真实输入，优先排列重合技能，并显示缺口。**未调用 AI，不消耗 Cursor Pro 额度**。
- 英文选项仅切换栏目标题，保留原始经历语言；没有伪装成 AI 翻译。
- 积分、价格、充值、扣费都是模拟，不接收真实付款。产品积分不与模型 token 一比一兑换。
- 浏览器 localStorage 仅适合演示，可被修改，**不能作为真实支付或计费账本**。不同浏览器数据隔离，不存在真实注册登录。
- 产品不自动发送申请。用户自行导出并访问招聘官网投递。

## 可选 Cursor 本地桥接

`server/cursor.mjs` 保留官方 CLI 的 `--print --mode ask --output-format json` 适配器。当前机器未安装 Agent CLI，适配器只经过模拟 CLI 协议测试，尚未通过真实 Cursor 账号联调。编辑器 `cursor` 命令不能替代 `agent` CLI。

参阅 [Cursor CLI 安装](https://cursor.com/docs/cli/installation)、[登录](https://cursor.com/docs/cli/reference/authentication)、[参数](https://cursor.com/docs/cli/reference/parameters) 与 [权限](https://cursor.com/docs/cli/reference/permissions)。安装官方 CLI 后运行 `agent login`，再运行 `agent status` 验证账号。

本地内测时可显式设置环境变量：

```powershell
$env:ENABLE_CURSOR = 'true'
$env:CURSOR_CLI_PATH = 'C:\path\to\agent.exe'
$env:CURSOR_MODEL = 'auto'
npm start
```

不要把密钥写入前端或 Git。此桥接只监听 `127.0.0.1`，校验 Host、Origin 和本地请求 token，限制并发、输入长度及执行时间。生成请求需显式 `consent: true`；使用 shell=false 参数数组，在临时目录写入禁用 shell、文件读写、WebFetch 与 MCP 的权限配置。没有使用 `--force`。临时目录仅包含权限配置，不写入用户档案。

`GET /api/cursor/status` 在启用且 CLI 状态命令可运行时返回本地 token。`POST /api/cursor/generate` 需要 `X-FMJ-Token`、JSON 字段 `profile`、`job`、`language` 和 `consent: true`。返回 `{ content, notes, mode, status }`。**Demo 前端没有连接这个生成端点**，避免展示时意外消耗账号额度。CLI 权限不是多租户安全沙箱，此桥接仅供本人可信环境内测，不应公开暴露。

## 正式产品下一步

- 注册登录、数据库、个人资料与简历版本管理、用户隔离。
- 中国与北美真实岗位源及数据使用授权；优先公司公开招聘接口和用户导入的岗位。
- 可替换模型提供商，真实生成质量验证与事实核对；另行验证商业服务所需的提供商许可及计费安排。
- 服务端积分余额及不可变账本、支付回调签名、幂等处理、原子扣费、退款及额度限制。价格以真实推理成本测试结果确定。
- 数据导出、删除及保留期限，生产监控与访问控制。

## 目录

```text
dist/          可静态部署的完整 Demo
server/        零依赖本地服务与可选 Cursor 适配器
tests/         匹配、积分、审核、输出安全、HTTP 与 CLI 协议测试
```
