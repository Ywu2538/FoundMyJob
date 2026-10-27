export const profileFocusField = track => track === 'experienced' ? 'experience' : 'projects';

export function profileTrackFields(track, translate = zh => zh) {
  const t = (zh, en) => translate(zh, en);
  if (track === 'experienced') {
    return {
      guide: t('社招优先填写相关工作经历；校园项目仅在能证明目标岗位能力时填写。', 'For experienced roles, prioritize relevant work. Include campus projects only when they show skills for the target role.'),
      experience: [
        t('工作经历（重点）', 'Work experience (priority)'),
        t('公司、岗位、时间、职责、采取的行动和可核实成果', 'Company, role, dates, responsibilities, actions and verifiable results'),
      ],
      projects: [
        t('项目经历（选填，含校园项目）', 'Projects (optional, including campus projects)'),
        t('与目标岗位相关的工作或校园项目：你的角色、使用的技能和真实成果；没有可留空', 'Relevant work or campus projects: your role, skills and real results; leave blank if none'),
      ],
    };
  }
  return {
    guide: t('校招可重点填写教育、实习和校园项目；没有工作经历可留空。', 'For campus roles, focus on education, internships and campus projects. Work experience can be left blank.'),
    experience: [
      t('实习与工作经历（选填）', 'Internships & work experience (optional)'),
      t('实习单位、岗位、时间、实际承担的工作和可核实成果；没有可留空', 'Internship employer, role, dates, your work and verifiable results; leave blank if none'),
    ],
    projects: [
      t('校园与课程项目（推荐）', 'Campus & course projects (recommended)'),
      t('课程、竞赛、社团或个人项目：目标、你的角色、行动和真实成果', 'Course, competition, club or personal project: goal, your role, actions and real results'),
    ],
  };
}
