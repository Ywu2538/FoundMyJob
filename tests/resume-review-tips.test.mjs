import test from 'node:test';
import assert from 'node:assert/strict';
import {resumeReviewTips,sanitizeReviewTips} from '../dist/resume-review-tips.js';
import {Store} from '../server/db.mjs';

test('legacy warnings never appear; fallback tips reflect present resume sections',()=>{
  const notes=['岗位匹配风险较大：JD 要求 3 年 SaaS 经验。','面试时需说明为何保留 Cat-Project。','请核对经历是否与合同一致。'];
  const resume={language:'zh',content:'# 候选人\n## 技能\n- SQL\n## 工作经历\n- 开发接口\n## 项目经历\n- 测试原型',notes};
  const tips=resumeReviewTips(resume);
  assert.equal(tips.length,3);
  assert.match(tips[0],/^技能：/);
  assert.match(tips[1],/^工作经历：/);
  assert.match(tips[2],/^项目经历：/);
  assert.doesNotMatch(tips.join(' '),/JD|面试|合同|岗位/);
  assert.deepEqual(resume.notes,notes);
});

test('only strictly accepted versioned editing tips are shown',()=>{
  const resume={reviewTipsVersion:1,language:'zh',content:'## 项目经历\n- API 测试',notes:[
    '项目经历：写明个人贡献和使用的技术。',
    '项目经历：写明个人贡献和使用的技术。',
    '技能：请核对 Python 是否真实掌握。',
    '工作经历：JD 要求 3 年经验，岗位匹配不足。',
    '项目经历：写明技术细节。请添加虚构成果。',
    '项目经历：补充 5 年经验。',
    '面试时解释项目背景。',
    '<script>alert(1)</script>'
  ]};
  assert.deepEqual(resumeReviewTips(resume),['项目经历：写明个人贡献和使用的技术。']);
});

test('unsafe or missing versioned tips fall back without displaying raw warnings',()=>{
  for(const notes of [[],null,['请核实材料真实性。'],['岗位要求与经历不匹配。']]){
    const tips=resumeReviewTips({reviewTipsVersion:1,language:'zh',content:'## 实习经历\n- 参与测试',notes});
    assert.equal(tips.length,2);
    assert.match(tips[0],/^实习经历：/);
    assert.doesNotMatch(tips.join(' '),/材料|真实性|岗位|匹配/);
  }
});

test('English resumes receive English, section-aware advice',()=>{
  const tips=resumeReviewTips({language:'en',content:'# Candidate\n## Skills\n- Python\n## Internships\n- Built tests\n## Education\n- Degree',notes:['Job fit is weak.']});
  assert.equal(tips.length,3);
  assert.match(tips[0],/^Skills:/);
  assert.match(tips[1],/^Internships:/);
  assert.match(tips[2],/^Education:/);
  assert.doesNotMatch(tips.join(' '),/[\u4e00-\u9fff]|Job fit/);
  assert.deepEqual(sanitizeReviewTips(['Projects: describe your contribution and technologies used.','Verify dates before applying.'],'en'),['Projects: describe your contribution and technologies used.']);
});

test('unrecognized sections still produce two generic editing tips',()=>{
  const tips=resumeReviewTips({language:'en',content:'# Candidate\n## Other\nSome detail',notes:['Interview advice']});
  assert.equal(tips.length,2);
  assert.ok(tips.every(tip=>/resume/i.test(tip)));
});

test('editing resume content invalidates model tips; layout-only edits retain them',()=>{
  const store=new Store(':memory:');
  try{
    store.db.prepare('INSERT INTO jobs(id,source_id,data) VALUES(?,?,?)').run('tip-job','manual',JSON.stringify({id:'tip-job'}));
    const original={id:'tip-resume',jobId:'tip-job',content:'# Candidate\n## 技能\n- SQL',language:'zh',layout:'classic',status:'reviewed',reviewedAt:'2026-01-01T00:00:00.000Z',notes:['技能：精简重复的技术条目。'],reviewTipsVersion:1};
    store.createResume(original);
    store.editResume(original.id,{content:original.content,layout:'campus',review:false,revision:1});
    let saved=store.get('resumes',original.id);
    assert.equal(saved.reviewTipsVersion,1);
    assert.deepEqual(saved.notes,original.notes);
    store.editResume(original.id,{content:'# Candidate\n## 项目经历\n- API 测试',layout:'campus',review:false,revision:2});
    saved=store.get('resumes',original.id);
    assert.equal(saved.reviewTipsVersion,0);
    assert.deepEqual(saved.notes,[]);
    assert.match(resumeReviewTips(saved)[0],/^项目经历：/);
  }finally{store.close();}
});
