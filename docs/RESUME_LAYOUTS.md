# FoundMyJob 简历布局

简历内容仍以用户可编辑的 Markdown 保存。布局选择只改变预览和 PDF 打印的视觉呈现，不添加或改写候选人事实。旧简历默认使用「经典 ATS」。

四种单栏布局（经典 ATS、校招清爽、现代商务、欧式模块）会把已有的「特长」「技能」「核心能力」等板块放在第一个简历板块，姓名和联系方式仍在页首。若原简历没有这类板块，就保留原有板块顺序，不凭空生成技能。编辑器中的原文顺序不变；预览、PDF 和导出的 Markdown 使用相同的展示顺序。

导出流程分为两个阶段：草稿页只提供「保存修改」和「确认审核完成」；确认后切换至已审核的预览与导出页，才显示 Markdown 保存和 PDF／打印。启动保存或打印后关闭工作室弹窗。再次打开已审核简历会直接进入导出页；选择「编辑内容」后，如修改事实内容，仍需重新审核。

| 布局 | 设计特点 | 建议用途 |
| --- | --- | --- |
| 经典 ATS | 黑白单栏、居中姓名、细线分区 | 国内外在线申请的默认选择 |
| 校招清爽 | 蓝灰细线、紧凑单栏 | 校园招聘与实习 |
| 现代商务 | 藏蓝标题、宽松留白、单栏 | 社会招聘与国际投递 |
| 欧式模块 | 绿色边界、明确分区、线性阅读 | 模块较多的履历 |
| 创意侧栏 | 联系方式、技能、教育在侧栏，经历在主栏 | 直接发给招聘者人工阅读；不标记为 ATS 友好 |

侧栏版只调整阅读位置，不改变存储的原始经历；其双栏 PDF 可能被部分招聘系统错误解析。在线申请优先选单栏。

这些是参考主流模板库和职业指导提炼的代表性布局，不是未经证实的热度排名：

- [Microsoft Word 简历模板库](https://word.cloud.microsoft/create/en/resume-templates/) 与 [ATS 模板](https://word.cloud.microsoft/create/en/ats-templates/)
- [国内高校 2026 年简历指导](https://shx.pzhu.edu.cn/info/1561/28075.htm) 与 [蓝白灰版式建议](https://career.ahnu.edu.cn/info/1027/25042.htm)
- [Europass CV](https://europass.europa.eu/en/create-europass-cv)
- [Canva 简历模板](https://www.canva.com/resumes/templates/) 与 [Indeed ATS 建议](https://www.indeed.com/career-advice/resumes-cover-letters/resume-ai)

## 渲染约束

- 标题、加粗和项目符号必须转换成文档排版；PDF 不显示 Markdown 源标记。
- 用户原始文本先转义 HTML，再应用受限的 Markdown 格式规则。
- 打印使用 A4 页面；标题避免孤立在页尾，单条经历尽量保持在同一页。
- 调整布局不撤销已审核状态；编辑事实内容仍需重新审核。
