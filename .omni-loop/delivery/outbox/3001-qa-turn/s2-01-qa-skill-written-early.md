---
id: s2-01-qa-skill-written-early
prd: 3001
slice: s2
rank: medium
bears-on: none
raised: 2026-11-17
wave: 1
excuses: [kit/plugin/skills/qa/SKILL.md, kit/lib/help/entries.ts, kit/lib/help/entries.test.ts, docs/guide/runners.md, .github/workflows/supabase.yml, apps/galaxy/src/runners/runners.skills.migration.test.ts, apps/galaxy/src/runners/runners.ultra-skills.migration.test.ts]
---

## The question, in plain words

Letting runners take the new QA check before its instructions exist would leave the build red between the two waves, because the guide must only name checks that exist. Who should write those instructions first?

## The decision, in plain words

This first step wrote QA's instructions, its help line and the guide's mention itself, so every check stays green between the waves. The next step can rewrite those instructions freely.

## The intro, for fun

The plan said switch on the new tool first and deliver it later.

## The punchline, for fun

The guide refused to name a tool that did not exist, so we delivered it early.

## The options, in plain words

A. Keep it: s2 wrote the skill, its help entry and the guide's line, so every wave stays green; s3 refines them.
B. Undo it in s2: take qa off the runner lists and the database's fixed list until s3, which then needs a migration and the contract outside its own territory.
C. Merge s2 and s3 into one slice in the plan, so the switch and the skill land together.

## What I had to decide

Whether slice s2 keeps the /omni:qa skill, its help entry and the guide's mention it wrote outside its territory, or whether s3 alone writes them. The plan has s2 add qa to RUNNABLE_SKILLS (so the database's fixed list, roles.ts and the Heroes count change together) and s3 write kit/plugin/skills/qa/SKILL.md. But apps/galaxy/src/docs/guide.test.ts holds the Runners page's sentence equal to RUNNABLE_SKILLS and refuses an /omni:<name> with no plugin skill folder, and the skill folder needs a help entry (kit/lib/help/entries.ts) and the skills count (44 to 45). With qa runnable and no folder, the preflight is red and /omni:wave merges no red slice, so s3, s4 and s5 would never start. Outside the row's territory, s2 also changed: docs/guide/runners.md (the runner's lines), .github/workflows/supabase.yml (the step that runs supabase/checks/qa_turn.sql), apps/galaxy/src/runners/runners.skills.migration.test.ts and runners.ultra-skills.migration.test.ts (each names the newest list of the runners' fixed skills: qa added), kit/lib/help/entries.ts and entries.test.ts, and kit/plugin/skills/qa/SKILL.md (written from spec section 2: the preview, the criteria, the edges, five bugs at most with steps, expected, actual and the preview's URL, one comment, the record line).

## What I did meanwhile

The skill, its help entry and the guide's line stand as written; s3 still owns kit/plugin/skills/qa/ and refines the skill and adds its tests, and still sends the run's tokens from the runner.

## What it costs to change later

Rewriting or deleting one Markdown file, one help entry and one count; no data, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the skill's wording matches what s3's agent would have written from the plan (author)
- the skill has no test of its own yet: s3's done-when names the plugin's skill tests (author)
