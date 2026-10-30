export const LOCALE_KEY='foundmyjob:ui-language';
let locale='zh';
try{locale=localStorage.getItem(LOCALE_KEY)==='en'?'en':'zh';}catch{}
export const getLocale=()=>locale;
export function setLocale(value){
 locale=value==='en'?'en':'zh';
 try{localStorage.setItem(LOCALE_KEY,locale);}catch{}
 return locale;
}
export const translations=Object.fromEntries(`
用户中心|User center
头像格式无效，请重新选择 JPG、PNG 或 WebP 图片。|The avatar format is invalid. Choose a JPG, PNG or WebP image again.
用户中心仅支持修改基础信息、专业技能和求职偏好。|The user center only supports basic information, skills and job preferences.
请选择 Word（.docx / .doc）、PDF、TXT 或 Markdown 文件。|Choose a Word (.docx / .doc), PDF, TXT or Markdown file.
文件不能超过 10 MB。|Files must be no larger than 10 MB.
文件为空，请选择有内容的文件。|This file is empty. Choose a file with content.
正在解析其他文件，请稍后重试。|Other files are being processed. Please try again shortly.
文件解析超时，请拆分文件或另存为较小的文件后重试。|Processing timed out. Split the file or save a smaller copy and try again.
文件解析失败，请另存为新的 Word 或 PDF 文件后重试。|Processing failed. Save a new Word or PDF copy and try again.
文件解析中断，请检查文件后重试。|Processing was interrupted. Check the file and try again.
文件内容与扩展名不符，请使用原始 Word 或 PDF 文件。|The content does not match the extension. Use the original Word or PDF file.
无法识别文本编码，请另存为 UTF-8 文本后重试。|The text encoding could not be read. Save as UTF-8 and try again.
文件不是可读取的纯文本，请使用原始 Word 或 PDF 文件。|This is not readable plain text. Use the original Word or PDF file.
文件内容与扩展名不符，请在 Word 中另存为 .docx 后重试。|The content does not match the extension. Save as .docx in Word and try again.
这不是有效的 PDF 文件，请重新导出后重试。|This is not a valid PDF. Export it again and retry.
PDF 超过 100 页，请仅导入与经历有关的页面。|This PDF exceeds 100 pages. Import only the relevant pages.
提取文字超过 100,000 字符，请拆分文件后导入。|The extracted text exceeds 100,000 characters. Split the file before importing.
PDF 没有可提取的文字，可能是扫描件或图片。请先进行 OCR 文字识别，或导入原始 Word 文件。|This PDF has no extractable text and may be a scan or image. Run OCR first or import the original Word file.
文件中没有可提取的文字，请检查内容或先进行 OCR 文字识别。|No text could be extracted. Check the content or run OCR first.
部分文字无法正确解码，请另存为新的 Word、PDF 或 UTF-8 文本后重试。|Some text could not be decoded. Save a new Word, PDF or UTF-8 text copy and try again.
PDF 已加密，请先解锁或导出无密码的副本后重试。|This PDF is encrypted. Unlock it or export a copy without a password and retry.
无法读取文件，文件可能已损坏或加密。请另存为新的 Word 或 PDF 文件后重试。|The file could not be read. It may be damaged or encrypted. Save a new Word or PDF copy and retry.
请以文件格式上传。|Upload the original file.
求职偏好格式无效。|The job preferences format is invalid.
城市与所选国家不一致。|The city does not match the selected country.
请先选择城市所在国家。|Choose the country for this city first.
选项无效。|The selected option is invalid.
工作台|Dashboard
发现岗位|Discover jobs
我的简历|My resumes
投递追踪|Applications
求职画像|Profiles
生成记录|Generation history
AI 与数据设置|AI & data settings
简历| resume
画像决定热门公司、官网入口和匹配排序；默认浏览所有地区，向下滚动查看更多岗位。|Your profile determines featured employers, career links and matching. Use country filters to refine jobs below.
管理画像|Manage profiles
按来源画像查看|Filter by source profile
全部画像|All profiles
画像名称|Profile name
例如：加拿大 · Data Engineer|For example: Canada · Data Engineer
招聘地点范围|Job search scope
默认简历语言|Default resume language
中文|Chinese
英文|English
我的求职空间|My job search workspace
让每一份努力，更有方向|Give your next step a clear direction
求职旅程|JOB SEARCH
主导航|Main navigation
个人中心|PERSONAL
你的本机求职空间|Your local workspace
持久保存|Saved on this device
当前生成：|Generation provider:\x20
展开导航|Open navigation
Interface language / 界面语言|Interface language
本地数据库已连接|Local database connected
查看使用说明|View instructions
打开个人档案|Open profile
导入岗位|Import job
同步真实岗位|Sync jobs
每一段经历，都值得被看见|Every experience deserves to be seen
好机会，从了解你开始。|Your next opportunity starts with you.
把你的闪光点，变成下一份工作的起点。|Turn your strengths into your next career step.
完善档案，解锁更贴合你的岗位推荐。|Complete your profile for more relevant matches.
完善求职档案|Complete your profile
你的经历，刚好匹配|Your experience, the right match
潜力|Potential
热爱|Passion
成长|Growth
下一站，有更多可能|More possibilities ahead
为每个机会，认真准备|Prepare for every opportunity
求职概览|Job search overview
已显示|Showing
条岗位|jobs
 条岗位| jobs
岗位库|Job library
我的收藏|Saved jobs
按「|Matching profile: “
」计算匹配度|”
搜索职位、公司或技能…|Search jobs, companies or skills…
搜索职位、公司或技能|Search jobs, companies or skills
岗位地区|Job location
全部地区|All locations
中国大陆|Mainland China
国内|China
国外|Overseas
国内外均考虑|Worldwide
加拿大|Canada
美国|United States
日本|Japan
英国|United Kingdom
法国|France
澳大利亚|Australia
新加坡|Singapore
北美|North America
北美（含国家未注明）|North America (including unspecified country)
其他 / 未注明|Other / unspecified
招聘类型|Recruitment type
全部招聘类型|All recruitment types
校园招聘|Early career
社会招聘|Experienced
未注明|Unspecified
办公方式|Work arrangement
远程办公|Remote
混合办公|Hybrid
现场办公|On-site
搜索|Search
仅显示目标职位：|Only show target roles:\x20
公司：|Company:\x20
· 地区：|· Location:\x20
· 类型：|· Type:\x20
查看全部库内岗位 / 清除筛选|View all stored jobs / clear filters
找到|Found
个岗位 · 已显示|jobs · showing
条|jobs
排序：|Sort:\x20
岗位排序|Sort jobs
匹配度优先|Best match
最近同步优先|Recently synced
显示数量：|Page size:\x20
显示数量|Page size
25 条|25 jobs
50 条|50 jobs
来源：|Source:\x20
岗位来源|Job source
全部来源|All sources
官网同步|Official feed
官网检索 · 待核验|Web discovery · unverified
手动导入|Manual import
还没有找到符合条件的岗位|No jobs match these filters yet
已接入的岗位库暂无符合条件的结果，不代表市场上没有此类岗位。可查看上方官网入口，或清除筛选浏览全部岗位。|No stored jobs match these filters. This does not mean there are no openings. Explore the official career links above or clear filters.
清除筛选|Clear filters
好机会值得等待，更值得准备|Be ready for your next opportunity
岗位以企业原文为准，可能下架；匹配度是技能与目标方向的规则参考，不代表录用概率。官网检索岗位标注待核验，详情中的摘要不能替代完整 JD。|Check the original listing for current availability. Match scores reflect skills and role alignment, not hiring probability. Web-discovered jobs need verification; summaries do not replace the full description.
继续加载|Load more
查看|View
详情|details
查看详情|View details
你好，|Hello,\x20
发现新机会|Discover opportunities
你的求职路径|Your next steps
一步一步，把机会变成可能|Take your next step, one at a time
值得关注的机会|Opportunities to explore
查看全部|View all
请在岗位原文中核实最新招聘状态。|Verify availability on the original job listing.
复制当前画像|Duplicate profile
新建画像|New profile
共|Total:
份可用画像|active profiles
归档当前画像|Archive profile
已归档画像（保留历史简历和记录）|Archived profiles (history retained)
恢复使用|Restore
% 已完善|% complete
姓名|Full name
联系邮箱|Email
所在城市|City
联系电话|Phone
选填|Optional
用于简历联系方式|Contact number for your resume
求职阶段|Career stage
校园招聘 / 实习|Early career / internship
目标职位|Target role
例如：Data Engineer / Software Engineer|For example: Data Engineer / Software Engineer
专业技能|Skills
使用逗号分隔，岗位匹配会参考这些技能|Separate skills with commas. These inform job matching.
Figma, SQL, Python, 用户研究|Figma, SQL, Python, User research
档案保存在本机 SQLite 数据库|Profiles are saved in the local SQLite database
保存当前画像|Save profile
你的经历，就是最好的起点。|Your experience is the best starting point.
无需一次写得完美。先记录事实，再为不同岗位选择最相关的内容。|Start with the facts. Then highlight the experience most relevant to each role.
用清晰的动词说明你做了什么|Use clear verbs to describe your work
写出能够核实的成果或数据|Include outcomes you can verify
校招可以突出课程与项目|Highlight courses and projects for early career roles
社招可以突出职责与工作成果|Highlight responsibilities and results for experienced roles
请填写你自己的真实经历|Use your own, real experience
这里不会预填虚构经历。点击生成前，会让你确认将哪些数据发给所选 AI 服务。|No fictional experience is prefilled. Before generation, you will confirm which data is sent to the selected AI provider.
导入经历文本|Import experience text
为新岗位准备简历|Create a resume for a job
来源画像：|Source profile:\x20
创建 ·|created ·
生成|generated
编辑与审核|Edit & review
删除|Delete
添加求职机会|Add an opportunity
更新进度|Update progress
投递状态|Application status
岗位与简历|Job & resume
进度由你手动记录。标记「已投递」前需要审核该岗位、该画像的简历；本产品不会自动提交求职申请。|Track progress manually. Review the resume for this job and profile before marking it as applied. Applications are not submitted automatically.
岗位 / 来源画像|Job / source profile
服务 / 模型|Provider / model
时间|Date
结果|Result
打开简历|Open resume
生成中 · 查看|Generating · view
平台积分购买暂未开放|Platform credits are not available yet
本机 Cursor 使用本机账号额度；自带 Key 使用对应厂商账户额度。平台计费功能在接通账户、支付及服务端余额校验后开放。|Local Cursor uses your local account allowance. Your own API key uses that provider's account. Platform billing is not available yet.
刷新任务状态|Refresh task status
生成设置|Generation settings
使用方式|Provider
本机 Cursor（使用自己的订阅）|Local Cursor (your subscription)
· 自带 Key|· your API key
平台积分 · 尚未开放|Platform credits · unavailable
仅使用本机 Cursor 登录|Use your local Cursor sign-in
克隆代码不会带走你的登录信息。生成需要本机配置开启且 CLI 已登录。|Cloning this code does not copy your credentials. Generation requires local access to be enabled and the CLI to be signed in.
检查 Cursor 登录|Check Cursor sign-in
未检测登录状态|Sign-in not checked
你的 API Key|Your API key
输入你自己的 Key，保存后立即清空输入框|Enter your key; the field clears after saving
保存 Key|Save key
清除 Key|Clear key
获取自己的 Key ↗|Get your API key ↗
Key 仅保存在当前后端进程内存；不写入数据库、浏览器存储、备份或 Git。服务重启需重新输入。|Keys stay in server memory only, never in the database, browser storage, backups or Git. Enter them again after a server restart.
加载可用模型|Load models
厂商价格 / 限额 ↗|Provider pricing / limits ↗
只显示并调用已确认免费的模型|Only show and use verified free models
选择模型|Select model
请先加载模型并选择|Load and select a model first
（已保存）|(saved)
不会自动切换厂商或付费模型。免费模型可能限流、下架或更改价格。|Providers and paid models are never switched automatically. Free models may have limits or change availability and pricing.
新画像初始语言（已有画像使用自身设置）|Default language for new profiles (existing profiles keep their settings)
保存生成设置|Save generation settings
真实岗位来源|Job sources
个岗位|jobs
同步所有岗位源|Sync all sources
添加企业招聘板|Add a company job board
内置热门公司官网来源，并支持新增 Greenhouse / Lever 招聘板。已同步、部分同步、待接通和失败分别显示；同步失败保留上次数据。|Use connected official sources or add Greenhouse / Lever boards. Sync status is shown for each source. Failed syncs preserve existing jobs.
本地数据与备份|Local data & backups
SQLite 保存档案、岗位、简历版本与投递记录。旧演示记录仍保留在原浏览器存储中，不会自动混入真实档案。|SQLite stores profiles, jobs, resume versions and applications. Legacy demo records stay in the original browser storage and are not mixed into real profiles.
导出数据 JSON|Export data as JSON
导出旧演示记录|Export legacy demo data
完整恢复：关闭程序后备份 .runtime/foundmyjob.sqlite 文件。JSON 导出用于阅读和迁移，不包含密钥。|For a full backup, close the app and copy .runtime/foundmyjob.sqlite. JSON exports are for reading and migration and contain no keys.
运行范围|Deployment
当前版本用于单用户本机。网页只连接 127.0.0.1；其他用户在自己的电脑上配置自己的账号。|This version runs locally for one user and connects only to 127.0.0.1. Other users configure their own accounts on their computers.
在线多人版本需要独立账户、加密密钥库、支付回调和服务端额度账本，当前不开放平台代付。|A shared online version requires independent accounts, encrypted key storage and server-side billing. Platform-funded generation is unavailable.
属于你的机会，正在前方。|Your next opportunity is ahead.
关闭对话框|Close dialog
我们期待的你|Requirements
打开岗位原文|Open original job listing
。申请前请核对原文是否仍在招聘。|. Check the original listing before applying.
与「|Match with “
」匹配|”
职位方向|Role alignment:\x20
· 技能重合|· Skills matched
可以进一步确认|Skills to verify
基于技能、目标方向与求职阶段的规则计算，不代表录用概率。|Based on skills, role and career stage. This is not a hiring probability.
」已为这个岗位准备|” has prepared
份简历|resumes for this job
生成使用的画像|Profile used for generation
（已归档）|(archived)
· 仅使用这份画像已保存的经历|· Uses only this profile's saved experience
简历语言|Resume language
我同意把「|I consent to sending profile “
」与岗位要求发送给该服务，并使用该账户额度|” and job requirements to this provider and using my account allowance
生成专属简历|Generate tailored resume
· 版本|· Version
生成 · 需核实事实|generated · verify all facts
编辑内容|Edit content
支持简单 Markdown|Basic Markdown supported
简历内容|Resume content
审核提示|Review notes
简历预览|Resume preview
A4 · 可打印为 PDF|A4 · print to PDF
我已逐项确认经历、技能和联系方式真实准确|I have checked that experience, skills and contact details are accurate
修改内容后需重新审核；导出不代表已投递。|Review again after edits. Exporting does not submit an application.
保存修改|Save changes
PDF / 打印|PDF / Print
确认审核完成|Confirm review
正在结合岗位要求整理真实经历|Tailoring your real experience to the job
模型通常需要一到两分钟。任务已保存，刷新后可在「生成记录」查看。|Generation usually takes a minute or two. The task is saved; check Generation history after refreshing.
打印 / 保存 PDF|Print / Save PDF
公司|Company
职位|Job title
地点|Location
岗位原文链接|Original job URL
地区|Region
北美（国家未注明）|North America (country unspecified)
其他|Other
类型|Type
校招 / 实习|Early career / internship
社招|Experienced
完整岗位描述|Full job description
粘贴职责、要求和申请条件；不会自动绕过招聘网站登录|Paste duties, requirements and eligibility. Login barriers are not bypassed.
保存到岗位库|Save to job library
此简历及历史版本将被删除，投递记录保留。|This resume and its versions will be deleted. Application records are retained.
确认删除|Confirm deletion
获取|Loaded
个模型，请选择并保存。|models. Select one and save.
招聘系统|Recruitment platform
公司名称|Company name
招聘板标识|Board identifier
例如 figma，不是完整网址|For example: figma, not a full URL
从公司官方招聘链接中找到 board token；此处不会抓取任意网址。|Find the board token in the company's official career link. Arbitrary URLs are not fetched.
添加来源|Add source
本地后端未连接|Local server is unavailable
请双击项目中的 Start-FoundMyJob.cmd 启动，再刷新页面。|Run Start-FoundMyJob.cmd in the project folder, then refresh this page.
重新连接|Reconnect
复制求职画像|Duplicate profile
新建求职画像|New profile
发现适合我的岗位|Discover relevant jobs
发现适合你的真实岗位。|Discover your next opportunity.
按你的方向发现机会，向下滚动，继续浏览更多岗位。|Explore jobs that fit your direction. Scroll for more opportunities.
当前筛选结果|Matching results
档案完整度|Profile completeness
越完整，匹配越精准|More detail, better matches
已收藏岗位|Saved jobs
留住每一个心动机会|Keep opportunities that interest you
专属简历|Tailored resumes
每一次投递都有准备|Prepare for every application
收藏机会|Saved opportunities
已经心动的岗位|Jobs you want to explore
已生成简历|Generated resumes
逐一为机会做准备|Prepare for each opportunity
已审核简历|Reviewed resumes
投递记录|Applications
记录你的求职旅程|Track your progress
一个你，可以有多个求职方向。|One you. Multiple career directions.
按市场和职位分别整理画像，让每份简历都有明确的出发点。|Organize profiles by market and role to give every resume a clear focus.
每个机会，都有专属表达。|A tailored resume for every opportunity.
从真实经历出发，整理、审核，再安心投递。|Start with real experience, review it, then apply with confidence.
你的第一份专属简历，正在等你。|Your first tailored resume starts here.
先选择一个心动的岗位，再点击「生成专属简历」。|Choose a job, then select Generate tailored resume.
每次出发，都留下足迹。|Keep track of every application.
记录进度、整理反馈，让下一次投递更从容。|Record progress and feedback to prepare for your next application.
把求职进度，放在同一个地方。|Keep your job search in one place.
在岗位详情中点击「加入投递计划」，开始记录下一次机会。|Select Add to applications in a job's details to start tracking it.
每次生成，都有记录。|Every generation has a record.
任务状态由后端保存；刷新页面后可以继续查看。|Task status is saved on the server and survives a refresh.
让 AI 按你的方式工作。|Make AI work your way.
本机 Cursor 与用户自带 Key 分开使用，平台代付功能尚未开放。|Choose local Cursor or your own API key. Platform-funded generation is not available.
正在整理简历，请稍等片刻。|Your resume is being prepared. Please wait.
机会详情|Job details
这份简历已被删除。|This resume has been deleted.
简历工作室|Resume studio
正在生成专属简历|Generating your tailored resume
简历已保存到数据库，请审核每一项事实。|Resume saved. Please review every fact.
导入真实岗位|Import a job
画像已归档，历史简历与记录保留，可随时恢复。|Profile archived. Resumes and history are retained. You can restore it later.
画像已恢复。|Profile restored.
本地使用流程|How to use this app
已加入投递计划。|Added to applications.
简历已保存。内容变更后需要重新审核。|Resume saved. Review it again after any changes.
已审核，可以导出并自行投递。|Reviewed. You can export and apply yourself.
简历已导出。|Resume exported.
删除这份简历？|Delete this resume?
简历已删除。|Resume deleted.
已导出数据，不包含 Key 或登录信息。|Data exported without keys or sign-in details.
Key 已存入本机服务内存，不会写入文件。|Key stored in server memory, not in a file.
已清除当前服务的 Key。|Provider key cleared.
正在获取厂商模型列表…|Loading provider models…
正在同步官网职位…|Syncing official jobs…
同步结束：|Sync complete:\x20
 个来源已有职位，库内 | sources have jobs; the library contains\x20
操作失败。|Action failed.
当前画像已保存，其他画像不受影响。|Profile saved. Other profiles are unchanged.
画像已创建，请填写或调整真实经历后保存。|Profile created. Add or update your real experience and save.
生成设置已保存。|Generation settings saved.
岗位已保存。|Job saved.
来源已添加，点击同步即可获取岗位。|Source added. Sync it to retrieve jobs.
投递进度已保存。|Application status saved.
已填入所选画像的经历草稿，请检查并保存。|Text added to the profile draft. Review and save it.
正在编辑的画像|Editing profile
用于岗位搜索的画像|Profile for job search
请填写目标职位|Add your target role
原求职画像|Original profile
 · 副本| · Copy
复制已保存的真实经历，之后两份画像分别编辑、互不覆盖。|Copy saved experience. The two profiles can then be edited independently.
新画像从空白开始，也可以复制已有画像后调整职位方向。|Start with a blank profile, or duplicate an existing one and adjust its focus.
复制画像|Duplicate profile
创建画像|Create profile
本机 Cursor|Local Cursor
类型未注明|Type unspecified
你|You
我的档案|My profile
官网检索发现|Web-discovered jobs
未同步|Not synced
 条 · 官网检索待核验 | jobs · web-discovered, unverified\x20
 条 · 手动导入 | jobs · manually imported\x20
 条 · 历史已下架 | jobs · archived\x20
官网查看|Visit career site
正在同步|Syncing
待接通 · 官网查看|Not connected · visit site
暂时无法同步|Sync unavailable
待同步|Awaiting sync
当前读取范围暂无岗位|No jobs in the retrieved range
当前公开列表暂无岗位|No jobs on the current public list
国内热门公司|Featured companies in China
国外热门公司|Featured overseas companies
全球热门公司|Featured companies worldwide
国内招聘官网|Career sites in China
国外招聘官网|Overseas career sites
国家岗位直达|Jobs in this country
招聘官网|Career site
收起|Collapse
展开|Expand
全部|All
尚未填写|Not set
 · 关键词：| · Keywords:\x20
 · 向下滚动，自动加载更多| · Scroll to load more
 · 已浏览全部岗位| · All jobs shown
取消收藏|Unsave
收藏|Save
已下架 · 历史记录|Archived · no longer listed
官网检索 · 招聘状态待核验|Web-discovered · verify availability
手动导入 · 请核对原文|Manual import · check original
 · 职位摘要| · Job summary
规则匹配|Rule-based match
职位方向不同|Different role focus
求职者|job seeker
你的每一步，都在靠近更合适的下一站。|Every step brings you closer to the right opportunity.
可以进入投递流程|Ready for applications
建立个人档案|Build your profile
让你的经历成为推荐的起点|Start matching from your real experience
发现心动岗位|Discover jobs
从中国到北美，找到你的方向|Find your direction across global markets
准备专属简历|Prepare a tailored resume
围绕岗位要求，突出真实经历|Highlight real experience relevant to the role
审核并投递|Review and apply
确认每个细节，再迈出下一步|Check the details before your next step
有未保存修改；搜索和生成使用已保存版本。|Unsaved changes. Search and generation use the saved version.
每份画像独立保存。可以复制真实经历，再调整面向不同岗位的重点。|Profiles are saved independently. Copy real experience and adjust the focus for different roles.
教育经历|Education
学校、专业、学位、时间、相关课程|School, subject, degree, dates and relevant courses
工作与实习经历|Work & internship experience
公司、职位、时间，以及你实际承担的职责和成果|Company, role, dates, actual responsibilities and outcomes
项目经历|Projects
项目名称、你的角色、使用的技能和真实成果|Project, your role, skills used and real outcomes
求职偏好|Job preferences
期望城市、行业、办公方式或其他条件|Preferred cities, industries, work arrangements or other requirements
已审核|Reviewed
待审核|Needs review
已配置（本次运行）|Configured (this session)
未配置|Not configured
 · 免费（有限额）| · Free (limits apply)
跳到主要内容|Skip to main content
上次同步已下架|Removed in the last sync
岗位摘要|Job summary
关于这个机会|About this role
同步于|Synced on
收录于|Added on
相符|Aligned
不同|Different
求职阶段一致|Career stage aligned
求职阶段不同|Different career stage
未填写目标职位|Target role not set
（请先恢复画像再生成）|(restore this profile before generating)
已加入投递计划|Added to applications
加入投递计划|Add to applications
正在检查…|Checking…
 条。未接通来源请查看公司状态。| jobs. Check source status for unconnected employers.
本地后端未响应，请重新运行 Start-FoundMyJob.cmd。|Local server is not responding. Run Start-FoundMyJob.cmd again.
请求失败。|Request failed.
服务需要升级，请停止并重新启动 FoundMyJob。|Please stop and restart FoundMyJob to load the updated server.
画像不可用，请刷新。|Profile unavailable. Refresh the page.
请先保存当前画像的修改，再复制。|Save profile changes before duplicating it.
请先确认数据发送与账户额度使用。|Confirm data sharing and account usage before continuing.
请允许打印窗口后重试。|Allow the print window and try again.
请先保存当前画像再归档。|Save this profile before archiving it.
请先逐项审核并勾选确认。|Review each item and check the confirmation box.
当前浏览器没有旧演示记录。|No legacy demo data in this browser.
岗位正在同步，请稍候。|Jobs are syncing. Please wait.
画像已更新，请刷新后重新对照。|Your profile changed. Refresh to compare its latest version.
请导入小于 100 KB 的文本文件。|Import a text file smaller than 100 KB.
准备中|Preparing
已投递|Applied
面试中|Interviewing
已结束|Closed
同步中|Syncing
待接通|Not connected
同步失败|Sync failed
部分同步|Partially synced
已同步|Synced
以岗位原文为准|See original listing
数据|Data
研发|Engineering
设计|Design
产品|Product
岗位库概览|Job library overview
浏览岗位|Browse jobs
见岗位详情|See job details
招聘状态待核验|Availability unverified
条可浏览记录 ·|active records ·
家公司|companies
企业接口|Official feeds
查看各来源数量与最近同步状态|View counts and sync status by source
公司 / 来源|Company / source
可浏览记录|Active records
最近同步|Last synced
状态|Status
统计涵盖整个岗位库。官网检索岗位带有待核验标记，招聘状态请以企业原文为准。|Counts cover the entire library. Web-discovered jobs require verification against the employer's listing.
下一个机会，即将到来|Your next opportunity is ahead
还没有生成任务。|No generation tasks yet.
岗位摘要 · 申请前请核验原文|Job summary · verify before applying
以下为官网职位的摘要，完整职责、要求和当前招聘状态请打开原文确认。|This is a summary. Open the original for full duties, requirements and availability.
填写个人档案 → 同步或导入真实岗位 → 选择 AI 服务 → 生成、编辑与审核简历 → 导出并自行投递。|Complete your profile → sync or import jobs → choose an AI provider → generate, edit and review → export and apply yourself.
档案与简历保存在本机数据库。只有点击生成并确认后，才会将档案发送给所选 AI 服务。|Profiles and resumes are stored locally. Your profile is sent to an AI provider only after you confirm generation.
`.trim().split('\n').map(line=>{const index=line.indexOf('|');return [line.slice(0,index),line.slice(index+1)];}));
export function t(text,english){
 if(locale!=='en')return text;
 if(english!==undefined)return english;
 if(Object.hasOwn(translations,text))return translations[text];
 // Only called on authored static HTML fragments, never on generated/user content.
 if(typeof text==='string'&&text.includes('<'))return text.replace(/[^<>"'=]+/g,part=>{const key=part.trim();return translations[key]?part.replace(key,translations[key]):part;});
 return text;
}
export const localizedLabel=pair=>pair?.[locale==='en'?1:0]||'';
