# FoundMyJob

面向校招与社招的本地求职助手：真实岗位同步、个人档案、AI 简历生成与审核、导出以及投递跟踪。使用 Node.js 原生 HTTP + SQLite，无需安装 npm 依赖。

## 本地运行

推荐 **Node.js 24 LTS**，最低 22.13（需支持 `node:sqlite`）。

```sh
npm start
```

Windows 可双击 `Start-FoundMyJob.cmd`。它会独立在后台启动服务并打开 <http://127.0.0.1:4173>；关闭启动窗口或浏览器不会停止服务。重复双击会复用已有服务。需要停止时双击 `Stop-FoundMyJob.cmd`；有简历正在生成时会提示先等待完成。电脑重启后再次双击启动即可，不修改系统开机启动项。

`npm start` 仍是前台运行方式，需要保留终端，Ctrl+C 停止。后台日志在 `.runtime/background-server.log`。SQLite 在部分 Node 版本显示 ExperimentalWarning，不影响当前运行。

本版本需要后端，不能只把 `dist/` 上传到静态托管。仅监听 `127.0.0.1`，用于**单用户本机**；不支持公开暴露、反向代理或多人共享实例。

## 使用流程

1. 在「个人档案」填写真实教育、技能、工作或项目经历。支持导入 TXT / Markdown 文本。
2. 点击「同步真实岗位」，从企业公开招聘板获取岗位；支持添加 Greenhouse / Lever 招聘板。也可以粘贴真实 JD 和原文链接手动导入。
3. 在「AI 与数据设置」选择本机 Cursor，或自带 Key 的厂商与模型。
4. 在岗位详情确认数据发送与额度使用，生成中文或英文简历。任务状态保存在「生成记录」，刷新不丢任务。
5. 编辑简历、逐项审核，然后导出 Markdown 或通过打印另存为 PDF。内容变化会使审核状态失效。
6. 自行到企业原文投递，在投递追踪中记录进度；后端要求该岗位有已审核简历才能标记已投递／面试中。

没有示例经历自动混入新数据库；旧 Demo 的浏览器记录可在设置中单独导出。

## 本机 Cursor

使用你自己的 Cursor CLI 登录，不需要 OpenAI API Key。订阅额度与 CLI 可用模型以 Cursor 账户为准。

1. 安装 [官方 Cursor CLI](https://cursor.com/docs/cli/installation)，或在 Windows 双击本项目 `Install-Cursor.cmd` 安装到被 Git 忽略的 `.runtime/cursor-cli/`。
2. 双击 `Login-Cursor.cmd`（或 `npm run cursor:login`）完成官方登录。
3. 复制 `.env.example` 为 `.env.local`，将 `FMJ_ALLOW_CURSOR=0` 改为 `FMJ_ALLOW_CURSOR=1`。重启服务，在设置中检查登录。

GitHub 默认关闭 Cursor 权限。`.env.local`、CLI、登录信息均不上传；其他人克隆仓库后需要在自己的电脑登录自己的 Cursor。

可用 `CURSOR_CLI_PATH` 指定**原生可执行文件**路径；不接受 `.cmd` / `.bat` / `.ps1` 作为生成命令。项目安装器会使用官方包中的 Node + index.js，以参数数组启动，不经 shell 拼接用户内容。

生成使用 `--print --mode ask --output-format json`。每次创建独立临时工作目录，配置禁止文件读写、Shell、WebFetch、MCP；提示词要求只使用档案事实。仍须人工核实模型生成的全部内容。

## 自带 API Key 与免费模型

- 接口：DeepSeek、SiliconFlow、OpenRouter、Groq，固定官方 API 地址，避免把 Key 发到自定义未知端点。
- 用户在设置输入自己的 Key；只保存在**当前本机后端进程内存**，不写数据库、localStorage、导出或日志，重启后需重新输入。浏览器不通过接口读回完整 Key。
- 点击加载模型，从厂商获取最新列表。不会自动换厂商、模型或改用平台 Key。
- OpenRouter 可筛选实时价格中输入和输出均为零的模型；免费模式每次调用前重新核对价格，不满足就停止。仍受厂商速率、账户和服务可用性限制。
- SiliconFlow / Groq 有免费模型或 Free 账户方案，但列表不提供足够计费信息时不伪称当前账号一定免费。请使用页面上的官方价格与限额链接核实。
- API 适配器不读取开发者个人环境变量里的 Key，不内置任何共享 Key。

实际数据会发给你选择的厂商；生成前显示服务和模型并要求确认。失败不会悄悄回退到规则版或付费模型。

## 平台积分与未来商业版

**平台积分入口被后端拒绝，暂不收款、不代付。** 客户端伪造余额或开启开关无法解锁。当前版本没有多用户注册和真实支付。

多人在线版需要独立实现用户认证、每个用户的加密凭证存储、支付回调验签和幂等、服务端额度预留／结算／退款账本及审计。平台服务不能挂载个人 Cursor 登录。届时数据库建议 PostgreSQL，按实际语义检索需求再加 pgvector；当前 SQLite 不需要向量库。

## 岗位数据范围

默认接入 Figma、IMC、Tower Research Capital 的公开 Greenhouse 招聘板。接口空列表表示该板当前无数据，失败保留上次成功结果。可以在设置添加其他 Greenhouse / Lever 企业板，单次同步有频率限制。

招聘状态、薪资、年限、资格以原文为准。招聘类型只对标题明确标示实习／应届或资深级别的岗位推断，其余标「未注明」；技能与地区提取是启发式匹配，并非 AI 筛选结论。匹配度不代表录用概率。国内岗位不是全网覆盖，未接入网站支持手动导入 JD，不绕过登录或验证码。

参考：[Greenhouse Job Board API](https://docs.greenhouse.io/job-board.html)、[Lever Postings API](https://github.com/lever/postings-api)、[OpenRouter 模型列表](https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties)。

## 数据库与备份

本机文件 `.runtime/foundmyjob.sqlite`，采用 WAL、外键、事务和版本冲突检查。表包括 config（档案与非敏感设置）、sources、jobs、saved、resumes、resume_versions、applications、tasks。

关闭服务后复制数据库文件做完整备份；运行中的数据库请勿仅复制主文件而忽略 WAL。恢复时关闭服务，再用备份替换主文件。页面的 JSON 导出用于查阅／迁移，当前没有 JSON 自动恢复接口。Git 忽略整个 `.runtime/`、`.env*`（除模板）、SQLite 文件及 `.cursor/`。

此版本不提供磁盘加密；数据库属于你的本地个人文件，包含经历和联系方式。不要把运行目录或整盘压缩包当作源代码分享。

## API 与验证

- `GET /api/state`：读取本机数据和本地会话令牌，不含 Key。
- `POST /api/profile`、`/api/settings`：保存，带 revision 防覆盖。
- `POST /api/credentials`：设置／清除内存中的个人 Key。
- `GET /api/models?provider=...`：加载对应厂商模型。
- `POST /api/jobs/sync`、`/api/jobs/import`、`/api/sources`：同步、导入和管理招聘源。
- `POST /api/generate`：请求幂等生成任务；`GET /api/tasks/:id` 查看结果。
- `POST /api/resumes/save`：编辑／审核；`/api/applications/status`：手动记录投递状态。

变更接口要求 JSON、同源 Host/Origin、`X-FMJ-Token`；不开放 CORS。

```sh
npm run check
npm test
```

自动测试覆盖 SQLite 重启持久性、冲突检测、生成幂等、失败不造简历、审核失效、厂商密钥隔离、免费模式价格校验、同步失败保留数据、跨站和静态文件访问限制。模型测试使用假响应，不消耗额度；真实厂商联调需用户自己的登录或 Key。
