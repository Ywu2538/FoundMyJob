import test from 'node:test';
import assert from 'node:assert/strict';
import {renderResumeMarkdown} from '../dist/resume-markdown.js';

test('generated resume headings and emphasis render as document structure',()=>{
  const source=`# 候选人
邮箱：candidate@example.com
## 工作经历
### 中兴通讯股份有限公司 | 西安
**软件工程师 / 5G 算法工程师** | 2022.09 – 2023.05
• 开发并验证 C/C++ 算法
- 与测试团队协作
## 项目经历
### Cat-Project – AI 赋能 Web 应用与 API 测试原型
1. 实现接口测试
2. 核对结果`;
  const html=renderResumeMarkdown(source);
  assert.match(html,/<header class="resume-header"><h1>候选人<\/h1>/);
  assert.match(html,/<div class="resume-body"><section class="resume-section"><h2>工作经历<\/h2>/);
  assert.match(html,/<div class="resume-entry"><h3>中兴通讯股份有限公司 \| 西安<\/h3>/);
  assert.match(html,/<p><strong>软件工程师 \/ 5G 算法工程师<\/strong> \| 2022/);
  assert.match(html,/<ul><li>开发并验证 C\/C\+\+ 算法<\/li><li>与测试团队协作<\/li><\/ul>/);
  assert.match(html,/<ol><li>实现接口测试<\/li><li>核对结果<\/li><\/ol>/);
  assert.equal((html.match(/class="resume-section"/g)||[]).length,2);
  assert.doesNotMatch(html,/###|\*\*/);
});

test('candidate HTML remains inert while Markdown formatting is applied',()=>{
  const html=renderResumeMarkdown('# <img src=x onerror=alert(1)>\n## <script>alert(1)</script>\n**<b>not trusted</b>** and *emphasis*');
  assert.doesNotMatch(html,/<img|<script|<b>/);
  assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html,/<strong>&lt;b&gt;not trusted&lt;\/b&gt;<\/strong>/);
  assert.match(html,/<em>emphasis<\/em>/);
});

test('a resume without a title still renders sections and ordinary paragraphs',()=>{
  const html=renderResumeMarkdown('## Projects\n### Capstone\nBuilt a prototype.');
  assert.doesNotMatch(html,/resume-header/);
  assert.match(html,/<section class="resume-section"><h2>Projects<\/h2><div class="resume-entry"><h3>Capstone<\/h3><p>Built a prototype\.<\/p><\/div><\/section>/);
  assert.equal(renderResumeMarkdown(null),'<div class="resume-document"><div class="resume-body"></div></div>');
});

test('sidebar layout moves skills and education into its visual column without changing facts',()=>{
  const source='# Candidate\nContact\n## Skills\n- Python\n## Work\n### Engineer\n- Built tests\n## Education\nUniversity';
  const html=renderResumeMarkdown(source,'sidebar');
  assert.match(html,/<aside class="resume-sidebar"><header class="resume-header">/);
  const side=html.split('</aside>')[0],main=html.split('<div class="resume-body">')[1];
  assert.match(side,/Skills/);
  assert.match(side,/Education/);
  assert.doesNotMatch(side,/Work/);
  assert.match(main,/Work/);
  assert.equal((html.match(/Built tests/g)||[]).length,1);
});
