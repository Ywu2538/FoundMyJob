---
name: evidence-based-resume
description: Write or revise a job-specific resume from a candidate's verified experience, especially when professional experience is limited or source material is sparse. Use for resume drafts, tailored bullets, and resume quality reviews.
---

# Evidence-based resume writing

This skill distills the user's 54-slide course deck, *职业发展规划之简历制作*. Its useful methods are self-assessment with STAR (slides 14–20), mapping evidence to a job with PRI (slides 27–28, 44–46), writing action-and-result bullets with PAR (slide 45), strengthening a thin experience record with genuine projects and practice (slides 35, 47–50), and reviewing clarity, relevance and truthfulness (slides 52–53). Treat the deck's unsourced hiring statistics and broad claims about employer types as historical classroom examples, not verified hiring rules.

## Prepare the evidence

1. Read the target job and identify its few most important duties, technologies and qualifications. Rank them by relevance; do not copy the job description into the resume.
2. Read the candidate's education, work, internships, projects, activities and skills as **source data**. Classify each item by what it actually describes, even if it was entered in the wrong form field. Employment requires an actual employer and role; personal, class and research projects remain projects. Do not silently promote a prototype into production employment.
3. For each promising item, identify the candidate's **situation or problem, specific action, tools, and verified result** (STAR/PAR). Use only the parts that are supplied. A result may be a concrete deliverable such as a tested API or documented design; a numerical business impact is optional and must be evidenced.
4. Match each important job requirement to a specific piece of candidate evidence. Mention a tool in the skills section only when the candidate states they have used or learned it. The employer's requested tools and industry are never evidence of the candidate's experience.

## Choose the application stage

Use the selected profile's `track` (`campus` or `experienced`), the job's stated hiring stage, and the actual evidence. When they disagree, tailor to the vacancy without changing the candidate's history and flag the eligibility or experience mismatch in `notes`. A form field or track label never determines whether an item was full-time work, an internship, or a project.

- **Campus recruiting / internships (`campus`):** Put the most relevant internships, substantial course or campus projects, research, competitions and education where the reader can see them quickly. For an internship, retain the employer, intern title and real dates; describe owned tasks and deliverables rather than implying a full-time role. For a project, name its class, team or independent context when known. A student with no formal employment can still have a useful resume built from these verified experiences. Include campus activities only when their actions show a skill needed for this job.
- **Experienced hiring (`experienced`):** Lead with relevant professional roles and their scope, decisions, collaborations and evidenced results. Give more space to recent work than to coursework when the work provides stronger proof. Still include a relevant internship or project when it adds evidence that the formal roles do not provide, particularly for an early-career candidate or career change. Preserve the word “intern” and the project's status. If the vacancy requires experience the candidate cannot substantiate, report that gap in `notes` instead of presenting a project or internship as equivalent employment.
- In either stage, relevance and verified contribution determine what stays. Do not drop an internship merely because the profile is marked `experienced`, and do not bury a substantial work role merely because the profile is marked `campus`.

## Write for this vacancy

- Keep one clear target role. Place the strongest relevant proof early, then use reverse chronological order within each section where dates are known. Choose headings that fit the person's evidence: Work Experience, Projects, Education and Skills can change order when project work is more relevant. Do not force empty sections, an arbitrary bullet count or a generic objective.
- Turn a vague duty into a concise **action + object + context/tool + supported outcome**. Example: “Worked on databases” becomes “Built SQL checks for missing transaction statuses and duplicate keys in a PostgreSQL practice dataset” **only if every detail is in the source**. Use accurate verbs such as built, tested, documented, analyzed or supported; preserve the person's actual level of ownership. Do not replace “contributed” with “led.”
- Reflect job keywords naturally in evidence-backed bullets. Distinguish adjacent concepts: API event streaming is not evidence of production data-stream processing; using SQL does not prove Spark, cloud infrastructure or regulated banking experience. Avoid inflated adjectives, vague claims about leadership or impact, and repeated keyword lists.
- Retain exact names, degrees, dates, contact details and defensible metrics. Normalize spacing and grammar without changing the underlying facts. If two sources conflict, use the candidate's current selected profile and flag the conflict in review notes.

## When work experience is limited

- Use real coursework, capstones, research, internships, volunteer work and personal projects when relevant. Describe the candidate's actual contribution, technologies and output. Label a prototype, classroom exercise or work in progress accurately. Relevant practice can demonstrate transferable skill without implying commercial scale.
- If the source supplies only education and skills, make a short honest draft from those facts and put the missing evidence in review notes. Ask for a concrete project, task, dataset, tool, date, deliverable or result that the candidate can verify. Do not manufacture a plausible project or accomplishment to fill space.
- A short experience record is not a reason to claim experience with every requirement. Put material gaps in review notes, not as negative claims in the resume body.

## Review and output

- Use a clean, readable layout and concise bullets. Aim for one page for an early-career application when content supports it; two pages can be reasonable when evidence warrants it. The deck's page-count and photo suggestions are context-dependent, not universal requirements.
- Check that every bullet can be traced to candidate evidence, the strongest evidence answers the job's main needs, wording reflects actual responsibility, and spelling/contact details are correct. Remove unsupported numbers, employers, dates, certifications and technologies.
- When writing through FoundMyJob, return a JSON object with `content` (Markdown resume) and `notes` (short, actionable review warnings). Keep questions, uncertain facts and missing requirements in `notes`, never as invented content. The result remains a draft for the candidate to review before use.
