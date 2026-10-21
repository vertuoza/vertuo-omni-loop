# Plan: a repository allows its own skills on a runner

PRD #2313, spec beside this plan (`spec.md`). The feature branch `feat/runner-repo-skills` merges
into `main` with `Closes #2313`; each slice is a sub-PR from `feat/runner-repo-skills--<slice>` into
the feature branch, with `Part of #2313`.

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | An owner's allowance is stored, and a line of an allowed skill is queued: the migration, `checkLine` and `checkRunnerLine` with the same verdict, `queue()` | `supabase/migrations/` `supabase/database.types.ts` `apps/galaxy/src/runners/runners.contract` `apps/galaxy/src/runners/runners.skills.migration.test.ts` `apps/galaxy/src/runners/runners.service` `apps/galaxy/src/runners/runners.repository` `kit/lib/runner/line` | — | 1 | deep |
| s2 | The runner runs an allowed repository skill: the claim carries `allowedSkills`, the runner checks them and the `SKILL.md` at `origin/<default>`, and loads `.mcp.json` | `apps/galaxy/src/runners/runners.service` `apps/galaxy/src/runners/runners.repository` `kit/lib/runner/api` `kit/lib/runner/runner` `kit/lib/runner/job` | s1 | 2 | deep |
| s3 | Settings › Repositories shows the Runner skills block: the live read of the default branch's skills, Allow on runner (owner only), allowed by, gone, the read's error | `apps/galaxy/src/repositories/` `apps/galaxy/app/api/repositories/skills/` `apps/galaxy/README.md` | s1 | 2 | build |
| s4 | Sending and the job rules: `omni runner send` and Send to terminal take an allowed `/<name>` line, `answer()` refuses a repository-skill job, `prdOfLine` ignores it | `kit/bin/commands/runner-follow` `kit/bin/commands/runner.test.ts` `apps/galaxy/src/runners/send/` `apps/galaxy/src/runners/continue` `apps/galaxy/src/runners/runners.service` | s1 | 3 | build |

**Shared ground.** `apps/galaxy/src/runners/runners.service` (and its test) is declared by s1
(`queue()`), s2 (the claim) and s4 (`answer()`), and `apps/galaxy/src/runners/runners.repository` by
s1 and s2: the waves keep them apart (s1 in wave 1, s2 in wave 2, s4 in wave 3). `kit/dist/` is
generated: no slice lists it, and the wave rebuilds it once after merging.

## Per slice: done when

### s1 (deep: a migration, a security-definer function and a contract both sides read) (`ui: yes`)

- A migration dated after the newest on `main` creates `public.repository_runner_skills`,
  `set_repository_runner_skill()` and `repository_runner_skills_of()` as the spec's **The data**
  says; `supabase/database.types.ts` is regenerated.
- `runners.skills.migration.test.ts` proves: only an owner allows or disallows (42501 otherwise); a
  malformed name or a fixed skill's name is refused (22023); an unknown repository is refused
  (P0002); a member reads the rows and cannot write them.
- `checkLine(line, allowed)` and `checkRunnerLine(line, allowed)` answer
  `{ ok, kind, skill, args }`; one table in `runners.contract.test.ts` runs every case of the spec's
  Test seams through both and expects the same verdict; the two fixed lists stay equal;
  `linePrd('/validate-prd 347')` is 347.
- `queue()` reads `repository_runner_skills_of()` and queues `/validate-prd 347` when allowed;
  refuses it with `/validate-prd is not allowed on a runner for <repo>: an owner allows it in
  Settings › Repositories.` when not; `/omni:<fixed>` lines are queued as today.

### s2 (deep: what runs on someone's machine) (`ui: yes`)

- `GET /api/runners/next` answers the claimed job with `allowedSkills`, read at claim; a skill turned
  off after its job was queued comes back absent (`runners.service.test.ts`).
- The kit's `JobSchema` reads `allowedSkills`, `[]` when absent (`api.test.ts`).
- `placeOf()` refuses a line off the fixed list and off `allowedSkills`; once the worktree is cut
  from `origin/<default>`, a repository skill without `.claude/skills/<name>/SKILL.md` fails
  `refused: /<name> is not on <default branch>` without running; one with it runs
  (`runner.test.ts`).
- A repository-skill job whose worktree holds `.mcp.json` runs claude with `--mcp-config .mcp.json`;
  a fixed-skill job's arguments are unchanged (`job.test.ts`).
- A repository-skill job ends done or failed from its exit code, with no `outcome`.

### s3 (`ui: yes`)

- A `skillsReader` over `RepoReader` lists `.claude/skills/*/SKILL.md` of the default branch with
  each frontmatter's `name` and `description`, skipping a folder with no `SKILL.md` and an invalid
  name; a failed read answers its reason (`skills.test.ts`, a stubbed reader).
- `GET /api/repositories/skills?repo=` answers the skills, each allowed or not with who and when,
  and the allowed skills no longer listed as `gone`; a non-member is refused.
- The block in `RepositoriesView.tsx` is closed by default; opened, it shows each `/name` with its
  description as the tooltip, `allowed by @<login> on <date>`, **Gone: no longer on <default
  branch>**, `Skills could not be read: <why>`; the switches are disabled for a member and call
  `set_repository_runner_skill()` for an owner (`render.test.ts`, `store.test.ts`).
- The page matches the `repositories` draft screen's after; `apps/galaxy/README.md` names the block.

### s4 (`ui: yes`)

- `omni runner send '/validate-prd 347'` sends the line to the app and prints the app's refusal
  when it has one; a malformed line is still refused locally (`runner.test.ts`).
- Send to terminal's `sendable(line, allowed)` takes the repository's allowed skills
  (`targets.test.ts`, `send.read.test.ts`).
- `answer()` refuses to resume a repository-skill job; dismissing its questions works
  (`runners.service.test.ts`).
- `prdOfLine` returns null for a repository-skill line (`continue.test.ts`).
