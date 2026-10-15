# FoundMyJob

面向校招与社招的本地求职助手：真实岗位同步、多份求职画像、AI 简历生成与审核、导出以及投递跟踪。使用 Node.js 原生 HTTP + SQLite，无需安装 npm 依赖。

## 本地运行

推荐 **Node.js 24 LTS**，最低 22.13（需支持 `node:sqlite`）。

```sh
npm start
```

Windows 可双击 `Start-FoundMyJob.cmd`。它会独立在后台启动服务并打开 <http://127.0.0.1:4173>；关闭启动窗口或浏览器不会停止服务。重复双击会复用已有服务。需要停止时双击 `Stop-FoundMyJob.cmd`；有简历正在生成时会提示先等待完成。电脑重启后再次双击启动即可，不修改系统开机启动项。

`npm start` 仍是前台运行方式，需要保留终端，Ctrl+C 停止。后台日志在 `.runtime/background-server.log`。SQLite 在部分 Node 版本显示 ExperimentalWarning，不影响当前运行。

本版本需要后端，不能只把 `dist/` 上传到静态托管。仅监听 `127.0.0.1`，用于**单用户本机**；不支持公开暴露、反向代理或多人共享实例。

## 使用流程

1. 在「求职画像」新建或复制画像，例如「加拿大 · Data Engineer」「加拿大 · Software Engineer」「中国 · 软件工程师」。各自选择招聘地点范围（国内／国外／国内外均考虑），填写职位、简历语言和真实教育、技能、工作或项目经历。支持导入 TXT / Markdown 文本；复制后两份画像独立编辑。
2. 在「发现岗位」选择搜索使用的画像，默认展示岗位库中的全部可浏览记录，按技能、目标职位和求职阶段计算匹配度；排序只改变先后，用户可主动选择地区、职位、来源筛选或显示数量。画像的地点偏好决定「继续查找岗位」提供国内、国外或两组官网入口。点击「同步真实岗位」从企业公开招聘板获取岗位；支持添加 Greenhouse / Lever 招聘板，也可以导入真实 JD 和原文链接。同步得到的岗位库共享，画像决定筛选和排序。
3. 在「AI 与数据设置」选择本机 Cursor，或自带 Key 的厂商与模型。
4. 在岗位详情确认生成使用的画像、语言及数据发送与额度使用，再生成简历。任务保存该画像的版本和事实快照；生成中编辑或切换画像不会改变这次任务。生成前画像已被其他窗口修改时，需刷新后重新确认。任务状态保存在「生成记录」，刷新不丢任务。
5. 编辑简历、逐项审核，然后导出 Markdown 或通过打印另存为 PDF。内容变化会使审核状态失效。
6. 自行到企业原文投递，在投递追踪中记录进度；后端要求同一岗位、同一画像有已审核简历才能标记已投递／面试中。简历、生成记录和投递记录显示来源画像，支持按画像筛选。

旧版本的单份档案自动迁移为第一份画像，历史简历及其原有事实快照保留。画像可以归档、恢复；归档不删除简历和投递记录，至少保留一份可用画像。当前选择按浏览器标签页记住；切换时保留尚未保存的表单草稿，但搜索与生成只使用已保存的数据，关闭页面前请保存。

多画像属于当前本机求职空间；本版本仍没有在线注册或多账户认证。其他用户各自在自己的电脑运行，在线账户隔离需要在后续多人版本中实现。

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

预置截图中的 36 家热门公司目录，以及 Figma、IMC、Tower Research Capital 的公开 Greenhouse 招聘板。热门公司支持点击筛选、单独同步和逐来源状态查看；目录与官网入口本身不计入岗位数。可以在设置添加其他 Greenhouse / Lever 企业板，同一来源的同步请求间隔至少 30 秒。

2026-10-15 实测：36 家热门公司中 34 家已接通，其中 33 家有具体职位；建信金科当前无开放报名岗位。阿里、华为、字节、蚂蚁、vivo、科大讯飞、联通、移动、蔚来、理想等均可同步真实列表。字节上限 10,000 条，飞猪／淘宝闪购按业务核验，分页重叠或有缺项时标部分同步并保留历史。Moka、联想、4399 等摘要记录会明确提示查看原文。当前本机有 38759 条可浏览岗位。

每家公司当前的数量、限制和后续工作见 [招聘来源接入记录](docs/JOB_SOURCES.md)。来源可能随时变更；“已同步”表示成功读取该适配器覆盖的公开列表，不表示覆盖公司全部招聘渠道，也不保证申请时仍在招。

发现页默认浏览所有可用记录，不按画像地区或目标职位自动过滤，也不隐藏低匹配岗位。排序可选匹配度或最近同步；每批默认显示 25 条，可选 50 条，向下滚动时自动追加下一批，也可点击「继续加载」。切换筛选或排序后从所选批次大小重新展示。用户勾选「仅显示目标职位」才启用标题筛选。热门公司默认收起，点击标题展开后，上方按公司筛选岗位，下方提供招聘官网入口。发现页仅保留结果数量与已显示数量，完整岗位库统计、历史下架数量及各来源同步状态移至「工作台」的「岗位库概览」。

画像提供「国内／国外／国内外均考虑」三种招聘地点范围，对应 searchScope=domestic/overseas/all。旧画像按 market 自动推断范围（cn→国内，ca/us/other→国外，空值→均考虑），读取时保留旧数据；保存新范围后持久记录。该偏好控制继续查找入口，岗位库筛选由用户单独选择。国外入口包含 Google、Microsoft、Amazon，国内入口包含字节、华为、百度。

官网检索发现的具体岗位可通过 POST /api/jobs/import（discoveredFromWeb: true）与真实摘要和原文链接一起入库，sourceKind=discovered、verificationStatus=pending、descriptionKind=summary；与企业接口和手动导入分别计数，同一原文 URL 去重。检索岗位可以搜索、排序、收藏和查看详情，标注待核验及摘要；不伪称已经确认在招，也不会因为其他招聘板同步被清除。JSON 导出保留来源属性。

快手公开列表仍有访问校验，交银金科官网连接超时且旧专题无法核验在招状态，显示“待接通”及官网入口。建信金科显示“当前公开列表暂无岗位”，不把已截止的校招计为在招。所有公司都已配置本地品牌图标。失败保留上次成功数据；服务中断后可重新同步。Windows 上的少数旧 TLS 官网通过系统自带 curl 保持证书校验，不禁用 HTTPS 校验。

招聘状态、薪资、年限、资格以原文为准。招聘类型只对标题明确标示实习／应届或资深级别的岗位推断，其余标「未注明」；技能与地区提取是启发式匹配，并非 AI 筛选结论。匹配度不代表录用概率。国内岗位不是全网覆盖，未接入网站支持手动导入 JD，不绕过登录或验证码。

参考：[Greenhouse Job Board API](https://docs.greenhouse.io/job-board.html)、[Lever Postings API](https://github.com/lever/postings-api)、[OpenRouter 模型列表](https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties)。

## 数据库与备份

本机文件 `.runtime/foundmyjob.sqlite`，采用 WAL、外键、事务和版本冲突检查。表包括 profiles（画像）、config（非敏感设置）、sources、jobs、saved、resumes、resume_versions、applications、tasks。数据库结构版本为 2，旧数据在一个事务内迁移；API 数据快照版本为 3。

关闭服务后复制数据库文件做完整备份；运行中的数据库请勿仅复制主文件而忽略 WAL。恢复时关闭服务，再用备份替换主文件。页面的 JSON 导出用于查阅／迁移，当前没有 JSON 自动恢复接口。Git 忽略整个 `.runtime/`、`.env*`（除模板）、SQLite 文件及 `.cursor/`。

此版本不提供磁盘加密；数据库属于你的本地个人文件，包含经历和联系方式。不要把运行目录或整盘压缩包当作源代码分享。

## API 与验证

2026-10-15 的阶段成果先提交到 `main`，作为后续开发基线。下一阶段从 `main` 创建 `dev`，日常开发和阶段性提交在 `dev` 上进行；完成自动测试、关键页面与真实接口验证后，再合并回 `main`。本地数据库、画像、简历、登录信息及 `.env.local` 保留在本机，不随源码提交。

- `GET /api/state`：读取本机数据和本地会话令牌，包含 `profiles` 列表，不含 Key。
- `POST /api/profiles/create`：用 `label`、`market`、`resumeLanguage` 新建画像，可传 `copyFrom` 复制已有画像，返回 `createdProfileId`。
- `POST /api/profiles/save`（或 `/api/profile`）：保存完整画像字段，必须带 `id`、`revision` 防止覆盖其他画像或较新的修改。
- `POST /api/profiles/archive`：带 `id`、`revision`、`archived` 归档或恢复画像。
- `POST /api/settings`：保存非敏感设置，带 `revision` 防覆盖。
- `POST /api/credentials`：设置／清除内存中的个人 Key。
- `GET /api/models?provider=...`：加载对应厂商模型。
- `POST /api/jobs/sync`：同步所有招聘源；可传 `sourceId` 只同步一家公司。`GET /api/state` 中的 `syncing` 和各来源状态用于显示进度；多个来源最多并发 3 个。
- `POST /api/jobs/import`、`/api/sources`：导入真实 JD、添加 Greenhouse / Lever 招聘源。
- `POST /api/generate`：必须带 `profileId`、`profileRevision`、`jobId`，请求幂等生成任务；可覆盖画像默认语言。`GET /api/tasks/:id` 查看结果。
- `POST /api/applications`：带 `jobId`、`profileId` 添加投递计划，同一岗位不同画像分别跟踪。
- `POST /api/resumes/save`：编辑／审核；`/api/applications/status`：手动记录投递状态。

变更接口要求 JSON、同源 Host/Origin、`X-FMJ-Token`；不开放 CORS。

```sh
npm run check
npm test
```

自动测试覆盖旧档案迁移、多画像复制与隔离、归档恢复、画像版本冲突、生成事实快照、按画像审核、加拿大与美国筛选，以及 SQLite 重启持久性、生成幂等、失败不造简历、审核失效、厂商密钥隔离、免费模式价格校验、同步失败保留数据、跨站和静态文件访问限制。招聘源测试还覆盖 36 家目录注册、单公司同步、分页与去重、部分同步保留旧岗位、来源端点固定、JSONP/SSR 数据安全解析及公司组合筛选。模型测试使用假响应，不消耗额度；真实厂商联调需用户自己的登录或 Key。
