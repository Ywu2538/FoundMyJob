import {escapeHtml as e} from './core.js';
import {t as tr} from './i18n.js';

const reasons={
  not_recorded:['画像尚未填写对应经历，不能据此判定不具备。','No corresponding experience is recorded; this does not mean you lack it.'],
  manual_check:['此条件需要人工核对原文与经历。','Review this condition against your experience.'],
  years_unknown:['尚无可直接比较的总工作年限；不会累加项目时长或不完整的日期。','No comparable total work experience is recorded. Project durations and partial dates are not added up.'],
  explicit_years:['画像明确填写的总工作年限达到这条要求。','The explicitly stated total work experience meets this condition.'],
  years_gap:['画像明确填写的总工作年限低于这条要求。','The explicitly stated total work experience is below this condition.'],
  applied_evidence:['工作或项目原文记录了相关实际使用经历。','The work or project text records relevant hands-on experience.'],
  explicit_absence:['画像原文明确说明尚无这项经历。','Your profile explicitly says this experience is absent.'],
  needs_context:['已有相关经历；要求中的程度、年限或其他条件仍需确认。','Related experience is recorded; proficiency, duration or additional conditions still need checking.'],
  conflicting_evidence:['经历中存在不同表述，请确认后更新画像。','The profile contains conflicting statements. Confirm them and update your profile.'],
  mention_only:['仅有技能声明、学习记录或相关提及，尚需确认实际经历。','Only a skill declaration, learning record or related mention was found. Confirm applied experience.'],
};
const fields={experience:['工作与实习经历','Work and internships'],projects:['项目经历','Projects'],education:['教育经历','Education'],skills:['技能清单','Skills list']};
const statuses={supported:['符合','Meets requirements'],unknown:['部分符合','Partially meets requirements'],gap:['不符合','Does not meet requirements']};
const statusIcons={supported:'<path d="m5 12 4 4L19 6"/>',unknown:'<path d="M12 8v5"/><circle cx="12" cy="17" r=".75" fill="currentColor" stroke="none"/><path d="m12 3 10 18H2Z"/>',gap:'<path d="m6 6 12 12M6 18 18 6"/>'};
const kinds={required:['必须条件','Required'],preferred:['加分条件','Preferred'],unspecified:['重要性未注明','Priority unspecified']};
const label=pair=>tr(...pair);

export function evidencePanelHtml(analysis,profileLabel,{hasDraft=false}={}) {
  const {rows}=analysis;
  return `<p class="evidence-intro">${tr('逐项对比岗位要求与已保存的经历。「部分符合」包含尚待确认的条件；未填写经历不代表不具备。','Compare each requirement with your saved experience. “Partially meets requirements” includes conditions that need confirmation; missing information does not mean missing ability.')}</p>
  ${hasDraft?`<p class="evidence-warning">${tr('此画像有未保存修改，当前对照尚未包含这些修改。','This profile has unsaved changes that are not included here.')}</p>`:''}
  ${analysis.summaryOnly?`<p class="evidence-warning">${tr('当前仅有岗位摘要，条件可能不完整，请核对招聘原文。','Only a job summary is available. Check the original listing for complete conditions.')}</p>`:''}
  ${rows.length?`<div class="evidence-table-wrap"><table class="evidence-table"><caption class="sr-only">${tr('经历对比：岗位要求、我的经历与判断','Experience comparison: job requirements, my experience and assessment')} · ${e(profileLabel)}</caption><thead><tr><th scope="col">${tr('岗位要求','Requirement')}</th><th scope="col">${tr('我的经历','My experience')}</th><th scope="col">${tr('判断','Assessment')}</th></tr></thead><tbody>
  ${rows.map(row=>`<tr><td data-label="${tr('岗位要求','Requirement')}"><span class="evidence-kind ${row.kind}">${label(kinds[row.kind])}</span><p>${e(row.requirement)}</p></td>
  <td data-label="${tr('我的经历','My experience')}">${row.evidence.length?row.evidence.map(item=>`<div class="evidence-experience"><span class="evidence-field">${label(fields[item.field])}</span><p class="evidence-excerpt">${e(item.quote)}</p></div>`).join(''):`<p>${tr('尚未填写对应经历','No matching experience recorded')}</p>`}</td>
  <td data-label="${tr('判断','Assessment')}"><span class="evidence-status ${row.status}"><svg class="evidence-status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${statusIcons[row.status]}</svg>${label(statuses[row.status])}</span><p class="evidence-reason">${label(reasons[row.reason])}</p></td></tr>`).join('')}</tbody></table></div>`:
  `<p class="evidence-empty">${tr('已收录内容中尚未识别到明确的岗位要求。请查看招聘原文，或导入包含完整任职要求的岗位描述。','No clear requirements were identified in the saved content. Check the original listing or import a description with full qualifications.')}</p>`}
  ${analysis.truncated?`<p class="field-help">${tr('当前展示前 60 条要求，其余请查看岗位原文。','Showing the first 60 requirements. See the original listing for the remainder.')}</p>`:''}
  <button type="button" class="button secondary" data-action="edit-evidence-profile">${tr('补充或修正这份画像','Add or correct profile evidence')}</button>`;
}
